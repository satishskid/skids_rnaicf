// Function-call schema for on-device Liquid AI — weight-screening module.

import { z } from 'zod'
import { moduleSuggestionBaseSchema, toFunctionSchema } from './_base'

export const weightSuggestionSchema = moduleSuggestionBaseSchema
export type WeightSuggestion = z.infer<typeof weightSuggestionSchema>

export const WEIGHT_FUNCTION_SCHEMA = toFunctionSchema(
  'submit_weight_suggestions',
  'Return structured weight-screening findings (underweight, overweight, wasting cues) for doctor HITL review.',
  weightSuggestionSchema,
)
