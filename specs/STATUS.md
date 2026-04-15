# SKIDS Edge-Stack v1 — Phase Status

Single source of truth for phase progress. Every phase spec requires this file to be updated on completion. Claude Code MUST check this file before starting a phase to confirm prerequisites are DONE.

| Phase | Spec | Status | Owner | PR | Merged |
|---|---|---|---|---|---|
| 00 | `specs/00-preflight.md` | DONE | planner-agent | pending-push | 2026-04-15 |
| 01 | `specs/01-turso-vectors.md` | TODO | — | — | — |
| 02 | `specs/02-ai-gateway-langfuse.md` | TODO | — | — | — |
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
