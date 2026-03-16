// Children CRUD routes
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const childrenRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** Generate an 8-char unique QR code (alphanumeric, no ambiguous chars) */
function generateQrCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// Search children across all campaigns (global search)
childrenRoutes.get('/search', async (c) => {
  const db = c.get('db')
  const q = c.req.query('q')
  if (!q || q.length < 2) {
    return c.json({ error: 'Search query must be at least 2 characters' }, 400)
  }

  const result = await db.execute({
    sql: `SELECT c.*, cam.name as campaign_name, cam.school_name
          FROM children c
          LEFT JOIN campaigns cam ON cam.code = c.campaign_code
          WHERE c.name LIKE ? OR c.admission_number LIKE ? OR c.qr_code LIKE ?
          ORDER BY c.name LIMIT 50`,
    args: [`%${q}%`, `%${q}%`, `%${q}%`],
  })

  const children = result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    dob: row.dob,
    gender: row.gender,
    class: row.class,
    section: row.section,
    admissionNumber: row.admission_number,
    campaignCode: row.campaign_code,
    campaignName: row.campaign_name,
    schoolName: row.school_name,
    qrCode: row.qr_code,
  }))

  return c.json({ children, total: children.length })
})

// List children for a campaign (with optional search filter)
childrenRoutes.get('/', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')
  const search = c.req.query('search')

  if (!campaignCode) {
    return c.json({ error: 'campaign query param required' }, 400)
  }

  let sql = 'SELECT * FROM children WHERE campaign_code = ?'
  const args: unknown[] = [campaignCode]

  if (search && search.length >= 2) {
    sql += ' AND (name LIKE ? OR admission_number LIKE ?)'
    args.push(`%${search}%`, `%${search}%`)
  }

  sql += ' ORDER BY name'

  const result = await db.execute({ sql, args })

  const children = result.rows.map((row: any) => ({
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
    qrCode: row.qr_code,
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

  const row = result.rows[0] as any
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
    qrCode: row.qr_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
})

// Create child (auto-generates QR code for health card)
childrenRoutes.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  const id = body.id || crypto.randomUUID()

  // Generate unique QR code (retry on collision)
  let qrCode = body.qrCode || generateQrCode()
  let retries = 0
  while (retries < 5) {
    try {
      await db.execute({
        sql: `INSERT INTO children (id, name, dob, gender, location, photo_url, admission_number, class, section, academic_year, school_name, campaign_code, qr_code, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          qrCode,
          body.createdBy || 'nurse',
        ],
      })
      return c.json({ id, qrCode, message: 'Child registered' }, 201)
    } catch (e: any) {
      if (e.message?.includes('UNIQUE') && e.message?.includes('qr_code') && retries < 4) {
        qrCode = generateQrCode()
        retries++
        continue
      }
      throw e
    }
  }

  return c.json({ error: 'Failed to generate unique QR code' }, 500)
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
