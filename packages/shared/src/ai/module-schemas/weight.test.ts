import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weightSuggestionSchema, WEIGHT_FUNCTION_SCHEMA } from './weight'

const validPayload = {
  suggestions: [
    {
      category: 'deficiency',
      finding: 'Weight-for-age z-score suggests moderate underweight.',
      confidence: 0.82,
      rationale: 'Anthropometric cues consistent with low BMI percentile for age.',
      followUpRecommended: true,
    },
  ],
  modelInfo: { name: 'LFM2.5-VL-450M', version: '0.1.0', runtimeMs: 600, runOn: 'device' as const },
}

test('weight — accepts a valid payload', () => {
  assert.equal(weightSuggestionSchema.safeParse(validPayload).success, true)
})

test('weight — accepts empty suggestions (no findings is valid)', () => {
  assert.equal(
    weightSuggestionSchema.safeParse({
      suggestions: [],
      modelInfo: { name: 'LFM2.5-VL-450M', version: '0.1.0', runtimeMs: 250, runOn: 'device' },
    }).success,
    true,
  )
})

test('weight — rejects missing category', () => {
  const bad = structuredClone(validPayload) as any
  delete bad.suggestions[0].category
  assert.equal(weightSuggestionSchema.safeParse(bad).success, false)
})

test('weight — rejects confidence > 1 and < 0', () => {
  const over = structuredClone(validPayload) as any
  over.suggestions[0].confidence = 1.01
  const under = structuredClone(validPayload) as any
  under.suggestions[0].confidence = -0.5
  assert.equal(weightSuggestionSchema.safeParse(over).success, false)
  assert.equal(weightSuggestionSchema.safeParse(under).success, false)
})

test('weight — function schema exposes name', () => {
  assert.equal(WEIGHT_FUNCTION_SCHEMA.name, 'submit_weight_suggestions')
})
