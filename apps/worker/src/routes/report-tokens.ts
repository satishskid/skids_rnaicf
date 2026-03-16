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

// GET /campaign/:code — List all tokens for a campaign (admin/ops_manager only)
app.get('/campaign/:code', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')
  const userRole = c.get('userRole')

  if (userRole !== 'admin' && userRole !== 'ops_manager') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  try {
    const result = await db.execute({
      sql: `SELECT rt.token, rt.childId, rt.campaignCode, rt.createdAt, rt.expiresAt, rt.accessCount,
                   ch.name as childName, ch.class as childClass, ch.section as childSection
            FROM report_tokens rt
            LEFT JOIN children ch ON ch.id = rt.childId
            WHERE rt.campaignCode = ?
            ORDER BY ch.name ASC`,
      args: [code],
    })
    return c.json({
      tokens: result.rows.map((r: any) => ({
        token: r.token,
        childId: r.childId,
        childName: r.childName,
        childClass: r.childClass,
        childSection: r.childSection,
        campaignCode: r.campaignCode,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        accessCount: r.accessCount,
      })),
    })
  } catch {
    return c.json({ tokens: [] })
  }
})

// POST /bulk-release — Generate tokens for all children in a campaign (admin/ops_manager)
app.post('/bulk-release', async (c) => {
  const db = c.get('db')
  const userRole = c.get('userRole')

  if (userRole !== 'admin' && userRole !== 'ops_manager') {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const body = await c.req.json<{ campaignCode: string; expiresInDays?: number }>()
  if (!body.campaignCode) {
    return c.json({ error: 'campaignCode required' }, 400)
  }

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

  // Get all children for this campaign
  const childrenRes = await db.execute({
    sql: 'SELECT id, name, class, section FROM children WHERE campaign_code = ? ORDER BY name',
    args: [body.campaignCode],
  })

  if (childrenRes.rows.length === 0) {
    return c.json({ error: 'No children found in this campaign' }, 404)
  }

  // Check which children already have tokens
  const existingRes = await db.execute({
    sql: 'SELECT childId FROM report_tokens WHERE campaignCode = ?',
    args: [body.campaignCode],
  })
  const existingChildIds = new Set((existingRes.rows || []).map((r: any) => r.childId))

  let released = 0
  let skipped = 0
  const tokens: Array<{ childId: string; childName: string; token: string; childClass?: string }> = []

  for (const child of childrenRes.rows) {
    const c = child as any
    if (existingChildIds.has(c.id)) {
      // Already has a token — fetch existing
      const existingToken = await db.execute({
        sql: 'SELECT token FROM report_tokens WHERE childId = ? AND campaignCode = ?',
        args: [c.id, body.campaignCode],
      })
      tokens.push({
        childId: c.id,
        childName: c.name,
        token: (existingToken.rows[0] as any)?.token || '',
        childClass: c.class,
      })
      skipped++
      continue
    }

    const token = generateToken()
    await db.execute({
      sql: 'INSERT INTO report_tokens (token, childId, campaignCode, expiresAt) VALUES (?, ?, ?, ?)',
      args: [token, c.id, body.campaignCode, expiresAt],
    })
    tokens.push({
      childId: c.id,
      childName: c.name,
      token,
      childClass: c.class,
    })
    released++
  }

  return c.json({
    released,
    skipped,
    total: childrenRes.rows.length,
    expiresAt,
    tokens,
  })
})

// GET /:token — Validate token, return child name only (DOB verification required)
// PUBLIC — no auth. Does NOT return report data until verified.
app.get('/:token', async (c) => {
  const token = c.req.param('token')
  const db = c.get('db')

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

    // Fetch child name only (for verification prompt)
    const childRes = await db.execute({
      sql: 'SELECT name FROM children WHERE id = ?',
      args: [row.childId],
    })
    const child = childRes.rows?.[0] as any
    if (!child) return c.json({ error: 'Child not found' }, 404)

    // Return only child's first name — parent must verify DOB to see full report
    const firstName = child.name.split(' ')[0]
    return c.json({
      status: 'verification_required',
      childFirstName: firstName,
      campaignCode: row.campaignCode,
    })
  } catch {
    return c.json({ error: 'Invalid token' }, 404)
  }
})

// POST /:token/verify — Verify parent identity with DOB, then return full report data
// PUBLIC — no auth. This is the security gate for parent access.
app.post('/:token/verify', async (c) => {
  const token = c.req.param('token')
  const db = c.get('db')
  const body = await c.req.json<{ dob: string }>()

  if (!body.dob) {
    return c.json({ error: 'Date of birth is required for verification' }, 400)
  }

  try {
    const tokenRow = await db.execute({
      sql: `SELECT * FROM report_tokens WHERE token = ?`,
      args: [token],
    })

    const row = tokenRow.rows?.[0] as any
    if (!row) return c.json({ error: 'Invalid or expired token' }, 404)

    if (new Date(row.expiresAt) < new Date()) {
      return c.json({ error: 'Token has expired' }, 410)
    }

    // Fetch child to verify DOB
    const childRes = await db.execute({
      sql: 'SELECT * FROM children WHERE id = ?',
      args: [row.childId],
    })
    const child = childRes.rows?.[0] as any
    if (!child) return c.json({ error: 'Child not found' }, 404)

    // Verify DOB — normalize both dates to YYYY-MM-DD for comparison
    const normalizeDate = (d: string) => {
      try {
        return new Date(d).toISOString().split('T')[0]
      } catch {
        return d
      }
    }
    const childDob = normalizeDate(child.dob)
    const providedDob = normalizeDate(body.dob)

    if (childDob !== providedDob) {
      return c.json({ error: 'Date of birth does not match our records' }, 403)
    }

    // DOB verified — increment access count and return full data
    await db.execute({
      sql: `UPDATE report_tokens SET accessCount = accessCount + 1 WHERE token = ?`,
      args: [token],
    })

    const obsRes = await db.execute({
      sql: 'SELECT * FROM observations WHERE child_id = ? AND campaign_code = ?',
      args: [row.childId, row.campaignCode],
    })

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
      status: 'verified',
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
    return c.json({ error: 'Verification failed' }, 500)
  }
})

export const reportTokenRoutes = app
