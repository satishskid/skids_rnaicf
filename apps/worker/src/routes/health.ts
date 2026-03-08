// Health check & DB connectivity test
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const healthRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

healthRoutes.get('/', async (c) => {
  const db = c.get('db')
  let dbOk = false
  let dbError: string | null = null

  try {
    const result = await db.execute('SELECT 1 as ok')
    dbOk = result.rows[0]?.ok === 1
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Unknown DB error'
  }

  return c.json({
    status: dbOk ? 'healthy' : 'degraded',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ok',
      database: dbOk ? 'ok' : `error: ${dbError}`,
    },
  }, dbOk ? 200 : 503)
})
