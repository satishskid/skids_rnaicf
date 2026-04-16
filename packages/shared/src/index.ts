// @skids/shared — all shared types, modules, and business logic
// Used by: apps/worker, apps/web, apps/mobile

export * from './types'
export * from './modules'
export * from './campaigns'
export * from './quality-scoring'
export * from './four-d-mapping'
export * from './annotations'
export * from './screening-lifecycle'
export * from './parent-education'
export * from './condition-descriptions'
export * from './observation-utils'
export * from './campaign-progress'
export * from './cohort-analytics'
export * from './population-analytics'
export * from './export-utils'
export * from './ai'
export * from './report-content'
export * from './healthy-habits'
export * from './instrument-scoring'
export * from './fhir-adapter'
export * from './embedding-text'

// Phase 03
export * from './report-token'
export * from './report-render-input'

// Phase 04 — DuckDB analytics canonical queries (allow-list + param validator)
export * from './analytics/queries'
