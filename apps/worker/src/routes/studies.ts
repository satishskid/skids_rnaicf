/**
 * Study / Clinical Trial Management Routes
 * REDCap-inspired study lifecycle: studies → arms → events → instruments → enrollments.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ─── Study CRUD ─────────────────────────────────────────────

// GET / — list studies
app.get('/', async (c) => {
  const db = c.get('db')
  const orgCode = c.req.query('orgCode')
  const status = c.req.query('status')

  let sql = 'SELECT * FROM studies WHERE 1=1'
  const args: unknown[] = []

  if (orgCode) { sql += ' AND org_code = ?'; args.push(orgCode) }
  if (status) { sql += ' AND status = ?'; args.push(status) }
  sql += ' ORDER BY created_at DESC'

  const result = await db.execute({ sql, args })
  return c.json({ studies: result.rows })
})

// POST / — create study
app.post('/', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const body = await c.req.json<{
    orgCode: string
    title: string
    shortCode: string
    description?: string
    studyType: string
    piName?: string
    piEmail?: string
    irbNumber?: string
    startDate?: string
    endDate?: string
    targetEnrollment?: number
    consentTemplateId?: string
  }>()

  if (!body.orgCode || !body.title || !body.shortCode || !body.studyType) {
    return c.json({ error: 'orgCode, title, shortCode, and studyType are required' }, 400)
  }

  try {
    const result = await db.execute({
      sql: `INSERT INTO studies (org_code, title, short_code, description, study_type, pi_name, pi_email,
            irb_number, start_date, end_date, target_enrollment, consent_template_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
      args: [
        body.orgCode, body.title, body.shortCode, body.description || null,
        body.studyType, body.piName || null, body.piEmail || null,
        body.irbNumber || null, body.startDate || null, body.endDate || null,
        body.targetEnrollment || null, body.consentTemplateId || null, userId || null,
      ],
    })
    return c.json({ study: result.rows[0] }, 201)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('UNIQUE')) return c.json({ error: 'Study short code already exists' }, 409)
    throw e
  }
})

// GET /:id — get study detail
app.get('/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const [studyResult, armsResult, eventsResult, enrollmentResult] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM studies WHERE id = ?', args: [id] }),
    db.execute({ sql: 'SELECT * FROM study_arms WHERE study_id = ? ORDER BY sort_order', args: [id] }),
    db.execute({ sql: 'SELECT * FROM study_events WHERE study_id = ? ORDER BY sort_order', args: [id] }),
    db.execute({
      sql: `SELECT status, COUNT(*) as count FROM study_enrollments WHERE study_id = ? GROUP BY status`,
      args: [id],
    }),
  ])

  if (!studyResult.rows.length) return c.json({ error: 'Study not found' }, 404)

  // Fetch event instruments
  const eventIds = eventsResult.rows.map((e: Record<string, unknown>) => e.id as string)
  let eventInstruments: Record<string, unknown>[] = []
  if (eventIds.length > 0) {
    const placeholders = eventIds.map(() => '?').join(',')
    const eiResult = await db.execute({
      sql: `SELECT sei.*, i.name as instrument_name, i.category as instrument_category
            FROM study_event_instruments sei
            JOIN instruments i ON i.id = sei.instrument_id
            WHERE sei.study_event_id IN (${placeholders})
            ORDER BY sei.sort_order`,
      args: eventIds,
    })
    eventInstruments = eiResult.rows as Record<string, unknown>[]
  }

  // Attach instruments to events
  const events = eventsResult.rows.map((e: Record<string, unknown>) => ({
    ...e,
    instruments: eventInstruments.filter((ei) => ei.study_event_id === e.id),
  }))

  const enrollmentCounts: Record<string, number> = {}
  for (const row of enrollmentResult.rows as Record<string, unknown>[]) {
    enrollmentCounts[row.status as string] = Number(row.count)
  }

  return c.json({
    study: studyResult.rows[0],
    arms: armsResult.rows,
    events,
    enrollment: {
      active: enrollmentCounts['active'] || 0,
      completed: enrollmentCounts['completed'] || 0,
      withdrawn: enrollmentCounts['withdrawn'] || 0,
      total: Object.values(enrollmentCounts).reduce((a, b) => a + b, 0),
    },
  })
})

// PUT /:id — update study
app.put('/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = await c.req.json<Record<string, unknown>>()

  const fieldMap: Record<string, string> = {
    title: 'title', description: 'description', studyType: 'study_type',
    status: 'status', piName: 'pi_name', piEmail: 'pi_email',
    irbNumber: 'irb_number', startDate: 'start_date', endDate: 'end_date',
    targetEnrollment: 'target_enrollment', consentTemplateId: 'consent_template_id',
  }

  const fields: string[] = []
  const args: unknown[] = []

  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (body[jsKey] !== undefined) {
      fields.push(`${dbCol} = ?`)
      args.push(body[jsKey])
    }
  }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
  fields.push("updated_at = datetime('now')")
  args.push(id)

  const result = await db.execute({
    sql: `UPDATE studies SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
    args,
  })

  if (!result.rows.length) return c.json({ error: 'Study not found' }, 404)
  return c.json({ study: result.rows[0] })
})

// ─── Arms ───────────────────────────────────────────────────

// POST /:id/arms — add arm
app.post('/:id/arms', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = await c.req.json<{ name: string; description?: string; sortOrder?: number }>()

  if (!body.name) return c.json({ error: 'name is required' }, 400)

  const result = await db.execute({
    sql: 'INSERT INTO study_arms (study_id, name, description, sort_order) VALUES (?, ?, ?, ?) RETURNING *',
    args: [id, body.name, body.description || null, body.sortOrder ?? 0],
  })

  return c.json({ arm: result.rows[0] }, 201)
})

// ─── Events ─────────────────────────────────────────────────

// POST /:id/events — add event with instruments
app.post('/:id/events', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = await c.req.json<{
    name: string
    dayOffset: number
    windowBefore?: number
    windowAfter?: number
    sortOrder?: number
    instrumentIds?: string[]
  }>()

  if (!body.name || body.dayOffset === undefined) {
    return c.json({ error: 'name and dayOffset are required' }, 400)
  }

  const eventResult = await db.execute({
    sql: 'INSERT INTO study_events (study_id, name, day_offset, window_before, window_after, sort_order) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    args: [id, body.name, body.dayOffset, body.windowBefore ?? 3, body.windowAfter ?? 7, body.sortOrder ?? 0],
  })

  const event = eventResult.rows[0] as Record<string, unknown>

  // Link instruments to event
  if (body.instrumentIds?.length) {
    for (let i = 0; i < body.instrumentIds.length; i++) {
      await db.execute({
        sql: 'INSERT INTO study_event_instruments (study_event_id, instrument_id, sort_order) VALUES (?, ?, ?)',
        args: [event.id, body.instrumentIds[i], i],
      })
    }
  }

  return c.json({ event }, 201)
})

// ─── Enrollment ─────────────────────────────────────────────

// POST /:id/enroll — enroll a child
app.post('/:id/enroll', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const { id } = c.req.param()
  const body = await c.req.json<{
    childId: string
    armId?: string
    consentId?: string
  }>()

  if (!body.childId) return c.json({ error: 'childId is required' }, 400)

  // Check not already enrolled
  const existing = await db.execute({
    sql: "SELECT id FROM study_enrollments WHERE study_id = ? AND child_id = ? AND status = 'active'",
    args: [id, body.childId],
  })
  if (existing.rows.length) return c.json({ error: 'Child already enrolled in this study' }, 409)

  const result = await db.execute({
    sql: 'INSERT INTO study_enrollments (study_id, child_id, arm_id, consent_id, enrolled_by) VALUES (?, ?, ?, ?, ?) RETURNING *',
    args: [id, body.childId, body.armId || null, body.consentId || null, userId || null],
  })

  return c.json({ enrollment: result.rows[0] }, 201)
})

// GET /:id/participants — enrollment list
app.get('/:id/participants', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const result = await db.execute({
    sql: `SELECT se.*, c.name as child_name, c.dob, c.gender, c.class,
          sa.name as arm_name
          FROM study_enrollments se
          JOIN children c ON c.id = se.child_id
          LEFT JOIN study_arms sa ON sa.id = se.arm_id
          WHERE se.study_id = ?
          ORDER BY se.enrolled_at DESC`,
    args: [id],
  })

  return c.json({ participants: result.rows })
})

// GET /:id/dashboard — study dashboard stats
app.get('/:id/dashboard', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const [studyResult, enrollStats, armStats, eventStats] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM studies WHERE id = ?', args: [id] }),
    db.execute({
      sql: `SELECT status, COUNT(*) as count FROM study_enrollments WHERE study_id = ? GROUP BY status`,
      args: [id],
    }),
    db.execute({
      sql: `SELECT sa.name, COUNT(se.id) as count
            FROM study_arms sa
            LEFT JOIN study_enrollments se ON se.arm_id = sa.id AND se.status = 'active'
            WHERE sa.study_id = ?
            GROUP BY sa.id, sa.name`,
      args: [id],
    }),
    db.execute({
      sql: `SELECT sev.name, sev.day_offset, COUNT(DISTINCT ir.child_id) as responses
            FROM study_events sev
            LEFT JOIN study_event_instruments sei ON sei.study_event_id = sev.id
            LEFT JOIN instrument_responses ir ON ir.instrument_id = sei.instrument_id
            WHERE sev.study_id = ?
            GROUP BY sev.id, sev.name, sev.day_offset
            ORDER BY sev.sort_order`,
      args: [id],
    }),
  ])

  if (!studyResult.rows.length) return c.json({ error: 'Study not found' }, 404)

  const enrollmentCounts: Record<string, number> = {}
  for (const row of enrollStats.rows as Record<string, unknown>[]) {
    enrollmentCounts[row.status as string] = Number(row.count)
  }

  return c.json({
    study: studyResult.rows[0],
    enrollment: {
      active: enrollmentCounts['active'] || 0,
      completed: enrollmentCounts['completed'] || 0,
      withdrawn: enrollmentCounts['withdrawn'] || 0,
      total: Object.values(enrollmentCounts).reduce((a, b) => a + b, 0),
    },
    armDistribution: armStats.rows,
    eventCompletion: eventStats.rows,
  })
})

// GET /:id/export — full data export
app.get('/:id/export', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  // Get all enrollments with responses
  const result = await db.execute({
    sql: `SELECT se.child_id, c.name as child_name, c.dob, c.gender,
          sa.name as arm_name, se.enrolled_at, se.status as enrollment_status,
          sev.name as event_name, sev.day_offset,
          i.name as instrument_name, i.category as instrument_category,
          ir.response_json, ir.score_json, ir.completed, ir.completed_at
          FROM study_enrollments se
          JOIN children c ON c.id = se.child_id
          LEFT JOIN study_arms sa ON sa.id = se.arm_id
          CROSS JOIN study_events sev ON sev.study_id = se.study_id
          LEFT JOIN study_event_instruments sei ON sei.study_event_id = sev.id
          LEFT JOIN instruments i ON i.id = sei.instrument_id
          LEFT JOIN instrument_responses ir ON ir.instrument_id = i.id AND ir.child_id = se.child_id
          WHERE se.study_id = ?
          ORDER BY c.name, sev.sort_order, i.name`,
    args: [id],
  })

  return c.json({ data: result.rows })
})

export const studyRoutes = app
