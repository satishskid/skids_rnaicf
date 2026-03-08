// Children CRUD routes
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const childrenRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// List children for a campaign
childrenRoutes.get('/', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')

  if (!campaignCode) {
    return c.json({ error: 'campaign query param required' }, 400)
  }

  const result = await db.execute({
    sql: 'SELECT * FROM children WHERE campaign_code = ? ORDER BY name',
    args: [campaignCode],
  })

  const children = result.rows.map(row => ({
    id: row.id,
    name: row.name,
    dob: row.dob,
    gender: row.gender,
    location: row.location,
    photoUrl: row.photo_url,
    admissionNumber: row.admission_number,
    class: row.class,
    section: row.section,
    academicYear: row.academic_year,
    schoolName: row.school_name,
    campaignCode: row.campaign_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return c.json({ children })
})

// Get child by ID
childrenRoutes.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const result = await db.execute({
    sql: 'SELECT * FROM children WHERE id = ?',
    args: [id],
  })

  if (result.rows.length === 0) {
    return c.json({ error: 'Child not found' }, 404)
  }

  const row = result.rows[0]
  return c.json({
    id: row.id,
    name: row.name,
    dob: row.dob,
    gender: row.gender,
    location: row.location,
    photoUrl: row.photo_url,
    admissionNumber: row.admission_number,
    class: row.class,
    section: row.section,
    campaignCode: row.campaign_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
})

// Create child
childrenRoutes.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  const id = body.id || crypto.randomUUID()

  await db.execute({
    sql: `INSERT INTO children (id, name, dob, gender, location, photo_url, admission_number, class, section, academic_year, school_name, campaign_code, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      body.name,
      body.dob,
      body.gender || null,
      body.location || null,
      body.photoUrl || null,
      body.admissionNumber || null,
      body.class || null,
      body.section || null,
      body.academicYear || null,
      body.schoolName || null,
      body.campaignCode,
      body.createdBy || 'nurse',
    ],
  })

  return c.json({ id, message: 'Child registered' }, 201)
})

// Update child
childrenRoutes.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const body = await c.req.json()

  // Build dynamic SET clause
  const fields: string[] = []
  const args: unknown[] = []

  for (const [key, value] of Object.entries(body)) {
    const col = key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`)
    fields.push(`${col} = ?`)
    args.push(value)
  }

  fields.push('updated_at = datetime(\'now\')')
  args.push(id)

  await db.execute({
    sql: `UPDATE children SET ${fields.join(', ')} WHERE id = ?`,
    args,
  })

  return c.json({ id, message: 'Child updated' })
})
