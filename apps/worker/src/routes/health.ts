/**
 * Health check & system observability endpoints.
 * GET /api/health — Basic health check (public)
 * GET /api/health/detailed — Detailed system metrics (public, minimal PII)
 */
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const healthRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Basic health check
healthRoutes.get('/', async (c) => {
  const db = c.get('db')
  let dbOk = false
  let dbError: string | null = null
  let dbLatencyMs = 0

  try {
    const start = Date.now()
    const result = await db.execute('SELECT 1 as ok')
    dbLatencyMs = Date.now() - start
    dbOk = result.rows[0]?.ok === 1
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Unknown DB error'
  }

  return c.json({
    status: dbOk ? 'healthy' : 'degraded',
    version: '3.1.0',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ok',
      database: dbOk ? 'ok' : `error: ${dbError}`,
    },
    latency: { db: dbLatencyMs },
  }, dbOk ? 200 : 503)
})

// Detailed system health — table counts, AI usage, latency
healthRoutes.get('/detailed', async (c) => {
  const db = c.get('db')
  const checks: Record<string, { status: string; latencyMs: number; details?: any }> = {}

  // DB connectivity
  try {
    const start = Date.now()
    const result = await db.execute('SELECT 1 as ok')
    checks.database = {
      status: result.rows[0]?.ok === 1 ? 'ok' : 'error',
      latencyMs: Date.now() - start,
    }
  } catch (e) {
    checks.database = {
      status: 'error',
      latencyMs: 0,
      details: e instanceof Error ? e.message : 'Unknown',
    }
  }

  // Table counts
  try {
    const start = Date.now()
    const counts = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM campaigns) as campaigns,
        (SELECT COUNT(*) FROM children) as children,
        (SELECT COUNT(*) FROM observations) as observations
    `)
    const row = counts.rows?.[0] as any
    checks.data = {
      status: 'ok',
      latencyMs: Date.now() - start,
      details: {
        campaigns: row?.campaigns ?? 0,
        children: row?.children ?? 0,
        observations: row?.observations ?? 0,
      },
    }
  } catch {
    checks.data = { status: 'error', latencyMs: 0 }
  }

  // AI usage stats (if table exists)
  try {
    const start = Date.now()
    const aiStats = await db.execute(`
      SELECT COUNT(*) as totalRequests,
        SUM(CASE WHEN created_at > datetime('now', '-1 day') THEN 1 ELSE 0 END) as last24h
      FROM ai_usage
    `)
    const aiRow = aiStats.rows?.[0] as any
    checks.ai = {
      status: 'ok',
      latencyMs: Date.now() - start,
      details: {
        totalRequests: aiRow?.totalRequests ?? 0,
        last24h: aiRow?.last24h ?? 0,
      },
    }
  } catch {
    checks.ai = { status: 'not_configured', latencyMs: 0 }
  }

  const isHealthy = Object.values(checks).every(ch => ch.status === 'ok' || ch.status === 'not_configured')

  return c.json({
    status: isHealthy ? 'healthy' : 'degraded',
    version: '3.1.0',
    environment: c.env.ENVIRONMENT || 'production',
    timestamp: new Date().toISOString(),
    checks,
  }, isHealthy ? 200 : 503)
})
