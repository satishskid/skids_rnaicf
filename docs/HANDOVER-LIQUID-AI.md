# Handover — Complete Phase 02a Liquid AI (web track)

**For:** a dev team picking up the unfinished on-device Liquid AI work.
**State at handover:** 2026-04-17. Infrastructure 100% built; weights 0% uploaded.
**Estimated effort to "live":** 2–4 engineering days, assuming no unknown model-sourcing blockers.
**Owner needed:** 1 frontend engineer (WebGPU, React) + 15 min of ops (R2 upload).

---

## 0 · TL;DR

SKIDS already ships a full on-device LLM runtime for the **nurse/doctor browser** — same-origin shard proxy, OPFS cache, per-shard SHA-256 verification, WebLLM + WebGPU handoff, HITL audit. All of it is production-deployed today.

**It does not serve anything** because [packages/shared/src/ai/model-manifest.ts](packages/shared/src/ai/model-manifest.ts) is still placeholder: `version = 'PENDING-PIN-2026-04-15'`, every shard `sha256 = 'PENDING-PIN'`. The model bucket at `r2://skids-models/models/liquid-ai/LFM2.5-VL-450M/` is empty.

Your job is to go from placeholder to served — source or select weights, upload to R2, pin the manifest, ship the React integration that actually calls the runtime, and green-light the flag.

---

## 1 · What's already shipped (do not rebuild)

### 1.1 Worker-side (apps/worker)
| File | Purpose | Status |
|---|---|---|
| [apps/worker/src/routes/models.ts](apps/worker/src/routes/models.ts) | `GET /api/models/:modelId/:version/:shard` — same-origin R2 proxy, auth-gated, manifest-pinned, audit-logged | **Done** |
| [apps/worker/src/routes/on-device-ai.ts](apps/worker/src/routes/on-device-ai.ts) | `POST /api/on-device-ai/:outcome` — HITL audit (suggested/accepted/rejected/edited) | **Done** |
| [apps/worker/wrangler.toml](apps/worker/wrangler.toml) | `R2_MODELS_BUCKET` binding → `skids-models` | **Done** |

Live in production at `https://skids-api.satish-9f4.workers.dev`.

### 1.2 Web-side (packages/liquid-ai + apps/web)
| File | Purpose | Status |
|---|---|---|
| [packages/liquid-ai/src/web/loader.ts](packages/liquid-ai/src/web/loader.ts) | Fetch every shard same-origin, SHA-verify, write to OPFS, hand off to WebLLM MLCEngine | **Done** (but gated by placeholder manifest) |
| [packages/liquid-ai/src/web/opfs-cache.ts](packages/liquid-ai/src/web/opfs-cache.ts) | OPFS read/write/delete primitives | **Done** |
| [packages/liquid-ai/src/web/sha256.ts](packages/liquid-ai/src/web/sha256.ts) | `crypto.subtle` SHA-256 helper | **Done** |
| [packages/liquid-ai/src/web/loader.test.ts](packages/liquid-ai/src/web/loader.test.ts) | Unit tests for the loader (fake fetch + fake OPFS) | **Done** |
| [packages/liquid-ai/src/types.ts](packages/liquid-ai/src/types.ts) | `CapabilityReport`, `HitlOutcome`, tier typing | **Done** |

### 1.3 Shared contract (packages/shared)
| File | Purpose | Status |
|---|---|---|
| [packages/shared/src/ai/model-manifest.ts](packages/shared/src/ai/model-manifest.ts) | `MODEL_MANIFEST` — the single source of truth consumed by both the worker and the web loader | **Placeholder — your job to pin** |
| `isPlaceholderManifest()` (same file) | Safety guard: returns `true` while placeholder is in place | Keep and honour |

### 1.4 Specs to read before coding
- [specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md](specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md) — the authoritative design doc. Contains the WebGPU primary / WASM fallback decision, the OPFS choice, the function-call schema contract.
- [specs/02a-liquid-ai-on-device.md](specs/02a-liquid-ai-on-device.md) — original stub (superseded by the decision doc).
- [docs/BLUEPRINT.md](docs/BLUEPRINT.md) §4A — where Liquid AI sits in the overall flow.

---

## 2 · What's not shipped (your work)

### 2.1 Blocker — weights sourcing
The manifest targets `liquid-ai/LFM2.5-VL-450M` in MLC-LLM q4f16_1 quantization. **Verify availability before anything else:**

1. Check MLC-AI's model registry for `LFM2.5-VL-450M-q4f16_1-MLC` on HuggingFace / mlc.ai.
2. If public: download, verify sha256 on each shard, use as-is.
3. If private (Liquid AI gates access): contact Liquid AI for access or for their own MLC-compiled release.
4. **If unavailable** (genuine risk — the model name in the original plan was aspirational): pick a **drop-in replacement** and update the manifest to point at it. The rest of the stack is model-agnostic. Pragmatic candidates, in preference order:
   - `Qwen2-VL-2B-Instruct-q4f16_1-MLC` — vision-language, ~1.3 GB, confirmed on HuggingFace MLC org.
   - `Llama-3.2-1B-Instruct-q4f16_1-MLC` — text-only, ~700 MB. Loses vision capability; not suitable if vision is clinical-critical.
   - `Phi-3.5-vision-instruct-q4f16_1-MLC` — vision-language, ~2.5 GB, larger but capable.

**Clinical decision needed:** if you're swapping away from LFM2.5, the clinical team must re-validate that the fallback model's outputs meet the accuracy bar for the modules it'll be used on (red reflex, otoscopy, dental, skin, general appearance). This is not a pure engineering choice.

### 2.2 Blocker — function-call schemas (per-module contracts)
Spec §3 calls for per-module Zod schemas under `packages/shared/src/ai/module-schemas/`. **This directory does not exist yet.** The dev team must land it before the nurse integration makes sense.

Required files (one per module):
- `packages/shared/src/ai/module-schemas/base.ts` — `BaseModuleSchema { confidence, retakeReason?, chipSuggestions }`
- `packages/shared/src/ai/module-schemas/red-reflex.ts`
- `packages/shared/src/ai/module-schemas/otoscopy.ts`
- `packages/shared/src/ai/module-schemas/dental.ts`
- `packages/shared/src/ai/module-schemas/skin.ts`
- `packages/shared/src/ai/module-schemas/general-appearance.ts`
- `packages/shared/src/ai/module-schemas/index.ts` — barrel export + JSON Schema emission via `zod-to-json-schema`

Contract: the runtime prompt references these via BFCLv4 function-call header; the UI validates incoming JSON against the Zod schema before rendering. Validation failure → "AI output invalid, annotate manually."

### 2.3 Blocker — UI integration points
Three surfaces must change (all in `apps/web`, none of which depend on the model being uploaded yet so they can be built in parallel):

| Surface | File | What changes |
|---|---|---|
| Readiness check | `apps/web/src/components/screening/readiness-check.tsx` | Add a row: "Liquid AI (on-device, ≈[N] MB)" with status/download button. Blocks `allDone` for nurses on capable browsers; warning-only for doctors. |
| AI panel | `apps/web/src/components/ai/AIAnalysisPanel.tsx` | Replace the `local_only` branch for nurses with `runLiquidAi(imageDataUrl, moduleSchema)`. Ollama path survives for doctor modes. |
| Capability check | new: `apps/web/src/lib/ai/liquid-capability.ts` | Detect WebGPU, deviceMemory, storage quota; return `CapabilityReport`. Gate the nurse flow on tier === 'webgpu'. |

Reference: the loader accepts an `ImageBitmap | Blob`, converts to base64 data URL internally, and never emits network traffic beyond the same-origin shard fetch. Do not wrap it in anything that phones home.

---

## 3 · Step-by-step implementation plan

### Day 1 — sourcing + schemas + capability check

#### Step 1.1 — Pick the model (½ day, may bleed into day 2)
- [ ] Try to obtain LFM2.5-VL-450M q4f16_1 MLC build.
- [ ] If unavailable, convene clinical + product to approve a replacement from the candidate list in §2.1.
- [ ] Document the decision in `specs/decisions/<today>-liquid-ai-model-selection.md`.
- [ ] Download the chosen model to a local directory. Expect ~300 MB – 2.5 GB depending on choice.

**Acceptance:** a directory on your laptop containing every shard listed in the model's `mlc-chat-config.json`, with the `.bin` params shards accounted for.

#### Step 1.2 — Publish to R2 (15 minutes once weights are local)
Use the script below (§6). Its output includes the exact `MODEL_MANIFEST` diff.

```sh
# Worker auth (if not already):
cd apps/worker && pnpm exec wrangler whoami

# Run the publisher. Example — adjust to your local paths.
./scripts/publish-liquid-ai.sh \
  --model-id "liquid-ai/LFM2.5-VL-450M" \
  --version "v1.0.0-2026-05-01" \
  --quantization "q4f16_1" \
  --source-dir "/tmp/lfm-25-vl-450m-q4f16_1-MLC"
```

**Acceptance:**
- Every shard listed in the source's `mlc-chat-config.json` is present at `r2://skids-models/models/<id>/<version>/<shard>`.
- `wrangler r2 object list skids-models --prefix models/<id>/<version>/` returns the expected count.
- `publish-liquid-ai.sh` prints a copy-pasteable `MODEL_MANIFEST` TypeScript literal.

#### Step 1.3 — Land the manifest diff (30 minutes)
- [ ] Paste the generated `MODEL_MANIFEST` into [packages/shared/src/ai/model-manifest.ts](packages/shared/src/ai/model-manifest.ts).
- [ ] Real values: `version` is a semantic version string (no `PENDING-PIN`); each shard has real `sha256` (64 hex chars) and real `sizeBytes`.
- [ ] `isPlaceholderManifest()` will now return `false` automatically — do **not** modify that function.
- [ ] `totalSizeBytes` equals the sum of every shard `sizeBytes`. The script verifies this.
- [ ] PR with both clinical and tech review.

**Acceptance:**
- `pnpm --filter @skids/shared typecheck` clean.
- `pnpm --filter @skids/worker test` clean (existing models.test assertions pass with the new manifest).
- In staging: `curl https://<staging>.workers.dev/api/models/<id>/<version>/<shard-name>` returns 200 + correct Content-Length + a byte prefix that matches what you uploaded.

#### Step 1.4 — Function-call schemas (½ day)
- [ ] Create `packages/shared/src/ai/module-schemas/` with base + 5 module files (§2.2).
- [ ] Add `"zod-to-json-schema"` to `packages/shared/package.json` devDeps if not already present.
- [ ] Export JSON Schemas via `zod-to-json-schema(schema, { target: 'openApi3' })`.
- [ ] Unit test: round-trip a valid JSON through each schema; confirm an invalid JSON rejects.

**Acceptance:** `pnpm --filter @skids/shared test` passes new schema tests.

#### Step 1.5 — Capability check (1 hour)
- [ ] Create `apps/web/src/lib/ai/liquid-capability.ts` exporting `async function checkLiquidAiCapability(): Promise<CapabilityReport>`.
- [ ] Probe: `'gpu' in navigator`, `navigator.deviceMemory`, `navigator.storage.estimate()`, `navigator.connection?.effectiveType`.
- [ ] Thresholds (from spec):
  - `tier: 'webgpu'` iff hasWebGpu && deviceMemoryGb >= 4 && storageFreeBytes >= 1.5 * manifest.totalSizeBytes.
  - `tier: 'wasm'` iff !hasWebGpu && deviceMemoryGb >= 4 (fallback for desktop Safari/FF).
  - `tier: 'unsupported'` otherwise.
- [ ] Unit test with mocked navigator.

**Acceptance:** typecheck + unit test green.

### Day 2 — UI integration

#### Step 2.1 — Readiness check row (2 hours)
- [ ] In `apps/web/src/components/screening/readiness-check.tsx`, add a `LiquidAiStatus` row:
  - State: 'checking' → 'unsupported' (show why) | 'not-cached' (show download button) | 'downloading' (progress) | 'cached' (tick).
  - Download button calls the loader's `downloadAndCache()` helper.
  - For `userRole === 'nurse'`: block `allDone` until `cached`.
  - For `userRole === 'doctor' | 'admin'`: warning-only.

**Acceptance:** manual test on staging: a fresh Chrome profile sees "not cached → downloading → cached" end-to-end; Safari sees "unsupported — use manual entry"; nurse on Safari is blocked from starting a screening.

#### Step 2.2 — AIAnalysisPanel wire-up (½ day)
- [ ] In `apps/web/src/components/ai/AIAnalysisPanel.tsx`, replace the `local_only` branch for `mode === 'nurse'`:
  ```ts
  if (mode === 'nurse') {
    const schema = getModuleSchema(moduleId)  // from packages/shared
    const result = await runLiquidAi(imageDataUrl, schema)
    // validate + render
  }
  ```
- [ ] Keep the existing Ollama path for `mode === 'local_first' | 'dual'` (those are doctor flows).
- [ ] Validate result JSON against the Zod schema; on failure render "AI output invalid, annotate manually."

**Acceptance:** a nurse running a red-reflex capture on Chrome sees a finding within the WebGPU latency window (spec target: 950 ms / 256×256 on mid-range hardware).

#### Step 2.3 — HITL audit wiring (1 hour)
- [ ] Every Liquid AI suggestion emits `POST /api/on-device-ai/suggested`.
- [ ] Nurse accepting the suggestion emits `POST /api/on-device-ai/accepted`.
- [ ] Nurse editing the suggestion emits `POST /api/on-device-ai/edited` with the edited JSON as `editedPayload`.
- [ ] Nurse rejecting emits `POST /api/on-device-ai/rejected`.
- [ ] The worker route already validates `modelId` + `modelVersion` against the pinned manifest; it rejects calls that don't match with 400.

**Acceptance:** `audit_log` rows with `action LIKE 'on_device_ai.%'` appear within 10 s of each UI action; `wrangler tail` shows no 400/403 from the route.

### Day 3 — validation + rollout

#### Step 3.1 — Golden-image eval harness (½ day)
- [ ] Create `apps/web/tests/liquid-ai-eval.spec.ts` (Playwright/Vitest).
- [ ] Input: 20–50 curated images per module (from an existing dataset), each with a clinician-labelled ground truth.
- [ ] For each image, run `runLiquidAi(image, schema)` and compare the structured output to ground truth.
- [ ] Report: per-module agreement rate. Fail threshold: configurable, **set by clinical** (suggested starting point ≥ 0.80 top-1 agreement per module).
- [ ] Run the eval in CI on every PR touching `packages/liquid-ai` or `packages/shared/src/ai/module-schemas/`.

**Acceptance:** all modules meet the clinical-set threshold; eval runs in under 5 min in CI.

#### Step 3.2 — Staging rollout (1 hour)
- [ ] Deploy worker + web to staging.
- [ ] Flip `FEATURE_ON_DEVICE_AI=1` in staging env.
- [ ] Run a real screening end-to-end with 2–3 test patients.
- [ ] Verify: model downloads, shards hit OPFS, inference runs, HITL events fire, `clinician_review` is written.
- [ ] Clinical acceptance — at least one doctor reviews the suggestions quality and signs off.

**Acceptance:** clinical sign-off + zero errors in `wrangler tail` during the staging run.

#### Step 3.3 — Production rollout
- [ ] Flip `FEATURE_ON_DEVICE_AI=1` in prod via wrangler env.
- [ ] Soft launch: whitelist one campaign, monitor for 24–48h.
- [ ] Full rollout after the soft-launch window is clean.
- [ ] Update [docs/BLUEPRINT.md](docs/BLUEPRINT.md) §4A to remove "PENDING-PIN" + deferred language.
- [ ] Update [docs/BLUEPRINT.md](docs/BLUEPRINT.md) §11 to drop the Liquid AI rows from the deferred table.

**Acceptance:** nurse running a screening on a capable Chromebook sees AI suggestions sourced entirely from their browser; `wrangler r2 object get skids-models/models/<id>/<version>/mlc-chat-config.json` is hit N times per unique device and then zero for subsequent screenings on that device (OPFS cache hit).

---

## 4 · Safety invariants (do not break)

These are the non-negotiables from [the Phase 02 decision doc](specs/02-ai-gateway-langfuse.md) + [the Phase 02a-web plan](specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md). Your PR reviewer will check every one.

1. **Zero cloud egress for nurses.** No path from the nurse capture to any endpoint outside `skids-api` + R2. Enforce by: only fetching from `MODEL_ORIGIN_PATH`; never passing the image URL to anything but the local WebLLM engine. Test: run the screening with Chrome DevTools → Network tab filtered to "out of origin" — must be empty.
2. **Per-shard SHA-256 verification is non-negotiable.** If a shard mismatches, the loader must throw and never silently fall back. Keep the existing check in [loader.ts](packages/liquid-ai/src/web/loader.ts).
3. **Manifest is a literal constant.** No "latest" resolution at runtime. New model = new PR with a new literal diff. Silent upgrades are a clinical safety regression.
4. **Capability-gated degradation.** Nurses on unsupported browsers drop to manual-entry. **Never** silently route them to cloud AI. The capability check is the gate.
5. **Deterministic outputs.** Structured JSON per Zod schema. UI never consumes raw prose from the model.
6. **HITL audit on every decision.** If the audit call fails, log but don't block the nurse — just retry in the background.

---

## 5 · Rollback plan

Each step is independently reversible:

| If this breaks | Roll back by |
|---|---|
| Manifest diff corrupts the pin | Revert the PR. `isPlaceholderManifest()` starts returning `true` again; the route 404s (by design) until the next pin. |
| Web UI crashes for nurses | Flip `FEATURE_ON_DEVICE_AI=0` in wrangler env → redeploy web. AIAnalysisPanel falls back to manual-entry path. |
| Model weights corrupted in R2 | SHA-256 check in loader throws per-shard → OPFS entry deleted → user retries (next `wrangler r2 object put` fixes it). |
| HITL route erroring | Known-safe: audit failures are already non-blocking. Fix route, re-deploy. No data loss. |
| Eval threshold fails post-deploy | Flip feature flag off, investigate, reupload corrected weights or downgrade model version (new PR). |

---

## 6 · Tooling — the publish script

[scripts/publish-liquid-ai.sh](scripts/publish-liquid-ai.sh) ships alongside this handover as a **skeleton to complete**. What it does:

- Walks a local directory of MLC shards.
- Computes SHA-256 of each shard.
- Uploads each to `r2://skids-models/models/<id>/<version>/<shard>` via `wrangler r2 object put`.
- Emits a copy-pasteable `MODEL_MANIFEST` TypeScript literal to stdout.
- Verifies the remote SHA-256 after upload (re-fetches and re-hashes).

**You may need to adapt it** for your specific MLC shard naming convention — the script is defensive but MLC's tooling version may emit additional files (e.g. `ndarray-cache-b16.json` for bfloat16 builds).

---

## 7 · Open decisions you'll need to make

| # | Decision | Who decides | By when |
|---|---|---|---|
| A | LFM2.5-VL-450M vs fallback model | Clinical + product | Day 1 of work |
| B | Eval threshold per module (§3.1) | Clinical | Day 3 of work |
| C | Rollout cadence (single-campaign soft launch window) | Product + ops | Day 3 |
| D | Mobile track revival — Phase 02a-mobile was deferred; revisit once web is stable | Product | Post-launch |

---

## 8 · Glossary + references

- **LFM2.5-VL-450M** — Liquid Foundation Model 2.5, vision-language, 450M parameters. Target model.
- **MLC-LLM** — compiler/runtime from mlc.ai that produces q4f16_1 shards + a `web-llm` JS binding.
- **q4f16_1** — 4-bit weight quantization, float16 activations, group size 1. The quantization format WebLLM consumes.
- **OPFS** — Origin Private File System. Per-origin sandboxed file storage in the browser, best for large opaque blobs.
- **WebLLM MLCEngine** — `@mlc-ai/web-llm` package, reads MLC-compiled shards, runs inference via WebGPU.
- **HITL** — Human-in-the-loop. Every on-device suggestion has an acceptance/rejection record in `audit_log`.
- **PENDING-PIN** — the sentinel string in the placeholder manifest. `isPlaceholderManifest()` detects it.

---

_Last updated: 2026-04-17 · supersedes: (nothing, new doc) · next review: at Day 3 staging rollout._
