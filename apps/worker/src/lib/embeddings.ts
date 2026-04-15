/**
 * Phase 1 — Embed-and-store helper for observations.
 *
 * Used by:
 *   - apps/worker/src/routes/observations.ts (embed on POST / sync)
 *   - apps/worker/src/routes/admin-embeddings.ts (backfill batch)
 *
 * Failure here MUST NOT fail the screening write. Callers wrap in
 * ctx.waitUntil / try-catch as appropriate.
 */

import type { Client } from '@libsql/client'
import { buildEmbeddingText, sha1Hex, type EmbeddingInput } from '@skids/shared'

export interface EmbedObservation extends EmbeddingInput {
  id: string
}

export interface EmbedResult {
  id: string
  status: 'embedded' | 'unchanged' | 'error'
  error?: string
}

/**
 * Compute embedding for one observation and store it in Turso.
 * Returns 'unchanged' if the hash matches what's already on disk.
 */
export async function embedAndStore(
  db: Client,
  ai: Ai,
  obs: EmbedObservation
): Promise<EmbedResult> {
  try {
    const text = buildEmbeddingText(obs)
    const hash = await sha1Hex(text)

    const existing = await db.execute({
      sql: 'SELECT embedding_text_hash FROM observations WHERE id = ?',
      args: [obs.id],
    })
    const existingHash = (existing.rows[0] as Record<string, unknown> | undefined)
      ?.embedding_text_hash as string | undefined
    if (existingHash === hash) {
      return { id: obs.id, status: 'unchanged' }
    }

    const out = (await ai.run('@cf/baai/bge-small-en-v1.5', {
      text: [text],
    })) as { data: number[][] }
    const vec = out.data[0]
    if (!vec || vec.length !== 384) {
      return { id: obs.id, status: 'error', error: `bad embedding length: ${vec?.length}` }
    }

    await db.execute({
      sql: `UPDATE observations
              SET embedding = vector32(?),
                  embedding_text_hash = ?,
                  embedded_at = datetime('now')
            WHERE id = ?`,
      args: [JSON.stringify(vec), hash, obs.id],
    })

    return { id: obs.id, status: 'embedded' }
  } catch (err) {
    return {
      id: obs.id,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Fire-and-forget wrapper with logging. Safe for ctx.waitUntil. */
export async function embedAndStoreBackground(
  db: Client,
  ai: Ai,
  obs: EmbedObservation
): Promise<void> {
  const r = await embedAndStore(db, ai, obs)
  if (r.status === 'error') {
    console.warn('[embedAndStore] failed', r)
  }
}
