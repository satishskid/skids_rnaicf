// @skids/shared AI algorithms — pure functions, no browser APIs
// Used by: apps/web, apps/mobile, apps/worker

export * from './anthropometry'
export * from './audio-analysis'
export * from './audiometry'
export * from './clinical-color'
export * from './mchat-scoring'
export * from './motor'
export * from './rppg'

// AI Annotation Schema — standardized annotation records for every AI-analyzed observation
export * from './annotation-schema'

// AI Accuracy Metrics — sensitivity, specificity, agreement tracking per module
export * from './accuracy-metrics'

// Phase 2 — AI Gateway client + Langfuse tracing (no SDKs, Worker-safe)
export * from './gateway-client'
export * from './langfuse-trace'

// Phase 02a-web — Zod function-call schemas for on-device Liquid AI module suggestions
export * from './module-schemas'

// Phase 02a-web — pinned on-device model manifest (shared by liquid-ai client + worker route)
export * from './model-manifest'

// Phase 02a-web — HITL outcome audit input schema (shared by web client + worker route)
export * from './hitl-outcome-input'
