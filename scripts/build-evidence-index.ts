#!/usr/bin/env tsx
/**
 * Phase 07 — Build the `skids-evidence` Vectorize index.
 *
 * Reads the evidence corpus from packages/evidence, embeds each chunk
 * with Workers AI (@cf/baai/bge-small-en-v1.5), and upserts the vectors
 * into the index. Bumps evidence_index_version in Turso so the worker's
 * /api/evidence/index-status can surface freshness.
 *
 * Env:
 *   CF_ACCOUNT_ID       Cloudflare account id
 *   CF_API_TOKEN        API token with Workers AI + Vectorize:Edit
 *   TURSO_URL           write-capable Turso URL
 *   TURSO_AUTH_TOKEN    write token
 *
 * Usage:
 *   pnpm -w tsx scripts/build-evidence-index.ts
 *
 * The script is rebuild-on-each-run (no partial upserts). Vectorize
 * handles idempotency via deterministic ids.
 */

import { collectChunks, type EvidenceChunk } from '@skids/evidence'
import { createClient } from '@libsql/client'

const CF_ACCOUNT_ID = requireEnv('CF_ACCOUNT_ID')
const CF_API_TOKEN = requireEnv('CF_API_TOKEN')
const TURSO_URL = requireEnv('TURSO_URL')
const TURSO_AUTH_TOKEN = requireEnv('TURSO_AUTH_TOKEN')

const VEC_INDEX = 'skids-evidence'
const EMBED_MODEL = '@cf/baai/bge-small-en-v1.5'
const CHUNK_BATCH = 20  // Workers AI accepts ~96 in one call; 20 is a safe batch.
const UPSERT_BATCH = 50 // Vectorize upsert limit is 1000, 50 keeps latency sane.

type Embedding = number[]

async function main(): Promise<void> {
  const chunks = collectChunks()
  if (chunks.length === 0) {
    console.warn('[evidence] no chunks to embed; did the upstream sources change?')
    process.exit(1)
  }
  console.log(`[evidence] embedding ${chunks.length} chunks with ${EMBED_MODEL}...`)

  const vectors: Array<{
    id: string
    values: Embedding
    metadata: Record<string, string | number | boolean | null>
  }> = []

  for (let i = 0; i < chunks.length; i += CHUNK_BATCH) {
    const batch = chunks.slice(i, i + CHUNK_BATCH)
    const embeddings = await embedBatch(batch.map((c) => c.text))
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      vectors.push({
        id: chunk.id,
        values: embeddings[j],
        metadata: toMetadata(chunk),
      })
    }
    process.stdout.write(`  ${Math.min(i + CHUNK_BATCH, chunks.length)}/${chunks.length}\r`)
  }
  process.stdout.write('\n')

  console.log(`[evidence] upserting ${vectors.length} vectors into ${VEC_INDEX}...`)
  for (let i = 0; i < vectors.length; i += UPSERT_BATCH) {
    await upsert(vectors.slice(i, i + UPSERT_BATCH))
  }

  console.log(`[evidence] recording index version in Turso...`)
  await bumpVersion(chunks)

  console.log(`✓ built skids-evidence with ${chunks.length} chunks`)
}

async function embedBatch(texts: string[]): Promise<Embedding[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${EMBED_MODEL}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${CF_API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text: texts }),
  })
  if (!res.ok) {
    throw new Error(`workers-ai embed failed ${res.status}: ${await res.text()}`)
  }
  const json = await res.json() as {
    result?: { data?: number[][]; shape?: number[] }
    errors?: Array<{ message: string }>
  }
  if (!json.result?.data) {
    throw new Error(`workers-ai embed malformed: ${JSON.stringify(json.errors ?? json)}`)
  }
  return json.result.data
}

async function upsert(vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>): Promise<void> {
  // Vectorize wants NDJSON. One vector per line.
  const ndjson = vectors.map((v) => JSON.stringify(v)).join('\n')
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VEC_INDEX}/upsert`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${CF_API_TOKEN}`,
      'content-type': 'application/x-ndjson',
    },
    body: ndjson,
  })
  if (!res.ok) {
    throw new Error(`vectorize upsert failed ${res.status}: ${await res.text()}`)
  }
}

async function bumpVersion(chunks: EvidenceChunk[]): Promise<void> {
  const db = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN })
  const categories = [...new Set(chunks.map((c) => c.category))]
  await db.execute({
    sql: `INSERT INTO evidence_index_version (id, version, chunk_count, categories_json, built_at, built_by)
          VALUES (1, COALESCE((SELECT version FROM evidence_index_version WHERE id = 1), 0) + 1, ?, ?, datetime('now'), ?)
          ON CONFLICT(id) DO UPDATE
            SET version = version + 1,
                chunk_count = excluded.chunk_count,
                categories_json = excluded.categories_json,
                built_at = datetime('now'),
                built_by = excluded.built_by`,
    args: [chunks.length, JSON.stringify(categories), process.env.USER ?? 'unknown'],
  })
}

function toMetadata(chunk: EvidenceChunk): Record<string, string | number | boolean | null> {
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

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`missing required env ${name}`)
    process.exit(1)
  }
  return v
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
