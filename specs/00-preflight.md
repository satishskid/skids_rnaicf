# Phase 0 — Preflight

**Goal**: Establish a known-good baseline. Verify build, typecheck, migrations, secrets, and region decisions before any new work.

**Prerequisites**: repo cloned, `pnpm install` succeeds, wrangler authenticated, Turso CLI authenticated.

**Effort**: half a day.

---

## Read first (do not skip)

Before writing anything, read these files to confirm current state:

- `package.json` (root) — pnpm workspace + turbo setup
- `apps/worker/wrangler.toml` — current bindings
- `apps/worker/src/index.ts` — Bindings type, route registrations
- `packages/db/src/schema.sql` — full schema (366 lines)
- `FEATURE_AUDIT.md` — what's considered working
- `SCREEN_SPEC.md` — verification contract
- `CREDENTIALS.md` — existing secrets catalog
- `MODULE_WIRING_VERIFICATION.md` — module flow status

If any referenced file is missing, STOP and raise an alert — the repo is not in the state this plan assumes.

---

## Deliverables

1. `docs/RESIDENCY.md` — data residency decisions table
2. `docs/SECRETS.md` — full secrets inventory (existing + planned)
3. `docs/RUNBOOK.md` — skeleton with sections for each phase (filled in later phases)
4. `specs/STATUS.md` — living checklist tracking phase completion
5. `scripts/preflight.sh` — idempotent verification script
6. A new branch `feat/edge-stack-v1` pushed to origin

No code changes in `apps/` or `packages/` during Phase 0. Docs and scripts only.

---

## Step-by-step

### 1. Branch + workspace

```bash
git checkout main && git pull
git checkout -b feat/edge-stack-v1
pnpm install
pnpm build
pnpm typecheck
```

All three must pass with zero errors. If any fail, fix before proceeding — do not silence.

### 2. Turso state check

```bash
turso db show skids-screen-v3
turso db shell skids-screen-v3 "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected tables include: `campaigns`, `children`, `observations`, `studies`, `consents`, `instruments`, `ai_usage`, `audit_log`, `campaign_assignments`, `report_tokens` (legacy parent-portal flow, camelCase cols), `report_access_tokens` (Phase 03 HMAC-signed flow, snake_case cols), `report_renders`, `sessions`. If `ai_usage` or `ai_config` is missing, note in `STATUS.md` — those tables are created on-demand by the worker routes, and that's fine.

Record the Turso primary region and replica regions in `docs/RESIDENCY.md`.

### 3. R2 state check

```bash
wrangler r2 bucket list
wrangler r2 bucket info skids-media
```

Record the jurisdiction/region in `docs/RESIDENCY.md`. If not India/APAC, note that this may need migration before Phase 3.

### 4. Wrangler bindings inventory

Parse `apps/worker/wrangler.toml` and list every binding that currently exists. Write this into `docs/RUNBOOK.md` under "Current bindings."

### 5. Secrets audit

```bash
wrangler secret list --name skids-api
```

Cross-reference output with the SECRETS.md template (below). Any present-but-undocumented secret goes into `docs/SECRETS.md`. Any documented-but-missing secret gets listed as "TO SET in Phase X."

### 6. Write docs/RESIDENCY.md

Template:

```markdown
# Data Residency Decisions

## Scope
SKIDS Screen processes PHI of Indian children under DPDP Act 2023.
All production data must remain within India/APAC.

## Service-by-service

| Service | Region | PHI? | Note |
|---|---|---|---|
| Turso primary | aws-ap-south-1 (Mumbai) | Yes | libSQL embedded replicas OK |
| Turso replicas | TBD | Yes | Only APAC |
| R2 | <from preflight> | Yes (media) | |
| Workers | edge (global) | Transient only | Never persist PHI in Worker memory across requests |
| Workers AI | inference region = request region | Transient | |
| AI Gateway | <pin in Phase 2> | Yes (prompts may contain PHI) | Gateway region must be APAC |
| Langfuse | <decide Phase 2> | Redacted only | Self-host in Mumbai OR redact PHI before send |
| MotherDuck | US (as of 2026-04) | NO | De-identified aggregates only, per-study gated |
| Vectorize | <pin Phase 7> | Evidence only, no PHI | |

## Review cadence
Re-review this doc on the 1st of each quarter or whenever a new binding is added.
```

### 7. Write docs/SECRETS.md

Template:

```markdown
# Secrets Inventory

**Worker**: `skids-api` (account 9f4998a66a5d7bd7a230d0222544fbe6)

| Name | Purpose | Set via | Present? | Added in |
|---|---|---|---|---|
| TURSO_URL | libSQL connection | wrangler secret | Y | V3.0 |
| TURSO_AUTH_TOKEN | libSQL auth | wrangler secret | Y | V3.0 |
| BETTER_AUTH_SECRET | Session signing | wrangler secret | Y | V3.0 |
| BETTER_AUTH_API_KEY | Admin API | wrangler secret | Y | V3.0 |
| GEMINI_API_KEY | Vision LLM fallback | wrangler secret | Y | V3.0 |
| CLOUDFLARE_R2_ACCESS_KEY_ID | R2 presigned URLs | wrangler secret | Y | V3.0 |
| CLOUDFLARE_R2_SECRET_ACCESS_KEY | R2 presigned URLs | wrangler secret | Y | V3.0 |
| CLOUDFLARE_R2_ENDPOINT | R2 S3 endpoint | wrangler secret | Y | V3.0 |
| CLOUDFLARE_R2_BUCKET | R2 bucket name | wrangler secret | Y | V3.0 |
| AYUSYNC_WEBHOOK_SECRET | Device webhook HMAC | wrangler secret | Y | V3.0 |
| LANGFUSE_SECRET_KEY | LLM tracing | wrangler secret | N | Phase 2 |
| LANGFUSE_PUBLIC_KEY | LLM tracing | wrangler secret | N | Phase 2 |
| LANGFUSE_BASE_URL | Self-hosted Langfuse URL | wrangler secret | N | Phase 2 |
| AI_GATEWAY_ACCOUNT_ID | CF AI Gateway | wrangler secret | N | Phase 2 |
| AI_GATEWAY_ID | CF AI Gateway id | wrangler secret | N | Phase 2 |
| SANDBOX_SIGNING_KEY | HMAC for PDF tokens | wrangler secret | N | Phase 3 |
| MOTHERDUCK_TOKEN | Research share | wrangler secret | N | Phase 8 (optional) |

## Rotation policy
- Secrets rotate every 90 days (enforced via calendar reminder; no auto-rotation).
- On rotation: `wrangler secret put <NAME>` then tail logs for 10 minutes to confirm.
```

### 8. Write docs/RUNBOOK.md skeleton

Sections to include (fill as phases land):
- Current bindings
- Deploy procedure
- Rollback procedure
- Incident: Turso outage
- Incident: Sandbox misbehaving
- Incident: AI Gateway cost spike
- Phase 1 runbook (placeholder)
- Phase 2 runbook (placeholder)
- ... through Phase 8

### 9. Write specs/STATUS.md

```markdown
# Edge-Stack V1 Status

| Phase | Spec | Status | Branch | PR | Deployed |
|---|---|---|---|---|---|
| 0 | 00-preflight | IN PROGRESS | feat/edge-stack-v1 | — | — |
| 1 | 01-turso-vectors | NOT STARTED | | | |
| 2 | 02-ai-gateway-langfuse | NOT STARTED | | | |
| 3 | 03-sandbox-pdf-reports | NOT STARTED | | | |
| 4 | 04-duckdb-analytics | NOT STARTED | | | |
| 5 | 05-workflows-queues | NOT STARTED | | | |
| 6 | 06-sandbox-second-opinion | NOT STARTED | | | |
| 7 | 07-vectorize-evidence-rag | NOT STARTED | | | |
| 8 | 08-motherduck-research | NOT STARTED | | | |
```

Update after every phase.

### 10. Write scripts/preflight.sh

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "== workspace =="
pnpm -v && node -v && pnpm install --frozen-lockfile
echo "== typecheck =="
pnpm typecheck
echo "== build =="
pnpm build
echo "== wrangler =="
cd apps/worker && npx wrangler deploy --dry-run --outdir=.preflight
echo "== turso =="
turso db show skids-screen-v3 >/dev/null
echo "OK"
```

Run it. Commit only if it exits 0.

### 11. Commit + push

```bash
git add docs/ specs/STATUS.md scripts/preflight.sh
git commit -m "chore(preflight): baseline residency, secrets, runbook, status"
git push -u origin feat/edge-stack-v1
```

---

## Acceptance criteria

- [ ] `scripts/preflight.sh` exits 0
- [ ] `docs/RESIDENCY.md` lists every service with a region
- [ ] `docs/SECRETS.md` matches `wrangler secret list` output exactly
- [ ] `specs/STATUS.md` exists with all 9 rows
- [ ] Branch `feat/edge-stack-v1` pushed
- [ ] `pnpm build && pnpm typecheck` green on the branch

## Rollback

Delete the branch. No runtime changes in this phase.

## Out of scope

- Any code changes in `apps/` or `packages/`
- Any wrangler.toml edits
- Any migration edits
