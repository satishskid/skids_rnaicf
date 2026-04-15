// Platform-agnostic types for the on-device Liquid AI runtime.
// The concrete web loader + manifest live in ./manifest and ./web/.
// See specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md.

export type CapabilityTier =
  | 'webgpu'       // Chrome/Edge with WebGPU — primary path
  | 'wasm'         // transformers.js fallback (desktop Safari/FF)
  | 'unsupported'  // degrade to manual-entry

export interface CapabilityReport {
  tier: CapabilityTier
  hasWebGpu: boolean
  deviceMemoryGb: number | null
  storageFreeBytes: number | null
  effectiveConnectionType: string | null
  reasons: string[]
}

// HITL outcome strings mirror audit_log.action extensions in the worker.
// Keep in lockstep with apps/worker/src/routes/on-device-ai.ts.
export type HitlOutcome =
  | 'on_device_ai.suggested'
  | 'on_device_ai.accepted'
  | 'on_device_ai.rejected'
  | 'on_device_ai.edited'

export interface HitlEvent {
  outcome: HitlOutcome
  childId: string
  moduleId: string
  modelVersion: string
  adapterVersion: string | null
  suggestion: unknown
  finalAnnotation?: unknown
  reviewerId?: string
  reviewerRole?: 'nurse' | 'doctor' | 'admin'
  occurredAt: string
}
