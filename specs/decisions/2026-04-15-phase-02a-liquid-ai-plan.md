# Phase 02a — On-device Liquid AI (LFM2.5-VL-450M): 15-minute architectural plan

**Date:** 2026-04-15
**Status:** DRAFT for review. No code yet.
**Authors:** claude-code
**Scope:** Planning only. Implementation branch `phase/02a-liquid-ai` to be created after this doc is approved.
**Companion phase:** Phase 03 (Sandbox PDF reports) — same-session counterpart plan at `specs/decisions/2026-04-15-phase-03-sandbox-pdfs-plan.md`. File overlap with Phase 03 is minimal (`wrangler.toml`, `specs/STATUS.md`, append-only edits to `packages/shared/src/index.ts` and `apps/worker/src/index.ts`).
**Related:** `specs/02a-liquid-ai-on-device.md` (stub), `specs/02-ai-gateway-langfuse.md` (cloud, doctor-only).

---

## Non-negotiables (from Phase 02 decision)

1. **Nurses do not touch cloud AI.** Phase 02 enforces this at the worker (`requireRole('doctor','admin')` on `/api/ai/*`). Phase 02a is the nurse's entire AI surface.
2. **Zero PHI egress during inference.** No image bytes leave the device. Verified by a no-network test fixture.
3. **Capability-gated degradation.** Devices that can't run the model drop to manual-entry. Never silently route to cloud.
4. **Deterministic outputs.** Function calling emits structured JSON per module schema; UI consumes the JSON, not prose.

---

## 1. Model loader strategy — WASM vs WebGPU vs LEAP native

### Web (`apps/web`)

**Recommendation: WebLLM + WebGPU primary, transformers.js WASM fallback.**

- **WebGPU (primary)** via `@mlc-ai/web-llm` — LFM2.5-VL-450M is MLC-compiled and distributed as a model-library package. Samsung S25 Ultra's quoted 950 ms / 256×256 assumes GPU; we only get it via WebGPU.
  - Availability: Chrome ≥113 desktop, Chrome ≥121 Android, Edge ≥113. Safari Tech Preview has WebGPU; stable Safari does not (as of 2026-04). Firefox desktop has it behind a flag.
  - First-load: ~300 MB `.wasm` + weights. Cached by WebLLM in OPFS where available.
- **transformers.js WASM (fallback)** for Safari stable, Firefox stable, old Chromium. Quantized Q4_0 runs, but 2–4× slower on desktop and unusably slow on most phones. We keep it for the "doctor on MacBook Safari" case; for nurses on unsupported devices we degrade to manual-entry, not WASM-slow.
- **Existing ONNX stack** (`apps/web/src/lib/ai/model-loader.ts`) stays. It powers lightweight per-module classifiers (ear, skin, photoscreening). Liquid AI is a **separate runtime** — different format (MLC tensor archive, not ONNX), different tokenizer, different scheduler. Do not try to unify via `onnxruntime-web`; the ONNX loader keeps its current job.

### Mobile (`apps/mobile`, React Native / Expo)

**Recommendation: LEAP native runtime if the RN binding lands by phase start; MLC-LLM RN bridge otherwise.**

- **LEAP (Liquid AI's own runtime)** is preferred — same company as the model, best shot at accuracy/perf parity with the headline numbers. Ship as an RN TurboModule (native Swift + Kotlin → JS bridge).
- **MLC-LLM RN bridge** is the fallback — mature, benchmarked, already used by WebLLM's sibling project. iOS via Metal, Android via Vulkan/OpenCL.
- **Do not extend `model-loader-mobile.ts`** (ONNX-oriented). Add a new `apps/mobile/src/lib/ai/liquid-ai.ts` that imports the chosen native module. The ONNX loader continues powering small on-device classifiers.

### Phase 02a gate decision (go/no-go on LEAP) — resolved 2026-04-15

**Time-boxed 4-hour spike on a throwaway branch, no commits to main.** Before any `phase/02a-liquid-ai` work lands, spend up to 4 hours evaluating `@liquid-ai/leap-react-native` (or equivalent) — install, instantiate, run one end-to-end inference on a test image. Report outcome (available + usable / available + broken / not shipped yet) back to the review channel. If negative, switch to MLC-LLM RN bridge and document the switch in the Phase 02a PR body. Throwaway branch is discarded regardless of outcome.

---

## 2. Caching strategy — IndexedDB vs OPFS vs Cache API

**Recommendation: OPFS on web (WebLLM default), `expo-file-system` on mobile.**

### Web

| Option | Fit for 300 MB LFM weights | Current repo use | Decision |
|---|---|---|---|
| Cache API | Works. ONNX loader uses it today (`apps/web/src/lib/ai/model-loader.ts:12` `MODEL_CACHE_NAME`). Opaque responses, per-origin eviction risk. | Yes, for ONNX. | Keep for existing ONNX. |
| IndexedDB | Works. But chunk-copy 300 MB into IDB is awkward; stream-write is possible but non-trivial. | No. | Reject. |
| **OPFS** (Origin Private File System) | Purpose-built for large blobs. Direct file-handle IO, no JSON wrapping. Best for random-access weight reads during inference. WebLLM defaults to OPFS when available. | No. | **Use for Liquid AI.** |

Implication: the Liquid AI loader writes to OPFS, not Cache API. `readiness-check.tsx`'s `isModelCached()` call site (for admin-provisioned ONNX models) stays on Cache API. We add a parallel `isLiquidAiCached()` that checks OPFS.

### Mobile

**`expo-file-system/legacy`** — already in use (see commit `3a585e9`). LEAP / MLC-LLM native modules accept a file path; RN writes downloaded weights to `FileSystem.documentDirectory + 'liquid-ai/<version>/'` with a SHA256 sidecar.

### Integrity

Every cache write validates the weights against `SHA256SUMS` pulled alongside the model archive. Mismatch → delete + refetch. Prevents partial-download corruption on flaky school-van networks.

---

## 3. Mobile vs web split

| Concern | Web | Mobile |
|---|---|---|
| Runtime | WebLLM (WebGPU) / transformers.js (WASM fallback) | LEAP (preferred) / MLC-LLM RN bridge |
| Cache | OPFS | `expo-file-system` (documentDirectory) |
| Download UX | `<ProgressBar>` in `readiness-check.tsx` | Foreground progress; Expo BackgroundFetch if app reopens mid-download |
| Capability probe | `navigator.gpu` + `OffscreenCanvas` + `SharedArrayBuffer` (COOP/COEP required) | RAM + CPU feature detect via native module's `isSupported()` |
| Manual-entry degrade | Chip-only form, AI analyze button disabled | Same; disable "Use AI" in `ModuleScreen.tsx:383` call path |

**Shared surface:** function-call schemas in `packages/shared/src/ai/module-schemas/<module>.ts` (new). Both platforms consume the same Zod schemas; both runtimes are asked to emit JSON matching the schema. Schema validation is the contract.

**What stays cross-platform:** Phase 02 audit-log action prefix reused (`on_device_ai.*`, paralleling `cloud_ai_suggestion.*`). HITL banner string: `"On-device screening aid — manual review required"` (distinct from the cloud banner).

---

## 4. Nurse-app integration points

Behind feature flag `FEATURE_ON_DEVICE_AI` (default ON once phase ships). No per-org toggle — nurse tier is zero-PHI-egress by policy, not opt-in.

### Mobile

| Site | Current | After Phase 02a |
|---|---|---|
| `apps/mobile/src/screens/ModuleScreen.tsx:383` — `analyzeImageOnDevice(analysisUri, moduleType)` | Pixel + ONNX pipeline → quality-gate + tier-1 output. | Same entry, pipeline adds tier-2: `runLiquidAi(imageUri, moduleSchema)` emits structured chip suggestions + bounding boxes. Fall back to tier-1 only on capability gate or model not installed. |
| `apps/mobile/src/lib/ai/pipeline.ts` | Orchestrates tier-1 → tier-3. Tier-3 was cloud Ollama/LLM in V3 (doctor-only per Phase 02). | Insert tier-2 on-device Liquid AI between tier-1 pixel and tier-3 cloud. Nurses stop at tier-2; doctors may continue. |
| `apps/mobile/src/lib/ai/llm-gateway.ts` — `queryLLM({role})` | Nurses coerced to `local_only` (defense in depth, Phase 02 refactor). | Unchanged. `local_only` now implicitly uses Liquid AI for vision, Ollama for chat. |

### Web

| Site | Current | After Phase 02a |
|---|---|---|
| `apps/web/src/components/ai/AIAnalysisPanel.tsx:114` — `mode === 'nurse'` forces `local_only` | Calls Ollama via `queryLLM`. Ollama path needs a networked laptop with a local model server. | Replace the `local_only` branch for nurses with `runLiquidAi(imageDataUrl, moduleSchema)`. Ollama path survives for doctor `local_first`/`dual` modes. |
| `apps/web/src/components/screening/readiness-check.tsx` | Checks ONNX models cached. No Liquid AI awareness. | Add a row: "Liquid AI (on-device, 300 MB)" — status/download button. Blocks `allDone` for nurses; warning-only for doctors (they have cloud fallback). |
| `apps/web/src/components/screening/annotation-chips.tsx:157` | Renders `AIAnalysisPanel` with `mode={mode}`. | Unchanged — panel internals switch. |

### Function-call schemas (new, `packages/shared/src/ai/module-schemas/`)

One file per module. Zod-defined, also exported as JSON Schema via `zod-to-json-schema` (for the runtime prompt). Examples:

- `red_reflex.ts` — `{ bothEyesBright: boolean, asymmetry: 'none'|'mild'|'marked', glareArtifact: boolean, retakeReason?: string }`
- `otoscopy.ts` — `{ canalPatent: boolean, tympanicMembraneVisible: boolean, erythema: 'none'|'mild'|'marked', perforation: boolean, boundingBoxes: Array<{label, x, y, w, h}> }`
- `dental.ts` — `{ cariesCount: number, gumInflammation: 'none'|'mild'|'marked', fluorosis: boolean }`
- Shared base: `BaseModuleSchema { confidence: number, retakeReason?: string, chipSuggestions: string[] }`.

Schemas are the contract: runtime prompt references them via BFCLv4 function-call header; UI validates incoming JSON against the Zod schema before rendering. Validation failure → "AI output invalid, annotate manually."

---

## 5. Doctor-app HITL integration points

Doctors use both Liquid AI (on-device, fast) and cloud AI (admin-gated per Phase 02). On-device runs first; cloud is opt-in per-review.

| Site | Behavior |
|---|---|
| `apps/mobile/src/screens/DoctorReviewScreen.tsx:84` — `queryLLM(DEFAULT_LLM_CONFIG, messages)` | Mode `local_first`: Liquid AI first; fall back to cloud (`/api/ai/vision`) on local failure or explicit re-analysis. |
| `apps/web/src/pages/DoctorInbox.tsx:210` — `queryLLM(llmConfig, messages)` | Same `local_first` default. Liquid AI result renders with on-device banner. "Request cloud second-opinion" button triggers the Phase 02 cloud path (gated by `ai_config.features.cloud_ai_suggestions`). |
| Audit trail | **No migration** — extend `audit_log.action` string domain only. Values: `on_device_ai.suggested`, `on_device_ai.accepted`, `on_device_ai.rejected`, `on_device_ai.edited`. Parallels Phase 02's `cloud_ai_suggestion.*`. New worker route `POST /api/on-device-ai/:outcome`. |

**Route naming:** new `/api/on-device-ai/:outcome`, not under `/api/ai/*` (that prefix is role-gated to doctor/admin per Phase 02; on-device outcomes come from nurses too).

---

## 6. LEAP fine-tune hook

LEAP runtime supports LoRA adapter loading (Liquid AI roadmap confirmed). Phase 02a ships with the base model only, but the loader is designed so adapters plug in without a second release.

- **Adapter storage:** `R2:skids-models/lfm2.5-vl-450m/adapters/<campaign|org>/<version>/adapter.safetensors + SHA256`.
- **Adapter selection:** `ai_config.features.on_device_adapter = "campaign:<code>"` | `"org:<id>"` | `null`. Loader reads on startup, fetches the named adapter if newer than local, applies at inference time.
- **Training pipeline (OUT OF SCOPE for 02a):** fed by doctor HITL decisions (`audit_log` entries of `on_device_ai.{accepted|rejected|edited}`). Phase 06-adjacent workflow. Phase 02a only leaves the adapter-loading hook.
- **Rollback:** set `on_device_adapter = null` → adapter disabled on next app open; base model always usable.
- **Residency:** adapter training happens off-device via a separate pipeline. We only download adapters here. No PHI in adapter weights *if* the training pipeline de-identifies inputs — constraint enforced by the training pipeline, not the loader.

---

## 7. Model update + version pinning

- **Version source of truth:** `ai_config.features.on_device_model_version` (per-org). Absent = latest.
- **Update cadence:** doctors auto-upgrade at app open. **Nurses upgrade only at start-of-day** (first login of the session) to avoid mid-campaign model drift that would break inter-child consistency.
- **R2 path:** `skids-models/lfm2.5-vl-450m/<version>/` (per Phase 02a stub). `<version>` = git-sha of the model-prep pipeline + base SHA256 prefix.
- **Manifest:** `skids-models/lfm2.5-vl-450m/latest.json` → `{ version, sha256, sizeBytes: 314572800, releasedAt, releaseNotes }`.

---

## 8. Capability gating + degrade

Probe at app startup (cached until next major version):

| Platform | Probe | Action on fail |
|---|---|---|
| Web Chrome/Edge | `navigator.gpu` present + adapter test | Try transformers.js WASM |
| Web Safari/Firefox (no WebGPU) | transformers.js WASM capability + RAM estimate (`navigator.deviceMemory`) | If <4 GB RAM: degrade to manual-entry |
| Mobile iOS | `FileSystem` + native module `isSupported()` | Degrade to manual-entry |
| Mobile Android | Native module `isSupported()` + `Device.totalMemory >= 4 GB` | Degrade to manual-entry |

UI: `ReadinessCheck` blocks `Start screening` for nurses if Liquid AI isn't installed AND device is capable. If device is incapable: show "Your device can't run on-device AI — you can still capture images and annotate manually." No silent cloud fallback, ever, for nurses.

---

## 9. Tests

- **Output-shape stability per schema.** 20 golden inputs per module (`packages/shared/test/fixtures/liquid-ai/<module>/`). Each paired with an expected-shape match. Regression breaks CI.
- **No-network proof.** Vitest (web) / Jest (RN) fixture stubs `fetch` to throw once Liquid AI is initialized; asserts inference completes and no network call fires.
- **Model integrity.** SHA256 check on first use + before every load. Simulated corruption → loader refuses, surfaces "Model corrupt, re-download."
- **Capability probe stability.** Mock `navigator.gpu` + `deviceMemory` matrix; assert probe output matches the degrade table.
- **Audit trail coverage.** HITL writes to `audit_log` with the right action string.

---

## 10. Risks & open questions

| Risk / Question | Mitigation / Owner |
|---|---|
| LEAP RN binding not shipping by phase start | Day-1 spike; MLC-LLM RN as fallback; document switch in PR body |
| WebGPU absent on a lot of nurse chromebooks | Capability gate → manual-entry. Not a silent cloud fallback. |
| 300 MB download over school-van cellular | Enforce Wi-Fi-only model fetch on mobile; web shows explicit prompt |
| Output schema drift across model versions | Strict Zod validation + golden-input CI regression tests |
| Adapter hook shipping early invites misuse before training pipeline exists | `ai_config.features.on_device_adapter` default null; loader no-ops when flag absent |
| `navigator.deviceMemory` unreliable / missing | Fall back to "try → catch OOM → degrade" with user-facing message |
| OPFS quota on low-storage devices | `navigator.storage.estimate()` pre-download; decline with "Free up 1 GB to install on-device AI" |

---

## 11. Phase 02a deliverables (preview, to be implemented)

1. `packages/liquid-ai/` (new package) — platform-agnostic loader interface, capability probe, schema validator, HITL outcome type.
2. `packages/liquid-ai/web/` — WebLLM + transformers.js backends.
3. `packages/liquid-ai/mobile/` — LEAP / MLC-LLM RN bridge.
4. `packages/shared/src/ai/module-schemas/*.ts` — one Zod schema per module.
5. Integration edits in `apps/mobile/src/lib/ai/pipeline.ts` + `apps/web/src/components/ai/AIAnalysisPanel.tsx`.
6. `ReadinessCheck` Liquid AI row.
7. Worker route `POST /api/on-device-ai/:outcome` for HITL audit.
8. **No migration.** Audit trail uses `audit_log.action` string extension only (`on_device_ai.{suggested,accepted,rejected,edited}`). Resolved 2026-04-15. Phase 03 holds the `0003_*` slot uncontested.
9. Tests + golden fixtures.
10. `docs/RUNBOOK.md` Phase 02a section: model provisioning, R2 upload script, adapter publish flow, OPFS debug instructions.

---

## 12. Coordination with Phase 03

| Surface | Phase 02a | Phase 03 | Conflict risk |
|---|---|---|---|
| `wrangler.toml` | Add R2 `skids-models` bucket binding + model manifest URLs (new block, `# Phase 02a`) | Add Sandbox binding + SANDBOX_SIGNING_KEY + cron + R2 lifecycle (new block, `# Phase 03`) | Low — append-only with header comments |
| `specs/STATUS.md` | Flip Phase 02a row only | Flip Phase 03 row only | Zero |
| Migrations | None — audit-trail extension only (`audit_log.action` string domain) | `0003_report_render_cache.sql` | Zero — resolved 2026-04-15 |
| `packages/shared/` | `src/ai/module-schemas/` new dir | `src/report-render-input.ts` new file | Zero |
| `packages/shared/src/index.ts` | Append exports for module-schemas | Append exports for report-render-input | Low — append-only; rebase resolves |
| `apps/worker/src/routes/` | `on-device-ai.ts` new | `report-render.ts` new, `report-tokens.ts` modified | Zero |
| `apps/worker/src/index.ts` | Register on-device-ai route | Register report-render route | Low — append-only in route-mount block |
| `apps/web/src/lib/ai/`, `apps/mobile/src/lib/ai/` | Extensive new files | Untouched | Zero |
| `docs/RUNBOOK.md` | Phase 02a section | Phase 3 section | Zero — append-only, different sections |

Rebase plan: whoever lands first wins. If Phase 03 lands first, Phase 02a rebases; conflicts resolve by taking both hunks in `wrangler.toml`, `STATUS.md`, `packages/shared/src/index.ts`, and `apps/worker/src/index.ts`.

---

## 13. Resolved open questions (2026-04-15)

6. **LEAP RN binding availability** — resolved via a **time-boxed 4-hour spike on a throwaway branch, no commits to main** (see §1 Gate decision). Outcome reported back to review before Phase 02a implementation lands.
7. **Audit trail migration** — **no migration**. Extend `audit_log.action` string domain: `on_device_ai.{suggested,accepted,rejected,edited}`. Phase 03 holds the `0003_*` migration slot.

## 14. What this plan deliberately does NOT commit to

- **No specific library version pins.** Day-1 spike confirms current state.
- **No performance guarantees.** The "950 ms / 256×256 on S25 Ultra" number is aspiration; actual perf is benchmarked per-device during rollout.
- **No replacement of existing ONNX classifiers.** Red-reflex, otoscopy, dental ONNX models keep running for their tier-1 quality-gate role.
- **No cloud-fallback for nurses under any condition.** Worth restating: this is the entire reason Phase 02a exists.
