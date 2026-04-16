/**
 * @skids/analytics-worker — entrypoint.
 *
 * - `scheduled()` runs the nightly Turso -> R2 Parquet dump at 20:30 UTC
 *   (02:00 IST) when FEATURE_ANALYTICS_CRON === '1'.
 * - `fetch()` exposes POST /run for service-binding callers (main API
 *   worker). Public ingress is not required — we wire the binding in
 *   apps/worker/wrangler.toml and route the UI through that.
 */

import { Hono } from 'hono'
import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types'
import { isQueryId } from '@skids/shared'
import type { Env } from './types'
import { runNightlyExport } from './export'
import { runQuery } from './queries'
import { buildPublishableSql } from './publishable'
import { QUERIES } from '@skids/shared'

const app = new Hono<{ Bindings: Env }>()

app.get('/', c => c.json({ ok: true, service: 'skids-analytics' }))

app.get('/health', c => c.json({
  ok: true,
  service: 'skids-analytics',
  env: c.env.ENVIRONMENT,
  cronEnabled: c.env.FEATURE_ANALYTICS_CRON === '1',
}))

/**
 * POST /run
 * body: { queryId: 'Q1'|'Q2'|'Q3'|'Q4'|'Q5', params?: {...} }
 *
 * Executes an allow-listed canonical query. 400 on unknown id. Only
 * service-binding callers should hit this; no auth here because the
 * worker has no public route exposed in wrangler.toml.
 */
app.post('/run', async c => {
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
  try {
    const result = await runQuery(c.env, queryId, params)
    return c.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: 'query_failed', detail: msg }, 500)
  }
})

/**
 * GET /queries
 * Returns the full query manifest so the UI / analyst tooling can
 * discover what's available without reading source.
 */
app.get('/queries', c => c.json({ queries: Object.values(QUERIES) }))

/**
 * GET /publishable-sql?isoDate=YYYY-MM-DD
 * Returns the DuckDB SQL script that materialises the publishable views
 * for a given dump. Designed for the companion job / ops CLI. The ISO
 * date defaults to today (UTC).
 */
app.get('/publishable-sql', c => {
  const iso = c.req.query('isoDate') ?? new Date().toISOString().slice(0, 10)
  const sql = buildPublishableSql({
    isoDate: iso,
    s3Endpoint: c.req.query('endpoint') ?? '',
    s3KeyId: '',       // caller substitutes secrets locally
    s3Secret: '',
    bucket: c.req.query('bucket') ?? 'skids-analytics',
    rawPrefix: c.env.ANALYTICS_R2_PREFIX,
    publishablePrefix: c.env.ANALYTICS_PUBLISHABLE_PREFIX,
  })
  return c.text(sql, 200, { 'Content-Type': 'text/plain' })
})

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (env.FEATURE_ANALYTICS_CRON !== '1') {
      console.log('[analytics-worker] FEATURE_ANALYTICS_CRON off — skipping', {
        cron: controller.cron,
        scheduledTime: controller.scheduledTime,
      })
      return
    }
    ctx.waitUntil((async () => {
      const t0 = Date.now()
      try {
        const { isoDate, results, cursorUpdates } = await runNightlyExport(env)
        const totalRows = results.reduce((a, r) => a + r.rows, 0)
        const totalBytes = results.reduce((a, r) => a + r.bytes, 0)
        console.log('[analytics-worker] nightly export complete', {
          isoDate,
          ms: Date.now() - t0,
          tables: results.length,
          totalRows,
          totalBytes,
          cursorUpdates: cursorUpdates.length,
        })
        // Cursor + analytics_runs writes happen via the main API worker's
        // admin endpoint — analytics-worker is read-only on Turso. Stub:
        // await fetch(env.API_ADMIN_URL + '/api/admin/analytics-runs', ...)
        // (Not wired yet; ops re-runs by calling this worker manually.)
      } catch (err) {
        console.error('[analytics-worker] nightly export failed', err)
      }
    })())
  },
}
