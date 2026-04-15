// Function-call schema for on-device Liquid AI — general-appearance module.

import { z } from 'zod'
import { moduleSuggestionBaseSchema, toFunctionSchema } from './_base'

export const generalAppearanceSuggestionSchema = moduleSuggestionBaseSchema
export type GeneralAppearanceSuggestion = z.infer<typeof generalAppearanceSuggestionSchema>

export const GENERAL_APPEARANCE_FUNCTION_SCHEMA = toFunctionSchema(
  'submit_general_appearance_suggestions',
  'Return structured general-appearance findings (grooming, alertness, distress, dysmorphic cues) for doctor HITL review.',
  generalAppearanceSuggestionSchema,
)
