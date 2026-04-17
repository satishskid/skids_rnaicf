// Phase 06 — sandbox-second-opinion queue consumer.
//
// Life of a message:
//   1. Load the observation + its session_id.
//   2. Check session_ai_budget (default 5/session) — reject-and-ack if over.
//   3. Upsert a `pending` ai_annotations_secondary row (idempotent on
//      observation_id + model_version).
//   4. If the SANDBOX_AI binding is wired, POST to the container's
//      /analyze endpoint with a pre-signed media URL; update the row with
//      the result. If the binding is absent (deploy doesn't have the
//      [[containers]] block yet), leave the row pending — ops or a
//      follow-up job can drain it.
//   5. On either path, write an accuracy_metrics row with the available
//      labels so the accuracy dashboard can recompute rolling scores.
//
// All failures ack the message after recording the error. Retry is only
// used for genuinely transient conditions (DB 5xx, network timeouts).

import { createClient, type Client } from '@libsql/client'
import type { Bindings } from '../../index'
import type { SandboxSecondOpinionMessage } from '../index'

const DEFAULT_BUDGET_LIMIT = 5
const DEFAULT_MODEL_VERSION = 'v1.0'

type SandboxContainerBinding = {
  fetch: (request: Request) => Promise<Response>
}

export async function handleSandboxSecondOpinionBatch(
  batch: MessageBatch<SandboxSecondOpinionMessage>,
  env: Bindings
): Promise<void> {
  if (batch.messages.length === 0) return

  const db = createClient({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN })

  for (const msg of batch.messages) {
    const body = msg.body
    try {
      const handled = await handleOne(db, env, body)
      if (handled.transient) {
        msg.retry()
      } else {
        msg.ack()
      }
    } catch (err) {
      console.error('[queue.sandbox-second-opinion] unhandled error', err)
      // Defensive: non-transient errors should still ack after the
      // accuracy log has been written, but if we're here handleOne threw
      // before recording; retry once more to be safe.
      msg.retry()
    }
  }
}

async function handleOne(
  db: Client,
  env: Bindings,
  body: SandboxSecondOpinionMessage
): Promise<{ transient: boolean }> {
  const observationId = body.observationId

  // 1. Load observation metadata.
  const obsRow = await db.execute({
    sql: 'SELECT id, session_id, module_type, media_url FROM observations WHERE id = ? LIMIT 1',
    args: [observationId],
  })
  if (obsRow.rows.length === 0) {
    await recordAudit(db, 'queue.second-opinion.observation-missing', observationId, { body })
    return { transient: false }
  }
  const sessionId = obsRow.rows[0].session_id as string
  const moduleType = (obsRow.rows[0].module_type as string) ?? body.moduleType
  const mediaUrl = obsRow.rows[0].media_url as string | null

  // 2. Budget check.
  const budget = await enforceBudget(db, sessionId)
  if (!budget.allowed) {
    await recordAudit(db, 'queue.second-opinion.budget-exhausted', observationId, {
      sessionId,
      count: budget.count,
      limit: budget.limit,
    })
    return { transient: false }
  }

  // 3. Upsert pending secondary annotation row.
  const modelVersion = DEFAULT_MODEL_VERSION
  const modelName = `${moduleType}_secondary`
  const secondaryId = `sec_${crypto.randomUUID().replace(/-/g, '')}`
  try {
    await db.execute({
      sql: `INSERT INTO ai_annotations_secondary
              (id, observation_id, model_name, model_version, annotations, status, created_at)
            VALUES (?, ?, ?, ?, '[]', 'pending', datetime('now'))
            ON CONFLICT(observation_id, model_version) DO UPDATE
              SET status = 'pending', error = NULL, completed_at = NULL`,
      args: [secondaryId, observationId, modelName, modelVersion],
    })
  } catch (err) {
    // Probably a transient DB error — CF Queues will retry.
    console.warn('[queue.sandbox-second-opinion] pending row upsert failed', err)
    return { transient: true }
  }

  // 4. Run inference if the container is wired.
  const sandbox = (env as unknown as { SANDBOX_AI?: SandboxContainerBinding }).SANDBOX_AI
  let inferResult: InferResult
  if (!sandbox || !mediaUrl) {
    inferResult = { status: 'skipped', reason: sandbox ? 'no_media_url' : 'binding_missing' }
  } else {
    inferResult = await runContainerInference(sandbox, {
      observationId,
      moduleType,
      mediaUrl,
      modelKey: `r2://skids-models/second-opinion/${moduleType}/${modelVersion}/model.onnx`,
    })
  }

  // 5. Persist result.
  await db.execute({
    sql: `UPDATE ai_annotations_secondary
            SET status = ?,
                annotations = ?,
                quality = ?,
                ms_inference = ?,
                error = ?,
                completed_at = datetime('now')
          WHERE observation_id = ? AND model_version = ?`,
    args: [
      inferResult.status,
      JSON.stringify(inferResult.annotations ?? []),
      inferResult.quality ?? null,
      inferResult.msInference ?? null,
      inferResult.error ?? null,
      observationId,
      modelVersion,
    ],
  })

  // 6. Accuracy metrics — paired labels (secondary vs tier1/doctor) for
  //    offline aggregation. Failures here must not poison the queue.
  try {
    await writeAccuracyRow(db, {
      observationId,
      moduleType,
      secondaryLabel: inferResult.annotations?.[0]?.label ?? null,
      agreement: inferResult.agreementTier1 ?? null,
    })
  } catch (err) {
    console.warn('[queue.sandbox-second-opinion] accuracy row failed', err)
  }

  return { transient: false }
}

type InferResult = {
  status: 'ok' | 'error' | 'skipped'
  annotations?: Array<{ label?: string; confidence?: number; [k: string]: unknown }>
  quality?: 'good' | 'fair' | 'poor'
  msInference?: number
  error?: string
  agreementTier1?: number
  reason?: string
}

async function runContainerInference(
  sandbox: SandboxContainerBinding,
  job: { observationId: string; moduleType: string; mediaUrl: string; modelKey: string }
): Promise<InferResult> {
  try {
    const res = await sandbox.fetch(new Request('https://skids-sandbox-ai.internal/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        observation_id: job.observationId,
        module_type: job.moduleType,
        media_url: job.mediaUrl,
        model_key: job.modelKey,
      }),
    }))
    if (!res.ok && res.status !== 202) {
      return { status: 'error', error: `sandbox responded ${res.status}` }
    }
    const parsed = await res.json() as InferResult
    return parsed
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
    }
  }
}

async function enforceBudget(
  db: Client,
  sessionId: string
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const res = await db.execute({
    sql: `SELECT second_opinion_count, budget_limit FROM session_ai_budget WHERE session_id = ? LIMIT 1`,
    args: [sessionId],
  })
  if (res.rows.length === 0) {
    await db.execute({
      sql: `INSERT INTO session_ai_budget (session_id, second_opinion_count, budget_limit)
            VALUES (?, 1, ?)`,
      args: [sessionId, DEFAULT_BUDGET_LIMIT],
    })
    return { allowed: true, count: 1, limit: DEFAULT_BUDGET_LIMIT }
  }
  const count = Number(res.rows[0].second_opinion_count ?? 0)
  const limit = Number(res.rows[0].budget_limit ?? DEFAULT_BUDGET_LIMIT)
  if (count >= limit) {
    return { allowed: false, count, limit }
  }
  await db.execute({
    sql: `UPDATE session_ai_budget
            SET second_opinion_count = second_opinion_count + 1,
                last_update = datetime('now')
          WHERE session_id = ?`,
    args: [sessionId],
  })
  return { allowed: true, count: count + 1, limit }
}

async function writeAccuracyRow(
  db: Client,
  args: { observationId: string; moduleType: string; secondaryLabel: string | null; agreement: number | null }
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO accuracy_metrics
            (id, observation_id, module_type, secondary_label, agreement_score)
          VALUES (?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), args.observationId, args.moduleType, args.secondaryLabel, args.agreement],
  })
}

async function recordAudit(
  db: Client,
  action: string,
  entityId: string,
  details: unknown
): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details)
            VALUES (?, 'system:second-opinion', ?, 'observation', ?, ?)`,
      args: [crypto.randomUUID(), action, entityId, JSON.stringify(details)],
    })
  } catch {
    // Audit is best-effort.
  }
}
