/**
 * De-identified publishable layer.
 *
 * DuckDB cannot run inside a Worker (WASM build is not bundled with
 * `parquetjs-lite` and we don't want that complexity in a hot path). So
 * we emit the SQL as a string here, and a companion job (GH Action or the
 * operator's laptop via `scripts/duckdb-repl.sh`) runs it to materialise
 * `r2://skids-analytics/publishable/<view>/dt=<today>/part-*.parquet`.
 *
 * The contract: given an iso date and R2 env bindings, DuckDB reads from
 * `v1/` (raw) and writes to `publishable/`. No PHI crosses into the
 * publishable layer.
 *
 * Key transformations:
 *   - children: drop `name`, `dob`, `phone`. Replace `dob` with
 *     `age_months_band` (0-11, 12-23, 24-35, 36-47, 48-59, 60-71, 72-119).
 *   - observations: join with children to attach age band, drop any free
 *     text that could contain PHI (`clinician_review`, `capture_metadata`).
 *   - consents: drop `signature_data_url`.
 *   - audit_log: keep counts only (`user_id` is hashed on the way in, but
 *     we drop `details` + `ip_address` to be safe).
 *   - ai_usage: pass-through (no PHI).
 */

export interface PublishableSqlContext {
  /** ISO date (YYYY-MM-DD) of the export run. */
  isoDate: string
  /** S3-style endpoint to R2, e.g. https://<account>.r2.cloudflarestorage.com */
  s3Endpoint: string
  /** R2 access key id (secret). */
  s3KeyId: string
  /** R2 secret. */
  s3Secret: string
  /** Bucket name. */
  bucket: string
  /** Raw prefix, defaults to 'v1'. */
  rawPrefix?: string
  /** Publishable prefix, defaults to 'publishable'. */
  publishablePrefix?: string
}

/**
 * Build the DuckDB SQL that materialises publishable views for one day.
 * This is printed by the cron handler and run by the companion job.
 */
export function buildPublishableSql(ctx: PublishableSqlContext): string {
  const rawPrefix = ctx.rawPrefix ?? 'v1'
  const pubPrefix = ctx.publishablePrefix ?? 'publishable'
  const bucket = ctx.bucket
  const dt = ctx.isoDate

  return `
INSTALL httpfs;
LOAD httpfs;
SET s3_endpoint='${ctx.s3Endpoint}';
SET s3_access_key_id='${ctx.s3KeyId}';
SET s3_secret_access_key='${ctx.s3Secret}';
SET s3_url_style='path';

-- 1) Publishable children: age_months_band instead of dob, no name/phone.
COPY (
  SELECT
    id,
    campaign_code,
    gender,
    CASE
      WHEN age_months < 12  THEN '0-11'
      WHEN age_months < 24  THEN '12-23'
      WHEN age_months < 36  THEN '24-35'
      WHEN age_months < 48  THEN '36-47'
      WHEN age_months < 60  THEN '48-59'
      WHEN age_months < 72  THEN '60-71'
      WHEN age_months < 120 THEN '72-119'
      ELSE '120+'
    END AS age_months_band,
    class,
    created_at
  FROM (
    SELECT
      id, campaign_code, gender, class, created_at,
      CAST((julianday(CURRENT_DATE) - julianday(dob)) / 30.4375 AS INTEGER) AS age_months
    FROM read_json_auto('s3://${bucket}/${rawPrefix}/children/**/*.jsonl', hive_partitioning=1)
  )
) TO 's3://${bucket}/${pubPrefix}/publishable_children/dt=${dt}/part-0001.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- 2) Publishable observations: join children-band, drop PHI-ish free text.
COPY (
  SELECT
    obs.id,
    obs.campaign_code,
    obs.session_id,
    obs.child_id,
    obs.module_type,
    obs.body_region,
    obs.risk_level,
    obs.ai_annotations,
    -- Derived: clinician_disagreement = 1 when the doctor referred/retook
    -- rather than approved. Computed from the JSON clinician_review blob
    -- since observations has no materialised disagreement column. Returns
    -- NULL when the observation has no review yet.
    CASE
      WHEN obs.clinician_review IS NULL THEN NULL
      WHEN json_extract(obs.clinician_review, '$.decision') IN ('"refer"', '"retake"', '"correct"') THEN 1
      ELSE 0
    END AS clinician_disagreement,
    obs.screened_by,
    obs.device_id,
    obs.created_at,
    c.age_months_band,
    c.gender
  FROM read_json_auto('s3://${bucket}/${rawPrefix}/observations/**/*.jsonl', hive_partitioning=1) obs
  LEFT JOIN read_parquet('s3://${bucket}/${pubPrefix}/publishable_children/dt=${dt}/*.parquet') c
    ON c.id = obs.child_id
) TO 's3://${bucket}/${pubPrefix}/publishable_observations/dt=${dt}/part-0001.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- 3) Publishable ai_usage: pass-through (no PHI).
COPY (
  SELECT
    id, campaign_code, model, provider, tier, module_type,
    input_tokens, output_tokens, latency_ms,
    cost_usd, cost_usd_micros, cached, created_at
  FROM read_json_auto('s3://${bucket}/${rawPrefix}/ai_usage/**/*.jsonl', hive_partitioning=1)
) TO 's3://${bucket}/${pubPrefix}/publishable_ai_usage/dt=${dt}/part-0001.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- 4) Publishable reviews: no PHI columns, keep latency metrics.
COPY (
  SELECT
    id, observation_id, reviewer_id,
    status, decision, ms_to_review, created_at
  FROM read_json_auto('s3://${bucket}/${rawPrefix}/reviews/**/*.jsonl', hive_partitioning=1)
) TO 's3://${bucket}/${pubPrefix}/publishable_reviews/dt=${dt}/part-0001.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);

-- 5) Publishable audit_log: keep action + timestamp only.
COPY (
  SELECT
    id,
    campaign_code,
    action,
    entity_type,
    created_at
  FROM read_json_auto('s3://${bucket}/${rawPrefix}/audit_log/**/*.jsonl', hive_partitioning=1)
) TO 's3://${bucket}/${pubPrefix}/publishable_audit_log/dt=${dt}/part-0001.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);
`.trim()
}

/** Default publishable views (names, for discoverability). */
export const PUBLISHABLE_VIEWS = [
  'publishable_children',
  'publishable_observations',
  'publishable_ai_usage',
  'publishable_reviews',
  'publishable_audit_log',
] as const
export type PublishableView = (typeof PUBLISHABLE_VIEWS)[number]
