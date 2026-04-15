# Phase 7 — Vectorize for Evidence Library RAG

**Goal**: Make DoctorReviewScreen clinically rich. When a doctor opens an observation, surface (a) the top-5 evidence snippets from a curated library and (b) top-5 similar past cases from Turso vectors. Two different retrieval paths, one unified UI.

**Prerequisites**: Phases 0, 1 (Turso vectors), 2 (AI Gateway + Langfuse).

**Effort**: 2 days.

---

## Read first

- `packages/shared/src/condition-descriptions.ts` — existing structured condition catalog
- `packages/shared/src/four-d-mapping.ts` — condition → module mapping
- `apps/web/src/pages/DoctorInbox.tsx` and `ChildReport.tsx`
- `apps/mobile/src/screens/DoctorReviewScreen.tsx`
- `apps/worker/src/routes/similarity.ts` (Phase 1)

---

## Decisions

- **Content sources** (all curated, no PHI):
  1. `condition-descriptions.ts` rows (already structured)
  2. M-CHAT items (`mchat-scoring.ts`)
  3. Motor task descriptions (`motor.ts`)
  4. Clinical color references (`clinical-color.ts`)
  5. Parent education copy (`parent-education.ts`)
  6. Optional: PDFs dropped in `r2://skids-evidence/library/` — parsed via Sandbox + liteparse
- **Embedding model**: same as Phase 1 — `@cf/baai/bge-small-en-v1.5` (384-dim)
- **Vector store**: Cloudflare Vectorize, index name `skids-evidence`
- **Update flow**: a single build script runs `pnpm build-evidence-index` locally, pushes chunks to Vectorize. No runtime writes. Version-pinned.
- **Metadata filters**: `category` (condition, question, education, reference), `module_type`, `age_band_months`, `lang` (en/hi initially)

---

## Deliverables

1. New package `packages/evidence/` — evidence source manifest + chunker
2. `scripts/build-evidence-index.ts` — reads manifest, chunks, embeds, upserts to Vectorize
3. Vectorize index created (`wrangler vectorize create skids-evidence --dimensions=384 --metric=cosine`)
4. wrangler.toml — add Vectorize binding
5. New worker route `GET /api/evidence/search?q=...&moduleType=...&ageBandMonths=...`
6. New worker route `GET /api/reviews/:observationId/context` — unified response: evidence[] + similarCases[]
7. DoctorReviewScreen (mobile) + DoctorInbox row expand (web) — render context panel
8. `apps/worker/src/routes/evidence.ts` search + admin endpoints
9. Migration `0007_evidence_index.sql` — tracks indexed version + chunk counts
10. Tests
11. Update `docs/RUNBOOK.md`

---

## Step-by-step

### 1. Evidence package

`packages/evidence/src/manifest.ts`:

```typescript
export type EvidenceChunk = {
  id: string                // stable, e.g. 'cond:astigmatism:overview'
  category: 'condition' | 'question' | 'education' | 'reference'
  moduleType?: string
  ageBandMonths?: [number, number]
  lang: 'en' | 'hi'
  title: string
  text: string              // <= 500 tokens
  source: string            // 'condition-descriptions.ts' | 'r2:...' | ...
  version: number           // bump to force re-embed
}

export async function collectChunks(): Promise<EvidenceChunk[]> { /* ... */ }
```

Chunker: consumes structured sources directly (no PDF parsing in round 1). A separate Phase-7.5 can add PDF ingestion via Sandbox+liteparse.

### 2. Build script

`scripts/build-evidence-index.ts`:

```typescript
// 1. Load chunks
// 2. For each, embed via Workers AI (call via production worker endpoint to reuse binding)
// 3. Upsert to Vectorize via REST API or wrangler vectorize insert
// 4. Write manifest snapshot to r2://skids-evidence/manifests/<iso>.json
// 5. Update evidence_index_version table with counts
```

Idempotent: chunks with unchanged `version` + identical `text` skip re-embed.

### 3. Binding

wrangler.toml:
```toml
[[vectorize]]
binding = "EVIDENCE_VEC"
index_name = "skids-evidence"
```

### 4. Search route

`POST /api/evidence/search`:
```typescript
// body: { q: string, moduleType?, ageBandMonths?, lang?, limit? }
// 1. Embed q via Workers AI
// 2. EVIDENCE_VEC.query(vector, { topK: limit, filter: {...} })
// 3. For each hit, fetch metadata + text from KV cache (populated during build)
// 4. Return [{id, title, text, score, category, source}]
```

Cache hits in KV for 1h (text payload is stable for a given chunk version).

### 5. Unified context route

`GET /api/reviews/:observationId/context`:

```typescript
// 1. Load observation (module_type, ai_annotations, body_region, child age)
// 2. Compose query string from annotations (reuse shared/embedding-text.ts logic)
// 3. Parallel:
//    a. /api/evidence/search (top 5 filtered by module + age band)
//    b. /api/similarity/observations (top 5 from Phase 1)
// 4. Return { evidence: [...], similarCases: [...], query: { text, moduleType } }
```

Rate limit: 60 req/min/user. Audit log on every call. Langfuse span with the composed query + top IDs (not full text — avoid trace bloat).

### 6. UI

DoctorInbox expand panel + DoctorReviewScreen (mobile):

```
┌────────────────────────────────────────┐
│ Observation #X — vision / left eye     │
│ AI: crescent asymmetry, confidence 0.74│
├─── Evidence ───────────────────────────┤
│ • Astigmatism — overview               │
│ • Photoscreening interpretation guide  │
│ • ...                                  │
├─── Similar past cases ─────────────────┤
│ • obs #Y — same module, 0.12 distance  │
│   → reviewed by Dr K, dx: astigmatism  │
│ • ...                                  │
└────────────────────────────────────────┘
```

Clicking an evidence item opens a modal with full text + citation. Clicking a similar case opens that observation in read-only mode (respect RBAC — no cross-campaign access unless doctor has rights).

### 7. Evidence admin

`GET /api/evidence/index-status` — returns `{ version, chunkCount, lastBuildAt, perCategory: {...} }`.
`POST /api/evidence/rebuild` (admin only) — queues a rebuild (calls the build script via service binding to analytics-worker or GH Action trigger; do NOT rebuild synchronously in a request).

### 8. Migration

`0007_evidence_index.sql`:
```sql
CREATE TABLE IF NOT EXISTS evidence_index_version (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  categories_json TEXT,
  built_at TEXT DEFAULT (datetime('now')),
  built_by TEXT
);
INSERT OR IGNORE INTO evidence_index_version (id, version, chunk_count) VALUES (1, 0, 0);
```

### 9. Tests

- Golden corpus: 20 hand-labeled chunks, 10 test queries with known top-1 ground truth. Assert 8/10 correct.
- Language filter: Hindi chunks returned only when `lang=hi` passed
- Unified context route: mock both sub-calls, assert shape
- Rate limit: 61st request in a minute returns 429

### 10. Runbook

- How to add a new evidence source (edit manifest, run build script)
- How to translate existing chunks to Hindi (workflow + versioning rule)
- How to debug a "no results" query
- Eval process: re-run golden corpus monthly, track top-1 accuracy in `analytics_runs`

---

## Acceptance criteria

- [ ] Vectorize index populated with >= 500 chunks from existing structured sources
- [ ] `/api/evidence/search` returns in < 200ms P95
- [ ] `/api/reviews/:id/context` returns in < 500ms P95
- [ ] DoctorReviewScreen shows both panels for a seeded observation
- [ ] Golden corpus eval ≥ 80% top-1 accuracy
- [ ] No PHI in Vectorize metadata (verified)
- [ ] Feature flag `features_json.evidence_rag` respected per-org

## Rollback

Feature flag off — UI falls back to existing annotation display. Vectorize index can stay (no cost harm). Worker routes gated.

## Out of scope

- PDF ingestion from R2 library (Phase 7.5 if needed)
- User feedback loop on result quality (later)
- Multi-lingual beyond en/hi (later)
- Re-ranking with a cross-encoder (later)
