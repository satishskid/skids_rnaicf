import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generalAppearanceSuggestionSchema,
  GENERAL_APPEARANCE_FUNCTION_SCHEMA,
} from './general-appearance'

const validPayload = {
  suggestions: [
    {
      category: 'behavioral',
      finding: 'Child appears withdrawn with reduced eye contact during exam.',
      confidence: 0.55,
      rationale: 'Sustained gaze aversion observed across multiple frames.',
      followUpRecommended: true,
    },
  ],
  modelInfo: { name: 'LFM2.5-VL-450M', version: '0.1.0', runtimeMs: 710, runOn: 'device' as const },
}

test('general-appearance — accepts a valid payload', () => {
  assert.equal(generalAppearanceSuggestionSchema.safeParse(validPayload).success, true)
})

test('general-appearance — accepts empty suggestions (no findings is valid)', () => {
  assert.equal(
    generalAppearanceSuggestionSchema.safeParse({
      suggestions: [],
      modelInfo: { name: 'LFM2.5-VL-450M', version: '0.1.0', runtimeMs: 180, runOn: 'device' },
    }).success,
    true,
  )
})

test('general-appearance — rejects missing category', () => {
  const bad = structuredClone(validPayload) as any
  delete bad.suggestions[0].category
  assert.equal(generalAppearanceSuggestionSchema.safeParse(bad).success, false)
})

test('general-appearance — rejects confidence out of [0,1]', () => {
  const over = structuredClone(validPayload) as any
  over.suggestions[0].confidence = 2
  const under = structuredClone(validPayload) as any
  under.suggestions[0].confidence = -1
  assert.equal(generalAppearanceSuggestionSchema.safeParse(over).success, false)
  assert.equal(generalAppearanceSuggestionSchema.safeParse(under).success, false)
})

test('general-appearance — function schema exposes name', () => {
  assert.equal(GENERAL_APPEARANCE_FUNCTION_SCHEMA.name, 'submit_general_appearance_suggestions')
})
