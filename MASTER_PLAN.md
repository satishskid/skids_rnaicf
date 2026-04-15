# SKIDS Screen V3 — Modern Edge Stack Master Plan

**Repo**: `github.com/satishskid/skids_rnaicf` (monorepo: `apps/{mobile,web,worker}` + `packages/{db,shared,api-client}`)
**Planning basis**: Feature audit, SCREEN_SPEC, schema.sql, wrangler.toml, and route inventory as of 2026-04-14.
**Target**: Ship a research-grade pediatric screening platform on Cloudflare edge + Turso + Sandbox, with DuckDB-powered analytics and gated MotherDuck collaboration.

---

## Non-negotiable principles

1. **Grounded, not speculative.** Every spec references actual file paths in the repo. Do not invent file names — read the referenced file first.
2. **Feature flags everything.** Follow the existing `ENABLE_SKIDS_COMPANION` pattern from the thrive-care sibling repo. Every new capability rolls out behind a per-campaign flag.
3. **PHI stays pinned.** Turso region + R2 region + AI Gateway region must all be India/SG-compatible for DPDP Act. Document residency decisions in each spec.
4. **Additive migrations only.** Never drop columns. Schema changes in `packages/db/src/schema.sql` are append-only; add new migration files, never edit historical ones.
5. **One green build between phases.** Each spec ends with a testable acceptance criterion. Do not start the next phase until the previous one is green.
6. **Audit log is sacred.** `apps/worker/src/routes/audit-log.ts` must receive a log entry for every new mutation endpoint introduced.

---

## Phase sequencing

| # | Spec file | Goal | Est. effort | Unblocks |
|---|---|---|---|---|
| 0 | `specs/00-preflight.md` | Verify baseline — builds pass, migrations clean, secrets inventoried | 0.5 day | Everything |
| 1 | `specs/01-turso-vectors.md` | Uncomment `embedding F32_BLOB(384)`, add embed-on-write + similarity endpoint | 1 day | RAG, quality loop |
| 2 | `specs/02-ai-gateway-langfuse.md` | Complete AI Gateway binding + Langfuse tracing end-to-end | 1 day | Cost dashboards, quality dashboards |
| 3 | `specs/03-sandbox-pdf-reports.md` | Sandbox Lane C — render FourD / Child / Parent reports as signed PDFs | 2 days | Parent-facing releases |
| 4 | `specs/04-duckdb-analytics.md` | Nightly Turso → Parquet → DuckDB pipeline + first 5 research queries | 2 days | Research, calibration |
| 5 | `specs/05-workflows-queues.md` | Cloudflare Workflow for screening lifecycle + Queue for Sandbox fan-out | 2 days | Scale, reliability |
| 6 | `specs/06-sandbox-second-opinion.md` | Sandbox Lane A — heavier model re-analysis for medium-risk observations | 3 days | Quality loop, IP |
| 7 | `specs/07-vectorize-evidence-rag.md` | Vectorize for evidence library RAG in DoctorReviewScreen | 2 days | Clinical decision support |
| 8 | `specs/08-motherduck-research.md` | **DEFERRED** — per-study MotherDuck share, gated by `consents` + `studies`. Spec retained for future; not on critical path. | 1.5 days | External research |

**Total (Phases 0–7)**: ~13.5 working days. Phases 0–2 are the unblockers; do them first regardless of what else slips. Phase 8 is deferred and does not count toward the critical path.

**What Sandbox does and does NOT do for screening**: Sandbox runs *async, server-side, after the nurse has moved on*. It does not make the live nurse UX faster. It improves record quality via second-opinion annotations (Phase 6), powers PDF rendering (Phase 3), and enables heavier signal processing lanes later. In-session responsiveness stays on-device via the existing ONNX + MediaPipe pipeline. See `SYSTEM_WORKFLOW.md` for the full current + target data flow.

---

## Phase dependency graph

```
00 preflight
  └─ 01 turso-vectors ─────┐
  └─ 02 ai-gateway ────────┤
                           ├─ 03 sandbox-pdf ──┐
                           │                   ├─ 05 workflows-queues ── 06 sandbox-2nd-opinion
                           ├─ 04 duckdb ───────┤                                │
                           │                   └──────────────────────── 08 motherduck
                           └─ 07 vectorize-rag (after 01, 02)
```

Phases 3 and 4 are independent after 0–2; run in parallel if two coders available.

---

## Cross-cutting decisions (decided once, applied everywhere)

**Region pinning**: Turso primary `aws-ap-south-1` (Mumbai), R2 jurisdiction `IN` where supported else `APAC`, Workers default (edge), AI Gateway region pin via gateway config. Record the chosen values in `docs/RESIDENCY.md` — a file to create in Phase 0.

**Embedding model**: `@cf/baai/bge-small-en-v1.5` (Workers AI, 384-dim, free tier generous). Matches the 384-dim comment already in `schema.sql`. Do NOT change to OpenAI/Cohere — free and in-region is the point.

**PDF engine inside Sandbox**: WeasyPrint (Python, deterministic HTML→PDF, no Chromium overhead). Alternative considered: Playwright headless. Chose WeasyPrint for cold-start speed and reproducibility; revisit if CSS fidelity issues arise.

**Parquet layout**: `r2://skids-analytics/v1/<table>/campaign=<code>/dt=<yyyy-mm-dd>/part-*.parquet`. Hive-partitioned. DuckDB reads via `read_parquet('r2://...', hive_partitioning=1)`.

**Feature flag source**: `ai_config` table (already exists, per `routes/ai-config.ts`) gets a `features_json` column; each new capability reads its flag from there per-org/per-campaign.

**Observability**: Every new route emits a Langfuse trace (after Phase 2). Every new Sandbox invocation emits a structured log line `{phase, sandbox_id, input_r2, output_r2, ms, status}` that flows into ai_usage-style ledger and DuckDB.

**Secrets inventory** (single source of truth, to be maintained in `docs/SECRETS.md` — create Phase 0):

| Secret | Set via | Phase introduced |
|---|---|---|
| `TURSO_URL`, `TURSO_AUTH_TOKEN` | existing | — |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_API_KEY` | existing | — |
| `CLOUDFLARE_R2_*` | existing | — |
| `AYUSYNC_WEBHOOK_SECRET` | existing | — |
| `GEMINI_API_KEY` | existing | — |
| `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL` | Phase 2 | 02 |
| `AI_GATEWAY_ACCOUNT_ID`, `AI_GATEWAY_ID` | Phase 2 | 02 |
| `SANDBOX_SIGNING_KEY` (HMAC for PDF tokens) | Phase 3 | 03 |
| `MOTHERDUCK_TOKEN` (optional) | Phase 8 | 08 |

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Embedding backfill is expensive for existing observations | Phase 1 includes a rate-limited backfill worker (100/min) with resume-on-restart |
| Sandbox cold start breaks parent-report SLA | Phase 3 pre-warms via scheduled ping + caches rendered PDF in R2 keyed by report version hash |
| Langfuse EU hosting vs India residency | Phase 2 chooses self-hosted Langfuse on Hetzner Mumbai OR keeps Langfuse but only logs non-PHI spans (redact image/audio refs) |
| DuckDB row-level PHI in research exports | Phase 4 builds a `publishable_views.sql` that enforces de-identification at export time |
| Workflow state explosion from high-volume campaigns | Phase 5 includes a partitioned workflow-per-campaign design, not a global workflow |
| Second-opinion model costs blow budget | Phase 6 gates by quality-gate confidence score — only re-run if Tier-1/2 confidence < threshold |

---

## Definition of done for the full plan

- All 9 spec files committed to `specs/` branch `feat/edge-stack-v1`.
- Each phase has: (a) migration file if schema touched, (b) worker route(s), (c) shared types, (d) test, (e) admin dashboard hook, (f) Langfuse trace, (g) feature flag.
- `docs/RESIDENCY.md`, `docs/SECRETS.md`, `docs/RUNBOOK.md` exist and are current.
- `pnpm build`, `pnpm typecheck`, `pnpm --filter @skids/worker deploy --dry-run` all pass.
- A demo script `scripts/demo-edge-stack.sh` exists that exercises: create campaign → register child → capture observation → trigger second-opinion → render PDF → query DuckDB → verify all traces visible in Langfuse.

---

## How to use this plan in Claude Code

See `CLAUDE_CODE_PROMPT.md`. Each phase spec is self-contained: point Claude Code at one spec, it should complete that phase in a single shot without needing to read the others. The `CLAUDE_CODE_PROMPT.md` file contains the exact invocation prompt.
