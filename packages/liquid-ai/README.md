# @skids/liquid-ai

On-device Liquid AI (LFM2.5-VL-450M) loader, capability probe, schema validator,
and HITL outcome types.

**Status:** Phase 02a-web active. Mobile track deferred (no published RN binding
for Liquid AI or MLC-LLM as of 2026-04-15 — see
`specs/decisions/2026-04-15-phase-02a-mobile-deferred.md`).

## Layout

```
src/
  index.ts        # public barrel
  types.ts        # LiquidAiLoader, CapabilityReport, HitlEvent, etc.
  web/            # WebLLM + transformers.js backends (landed in a follow-up commit)
```

## Non-negotiables (from Phase 02 / 02a-web)

1. Nurses do not touch cloud AI. On web, this package is the nurse's entire AI surface.
2. Zero PHI egress during inference — no image bytes leave the device.
3. Capability-gated degradation: incapable devices fall back to manual-entry,
   never silently to cloud.
4. Deterministic outputs: function-call JSON validated against Zod module
   schemas from `@skids/shared/ai/module-schemas`.

## Plan

See `specs/decisions/2026-04-15-phase-02a-web-liquid-ai-plan.md`.
