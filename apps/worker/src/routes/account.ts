// Self-service account routes (any authenticated user)
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const accountRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Change own password (self-service)
accountRoutes.post('/change-password', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return c.json({ error: 'currentPassword and newPassword are required' }, 400)
  }

  if (newPassword.length < 8) {
    return c.json({ error: 'New password must be at least 8 characters' }, 400)
  }

  try {
    // Get current password hash
    const acct = await db.execute({
      sql: 'SELECT password FROM account WHERE userId = ? AND providerId = ?',
      args: [userId, 'credential'],
    })

    if (acct.rows.length === 0) {
      return c.json({ error: 'Account not found' }, 404)
    }

    const storedHash = acct.rows[0].password as string

    // Verify current password using PBKDF2
    if (!storedHash.startsWith('pbkdf2:')) {
      return c.json({ error: 'Unsupported password format' }, 500)
    }

    const [, saltB64, hashB64] = storedHash.split(':')
    const salt = base64ToArray(saltB64)
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(currentPassword),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    const computed = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key,
      256
    )
    const computedB64 = arrayToBase64(new Uint8Array(computed))

    if (computedB64 !== hashB64) {
      return c.json({ error: 'Current password is incorrect' }, 403)
    }

    // Hash new password
    const newSalt = crypto.getRandomValues(new Uint8Array(16))
    const newKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(newPassword),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    const newHash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: newSalt, iterations: 100000, hash: 'SHA-256' },
      newKey,
      256
    )
    const hashedPassword = `pbkdf2:${arrayToBase64(newSalt)}:${arrayToBase64(new Uint8Array(newHash))}`

    await db.execute({
      sql: 'UPDATE account SET password = ? WHERE userId = ? AND providerId = ?',
      args: [hashedPassword, userId, 'credential'],
    })

    return c.json({ message: 'Password changed successfully' })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed to change password' }, 500)
  }
})

// Helpers (same as auth.ts — duplicated to keep route self-contained)
function arrayToBase64(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary)
}

function base64ToArray(b64: string): Uint8Array {
  const binary = atob(b64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i)
  }
  return arr
}
