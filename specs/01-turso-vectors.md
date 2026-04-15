# Phase 1 — Turso Native Vectors

**Goal**: Activate the embedding column already designed in `schema.sql`, embed every observation on write, expose a "find similar past cases" endpoint, and backfill existing observations.

**Prerequisites**: Phase 0 complete, `feat/edge-stack-v1` branch.

**Effort**: 1 day.

---

## Read first

- `packages/db/src/schema.sql` — line ~70, the commented `-- embedding F32_BLOB(384)` on `observations`
- `apps/worker/src/routes/observations.ts` — current observation create flow
- `apps/worker/src/index.ts` — Bindings type (we need `AI: Ai` already present)
- `packages/shared/src/types.ts` — Observation type
- `apps/worker/src/routes/ai-gateway.ts` — pattern for binding-based AI calls

---

## Decisions (do not relitigate)

- **Embedding model**: `@cf/baai/bge-small-en-v1.5` (Workers AI, 384-dim, free)
- **Vector store**: Turso native (libSQL `F32_BLOB`), not Vectorize
- **Distance**: cosine via `vector_distance_cos`
- **Embedding source text**: a deterministic concatenation of `module_type | body_region | nurse_chips_joined | risk_label | clinical_summary` (see helper in step 3)
- **Backfill rate**: 100 observations/min via Workers AI free-tier safety margin

---

## Deliverables

1. Migration `packages/db/src/migrations/0001_observations_embedding.sql`
2. New helper `packages/shared/src/embedding-text.ts`
3. Modify `apps/worker/src/routes/observations.ts` — embed on POST/PATCH
4. New route `apps/worker/src/routes/similarity.ts` — POST /api/similarity/observations
5. Wire route into `apps/worker/src/index.ts`
6. New script `scripts/backfill-embeddings.ts` — resumable backfill
7. Vitest in `apps/worker/test/similarity.test.ts`
8. Feature flag: `features_json.turso_vectors` in `ai_config`
9. Audit log entries for the new endpoint
10. Update `docs/RUNBOOK.md` Phase 1 section

---

## Step-by-step

### 1. Migration (additive, idempotent)

Create `packages/db/src/migrations/0001_observations_embedding.sql`:

```sql
-- Phase 1 — Turso native vectors on observations
ALTER TABLE observations ADD COLUMN embedding F32_BLOB(384);
ALTER TABLE observations ADD COLUMN embedding_text_hash TEXT;
ALTER TABLE observations ADD COLUMN embedded_at TEXT;

CREATE INDEX IF NOT EXISTS idx_obs_embedding
  ON observations(libsql_vector_idx(embedding));

CREATE INDEX IF NOT EXISTS idx_obs_embedded_at ON observations(embedded_at);
```

Apply via Turso CLI:
```bash
turso db shell skids-screen < packages/db/src/migrations/0001_observations_embedding.sql
```

Update `packages/db/src/schema.sql` to UNCOMMENT the embedding line and add the two new columns + index — schema.sql is the source-of-truth document; migrations are the apply mechanism.

### 2. Embedding-text helper (shared)

Create `packages/shared/src/embedding-text.ts`:

```typescript
import type { Observation } from './types'

/**
 * Deterministic text representation of an observation for embedding.
 * Changing this function = re-embedding everything. Bump VERSION + backfill.
 */
export const EMBEDDING_TEXT_VERSION = 1

export function buildEmbeddingText(obs: {
  module_type: string
  body_region?: string | null
  ai_annotations?: string | null
  annotation_data?: string | null
  risk_level?: number | null
}): string {
  const chips = safeJsonArray(obs.ai_annotations)
    .map((a: any) => a.label || a.chipId)
    .filter(Boolean)
    .join(', ')
  const nurseChips = safeJsonArray(obs.annotation_data)
    .map((a: any) => a.label || a.chipId)
    .filter(Boolean)
    .join(', ')
  const risk = ({0:'normal',1:'mild',2:'moderate',3:'severe'} as any)[obs.risk_level ?? 0] || 'unknown'

  return [
    `module:${obs.module_type}`,
    obs.body_region ? `region:${obs.body_region}` : '',
    chips ? `ai:${chips}` : '',
    nurseChips ? `nurse:${nurseChips}` : '',
    `risk:${risk}`,
    `v:${EMBEDDING_TEXT_VERSION}`,
  ].filter(Boolean).join(' | ')
}

function safeJsonArray(s?: string | null): any[] {
  if (!s) return []
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}

export async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('')
}
```

Export from `packages/shared/src/index.ts`.

### 3. Embed-on-write in observations route

In `apps/worker/src/routes/observations.ts`, after a successful INSERT/UPDATE of an observation:

```typescript
import { buildEmbeddingText, sha1Hex } from '@skids/shared'

async function embedAndStore(c: any, observationId: string, obs: any) {
  const text = buildEmbeddingText(obs)
  const hash = await sha1Hex(text)
  // skip if unchanged
  const existing = await db.execute({
    sql: 'SELECT embedding_text_hash FROM observations WHERE id = ?',
    args: [observationId],
  })
  if (existing.rows[0]?.embedding_text_hash === hash) return

  const ai = c.env.AI as Ai
  const result = await ai.run('@cf/baai/bge-small-en-v1.5', { text: [text] })
  const vec = (result as any).data[0] as number[] // 384 floats

  await db.execute({
    sql: `UPDATE observations
            SET embedding = vector32(?),
                embedding_text_hash = ?,
                embedded_at = datetime('now')
          WHERE id = ?`,
    args: [JSON.stringify(vec), hash, observationId],
  })
}
```

Call `embedAndStore(...)` after both POST and PATCH succeed. Wrap in try/catch — embedding failure must NOT fail the screening write. Log to ai_usage on failure.

### 4. Similarity route

Create `apps/worker/src/routes/similarity.ts`:

```typescript
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { buildEmbeddingText } from '@skids/shared'

export const similarityRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// POST /api/similarity/observations
// Body: { observationId } OR { freeText }
// Optional filters: campaignCode, moduleType, ageBandMonths:[min,max], limit (default 10)
similarityRoutes.post('/observations', async (c) => {
  const db = c.get('db')
  const ai = c.env.AI as Ai
  const body = await c.req.json<any>()
  const limit = Math.min(body.limit ?? 10, 50)

  let queryVec: number[]
  if (body.observationId) {
    const r = await db.execute({
      sql: 'SELECT embedding FROM observations WHERE id = ? AND embedding IS NOT NULL',
      args: [body.observationId],
    })
    if (!r.rows[0]) return c.json({ error: 'no embedding' }, 404)
    // unpack F32_BLOB
    const blob = r.rows[0].embedding as ArrayBuffer
    queryVec = Array.from(new Float32Array(blob))
  } else if (body.freeText) {
    const text = String(body.freeText).slice(0, 2000)
    const out = await ai.run('@cf/baai/bge-small-en-v1.5', { text: [text] })
    queryVec = (out as any).data[0]
  } else {
    return c.json({ error: 'provide observationId or freeText' }, 400)
  }

  const filters: string[] = []
  const args: unknown[] = [JSON.stringify(queryVec), limit * 4]
  if (body.campaignCode) { filters.push('campaign_code = ?'); args.push(body.campaignCode) }
  if (body.moduleType)   { filters.push('module_type = ?');   args.push(body.moduleType) }

  const where = filters.length ? `AND ${filters.join(' AND ')}` : ''
  const sql = `
    SELECT id, child_id, campaign_code, module_type, body_region, risk_level,
           ai_annotations, timestamp,
           vector_distance_cos(embedding, vector32(?)) AS distance
    FROM observations
    WHERE embedding IS NOT NULL ${where}
    ORDER BY distance ASC
    LIMIT ?
  `
  const result = await db.execute({ sql, args: [...args, limit] })
  return c.json({ results: result.rows })
})
```

Register in `apps/worker/src/index.ts`:
```typescript
import { similarityRoutes } from './routes/similarity'
// ... after other route mounts, with auth middleware:
app.route('/api/similarity', authMiddleware(...).then(...similarityRoutes))
```
(Match the existing route-mounting pattern — read `index.ts` and follow it exactly.)

### 5. Backfill script

Create `scripts/backfill-embeddings.ts`:

- Reads from Turso: `SELECT * FROM observations WHERE embedding IS NULL ORDER BY created_at LIMIT 100`
- Calls a new admin route `POST /api/admin/embed-batch` (requires admin role)
- The admin route iterates the 100 rows, calls `embedAndStore` for each, returns count
- Script sleeps 60s between batches, resumable (each iteration just queries for nulls again)
- Logs progress to stdout: `[backfill] embedded 100/12,453 (0.8%)`
- Stop condition: a batch returns 0

Add the admin route in a new file `apps/worker/src/routes/admin-embeddings.ts`, wire under existing admin routes.

### 6. Test

`apps/worker/test/similarity.test.ts`:
- Insert 3 fake observations with known embeddings (use a stub `AI` binding that returns deterministic vectors)
- POST /api/similarity with each as query → assert correct order
- Test filter by `moduleType`
- Test failure path (no embedding present)

Add a vitest config if absent. Match the patterns in any existing tests under `apps/worker/test/`.

### 7. Feature flag

Migration extension (same file or 0002):
```sql
-- Add features_json to ai_config if not exists
-- (CREATE TABLE IF NOT EXISTS handled by ai-config.ts, but add column safely)
```

In code, before similarity returns, check `ai_config.features_json.turso_vectors` for the calling org. If false, return 503 with `{ error: 'feature disabled' }`.

### 8. Audit log

Every call to `/api/similarity/observations` writes to `audit_log`:
`{ user_id, action: 'similarity.search', target_id: observationId|null, metadata: {filters, resultCount} }`.

### 9. Update docs/RUNBOOK.md

Add Phase 1 section: how to enable feature flag, how to re-embed after changing `EMBEDDING_TEXT_VERSION`, how to interpret distance scores (rule of thumb: <0.2 = highly similar, 0.2–0.5 = related, >0.5 = unrelated for bge-small).

---

## Acceptance criteria

- [ ] `pnpm typecheck && pnpm build` green
- [ ] Migration applies cleanly to a fresh Turso instance
- [ ] `schema.sql` updated to reflect new columns
- [ ] Posting an observation produces a non-null `embedding` within 2s (P95)
- [ ] `POST /api/similarity/observations` with a known observationId returns the observation as nearest match (distance ~0)
- [ ] Backfill script runs end-to-end on a test DB with 200 seeded observations
- [ ] Test suite passes
- [ ] Feature flag respected (off → 503, on → 200)
- [ ] `audit_log` entry recorded per call

## Rollback

```sql
DROP INDEX IF EXISTS idx_obs_embedding;
ALTER TABLE observations DROP COLUMN embedding;        -- libSQL supports DROP since v0.24
ALTER TABLE observations DROP COLUMN embedding_text_hash;
ALTER TABLE observations DROP COLUMN embedded_at;
```
Revert worker code via `git revert`. Backfill script can be re-run after re-migration since it's idempotent on the hash.

## Out of scope

- Vectorize integration (Phase 7)
- Embedding evidence library / question bank (Phase 7)
- UI for similarity search in DoctorReviewScreen (Phase 7)
- Re-embedding on schema-text changes (manual via VERSION bump for now)
