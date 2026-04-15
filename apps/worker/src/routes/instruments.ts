/**
 * Instrument / Survey Routes
 * CRUD for survey instruments (SurveyJS schemas) and response submission.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import type { InValue } from '@libsql/client'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ─── Instrument CRUD ────────────────────────────────────────

// GET / — list instruments
app.get('/', async (c) => {
  const db = c.get('db')
  const orgCode = c.req.query('orgCode')
  const category = c.req.query('category')
  const status = c.req.query('status') || 'active'

  let sql = 'SELECT id, org_code, name, description, category, version, status, created_at, updated_at FROM instruments WHERE 1=1'
  const args: InValue[] = []

  if (orgCode) { sql += ' AND org_code = ?'; args.push(orgCode) }
  if (category) { sql += ' AND category = ?'; args.push(category) }
  if (status !== 'all') { sql += ' AND status = ?'; args.push(status) }
  sql += ' ORDER BY updated_at DESC'

  const result = await db.execute({ sql, args })
  return c.json({ instruments: result.rows })
})

// POST / — create instrument
app.post('/', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const body = await c.req.json<{
    orgCode: string
    name: string
    description?: string
    category?: string
    schemaJson: unknown
    scoringLogic?: string
    version?: string
    status?: string
  }>()

  if (!body.orgCode || !body.name || !body.schemaJson) {
    return c.json({ error: 'orgCode, name, and schemaJson are required' }, 400)
  }

  const result = await db.execute({
    sql: `INSERT INTO instruments (org_code, name, description, category, schema_json, scoring_logic, version, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      body.orgCode,
      body.name,
      body.description || null,
      body.category || 'survey',
      typeof body.schemaJson === 'string' ? body.schemaJson : JSON.stringify(body.schemaJson),
      body.scoringLogic || null,
      body.version || '1.0',
      body.status || 'draft',
      userId || null,
    ],
  })

  return c.json({ instrument: result.rows[0] }, 201)
})

// GET /:id — get instrument with full schema
app.get('/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const result = await db.execute({
    sql: 'SELECT * FROM instruments WHERE id = ?',
    args: [id],
  })

  if (!result.rows.length) return c.json({ error: 'Instrument not found' }, 404)

  const instrument = result.rows[0] as Record<string, unknown>
  // Parse schema_json for client convenience
  if (typeof instrument.schema_json === 'string') {
    try { instrument.schema_json_parsed = JSON.parse(instrument.schema_json as string) } catch { /* keep as string */ }
  }

  return c.json({ instrument })
})

// PUT /:id — update instrument
app.put('/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = await c.req.json<{
    name?: string
    description?: string
    category?: string
    schemaJson?: unknown
    scoringLogic?: string
    version?: string
    status?: string
  }>()

  const fields: string[] = []
  const args: InValue[] = []

  if (body.name !== undefined) { fields.push('name = ?'); args.push(body.name) }
  if (body.description !== undefined) { fields.push('description = ?'); args.push(body.description) }
  if (body.category !== undefined) { fields.push('category = ?'); args.push(body.category) }
  if (body.schemaJson !== undefined) {
    fields.push('schema_json = ?')
    args.push(typeof body.schemaJson === 'string' ? body.schemaJson : JSON.stringify(body.schemaJson))
  }
  if (body.scoringLogic !== undefined) { fields.push('scoring_logic = ?'); args.push(body.scoringLogic) }
  if (body.version !== undefined) { fields.push('version = ?'); args.push(body.version) }
  if (body.status !== undefined) { fields.push('status = ?'); args.push(body.status) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  fields.push("updated_at = datetime('now')")
  args.push(id)

  const result = await db.execute({
    sql: `UPDATE instruments SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
    args,
  })

  if (!result.rows.length) return c.json({ error: 'Instrument not found' }, 404)
  return c.json({ instrument: result.rows[0] })
})

// ─── Response Submission ────────────────────────────────────

// POST /responses — submit a response
app.post('/responses', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const body = await c.req.json<{
    instrumentId: string
    campaignCode?: string
    childId?: string
    respondentType?: string
    responseJson: unknown
    scoreJson?: unknown
    completed?: boolean
    startedAt?: string
  }>()

  if (!body.instrumentId || !body.responseJson) {
    return c.json({ error: 'instrumentId and responseJson are required' }, 400)
  }

  const completed = body.completed ? 1 : 0
  const now = new Date().toISOString()

  const result = await db.execute({
    sql: `INSERT INTO instrument_responses (instrument_id, campaign_code, child_id, respondent_type, response_json, score_json, completed, started_at, completed_at, collected_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      body.instrumentId,
      body.campaignCode || null,
      body.childId || null,
      body.respondentType || null,
      typeof body.responseJson === 'string' ? body.responseJson : JSON.stringify(body.responseJson),
      body.scoreJson ? (typeof body.scoreJson === 'string' ? body.scoreJson : JSON.stringify(body.scoreJson)) : null,
      completed,
      body.startedAt || now,
      completed ? now : null,
      userId || null,
    ],
  })

  return c.json({ response: result.rows[0] }, 201)
})

// GET /responses — query responses
app.get('/responses', async (c) => {
  const db = c.get('db')
  const instrumentId = c.req.query('instrumentId')
  const childId = c.req.query('childId')
  const campaignCode = c.req.query('campaignCode')

  let sql = 'SELECT * FROM instrument_responses WHERE 1=1'
  const args: InValue[] = []

  if (instrumentId) { sql += ' AND instrument_id = ?'; args.push(instrumentId) }
  if (childId) { sql += ' AND child_id = ?'; args.push(childId) }
  if (campaignCode) { sql += ' AND campaign_code = ?'; args.push(campaignCode) }
  sql += ' ORDER BY created_at DESC LIMIT 500'

  const result = await db.execute({ sql, args })
  return c.json({ responses: result.rows })
})

// GET /:id/summary — aggregate stats for an instrument
app.get('/:id/summary', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const [countResult, completionResult] = await Promise.all([
    db.execute({
      sql: 'SELECT COUNT(*) as total FROM instrument_responses WHERE instrument_id = ?',
      args: [id],
    }),
    db.execute({
      sql: `SELECT
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as partial
      FROM instrument_responses WHERE instrument_id = ?`,
      args: [id],
    }),
  ])

  return c.json({
    instrumentId: id,
    totalResponses: Number(countResult.rows[0]?.total || 0),
    completed: Number(completionResult.rows[0]?.completed || 0),
    partial: Number(completionResult.rows[0]?.partial || 0),
  })
})

export const instrumentRoutes = app
