#!/usr/bin/env bash
# Phase 04 — DuckDB REPL, attached to R2 via the httpfs extension.
#
# Usage:
#   export R2_ACCESS_KEY=...            # R2 access key with bucket read
#   export R2_SECRET=...                # matching secret
#   export R2_ENDPOINT=...              # e.g. https://<account>.r2.cloudflarestorage.com
#   export R2_BUCKET=skids-analytics    # optional, defaults to skids-analytics
#   ./scripts/duckdb-repl.sh
#
# Inside the REPL:
#   -- list partitions for one table
#   SELECT * FROM glob('s3://skids-analytics/v1/observations/**/*.parquet') LIMIT 10;
#
#   -- run a canonical query (see packages/shared/src/analytics/queries.sql)
#   .read packages/shared/src/analytics/queries.sql
#
#   -- or inspect the publishable layer directly
#   SELECT * FROM read_parquet(
#     's3://skids-analytics/publishable/publishable_observations/**/*.parquet',
#     hive_partitioning=1
#   ) LIMIT 20;
#
# PHI safety:
#   Analysts should be granted R2 credentials scoped to the `publishable/`
#   prefix only. The raw `v1/` prefix contains PHI (child names, DOBs). Do
#   NOT export those creds to laptops outside the clinical-ops group.

set -euo pipefail

: "${R2_ACCESS_KEY:?Set R2_ACCESS_KEY}"
: "${R2_SECRET:?Set R2_SECRET}"
: "${R2_ENDPOINT:?Set R2_ENDPOINT (https://<account>.r2.cloudflarestorage.com)}"
BUCKET="${R2_BUCKET:-skids-analytics}"

if ! command -v duckdb >/dev/null 2>&1; then
  echo "duckdb CLI not found. Install from https://duckdb.org/docs/installation" >&2
  exit 1
fi

# Build the bootstrap script. We print it to stderr so the operator can see
# what's being loaded, then pipe it into duckdb -init-less (-c '.read /dev/stdin').
BOOTSTRAP_SQL=$(cat <<SQL
INSTALL httpfs;
LOAD httpfs;
SET s3_endpoint='${R2_ENDPOINT#https://}';
SET s3_access_key_id='${R2_ACCESS_KEY}';
SET s3_secret_access_key='${R2_SECRET}';
SET s3_url_style='path';
SET s3_use_ssl=true;
.prompt 'skids> '
.echo on

-- Pre-check: list top-level prefixes visible to this session.
SELECT 'partitions visible (top 5):' AS note;
SELECT * FROM glob('s3://${BUCKET}/v1/*') LIMIT 5;
SQL
)

echo "[duckdb-repl] bucket=${BUCKET} endpoint=${R2_ENDPOINT}" >&2
echo "[duckdb-repl] launching DuckDB with httpfs pre-loaded..." >&2

# -interactive keeps the REPL after the bootstrap runs.
exec duckdb -cmd "$BOOTSTRAP_SQL" /tmp/skids-analytics.duckdb
