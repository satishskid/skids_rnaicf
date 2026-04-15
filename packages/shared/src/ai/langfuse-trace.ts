/**
 * Phase 2 — Lightweight Langfuse HTTP client.
 *
 * No SDK dependency (keeps Worker bundle small). Emits trace + span events
 * via the Langfuse /api/public/ingestion endpoint using basic auth with
 * public/secret keys.
 *
 * PHI NEVER appears in trace payloads — callers must pass inputs/outputs
 * through `redact()` first, which strips base64 images, child names,
 * DOBs, and phone numbers. The helper returns the string unchanged if it
 * contains nothing worth stripping.
 *
 * Failure to emit is NEVER fatal: `ingest()` swallows errors (with a
 * structured console.warn) so that downstream LLM responses are not
 * coupled to observability availability.
 */

export interface LangfuseConfig {
  publicKey: string
  secretKey: string
  baseUrl: string
  fetchImpl?: typeof fetch
}

export interface TraceStart {
  name: string
  sessionId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

export interface SpanInput {
  traceId: string
  name: string
  input?: unknown
  output?: unknown
  model?: string
  provider?: string
  latencyMs?: number
  tokensIn?: number
  tokensOut?: number
  costUsd?: number
  metadata?: Record<string, unknown>
  level?: 'DEFAULT' | 'WARNING' | 'ERROR'
  statusMessage?: string
}

export interface TraceEnd {
  traceId: string
  output?: unknown
  metadata?: Record<string, unknown>
}

type IngestEvent =
  | { id: string; type: 'trace-create'; timestamp: string; body: Record<string, unknown> }
  | { id: string; type: 'span-create'; timestamp: string; body: Record<string, unknown> }
  | { id: string; type: 'generation-create'; timestamp: string; body: Record<string, unknown> }
  | { id: string; type: 'trace-update'; timestamp: string; body: Record<string, unknown> }

export class Langfuse {
  private readonly fetch: typeof fetch
  constructor(private readonly cfg: LangfuseConfig) {
    this.fetch = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  async startTrace(t: TraceStart): Promise<string> {
    const id = randomId('trace')
    await this.ingest([
      {
        id: randomId('evt'),
        type: 'trace-create',
        timestamp: new Date().toISOString(),
        body: {
          id,
          name: t.name,
          sessionId: t.sessionId,
          userId: t.userId,
          metadata: t.metadata ?? {},
        },
      },
    ])
    return id
  }

  async span(s: SpanInput): Promise<void> {
    const type: IngestEvent['type'] = s.model ? 'generation-create' : 'span-create'
    await this.ingest([
      {
        id: randomId('evt'),
        type,
        timestamp: new Date().toISOString(),
        body: {
          id: randomId('span'),
          traceId: s.traceId,
          name: s.name,
          input: redactValue(s.input),
          output: redactValue(s.output),
          model: s.model,
          modelParameters: s.provider ? { provider: s.provider } : undefined,
          usage:
            s.tokensIn || s.tokensOut
              ? { input: s.tokensIn ?? 0, output: s.tokensOut ?? 0, unit: 'TOKENS' }
              : undefined,
          latencyMs: s.latencyMs,
          costDetails: s.costUsd ? { total: s.costUsd, currency: 'USD' } : undefined,
          metadata: s.metadata ?? {},
          level: s.level,
          statusMessage: s.statusMessage,
        },
      },
    ])
  }

  async endTrace(t: TraceEnd): Promise<void> {
    await this.ingest([
      {
        id: randomId('evt'),
        type: 'trace-update',
        timestamp: new Date().toISOString(),
        body: { id: t.traceId, output: redactValue(t.output), metadata: t.metadata ?? {} },
      },
    ])
  }

  private async ingest(batch: IngestEvent[]): Promise<void> {
    if (!this.cfg.publicKey || !this.cfg.secretKey || !this.cfg.baseUrl) return
    try {
      const auth = base64(`${this.cfg.publicKey}:${this.cfg.secretKey}`)
      const res = await this.fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/api/public/ingestion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({ batch }),
      })
      if (!res.ok && res.status >= 500) {
        console.warn('[langfuse] ingest failed', { status: res.status })
      }
    } catch (err) {
      console.warn('[langfuse] ingest error', { message: err instanceof Error ? err.message : String(err) })
    }
  }
}

// ── PHI redaction ──────────────────────────────────────────────────────────

const BASE64_IMAGE_RE = /([A-Za-z0-9+/]{500,}={0,2})/g
const DATA_URL_RE = /data:image\/\w+;base64,[A-Za-z0-9+/=]+/g
const PHONE_RE = /\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g
const DOB_RE = /\b(?:19|20)\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])\b/g
const CHILD_NAME_KEYS = new Set(['childName', 'child_name', 'name', 'firstName', 'lastName'])

export function redactString(s: string): string {
  return s
    .replace(DATA_URL_RE, '<image:base64>')
    .replace(BASE64_IMAGE_RE, (m) => `<image:sha:${shortHash(m)}>`)
    .replace(PHONE_RE, '<phone>')
    .replace(DOB_RE, '<dob>')
}

export function redactValue(v: unknown): unknown {
  if (v == null) return v
  if (typeof v === 'string') return redactString(v)
  if (Array.isArray(v)) return v.map(redactValue)
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (CHILD_NAME_KEYS.has(k) && typeof val === 'string') {
        out[k] = '<child>'
      } else {
        out[k] = redactValue(val)
      }
    }
    return out
  }
  return v
}

function shortHash(s: string): string {
  // Non-cryptographic — just a deterministic short tag. Length cap keeps
  // Langfuse payload small when a span happens to repeat the same image.
  let h = 0
  for (let i = 0; i < Math.min(s.length, 4096); i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

function randomId(prefix: string): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${hex}`
}

function base64(s: string): string {
  if (typeof btoa === 'function') return btoa(s)
  // Node / CF compat fallback
  return Buffer.from(s, 'utf8').toString('base64')
}
