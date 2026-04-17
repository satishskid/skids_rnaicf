// Phase 05 — ScreeningObservationWorkflow.
//
// Durable orchestration for a single observation, from ingest to doctor
// sign-off. Replaces the fire-and-forget work that used to happen inside
// the POST /api/observations handler. Steps (each recorded in the
// workflow_events table so ops can reconstruct the run):
//
//   persist                  insert into observations (or no-op on retry)
//   quality-gate             light heuristics, decides next branches
//   embed                    bge-small-en-v1.5 via Workers AI → Turso
//   enqueue-second-opinion   cond: confidence < threshold → SANDBOX_2ND_OPINION_Q
//   await-review             wait 72h for the doctor-review event
//   notify                   placeholder for report/parent notification
//
// The workflow is defensive: every step catches and records its own
// failure into workflow_events, and a throw fails the step (letting CF
// Workflows retry with its configured policy). The whole workflow is
// idempotent — observations use INSERT OR REPLACE on retry so replaying a
// step never corrupts state.

import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { createClient, type Client, type InValue } from '@libsql/client'
import type { Bindings } from '../index'
import { embedAndStoreBackground } from '../lib/embeddings'

export type ScreeningObservationParams = {
  // The full observation payload as received from the mobile/web client.
  // Kept as a single blob so the workflow is fully self-contained.
  observation: {
    id: string
    sessionId: string
    childId: string
    campaignCode: string
    moduleType: string
    bodyRegion?: string | null
    mediaUrl?: string | null
    mediaUrls?: string[] | null
    mediaType?: string | null
    captureMetadata?: unknown
    aiAnnotations?: unknown
    annotationData?: unknown
    riskLevel?: number
    screenedBy?: string
    deviceId?: string | null
    timestamp?: string
    confidence?: number
  }
  // Whether the original request already embedded the observation (tier-1
  // path still wanted a synchronous write). Short-circuits `embed` step.
  alreadyEmbedded?: boolean
}

// Body of the doctor-review external event (see observations.ts PATCH).
export type DoctorReviewEvent = {
  observationId: string
  status: 'confirmed' | 'corrected'
  riskLevel?: string
}

const SECOND_OPINION_CONFIDENCE_THRESHOLD = 0.75
const SECOND_OPINION_MODERATE_RISK_THRESHOLD = 0.9
const SECOND_OPINION_MODULES = new Set(['vision', 'ear', 'skin', 'dental'])

export class ScreeningObservationWorkflow extends WorkflowEntrypoint<
  Bindings,
  ScreeningObservationParams
> {
  async run(event: WorkflowEvent<ScreeningObservationParams>, step: WorkflowStep) {
    const { observation, alreadyEmbedded } = event.payload
    const { id: observationId } = observation
    const workflowId = event.instanceId

    const db = this.openDb()

    // Step 1: persist. Idempotent via INSERT OR REPLACE.
    await step.do('persist', async () => {
      const t0 = Date.now()
      try {
        await db.execute({
          sql: `INSERT OR REPLACE INTO observations (
                  id, session_id, child_id, campaign_code, module_type, body_region,
                  media_url, media_urls, media_type, capture_metadata, ai_annotations,
                  annotation_data, risk_level, screened_by, device_id, timestamp,
                  synced_at, workflow_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
          args: [
            observation.id,
            observation.sessionId,
            observation.childId,
            observation.campaignCode,
            observation.moduleType,
            observation.bodyRegion ?? null,
            observation.mediaUrl ?? null,
            observation.mediaUrls ? JSON.stringify(observation.mediaUrls) : null,
            observation.mediaType ?? null,
            observation.captureMetadata ? JSON.stringify(observation.captureMetadata) : null,
            observation.aiAnnotations ? JSON.stringify(observation.aiAnnotations) : null,
            observation.annotationData ? JSON.stringify(observation.annotationData) : null,
            observation.riskLevel ?? 0,
            observation.screenedBy ?? 'nurse',
            observation.deviceId ?? null,
            observation.timestamp ?? new Date().toISOString(),
            workflowId,
          ],
        })
        await this.recordEvent(db, { observationId, workflowId, stepName: 'persist', status: 'ok', ms: Date.now() - t0 })
      } catch (err) {
        await this.recordEvent(db, { observationId, workflowId, stepName: 'persist', status: 'error', ms: Date.now() - t0, error: errorText(err) })
        throw err
      }
    })

    // Step 2: quality-gate. Classify the observation so later branches know
    // how to dispatch. No writes here except the event record.
    const gate = await step.do('quality-gate', async () => {
      const t0 = Date.now()
      try {
        const confidence = typeof observation.confidence === 'number'
          ? observation.confidence
          : extractConfidence(observation.aiAnnotations)
        const riskLevel = observation.riskLevel ?? 0
        const needsSecondOpinion =
          confidence < SECOND_OPINION_CONFIDENCE_THRESHOLD ||
          (riskLevel >= 2 && confidence < SECOND_OPINION_MODERATE_RISK_THRESHOLD) ||
          SECOND_OPINION_MODULES.has(observation.moduleType)
        const result = { confidence, riskLevel, needsSecondOpinion }
        await this.recordEvent(db, { observationId, workflowId, stepName: 'quality-gate', status: 'ok', ms: Date.now() - t0 })
        return result
      } catch (err) {
        await this.recordEvent(db, { observationId, workflowId, stepName: 'quality-gate', status: 'error', ms: Date.now() - t0, error: errorText(err) })
        throw err
      }
    })

    // Step 3: embed. Skipped if the observation came in already embedded.
    await step.do('embed', async () => {
      const t0 = Date.now()
      if (alreadyEmbedded) {
        await this.recordEvent(db, { observationId, workflowId, stepName: 'embed', status: 'skipped', ms: Date.now() - t0 })
        return
      }
      try {
        const ai = this.env.AI
        if (!ai) {
          await this.recordEvent(db, { observationId, workflowId, stepName: 'embed', status: 'skipped', ms: Date.now() - t0 })
          return
        }
        await embedAndStoreBackground(db, ai, {
          id: observation.id,
          module_type: observation.moduleType,
          body_region: observation.bodyRegion ?? null,
          ai_annotations: observation.aiAnnotations ? JSON.stringify(observation.aiAnnotations) : null,
          annotation_data: observation.annotationData ? JSON.stringify(observation.annotationData) : null,
          risk_level: observation.riskLevel ?? 0,
        })
        await this.recordEvent(db, { observationId, workflowId, stepName: 'embed', status: 'ok', ms: Date.now() - t0 })
      } catch (err) {
        // Embedding failures must not fail the workflow — they're
        // recoverable via the admin backfill job. Record and move on.
        await this.recordEvent(db, { observationId, workflowId, stepName: 'embed', status: 'error', ms: Date.now() - t0, error: errorText(err) })
      }
    })

    // Step 4: fan-out. Queue the second-opinion request if needed.
    await step.do('enqueue-second-opinion', async () => {
      const t0 = Date.now()
      if (!gate.needsSecondOpinion) {
        await this.recordEvent(db, { observationId, workflowId, stepName: 'enqueue-second-opinion', status: 'skipped', ms: Date.now() - t0 })
        return
      }
      try {
        const q = this.env.SANDBOX_2ND_OPINION_Q
        if (!q) {
          await this.recordEvent(db, { observationId, workflowId, stepName: 'enqueue-second-opinion', status: 'skipped', ms: Date.now() - t0 })
          return
        }
        await q.send({
          observationId,
          workflowId,
          moduleType: observation.moduleType,
          confidence: gate.confidence,
          riskLevel: gate.riskLevel,
        })
        await this.recordEvent(db, { observationId, workflowId, stepName: 'enqueue-second-opinion', status: 'ok', ms: Date.now() - t0 })
      } catch (err) {
        await this.recordEvent(db, { observationId, workflowId, stepName: 'enqueue-second-opinion', status: 'error', ms: Date.now() - t0, error: errorText(err) })
        // Do not fail the workflow — second opinion is advisory.
      }
    })

    // Step 5: await doctor review. 72h timeout → continue without review.
    // Review events are sent from observationRoutes.patch(':id/doctor-review').
    let reviewStatus: 'confirmed' | 'corrected' | 'timeout' = 'timeout'
    try {
      const reviewEvent = await step.waitForEvent<DoctorReviewEvent>('await-review', {
        type: 'doctor-review',
        timeout: '72 hours',
      })
      reviewStatus = reviewEvent.payload.status
      await this.recordEvent(db, { observationId, workflowId, stepName: 'await-review', status: 'ok' })
    } catch (err) {
      // step.waitForEvent throws on timeout. Record and continue to notify.
      await this.recordEvent(db, { observationId, workflowId, stepName: 'await-review', status: 'timeout', error: errorText(err) })
    }

    // Step 6: notify. Current behaviour is a logging stub — the analytics
    // trigger consumer picks up on workflow_events and the Phase 03 report
    // cron pre-warm already covers parent PDF delivery on-cadence.
    await step.do('notify', async () => {
      const t0 = Date.now()
      try {
        const q = this.env.ANALYTICS_Q
        if (q && reviewStatus !== 'timeout') {
          await q.send({
            kind: 'observation-reviewed',
            observationId,
            workflowId,
            status: reviewStatus,
          })
        }
        await this.recordEvent(db, { observationId, workflowId, stepName: 'notify', status: 'ok', ms: Date.now() - t0 })
      } catch (err) {
        await this.recordEvent(db, { observationId, workflowId, stepName: 'notify', status: 'error', ms: Date.now() - t0, error: errorText(err) })
      }
    })

    return { observationId, workflowId, reviewStatus }
  }

  private openDb(): Client {
    return createClient({
      url: this.env.TURSO_URL,
      authToken: this.env.TURSO_AUTH_TOKEN,
    })
  }

  private async recordEvent(
    db: Client,
    evt: {
      observationId: string
      workflowId: string
      stepName: string
      status: 'started' | 'ok' | 'error' | 'skipped' | 'timeout'
      ms?: number
      error?: string
    }
  ): Promise<void> {
    const args: InValue[] = [
      crypto.randomUUID(),
      evt.observationId,
      evt.workflowId,
      evt.stepName,
      evt.status,
      evt.ms ?? null,
      evt.error ?? null,
    ]
    try {
      await db.execute({
        sql: `INSERT INTO workflow_events (id, observation_id, workflow_id, step_name, status, ms, error)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args,
      })
    } catch (err) {
      console.warn('[workflow] recordEvent failed', err)
    }
  }
}

function extractConfidence(aiAnnotations: unknown): number {
  if (!aiAnnotations) return 1
  try {
    const arr = typeof aiAnnotations === 'string' ? JSON.parse(aiAnnotations) : aiAnnotations
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0] as { confidence?: unknown }
      if (typeof first.confidence === 'number') return first.confidence
    }
  } catch {
    // fall through
  }
  return 1
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 500)
  return String(err).slice(0, 500)
}
