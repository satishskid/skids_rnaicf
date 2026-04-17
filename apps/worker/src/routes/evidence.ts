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

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { logAudit } from './audit-log'

export const evidenceRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

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

evidenceRoutes.post('/rebuild', async (c) => {
  const role = c.get('userRole')
  if (role !== 'admin') return c.json({ error: 'admin role required' }, 403)
  const db = c.get('db')
  await logAudit(db, {
    userId: c.get('userId') ?? 'admin',
    action: 'evidence.rebuild.requested',
    entityType: 'evidence_index',
    details: JSON.stringify({ requestedAt: new Date().toISOString() }),
  })
  return c.json({
    message: 'Rebuild runs out-of-band. Execute:',
    command: 'pnpm -w tsx scripts/build-evidence-index.ts',
    envRequired: ['CF_ACCOUNT_ID', 'CF_API_TOKEN', 'TURSO_URL', 'TURSO_AUTH_TOKEN'],
  }, 202)
})

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
