// Auth middleware — protects API routes, extracts user info
import { createMiddleware } from 'hono/factory'
import type { Bindings, Variables } from '../index'
import { createAuth } from '../auth'

/**
 * Auth middleware — validates session, sets userId + userRole on context.
 * Use on protected routes: app.use('/api/protected/*', authMiddleware)
 */
export const authMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const auth = createAuth(c.env)

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    if (!session?.user) {
      return c.json({ error: 'Unauthorized — please sign in' }, 401)
    }

    c.set('userId', session.user.id)
    // Role will come from organization membership
    // For now, default to the user's base role
    c.set('userRole', 'nurse')

    await next()
  } catch {
    return c.json({ error: 'Invalid session' }, 401)
  }
})

/**
 * Role guard — restrict access to specific roles.
 * Usage: app.get('/api/analytics', requireRole('doctor', 'admin'), handler)
 */
export function requireRole(...roles: string[]) {
  return createMiddleware<{
    Bindings: Bindings
    Variables: Variables
  }>(async (c, next) => {
    const userRole = c.get('userRole')
    if (!userRole || !roles.includes(userRole)) {
      return c.json({
        error: 'Forbidden — insufficient permissions',
        required: roles,
        current: userRole || 'none',
      }, 403)
    }
    await next()
  })
}
