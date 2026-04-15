# SKIDS Edge-Stack v1 — Phase Status

Single source of truth for phase progress. Every phase spec requires this file to be updated on completion. Claude Code MUST check this file before starting a phase to confirm prerequisites are DONE.

| Phase | Spec | Status | Owner | PR | Merged |
|---|---|---|---|---|---|
| 00 | `specs/00-preflight.md` | DONE | planner-agent | #2 | 2026-04-15 |
| 01 | `specs/01-turso-vectors.md` | DONE | planner-agent | #3 | 2026-04-15 |
| 02 | `specs/02-ai-gateway-langfuse.md` | IN_REVIEW | claude-code | pending-push | — |
| 03 | `specs/03-sandbox-pdf-reports.md` | TODO | — | — | — |
| 04 | `specs/04-duckdb-analytics.md` | TODO | — | — | — |
| 05 | `specs/05-workflows-queues.md` | TODO | — | — | — |
| 06 | `specs/06-sandbox-second-opinion.md` | TODO | — | — | — |
| 07 | `specs/07-vectorize-evidence-rag.md` | TODO | — | — | — |
| 08 | `specs/08-motherduck-research.md` | DEFERRED | — | — | — |

Legend: `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE` (or `DEFERRED` / `BLOCKED`).

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

### Phase 02 — 2026-04-15
AI Gateway + Langfuse end-to-end. New `@skids/shared` modules: `ai/gateway-client.ts` (AIGateway class with gemini → claude → workers-ai failover, cf-aig-* header capture, cacheKey helper) and `ai/langfuse-trace.ts` (Langfuse HTTP client + PHI redaction: base64 images, child names, DOBs, phones). Worker `/api/ai/analyze` + `/api/ai/vision` rewritten — every call routes through Gateway, emits a trace, writes `ai_usage` row with cached/gateway_request_id/langfuse_trace_id/cost_usd_micros/module_type/provider/session_id. New `/api/ai/usage/today` endpoint feeds Settings → AI & Devices → AI Gateway card (test-gateway button + today's spend tile). Migration `0002_ai_usage_extension.sql` + schema.sql updated. Bindings AI_GATEWAY_ACCOUNT_ID / AI_GATEWAY_ID in wrangler.toml; ANTHROPIC_API_KEY / GROQ_API_KEY are optional secrets. Mobile `llm-gateway.ts` now passes sessionId + moduleType to worker (direct-provider calls already removed in V3). Feature flag `FEATURE_AI_GATEWAY`. Tests: 12 new node:test cases for failover, cache propagation, modelHint reordering, cacheKey stability, PHI payload-size (<2kB even with 100k image), ingest-never-throws. Also committed `fix(phase-01): escape errors` to unblock typecheck. Pending: human to provision Langfuse secrets + CF Gateway slug + deploy to staging for the 24h smoke.
