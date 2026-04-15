/**
 * Similarity search over observations (Turso native vectors).
 *
 * POST /api/similarity/observations
 *   Body (one of):
 *     { observationId: string }
 *     { freeText: string }
 *   Optional filters: campaignCode, moduleType, limit (default 10, max 50)
 *
 * Auth: applied at the mount point in apps/worker/src/index.ts
 * Feature-flagged via env FEATURE_TURSO_VECTORS (default ON in Phase 1).
 * Writes an audit_log entry on every call.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { logAudit } from './audit-log'

export const similarityRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

similarityRoutes.post('/observations', async (c) => {
  // Feature flag
  if (c.env.FEATURE_TURSO_VECTORS === 'false' || c.env.FEATURE_TURSO_VECTORS === '0') {
    return c.json({ error: 'feature disabled' }, 503)
  }

  const db = c.get('db')
  const ai = c.env.AI
  if (!ai) return c.json({ error: 'Workers AI binding missing' }, 500)

  const body = await c.req.json<{
    observationId?: string
    freeText?: string
    campaignCode?: string
    moduleType?: string
    limit?: number
  }>()

  const limit = Math.min(Math.max(body.limit ?? 10, 1), 50)

  let queryVec: number[]
  try {
    if (body.observationId) {
      const r = await db.execute({
        sql: 'SELECT embedding FROM observations WHERE id = ? AND embedding IS NOT NULL',
        args: [body.observationId],
      })
      const row = r.rows[0] as Record<string, unknown> | undefined
      const blob = row?.embedding as ArrayBuffer | Uint8Array | null | undefined
      if (!blob) return c.json({ error: 'no embedding for observation' }, 404)
      const ab = blob instanceof ArrayBuffer ? blob : (blob as Uint8Array).buffer.slice(
        (blob as Uint8Array).byteOffset,
        (blob as Uint8Array).byteOffset + (blob as Uint8Array).byteLength
      )
      queryVec = Array.from(new Float32Array(ab))
      if (queryVec.length !== 384) return c.json({ error: 'embedding malformed' }, 500)
    } else if (body.freeText) {
      const text = String(body.freeText).slice(0, 2000)
      const out = (await ai.run('@cf/baai/bge-small-en-v1.5', { text: [text] })) as {
        data: number[][]
      }
      queryVec = out.data[0]
      if (!queryVec || queryVec.length !== 384) {
        return c.json({ error: 'embedding failed' }, 500)
      }
    } else {
      return c.json({ error: 'provide observationId or freeText' }, 400)
    }
  } catch (err) {
    return c.json(
      { error: 'query embedding failed', detail: err instanceof Error ? err.message : String(err) },
      500
    )
  }

  const filters: string[] = []
  const filterArgs: unknown[] = []
  if (body.campaignCode) {
    filters.push('campaign_code = ?')
    filterArgs.push(body.campaignCode)
  }
  if (body.moduleType) {
    filters.push('module_type = ?')
    filterArgs.push(body.moduleType)
  }
  const whereExtra = filters.length ? ` AND ${filters.join(' AND ')}` : ''

  const sql = `
    SELECT id, child_id, campaign_code, module_type, body_region, risk_level,
           ai_annotations, timestamp,
           vector_distance_cos(embedding, vector32(?)) AS distance
    FROM observations
    WHERE embedding IS NOT NULL${whereExtra}
      AND (id != ? OR ? IS NULL)
    ORDER BY distance ASC
    LIMIT ?
  `
  const args: unknown[] = [
    JSON.stringify(queryVec),
    ...filterArgs,
    body.observationId ?? null,
    body.observationId ?? null,
    limit,
  ]

  const result = await db.execute({ sql, args })

  // Audit
  const userId = c.get('userId')
  if (userId) {
    await logAudit(db, {
      userId,
      action: 'similarity.search',
      entityType: body.observationId ? 'observation' : 'freeText',
      entityId: body.observationId,
      campaignCode: body.campaignCode,
      details: JSON.stringify({
        moduleType: body.moduleType,
        limit,
        resultCount: result.rows.length,
      }),
    })
  }

  return c.json({
    results: result.rows,
    count: result.rows.length,
    query: body.observationId ? { type: 'observation', id: body.observationId } : { type: 'text' },
  })
})
