/**
 * Phase 2 — unit tests for the Langfuse client + PHI redaction.
 *
 * Run:
 *   pnpm --filter @skids/shared test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Langfuse, redactString, redactValue } from '../src/ai/langfuse-trace'

test('redactString: strips data: URL images', () => {
  const s = 'before data:image/jpeg;base64,AAAAABBBBBCCCCC after'
  const r = redactString(s)
  assert.match(r, /<image:base64>/)
  assert.doesNotMatch(r, /AAAAA/)
})

test('redactString: strips long base64 blobs', () => {
  const blob = 'A'.repeat(800)
  const r = redactString(`pre ${blob} post`)
  assert.match(r, /<image:sha:[0-9a-f]{8}>/)
  assert.doesNotMatch(r, /AAAAAAAAAAAA/)
})

test('redactString: phone + DOB', () => {
  const s = 'call +919876543210 born 2019-05-14'
  const r = redactString(s)
  assert.match(r, /<phone>/)
  assert.match(r, /<dob>/)
})

test('redactValue: replaces child name keys without touching siblings', () => {
  const input = { childName: 'Arjun', age: 5, notes: 'healthy kid' }
  const out = redactValue(input) as Record<string, unknown>
  assert.equal(out.childName, '<child>')
  assert.equal(out.age, 5)
  assert.equal(out.notes, 'healthy kid')
})

test('redactValue: walks arrays + nested objects', () => {
  const out = redactValue([
    { firstName: 'A', lastName: 'B' },
    'data:image/png;base64,ZZZZZZZZZZZZZZZZZZZZZZZZZZ',
  ]) as Array<Record<string, unknown> | string>
  assert.equal((out[0] as Record<string, unknown>).firstName, '<child>')
  assert.match(out[1] as string, /<image:base64>/)
})

test('PHI payload stays under 2kB even with 100k base64 image', async () => {
  const big = 'data:image/jpeg;base64,' + 'X'.repeat(100_000)
  let captured: unknown = null
  const lf = new Langfuse({
    publicKey: 'pub',
    secretKey: 'sec',
    baseUrl: 'https://langfuse.example',
    fetchImpl: (async (_url, init) => {
      captured = (init as RequestInit)?.body
      return new Response('{}', { status: 200 })
    }) as typeof fetch,
  })
  const traceId = await lf.startTrace({ name: 'test' })
  await lf.span({
    traceId,
    name: 'vision',
    input: { imageBase64: big, childName: 'Arjun' },
    output: { text: 'ok' },
    model: 'gemini-2.0-flash',
    provider: 'gemini',
  })
  const bodyStr = typeof captured === 'string' ? captured : new TextDecoder().decode(captured as Uint8Array)
  assert.ok(bodyStr.length < 2048, `payload too large: ${bodyStr.length}`)
  assert.match(bodyStr, /<image:base64>|<image:sha:/)
  assert.doesNotMatch(bodyStr, /XXXXXXXXXXXX/)
  assert.match(bodyStr, /<child>/)
})

test('redactString: long clinical prose passes through unchanged', () => {
  // 5000+ char realistic model output, lots of spaces + punctuation.
  // Must NOT trigger the base64 regex (which requires 500+ consecutive
  // [A-Za-z0-9+/] with no whitespace or punctuation).
  const sentence =
    'The observation notes mild conjunctival injection on the lateral aspect of the right eye, ' +
    'with no discharge, no photophobia, and no visual-acuity change on confrontation testing. '
  const prose = sentence.repeat(30) // ~5400 chars
  assert.ok(prose.length > 5000)
  const out = redactString(prose)
  assert.equal(out, prose, 'clinical prose must pass through unchanged')
})

test('Langfuse.ingest: never throws on network failure', async () => {
  const lf = new Langfuse({
    publicKey: 'pub',
    secretKey: 'sec',
    baseUrl: 'https://unreachable.example',
    fetchImpl: (async () => {
      throw new Error('network down')
    }) as typeof fetch,
  })
  // Must not throw
  const traceId = await lf.startTrace({ name: 'test' })
  assert.match(traceId, /^trace_/)
})
