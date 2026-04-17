#!/usr/bin/env bash
# Phase 02a-web — publish a Liquid AI (or drop-in MLC-LLM) model to R2
# + emit the MODEL_MANIFEST TypeScript literal.
#
# Prerequisites:
#   - wrangler authenticated (cd apps/worker && pnpm exec wrangler whoami)
#   - the R2 bucket `skids-models` exists (it does — see apps/worker/wrangler.toml)
#   - a local directory containing every MLC shard for the target model
#
# Usage:
#   scripts/publish-liquid-ai.sh \
#     --model-id "liquid-ai/LFM2.5-VL-450M" \
#     --version "v1.0.0-2026-05-01" \
#     --quantization "q4f16_1" \
#     --source-dir "/tmp/lfm-25-vl-450m-q4f16_1-MLC"
#
# On success prints the `MODEL_MANIFEST` TS literal to stdout. Paste it into
# packages/shared/src/ai/model-manifest.ts and PR.
#
# The script is intentionally defensive — it verifies each upload by
# re-fetching and re-hashing. If anything fails, fix the cause and re-run;
# the upload is idempotent (wrangler r2 object put overwrites).

set -euo pipefail

MODEL_ID=""
VERSION=""
QUANT=""
SRC_DIR=""
BUCKET="skids-models"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model-id) MODEL_ID="$2"; shift 2;;
    --version) VERSION="$2"; shift 2;;
    --quantization) QUANT="$2"; shift 2;;
    --source-dir) SRC_DIR="$2"; shift 2;;
    --bucket) BUCKET="$2"; shift 2;;
    *) echo "unknown flag: $1" >&2; exit 1;;
  esac
done

if [[ -z "$MODEL_ID" || -z "$VERSION" || -z "$QUANT" || -z "$SRC_DIR" ]]; then
  echo "usage: $0 --model-id <id> --version <v> --quantization <q> --source-dir <path>" >&2
  exit 1
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo "error: source directory not found: $SRC_DIR" >&2
  exit 1
fi

if [[ ! -f "$SRC_DIR/mlc-chat-config.json" ]]; then
  echo "error: $SRC_DIR/mlc-chat-config.json missing — this does not look like an MLC shard directory" >&2
  echo "       expected layout: mlc-chat-config.json, ndarray-cache.json, tokenizer.json, params_shard_*.bin" >&2
  exit 1
fi

cd "$(dirname "$0")/../apps/worker"

echo "→ target: r2://${BUCKET}/models/${MODEL_ID}/${VERSION}/"
echo "→ quant:  ${QUANT}"
echo "→ source: ${SRC_DIR}"
echo

# Collect every file in the source directory — recurse but keep only files
# (skip macOS .DS_Store + any nested subdirs the shard set doesn't use).
mapfile -t SHARDS < <(cd "$SRC_DIR" && find . -type f ! -name '.DS_Store' | sed 's|^\./||' | sort)

if [[ ${#SHARDS[@]} -eq 0 ]]; then
  echo "error: no files found in $SRC_DIR" >&2
  exit 1
fi

echo "Found ${#SHARDS[@]} shards to publish:"
for s in "${SHARDS[@]}"; do echo "  - $s"; done
echo

# For each shard: compute sha256, upload, verify, accumulate manifest entry.
TOTAL_BYTES=0
MANIFEST_ROWS=""

for SHARD in "${SHARDS[@]}"; do
  LOCAL_PATH="${SRC_DIR}/${SHARD}"
  REMOTE_KEY="models/${MODEL_ID}/${VERSION}/${SHARD}"

  SIZE=$(wc -c < "$LOCAL_PATH" | tr -d ' ')
  SHA=$(shasum -a 256 "$LOCAL_PATH" | awk '{print $1}')

  echo "→ ${SHARD}"
  echo "  size:   ${SIZE} bytes"
  echo "  sha256: ${SHA}"

  pnpm exec wrangler r2 object put "${BUCKET}/${REMOTE_KEY}" \
    --file="$LOCAL_PATH" \
    --content-type="application/octet-stream" >/dev/null

  # Verify: re-fetch + re-hash.
  TMP=$(mktemp)
  trap 'rm -f "$TMP"' EXIT
  pnpm exec wrangler r2 object get "${BUCKET}/${REMOTE_KEY}" --file="$TMP" >/dev/null
  REMOTE_SHA=$(shasum -a 256 "$TMP" | awk '{print $1}')
  rm -f "$TMP"
  trap - EXIT

  if [[ "$SHA" != "$REMOTE_SHA" ]]; then
    echo "  ✗ sha256 mismatch after upload — local=$SHA remote=$REMOTE_SHA" >&2
    exit 2
  fi
  echo "  ✓ verified"

  TOTAL_BYTES=$(( TOTAL_BYTES + SIZE ))
  MANIFEST_ROWS+="    { name: '${SHARD}', sha256: '${SHA}', sizeBytes: ${SIZE} },"$'\n'
done

echo
echo "================================================================"
echo "Upload complete. Paste the manifest below into:"
echo "  packages/shared/src/ai/model-manifest.ts"
echo "================================================================"
echo
cat <<EOF
export const MODEL_MANIFEST: ModelManifest = {
  id: '${MODEL_ID}',
  quantization: '${QUANT}',
  version: '${VERSION}',
  totalSizeBytes: ${TOTAL_BYTES},
  shards: [
${MANIFEST_ROWS%$'\n'}
  ],
} as const
EOF
echo
echo "After pasting:"
echo "  1. pnpm --filter @skids/shared typecheck"
echo "  2. Commit with clinical + tech review"
echo "  3. Smoke: curl https://<staging>.workers.dev/api/models/${MODEL_ID}/${VERSION}/mlc-chat-config.json"
