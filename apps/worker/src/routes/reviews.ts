// Doctor review routes
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import type { InValue } from '@libsql/client'
import { evidenceSearch } from './evidence'

export const reviewRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Get reviews for a campaign
reviewRoutes.get('/', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')
  const observationId = c.req.query('observation')

  let sql = 'SELECT * FROM reviews WHERE 1=1'
  const args: InValue[] = []

  if (campaignCode) {
    sql += ' AND campaign_code = ?'
    args.push(campaignCode)
  }
  if (observationId) {
    sql += ' AND observation_id = ?'
    args.push(observationId)
  }

  sql += ' ORDER BY reviewed_at DESC'

  const result = await db.execute({ sql, args })

  const reviews = result.rows.map(row => ({
    id: row.id,
    observationId: row.observation_id,
    campaignCode: row.campaign_code,
    clinicianId: row.clinician_id,
    clinicianName: row.clinician_name,
    decision: row.decision,
    notes: row.notes,
    qualityRating: row.quality_rating,
    qualityNotes: row.quality_notes,
    retakeReason: row.retake_reason,
    reviewedAt: row.reviewed_at,
  }))

  return c.json({ reviews })
})

// Create review
reviewRoutes.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const id = body.id || crypto.randomUUID()

  await db.execute({
    sql: `INSERT INTO reviews (id, observation_id, campaign_code, clinician_id, clinician_name, decision, notes, quality_rating, quality_notes, retake_reason)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      body.observationId,
      body.campaignCode,
      body.clinicianId || 'doctor',
      body.clinicianName || 'Doctor',
      body.decision,
      body.notes || null,
      body.qualityRating || null,
      body.qualityNotes || null,
      body.retakeReason || null,
    ],
  })

  // Also update the observation's clinician_review field
  await db.execute({
    sql: 'UPDATE observations SET clinician_review = ? WHERE id = ?',
    args: [
      JSON.stringify({
        id,
        clinicianId: body.clinicianId || 'doctor',
        clinicianName: body.clinicianName || 'Doctor',
        timestamp: new Date().toISOString(),
        notes: body.notes || '',
        decision: body.decision,
        qualityRating: body.qualityRating,
        qualityNotes: body.qualityNotes,
        retakeReason: body.retakeReason,
      }),
      body.observationId,
    ],
  })

  return c.json({ id, message: 'Review saved' }, 201)
})

/**
 * Phase 07 — unified context endpoint for the doctor inbox expand view.
 *
 * Fans out the evidence RAG search and the similar-cases search in
 * parallel and returns a merged envelope. Both sides degrade gracefully:
 * if EVIDENCE_VEC is not bound or the observation lacks an embedding,
 * the missing array is returned empty and the UI falls back to whatever
 * it has.
 */
reviewRoutes.get('/:id/context', async (c) => {
  const observationId = c.req.param('id')
  const topKEvidence = Math.min(Math.max(Number(c.req.query('topK') ?? '5'), 1), 10)
  const topKSimilar = Math.min(Math.max(Number(c.req.query('topSimilar') ?? '5'), 1), 10)

  const db = c.get('db')
  const obsRes = await db.execute({
    sql: `SELECT id, module_type, body_region, ai_annotations, annotation_data, risk_level, embedding
          FROM observations WHERE id = ? LIMIT 1`,
    args: [observationId],
  })
  if (obsRes.rows.length === 0) return c.json({ error: 'Observation not found' }, 404)
  const obs = obsRes.rows[0] as Record<string, unknown>

  // Build the RAG query from whatever the observation has. Falls back to
  // module + body_region so we always have something to embed.
  const annotation = typeof obs.annotation_data === 'string'
    ? safeParse<{ summary?: string }>(obs.annotation_data as string, {})
    : {}
  const ragQuery = annotation.summary
    ?? `${obs.module_type ?? ''} ${obs.body_region ?? ''}`.trim()
    ?? observationId

  const [evidence, similarCases] = await Promise.all([
    evidenceSearch(c.env, ragQuery, topKEvidence).catch(() => []),
    fetchSimilarCases(c, observationId, topKSimilar).catch(() => []),
  ])

  return c.json({
    observationId,
    query: ragQuery,
    evidence,
    similarCases,
  })
})

function safeParse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T } catch { return fallback }
}

async function fetchSimilarCases(
  c: { env: Bindings; req: { url: string; raw: Request } },
  observationId: string,
  topK: number
): Promise<Array<{ id: string; score: number }>> {
  // Reuse /api/similarity/observations via internal fetch so we inherit
  // its feature flag + auth + audit. The POST body mirrors the public
  // shape; we pass the current request's auth header through.
  const url = new URL(c.req.url)
  url.pathname = '/api/similarity/observations'
  url.search = ''
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: c.req.raw.headers.get('cookie') ?? '',
      authorization: c.req.raw.headers.get('authorization') ?? '',
    },
    body: JSON.stringify({ observationId, limit: topK }),
  })
  if (!res.ok) return []
  const data = await res.json() as { results?: Array<{ id: string; score: number }> }
  return data.results ?? []
}
