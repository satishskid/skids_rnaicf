/**
 * Parquet writer for nightly Turso -> R2 dumps.
 *
 * We use `parquetjs-lite` — the only pure-JS Parquet writer that runs on
 * Workers with `nodejs_compat`. It streams rows to a writable, so we can
 * build a PassThrough and upload the final Buffer to R2 in one `put()`.
 *
 * Why not a proper streaming upload? R2 multipart upload requires >=5 MiB
 * parts, and most of our nightly partitions are well below that. Buffer +
 * single put() is correct and simpler. If a partition exceeds 50 MiB we'll
 * split into `part-0001`, `part-0002`, etc. (see writeParquetParts below).
 */

import type { ExportTableConfig } from './types'

// parquetjs-lite has no .d.ts bundled. Declare only what we use. This keeps
// the dependency optional at build time (dynamic import from export.ts) while
// still giving us types in this file.
interface ParquetSchemaCtor {
  new (fields: Record<string, { type: string; optional?: boolean }>): ParquetSchema
}
interface ParquetSchema { /* opaque */ }
interface MinimalWritable {
  write(chunk: Uint8Array, encoding?: string, cb?: (err?: Error) => void): boolean
  end(cb?: () => void): void
  on(event: string, cb: (...args: unknown[]) => void): unknown
  once(event: string, cb: (...args: unknown[]) => void): unknown
  emit(event: string, ...args: unknown[]): boolean
}
interface ParquetWriterStatic {
  openStream(schema: ParquetSchema, stream: MinimalWritable, opts?: unknown): Promise<ParquetWriter>
}
interface ParquetWriter {
  appendRow(row: Record<string, unknown>): Promise<void>
  close(): Promise<void>
}

type ParquetModule = {
  ParquetSchema: ParquetSchemaCtor
  ParquetWriter: ParquetWriterStatic
}

const PARTITION_SIZE_LIMIT_BYTES = 50 * 1024 * 1024 // 50 MiB

/**
 * Infer a parquetjs-lite schema from a single representative row.
 *
 * Types:
 *   - number    -> DOUBLE (safe default; INT64 would require us to know the
 *                  intended precision, which we don't for arbitrary columns)
 *   - string    -> UTF8
 *   - boolean   -> BOOLEAN
 *   - null      -> UTF8 optional (we don't know the real type from a null)
 *   - object    -> UTF8 (JSON.stringify at write time)
 *   - undefined -> skip
 *
 * All fields are `optional: true` because SQLite/libSQL permits NULL in
 * any column and we'd rather ship correct schema than over-constrain.
 */
export function inferSchema(pq: ParquetModule, representative: Record<string, unknown>) {
  const fields: Record<string, { type: string; optional?: boolean }> = {}
  for (const [col, val] of Object.entries(representative)) {
    if (val === undefined) continue
    if (val === null) {
      fields[col] = { type: 'UTF8', optional: true }
    } else if (typeof val === 'number') {
      fields[col] = { type: 'DOUBLE', optional: true }
    } else if (typeof val === 'boolean') {
      fields[col] = { type: 'BOOLEAN', optional: true }
    } else if (typeof val === 'string') {
      fields[col] = { type: 'UTF8', optional: true }
    } else {
      // object / array / bigint — stringify on write
      fields[col] = { type: 'UTF8', optional: true }
    }
  }
  return new pq.ParquetSchema(fields)
}

/** Normalise a row for parquetjs-lite: stringify objects, convert bigints. */
export function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined || v === null) {
      out[k] = null
    } else if (typeof v === 'bigint') {
      // DOUBLE is safe for <= 2^53; most of our IDs are strings so bigint is rare.
      out[k] = Number(v)
    } else if (typeof v === 'object') {
      out[k] = JSON.stringify(v)
    } else {
      out[k] = v
    }
  }
  return out
}

/** In-memory sink that parquetjs-lite writes to. */
class BufferSink {
  private chunks: Uint8Array[] = []
  private _bytes = 0

  // Looks like a Node writable for parquetjs-lite's purposes.
  // We keep the signature loose (`string` for encoding) to avoid pulling in
  // Node types; parquetjs-lite only calls write(chunk) with Buffer-ish data.
  write(chunk: Uint8Array, _encoding?: string, cb?: (err?: Error) => void): boolean {
    this.chunks.push(chunk)
    this._bytes += chunk.byteLength
    if (cb) cb()
    return true
  }
  end(cb?: () => void): void {
    if (cb) cb()
  }
  on(_event: string, _cb: (...args: unknown[]) => void): this { return this }
  once(_event: string, _cb: (...args: unknown[]) => void): this { return this }
  emit(_event: string, ..._args: unknown[]): boolean { return true }

  get bytes(): number { return this._bytes }
  toBuffer(): Uint8Array {
    const out = new Uint8Array(this._bytes)
    let off = 0
    for (const c of this.chunks) {
      out.set(c, off)
      off += c.byteLength
    }
    return out
  }
}

/**
 * Write a single partition's rows to Parquet bytes. Returns the buffer
 * for the caller to upload.
 *
 * 2026-04-17 — NDJSON INTERIM. parquetjs-lite does not run correctly
 * under CF Workers' nodejs_compat ("ParquetSchema is not a constructor"
 * / "Statistics is not defined"). The writer would need node:stream +
 * Buffer internals that the compat layer doesn't reliably expose for
 * this library. Rather than fight the JS Parquet writer, we emit NDJSON
 * from the Worker and let DuckDB convert to Parquet during the
 * publishable stage (`read_json_auto` → `COPY … TO … (FORMAT PARQUET)`).
 * Same R2 partition layout, same downstream contract — analysts using
 * duckdb-repl.sh get proper Parquet via the publishable layer.
 *
 * The function name + Uint8Array return type stay so callers don't
 * change. File extension at the R2 layer is `.jsonl`.
 */
export async function writeParquetBytes(
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<Uint8Array> {
  if (rows.length === 0) return new Uint8Array(0)
  const lines: string[] = []
  for (const row of rows) {
    lines.push(JSON.stringify(normaliseRow(row)))
  }
  return new TextEncoder().encode(lines.join('\n') + '\n')
}

/**
 * Split rows into N parts so no single Parquet file exceeds the size limit.
 *
 * We don't know the on-disk size until we've written; this is a cheap
 * upper-bound heuristic based on row count. For large tables the worker
 * should call writeParquetParts once per partition.
 */
export function splitIntoParts<T>(rows: readonly T[], approxBytesPerRow = 1024): T[][] {
  if (rows.length === 0) return []
  const rowsPerPart = Math.max(1, Math.floor(PARTITION_SIZE_LIMIT_BYTES / approxBytesPerRow))
  if (rows.length <= rowsPerPart) return [rows as T[]]
  const parts: T[][] = []
  for (let i = 0; i < rows.length; i += rowsPerPart) {
    parts.push(rows.slice(i, i + rowsPerPart) as T[])
  }
  return parts
}

/**
 * Build the R2 object key for a partition:
 *   <prefix>/<table>/[campaign=<code>/]dt=<YYYY-MM-DD>/part-NNNN.parquet
 * When partitionBy is null, the campaign segment is omitted.
 */
export function partitionKey(
  prefix: string,
  table: ExportTableConfig,
  partitionValue: string | null,
  isoDate: string,
  partIndex: number,
): string {
  const parts: string[] = [prefix, table.name]
  if (table.partitionBy && partitionValue) {
    parts.push(`${table.partitionBy}=${partitionValue}`)
  }
  parts.push(`dt=${isoDate}`)
  // NDJSON interim — see writeParquetBytes() comment. The publishable
  // layer (DuckDB) converts to real Parquet files in publishable/<view>/.
  parts.push(`part-${String(partIndex + 1).padStart(4, '0')}.jsonl`)
  return parts.join('/')
}
