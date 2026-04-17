// Phase 05 — analytics-trigger queue consumer.
//
// Receives high-priority observation events (reviews, manual refreshes)
// and forwards them to the @skids/analytics-worker service binding so the
// nightly DuckDB pipeline can debounce into an ad-hoc query execution.
// For now we call /run with the canonical-query payload when asked, and
// otherwise record the event for later batch processing.

import { createClient } from '@libsql/client'
import type { Bindings } from '../../index'
import type { AnalyticsTriggerMessage } from '../index'

export async function handleAnalyticsTriggerBatch(
  batch: MessageBatch<AnalyticsTriggerMessage>,
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
      if (body.kind === 'canonical-query' && env.ANALYTICS_SVC) {
        const res = await env.ANALYTICS_SVC.fetch('https://skids-analytics.internal/run', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ queryId: body.queryId, params: body.params ?? {} }),
        })
        if (!res.ok) throw new Error(`analytics-run ${res.status}`)
      }
      await db.execute({
        sql: `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details)
              VALUES (?, 'system:analytics-trigger', ?, 'analytics', ?, ?)`,
        args: [
          crypto.randomUUID(),
          `queue.analytics.${body.kind}`,
          'observationId' in body ? body.observationId : null,
          JSON.stringify(body),
        ],
      })
      msg.ack()
    } catch (err) {
      console.error('[queue.analytics-trigger] handler error', err)
      msg.retry()
    }
  }
}
