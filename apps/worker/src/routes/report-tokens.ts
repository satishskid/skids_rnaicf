/**
 * Report Token Routes — Generate and validate short-lived tokens for parent report access.
 * POST /api/report-tokens — Generate a token (authenticated)
 * GET  /api/report-tokens/:token — Validate + return child report data (public)
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let token = ''
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

// POST / — Generate a report token (requires auth)
app.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json<{
    childId: string
    campaignCode: string
    expiresInDays?: number
  }>()

  if (!body.childId || !body.campaignCode) {
    return c.json({ error: 'childId and campaignCode required' }, 400)
  }

  const token = generateToken()
  const expiresInDays = body.expiresInDays ?? 30
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  // Ensure table exists
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS report_tokens (
      token TEXT PRIMARY KEY,
      childId TEXT NOT NULL,
      campaignCode TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      expiresAt TEXT NOT NULL,
      accessCount INTEGER DEFAULT 0
    )`,
    args: [],
  })

  await db.execute({
    sql: `INSERT INTO report_tokens (token, childId, campaignCode, expiresAt) VALUES (?, ?, ?, ?)`,
    args: [token, body.childId, body.campaignCode, expiresAt],
  })

  return c.json({ token, expiresAt })
})

// GET /:token — Validate token and return report data (PUBLIC — no auth)
app.get('/:token', async (c) => {
  const token = c.req.param('token')
  const db = c.get('db')

  // Check if table exists
  try {
    const tokenRow = await db.execute({
      sql: `SELECT * FROM report_tokens WHERE token = ?`,
      args: [token],
    })

    const row = tokenRow.rows?.[0] as any
    if (!row) return c.json({ error: 'Invalid or expired token' }, 404)

    // Check expiry
    if (new Date(row.expiresAt) < new Date()) {
      return c.json({ error: 'Token has expired' }, 410)
    }

    // Increment access count
    await db.execute({
      sql: `UPDATE report_tokens SET accessCount = accessCount + 1 WHERE token = ?`,
      args: [token],
    })

    // Fetch child + observations
    const [childRes, obsRes] = await Promise.all([
      db.execute({
        sql: 'SELECT * FROM children WHERE id = ?',
        args: [row.childId],
      }),
      db.execute({
        sql: 'SELECT * FROM observations WHERE child_id = ? AND campaign_code = ?',
        args: [row.childId, row.campaignCode],
      }),
    ])

    const child = childRes.rows?.[0] as any
    if (!child) return c.json({ error: 'Child not found' }, 404)

    const observations = (obsRes.rows ?? []).map((r: any) => ({
      id: r.id,
      childId: r.child_id,
      moduleType: r.module_type,
      campaignCode: r.campaign_code,
      annotationData: r.annotation_data ? JSON.parse(r.annotation_data) : undefined,
      aiAnnotations: r.ai_annotations ? JSON.parse(r.ai_annotations) : undefined,
      mediaUrl: r.media_url,
      createdAt: r.created_at,
    }))

    return c.json({
      child: {
        id: child.id,
        name: child.name,
        dob: child.dob,
        gender: child.gender,
        class: child.class,
      },
      observations,
      campaignCode: row.campaignCode,
    })
  } catch {
    return c.json({ error: 'Invalid token' }, 404)
  }
})

export const reportTokenRoutes = app
