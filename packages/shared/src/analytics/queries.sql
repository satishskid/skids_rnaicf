-- Phase 04 canonical analytics queries.
--
-- These run against the `publishable/` layer only — never the raw PHI
-- layer. The analytics-worker exposes them through a strict allow-list
-- at POST /run; new queries require a PR that lands both the SQL below
-- and the matching entry in packages/shared/src/analytics/queries.ts.
--
-- Conventions:
--   :param_name = bound parameter (never string-interpolated)
--   s3://bucket/publishable/<view>/**/*.parquet = stable read path
--   All queries are SELECT-only and deterministic.

-- =====================================================================
-- Q1 — Chip-vs-AI agreement heatmap (calibration).
--
-- For every module × age band, count observations where the clinician's
-- on-device chip result disagreed with the cloud AI suggestion, and
-- compute agreement ratio. The result feeds the `PopulationHealth`
-- calibration tile and the Phase 06 second-opinion trigger review.
--
-- Params:
--   :campaign_code (TEXT, optional — pass '%' for all campaigns)
--   :days_back     (INTEGER, default 30)
-- =====================================================================
SELECT
  obs.module_type,
  obs.age_months_band,
  COUNT(*)                                   AS total,
  SUM(CASE WHEN obs.clinician_disagreement = 1 THEN 1 ELSE 0 END) AS disagreements,
  1.0 - (CAST(SUM(CASE WHEN obs.clinician_disagreement = 1 THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*))
    AS agreement_ratio
FROM read_parquet('s3://{bucket}/publishable/publishable_observations/**/*.parquet', hive_partitioning=1) obs
WHERE (:campaign_code IS NULL OR obs.campaign_code LIKE :campaign_code)
  AND obs.created_at >= date_trunc('day', CURRENT_DATE - INTERVAL (:days_back) DAY)
GROUP BY 1, 2
ORDER BY 1, 2;

-- =====================================================================
-- Q2 — Daily AI spend by provider × module (cost dashboard).
--
-- Params:
--   :days_back (INTEGER, default 7)
-- =====================================================================
SELECT
  date_trunc('day', ai.created_at) AS day,
  ai.provider,
  ai.module_type,
  COUNT(*)                          AS calls,
  SUM(ai.input_tokens)              AS input_tokens,
  SUM(ai.output_tokens)             AS output_tokens,
  SUM(COALESCE(ai.cost_usd_micros, 0)) / 1e6 AS cost_usd_sum,
  AVG(ai.latency_ms)                AS avg_latency_ms,
  SUM(CASE WHEN ai.cached = 1 THEN 1 ELSE 0 END) AS cached_hits
FROM read_parquet('s3://{bucket}/publishable/publishable_ai_usage/**/*.parquet', hive_partitioning=1) ai
WHERE ai.created_at >= date_trunc('day', CURRENT_DATE - INTERVAL (:days_back) DAY)
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 6 DESC;

-- =====================================================================
-- Q3 — Red-flag prevalence by campaign × age band × gender.
--
-- "Red flag" = risk_level >= 2 on the observation. Used by the
-- population health tile.
--
-- Params:
--   :campaign_code (TEXT, optional — '%' for all)
-- =====================================================================
SELECT
  obs.campaign_code,
  obs.module_type,
  obs.age_months_band,
  obs.gender,
  COUNT(*)                                           AS total,
  SUM(CASE WHEN obs.risk_level >= 2 THEN 1 ELSE 0 END) AS red_flags,
  CAST(SUM(CASE WHEN obs.risk_level >= 2 THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*)
    AS red_flag_rate
FROM read_parquet('s3://{bucket}/publishable/publishable_observations/**/*.parquet', hive_partitioning=1) obs
WHERE (:campaign_code IS NULL OR obs.campaign_code LIKE :campaign_code)
GROUP BY 1, 2, 3, 4
HAVING COUNT(*) >= 10
ORDER BY red_flag_rate DESC, total DESC;

-- =====================================================================
-- Q4 — Screener throughput + P95 observation time per session.
--
-- Params:
--   :campaign_code (TEXT, optional — '%' for all)
--   :days_back     (INTEGER, default 7)
-- =====================================================================
WITH session_bounds AS (
  SELECT
    session_id,
    campaign_code,
    screened_by,
    date_trunc('day', MIN(created_at)) AS day,
    MIN(created_at) AS first_obs,
    MAX(created_at) AS last_obs,
    COUNT(*) AS obs_count
  FROM read_parquet('s3://{bucket}/publishable/publishable_observations/**/*.parquet', hive_partitioning=1)
  WHERE created_at >= date_trunc('day', CURRENT_DATE - INTERVAL (:days_back) DAY)
    AND (:campaign_code IS NULL OR campaign_code LIKE :campaign_code)
  GROUP BY 1, 2, 3
)
SELECT
  day,
  campaign_code,
  screened_by,
  COUNT(*) AS sessions,
  SUM(obs_count) AS total_obs,
  AVG(epoch(last_obs) - epoch(first_obs)) AS avg_session_seconds,
  quantile_cont(epoch(last_obs) - epoch(first_obs), 0.95) AS p95_session_seconds,
  SUM(obs_count) * 1.0 / NULLIF(SUM(epoch(last_obs) - epoch(first_obs)) / 60.0, 0)
    AS obs_per_minute
FROM session_bounds
GROUP BY 1, 2, 3
ORDER BY 1 DESC, total_obs DESC;

-- =====================================================================
-- Q5 — Time-to-doctor-review distribution (SLA).
--
-- Params:
--   :days_back (INTEGER, default 30)
-- =====================================================================
SELECT
  date_trunc('day', r.created_at) AS reviewed_day,
  r.decision,
  COUNT(*) AS reviews,
  AVG(r.ms_to_review / 1000.0 / 60.0) AS avg_minutes,
  quantile_cont(r.ms_to_review / 1000.0 / 60.0, 0.50) AS p50_minutes,
  quantile_cont(r.ms_to_review / 1000.0 / 60.0, 0.95) AS p95_minutes,
  quantile_cont(r.ms_to_review / 1000.0 / 60.0, 0.99) AS p99_minutes
FROM read_parquet('s3://{bucket}/publishable/publishable_reviews/**/*.parquet', hive_partitioning=1) r
WHERE r.created_at >= date_trunc('day', CURRENT_DATE - INTERVAL (:days_back) DAY)
  AND r.ms_to_review IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
