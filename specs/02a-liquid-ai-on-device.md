# Phase 02a — On-device Liquid AI (LFM2.5-VL-450M)

## Goal

Run **Liquid AI LFM2.5-VL-450M** (released 2026-04-08; 450M params, Q4_0 ≈ 300MB, Samsung S25 Ultra runs 256×256 in 950ms, bounding-box accuracy 81.28 on RefCOCO-M, function calling via BFCLv4, 8 languages incl. Chinese / Korean / Japanese) on-device inside both the nurse and doctor apps.

Zero PHI egress during inference. Use bounding boxes + function calling to get **structured per-module outputs** the nurse UI can consume directly (no prose parsing).

## Why this matters

- **Protocol adherence**: every nurse screening runs the same deterministic model, not whichever cloud provider happened to be online that second.
- **Zero PHI egress**: the model runs on the device; images never leave.
- **Field-resilient**: works offline, which is the default state of school screening vans.
- **Cost**: free at inference time. Marginal cost is only the R2 model download (≈300 MB × install, versioned).

## Scope (draft — to be detailed when phase starts)

- **Model hosting**: R2 bucket `skids-models`, path `lfm2.5-vl-450m/<version>/{model.gguf,tokenizer.json,config.json,SHA256SUMS}`. Served via signed URL or direct public pull depending on residency review.
- **Runtime (web)**: WebLLM + WebGPU on Chrome/Edge; transformers.js WASM fallback for Safari/Firefox until WebGPU is universal. First-load prompts `Install on-device AI (300 MB, one-time)` with progress bar; deferred until first screening attempt to keep cold launches fast.
- **Runtime (mobile)**: evaluate Liquid AI's own **LEAP runtime** vs **MLC-LLM bridge** via React Native TurboModule. Prefer LEAP if it ships a stable RN API by start of phase; otherwise MLC-LLM.
- **Function-call schemas**: one per screening module (red_reflex, otoscopy, dental, skin, chip-annotation, etc.). Schemas live in `packages/shared/src/ai/module-schemas/<module>.ts` as Zod definitions so the runtime and the UI agree on the shape.
- **Capability gating**: devices that can't run LFM2.5-VL-450M (low RAM, no WebGPU, old Android) degrade to **manual-entry only** — no silent fallback to cloud AI (that would reopen the PHI-egress door we just closed).
- **Tests**:
  - Output-shape stability per module schema (record 20 golden inputs + expected schema hits, run in CI).
  - No-network-during-inference proof: fixture that runs inference with `fetch` stubbed to throw; asserts no network hit.
  - Model integrity: SHA256 match vs `SHA256SUMS` before first use.
- **Update strategy**: version-pinned per campaign via `ai_config.on_device_model_version`. Doctors get the latest; nurses upgrade at start-of-day only to avoid mid-campaign model drift.

## Interaction with Phase 02

- Phase 02 (cloud AI) is **strictly doctor-only** and admin-gated.
- Phase 02a (on-device) is **both nurse and doctor**, always on, no admin flag.
- Doctors get both: on-device Liquid AI for fast pre-analysis + optional cloud AI suggestion (labeled and audited).

## Status

TODO — full design to be written when Phase 02 is merged and Phase 02a is picked up.
