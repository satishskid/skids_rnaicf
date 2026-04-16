# SKIDS Edge-Stack v1 — Phase Status

Single source of truth for phase progress. Every phase spec requires this file to be updated on completion. Claude Code MUST check this file before starting a phase to confirm prerequisites are DONE.

| Phase | Spec | Status | Owner | PR | Merged |
|---|---|---|---|---|---|
| 00 | `specs/00-preflight.md` | DONE | planner-agent | #2 | 2026-04-15 |
| 01 | `specs/01-turso-vectors.md` | DONE | planner-agent | #3 | 2026-04-15 |
| 02 | `specs/02-ai-gateway-langfuse.md` | DONE | claude-code | #4 | 2026-04-15 |
| 02a-web | `specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md` | DONE | claude-code | PR #8 | 2026-04-15 |
| 02a-mobile | `specs/decisions/2026-04-15-phase-02a-mobile-deferred.md` | DEFERRED | — | — | — |
| 03 | `specs/03-sandbox-pdf-reports.md` | DONE | claude-code | PR #9 | 2026-04-15 |
| 04 | `specs/04-duckdb-analytics.md` | DONE | claude-code | PR #F | 2026-04-16 |
| 05 | `specs/05-workflows-queues.md` | TODO | — | — | — |
| 06 | `specs/06-sandbox-second-opinion.md` | TODO | — | — | — |
| 07 | `specs/07-vectorize-evidence-rag.md` | TODO | — | — | — |
| 08 | `specs/08-motherduck-research.md` | DEFERRED | — | — | — |

Legend: `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE` (or `DEFERRED` / `BLOCKED` / `PARKED`).

## Parked (backlog, not on current critical path)

| Task | Reason parked | Unblocks / depends |
|---|---|---|
| Typed `apiCall<T>` in `AuthContext` | Drop `unknown`-casts in `ConsentManagement` / `InstrumentBuilder` / `ParentPortal`. Mechanical, deferred for a focused sweep. | Ergonomics only — no runtime gain. |
| `AuthUser.token` / `CampaignRow` / `ObservationRow` index signatures | Currently typed as `any` in a handful of places. Would let us drop more casts across web. | Ergonomics only. |
| `behavioral-assessment.ts` fate | Web has an orphaned 668-line stub; mobile has the real impl. Decide: port up or delete. | Dead-code purge or feature parity. |
| MODEL_MANIFEST SHA-256 pinning (Phase 02a) | Liquid AI LFM2.5-VL-450M weights aren't SHA-pinned in `model-manifest.ts`. Low risk pre-flag-on, must land before we enable on-device AI for nurses. | Phase 02a-mobile un-deferral. |

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

### Phase 04 — 2026-04-16 (DONE)
Analytics worker `apps/analytics-worker/` on a nightly cron (02:00 IST / 20:30 UTC). Exports 9 Turso tables to R2 as partitioned Parquet (`r2://skids-analytics/v1/<table>/campaign=<code>/dt=<YYYY-MM-DD>/part-NNNN.parquet`), with snapshot vs incremental modes per table and an `analytics_cursor` row per incremental table. `publishable/` prefix materialised from DuckDB runs against the raw layer with children-band age-bucketing — no PHI. Main worker calls analytics-worker via `ANALYTICS_SVC` service binding, restricted to 5 canonical queries (Q1 chip-vs-AI agreement, Q2 AI spend, Q3 red-flag prevalence, Q4 screener throughput, Q5 time-to-doctor-review). PopulationHealth gains the Q3 red-flag tile (feature-flag gated); rest stay on TS helpers. Migration `0004_analytics_cursor.sql` adds `analytics_cursor`, `analytics_runs`, and a long-missing `audit_log` table. Feature flag `FEATURE_DUCKDB_ANALYTICS` gates the worker route. Pragmatic pivot during implementation: Workers can't embed DuckDB-WASM, so `/run` executes Turso-flavoured SQL against the primary (Q1 proxies disagreement via `reviews.decision IN ('refer','retake')`; Q5 uses julianday-math + ROW_NUMBER-based percentile). DuckDB SQL in `queries.sql` stays authoritative for the analyst REPL (`scripts/duckdb-repl.sh`) running against R2 Parquet. Phase 08 can swap `/run` to MotherDuck without touching the dashboard. Tests: 23 new analytics-worker tests; 53 upstream tests untouched and still green. PR #F.
