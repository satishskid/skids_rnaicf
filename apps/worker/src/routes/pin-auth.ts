// PIN-based authentication for field workers (mobile)
// Public route — no authMiddleware needed
// Rate-limited: 5 attempts per 5 minutes per IP

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { hashPin } from '../auth'

export const pinAuthRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// POST /login — authenticate with PIN + orgCode
pinAuthRoutes.post('/login', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const { pin, orgCode } = body

  if (!pin || !orgCode) {
    return c.json({ error: 'pin and orgCode are required' }, 400)
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return c.json({ error: 'PIN must be 4-6 digits' }, 400)
  }

  // Rate limiting — check recent attempts from this IP
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
  try {
    const recentAttempts = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM pin_attempt
            WHERE identifier = ? AND attemptAt > datetime('now', '-5 minutes')`,
      args: [ip],
    })
    const count = Number(recentAttempts.rows[0]?.cnt || 0)
    if (count >= 5) {
      return c.json({ error: 'Too many attempts. Try again in 5 minutes.' }, 429)
    }
  } catch {
    // pin_attempt table might not exist yet, continue without rate limiting
  }

  // Hash PIN and look up user
  const pinHash = await hashPin(pin, orgCode)

  const userResult = await db.execute({
    sql: `SELECT id, name, email, role, "orgCode" FROM user
          WHERE "pinHash" = ? AND "orgCode" = ?`,
    args: [pinHash, orgCode],
  })

  // Record attempt
  try {
    const attemptId = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO pin_attempt (id, identifier, success) VALUES (?, ?, ?)`,
      args: [attemptId, ip, userResult.rows.length > 0 ? 1 : 0],
    })
  } catch {
    // Non-critical — don't fail login if rate-limit table missing
  }

  if (userResult.rows.length === 0) {
    return c.json({ error: 'Invalid PIN' }, 401)
  }

  const user = userResult.rows[0]

  // Create session directly (bypass Better Auth for PIN flow)
  const sessionId = crypto.randomUUID()
  const sessionToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await db.execute({
    sql: `INSERT INTO session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
          VALUES (?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?)`,
    args: [
      sessionId,
      expiresAt,
      sessionToken,
      ip,
      c.req.header('user-agent') || 'mobile',
      user.id,
    ],
  })

  return c.json({
    token: sessionToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'nurse',
      orgCode: user.orgCode,
    },
  })
})
