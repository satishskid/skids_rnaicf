// Phase 02a-web — HITL outcome audit for on-device Liquid AI suggestions.
//
// POST /api/on-device-ai/:outcome   outcome ∈ {suggested, accepted, rejected, edited}
//
// Writes audit_log entries that record each step of the HITL loop:
//   - `on_device_ai.suggested` — the local model produced an output.
//   - `on_device_ai.{accepted,rejected,edited}` — a clinician decided on a
//     suggestion. For `cloud-doctor-hitl` runs the decider must be
//     doctor or admin; for `device` runs either role may decide.
//
// No new tables. Uses the existing audit_log schema via logAudit().

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import {
  HITL_OUTCOMES,
  MODEL_MANIFEST,
  hitlAuditAction,
  hitlOutcomeInputSchema,
  isDecisionOutcome,
  type HitlOutcomeName,
} from '@skids/shared'
import { logAudit } from './audit-log'

export const onDeviceAiRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

function isHitlOutcome(s: string): s is HitlOutcomeName {
  return (HITL_OUTCOMES as readonly string[]).includes(s)
}

onDeviceAiRoutes.post('/:outcome', async (c) => {
  const outcomeParam = c.req.param('outcome')
  if (!isHitlOutcome(outcomeParam)) {
    return c.json({ error: 'Unknown outcome' }, 404)
  }
  const outcome: HitlOutcomeName = outcomeParam

  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = hitlOutcomeInputSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: 'Invalid body', issues: parsed.error.issues }, 400)
  }
  const body = parsed.data

  if (body.modelId !== MODEL_MANIFEST.id) {
    return c.json({ error: 'Unknown modelId' }, 400)
  }
  if (body.modelVersion !== MODEL_MANIFEST.version) {
    return c.json({ error: 'Unknown modelVersion' }, 400)
  }

  if (outcome === 'edited' && typeof body.editedPayload === 'undefined') {
    return c.json({ error: 'editedPayload required for outcome=edited' }, 400)
  }

  const userId = c.get('userId')
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const userRole = c.get('userRole') ?? 'nurse'

  // Role/outcome matrix.
  if (isDecisionOutcome(outcome) && body.runOn === 'cloud-doctor-hitl') {
    if (userRole !== 'doctor' && userRole !== 'admin') {
      return c.json(
        {
          error: 'Forbidden — cloud AI decisions require doctor or admin role',
          outcome,
          runOn: body.runOn,
          userRole,
        },
        403,
      )
    }
  }
  // Note: suggested from any authenticated clinical role is allowed.
  // Device-run decisions (accepted/rejected/edited + runOn='device') are
  // allowed for nurse + doctor + admin — no further gate needed.

  await logAudit(c.get('db'), {
    userId,
    action: hitlAuditAction(outcome),
    entityType: body.observationId ? 'observation' : 'suggestion',
    entityId: body.observationId ?? body.suggestionId,
    details: JSON.stringify(body),
  })

  return c.json({ ok: true, action: hitlAuditAction(outcome) }, 200)
})
