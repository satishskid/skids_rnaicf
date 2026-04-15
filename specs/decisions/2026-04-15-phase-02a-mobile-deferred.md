# Phase 02a-mobile — DEFERRED pending upstream RN binding

**Date:** 2026-04-15
**Status:** DEFERRED
**Authors:** claude-code
**Parent plan:** `specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md` (web track, active)
**Original stub (superseded):** `specs/02a-liquid-ai-on-device.md`

---

## Summary

The mobile track of Phase 02a — running LFM2.5-VL-450M on iOS + Android inside the Expo React Native app at `apps/mobile` — is **deferred indefinitely**, pending one of two triggers:

1. Liquid AI (or an equivalent upstream) publishes a usable React Native binding to public npm.
2. We allocate an explicit native-module-wrapping sprint (~3–5 engineering days estimated, often 2+ weeks in practice for a new native TurboModule) and commit to long-term maintenance of that wrapper.

Until one of those happens, the mobile app uses the same behavior it had before Phase 02a:

- **Mobile nurses:** manual-entry + existing ONNX quality gates via `apps/mobile/src/lib/ai/model-loader-mobile.ts`. No cloud AI — Phase 02 `requireRole('doctor','admin')` on `/api/ai/*` still blocks them.
- **Mobile doctors:** continue to use Phase 02 cloud AI via admin-gated `/api/ai/vision`. HITL banner + audit unchanged.

This interim state is acceptable because **most current clinical screening flow is on web deployments**, where Phase 02a-web delivers the on-device coverage.

---

## Spike outcome (2026-04-15)

Time-boxed 4-hour investigation, throwaway branch `spike/leap-rn-binding` (created + deleted, zero commits, zero push).

### Registry evidence

| Probed package | Result |
|---|---|
| `@liquid-ai/leap-react-native` | 404 not in registry |
| `@liquidai/leap-react-native` | 404 |
| `@liquid4/leap`, `@liquid/ai`, `@liquid/rn`, `@liquidai/react-native` | 404 × 4 |
| `lfm2-react-native`, `lfm-react-native`, `@lfm/react-native`, `liquid-ai-rn` | 404 × 4 |
| `npm search liquid-ai` / `liquidai` / `lfm2` | zero relevant hits |
| `leap-react-native@2.2.1` | EXISTS, but published by **Whatfix** (maintainers: `jiny_dev`, `ashish-whatfix`, `aravind-whatfix`, `wfx_arnold_laishram`, `kathir-whatfix`) — their digital-adoption-platform product. **Unrelated to Liquid AI** despite the shared "LEAP" name. |
| `@mlc-ai/web-llm@0.2.82` | EXISTS — Phase 02a-web fallback stays viable. |
| `mlc-llm`, `@mlc-ai/mlc-llm`, `@mlc-ai/*-react-native` | 404 — no published MLC-LLM React Native module. |

### Conclusion

- **No public npm RN binding exists for Liquid AI as of 2026-04-15.**
- **No public npm RN binding exists for MLC-LLM either.** The iOS / Android MLC-LLM SDKs are distributed as native artifacts that require hand-written TurboModule wrappers — a multi-day native-integration effort, not a drop-in dependency.
- Spike did not run on hardware. Device benchmarks (model load time, first-inference time, peak RSS) require iOS / Android devices and signing credentials — out of scope for a library-availability spike. If the package had been available, the second half of the spike budget would have covered device runs.

---

## Why this is the right call

1. **Both npm paths are blocked.** "Phase 02a-mobile ships with both platforms" would necessarily become a native-SDK-wrapping project, which is a different scope.
2. **Upstream motion is likely.** Liquid AI released LFM2.5-VL-450M on 2026-04-08, seven days before this spike. An RN binding may appear in weeks. Waiting is cheap; wrapping is expensive.
3. **Clinical impact is preserved.** Web deployments carry the majority of current screening traffic; Phase 02a-web delivers on-device coverage there.
4. **Interim behavior is defensible.** Mobile nurses never had Phase 02a; they keep running pre-02a. Nothing regresses.

---

## Reopen triggers

Phase 02a-mobile reopens — becoming an active phase again — when either of these happens:

### Trigger A: Upstream RN binding lands

- Liquid AI publishes `@liquid-ai/*` or similar to npm, OR
- MLC-LLM publishes an RN package, OR
- A credible community binding with >100 GitHub stars and >1 MB/month npm downloads emerges.

**Action:** rerun the 4-hour spike against the new package. If GO, reopen Phase 02a-mobile and implement using the existing Phase 02a-web plan as a template (swap web runtime for native).

### Trigger B: Native-module sprint allocated

- Explicit decision to fund 5–10 engineering days for a TurboModule around MLC-LLM's native SDKs.

**Action:** write a full Phase 02a-mobile design doc covering iOS linker config, Android CMake / Gradle, model artifact bundling vs dynamic download, memory management hand-off, RN `new-architecture` compatibility, Expo dev-client integration.

Do **not** reopen on a "it's been a while" schedule. One of the two triggers has to fire.

---

## What the mobile track will need when it reopens

Captured now so we don't re-derive in six months:

- **Runtime candidates:** LEAP-native (preferred, if published) → MLC-LLM RN bridge (fallback) → custom ONNX-runtime-mobile inference if both remain unavailable.
- **Cache:** `expo-file-system/legacy` at `FileSystem.documentDirectory + 'liquid-ai/<version>/'` with SHA256 sidecar. Already in use for other artifacts.
- **Integration points:**
  - `apps/mobile/src/screens/ModuleScreen.tsx:383` — `analyzeImageOnDevice(analysisUri, moduleType)` — add tier-2 on-device Liquid AI between tier-1 pixel and tier-3 cloud. Nurses stop at tier-2.
  - `apps/mobile/src/lib/ai/pipeline.ts` — orchestrator; same tier-2 insertion point.
  - `apps/mobile/src/lib/ai/llm-gateway.ts` — `queryLLM({role})`; no behavior change, `local_only` implicitly uses Liquid AI for vision once available.
  - `apps/mobile/src/screens/DoctorReviewScreen.tsx:84` — `queryLLM(DEFAULT_LLM_CONFIG, messages)`; mode `local_first` tries Liquid AI, falls back to cloud.
- **Capability gating:** iOS `isSupported()` via native module; Android `Device.totalMemory >= 4 GB` + native `isSupported()`. Degrade to manual-entry on fail — never silent cloud fallback for nurses.
- **Version pinning:** `ai_config.features.on_device_model_version` (same flag as web).
- **Update cadence:** doctors auto-upgrade at app open; nurses upgrade only at start-of-day (Wi-Fi required).
- **Tests:** same golden-fixture + no-network + SHA256 pattern as web, platform-specific harness.
- **Migration:** none — reuses the `audit_log.action` extension from Phase 02a-web (`on_device_ai.{suggested,accepted,rejected,edited}`).
- **Shared assets reusable:** `packages/shared/src/ai/module-schemas/` (Zod schemas), `packages/liquid-ai/` interface (web implements, mobile will implement later).

---

## Cross-references

- Active web plan: `specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md`
- Phase 02 cloud AI (doctor-only, admin-gated): `specs/02-ai-gateway-langfuse.md`
- Original stub (superseded by this doc + the web plan): `specs/02a-liquid-ai-on-device.md`
- Parent screening architecture: `specs/SYSTEM_WORKFLOW.md` if present, else master plan
- Parent status tracker: `specs/STATUS.md` (rows: `02a-web` active, `02a-mobile` deferred)
