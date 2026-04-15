#!/usr/bin/env bash
#
# SKIDS Screen V3 — Preflight verification (Phase 00)
#
# Usage:
#   bash scripts/preflight.sh
#
# Environment:
#   SKIP_DEPLOY_DRYRUN=1   # skip wrangler deploy --dry-run (CI without CF creds)
#   SKIP_BUILD=1           # skip pnpm build (fast local re-runs)

set -euo pipefail

GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; NC="\033[0m"
pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
step() { echo; echo "── $1 ──"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step "1. Git branch"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
case "$BRANCH" in
  feat/edge-stack-v1*|phase/*) pass "on $BRANCH" ;;
  *) warn "not on an edge-stack branch (current: $BRANCH) — phase PRs must target feat/edge-stack-v1" ;;
esac

step "2. Required planning files"
for f in MASTER_PLAN.md CLAUDE_CODE_PROMPT.md specs/STATUS.md docs/RESIDENCY.md docs/SECRETS.md docs/RUNBOOK.md; do
  [[ -f "$f" ]] && pass "$f" || fail "missing: $f"
done

step "3. Spec files (00–08)"
for n in 00 01 02 03 04 05 06 07 08; do
  match=$(ls specs/${n}-*.md 2>/dev/null | head -1 || true)
  [[ -n "$match" ]] && pass "$match" || fail "missing spec: specs/${n}-*.md"
done

step "4. pnpm"
command -v pnpm >/dev/null || fail "pnpm not installed (need pnpm 10.29+)"
pass "pnpm $(pnpm --version)"

step "5. Dependencies"
if [[ ! -d node_modules ]]; then
  warn "node_modules missing — running pnpm install"
  pnpm install --frozen-lockfile
fi
pass "dependencies present"

step "6. Typecheck"
pnpm typecheck
pass "pnpm typecheck"

step "7. Build"
if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  warn "SKIP_BUILD=1"
else
  pnpm build
  pass "pnpm build"
fi

step "8. Worker dry-run deploy"
if [[ "${SKIP_DEPLOY_DRYRUN:-0}" == "1" ]]; then
  warn "SKIP_DEPLOY_DRYRUN=1"
else
  if pnpm --filter @skids/worker exec wrangler deploy --dry-run >/tmp/skids-dryrun.log 2>&1; then
    pass "wrangler dry-run"
  else
    tail -30 /tmp/skids-dryrun.log
    fail "wrangler dry-run failed (see above) — set SKIP_DEPLOY_DRYRUN=1 to bypass in CI without CF creds"
  fi
fi

step "9. Schema invariants"
grep -q "embedding F32_BLOB(384)" packages/db/src/schema.sql || fail "schema.sql missing reserved F32_BLOB(384) line"
pass "F32_BLOB(384) reserved in schema.sql"

step "10. Audit-log route"
[[ -f apps/worker/src/routes/audit-log.ts ]] || fail "apps/worker/src/routes/audit-log.ts missing — audit log is sacred"
pass "audit-log route present"

echo
echo -e "${GREEN}All preflight checks passed.${NC}"
