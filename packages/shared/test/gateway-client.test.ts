/**
 * Phase 2 — unit tests for the AI Gateway client.
 * Uses node:test (no new devDependencies). Hand-rolled fetch stub.
 *
 * Run:
 *   pnpm --filter @skids/shared test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AIGateway, buildCacheKey } from '../src/ai/gateway-client'

type Call = { url: string; init: RequestInit }

function stubFetch(responses: Array<Response | ((url: string) => Response)>): { fn: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  let i = 0
  const fn = (async (url: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    const r = responses[Math.min(i++, responses.length - 1)]
    return typeof r === 'function' ? r(String(url)) : r
  }) as typeof fetch
  return { fn, calls }
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers({ 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) })
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers })
}

test('failover: gemini fails, claude succeeds, tokens recorded', async () => {
  const { fn } = stubFetch([
    // gemini → 500
    new Response('upstream 500', { status: 500 }),
    // claude → 200
    json(
      { content: [{ text: 'ok' }], usage: { input_tokens: 12, output_tokens: 5 } },
      { headers: { 'cf-aig-cache-status': 'MISS', 'cf-aig-cost': '0.0001', 'cf-aig-id': 'req-abc' } }
    ),
  ])
  const g = new AIGateway({
    accountId: 'acct',
    gatewayId: 'gw',
    keys: { gemini: 'g', claude: 'c' },
    failover: ['gemini', 'claude', 'workers-ai'],
    fetchImpl: fn,
    aiBinding: { run: async () => ({ response: 'never called' }) },
  })
  const res = await g.chat({ messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(res.provider, 'claude')
  assert.equal(res.text, 'ok')
  assert.equal(res.tokensIn, 12)
  assert.equal(res.tokensOut, 5)
  assert.equal(res.gatewayRequestId, 'req-abc')
  assert.equal(res.cached, false)
})

test('cache header propagation: cf-aig-cache-status=HIT surfaces as cached=true', async () => {
  const { fn } = stubFetch([
    json({ content: [{ text: 'cached reply' }], usage: {} }, { headers: { 'cf-aig-cache-status': 'HIT' } }),
  ])
  const g = new AIGateway({
    accountId: 'a',
    gatewayId: 'b',
    keys: { claude: 'c' },
    failover: ['claude'],
    fetchImpl: fn,
  })
  const res = await g.chat({ messages: [{ role: 'user', content: 'hi' }], cacheKey: 'k1' })
  assert.equal(res.cached, true)
  assert.equal(res.text, 'cached reply')
})

test('all providers fail: AIGatewayError surfaces attempts', async () => {
  const { fn } = stubFetch([
    new Response('err', { status: 500 }),
    new Response('err', { status: 500 }),
  ])
  const g = new AIGateway({
    accountId: 'a',
    gatewayId: 'b',
    keys: { gemini: 'g', claude: 'c' },
    failover: ['gemini', 'claude'],
    fetchImpl: fn,
  })
  await assert.rejects(() => g.chat({ messages: [{ role: 'user', content: 'hi' }] }), /all providers failed/)
})

test('modelHint reorders the failover chain', async () => {
  const { fn, calls } = stubFetch([
    json({ content: [{ text: 'claude first' }], usage: {} }),
  ])
  const g = new AIGateway({
    accountId: 'a',
    gatewayId: 'b',
    keys: { gemini: 'g', claude: 'c' },
    failover: ['gemini', 'claude'],
    fetchImpl: fn,
  })
  await g.chat({ messages: [{ role: 'user', content: 'hi' }], modelHint: 'claude' })
  assert.match(calls[0].url, /anthropic\/v1\/messages/)
})

test('buildCacheKey: stable, deterministic, hex-only', async () => {
  const a = await buildCacheKey({ provider: 'gemini', kind: 'chat', prompt: 'hello' })
  const b = await buildCacheKey({ provider: 'gemini', kind: 'chat', prompt: 'hello' })
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{64}$/)
})
