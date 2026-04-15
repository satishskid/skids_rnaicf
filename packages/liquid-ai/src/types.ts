// Platform-agnostic types for the on-device Liquid AI runtime.
// Backends (web: WebLLM/transformers.js; mobile: deferred) implement LiquidAiLoader.
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

export interface ModelManifest {
  version: string
  sha256: string
  sizeBytes: number
  releasedAt: string
  releaseNotes?: string
}

export interface LoadProgress {
  phase: 'fetching' | 'verifying' | 'initializing' | 'ready'
  bytesLoaded: number
  bytesTotal: number
  message?: string
}

export interface InferenceRequest<TSchemaOutput> {
  imageDataUrl: string
  moduleId: string
  // JSON Schema derived from the Zod module schema — used as the BFCL function header.
  functionSchema: unknown
  // Runtime validator; backend calls this after receiving JSON from the model.
  validate: (raw: unknown) => { ok: true; value: TSchemaOutput } | { ok: false; error: string }
}

export interface InferenceResult<TSchemaOutput> {
  value: TSchemaOutput
  modelVersion: string
  adapterVersion: string | null
  latencyMs: number
  tier: CapabilityTier
}

export interface LiquidAiLoader {
  probe(): Promise<CapabilityReport>
  isCached(version: string): Promise<boolean>
  load(
    manifest: ModelManifest,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<void>
  infer<TSchemaOutput>(
    req: InferenceRequest<TSchemaOutput>,
  ): Promise<InferenceResult<TSchemaOutput>>
  unload(): Promise<void>
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
