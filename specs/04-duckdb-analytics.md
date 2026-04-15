# Phase 4 — DuckDB analytics pipeline

**Goal**: Nightly export Turso tables to partitioned Parquet on R2, expose a DuckDB-based analytics layer for research, cost, and calibration queries. First 5 canonical queries implemented.

**Prerequisites**: Phase 0 complete. Best after Phase 2 (so `ai_usage` has new columns).

**Effort**: 2 days.

---

## Read first

- `packages/shared/src/population-analytics.ts` and `cohort-analytics.ts` — existing shared analytics (TypeScript)
- `apps/worker/src/routes/export.ts` — current export behavior
- `packages/db/src/schema.sql` — tables to export
- `apps/web/src/pages/PopulationHealth.tsx` — one of the consumers
- `apps/web/src/pages/AuthorityDashboard.tsx` — another consumer

---

## Decisions

- **Exporter location**: new `apps/analytics-worker` — a separate Worker on a scheduled trigger so it doesn't share cold-start budget with the hot API
- **Format**: Parquet (zstd compression)
- **Layout**: `r2://skids-analytics/v1/<table>/campaign=<code>/dt=<YYYY-MM-DD>/part-0001.parquet`
- **Export strategy**: full snapshot daily for small tables, incremental (by `created_at > last_run`) for large (`observations`, `ai_usage`, `audit_log`)
- **Query layer**: DuckDB via Node/Bun CLI for local analyst use; a tiny `/api/analytics/query` (read-only, parameterized, allow-listed SQL templates only) for in-app dashboards
- **PHI**: raw exports contain PHI and live in a private R2 prefix. A separate job produces `r2://skids-analytics/publishable/` with de-identified views.
- **Cadence**: nightly 02:00 IST

---

## Deliverables

1. New package `apps/analytics-worker/` with wrangler.toml, src, package.json
2. `apps/analytics-worker/src/export.ts` — orchestrates the nightly dump
3. `apps/analytics-worker/src/tables.ts` — per-table export config
4. `apps/analytics-worker/src/parquet.ts` — Turso rows → Parquet writer (using `parquetjs-lite`)
5. New shared SQL module `packages/shared/src/analytics/queries.sql` — 5 canonical queries as DuckDB SQL
6. `apps/analytics-worker/src/publishable-views.sql` — de-identified views
7. New worker route `apps/worker/src/routes/analytics.ts` — parameterized query executor
8. CLI `scripts/duckdb-repl.sh` — launches DuckDB attached to R2 for analysts
9. `apps/web/src/pages/PopulationHealth.tsx` augment — use analytics endpoint for 1 tile (chip-vs-AI agreement heatmap)
10. Migration `0004_analytics_cursor.sql` — tracks last-run timestamp per table
11. Tests
12. Update `docs/RUNBOOK.md`

---

## Step-by-step

### 1. New analytics-worker scaffold

```
apps/analytics-worker/
  package.json
  wrangler.toml
  src/
    index.ts         (scheduled handler)
    export.ts
    tables.ts
    parquet.ts
    publishable.ts
  test/
```

wrangler.toml:
```toml
name = "skids-analytics"
main = "src/index.ts"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[triggers]
crons = ["30 20 * * *"]  # 02:00 IST = 20:30 UTC

[[r2_buckets]]
binding = "ANALYTICS_R2"
bucket_name = "skids-analytics"

# Turso read-only token
# wrangler secret put TURSO_READ_URL
# wrangler secret put TURSO_READ_AUTH_TOKEN
```

Create a Turso read-only auth token; store as `TURSO_READ_URL` and `TURSO_READ_AUTH_TOKEN` secrets. The analytics worker never uses the write token.

### 2. tables.ts

```typescript
export const EXPORT_TABLES = [
  { name: 'campaigns',        mode: 'snapshot',    partitionBy: null },
  { name: 'children',         mode: 'snapshot',    partitionBy: 'campaign_code' },
  { name: 'observations',     mode: 'incremental', partitionBy: 'campaign_code', cursorCol: 'created_at' },
  { name: 'ai_usage',         mode: 'incremental', partitionBy: null,            cursorCol: 'created_at' },
  { name: 'audit_log',        mode: 'incremental', partitionBy: null,            cursorCol: 'created_at' },
  { name: 'report_renders',   mode: 'incremental', partitionBy: null,            cursorCol: 'created_at' },
  { name: 'studies',          mode: 'snapshot',    partitionBy: null },
  { name: 'consents',         mode: 'snapshot',    partitionBy: null },
  { name: 'campaign_progress',mode: 'snapshot',    partitionBy: 'campaign_code' },
] as const
```

### 3. export.ts

For each table:
- Read `analytics_cursor` (migration 0004) to get last timestamp
- SELECT with WHERE cursor > last (or no WHERE for snapshot)
- Stream rows in batches of 10k to Parquet writer
- Partition per config
- Write `r2://skids-analytics/v1/<table>/campaign=<X>/dt=<today>/part-NNNN.parquet`
- On success: upsert cursor row

Log each export: `{ table, rows, bytes, ms, partitions }` to ai_usage-style ledger (create `analytics_runs` table in migration).

### 4. publishable.ts

After raw export completes, run DuckDB in-process to build publishable views:

```sql
-- publishable_observations: drop name/dob/phone; convert DOB → age_months_band
CREATE OR REPLACE VIEW publishable_observations AS
SELECT
  obs.id,
  obs.campaign_code,
  children_band(c.dob, obs.timestamp) AS age_months_band,
  c.gender,
  obs.module_type, obs.body_region, obs.risk_level,
  obs.ai_annotations, obs.timestamp
FROM read_parquet('r2://skids-analytics/v1/observations/**/*.parquet', hive_partitioning=1) obs
JOIN read_parquet('r2://skids-analytics/v1/children/**/*.parquet', hive_partitioning=1) c ON c.id = obs.child_id;
```

Materialize to `r2://skids-analytics/publishable/<view>/dt=<today>/part-*.parquet`.

### 5. Canonical queries (packages/shared/src/analytics/queries.sql)

Ship exactly 5, each with comments:

```sql
-- Q1: chip-vs-AI agreement by module × age band (the calibration heatmap)
-- Q2: daily AI spend by provider × module (cost dashboard)
-- Q3: red-flag prevalence by campaign, age band, gender (population health)
-- Q4: screener throughput + p95 observation time per session (ops)
-- Q5: time-to-doctor-review distribution (SLA)
```

Each query is DuckDB SQL that references the publishable views.

### 6. Worker API for dashboards

`apps/worker/src/routes/analytics.ts`:

```typescript
// POST /api/analytics/run
// body: { queryId: 'Q1'|'Q2'|...|'Q5', params: {...} }
// Only allow-listed queries. Parameters are bound, never interpolated.
// Executes via a DuckDB binding (see Note below) OR via analytics-worker fetch
```

Note: Workers don't embed DuckDB. Two options:
- **Option A (recommended)**: analytics-worker exposes `/run` internally; main worker calls via service binding. Keep DuckDB out of the hot worker.
- **Option B**: use MotherDuck later (Phase 8) as the execution engine.

For Phase 4 pick Option A. Add service binding:
```toml
[[services]]
binding = "ANALYTICS_SVC"
service = "skids-analytics"
```

### 7. CLI REPL

`scripts/duckdb-repl.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${R2_ACCESS_KEY:?}" "${R2_SECRET:?}" "${R2_ENDPOINT:?}"
duckdb -c "
INSTALL httpfs; LOAD httpfs;
SET s3_endpoint='${R2_ENDPOINT}';
SET s3_access_key_id='${R2_ACCESS_KEY}';
SET s3_secret_access_key='${R2_SECRET}';
.open /tmp/skids-analytics.duckdb
" -interactive
```

Ship a README in `scripts/` explaining how analysts query.

### 8. Web augment

`apps/web/src/pages/PopulationHealth.tsx`:
- Replace one existing tile with a call to `POST /api/analytics/run { queryId: 'Q3' }`
- Display as a recharts heatmap
- Keep the old TS-computed tiles as-is — only migrate one this phase to prove the pattern

### 9. Migration

`0004_analytics_cursor.sql`:
```sql
CREATE TABLE IF NOT EXISTS analytics_cursor (
  table_name TEXT PRIMARY KEY,
  last_cursor TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS analytics_runs (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  rows INTEGER, bytes INTEGER, ms INTEGER,
  partitions INTEGER,
  status TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 10. Tests

- Seed a test Turso with 100 observations across 3 campaigns
- Run export → assert 3 partitions exist in R2
- Run twice → second run processes only new rows
- Run each of Q1–Q5 → assert shape of result

### 11. Runbook

- Nightly schedule, where logs land, how to re-run a day
- How to add a new canonical query (PR checklist: parameterized, tested, documented)
- How to grant analyst R2 read access

---

## Acceptance criteria

- [ ] Nightly cron runs and produces Parquet for all 9 tables
- [ ] Incremental tables do NOT re-export historical rows
- [ ] All 5 canonical queries execute on the publishable layer in < 10s on a seeded 10k-observation dataset
- [ ] PopulationHealth page's migrated tile renders real DuckDB data
- [ ] `scripts/duckdb-repl.sh` launches and can list partitions
- [ ] No PHI in `publishable/` prefix (verified by grep + manual review of 3 files)
- [ ] Tests green

## Rollback

Disable the cron in wrangler.toml. Analytics worker is self-contained — no impact on hot API. Delete R2 prefix if desired.

## Out of scope

- MotherDuck integration (Phase 8)
- Real-time analytics (explicitly day-fresh)
- Parent-facing analytics (privacy implications, separate epic)
