/**
 * Phase 1 — unit tests for the deterministic embedding-text helper.
 * Uses node:test (no new devDependencies).
 *
 * Run:
 *   pnpm --filter @skids/shared test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildEmbeddingText, sha1Hex, EMBEDDING_TEXT_VERSION } from '../src/embedding-text'

test('buildEmbeddingText — minimal observation produces a stable string', () => {
  const s = buildEmbeddingText({ module_type: 'ear' })
  assert.equal(s, `module:ear | risk:normal | v:${EMBEDDING_TEXT_VERSION}`)
})

test('buildEmbeddingText — chips and region join cleanly', () => {
  const s = buildEmbeddingText({
    module_type: 'skin',
    body_region: 'forearm_left',
    ai_annotations: JSON.stringify([{ label: 'mild_erythema' }, { label: 'dryness' }]),
    annotation_data: JSON.stringify([{ chipId: 'itchy' }]),
    risk_level: 2,
  })
  assert.ok(s.includes('module:skin'))
  assert.ok(s.includes('region:forearm_left'))
  assert.ok(s.includes('ai:mild_erythema, dryness'))
  assert.ok(s.includes('nurse:itchy'))
  assert.ok(s.includes('risk:moderate'))
})

test('buildEmbeddingText — determinism: same inputs → same string', () => {
  const obs = {
    module_type: 'dental',
    body_region: null,
    ai_annotations: JSON.stringify([{ label: 'caries_upper' }]),
    annotation_data: null,
    risk_level: 1,
  }
  assert.equal(buildEmbeddingText(obs), buildEmbeddingText(obs))
})

test('buildEmbeddingText — tolerates malformed JSON annotations', () => {
  const s = buildEmbeddingText({
    module_type: 'ear',
    ai_annotations: 'not json at all',
    annotation_data: '{"not":"array"}',
  })
  assert.ok(s.includes('module:ear'))
  assert.ok(\!s.includes('ai:'))
  assert.ok(\!s.includes('nurse:'))
})

test('sha1Hex — produces 40-char hex, stable for same input', async () => {
  const a = await sha1Hex('hello')
  const b = await sha1Hex('hello')
  assert.equal(a, b)
  assert.equal(a.length, 40)
  assert.match(a, /^[0-9a-f]{40}$/)
})

test('sha1Hex — different inputs produce different hashes', async () => {
  const a = await sha1Hex('hello')
  const b = await sha1Hex('world')
  assert.notEqual(a, b)
})
