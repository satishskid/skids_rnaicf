/**
 * Deterministic text representation of an observation for embedding.
 * Changing this function = re-embedding everything. Bump VERSION + backfill.
 *
 * Phase 1 — Turso native vectors.
 * Target model: @cf/baai/bge-small-en-v1.5 (384-dim).
 */

export const EMBEDDING_TEXT_VERSION = 1

export interface EmbeddingInput {
  module_type: string
  body_region?: string | null
  ai_annotations?: string | null
  annotation_data?: string | null
  risk_level?: number | null
}

export function buildEmbeddingText(obs: EmbeddingInput): string {
  const aiChips = safeJsonArray(obs.ai_annotations)
    .map((a) => (a && (a.label || a.chipId || a.summaryText)) || '')
    .filter(Boolean)
    .join(', ')

  const nurseChips = safeJsonArray(obs.annotation_data)
    .map((a) => (a && (a.label || a.chipId)) || '')
    .filter(Boolean)
    .join(', ')

  const riskMap: Record<number, string> = {
    0: 'normal',
    1: 'mild',
    2: 'moderate',
    3: 'severe',
  }
  const risk = riskMap[obs.risk_level ?? 0] ?? 'unknown'

  return [
    `module:${obs.module_type}`,
    obs.body_region ? `region:${obs.body_region}` : '',
    aiChips ? `ai:${aiChips}` : '',
    nurseChips ? `nurse:${nurseChips}` : '',
    `risk:${risk}`,
    `v:${EMBEDDING_TEXT_VERSION}`,
  ]
    .filter(Boolean)
    .join(' | ')
}

function safeJsonArray(s?: string | null): Array<Record<string, unknown>> {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** Web-crypto SHA-1 → hex. Usable in Workers, browsers, and Node 20+ (subtle global). */
export async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
