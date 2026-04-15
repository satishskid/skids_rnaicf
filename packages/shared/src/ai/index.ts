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
