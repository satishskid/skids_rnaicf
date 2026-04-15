/**
 * Admin: embedding backfill batch endpoint.
 * POST /api/admin/embed-batch  → embeds up to N observations that currently
 * have NULL embedding. Returns counts per status.
 *
 * Used by scripts/backfill-embeddings.ts.
 * Rate-limited implicitly by the caller's sleep interval (100/min default).
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { embedAndStore } from '../lib/embeddings'
import { logAudit } from './audit-log'

export const adminEmbeddingsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminEmbeddingsRoutes.post('/embed-batch', async (c) => {
  const db = c.get('db')
  const ai = c.env.AI
  if (\!ai) return c.json({ error: 'Workers AI binding missing' }, 500)

  const body = (await c.req.json().catch(() => ({}))) as { batchSize?: number }
  const batchSize = Math.min(Math.max(body.batchSize ?? 100, 1), 500)

  const r = await db.execute({
    sql: `SELECT id, module_type, body_region, ai_annotations, annotation_data, risk_level
          FROM observations
          WHERE embedding IS NULL
          ORDER BY created_at ASC
          LIMIT ?`,
    args: [batchSize],
  })

  if (r.rows.length === 0) {
    return c.json({ done: true, embedded: 0, unchanged: 0, errors: 0, processed: 0 })
  }

  let embedded = 0
  let unchanged = 0
  let errors = 0
  const errorDetails: string[] = []

  for (const row of r.rows as unknown as Array<{
    id: string
    module_type: string
    body_region: string | null
    ai_annotations: string | null
    annotation_data: string | null
    risk_level: number | null
  }>) {
    const res = await embedAndStore(db, ai, row)
    if (res.status === 'embedded') embedded++
    else if (res.status === 'unchanged') unchanged++
    else {
      errors++
      if (errorDetails.length < 10) errorDetails.push(`${res.id}: ${res.error}`)
    }
  }

  const userId = c.get('userId')
  if (userId) {
    await logAudit(db, {
      userId,
      action: 'embed.batch',
      details: JSON.stringify({ batchSize, embedded, unchanged, errors }),
    })
  }

  // Total remaining (for progress bar)
  const remainingRow = await db.execute(
    'SELECT COUNT(*) AS n FROM observations WHERE embedding IS NULL'
  )
  const remaining = Number(
    (remainingRow.rows[0] as Record<string, unknown>)?.n || 0
  )

  return c.json({
    done: r.rows.length < batchSize && remaining === 0,
    processed: r.rows.length,
    embedded,
    unchanged,
    errors,
    errorDetails: errorDetails.length ? errorDetails : undefined,
    remaining,
  })
})
