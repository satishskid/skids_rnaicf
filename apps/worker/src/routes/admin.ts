// Admin routes — user management (admin-only)
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { createAuth, hashPin } from '../auth'

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Create user with role (admin only)
adminRoutes.post('/create-user', async (c) => {
  const body = await c.req.json()
  const { name, email, password, role, orgCode } = body

  if (!name || !email || !password) {
    return c.json({ error: 'name, email, and password are required' }, 400)
  }

  const validRoles = ['admin', 'ops_manager', 'nurse', 'doctor', 'authority']
  if (role && !validRoles.includes(role)) {
    return c.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, 400)
  }

  try {
    const auth = createAuth(c.env)
    const result = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        role: role || 'nurse',
        orgCode: orgCode || 'zpedi',
      },
    })

    return c.json({
      message: 'User created',
      user: {
        id: result.user?.id,
        name: result.user?.name,
        email: result.user?.email,
        role: role || 'nurse',
      },
    }, 201)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create user'
    return c.json({ error: msg }, 400)
  }
})

// Reset user password (admin only)
adminRoutes.post('/reset-password', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const { userId, newPassword } = body

  if (!userId || !newPassword) {
    return c.json({ error: 'userId and newPassword are required' }, 400)
  }

  if (newPassword.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  try {
    const auth = createAuth(c.env)

    // Hash the new password using the same PBKDF2 method
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(newPassword),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    const hash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key,
      256
    )

    function arrayToBase64(arr: Uint8Array): string {
      let binary = ''
      for (let i = 0; i < arr.length; i++) {
        binary += String.fromCharCode(arr[i])
      }
      return btoa(binary)
    }

    const hashedPassword = `pbkdf2:${arrayToBase64(salt)}:${arrayToBase64(new Uint8Array(hash))}`

    // Update password directly in Better Auth's user table
    await db.execute({
      sql: 'UPDATE account SET password = ? WHERE userId = ? AND providerId = ?',
      args: [hashedPassword, userId, 'credential'],
    })

    return c.json({ message: 'Password reset successfully' })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed to reset password' }, 500)
  }
})

// List all users (admin only)
adminRoutes.get('/users', async (c) => {
  const db = c.get('db')

  const result = await db.execute(
    'SELECT id, name, email, role, "orgCode", "createdAt", "pinHash" FROM user ORDER BY "createdAt" DESC'
  )

  const users = result.rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role || 'nurse',
    orgCode: row.orgCode,
    createdAt: row.createdAt,
    hasPin: !!row.pinHash,
  }))

  return c.json({ users })
})

// Set PIN for a user (admin only)
adminRoutes.post('/set-pin', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const { userId, pin } = body

  if (!userId || !pin) {
    return c.json({ error: 'userId and pin are required' }, 400)
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return c.json({ error: 'PIN must be 4-6 digits' }, 400)
  }

  // Get user's orgCode
  const userResult = await db.execute({
    sql: 'SELECT id, "orgCode" FROM user WHERE id = ?',
    args: [userId],
  })

  if (userResult.rows.length === 0) {
    return c.json({ error: 'User not found' }, 404)
  }

  const orgCode = (userResult.rows[0].orgCode as string) || 'zpedi'
  const pinHash = await hashPin(pin, orgCode)

  // Check uniqueness
  const existing = await db.execute({
    sql: 'SELECT id FROM user WHERE "pinHash" = ? AND id != ?',
    args: [pinHash, userId],
  })

  if (existing.rows.length > 0) {
    return c.json({ error: 'This PIN is already in use by another user' }, 409)
  }

  await db.execute({
    sql: 'UPDATE user SET "pinHash" = ? WHERE id = ?',
    args: [pinHash, userId],
  })

  return c.json({ message: 'PIN set successfully' })
})

// Reset (clear) PIN for a user (admin only)
adminRoutes.post('/reset-pin', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const { userId } = body

  if (!userId) {
    return c.json({ error: 'userId is required' }, 400)
  }

  await db.execute({
    sql: 'UPDATE user SET "pinHash" = NULL WHERE id = ?',
    args: [userId],
  })

  return c.json({ message: 'PIN cleared' })
})
