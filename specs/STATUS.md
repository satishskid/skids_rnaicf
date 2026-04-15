# SKIDS Edge-Stack v1 — Phase Status

Single source of truth for phase progress. Every phase spec requires this file to be updated on completion. Claude Code MUST check this file before starting a phase to confirm prerequisites are DONE.

| Phase | Spec | Status | Owner | PR | Merged |
|---|---|---|---|---|---|
| 00 | `specs/00-preflight.md` | DONE | planner-agent | #2 | 2026-04-15 |
| 01 | `specs/01-turso-vectors.md` | DONE | planner-agent | #3 | 2026-04-15 |
| 02 | `specs/02-ai-gateway-langfuse.md` | DONE | claude-code | #4 | 2026-04-15 |
| 02a | `specs/02a-liquid-ai-on-device.md` | TODO | planner-agent | — | — |
| 03 | `specs/03-sandbox-pdf-reports.md` | TODO | — | — | — |
| 04 | `specs/04-duckdb-analytics.md` | TODO | — | — | — |
| 05 | `specs/05-workflows-queues.md` | TODO | — | — | — |
| 06 | `specs/06-sandbox-second-opinion.md` | TODO | — | — | — |
| 07 | `specs/07-vectorize-evidence-rag.md` | TODO | — | — | — |
| 08 | `specs/08-motherduck-research.md` | DEFERRED | — | — | — |

Legend: `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE` (or `DEFERRED` / `BLOCKED` / `PARKED`).

## Parked (backlog, not on current critical path)

| Task | Reason parked | Unblocks / depends |
|---|---|---|
| `fix/worker-auth-typecheck` | 5× TS2769 in `apps/worker/src/auth.ts` + 1× TS2339 in `apps/mobile/src/screens/SettingsScreen.tsx:60` (`AuthUser.token`). Needs focused review of better-auth API surface — not mechanical. Carved out of PR #6. | Fully green preflight; future auth changes |
| Phase 04 — DuckDB analytics | Spec exists (`specs/04-duckdb-analytics.md`), zero code. Legacy TS analytics surface is being patched for typecheck alignment only (PR after #6); scalability / SQL-native queries deferred until this phase runs. | Population health queries, research share, cost ledger dashboards |
| `fix/web-typecheck` | ~62 residual errors in ParentPortal / ParentReport / FleetReadinessTab / case-only filename drift. Surfaced once PR #6 unblocked deeper tsc. | Fully green preflight |

## Update protocol

When a phase completes:
1. Flip status to `DONE`.
2. Fill in the PR link and merge date.
3. Add a one-line note below.
4. Commit this file as part of the phase PR.

## Phase notes

(empty — first phase to run is 00)

### Phase 00 — 2026-04-15
Baseline verification complete. Created docs/RESIDENCY.md, docs/SECRETS.md, docs/RUNBOOK.md, scripts/preflight.sh. No source-code changes. Typecheck + wrangler dry-run to be re-run by human after push (requires CF creds + pnpm install in local env).

### Phase 01 — 2026-04-15
Turso vectors wired: migration 0001, shared `buildEmbeddingText` + `sha1Hex` helpers, worker `embedAndStore` lib, embed-on-write in observations POST + /sync (fire-and-forget via ctx.waitUntil), new `/api/similarity/observations` route with cosine search + moduleType/campaign filters, `/api/admin/embed-batch` for backfill, `scripts/backfill-embeddings.ts` rate-limited at 100/min, unit tests for embedding text + sha1Hex (node:test, no new deps), feature flag `FEATURE_TURSO_VECTORS`. Schema.sql updated to match. Audit log written on similarity + embed-batch. Merged as #3. Pending: manual apply of migration to Turso + backfill run + staging smoke.

### Phase 02 — 2026-04-15 (scope narrowed)
**Cloud AI suggestions for doctors (admin-gated, HITL).** `/api/ai/*` is now `requireRole('doctor','admin')` + gated by `ai_config.features.cloud_ai_suggestions` (default false; admin bypass so Settings test-gateway still works). Failover chain reordered: `workers-ai @cf/meta/llama-3.3-70b-instruct-fp8-fast` (tier 1, free, APAC) → `groq llama-3.3-70b-versatile` (tier 2, required) → `gemini` (tier 3, per-org overflow only) → `claude` (tier 4, per-org overflow only). Nurses receive 403; their full AI surface deferred to Phase 02a (on-device LFM2.5-VL-450M).

Shared modules: `ai/gateway-client.ts` (AIGateway + configurable chain + cf-aig-* header capture + cacheKey helper) and `ai/langfuse-trace.ts` (Langfuse HTTP + PHI redaction: base64 images, child names, DOBs, phones). Worker `/api/ai/analyze` + `/api/ai/vision` rewritten — every call routes through Gateway, emits a trace, writes `ai_usage`, emits `cloud_ai_suggestion.emitted` audit entry, returns `label` "AI Suggestion — Doctor's Diagnosis Required". New `POST /api/ai/suggestion/{accepted|rejected|edited}` writes the HITL decision to audit_log. New `/api/ai/usage/today` feeds Settings → AI & Devices → AI Gateway card. Migration `0002_ai_usage_extension.sql` + schema.sql updated.

Mobile `llm-gateway.ts` now takes `role` and coerces non-doctor callers to `local_only` (defense in depth; worker enforces too). Web `AIAnalysisPanel` shows the HITL banner in doctor mode and zeroes the cloud config in nurse mode. Tests: 21 pass (added workers-ai-first, workers-ai→groq failover, overflow tiers reached only when in chain; cacheKey, redaction, PHI-payload-size, ingest-never-throws retained). Feature flag `FEATURE_AI_GATEWAY` kill switch retained.

Pending: human to provision Langfuse secrets + GROQ_API_KEY + CF Gateway slug + deploy to staging for the 24h smoke.

### Phase 02a — 2026-04-15 (planned)
On-device Liquid AI LFM2.5-VL-450M for both nurse and doctor apps. Zero PHI egress. Function calling + bounding boxes per screening module. Full design in `specs/02a-liquid-ai-on-device.md`; TODO until Phase 02 merges.
