// Function-call schema for on-device Liquid AI — vitals module.

import { z } from 'zod'
import { moduleSuggestionBaseSchema, toFunctionSchema } from './_base'

export const vitalsSuggestionSchema = moduleSuggestionBaseSchema
export type VitalsSuggestion = z.infer<typeof vitalsSuggestionSchema>

export const VITALS_FUNCTION_SCHEMA = toFunctionSchema(
  'submit_vitals_suggestions',
  'Return structured vitals findings (HR, RR, SpO2, temperature context) for doctor HITL review.',
  vitalsSuggestionSchema,
)
