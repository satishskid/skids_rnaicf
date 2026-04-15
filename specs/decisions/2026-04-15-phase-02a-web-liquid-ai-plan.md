# Phase 02a-web — On-device Liquid AI (LFM2.5-VL-450M), web track only

**Date:** 2026-04-15 (amended after LEAP RN spike NO-GO on the same day)
**Status:** Active plan for the web track. Implementation branch `phase/02a-web-liquid-ai`.
**Authors:** claude-code
**Scope change:** Originally covered web + mobile. Mobile track **split off as `Phase 02a-mobile`, now DEFERRED** — see `specs/decisions/2026-04-15-phase-02a-mobile-deferred.md`. Reason: no published RN binding for Liquid AI or MLC-LLM on public npm; hand-wrapping native SDKs via TurboModule is out of scope for this phase.
**Companion phase:** Phase 03 (Sandbox PDF reports) in a parallel session at `specs/decisions/2026-04-15-phase-03-sandbox-pdfs-plan.md`. File overlap with Phase 03 is zero for the web track — only `specs/STATUS.md` (different rows) and `apps/worker/src/index.ts` (append-only route mount).
**Related:** `specs/02a-liquid-ai-on-device.md` (original stub, superseded by this doc + the mobile-deferred doc), `specs/02-ai-gateway-langfuse.md` (cloud, doctor-only).

## Scope statement (post-split)

This plan covers **`apps/web` only**: nurses and doctors on browsers running LFM2.5-VL-450M via WebGPU (WebLLM) with a WASM fallback (transformers.js). Caching in OPFS. HITL audit via `POST /api/on-device-ai/:outcome`.

**Explicitly out of scope:** `apps/mobile`, any React Native native-module work, LEAP runtime, MLC-LLM RN bridge. Mobile nurses continue pre-02a behavior (manual-entry + ONNX quality gates); mobile doctors continue to use Phase 02 cloud AI via admin-gated `/api/ai/vision`. This interim state is acceptable because **most current clinical screening flow is on web deployments.**

---

## Non-negotiables (from Phase 02 decision)

1. **Nurses do not touch cloud AI.** Phase 02 enforces this at the worker (`requireRole('doctor','admin')` on `/api/ai/*`). On web, Phase 02a-web is the nurse's entire AI surface. On mobile, nurses run manual-entry until Phase 02a-mobile reopens.
2. **Zero PHI egress during inference.** No image bytes leave the device. Verified by a no-network test fixture.
3. **Capability-gated degradation.** Browsers that can't run the model (Safari stable, Firefox stable without WebGPU flag, low-RAM devices) drop to manual-entry. Never silently route nurses to cloud.
4. **Deterministic outputs.** Function calling emits structured JSON per module schema; UI consumes the JSON, not prose.

---

## 1. Model loader strategy (web)

**Recommendation: WebLLM + WebGPU primary, transformers.js WASM fallback.**

- **WebGPU (primary)** via `@mlc-ai/web-llm` (npm `0.2.82`, verified present on registry 2026-04-15). LFM2.5-VL-450M is MLC-compiled and distributed as a model-library package. Samsung S25 Ultra's quoted 950 ms / 256×256 assumes GPU; we only get it via WebGPU.
  - Availability: Chrome ≥113 desktop, Chrome ≥121 Android, Edge ≥113. Safari Tech Preview has WebGPU; stable Safari does not as of 2026-04. Firefox desktop has it behind a flag.
  - First-load: ~300 MB weights + runtime. Cached by WebLLM in OPFS where available, IndexedDB otherwise.
- **transformers.js WASM (fallback)** for Safari stable, Firefox stable, old Chromium. Quantized Q4_0 runs, but 2–4× slower on desktop and unusably slow on most phones-via-browser. We keep it for "doctor on MacBook Safari" scenarios; for nurses on unsupported devices we degrade to manual-entry, never WASM-slow.
- **Existing ONNX stack** (`apps/web/src/lib/ai/model-loader.ts`) stays untouched. It powers lightweight per-module classifiers (ear, skin, photoscreening). Liquid AI is a **separate runtime** — different format (MLC tensor archive, not ONNX), different tokenizer, different scheduler. Do not try to unify via `onnxruntime-web`; the ONNX loader keeps its current job.

---

## 2. Caching strategy (web)

**Recommendation: OPFS, via WebLLM defaults.**

| Option | Fit for 300 MB LFM weights | Current repo use | Decision |
|---|---|---|---|
| Cache API | Works. ONNX loader uses it today (`apps/web/src/lib/ai/model-loader.ts:12` `MODEL_CACHE_NAME`). Opaque responses, per-origin eviction risk. | Yes, for ONNX. | Keep for existing ONNX. |
| IndexedDB | Works. Chunk-copy 300 MB into IDB is awkward; WebLLM auto-falls-back to IDB when OPFS is absent. | No. | Auto-fallback only. |
| **OPFS** (Origin Private File System) | Purpose-built for large blobs. Direct file-handle IO, best for random-access weight reads during inference. WebLLM defaults to OPFS when available. | No. | **Primary for Liquid AI.** |

The Liquid AI loader writes to OPFS. `readiness-check.tsx`'s `isModelCached()` call site (for admin-provisioned ONNX models) stays on Cache API. We add a parallel `isLiquidAiCached()` that checks OPFS.

### Integrity

Every cache write validates weights against `SHA256SUMS` pulled alongside the model archive. Mismatch → delete + refetch. Prevents partial-download corruption on flaky school-van networks.

---

## 3. Nurse-app integration points (web)

Behind feature flag `FEATURE_ON_DEVICE_AI` (default ON once phase ships). No per-org toggle — nurse tier is zero-PHI-egress by policy, not opt-in.

| Site | Current | After Phase 02a-web |
|---|---|---|
| `apps/web/src/components/ai/AIAnalysisPanel.tsx:114` — `mode === 'nurse'` forces `local_only` | Calls Ollama via `queryLLM`. Ollama requires a networked laptop with a local model server — unusable on Chromebooks. | Replace the `local_only` branch for nurses with `runLiquidAi(imageDataUrl, moduleSchema)`. Ollama path survives for doctor `local_first`/`dual` modes. |
| `apps/web/src/components/screening/readiness-check.tsx` | Checks ONNX models cached. No Liquid AI awareness. | Add a row: "Liquid AI (on-device, ≈300 MB)" — status/download button. Blocks `allDone` for nurses on capable browsers; warning-only for doctors (they have cloud fallback via Phase 02). |
| `apps/web/src/components/screening/annotation-chips.tsx:157` | Renders `AIAnalysisPanel` with `mode={mode}`. | Unchanged — panel internals switch. |

### Function-call schemas (new, `packages/shared/src/ai/module-schemas/`)

One file per module. Zod-defined, also exported as JSON Schema via `zod-to-json-schema` (for the runtime prompt). Examples:

- `red_reflex.ts` — `{ bothEyesBright: boolean, asymmetry: 'none'|'mild'|'marked', glareArtifact: boolean, retakeReason?: string }`
- `otoscopy.ts` — `{ canalPatent: boolean, tympanicMembraneVisible: boolean, erythema: 'none'|'mild'|'marked', perforation: boolean, boundingBoxes: Array<{label, x, y, w, h}> }`
- `dental.ts` — `{ cariesCount: number, gumInflammation: 'none'|'mild'|'marked', fluorosis: boolean }`
- Shared base: `BaseModuleSchema { confidence: number, retakeReason?: string, chipSuggestions: string[] }`.

Schemas are the contract: the runtime prompt references them via BFCLv4 function-call header; UI validates incoming JSON against the Zod schema before rendering. Validation failure → "AI output invalid, annotate manually."

When Phase 02a-mobile eventually lands, it consumes the same schemas — no duplication.

---

## 4. Doctor-app HITL integration points (web)

Doctors use both Liquid AI (on-device, fast) and cloud AI (admin-gated per Phase 02). On-device runs first; cloud is opt-in per-review.

| Site | Behavior |
|---|---|
| `apps/web/src/pages/DoctorInbox.tsx:210` — `queryLLM(llmConfig, messages)` | Mode `local_first`: Liquid AI first; fall back to cloud (`/api/ai/vision`) on local failure or explicit re-analysis. Liquid AI result renders with on-device banner. "Request cloud second-opinion" button triggers the Phase 02 cloud path (gated by `ai_config.features.cloud_ai_suggestions`). |
| Audit trail | **No migration** — extend `audit_log.action` string domain only: `on_device_ai.suggested`, `on_device_ai.accepted`, `on_device_ai.rejected`, `on_device_ai.edited`. Parallels Phase 02's `cloud_ai_suggestion.*`. New worker route `POST /api/on-device-ai/:outcome`. |

**Route naming:** new `/api/on-device-ai/:outcome`, not under `/api/ai/*` (that prefix is role-gated to doctor/admin per Phase 02; on-device audits come from nurses too).

HITL banner string: `"On-device screening aid — manual review required"` (distinct from the cloud banner `"AI Suggestion — Doctor's Diagnosis Required"`).

---

## 5. LEAP fine-tune hook (web)

LEAP's LoRA adapter loading works on WebLLM too (MLC compiles adapters identically). Phase 02a-web ships with the base model only, but the loader is designed so adapters plug in without a second release.

- **Adapter storage:** `R2:skids-models/lfm2.5-vl-450m/adapters/<campaign|org>/<version>/adapter.safetensors + SHA256`.
- **Adapter selection:** `ai_config.features.on_device_adapter = "campaign:<code>"` | `"org:<id>"` | `null`. Loader reads on startup, fetches the named adapter if newer than local, applies at inference time.
- **Training pipeline (OUT OF SCOPE for 02a-web):** fed by doctor HITL decisions (`audit_log` entries of `on_device_ai.{accepted|rejected|edited}`). Phase 06-adjacent workflow.
- **Rollback:** set `on_device_adapter = null` → adapter disabled on next app open; base model always usable.

---

## 6. Model update + version pinning (web)

- **Version source of truth:** `ai_config.features.on_device_model_version` (per-org). Absent = latest.
- **Update cadence:** doctors auto-upgrade at app open. **Nurses upgrade only at start-of-day** (first login of the session) to avoid mid-campaign model drift that would break inter-child consistency.
- **R2 path:** `skids-models/lfm2.5-vl-450m/<version>/` (per Phase 02a stub). `<version>` = git-sha of the model-prep pipeline + base SHA256 prefix.
- **Manifest:** `skids-models/lfm2.5-vl-450m/latest.json` → `{ version, sha256, sizeBytes: 314572800, releasedAt, releaseNotes }`.

---

## 7. Capability gating + degrade (web)

Probe at app startup (cached until next major version):

| Browser | Probe | Action on fail |
|---|---|---|
| Chrome / Edge with WebGPU | `navigator.gpu` present + adapter test | Try transformers.js WASM |
| Safari / Firefox stable (no WebGPU) | transformers.js WASM capability + RAM estimate (`navigator.deviceMemory`) | If <4 GB RAM: degrade to manual-entry |
| Any browser, `navigator.storage.estimate()` < 1 GB free | Storage quota check before download | Decline with "Free up 1 GB to install on-device AI" |

UI: `ReadinessCheck` blocks `Start screening` for nurses if Liquid AI isn't installed AND device is capable. If device is incapable: show "Your browser can't run on-device AI — you can still capture images and annotate manually." No silent cloud fallback, ever, for nurses.

---

## 8. Tests

- **Output-shape stability per schema.** 20 golden inputs per module (`packages/shared/test/fixtures/liquid-ai/<module>/`). Each paired with an expected-shape match. Regression breaks CI.
- **No-network proof.** Vitest fixture stubs `fetch` to throw once Liquid AI is initialized; asserts inference completes and no network call fires.
- **Model integrity.** SHA256 check on first use + before every load. Simulated corruption → loader refuses, surfaces "Model corrupt, re-download."
- **Capability probe stability.** Mock `navigator.gpu` + `deviceMemory` matrix; assert probe output matches the degrade table.
- **Audit trail coverage.** HITL writes to `audit_log` with the right action string.

---

## 9. Risks & open questions

| Risk / Question | Mitigation / Owner |
|---|---|
| WebGPU absent on many nurse Chromebooks | Capability gate → manual-entry. Not a silent cloud fallback. |
| 300 MB download over school-van cellular | Check `navigator.connection.effectiveType`; prompt explicitly on slow links ("Downloading over cellular — continue?"). |
| Output schema drift across model versions | Strict Zod validation + golden-input CI regression tests |
| Adapter hook shipping early invites misuse before training pipeline exists | `ai_config.features.on_device_adapter` default null; loader no-ops when flag absent |
| `navigator.deviceMemory` unreliable / missing | Fall back to "try → catch OOM → degrade" with user-facing message |
| OPFS quota on low-storage devices | `navigator.storage.estimate()` pre-download; decline with actionable error message |

---

## 10. Phase 02a-web deliverables (preview)

1. `packages/liquid-ai/` (new package) — platform-agnostic loader interface (web impl only; mobile impl deferred), capability probe, schema validator, HITL outcome type.
2. `packages/liquid-ai/web/` — WebLLM + transformers.js backends.
3. **NOT in this phase:** `packages/liquid-ai/mobile/` — deferred per mobile-deferral doc.
4. `packages/shared/src/ai/module-schemas/*.ts` — one Zod schema per module.
5. Integration edits in `apps/web/src/components/ai/AIAnalysisPanel.tsx` + `readiness-check.tsx`.
6. Worker route `POST /api/on-device-ai/:outcome` for HITL audit.
7. **No migration.** Audit trail uses `audit_log.action` string extension only.
8. Tests + golden fixtures.
9. `docs/RUNBOOK.md` Phase 02a-web section: model provisioning, R2 upload script, adapter publish flow, OPFS debug instructions.

---

## 11. Coordination with Phase 03

| Surface | Phase 02a-web | Phase 03 | Conflict risk |
|---|---|---|---|
| `wrangler.toml` | Add R2 `skids-models` bucket binding + model manifest URLs (new block, `# Phase 02a-web`) | Add Sandbox binding + R2_REPORTS_BUCKET + SANDBOX_SIGNING_KEY + cron + R2 lifecycle (new block, `# Phase 03`) | Low — append-only with header comments |
| `specs/STATUS.md` | Flip Phase 02a-web row only | Flip Phase 03 row only | Zero |
| Migrations | None — audit-trail extension only | `0003_report_render_cache.sql` | Zero — resolved 2026-04-15 |
| `packages/shared/` | `src/ai/module-schemas/` new dir | `src/report-render-input.ts` new file | Zero |
| `packages/shared/src/index.ts` | Append exports for module-schemas | Append exports for report-render-input | Low — append-only; rebase resolves |
| `apps/worker/src/routes/` | `on-device-ai.ts` new | `report-render.ts` new, `report-tokens.ts` modified | Zero |
| `apps/worker/src/index.ts` | Register on-device-ai route | Register report-render route | Low — append-only in route-mount block |
| `apps/web/src/lib/ai/` | Extensive new files | Untouched | Zero |
| `docs/RUNBOOK.md` | Phase 02a-web section | Phase 3 section | Zero — append-only, different sections |

Rebase plan: whoever lands first wins. Conflicts resolve by taking both hunks.

**Working-tree discipline (both sessions share the same tree):**
- Never `git add .` or `git add -A`.
- Always stage specific paths: `git add packages/liquid-ai/ packages/shared/src/ai/module-schemas/ apps/worker/src/routes/on-device-ai.ts apps/web/src/components/ai/ apps/web/src/components/screening/readiness-check.tsx docs/RUNBOOK.md specs/STATUS.md wrangler.toml` (worker wrangler.toml only — coordinate hunk with Phase 03).
- Before each commit: `git status` and confirm only Phase 02a-web paths are staged.
- Phase 03 paths to leave alone: `packages/db/src/migrations/0003_*`, `packages/db/src/schema.sql`, `apps/worker/src/routes/report-render.ts`, `apps/worker/src/routes/report-tokens.ts`, `apps/worker/sandbox/`, `packages/shared/src/report-render-input.ts`.

---

## 12. Resolved open questions

6. **LEAP RN binding availability** — resolved 2026-04-15 via spike: NO-GO. `@liquid-ai/leap-react-native` (and all variant names) not published on public npm. MLC-LLM RN also unpublished. Mobile track split to `Phase 02a-mobile` and deferred. See `specs/decisions/2026-04-15-phase-02a-mobile-deferred.md`.
7. **Audit trail migration** — no migration. `audit_log.action` string domain extension only: `on_device_ai.{suggested,accepted,rejected,edited}`.

---

## 13. What this plan deliberately does NOT commit to

- **No specific library version pins.** Day-1 of implementation confirms current state of `@mlc-ai/web-llm`.
- **No performance guarantees.** The "950 ms / 256×256 on S25 Ultra" number is aspiration; actual per-device benchmarks happen during rollout.
- **No replacement of existing ONNX classifiers.** Red-reflex, otoscopy, dental ONNX models keep running for their tier-1 quality-gate role.
- **No cloud-fallback for nurses under any condition.** Worth restating — this is the entire reason Phase 02a exists.
- **No mobile work.** Deferred; see `specs/decisions/2026-04-15-phase-02a-mobile-deferred.md`.
