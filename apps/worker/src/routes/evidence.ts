// Phase 07 — Evidence RAG routes.
//
// POST /api/evidence/search
//   body: { query: string, topK?: number, filters?: { category?, module_type?, age_months?, lang? } }
//   -> { results: [{ id, score, title, category, module_type, text_preview, source }] }
//
// GET  /api/evidence/index-status
//   -> { version, chunkCount, categories, builtAt, builtBy, vectorizeOk }
//
// POST /api/evidence/rebuild
//   Admin-only placeholder. The actual rebuild runs out-of-band via
//   scripts/build-evidence-index.ts. This endpoint just records the ask
//   in audit_log and returns instructions.
//
// All routes are feature-flagged by env FEATURE_EVIDENCE_RAG (set to '1'
// on deployments where the Vectorize index is populated). The unified
// doctor-inbox context endpoint is mounted in reviews.ts via
// buildReviewContext() exported here for reuse.

import { Hono, type Context } from 'hono'
import type { Bindings, Variables } from '../index'
import { logAudit } from './audit-log'
import { collectChunks, type EvidenceChunk } from '@skids/evidence'

export const evidenceRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Separate Hono instance for the unauth'd bootstrap endpoint. Mounted in
// src/index.ts outside the authMiddleware guard so first-time index
// builds work before an admin web session exists.
export const evidenceBootstrapRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const EMBED_MODEL = '@cf/baai/bge-small-en-v1.5'
const MAX_TOP_K = 20
const DEFAULT_TOP_K = 5

interface SearchFilters {
  category?: string
  module_type?: string
  age_months?: number
  lang?: string
}

interface EvidenceHit {
  id: string
  score: number
  title: string | null
  category: string | null
  module_type: string | null
  text_preview: string | null
  source: string | null
}

evidenceRoutes.post('/search', async (c) => {
  if (!isEnabled(c.env)) {
    return c.json({ error: 'evidence RAG disabled' }, 503)
  }
  if (!c.env.EVIDENCE_VEC) {
    return c.json({ error: 'EVIDENCE_VEC binding missing' }, 500)
  }
  if (!c.env.AI) {
    return c.json({ error: 'Workers AI binding missing' }, 500)
  }

  const body = await c.req.json<{ query?: string; topK?: number; filters?: SearchFilters }>()
  const query = (body.query ?? '').trim().slice(0, 2000)
  if (!query) return c.json({ error: 'query required' }, 400)
  const topK = Math.min(Math.max(body.topK ?? DEFAULT_TOP_K, 1), MAX_TOP_K)

  const hits = await evidenceSearch(c.env, query, topK, body.filters)
  return c.json({ query, results: hits })
})

evidenceRoutes.get('/index-status', async (c) => {
  const db = c.get('db')
  const row = await db.execute({
    sql: 'SELECT version, chunk_count, categories_json, built_at, built_by FROM evidence_index_version WHERE id = 1',
    args: [],
  })
  if (row.rows.length === 0) {
    return c.json({ version: 0, chunkCount: 0, categories: [], builtAt: null, builtBy: null, vectorizeOk: false })
  }
  const r = row.rows[0] as Record<string, unknown>
  const categoriesRaw = r.categories_json as string | null
  return c.json({
    version: Number(r.version ?? 0),
    chunkCount: Number(r.chunk_count ?? 0),
    categories: categoriesRaw ? safeParse<string[]>(categoriesRaw, []) : [],
    builtAt: r.built_at as string | null,
    builtBy: r.built_by as string | null,
    vectorizeOk: Boolean(c.env.EVIDENCE_VEC),
  })
})

/**
 * POST /api/evidence/rebuild
 *
 * Admin-only, synchronous. Embeds the full corpus (packages/evidence
 * collectChunks) with Workers AI and upserts into EVIDENCE_VEC. Runs
 * inside the Worker so no external CF API token is needed — all
 * bindings are already present. Bumps evidence_index_version on
 * success.
 *
 * Running this on ~150 chunks takes well under the 15 min Paid CPU
 * budget (20-chunk embed batches × ~500ms + 50-vector upsert batches).
 * Returns a rebuild summary.
 */
evidenceRoutes.post('/rebuild', async (c) => {
  const role = c.get('userRole')
  if (role !== 'admin') return c.json({ error: 'admin role required' }, 403)
  return runRebuild(c)
})

evidenceBootstrapRoutes.post('/rebuild', async (c) => {
  const rebuildSecret = c.env.EVIDENCE_REBUILD_SECRET
  const providedSecret = c.req.header('x-evidence-rebuild-secret')
  if (!rebuildSecret || !providedSecret || providedSecret !== rebuildSecret) {
    return c.json({ error: 'invalid or missing X-Evidence-Rebuild-Secret' }, 403)
  }
  return runRebuild(c)
})

type EvidenceContext = Context<{ Bindings: Bindings; Variables: Variables }>

async function runRebuild(c: EvidenceContext) {
  if (!c.env.EVIDENCE_VEC) return c.json({ error: 'EVIDENCE_VEC binding missing' }, 500)
  if (!c.env.AI) return c.json({ error: 'Workers AI binding missing' }, 500)

  const db = c.get('db')
  const userId = c.get('userId') ?? 'bootstrap'
  const chunks = collectChunks()
  if (chunks.length === 0) return c.json({ error: 'no chunks to index' }, 500)

  const t0 = Date.now()
  let embedded = 0
  let upserted = 0
  const errors: string[] = []

  const EMBED_BATCH = 20
  const UPSERT_BATCH = 50
  const pendingVectors: Array<{
    id: string
    values: number[]
    metadata: Record<string, VectorizeVectorMetadata>
  }> = []

  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH)
    try {
      const aiOut = await c.env.AI.run(EMBED_MODEL, { text: batch.map((b) => b.text) }) as { data?: number[][] }
      const vectors = aiOut.data ?? []
      if (vectors.length !== batch.length) {
        errors.push(`embed batch ${i} returned ${vectors.length}/${batch.length}`)
        continue
      }
      for (let j = 0; j < batch.length; j++) {
        pendingVectors.push({
          id: batch[j].id,
          values: vectors[j],
          metadata: chunkMetadata(batch[j]),
        })
      }
      embedded += batch.length
    } catch (err) {
      errors.push(`embed batch ${i}: ${errorMessage(err)}`)
    }
  }

  for (let i = 0; i < pendingVectors.length; i += UPSERT_BATCH) {
    const slice = pendingVectors.slice(i, i + UPSERT_BATCH)
    try {
      await c.env.EVIDENCE_VEC.upsert(slice)
      upserted += slice.length
    } catch (err) {
      errors.push(`upsert batch ${i}: ${errorMessage(err)}`)
    }
  }

  if (upserted > 0) {
    const categories = [...new Set(chunks.map((c2) => c2.category))]
    await db.execute({
      sql: `INSERT INTO evidence_index_version (id, version, chunk_count, categories_json, built_at, built_by)
            VALUES (1,
                    COALESCE((SELECT version FROM evidence_index_version WHERE id = 1), 0) + 1,
                    ?, ?, datetime('now'), ?)
            ON CONFLICT(id) DO UPDATE
              SET version = version + 1,
                  chunk_count = excluded.chunk_count,
                  categories_json = excluded.categories_json,
                  built_at = datetime('now'),
                  built_by = excluded.built_by`,
      args: [upserted, JSON.stringify(categories), userId],
    })
  }

  await logAudit(db, {
    userId,
    action: 'evidence.rebuild.completed',
    entityType: 'evidence_index',
    details: JSON.stringify({ chunks: chunks.length, embedded, upserted, errors: errors.length, ms: Date.now() - t0 }),
  })

  return c.json({
    chunks: chunks.length,
    embedded,
    upserted,
    errors,
    ms: Date.now() - t0,
  }, errors.length === 0 ? 200 : 207)
}

function chunkMetadata(chunk: EvidenceChunk): Record<string, VectorizeVectorMetadata> {
  return {
    category: chunk.category,
    module_type: chunk.module_type ?? '',
    age_min: chunk.age_band_months?.min ?? -1,
    age_max: chunk.age_band_months?.max ?? -1,
    lang: chunk.lang ?? 'en',
    title: chunk.title ?? '',
    source: chunk.source,
    text_preview: chunk.text.slice(0, 280),
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
}

/**
 * Shared evidence search. Re-used by /api/reviews/:id/context so the
 * doctor inbox doesn't have to make two round-trips.
 */
export async function evidenceSearch(
  env: Bindings,
  query: string,
  topK: number,
  filters?: SearchFilters
): Promise<EvidenceHit[]> {
  if (!env.EVIDENCE_VEC || !env.AI) return []

  const aiOut = await env.AI.run(EMBED_MODEL, { text: [query] }) as { data?: number[][] }
  const vec = aiOut.data?.[0]
  if (!vec || vec.length !== 384) return []

  const vectorizeFilter = toVectorizeFilter(filters)

  const result = await env.EVIDENCE_VEC.query(vec, {
    topK,
    returnMetadata: 'all',
    ...(vectorizeFilter ? { filter: vectorizeFilter } : {}),
  })
  return result.matches.map((m) => normaliseHit(m as unknown as VectorizeMatch))
}

function isEnabled(env: Bindings): boolean {
  return env.FEATURE_EVIDENCE_RAG === '1'
}

function toVectorizeFilter(filters?: SearchFilters): VectorizeVectorMetadataFilter | undefined {
  if (!filters) return undefined
  const out: VectorizeVectorMetadataFilter = {}
  if (filters.category) out.category = { $eq: filters.category }
  if (filters.module_type) out.module_type = { $eq: filters.module_type }
  if (filters.lang) out.lang = { $eq: filters.lang }
  if (typeof filters.age_months === 'number') {
    // age_min/age_max are stored as -1 when the chunk applies to all ages.
    out.age_min = { $lte: filters.age_months }
    out.age_max = { $gte: filters.age_months }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function normaliseHit(match: VectorizeMatch): EvidenceHit {
  const meta = (match.metadata ?? {}) as Record<string, unknown>
  return {
    id: match.id,
    score: typeof match.score === 'number' ? match.score : 0,
    title: (meta.title as string | undefined) ?? null,
    category: (meta.category as string | undefined) ?? null,
    module_type: (meta.module_type as string | undefined) ?? null,
    text_preview: (meta.text_preview as string | undefined) ?? null,
    source: (meta.source as string | undefined) ?? null,
  }
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

// Types — Vectorize bindings aren't fully typed in @cloudflare/workers-types
// for all runtimes; we declare a minimal structural shape here so the
// module compiles in isolation.
interface VectorizeMatch {
  id: string
  score: number
  values?: number[]
  metadata?: Record<string, unknown>
}
