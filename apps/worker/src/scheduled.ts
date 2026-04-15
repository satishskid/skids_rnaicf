// Phase 03 — cron pre-warm for the satori + resvg-wasm + pdf-lib pipeline.
//
// Triggered every 10 min during 03:00-12:00 UTC (08:30-17:30 IST) by the
// [triggers] block in wrangler.toml. The pipeline has a measurable cold-start
// (~1.5 s en, ~0.7 s hi in the smoke tests) — pre-warming keeps the WASM
// module + font cache hot in Worker memory so the first parent of the day
// does not eat that latency.
//
// Behaviour:
//   - Hard kill switch: returns immediately unless FEATURE_REPORT_PREWARM=1.
//   - Renders en + hi fixtures, discards the PDF bytes.
//   - Zero side effects: no R2 writes, no DB writes, no audit_log entries.
//   - Throw-safe: errors are logged, never re-thrown (cron errors create
//     noisy alerts that would obscure real failures).
//
// The renderer is injected (makeScheduledHandler) so tests can assert call
// counts and exception handling without runtime mocks.

import { renderTemplate } from '@skids/pdf-templates'
import type { RenderLocale } from '@skids/pdf-templates'
import type { Bindings } from './index'
import { PREWARM_PARENT_SCREENING_DATA } from './fixtures/prewarm-report-data'

export const PREWARM_LOCALES: RenderLocale[] = ['en', 'hi']

type RenderFn = typeof renderTemplate

export function makeScheduledHandler(render: RenderFn): ExportedHandlerScheduledHandler<Bindings> {
  return async (_event, env, ctx) => {
    if (env.FEATURE_REPORT_PREWARM !== '1') return

    const work = (async () => {
      for (const locale of PREWARM_LOCALES) {
        const startedAt = Date.now()
        try {
          await render('parent-screening-report', PREWARM_PARENT_SCREENING_DATA, locale)
          console.info(JSON.stringify({
            event: 'report.prewarm',
            locale,
            elapsedMs: Date.now() - startedAt,
          }))
        } catch (err) {
          console.error(JSON.stringify({
            event: 'report.prewarm_failed',
            locale,
            elapsedMs: Date.now() - startedAt,
            error: err instanceof Error ? err.message : String(err),
          }))
        }
      }
    })()

    ctx.waitUntil(work)
    await work
  }
}

export const scheduledHandler = makeScheduledHandler(renderTemplate)
