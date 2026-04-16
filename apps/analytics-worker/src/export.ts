/**
 * Orchestrator for the nightly dump.
 *
 * For each table in EXPORT_TABLES:
 *   1. Read analytics_cursor (incremental only) to get `last_cursor`.
 *   2. SELECT rows (WHERE cursor > last_cursor for incremental).
 *   3. Group by partition (campaign_code when configured).
 *   4. Write Parquet bytes per partition, upload to R2.
 *   5. Upsert analytics_cursor to max(cursor) in the batch.
 *   6. INSERT analytics_runs row with counts + status.
 *
 * Returns an array of ExportRunResult so the cron handler can build a
 * Langfuse-style log at the end.
 */

import { createClient, type Client } from '@libsql/client'
import type { Env, ExportRunResult, ExportTableConfig } from './types'
import { EXPORT_TABLES } from './tables'
import { writeParquetBytes, partitionKey, splitIntoParts } from './parquet'

const BATCH_SIZE = 10_000 // rows per SELECT batch
const APPROX_BYTES_PER_ROW = 1024

function todayIso(): string {
  const d = new Date()
  // YYYY-MM-DD in UTC; cron runs at 20:30 UTC so the partition date is the
  // current UTC day, i.e. the start of the IST day.
  return d.toISOString().slice(0, 10)
}

function libsqlClient(env: Env): Client {
  // The analytics-worker uses a read-only Turso token. This is enforced at
  // Turso side; the worker never ATTEMPTs a write. Logging of runs happens
  // via a separate write-enabled channel (the main API worker's audit_log
  // route) — see src/index.ts.
  return createClient({
    url: env.TURSO_READ_URL,
    authToken: env.TURSO_READ_AUTH_TOKEN,
  })
}

async function getCursor(db: Client, table: string): Promise<string | null> {
  const res = await db.execute({
    sql: 'SELECT last_cursor FROM analytics_cursor WHERE table_name = ?',
    args: [table],
  })
  if (res.rows.length === 0) return null
  const val = (res.rows[0] as unknown as { last_cursor: string }).last_cursor
  return val ?? null
}

async function selectBatch(
  db: Client,
  table: ExportTableConfig,
  cursor: string | null,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const where: string[] = []
  const args: unknown[] = []
  if (table.mode === 'incremental' && table.cursorCol && cursor) {
    where.push(`${table.cursorCol} > ?`)
    args.push(cursor)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const orderSql = table.mode === 'incremental' && table.cursorCol
    ? `ORDER BY ${table.cursorCol}`
    : ''
  const sql = `SELECT * FROM ${table.name} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`
  args.push(BATCH_SIZE, offset)
  const res = await db.execute({ sql, args: args as never })
  return res.rows.map(r => ({ ...r })) as Record<string, unknown>[]
}

function partitionValueOf(table: ExportTableConfig, row: Record<string, unknown>): string | null {
  if (!table.partitionBy) return null
  const v = row[table.partitionBy]
  return v == null ? '_null_' : String(v)
}

function maxCursor(table: ExportTableConfig, rows: Record<string, unknown>[]): string | null {
  if (!table.cursorCol || rows.length === 0) return null
  let max: string | null = null
  for (const r of rows) {
    const v = r[table.cursorCol] as string | undefined
    if (v && (!max || v > max)) max = v
  }
  return max
}

async function exportOne(
  db: Client,
  table: ExportTableConfig,
  env: Env,
  isoDate: string,
): Promise<ExportRunResult & { newCursor: string | null }> {
  const startedAt = Date.now()
  let totalRows = 0
  let totalBytes = 0
  let partitions = 0

  const cursor = table.mode === 'incremental' ? await getCursor(db, table.name) : null

  // Fetch ALL rows first, then group by partition. For snapshot + small tables
  // this is fine; for incrementals we only get the delta so volume is capped.
  // For a 100k+ observations table, this stays under 100 MiB of raw JS objects.
  const all: Record<string, unknown>[] = []
  let offset = 0
  // Safety cap: don't dump more than 1M rows per nightly run for a single table.
  // If you see this trip, add date-windowed chunking (re-run per-day slices).
  const SAFETY_CAP = 1_000_000
  for (;;) {
    const batch = await selectBatch(db, table, cursor, offset)
    if (batch.length === 0) break
    all.push(...batch)
    offset += batch.length
    if (all.length >= SAFETY_CAP) break
    if (batch.length < BATCH_SIZE) break
  }

  if (all.length === 0) {
    return {
      table: table.name,
      status: 'skipped',
      rows: 0,
      bytes: 0,
      ms: Date.now() - startedAt,
      partitions: 0,
      newCursor: null,
    }
  }

  // Group by partition key.
  const groups = new Map<string, Record<string, unknown>[]>()
  for (const row of all) {
    const pv = partitionValueOf(table, row) ?? '_all_'
    const bucket = groups.get(pv) ?? []
    bucket.push(row)
    groups.set(pv, bucket)
  }

  for (const [pv, rows] of groups) {
    const parts = splitIntoParts(rows, APPROX_BYTES_PER_ROW)
    for (let i = 0; i < parts.length; i++) {
      const bytes = await writeParquetBytes(parts[i])
      if (bytes.byteLength === 0) continue
      const key = partitionKey(
        env.ANALYTICS_R2_PREFIX,
        table,
        table.partitionBy ? pv : null,
        isoDate,
        i,
      )
      await env.ANALYTICS_R2.put(key, bytes, {
        httpMetadata: { contentType: 'application/vnd.apache.parquet' },
        customMetadata: {
          table: table.name,
          mode: table.mode,
          rows: String(parts[i].length),
          exportedAt: new Date().toISOString(),
        },
      })
      totalRows += parts[i].length
      totalBytes += bytes.byteLength
      partitions += 1
    }
  }

  return {
    table: table.name,
    status: 'ok',
    rows: totalRows,
    bytes: totalBytes,
    ms: Date.now() - startedAt,
    partitions,
    newCursor: maxCursor(table, all),
  }
}

/**
 * Run the full nightly export. Returns per-table results for logging.
 *
 * Cursor updates are NOT written from here — the analytics-worker has a
 * read-only Turso token. The main worker exposes a tiny admin endpoint
 * (`POST /api/admin/analytics-runs`) that we call from `src/index.ts`
 * after a successful run to persist cursor + runs rows. See runbook.
 */
export async function runNightlyExport(env: Env): Promise<{
  isoDate: string
  results: ExportRunResult[]
  cursorUpdates: { table: string; cursor: string }[]
}> {
  const isoDate = todayIso()
  const db = libsqlClient(env)
  const results: ExportRunResult[] = []
  const cursorUpdates: { table: string; cursor: string }[] = []

  for (const table of EXPORT_TABLES) {
    try {
      const r = await exportOne(db, table, env, isoDate)
      const { newCursor, ...publicResult } = r
      results.push(publicResult)
      if (newCursor && table.mode === 'incremental') {
        cursorUpdates.push({ table: table.name, cursor: newCursor })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[analytics-worker] export ${table.name} failed:`, msg)
      results.push({
        table: table.name,
        status: 'error',
        rows: 0,
        bytes: 0,
        ms: 0,
        partitions: 0,
        error: msg,
      })
    }
  }

  return { isoDate, results, cursorUpdates }
}
