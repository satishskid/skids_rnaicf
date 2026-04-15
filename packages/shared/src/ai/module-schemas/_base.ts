// Shared base shape for on-device Liquid AI function-call returns.
// Each module schema composes this base with (optionally) module-specific fields.
// See specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md §3.

import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export const FOUR_D_CATEGORY = z.enum([
  'defects',
  'delay',
  'disability',
  'deficiency',
  'behavioral',
  'immunization',
  'learning',
])

export const RUN_ON = z.enum(['device', 'cloud-doctor-hitl'])

export const suggestionSchema = z.object({
  category: FOUR_D_CATEGORY,
  finding: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  followUpRecommended: z.boolean(),
})
export type AiSuggestion = z.infer<typeof suggestionSchema>

export const modelInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  runtimeMs: z.number().int().nonnegative(),
  runOn: RUN_ON,
})
export type ModelInfo = z.infer<typeof modelInfoSchema>

export const moduleSuggestionBaseSchema = z.object({
  suggestions: z.array(suggestionSchema),
  modelInfo: modelInfoSchema,
})
export type ModuleSuggestionBase = z.infer<typeof moduleSuggestionBaseSchema>

// Produce the JSON Schema form used by the BFCLv4 function-call header.
export function toFunctionSchema(
  name: string,
  description: string,
  schema: z.ZodTypeAny,
): Record<string, unknown> {
  return {
    name,
    description,
    parameters: zodToJsonSchema(schema, { target: 'openApi3' }),
  }
}
