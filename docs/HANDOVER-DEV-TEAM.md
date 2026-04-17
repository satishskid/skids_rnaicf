# Dev Team Handover — SKIDS Edge-Stack v1

**Date:** 2026-04-17
**From:** platform rollout
**To:** incoming dev team
**Status of the platform:** live in production. 3 capabilities and 3 minor polish items wait on dev-team action.

---

## 0 · Where to clone from

```sh
# Repo
git clone https://github.com/satishskid/skids_rnaicf.git
cd skids_rnaicf

# Baseline — main is the source of truth. Everything below is on main.
git checkout main
git pull

# Sanity check you're at the handover tip:
git log -1 --format="%h %s"
# Expected: cb2bc46 docs(deck): rewrite in Marp — one .md → pptx + pdf + html (#38)
```

- **Default branch:** `main` (auto-deploy is NOT wired — every deploy today is via `wrangler deploy` after a merged PR).
- **Branching convention:** `feat/<slug>` for features, `fix/<slug>` for fixes, `docs/<slug>` for docs. One PR per logical change. Auto-squash merge.
- **CI:** GitHub Actions. Only active workflow today is `.github/workflows/analytics-publishable.yml` (nightly publishable Parquet build). No typecheck/test gates in CI yet — verify locally before PR.

---

## 1 · Before you touch anything — read these 4 docs in order

| # | Doc | Why |
|---|---|---|
| 1 | [docs/BLUEPRINT.md](BLUEPRINT.md) | Full system: 13 sections · architecture diagrams · feature flags · deferred items · triage pointers. This is the single source of truth. |
| 2 | [docs/PRODUCT-SUMMARY-2026-04-17.md](PRODUCT-SUMMARY-2026-04-17.md) | Stakeholder-facing feature summary with mermaid workflow. Read the "end-to-end product workflow" diagram first — it shows where every subsystem plugs in. |
| 3 | [docs/RUNBOOK.md](RUNBOOK.md) | Operational runbook. What to do when a cron misfires, a queue backs up, or a workflow stalls. |
| 4 | [docs/SECRETS.md](SECRETS.md) | Which secrets exist in which worker. Dev team needs access to the ops lead before any deploy. |

For a visual overview that you can share with non-technical stakeholders in the first week: [docs/decks/edge-stack-v1-release.pptx](decks/edge-stack-v1-release.pptx).

---

## 2 · Work queue, prioritised

### P0 · Finish on-device Liquid AI (LFM2.5-VL-450M)

**Blocker:** weight shards not uploaded; `MODEL_MANIFEST` is `PENDING-PIN`.

**Starting point:** [docs/HANDOVER-LIQUID-AI.md](HANDOVER-LIQUID-AI.md) is a self-contained 2–4-day plan. Read it top to bottom before writing code.

**Files you'll touch:**
- [packages/shared/src/ai/model-manifest.ts](../packages/shared/src/ai/model-manifest.ts) — pin real version + per-shard sha256
- [scripts/publish-liquid-ai.sh](../scripts/publish-liquid-ai.sh) — run this to upload shards + emit the manifest diff
- [apps/web/src/components/ai/AIAnalysisPanel.tsx](../apps/web/src/components/ai/AIAnalysisPanel.tsx) — switch the nurse path to the runtime
- [apps/web/src/components/screening/readiness-check.tsx](../apps/web/src/components/screening/readiness-check.tsx) — add the LFM readiness row
- new: `apps/web/src/lib/ai/liquid-capability.ts` — WebGPU capability probe
- new: `packages/shared/src/ai/module-schemas/` — 5 Zod schemas (red-reflex, otoscopy, dental, skin, general-appearance) + JSON Schema emission

**Suggested branch:** `feat/phase-02a-web-liquid-ai-weights`

**Clinical checkpoint:** if LFM2.5-VL-450M is not publicly available as an MLC build, you must pick a fallback model (Qwen2-VL-2B or Phi-3.5-vision) and get **clinical + product sign-off** before uploading. The handover doc explains this.

---

### P1 · Deploy the Sandbox AI container (Phase 06)

**Blocker:** `[[containers]]` binding not active; docker image never built.

**State today:** queue consumer (`apps/worker/src/queues/consumers/sandbox-second-opinion.ts`) logs the intent, writes a `pending` row to `ai_annotations_secondary`, but falls through when `env.SANDBOX_AI` is absent. UI button is live — clicking it queues a message, but no ONNX inference fires.

**What to do:**
1. Build the image locally:
   ```sh
   cd apps/worker/sandbox-ai
   docker build -t skids-sandbox-ai:v1 .
   ```
2. Push to Cloudflare Containers registry:
   ```sh
   cd ../../
   pnpm exec wrangler containers build ./sandbox-ai -t skids-sandbox-ai:$(git rev-parse --short HEAD)
   pnpm exec wrangler containers push skids-sandbox-ai:...
   ```
3. Uncomment the `[[containers]]` + `[[durable_objects.bindings]]` block in `apps/worker/wrangler.toml` (write it fresh per the Cloudflare Containers open-beta docs — the original `[[sandbox]]` shape in specs is outdated).
4. Deploy + smoke:
   ```sh
   cd apps/worker && pnpm exec wrangler deploy
   # Smoke: POST /api/observations/:id/second-opinion — check ai_annotations_secondary for status='ok'
   ```

**Files:** [apps/worker/sandbox-ai/](../apps/worker/sandbox-ai/) (Dockerfile, analyze.py, models_registry.py already written).

**Suggested branch:** `feat/phase-06-sandbox-container`

**Risk flag:** Cloudflare Containers is still in open beta — API surface may have shifted since the spec was written. Cross-check against the current `wrangler containers --help`.

---

### P1 · Row-level second-opinion badge in DoctorInbox

**State today:** `SecondOpinionBadge` renders inside `ObservationContextPanel` (visible only when the doctor expands an observation). Not in the inbox list row itself.

**What to do:**
1. Extend `GET /api/observations` to `LEFT JOIN ai_annotations_secondary` so the list response includes `secondaryStatus` per observation.
2. Import `SecondOpinionBadge` at [apps/web/src/pages/DoctorInbox.tsx](../apps/web/src/pages/DoctorInbox.tsx) row-level render (next to existing `StatusBadge`).
3. Typecheck + smoke against staging.

**Suggested branch:** `feat/inbox-second-opinion-badge`

**Size:** ~1 day (one SQL change, one JSX change, one test).

---

### P2 · Parent SMS / WhatsApp delivery

**State today:** `POST /api/reports/render` returns a signed URL. Nobody delivers it to parents — ops does this manually.

**What to do:** write a delivery adapter. Integration choice (Twilio / Gupshup / MSG91) is a product decision — confirm with the ops lead before implementing.

**Suggested branch:** `feat/parent-report-delivery`

**Files to create:** `apps/worker/src/routes/delivery.ts` + adapter stubs.

---

### P3 · Replace the `sandbox-pdf` queue stub with real render

**State today:** [apps/worker/src/queues/consumers/sandbox-pdf.ts](../apps/worker/src/queues/consumers/sandbox-pdf.ts) logs + acks. Direct `/api/reports/render` still works for admin-initiated PDFs.

**What to do:** replace consumer body with a `renderTemplate()` call (the same one the admin endpoint uses). Re-issue the HMAC token, save to R2_REPORTS_BUCKET.

**Suggested branch:** `fix/phase-05-pdf-queue-consumer`

**Size:** ~half a day.

---

## 3 · Local dev setup

```sh
# prerequisites
node -v   # 22+ (tsx 4.19 + wrangler 4.71 need it)
pnpm -v   # 10.29
brew install turso      # CLI for DB migrations + token minting

# install
pnpm install

# each app has its own wrangler.toml + .dev.vars
# Read docs/SECRETS.md — the ops lead has the full set.

# local dev
pnpm --filter @skids/worker dev         # http://localhost:8787
pnpm --filter @skids/web dev            # http://localhost:5173
pnpm --filter @skids/analytics-worker dev
```

Worker secrets you need BEFORE first deploy:
- `TURSO_URL` + `TURSO_AUTH_TOKEN` (write)
- `TURSO_READ_URL` + `TURSO_READ_AUTH_TOKEN` (for analytics-worker)
- `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` + `BETTER_AUTH_API_KEY`
- `GROQ_API_KEY` (AI Gateway primary)
- `LANGFUSE_*` (tracing)
- `REPORT_SIGNING_KEY` (HMAC for parent report URLs)

Ops lead can transfer these via `wrangler secret put <NAME>` from your terminal; **never paste them into chat, git, or a PR**.

---

## 4 · Feature flag registry (current state)

| Flag | Where | Value today |
|---|---|---|
| `FEATURE_TURSO_VECTORS` | worker env | default ON |
| `FEATURE_AI_GATEWAY` | worker env | default ON |
| `FEATURE_REPORT_PREWARM` | worker env | `0` |
| `FEATURE_ANALYTICS_CRON` | analytics env | `1` |
| `FEATURE_DUCKDB_ANALYTICS` | worker env | `1` |
| `FEATURE_USE_WORKFLOW` | worker env | `1` |
| `FEATURE_EVIDENCE_RAG` | worker env | `1` |

Full registry with rollback instructions in [docs/BLUEPRINT.md §8](BLUEPRINT.md).

---

## 5 · Explicitly won't-fix / intentional

- **DuckDB in-Worker** (Phase 08 / MotherDuck) — the `/api/analytics/run` Turso-native SQL is the designed state. Don't "fix" it.
- **`scripts/duckdb-repl.sh`** — analysts run DuckDB directly. Convenience wrapper is low priority.

---

## 6 · How to merge work back

1. Branch off `main`, commit often, `pnpm typecheck` per filter before PR.
2. Open PR against `main`. Auto-squash + delete-branch is the norm.
3. After merge: `wrangler deploy` from the matching worker directory. Verify `/api/health` + a canonical smoke for the subsystem you touched.
4. Update [docs/BLUEPRINT.md §11 (deferred items)](BLUEPRINT.md) — flip any row you complete from "deferred" to gone.

---

## 7 · Escalation / context

- **Git history:** PRs #22–#38 landed on 2026-04-17 — that's the release commit range for Edge-Stack v1. Blame any surprise behaviour to one of those.
- **Production workers:** `skids-api`, `skids-analytics` (both at `*.satish-9f4.workers.dev`).
- **Production data:** Turso DB `skids-screen-v3` (libSQL org `satishskid`), R2 buckets `skids-media`, `skids-models`, `skids-reports`, `skids-analytics`, Vectorize index `skids-evidence`.
- **When in doubt:** read the triage table in [BLUEPRINT §13](BLUEPRINT.md) — it maps symptom → first place to look.

---

_Last updated: 2026-04-17 · supersedes: (nothing, this is the first combined dev handover)_
