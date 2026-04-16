import type { R2Bucket } from '@cloudflare/workers-types'

export interface Env {
  ANALYTICS_R2: R2Bucket
  TURSO_READ_URL: string
  TURSO_READ_AUTH_TOKEN: string
  ENVIRONMENT: string
  ANALYTICS_R2_PREFIX: string
  ANALYTICS_PUBLISHABLE_PREFIX: string
  FEATURE_ANALYTICS_CRON: string
}

export type ExportMode = 'snapshot' | 'incremental'

export interface ExportTableConfig {
  name: string
  mode: ExportMode
  /** Partition column on the source row. `null` = single partition "_all_". */
  partitionBy: string | null
  /** Incremental-only. Column to filter on for "new rows since last run". */
  cursorCol?: string
}

export interface ExportRunResult {
  table: string
  status: 'ok' | 'error' | 'skipped'
  rows: number
  bytes: number
  ms: number
  partitions: number
  error?: string
}
