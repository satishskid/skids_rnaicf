// Phase 03 — unit tests for the cron pre-warm scheduled handler.
// Uses node:test (no new devDependencies).
//
// Run:
//   pnpm --filter @skids/worker test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeScheduledHandler, PREWARM_LOCALES } from '../src/scheduled'
import type { Bindings } from '../src/index'

type RenderCall = { templateName: string; locale: string }

interface Harness {
  handler: ReturnType<typeof makeScheduledHandler>
  calls: RenderCall[]
  r2Writes: number
  dbWrites: number
  ctx: { waitUntil: (p: Promise<unknown>) => void }
  pending: Array<Promise<unknown>>
}

function buildHarness(opts: { renderThrows?: boolean } = {}): Harness {
  const calls: RenderCall[] = []
  const harness: Harness = {
    calls,
    r2Writes: 0,
    dbWrites: 0,
    pending: [],
    ctx: { waitUntil: (p) => { harness.pending.push(p) } },
    handler: undefined as unknown as ReturnType<typeof makeScheduledHandler>,
  }
  const fakeRender = (async (templateName: string, _data: unknown, locale: string) => {
    calls.push({ templateName, locale })
    if (opts.renderThrows) throw new Error('boom (test)')
    return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
  }) as unknown as Parameters<typeof makeScheduledHandler>[0]
  harness.handler = makeScheduledHandler(fakeRender)
  return harness
}

function envWith(prewarm: string | undefined): Bindings {
  return { FEATURE_REPORT_PREWARM: prewarm } as unknown as Bindings
}

const fakeEvent = { cron: '*/10 3-12 * * *', scheduledTime: Date.now(), type: 'scheduled' } as unknown as ScheduledController

test('scheduled — short-circuits when FEATURE_REPORT_PREWARM is unset', async () => {
  const h = buildHarness()
  await h.handler(fakeEvent, envWith(undefined), h.ctx as unknown as ExecutionContext)
  assert.equal(h.calls.length, 0, 'no render calls when flag is off')
  assert.equal(h.r2Writes, 0)
  assert.equal(h.dbWrites, 0)
})

test('scheduled — short-circuits when FEATURE_REPORT_PREWARM is "0"', async () => {
  const h = buildHarness()
  await h.handler(fakeEvent, envWith('0'), h.ctx as unknown as ExecutionContext)
  assert.equal(h.calls.length, 0)
})

test('scheduled — renders en + hi when FEATURE_REPORT_PREWARM=1, no R2/DB side effects', async () => {
  const h = buildHarness()
  await h.handler(fakeEvent, envWith('1'), h.ctx as unknown as ExecutionContext)
  assert.equal(h.calls.length, PREWARM_LOCALES.length)
  assert.deepEqual(h.calls.map(c => c.locale), ['en', 'hi'])
  for (const c of h.calls) {
    assert.equal(c.templateName, 'parent-screening-report')
  }
  assert.equal(h.r2Writes, 0, 'pre-warm must not write to R2')
  assert.equal(h.dbWrites, 0, 'pre-warm must not write to the DB')
})

test('scheduled — render exceptions are caught, handler does not re-throw', async () => {
  const h = buildHarness({ renderThrows: true })
  await assert.doesNotReject(
    h.handler(fakeEvent, envWith('1'), h.ctx as unknown as ExecutionContext),
  )
  // Both locales attempted even when the first throws — each iteration is isolated.
  assert.equal(h.calls.length, PREWARM_LOCALES.length)
})
