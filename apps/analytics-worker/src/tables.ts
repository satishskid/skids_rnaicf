import type { ExportTableConfig } from './types'

/**
 * Configured export tables for the nightly dump.
 *
 * NOTE on diff from specs/04-duckdb-analytics.md:
 * - `campaign_progress` was listed in the spec but does not exist in
 *   packages/db/src/schema.sql. It was dropped here. When/if we
 *   materialise it (likely as a view over observations + campaigns), add
 *   it back as `mode: 'snapshot'`.
 * - `audit_log` landed in migration 0004 (previously referenced in code
 *   but never formally created). It is included as incremental because
 *   it grows fastest of all tables.
 */
export const EXPORT_TABLES: readonly ExportTableConfig[] = [
  { name: 'campaigns',               mode: 'snapshot',    partitionBy: null },
  { name: 'children',                mode: 'snapshot',    partitionBy: 'campaign_code' },
  { name: 'observations',            mode: 'incremental', partitionBy: 'campaign_code', cursorCol: 'created_at' },
  { name: 'ai_usage',                mode: 'incremental', partitionBy: null,            cursorCol: 'created_at' },
  { name: 'audit_log',               mode: 'incremental', partitionBy: null,            cursorCol: 'created_at' },
  { name: 'report_renders',          mode: 'incremental', partitionBy: null,            cursorCol: 'created_at' },
  { name: 'studies',                 mode: 'snapshot',    partitionBy: null },
  { name: 'consents',                mode: 'snapshot',    partitionBy: null },
  { name: 'reviews',                 mode: 'incremental', partitionBy: null,            cursorCol: 'reviewed_at' },
] as const

export function findTable(name: string): ExportTableConfig | undefined {
  return EXPORT_TABLES.find(t => t.name === name)
}
