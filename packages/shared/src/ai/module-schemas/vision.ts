// Function-call schema for on-device Liquid AI — vision screening module.
// The model returns structured findings the doctor then accepts/rejects/edits.

import { z } from 'zod'
import { moduleSuggestionBaseSchema, toFunctionSchema } from './_base'

export const visionSuggestionSchema = moduleSuggestionBaseSchema
export type VisionSuggestion = z.infer<typeof visionSuggestionSchema>

export const VISION_FUNCTION_SCHEMA = toFunctionSchema(
  'submit_vision_suggestions',
  'Return structured vision-screening findings (red reflex, strabismus, visual acuity cues) for doctor HITL review.',
  visionSuggestionSchema,
)
