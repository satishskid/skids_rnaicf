# Data Residency — SKIDS Screen V3

Scope: personal health information (PHI) of minors collected during pediatric screening in India. Governing law: DPDP Act 2023. Default posture: **PHI stays in India or APAC; non-PHI may use global edges.**

## Service-by-service placement

| Service | Binding / region | Data class | Notes |
|---|---|---|---|
| Turso (libSQL, primary) | `aws-ap-south-1` (Mumbai) | PHI — structured | Replicas permitted in APAC only. Record actual `turso db show skids-v3 --regions` output in RUNBOOK. |
| Turso replicas | APAC only | PHI | Do not enable US/EU replicas. |
| R2 — `skids-media` | `APAC` jurisdiction | PHI — media | Photos, videos, audio. Signed URLs only. |
| R2 — `skids-reports` (Phase 3) | `APAC` | PHI — rendered PDFs | Keyed by HMAC-signed token. |
| R2 — `skids-analytics` raw (Phase 4) | `APAC` | PHI — aggregate + row-level | Access restricted to `analytics-worker` service binding. |
| R2 — `skids-analytics` publishable (Phase 4) | `APAC` | Non-PHI — de-identified | Output of `publishable_views.sql`. |
| R2 — `skids-models` (Phase 6) | `APAC` | Non-PHI | ONNX binaries + manifests. |
| R2 — `skids-evidence` (Phase 7) | `APAC` | Non-PHI | Curated clinical evidence. |
| Vectorize — `skids-evidence` (Phase 7) | Global (CF edge) | Non-PHI | Evidence-only index. PHI must never be upserted here. |
| Workers — `skids-api` | CF edge | PHI in transit only | No PHI persisted at the edge. |
| Workers — `analytics-worker` (Phase 4) | CF edge | PHI in transit | Reads Turso Mumbai, writes R2 APAC. |
| AI Gateway | Pinned APAC (Phase 2) | PHI in transit | Cache keys must not contain PHI literals. |
| Workers AI (`@cf/*`) | Regional availability varies | PHI in transit | Prefer APAC-available models; Langfuse trace records region. |
| Gemini / Claude API | Provider-hosted | PHI in transit | Gated through AI Gateway (Phase 2). |
| Langfuse | Self-hosted Mumbai OR cloud with PHI redaction | Metadata only | **PHI redacted before send** — R2 keys only, not bytes. |
| MotherDuck (Phase 8 — DEFERRED) | US | Non-PHI aggregates only | Gated by `studies.share_target='motherduck'` + consent. |

## Rules enforced in code

1. **No PHI outside APAC.** Any new binding to US/EU requires a doc amendment + security review PR.
2. **De-identification is an export boundary, not a storage convenience.** Row-level PHI stays in `skids-analytics` raw; only `publishable_views` exit that boundary.
3. **Vectorize = evidence only.** Upserting patient embeddings into Vectorize is a security bug.
4. **AI Gateway is mandatory** for all LLM / VLM calls after Phase 2. Direct Gemini / Claude calls are a policy violation.
5. **Langfuse payloads are redacted.** Redaction is tested (`tests/langfuse-redaction.test.ts` in Phase 2).

## Amendment log

| Date | Change | PR |
|---|---|---|
| 2026-04-15 | Initial baseline per Phase 00 preflight. | feat/edge-stack-v1-plan |
