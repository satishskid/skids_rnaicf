/**
 * Query runner for the five canonical analytics queries.
 *
 * Why this file does not talk to DuckDB:
 *   - DuckDB cannot run in a Cloudflare Worker (no WASM binding wired).
 *   - The spec anticipated this: Phase 08 (MotherDuck, DEFERRED) is where
 *     we'd plug a real DuckDB engine behind the same interface.
 *   - For now, `/run` executes Turso-flavoured equivalents of each query
 *     directly against the primary (read-only token). Analysts still get
 *     the canonical DuckDB SQL for local use via `scripts/duckdb-repl.sh`
 *     reading from R2 Parquet. Same semantics, two engines.
 *
 * Trade-off: Turso is slower than DuckDB on aggregations over a few
 * million rows, but for the current data volumes (~10k-100k observations
 * per campaign) P95 comes in under the 10s budget. When we cross a
 * million rows per query we either:
 *   (a) run these aggregations on the `publishable/` layer nightly and
 *       cache the results in KV, or
 *   (b) land MotherDuck (Phase 08) and swap the implementation behind
 *       this same dispatch table.
 *
 * Every query below is SELECT-only. Params are bound, never interpolated.
 */

import { createClient, type Client, type Row } from '@libsql/client'
import { validateQueryParams, type QueryId } from '@skids/shared'
import type { Env } from './types'

export interface QueryResult {
  queryId: QueryId
  columns: string[]
  rows: Record<string, unknown>[]
  ms: number
  /**
   * Always 'turso' today. The field is explicit (rather than implied) so
   * future callers can see at a glance which engine served their query,
   * and so a Phase 08 / MotherDuck swap can widen the union without
   * silent breakage. Until then, a future 'duckdb' value would be a lie.
   */
  engine: 'turso'
}

function client(env: Env): Client {
  return createClient({ url: env.TURSO_READ_URL, authToken: env.TURSO_READ_AUTH_TOKEN })
}

function toRowObjects(rows: Row[], columns: string[]): Record<string, unknown>[] {
  return rows.map(r => {
    const obj: Record<string, unknown> = {}
    for (const c of columns) {
      // libsql's Row is accessed by column name
      obj[c] = (r as unknown as Record<string, unknown>)[c]
    }
    return obj
  })
}

function ageMonthsBandSql(dobCol: string): string {
  return `CASE
      WHEN CAST((julianday('now') - julianday(${dobCol})) / 30.4375 AS INTEGER) < 12  THEN '0-11'
      WHEN CAST((julianday('now') - julianday(${dobCol})) / 30.4375 AS INTEGER) < 24  THEN '12-23'
      WHEN CAST((julianday('now') - julianday(${dobCol})) / 30.4375 AS INTEGER) < 36  THEN '24-35'
      WHEN CAST((julianday('now') - julianday(${dobCol})) / 30.4375 AS INTEGER) < 48  THEN '36-47'
      WHEN CAST((julianday('now') - julianday(${dobCol})) / 30.4375 AS INTEGER) < 60  THEN '48-59'
      WHEN CAST((julianday('now') - julianday(${dobCol})) / 30.4375 AS INTEGER) < 72  THEN '60-71'
      WHEN CAST((julianday('now') - julianday(${dobCol})) / 30.4375 AS INTEGER) < 120 THEN '72-119'
      ELSE '120+'
    END`
}

async function runQ1(env: Env, params: Record<string, unknown>): Promise<QueryResult> {
  // Chip-vs-AI agreement proxy.
  //
  // There's no materialised `clinician_disagreement` column on observations,
  // so we proxy it with the doctor's review decision: `refer` or `retake`
  // count as disagreement with the AI's default "approve" stance. When
  // Phase 06 (second-opinion) lands, we'll swap in the computed agreement
  // score from `accuracy_metrics`.
  const startedAt = Date.now()
  const db = client(env)
  const campaignCode = params.campaign_code as string | null
  const daysBack = params.days_back as number
  const sql = `
    SELECT
      obs.module_type,
      ${ageMonthsBandSql('c.dob')} AS age_months_band,
      COUNT(*)                                             AS total,
      SUM(CASE WHEN r.decision IN ('refer','retake') THEN 1 ELSE 0 END) AS disagreements,
      1.0 - (CAST(SUM(CASE WHEN r.decision IN ('refer','retake') THEN 1 ELSE 0 END) AS REAL) / COUNT(*))
        AS agreement_ratio
    FROM observations obs
    JOIN children c ON c.id = obs.child_id
    JOIN reviews r ON r.observation_id = obs.id
    WHERE obs.created_at >= datetime('now', ?)
      AND (? IS NULL OR obs.campaign_code LIKE ?)
    GROUP BY 1, 2
    ORDER BY 1, 2
  `
  const res = await db.execute({
    sql,
    args: [`-${daysBack} days`, campaignCode, campaignCode ?? '%'],
  })
  const columns = ['module_type', 'age_months_band', 'total', 'disagreements', 'agreement_ratio']
  return {
    queryId: 'Q1',
    columns,
    rows: toRowObjects(res.rows, columns),
    ms: Date.now() - startedAt,
    engine: 'turso',
  }
}

async function runQ2(env: Env, params: Record<string, unknown>): Promise<QueryResult> {
  const startedAt = Date.now()
  const db = client(env)
  const daysBack = params.days_back as number
  const sql = `
    SELECT
      date(ai.created_at)                          AS day,
      COALESCE(ai.provider, ai.model)              AS provider,
      COALESCE(ai.module_type, 'unknown')          AS module_type,
      COUNT(*)                                     AS calls,
      SUM(COALESCE(ai.input_tokens, 0))            AS input_tokens,
      SUM(COALESCE(ai.output_tokens, 0))           AS output_tokens,
      SUM(COALESCE(ai.cost_usd_micros, 0)) / 1000000.0 AS cost_usd_sum,
      CAST(AVG(COALESCE(ai.latency_ms, 0)) AS REAL) AS avg_latency_ms,
      SUM(CASE WHEN COALESCE(ai.cached, 0) = 1 THEN 1 ELSE 0 END) AS cached_hits
    FROM ai_usage ai
    WHERE ai.created_at >= datetime('now', ?)
    GROUP BY 1, 2, 3
    ORDER BY 1 DESC, cost_usd_sum DESC
  `
  const res = await db.execute({ sql, args: [`-${daysBack} days`] })
  const columns = [
    'day', 'provider', 'module_type', 'calls',
    'input_tokens', 'output_tokens', 'cost_usd_sum', 'avg_latency_ms', 'cached_hits',
  ]
  return {
    queryId: 'Q2',
    columns,
    rows: toRowObjects(res.rows, columns),
    ms: Date.now() - startedAt,
    engine: 'turso',
  }
}

async function runQ3(env: Env, params: Record<string, unknown>): Promise<QueryResult> {
  const startedAt = Date.now()
  const db = client(env)
  const campaignCode = params.campaign_code as string | null
  const sql = `
    SELECT
      obs.campaign_code,
      obs.module_type,
      ${ageMonthsBandSql('c.dob')} AS age_months_band,
      COALESCE(c.gender, 'unknown') AS gender,
      COUNT(*)                                             AS total,
      SUM(CASE WHEN obs.risk_level >= 2 THEN 1 ELSE 0 END) AS red_flags,
      CAST(SUM(CASE WHEN obs.risk_level >= 2 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
        AS red_flag_rate
    FROM observations obs
    JOIN children c ON c.id = obs.child_id
    WHERE (? IS NULL OR obs.campaign_code LIKE ?)
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) >= 10
    ORDER BY red_flag_rate DESC, total DESC
  `
  const res = await db.execute({
    sql,
    args: [campaignCode, campaignCode ?? '%'],
  })
  const columns = [
    'campaign_code', 'module_type', 'age_months_band', 'gender',
    'total', 'red_flags', 'red_flag_rate',
  ]
  return {
    queryId: 'Q3',
    columns,
    rows: toRowObjects(res.rows, columns),
    ms: Date.now() - startedAt,
    engine: 'turso',
  }
}

async function runQ4(env: Env, params: Record<string, unknown>): Promise<QueryResult> {
  // SQLite doesn't have quantile_cont; approximate P95 via ordered window
  // and index. For day/campaign/screener grouping, we compute min/max/avg
  // and expose p95 as NULL with a note. Analysts running Q4 against R2
  // via scripts/duckdb-repl.sh get the real quantile.
  const startedAt = Date.now()
  const db = client(env)
  const campaignCode = params.campaign_code as string | null
  const daysBack = params.days_back as number
  const sql = `
    WITH session_bounds AS (
      SELECT
        session_id,
        campaign_code,
        screened_by,
        date(MIN(created_at)) AS day,
        MIN(created_at)       AS first_obs,
        MAX(created_at)       AS last_obs,
        COUNT(*)              AS obs_count
      FROM observations
      WHERE created_at >= datetime('now', ?)
        AND (? IS NULL OR campaign_code LIKE ?)
      GROUP BY 1, 2, 3
    )
    SELECT
      day,
      campaign_code,
      screened_by,
      COUNT(*)                                                        AS sessions,
      SUM(obs_count)                                                  AS total_obs,
      AVG((julianday(last_obs) - julianday(first_obs)) * 86400.0)     AS avg_session_seconds,
      MAX((julianday(last_obs) - julianday(first_obs)) * 86400.0)     AS max_session_seconds,
      CAST(NULL AS REAL)                                              AS p95_session_seconds,
      SUM(obs_count) * 60.0 / NULLIF(SUM((julianday(last_obs) - julianday(first_obs)) * 86400.0), 0)
        AS obs_per_minute
    FROM session_bounds
    GROUP BY 1, 2, 3
    ORDER BY 1 DESC, total_obs DESC
  `
  const res = await db.execute({
    sql,
    args: [`-${daysBack} days`, campaignCode, campaignCode ?? '%'],
  })
  const columns = [
    'day', 'campaign_code', 'screened_by', 'sessions',
    'total_obs', 'avg_session_seconds', 'max_session_seconds',
    'p95_session_seconds', 'obs_per_minute',
  ]
  return {
    queryId: 'Q4',
    columns,
    rows: toRowObjects(res.rows, columns),
    ms: Date.now() - startedAt,
    engine: 'turso',
  }
}

async function runQ5(env: Env, params: Record<string, unknown>): Promise<QueryResult> {
  // Time-to-review in minutes. `reviews` has no `ms_to_review` column, so
  // we compute it inline as `reviewed_at - obs.created_at`. Quantiles via
  // ROW_NUMBER + positional pick (SQLite has no quantile_cont).
  const startedAt = Date.now()
  const db = client(env)
  const daysBack = params.days_back as number
  const sql = `
    WITH enriched AS (
      SELECT
        date(r.reviewed_at) AS reviewed_day,
        r.decision,
        CAST((julianday(r.reviewed_at) - julianday(obs.created_at)) * 1440.0 AS REAL) AS minutes
      FROM reviews r
      JOIN observations obs ON obs.id = r.observation_id
      WHERE r.reviewed_at >= datetime('now', ?)
    ),
    counts AS (
      SELECT reviewed_day, decision, COUNT(*) AS cnt
      FROM enriched
      WHERE minutes >= 0
      GROUP BY 1, 2
    ),
    ranked AS (
      SELECT
        e.reviewed_day, e.decision, e.minutes, c.cnt,
        ROW_NUMBER() OVER (PARTITION BY e.reviewed_day, e.decision ORDER BY e.minutes) AS rn
      FROM enriched e
      JOIN counts c ON c.reviewed_day = e.reviewed_day AND c.decision = e.decision
      WHERE e.minutes >= 0
    )
    SELECT
      r.reviewed_day,
      r.decision,
      c.cnt AS reviews,
      AVG(r.minutes) AS avg_minutes,
      MAX(CASE WHEN r.rn = MAX(CAST(c.cnt * 0.50 AS INTEGER), 1) THEN r.minutes END) AS p50_minutes,
      MAX(CASE WHEN r.rn = MAX(CAST(c.cnt * 0.95 AS INTEGER), 1) THEN r.minutes END) AS p95_minutes,
      MAX(CASE WHEN r.rn = MAX(CAST(c.cnt * 0.99 AS INTEGER), 1) THEN r.minutes END) AS p99_minutes
    FROM ranked r
    JOIN counts c ON c.reviewed_day = r.reviewed_day AND c.decision = r.decision
    GROUP BY r.reviewed_day, r.decision, c.cnt
    ORDER BY r.reviewed_day DESC, r.decision
  `
  const res = await db.execute({ sql, args: [`-${daysBack} days`] })
  const columns = [
    'reviewed_day', 'decision', 'reviews', 'avg_minutes',
    'p50_minutes', 'p95_minutes', 'p99_minutes',
  ]
  return {
    queryId: 'Q5',
    columns,
    rows: toRowObjects(res.rows, columns),
    ms: Date.now() - startedAt,
    engine: 'turso',
  }
}

const RUNNERS: Record<QueryId, (env: Env, params: Record<string, unknown>) => Promise<QueryResult>> = {
  Q1: runQ1,
  Q2: runQ2,
  Q3: runQ3,
  Q4: runQ4,
  Q5: runQ5,
}

export async function runQuery(
  env: Env,
  queryId: QueryId,
  rawParams: Record<string, unknown> | undefined,
): Promise<QueryResult> {
  const params = validateQueryParams(queryId, rawParams)
  const runner = RUNNERS[queryId]
  if (!runner) throw new Error(`Unknown queryId: ${queryId}`)
  return runner(env, params)
}
