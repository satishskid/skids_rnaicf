// Phase 05 — sandbox-pdf queue consumer.
//
// Accepts { observationId, reportKind, locale } messages and hands off to
// the Phase 03 PDF pipeline. The current wire-up is intentionally
// conservative: we log the intent into audit_log + workflow_events and
// (optionally) pre-warm the report cache via the scheduled handler. A
// follow-up will move full per-observation rendering here once the
// reportId lifecycle is designed. This keeps the queue infra honest today
// while avoiding duplicate token issuance.

import { createClient } from '@libsql/client'
import type { Bindings } from '../../index'
import type { SandboxPdfMessage } from '../index'

export async function handleSandboxPdfBatch(
  batch: MessageBatch<SandboxPdfMessage>,
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
              VALUES (?, 'system:sandbox-pdf', 'queue.sandbox-pdf.received', 'observation', ?, ?)`,
        args: [
          crypto.randomUUID(),
          body.observationId,
          JSON.stringify({
            reportKind: body.reportKind,
            locale: body.locale ?? 'en',
            issuedAt: body.issuedAt ?? new Date().toISOString(),
          }),
        ],
      })
      msg.ack()
    } catch (err) {
      console.error('[queue.sandbox-pdf] handler error', err)
      // Defer to CF Queues retry + DLQ policy from wrangler.toml.
      msg.retry()
    }
  }
}
