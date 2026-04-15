import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vitalsSuggestionSchema, VITALS_FUNCTION_SCHEMA } from './vitals'

const validPayload = {
  suggestions: [
    {
      category: 'deficiency',
      finding: 'SpO2 trending 92–94% on room air — borderline.',
      confidence: 0.65,
      rationale: 'Three consecutive sub-95% readings with stable HR.',
      followUpRecommended: true,
    },
  ],
  modelInfo: { name: 'LFM2.5-VL-450M', version: '0.1.0', runtimeMs: 820, runOn: 'device' as const },
}

test('vitals — accepts a valid payload', () => {
  assert.equal(vitalsSuggestionSchema.safeParse(validPayload).success, true)
})

test('vitals — accepts empty suggestions (no findings is valid)', () => {
  assert.equal(
    vitalsSuggestionSchema.safeParse({
      suggestions: [],
      modelInfo: { name: 'LFM2.5-VL-450M', version: '0.1.0', runtimeMs: 300, runOn: 'device' },
    }).success,
    true,
  )
})

test('vitals — rejects missing category', () => {
  const bad = structuredClone(validPayload) as any
  delete bad.suggestions[0].category
  assert.equal(vitalsSuggestionSchema.safeParse(bad).success, false)
})

test('vitals — rejects confidence out of [0,1]', () => {
  const over = structuredClone(validPayload) as any
  over.suggestions[0].confidence = 1.2
  const under = structuredClone(validPayload) as any
  under.suggestions[0].confidence = -0.01
  assert.equal(vitalsSuggestionSchema.safeParse(over).success, false)
  assert.equal(vitalsSuggestionSchema.safeParse(under).success, false)
})

test('vitals — function schema exposes name', () => {
  assert.equal(VITALS_FUNCTION_SCHEMA.name, 'submit_vitals_suggestions')
})
