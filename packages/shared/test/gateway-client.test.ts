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

test('failover tier-1 workers-ai answers first (default chain: workers-ai → groq)', async () => {
  const { fn, calls } = stubFetch([])
  let aiCalled = 0
  const g = new AIGateway({
    accountId: 'acct',
    gatewayId: 'gw',
    keys: { groq: 'gk' },
    // Doctor-only, default-after-refactor chain.
    failover: ['workers-ai', 'groq'],
    fetchImpl: fn,
    aiBinding: {
      run: async () => {
        aiCalled++
        return { response: 'ok-from-llama-33' }
      },
    },
  })
  const res = await g.chat({ messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(res.provider, 'workers-ai')
  assert.equal(res.model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
  assert.equal(res.text, 'ok-from-llama-33')
  assert.equal(aiCalled, 1)
  assert.equal(calls.length, 0, 'no fetch should fire when workers-ai succeeds')
})

test('failover: workers-ai throws → groq picks up, tokens recorded', async () => {
  const { fn } = stubFetch([
    json(
      { choices: [{ message: { content: 'from groq' } }], usage: { prompt_tokens: 9, completion_tokens: 4 } },
      { headers: { 'cf-aig-cache-status': 'MISS', 'cf-aig-cost': '0.00005', 'cf-aig-id': 'req-xyz' } }
    ),
  ])
  const g = new AIGateway({
    accountId: 'acct',
    gatewayId: 'gw',
    keys: { groq: 'gk' },
    failover: ['workers-ai', 'groq'],
    fetchImpl: fn,
    aiBinding: { run: async () => { throw new Error('workers-ai unavailable') } },
  })
  const res = await g.chat({ messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(res.provider, 'groq')
  assert.equal(res.text, 'from groq')
  assert.equal(res.tokensIn, 9)
  assert.equal(res.tokensOut, 4)
  assert.equal(res.gatewayRequestId, 'req-xyz')
})

test('overflow tiers: gemini + claude only reached when both present in chain', async () => {
  // workers-ai fails, groq fails, gemini fails, claude succeeds.
  const { fn, calls } = stubFetch([
    new Response('groq 500', { status: 500 }),
    new Response('gemini 500', { status: 500 }),
    json({ content: [{ text: 'from claude' }], usage: { input_tokens: 2, output_tokens: 1 } }),
  ])
  const g = new AIGateway({
    accountId: 'a',
    gatewayId: 'b',
    keys: { groq: 'gk', gemini: 'g', claude: 'c' },
    failover: ['workers-ai', 'groq', 'gemini', 'claude'],
    fetchImpl: fn,
    aiBinding: { run: async () => { throw new Error('nope') } },
  })
  const res = await g.chat({ messages: [{ role: 'user', content: 'hi' }] })
  assert.equal(res.provider, 'claude')
  assert.equal(calls.length, 3)
  assert.match(calls[0].url, /groq\/openai\/v1\/chat\/completions/)
  assert.match(calls[1].url, /google-ai-studio\/v1beta\/models/)
  assert.match(calls[2].url, /anthropic\/v1\/messages/)
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
  ])
  const g = new AIGateway({
    accountId: 'a',
    gatewayId: 'b',
    keys: { groq: 'gk' },
    failover: ['workers-ai', 'groq'],
    fetchImpl: fn,
    aiBinding: { run: async () => { throw new Error('workers-ai down') } },
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
    keys: { groq: 'gk', gemini: 'g', claude: 'c' },
    failover: ['workers-ai', 'groq', 'gemini', 'claude'],
    fetchImpl: fn,
    aiBinding: { run: async () => { throw new Error('skip') } },
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
