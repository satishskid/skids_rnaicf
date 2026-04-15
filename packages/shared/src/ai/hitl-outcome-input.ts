// Phase 02a-web — HITL outcome audit request body.
// Shared between the web client (POST /api/on-device-ai/:outcome) and the
// worker route that writes to audit_log.

import { z } from 'zod'

export const HITL_OUTCOMES = ['suggested', 'accepted', 'rejected', 'edited'] as const
export type HitlOutcomeName = (typeof HITL_OUTCOMES)[number]

export const HITL_RUN_ON = z.enum(['device', 'cloud-doctor-hitl'])
export type HitlRunOn = z.infer<typeof HITL_RUN_ON>

export const hitlOutcomeInputSchema = z.object({
  suggestionId: z.string().uuid(),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
  moduleType: z.string().min(1),
  observationId: z.string().optional(),
  childId: z.string().optional(),
  suggestionSchemaVersion: z.number().int().nonnegative(),
  suggestionPayload: z.unknown(),
  decidedBy: z.string().optional(),
  decisionNotes: z.string().optional(),
  editedPayload: z.unknown().optional(),
  runtimeMs: z.number().int().nonnegative().optional(),
  runOn: HITL_RUN_ON,
})
export type HitlOutcomeInput = z.infer<typeof hitlOutcomeInputSchema>

export function hitlAuditAction(outcome: HitlOutcomeName): string {
  return `on_device_ai.${outcome}`
}

export function isDecisionOutcome(outcome: HitlOutcomeName): boolean {
  return outcome === 'accepted' || outcome === 'rejected' || outcome === 'edited'
}
