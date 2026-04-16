/**
 * /api/analytics — Phase 04 canonical-query proxy.
 *
 * The hot API worker is stateless and doesn't embed DuckDB. Heavy
 * aggregation lives in the companion `skids-analytics` worker (apps/
 * analytics-worker). We reach it via the `ANALYTICS_SVC` service
 * binding declared in wrangler.toml; no public ingress.
 *
 * Contract:
 *   POST /api/analytics/run  { queryId, params? }   -> { columns, rows, ms, engine }
 *   GET  /api/analytics/queries                     -> manifest of allow-listed queries
 *
 * Rate limit: one audit_log row per call. Role: any authenticated user
 * (canonical queries are already de-identified — Q3 "red-flag prevalence"
 * is the most sensitive and it aggregates to age bands + gender, no
 * individual identifiers leak).
 *
 * Feature flag: FEATURE_DUCKDB_ANALYTICS='1' must be set for the route
 * to execute. When off, returns 503 with a clear hint.
 */
import { Hono } from 'hono'
import { isQueryId, QUERIES } from '@skids/shared'
import type { Bindings, Variables } from '../index'
import { logAudit } from './audit-log'

type AnalyticsBindings = Bindings & {
  ANALYTICS_SVC?: Fetcher
  FEATURE_DUCKDB_ANALYTICS?: string
}

export const analyticsRoutes = new Hono<{ Bindings: AnalyticsBindings; Variables: Variables }>()

analyticsRoutes.get('/queries', c => c.json({ queries: Object.values(QUERIES) }))

analyticsRoutes.post('/run', async (c) => {
  if (c.env.FEATURE_DUCKDB_ANALYTICS !== '1') {
    return c.json({
      error: 'feature_disabled',
      hint: 'Set FEATURE_DUCKDB_ANALYTICS=1 in apps/worker/wrangler.toml or via `wrangler secret put`.',
    }, 503)
  }
  if (!c.env.ANALYTICS_SVC) {
    return c.json({
      error: 'service_binding_missing',
      hint: 'ANALYTICS_SVC is not bound. See apps/analytics-worker/README.md.',
    }, 503)
  }

  let body: { queryId?: unknown; params?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }
  const queryId = typeof body.queryId === 'string' ? body.queryId : ''
  if (!isQueryId(queryId)) {
    return c.json({ error: 'unknown_query_id', allowed: Object.keys(QUERIES) }, 400)
  }
  const params = (body.params && typeof body.params === 'object')
    ? body.params as Record<string, unknown>
    : {}

  const t0 = Date.now()
  const res = await c.env.ANALYTICS_SVC.fetch('https://analytics.internal/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queryId, params }),
  })
  const data = await res.json() as unknown

  // Audit: one row per query run, no params (may contain campaign_code
  // which is fine, but keep the payload tiny). Errors still get audited.
  const db = c.get('db')
  await logAudit(db, {
    userId: c.get('userId') ?? 'anonymous',
    action: 'analytics.query.run',
    entityType: 'query',
    entityId: queryId,
    details: JSON.stringify({ ok: res.ok, ms: Date.now() - t0 }),
  })

  if (!res.ok) {
    return c.json({ error: 'analytics_worker_failed', detail: data }, res.status as 500)
  }
  return c.json(data)
})
