#!/usr/bin/env bash
# Phase 06 — publish a second-opinion ONNX model to the skids-models R2
# bucket and bump the manifest.
#
# Usage:
#   scripts/publish-model.sh <module> <version> <path-to-model.onnx>
#
# Example:
#   scripts/publish-model.sh vision v1.3 /tmp/vision_secondary_v1.3.onnx
#
# Uploads to:
#   r2://skids-models/second-opinion/<module>/<version>/model.onnx
#
# Also rewrites /second-opinion/manifest.json with the new version pinned.

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <module> <version> <path-to-model.onnx>" >&2
  exit 1
fi

MODULE=$1
VERSION=$2
MODEL_PATH=$3

if [[ ! -f "$MODEL_PATH" ]]; then
  echo "error: model file not found: $MODEL_PATH" >&2
  exit 1
fi

KEY="second-opinion/${MODULE}/${VERSION}/model.onnx"
BUCKET=skids-models

cd "$(dirname "$0")/../apps/worker"

echo "→ uploading $MODEL_PATH to r2://${BUCKET}/${KEY}"
pnpm exec wrangler r2 object put "${BUCKET}/${KEY}" --file="${MODEL_PATH}"

# Manifest rewrite — fetch current, patch this module/version, put back.
TMP_MANIFEST=$(mktemp)
trap 'rm -f "${TMP_MANIFEST}"' EXIT

if pnpm exec wrangler r2 object get "${BUCKET}/second-opinion/manifest.json" --file="${TMP_MANIFEST}" 2>/dev/null; then
  :
else
  echo '{"modules":{}}' > "${TMP_MANIFEST}"
fi

python3 - "$TMP_MANIFEST" "$MODULE" "$VERSION" "$KEY" <<'PY'
import json, sys
path, module, version, key = sys.argv[1:5]
with open(path) as f:
    manifest = json.load(f)
manifest.setdefault("modules", {})[module] = {"version": version, "key": key}
with open(path, "w") as f:
    json.dump(manifest, f, indent=2)
PY

pnpm exec wrangler r2 object put "${BUCKET}/second-opinion/manifest.json" --file="${TMP_MANIFEST}" --content-type="application/json"

echo "✓ published ${MODULE} ${VERSION}"
