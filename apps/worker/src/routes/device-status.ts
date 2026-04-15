// Device readiness reporting — nurses/doctors report device status, admin sees fleet
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import type { InValue } from '@libsql/client'

export const deviceStatusRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// POST / — report device readiness (any authenticated user)
deviceStatusRoutes.post('/', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const body = await c.req.json()
  const id = crypto.randomUUID()

  if (!body.checks || !Array.isArray(body.checks)) {
    return c.json({ error: 'checks array is required' }, 400)
  }

  try {
    await db.execute({
      sql: `INSERT INTO device_status (id, user_id, campaign_code, device_type, user_agent, checks, overall_status, reported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        id,
        userId,
        body.campaignCode || null,
        body.deviceType || 'unknown',
        body.userAgent || c.req.header('user-agent') || null,
        JSON.stringify(body.checks),
        body.overallStatus || 'unknown',
      ],
    })
  } catch (e) {
    // Table might not exist yet — create it inline (migration fallback)
    await db.execute(`CREATE TABLE IF NOT EXISTS device_status (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      campaign_code TEXT,
      device_type TEXT NOT NULL DEFAULT 'unknown',
      user_agent TEXT,
      checks TEXT NOT NULL,
      overall_status TEXT NOT NULL DEFAULT 'unknown',
      reported_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
    await db.execute({
      sql: `INSERT INTO device_status (id, user_id, campaign_code, device_type, user_agent, checks, overall_status, reported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        id,
        userId,
        body.campaignCode || null,
        body.deviceType || 'unknown',
        body.userAgent || c.req.header('user-agent') || null,
        JSON.stringify(body.checks),
        body.overallStatus || 'unknown',
      ],
    })
  }

  return c.json({ id, message: 'Device status reported' }, 201)
})

// GET /fleet — admin/ops_manager sees all devices (latest per user)
deviceStatusRoutes.get('/fleet', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')

  let sql = `SELECT ds.*, u.name as user_name, u.email as user_email, u.role as user_role
             FROM device_status ds
             JOIN user u ON u.id = ds.user_id
             WHERE ds.id IN (
               SELECT id FROM device_status ds2
               WHERE ds2.user_id = ds.user_id
               ORDER BY ds2.reported_at DESC LIMIT 1
             )`
  const args: InValue[] = []

  if (campaignCode) {
    sql = `SELECT ds.*, u.name as user_name, u.email as user_email, u.role as user_role
           FROM device_status ds
           JOIN user u ON u.id = ds.user_id
           WHERE ds.campaign_code = ? AND ds.id IN (
             SELECT id FROM (
               SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY reported_at DESC) as rn
               FROM device_status WHERE campaign_code = ?
             ) WHERE rn = 1
           )`
    args.push(campaignCode, campaignCode)
  } else {
    sql = `SELECT ds.*, u.name as user_name, u.email as user_email, u.role as user_role
           FROM device_status ds
           JOIN user u ON u.id = ds.user_id
           WHERE ds.id IN (
             SELECT id FROM (
               SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY reported_at DESC) as rn
               FROM device_status
             ) WHERE rn = 1
           )
           ORDER BY ds.reported_at DESC`
  }

  const result = await db.execute({ sql, args })

  const devices = result.rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    userRole: row.user_role,
    campaignCode: row.campaign_code,
    deviceType: row.device_type,
    checks: JSON.parse(row.checks || '[]'),
    overallStatus: row.overall_status,
    reportedAt: row.reported_at,
  }))

  // Summary counts
  const ready = devices.filter(d => d.overallStatus === 'ready').length
  const warning = devices.filter(d => d.overallStatus === 'warning').length
  const error = devices.filter(d => d.overallStatus === 'error').length

  return c.json({ devices, summary: { total: devices.length, ready, warning, error } })
})

// GET /my — user sees own device history
deviceStatusRoutes.get('/my', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')

  const result = await db.execute({
    sql: 'SELECT * FROM device_status WHERE user_id = ? ORDER BY reported_at DESC LIMIT 20',
    args: [userId ?? null],
  })

  const history = result.rows.map((row: any) => ({
    id: row.id,
    campaignCode: row.campaign_code,
    deviceType: row.device_type,
    checks: JSON.parse(row.checks || '[]'),
    overallStatus: row.overall_status,
    reportedAt: row.reported_at,
  }))

  return c.json({ history })
})
