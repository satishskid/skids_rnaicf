# Phase 6 — Sandbox Lane A: Heavy model re-analysis (second opinion)

**Goal**: When mobile Tier 1/2 returns low-confidence or medium-risk, trigger a Sandbox re-analysis using a larger ONNX model or Python ML pipeline. Store the second opinion as a parallel annotation in `ai_annotations` and feed the calibration loop.

**Prerequisites**: Phases 0, 2, 3, 5 complete. Turso vectors (Phase 1) useful but not strictly required.

**Effort**: 3 days.

---

## Read first

- `apps/mobile/src/lib/ai/pipeline.ts` — Tier 1/2/3 ensemble
- `apps/mobile/src/lib/ai/quality-gate.ts` — confidence/quality metrics already emitted
- `apps/mobile/src/lib/ai/vision-screening.ts`, `ear-analysis.ts`, `skin-analysis.ts`, `clinical-color.ts` — tier-1 analyzers
- `packages/shared/src/ai/accuracy-metrics.ts` — how agreement is measured
- `apps/worker/sandbox/` — Phase 3 sandbox image (we'll create a second image here)
- `apps/worker/src/queues/consumers/sandbox-second-opinion.ts` — stub from Phase 5

---

## Decisions

- **Trigger rule**: enqueue second opinion when ANY of:
  - `confidence < 0.75`
  - `risk_level == 2` (moderate) with `confidence < 0.90`
  - Module type is in `HIGH_VALUE_MODULES = ['vision','ear','skin','dental']`
  - Admin manual trigger
- **Model catalog**: per module type
  - Vision: `mobilenetv2-photoscreen-v3.onnx` (larger than mobile's quantized version)
  - Ear: ViT-small fine-tuned for otoscopy (loaded from R2 manifest)
  - Skin: SAM-tiny for wound segmentation + classifier head
  - Dental: clinical-color heuristics (Python, deterministic)
- **Model storage**: R2 `r2://skids-models/second-opinion/<module>/<version>/model.onnx`, versioned via manifest JSON
- **Output shape**: identical to Tier 1 `AIAnnotation` type so DoctorReviewScreen treats both uniformly (with a `tier` field)
- **Cost ceiling**: max 5 second-opinions per screening session; over budget → skip and flag
- **Idempotency**: same observation + same model version = same annotation (hash-keyed insert)

---

## Deliverables

1. `apps/worker/sandbox-ai/` — second Sandbox image (Python + onnxruntime)
2. `apps/worker/sandbox-ai/analyze.py` — single-input/single-output dispatcher
3. `apps/worker/sandbox-ai/models/` — skeleton folders + manifest.json
4. `scripts/publish-model.sh` — uploads a new model version to R2 + updates manifest
5. `apps/worker/src/queues/consumers/sandbox-second-opinion.ts` — full implementation (replaces Phase 5 stub)
6. Migration `0006_second_opinion.sql` — new `ai_annotations_secondary` table (keeps legacy column clean) + per-session budget tracker
7. New worker route `POST /api/observations/:id/second-opinion` — manual trigger (admin)
8. `apps/web/src/pages/DoctorInbox.tsx` — surface second-opinion annotations distinct from Tier 1
9. Feature flag `features_json.second_opinion` per org, with allow-list per module
10. Tests
11. Update `docs/RUNBOOK.md`

---

## Step-by-step

### 1. Sandbox image

`apps/worker/sandbox-ai/Dockerfile`:
```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
      onnxruntime==1.19.2 numpy==2.1.1 pillow==10.4.0 \
      opencv-python-headless==4.10.0.84 pydantic==2.9.0 boto3==1.35.0
WORKDIR /app
COPY analyze.py .
COPY models_registry.py .
ENTRYPOINT ["python", "analyze.py"]
```

Add to wrangler.toml:
```toml
[[sandbox]]
binding = "SANDBOX_AI"
image = "./sandbox-ai"
```

### 2. analyze.py

Contract:
- stdin: JSON `{ observation_id, module_type, model_version, r2_key_media, r2_access: {...} }`
- stdout: JSON `{ annotations: [...AIAnnotation], quality: {...}, ms_inference }`
- stderr: structured logs

Logic:
1. Fetch media from R2 (boto3 with provided temp credentials — issue via STS-style short-lived token from worker)
2. Load model bytes from R2 (cached on Sandbox's ephemeral FS between invocations)
3. Preprocess (module-specific)
4. Run ONNX inference
5. Post-process to `AIAnnotation[]`
6. Return JSON

Preprocessing + post-processing per module lives in `models_registry.py` as plugin modules. Each module exports `preprocess(image) -> tensor`, `postprocess(output) -> annotations`.

### 3. Models registry + publish script

`scripts/publish-model.sh`:
```bash
#!/usr/bin/env bash
# Usage: publish-model.sh <module> <version> <path_to_onnx>
# Uploads to r2://skids-models/second-opinion/<module>/<version>/model.onnx
# Updates r2://skids-models/second-opinion/manifest.json with sha256 + size
```

Manifest schema:
```json
{
  "version": "2026-04-14",
  "models": {
    "vision":  { "current": "v3.2", "sha256": "...", "path": "second-opinion/vision/v3.2/model.onnx" },
    "ear":     { "current": "v1.1", "sha256": "...", "path": "..." },
    "skin":    { "current": "v2.0", "sha256": "...", "path": "..." },
    "dental":  { "current": "v1.0", "sha256": "...", "path": "..." }
  }
}
```

Worker reads manifest on cold start, caches 10 min in KV.

### 4. Consumer

`apps/worker/src/queues/consumers/sandbox-second-opinion.ts`:

```typescript
export async function sandboxSecondOpinionConsumer(batch: MessageBatch, env: Env) {
  for (const msg of batch.messages) {
    try {
      const { observationId } = msg.body
      // 1. Load observation + related quality metrics
      // 2. Check session budget
      // 3. Resolve model version from manifest
      // 4. Idempotency: look up ai_annotations_secondary by (observation_id, model_version). If present, skip.
      // 5. Mint short-lived R2 creds (or use presigned URL for media_url)
      // 6. Spawn SANDBOX_AI, pipe input, capture output
      // 7. Insert into ai_annotations_secondary
      // 8. Compute agreement with Tier 1; write to accuracy_metrics table
      // 9. If disagreement severe → send to doctor review queue with elevated priority
      // 10. Emit Langfuse span + ai_usage row
      msg.ack()
    } catch (e) {
      if (msg.attempts >= 3) { /* goes to DLQ automatically */ }
      msg.retry({ delaySeconds: 60 * msg.attempts })
    }
  }
}
```

### 5. Migration

`0006_second_opinion.sql`:
```sql
CREATE TABLE IF NOT EXISTS ai_annotations_secondary (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  annotations TEXT NOT NULL,         -- JSON array
  quality TEXT,                      -- JSON
  ms_inference INTEGER,
  agreement_tier1 REAL,              -- 0..1
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(observation_id, model_version)
);
CREATE INDEX IF NOT EXISTS idx_second_obs ON ai_annotations_secondary(observation_id);

CREATE TABLE IF NOT EXISTS session_ai_budget (
  session_id TEXT PRIMARY KEY,
  second_opinion_count INTEGER DEFAULT 0,
  last_update TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accuracy_metrics (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  module_type TEXT NOT NULL,
  tier1_label TEXT,
  tier2_label TEXT,
  secondary_label TEXT,
  doctor_label TEXT,
  agreement_score REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 6. Manual trigger route

`POST /api/observations/:id/second-opinion` (admin or doctor role):
- Enqueues a `sandbox-second-opinion` message with priority=urgent
- Writes audit_log
- Returns `{ queuedMessageId }`

Used from DoctorInbox when the doctor wants a model to re-look.

### 7. UI surface

`DoctorInbox.tsx` — for each observation:
- Show Tier 1 badge (existing)
- If `ai_annotations_secondary` exists, show a second badge with `agreement_tier1` — green if >0.8, amber 0.5–0.8, red <0.5
- "Request second opinion" button → manual trigger route

### 8. Tests

- Stub Sandbox with deterministic fake analyzer
- Unit: consumer handles a message end-to-end → row inserted, agreement computed
- Idempotency: enqueue same observation twice → second call no-ops
- Budget: 6 second-opinions in one session → 6th rejected with `budget_exceeded`
- Model swap: update manifest to new version → next analysis uses new model (integration)
- Disagreement: Tier 1 says normal, secondary says abnormal → routing flag lit

### 9. Runbook

- How to publish a new model version (script)
- How to roll back a model (revert manifest + clear KV cache)
- How to interpret `agreement_score` in accuracy_metrics
- SLA: second-opinion median latency target < 30s, P95 < 90s

---

## Acceptance criteria

- [ ] Sandbox image builds < 400MB, cold start < 6s
- [ ] Second-opinion lands in DB within 60s P95 for vision module
- [ ] Agreement score calculated for every completed second-opinion
- [ ] DoctorInbox shows both Tier 1 and Secondary annotations distinctly
- [ ] Session budget enforced
- [ ] Model manifest update visible in next run without redeploy
- [ ] Feature flag per-org works (off → queue still accepts but consumer skips, logs `flag_off`)
- [ ] `accuracy_metrics` populated, queryable in DuckDB Q1

## Rollback

Feature flag off globally. Queue drains as no-ops. No data loss. Migration additive.

## Out of scope

- Training pipeline for new models (manual publish for now)
- Auto-calibration of mobile quality gate thresholds (separate epic, reads accuracy_metrics)
- Active learning / uncertainty-based model selection (future)
