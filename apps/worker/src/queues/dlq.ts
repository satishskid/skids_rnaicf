// Phase 05 — dead-letter handler.
//
// Runs when any consumer exhausts its retry budget. Records the poison
// message into audit_log and (if Langfuse is configured) emits a trace so
// ops gets paged instead of the failure disappearing silently.

import { createClient } from '@libsql/client'
import type { Bindings } from '../index'

type DlqKind = 'sandbox-pdf-dlq' | 'sandbox-2nd-opinion-dlq' | 'analytics-trigger-dlq'

export async function handleDlqBatch(
  batch: MessageBatch<unknown>,
  env: Bindings,
  kind: DlqKind
): Promise<void> {
  if (batch.messages.length === 0) return

  const db = createClient({
    url: env.TURSO_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  })

  for (const msg of batch.messages) {
    try {
      await db.execute({
        sql: `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details)
              VALUES (?, 'system:dlq', ?, 'queue', ?, ?)`,
        args: [
          crypto.randomUUID(),
          `queue.dlq.${kind}`,
          msg.id,
          JSON.stringify({
            kind,
            attempts: msg.attempts ?? null,
            body: msg.body,
            timestamp: new Date().toISOString(),
          }),
        ],
      })
      if (env.LANGFUSE_PUBLIC_KEY) {
        // Fire-and-forget Langfuse trace. Silent on any failure — DLQ
        // persistence above is the source of truth.
        void fetch(`${env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'}/api/public/ingestion`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Basic ${btoa(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY || ''}`)}`,
          },
          body: JSON.stringify({
            batch: [{
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              type: 'trace-create',
              body: {
                id: crypto.randomUUID(),
                name: `dlq.${kind}`,
                input: msg.body,
                level: 'ERROR',
                statusMessage: `queue ${kind} poison message`,
              },
            }],
          }),
        }).catch(() => { /* swallow */ })
      }
      msg.ack()
    } catch (err) {
      console.error('[queue.dlq] handler error', err)
      msg.retry()
    }
  }
}
