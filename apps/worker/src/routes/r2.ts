/**
 * R2 Presigned URL Route — Generates presigned PUT URLs for direct client→R2 uploads.
 * Uses AWS4-HMAC-SHA256 signing (S3-compatible) via Web Crypto API.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const r2Routes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── S3-compatible signing helpers ──

const ALGORITHM = 'AWS4-HMAC-SHA256'
const SERVICE = 's3'
const REGION = 'auto' // R2 uses 'auto' region

async function hmacSHA256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? key : new Uint8Array(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

async function sha256(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
  return toHex(digest)
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSHA256(new TextEncoder().encode('AWS4' + secretKey), dateStamp)
  const kRegion = await hmacSHA256(kDate, region)
  const kService = await hmacSHA256(kRegion, service)
  return hmacSHA256(kService, 'aws4_request')
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function generatePresignedUrl(
  key: string,
  contentType: string,
  accessKeyId: string,
  secretAccessKey: string,
  endpoint: string,
  bucket: string,
  expiresIn = 3600,
): Promise<string> {
  const url = new URL(`${endpoint}/${bucket}/${key}`)
  const now = new Date()
  const dateStamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 8)
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z')
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`

  const params = new URLSearchParams({
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'content-type;host',
  })

  const sortedParams = new URLSearchParams([...params.entries()].sort())

  const canonicalUri = `/${bucket}/${key}`
  const canonicalQuerystring = sortedParams.toString()
  const canonicalHeaders = `content-type:${contentType}\nhost:${url.host}\n`
  const signedHeaders = 'content-type;host'

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = [ALGORITHM, amzDate, credentialScope, canonicalRequestHash].join('\n')

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, REGION, SERVICE)
  const signature = toHex(await hmacSHA256(signingKey, stringToSign))

  sortedParams.set('X-Amz-Signature', signature)
  return `${url.origin}${canonicalUri}?${sortedParams.toString()}`
}

// ── POST /api/r2/presign ──

// ── GET /api/r2/apk — Authenticated APK download ──

r2Routes.get('/apk', async (c) => {
  const userId = c.get('userId')
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  try {
    const bucket = c.env.R2_BUCKET
    if (!bucket) {
      return c.json({ error: 'R2 bucket not configured' }, 500)
    }

    const obj = await bucket.get('apk/SKIDS-Screen-latest.apk')
    if (!obj) {
      return c.json({ error: 'APK not found' }, 404)
    }

    const headers = new Headers()
    headers.set('Content-Type', 'application/vnd.android.package-archive')
    headers.set('Content-Disposition', 'attachment; filename="SKIDS-Screen-3.1.0.apk"')
    headers.set('Content-Length', obj.size.toString())
    headers.set('Cache-Control', 'no-cache')

    return new Response(obj.body, { headers })
  } catch (err) {
    console.error('APK download error:', err)
    return c.json({ error: 'Download failed' }, 500)
  }
})

// ── GET /api/r2/apk/info — APK metadata (version, size, date) ──

r2Routes.get('/apk/info', async (c) => {
  try {
    const bucket = c.env.R2_BUCKET
    if (!bucket) {
      return c.json({ error: 'R2 bucket not configured' }, 500)
    }

    const obj = await bucket.head('apk/SKIDS-Screen-latest.apk')
    if (!obj) {
      return c.json({ available: false })
    }

    return c.json({
      available: true,
      size: obj.size,
      sizeHuman: `${Math.round(obj.size / 1024 / 1024)} MB`,
      uploaded: obj.uploaded.toISOString(),
      etag: obj.etag,
    })
  } catch {
    return c.json({ available: false })
  }
})

// ── POST /api/r2/apk/upload — Admin uploads new APK version ──

r2Routes.post('/apk/upload', async (c) => {
  const userRole = c.get('userRole')
  if (!userRole || !['admin', 'ops_manager'].includes(userRole)) {
    return c.json({ error: 'Admin or ops_manager role required' }, 403)
  }

  try {
    const bucket = c.env.R2_BUCKET
    if (!bucket) {
      return c.json({ error: 'R2 bucket not configured' }, 500)
    }

    const body = await c.req.arrayBuffer()
    if (body.byteLength < 1000) {
      return c.json({ error: 'Invalid APK file' }, 400)
    }

    await bucket.put('apk/SKIDS-Screen-latest.apk', body, {
      httpMetadata: { contentType: 'application/vnd.android.package-archive' },
    })

    return c.json({
      ok: true,
      size: body.byteLength,
      sizeHuman: `${Math.round(body.byteLength / 1024 / 1024)} MB`,
    })
  } catch (err) {
    console.error('APK upload error:', err)
    return c.json({ error: 'Upload failed' }, 500)
  }
})

// ── POST /api/r2/presign ──

r2Routes.post('/presign', async (c) => {
  try {
    const accessKeyId = c.env.CLOUDFLARE_R2_ACCESS_KEY_ID
    const secretAccessKey = c.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    const endpoint = c.env.CLOUDFLARE_R2_ENDPOINT
    const bucket = c.env.CLOUDFLARE_R2_BUCKET || 'skids-media'

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      return c.json({ error: 'R2 credentials not configured' }, 500)
    }

    const body = await c.req.json<{ key?: string; contentType?: string; size?: number }>()
    const { key, contentType, size } = body

    if (!key || !contentType) {
      return c.json({ error: 'Missing key or contentType' }, 400)
    }

    // Path validation: decode segments, allowlist characters
    const keyParts = key.split('/')
    const decoded = keyParts.map((p: string) => {
      try {
        return decodeURIComponent(p)
      } catch {
        return p
      }
    })
    if (
      decoded.length < 3 ||
      decoded.some(
        (p: string) => p === '..' || p === '' || p === '.' || !/^[a-zA-Z0-9._-]+$/.test(p),
      )
    ) {
      return c.json({ error: 'Invalid key format' }, 400)
    }

    // Size limit: 50MB
    if (size && size > 50 * 1024 * 1024) {
      return c.json({ error: 'File too large (max 50MB)' }, 400)
    }

    const uploadUrl = await generatePresignedUrl(
      key,
      contentType,
      accessKeyId,
      secretAccessKey,
      endpoint,
      bucket,
    )
    const publicUrl = `${endpoint}/${bucket}/${key}`

    return c.json({ uploadUrl, publicUrl, key })
  } catch (err) {
    console.error('R2 presign error:', err)
    return c.json({ error: 'Presign failed' }, 500)
  }
})
