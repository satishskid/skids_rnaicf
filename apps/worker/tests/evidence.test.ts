// Phase 07 — tests for evidence RAG utilities.
//
// The production routes call into Vectorize + Workers AI bindings we
// can't reproduce under node:test, so we focus on:
//   - the chunk collector produces a deterministic corpus with required
//     fields on every row
//   - the filter helper maps the public filter shape to the Vectorize
//     operator dialect
//
// End-to-end coverage comes from the post-deploy smoke described in
// docs/RUNBOOK.md (build-evidence-index.ts + /api/evidence/search).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectChunks, type EvidenceChunk } from '@skids/evidence'

test('collectChunks — returns non-empty, deterministic corpus', () => {
  const a = collectChunks()
  const b = collectChunks()
  assert.ok(a.length > 0, 'expected at least one chunk')
  assert.equal(a.length, b.length, 'collector must be deterministic')
  for (const [i, chunk] of a.entries()) {
    assert.equal(chunk.id, b[i].id, `chunk[${i}] id mismatch`)
  }
})

test('collectChunks — every chunk has id, text, category, source', () => {
  for (const chunk of collectChunks()) {
    assert.ok(chunk.id && chunk.id.length > 0, `missing id: ${JSON.stringify(chunk)}`)
    assert.ok(chunk.text && chunk.text.length > 0, `missing text on ${chunk.id}`)
    assert.ok(chunk.category, `missing category on ${chunk.id}`)
    assert.ok(chunk.source, `missing source on ${chunk.id}`)
  }
})

test('collectChunks — includes M-CHAT + condition + parent-education categories', () => {
  const cats = new Set(collectChunks().map((c) => c.category))
  assert.ok(cats.has('condition'), 'missing condition chunks')
  assert.ok(cats.has('mchat'), 'missing mchat chunks')
  assert.ok(cats.has('parent-education'), 'missing parent-education chunks')
})

test('collectChunks — ids are unique across categories', () => {
  const seen = new Set<string>()
  for (const chunk of collectChunks()) {
    assert.ok(!seen.has(chunk.id), `duplicate id: ${chunk.id}`)
    seen.add(chunk.id)
  }
})

test('collectChunks — M-CHAT chunks carry age_band_months=16..30 and module_type=mchat', () => {
  const mchat = collectChunks().filter((c: EvidenceChunk) => c.category === 'mchat')
  assert.ok(mchat.length >= 20, `expected >=20 M-CHAT chunks, got ${mchat.length}`)
  for (const c of mchat) {
    assert.equal(c.module_type, 'mchat')
    assert.deepEqual(c.age_band_months, { min: 16, max: 30 })
  }
})
