// Phase 05 — sandbox-second-opinion queue consumer (stub).
//
// Phase 06 replaces the body of this handler with the full ONNX re-
// analysis flow. For Phase 05 we only need the binding to exist so the
// workflow's fan-out step has somewhere to send. We log the intent into
// audit_log and ack so the queue drains.

import { createClient } from '@libsql/client'
import type { Bindings } from '../../index'
import type { SandboxSecondOpinionMessage } from '../index'

export async function handleSandboxSecondOpinionBatch(
  batch: MessageBatch<SandboxSecondOpinionMessage>,
  env: Bindings
): Promise<void> {
  if (batch.messages.length === 0) return

  const db = createClient({
    url: env.TURSO_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  })

  for (const msg of batch.messages) {
    try {
      const body = msg.body
      await db.execute({
        sql: `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details)
              VALUES (?, 'system:second-opinion', 'queue.second-opinion.stub', 'observation', ?, ?)`,
        args: [
          crypto.randomUUID(),
          body.observationId,
          JSON.stringify({
            moduleType: body.moduleType,
            confidence: body.confidence,
            riskLevel: body.riskLevel,
            workflowId: body.workflowId,
            phase: '05-stub',
          }),
        ],
      })
      msg.ack()
    } catch (err) {
      console.error('[queue.sandbox-second-opinion] handler error', err)
      msg.retry()
    }
  }
}
