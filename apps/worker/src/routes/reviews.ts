// Doctor review routes
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const reviewRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Get reviews for a campaign
reviewRoutes.get('/', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')
  const observationId = c.req.query('observation')

  let sql = 'SELECT * FROM reviews WHERE 1=1'
  const args: unknown[] = []

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
