// Phase 03 — URL-token integrity layer for /api/reports/:id/pdf.
//
// Each issuance produces:
//   raw      — 32 bytes of CSPRNG randomness, base64url-encoded (~43 chars).
//   hash     — sha256(raw_bytes), hex-encoded. STORED in report_access_tokens.token_hash.
//   hmac     — HMAC-SHA256(signingKey, raw + reportId), base64url-encoded.
//              Bound to reportId so a leaked token cannot be replayed against
//              a different report row.
//   urlParam — `${raw}.${hmac}` — what the consumer URL ?t=... carries.
//
// Verification recomputes hmac' from (raw, reportId, signingKey), constant-time
// compares against the submitted hmac, then re-derives the hash for the DB
// lookup. The raw value is never persisted server-side.
//
// Web Crypto only — works in Cloudflare Workers and modern Node (>=20).

const RAW_BYTES = 32

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toHex(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0')
  return s
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

// Constant-time compare. crypto.subtle has no timingSafeEqual; do it manually
// by XOR-accumulating across both inputs to a fixed length.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return new Uint8Array(buf)
}

async function hmacSha256(keyBytes: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, msg as unknown as BufferSource)
  return new Uint8Array(sig)
}

export interface IssuedToken {
  raw: string       // base64url(32 random bytes)
  hash: string      // hex sha256(raw_bytes) — store in report_access_tokens.token_hash
  hmac: string      // base64url HMAC over (raw_bytes || reportIdBytes)
  urlParam: string  // `${raw}.${hmac}` — pass to clients as ?t=
}

export async function issueToken(signingKey: string, reportId: string): Promise<IssuedToken> {
  if (!signingKey) throw new Error('issueToken: signingKey is required')
  if (!reportId) throw new Error('issueToken: reportId is required')

  const rawBytes = crypto.getRandomValues(new Uint8Array(RAW_BYTES))
  const reportIdBytes = new TextEncoder().encode(reportId)
  const keyBytes = new TextEncoder().encode(signingKey)

  const hashBytes = await sha256(rawBytes)
  const hmacBytes = await hmacSha256(keyBytes, concatBytes(rawBytes, reportIdBytes))

  const raw = toBase64Url(rawBytes)
  const hmac = toBase64Url(hmacBytes)
  return { raw, hash: toHex(hashBytes), hmac, urlParam: `${raw}.${hmac}` }
}

export interface VerifiedToken {
  raw: string
  hash: string  // hex sha256(raw_bytes) — use to look up report_access_tokens row
}

export async function verifyToken(
  signingKey: string,
  reportId: string,
  urlParam: string,
): Promise<VerifiedToken | null> {
  if (!signingKey || !reportId || !urlParam) return null

  const dot = urlParam.indexOf('.')
  if (dot <= 0 || dot === urlParam.length - 1) return null
  const raw = urlParam.slice(0, dot)
  const submittedHmac = urlParam.slice(dot + 1)

  let rawBytes: Uint8Array
  let submittedHmacBytes: Uint8Array
  try {
    rawBytes = fromBase64Url(raw)
    submittedHmacBytes = fromBase64Url(submittedHmac)
  } catch {
    return null
  }
  if (rawBytes.length !== RAW_BYTES) return null

  const reportIdBytes = new TextEncoder().encode(reportId)
  const keyBytes = new TextEncoder().encode(signingKey)
  const expectedHmacBytes = await hmacSha256(keyBytes, concatBytes(rawBytes, reportIdBytes))

  if (!timingSafeEqual(submittedHmacBytes, expectedHmacBytes)) return null

  const hashBytes = await sha256(rawBytes)
  return { raw, hash: toHex(hashBytes) }
}

// sha256 hex of a base64url-encoded raw token. Useful in callers that already
// have `raw` in hand and want to derive the storage hash without going through
// verifyToken (e.g. cron-driven cleanup).
export async function hashRawToken(raw: string): Promise<string> {
  const bytes = fromBase64Url(raw)
  return toHex(await sha256(bytes))
}
