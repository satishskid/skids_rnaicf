import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visionSuggestionSchema, VISION_FUNCTION_SCHEMA } from './vision'

const validPayload = {
  suggestions: [
    {
      category: 'defects',
      finding: 'Asymmetric red reflex suggests possible leukocoria — left eye.',
      confidence: 0.78,
      rationale: 'Asymmetry visible on RR frame; no glare artifact detected.',
      followUpRecommended: true,
    },
  ],
  modelInfo: { name: 'LFM2.5-VL-450M', version: '0.1.0', runtimeMs: 950, runOn: 'device' as const },
}

test('vision — accepts a valid payload', () => {
  const r = visionSuggestionSchema.safeParse(validPayload)
  assert.equal(r.success, true)
})

test('vision — accepts an empty suggestions array (no findings is a valid result)', () => {
  const r = visionSuggestionSchema.safeParse({
    suggestions: [],
    modelInfo: { name: 'LFM2.5-VL-450M', version: '0.1.0', runtimeMs: 420, runOn: 'device' },
  })
  assert.equal(r.success, true)
})

test('vision — rejects suggestion with missing category', () => {
  const bad = structuredClone(validPayload) as any
  delete bad.suggestions[0].category
  assert.equal(visionSuggestionSchema.safeParse(bad).success, false)
})

test('vision — rejects confidence > 1', () => {
  const bad = structuredClone(validPayload) as any
  bad.suggestions[0].confidence = 1.5
  assert.equal(visionSuggestionSchema.safeParse(bad).success, false)
})

test('vision — rejects confidence < 0', () => {
  const bad = structuredClone(validPayload) as any
  bad.suggestions[0].confidence = -0.1
  assert.equal(visionSuggestionSchema.safeParse(bad).success, false)
})

test('vision — function schema exposes name + parameters', () => {
  assert.equal(VISION_FUNCTION_SCHEMA.name, 'submit_vision_suggestions')
  assert.ok(VISION_FUNCTION_SCHEMA.parameters)
})
