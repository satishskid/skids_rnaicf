# Claude Code — Single-Shot Execution Prompt

Use this prompt to run each phase in Claude Code. Each phase is self-contained — Claude Code reads the spec, executes, and opens a PR. Do not run multiple phases in the same session.

---

## Setup (once)

1. Copy `MASTER_PLAN.md` and the entire `specs/` folder into the repo root of `skids_rnaicf`.
2. Commit to a planning branch:
   ```bash
   cd skids_rnaicf
   git checkout -b feat/edge-stack-v1-plan
   mkdir -p specs
   cp <path-to-outputs>/MASTER_PLAN.md .
   cp <path-to-outputs>/specs/*.md specs/
   git add MASTER_PLAN.md specs/
   git commit -m "docs: edge-stack v1 master plan + phase specs"
   git push -u origin feat/edge-stack-v1-plan
   ```
3. Open Claude Code in the repo root.

---

## Single-shot prompt template

Paste this prompt at the start of a fresh Claude Code session, replacing `{PHASE_NUMBER}` with 00–08:

```
You are executing Phase {PHASE_NUMBER} of the SKIDS Screen V3 edge-stack rollout.

CONTEXT (read in this order before writing any code):
1. MASTER_PLAN.md — understand sequencing, principles, and cross-cutting decisions.
2. specs/{PHASE_NUMBER}-*.md — the exact phase you are executing.
3. Every file listed in the spec's "Read first" section.
4. specs/STATUS.md — confirm prerequisite phases are marked DONE. If not, stop and tell me.

EXECUTION RULES:
- Work only on the branch the spec names (or create it if it is the first phase).
- Follow the spec's deliverables list literally. No extra features.
- Every schema change is an additive migration. Never drop or rename columns.
- Every new endpoint emits an audit_log row and a Langfuse trace (if Phase 2 is done).
- Every new capability is behind a feature flag in ai_config.features_json.
- Match existing code style (pnpm, hono, kysely, libSQL client patterns).
- Run `pnpm typecheck && pnpm build` before claiming a step done.
- Run the phase's tests before declaring completion.
- Update specs/STATUS.md when the phase passes acceptance criteria.
- Commit atomically per deliverable with Conventional Commits.
- Open a PR to `feat/edge-stack-v1` with the phase spec referenced in the PR body.

QUALITY BAR:
- No `any` unless justified in a comment.
- No silent catch blocks. Every catch logs to audit_log or ai_usage.
- No PHI in logs, traces, or evidence index.
- No provider calls outside the AI Gateway (after Phase 2).

STOP CONDITIONS (tell me, do not proceed):
- A "Read first" file does not exist where the spec says it does.
- A prerequisite phase is not DONE in STATUS.md.
- An acceptance criterion cannot be met without violating a principle.
- You need a secret that is not in docs/SECRETS.md.

DELIVERABLE AT END:
- PR link
- STATUS.md updated
- Short summary: what changed, what migrations ran, what feature flags were added, which tests were added, remaining risks.

Now begin Phase {PHASE_NUMBER}.
```

---

## Phase-by-phase invocation order

| Run # | Phase | Paste `{PHASE_NUMBER}` = | Can parallelize with |
|---|---|---|---|
| 1 | Preflight | `00` | — |
| 2 | Turso vectors | `01` | `02` |
| 3 | AI Gateway + Langfuse | `02` | `01` |
| 4 | Sandbox PDF reports | `03` | `04` |
| 5 | DuckDB analytics | `04` | `03` |
| 6 | Workflows + Queues | `05` | — |
| 7 | Sandbox second opinion | `06` | — |
| 8 | Vectorize evidence RAG | `07` | `06` |
| 9 | MotherDuck research | `08` | — |

Parallelization means: two engineers (or two Claude Code sessions in two worktrees) can run those phases simultaneously. Do NOT parallelize Phase 6 onward — the dependencies are tight.

---

## Worktree trick for parallel phases

```bash
# Terminal A — Phase 03
git worktree add ../skids-p03 -b phase/03-sandbox-pdf feat/edge-stack-v1
cd ../skids-p03
# open Claude Code here, paste prompt with {PHASE_NUMBER}=03

# Terminal B — Phase 04
git worktree add ../skids-p04 -b phase/04-duckdb feat/edge-stack-v1
cd ../skids-p04
# open Claude Code here, paste prompt with {PHASE_NUMBER}=04
```

Merge both PRs into `feat/edge-stack-v1` when green.

---

## If a phase fails mid-run

1. Tell Claude Code to STOP.
2. Check which deliverables are partially complete.
3. Revert incomplete files but keep completed ones committed.
4. Re-invoke the prompt — it is designed to resume safely because every step is idempotent (migrations are `IF NOT EXISTS`, route registrations are declarative, tests are deterministic).

---

## Post-phase checklist (human)

After Claude Code declares a phase done:

- [ ] PR diff reviewed by a human (5-minute scan; don't rubber-stamp)
- [ ] Migration previewed on a staging Turso before prod apply
- [ ] New wrangler bindings reviewed against `docs/RESIDENCY.md`
- [ ] `scripts/preflight.sh` re-run on the branch
- [ ] `specs/STATUS.md` actually updated
- [ ] Deploy to staging: `pnpm --filter @skids/worker deploy --env staging`
- [ ] Smoke test the new capability in staging for 24h before merging
- [ ] Merge + deploy to prod
- [ ] Tag release `v3.{phase}.0`

---

## What good looks like after all 9 phases

- `feat/edge-stack-v1` branch merged to `main`
- All specs marked DONE in STATUS.md
- Demo script `scripts/demo-edge-stack.sh` runs end-to-end and exercises every new capability
- `docs/RUNBOOK.md` has a section per phase with working commands
- Langfuse dashboard shows a full trace for every screening session
- DuckDB REPL executes all 5 canonical queries against real nightly Parquet
- At least one study share is live in MotherDuck (aggregate)
- One external clinician has reviewed a DoctorReviewScreen with evidence + similar cases and given thumbs-up
- A PDF report has been rendered for 10+ real children with zero font / layout defects
- Zero PHI incidents in audit_log or DLQ
