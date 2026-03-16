/**
 * Firebase ID Token Verification Middleware for Parent Portal Routes
 *
 * Verifies Firebase ID tokens sent by the parent portal (Astro + Firebase Auth).
 * Uses Google's public keys to verify JWT signatures without any Firebase SDK dependency.
 *
 * Flow:
 * 1. Parent portal authenticates user via Firebase (Google/Phone OTP)
 * 2. Parent portal sends Firebase ID token in Authorization header
 * 3. This middleware verifies the token and extracts firebase_uid
 * 4. Sets firebaseUid on context for downstream handlers
 */

import { createMiddleware } from 'hono/factory'
import type { Bindings, Variables } from '../index'

// Extended variables for parent portal routes
export type ParentVariables = Variables & {
  firebaseUid: string
  firebaseEmail?: string
  firebaseName?: string
  firebasePhone?: string
}

// Google's public key endpoint for Firebase token verification
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

// Firebase project ID — must match the parent portal's Firebase project
const FIREBASE_PROJECT_ID = 'skidsparent'

// Cache for Google's public keys (refreshed when expired)
let cachedKeys: { keys: Record<string, string>; expiresAt: number } | null = null

/**
 * Fetch Google's public keys for Firebase token verification.
 * Keys are cached based on Cache-Control header.
 */
async function getGooglePublicKeys(): Promise<Record<string, string>> {
  if (cachedKeys && Date.now() < cachedKeys.expiresAt) {
    return cachedKeys.keys
  }

  const res = await fetch(GOOGLE_CERTS_URL)
  if (!res.ok) {
    throw new Error(`Failed to fetch Google public keys: ${res.status}`)
  }

  // Parse cache-control to determine expiry
  const cacheControl = res.headers.get('cache-control') || ''
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600

  const keys = await res.json() as Record<string, string>
  cachedKeys = {
    keys,
    expiresAt: Date.now() + maxAge * 1000,
  }

  return keys
}

/**
 * Decode a base64url-encoded string to a regular string.
 */
function base64urlDecode(str: string): string {
  // Replace base64url chars with standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  // Pad with '=' if needed
  const padding = base64.length % 4
  if (padding) base64 += '='.repeat(4 - padding)
  return atob(base64)
}

/**
 * Import an X.509 certificate PEM as a CryptoKey for RS256 verification.
 */
async function importPublicKey(pem: string): Promise<CryptoKey> {
  // Extract base64 content between BEGIN/END CERTIFICATE markers
  const pemContents = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '')

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  return crypto.subtle.importKey(
    'spki',
    extractPublicKeyFromCert(binaryDer),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )
}

/**
 * Extract SubjectPublicKeyInfo from a DER-encoded X.509 certificate.
 * This is a simplified parser that finds the SPKI within the certificate.
 */
function extractPublicKeyFromCert(certDer: Uint8Array): ArrayBuffer {
  // X.509 certificates contain the SubjectPublicKeyInfo as a nested structure.
  // We use a simplified approach: re-encode as PEM and use a known offset pattern.
  // For RS256 Firebase tokens, the key is always RSA 2048-bit.

  // Find the SubjectPublicKeyInfo sequence in the certificate
  // It starts with 30 82 (SEQUENCE) followed by the public key info
  // We'll use the Web Crypto API with the raw certificate format

  // Actually, CF Workers support importKey with 'spki' from certificate.
  // We need to extract the public key bytes from the X.509 cert.

  // Simple DER parser to find SubjectPublicKeyInfo
  let offset = 0
  const view = new DataView(certDer.buffer)

  function readTag(): { tag: number; length: number; headerLength: number } {
    const tag = certDer[offset]
    offset++
    let length = certDer[offset]
    offset++
    let headerLength = 2

    if (length & 0x80) {
      const numBytes = length & 0x7f
      length = 0
      for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | certDer[offset]
        offset++
        headerLength++
      }
    }

    return { tag, length, headerLength }
  }

  // Parse outer SEQUENCE (Certificate)
  const cert = readTag() // SEQUENCE
  // Parse TBSCertificate SEQUENCE
  const tbs = readTag() // SEQUENCE
  const tbsStart = offset

  // version [0] EXPLICIT
  if (certDer[offset] === 0xa0) {
    const ver = readTag()
    offset += ver.length
  }

  // serialNumber INTEGER
  const serial = readTag()
  offset += serial.length

  // signature AlgorithmIdentifier SEQUENCE
  const sigAlg = readTag()
  offset += sigAlg.length

  // issuer Name SEQUENCE
  const issuer = readTag()
  offset += issuer.length

  // validity SEQUENCE
  const validity = readTag()
  offset += validity.length

  // subject Name SEQUENCE
  const subject = readTag()
  offset += subject.length

  // subjectPublicKeyInfo SEQUENCE — this is what we want!
  const spkiOffset = offset
  const spki = readTag()
  const spkiTotalLength = spki.length + spki.headerLength

  return certDer.slice(spkiOffset, spkiOffset + spkiTotalLength).buffer
}

/**
 * Verify a Firebase ID token and return the decoded payload.
 */
async function verifyFirebaseToken(token: string): Promise<{
  uid: string
  email?: string
  name?: string
  phone_number?: string
  aud: string
  iss: string
  exp: number
  iat: number
}> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  const [headerB64, payloadB64, signatureB64] = parts

  // Decode header to get kid (key ID)
  const header = JSON.parse(base64urlDecode(headerB64))
  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported algorithm: ${header.alg}`)
  }

  // Decode payload
  const payload = JSON.parse(base64urlDecode(payloadB64))

  // Verify claims before checking signature (fail fast)
  const now = Math.floor(Date.now() / 1000)

  if (payload.exp < now) {
    throw new Error('Token expired')
  }

  if (payload.iat > now + 300) {
    throw new Error('Token issued in the future')
  }

  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error(`Invalid audience: ${payload.aud}`)
  }

  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new Error(`Invalid issuer: ${payload.iss}`)
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Missing or invalid sub claim')
  }

  // Fetch Google's public keys and verify signature
  const publicKeys = await getGooglePublicKeys()
  const certPem = publicKeys[header.kid]
  if (!certPem) {
    // Key not found — might be rotated, force refresh
    cachedKeys = null
    const freshKeys = await getGooglePublicKeys()
    const freshCert = freshKeys[header.kid]
    if (!freshCert) {
      throw new Error(`Unknown key ID: ${header.kid}`)
    }
  }

  const cert = publicKeys[header.kid] || (await getGooglePublicKeys())[header.kid]
  const publicKey = await importPublicKey(cert)

  // Verify signature
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = Uint8Array.from(
    base64urlDecode(signatureB64),
    c => c.charCodeAt(0)
  )

  const isValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    signedData
  )

  if (!isValid) {
    throw new Error('Invalid token signature')
  }

  return {
    uid: payload.sub,
    email: payload.email,
    name: payload.name,
    phone_number: payload.phone_number,
    aud: payload.aud,
    iss: payload.iss,
    exp: payload.exp,
    iat: payload.iat,
  }
}

/**
 * Firebase Auth Middleware — verifies Firebase ID token from Authorization header.
 * Sets firebaseUid, firebaseEmail, firebaseName, firebasePhone on context.
 *
 * Usage:
 *   app.use('/api/parent-portal/protected/*', firebaseAuthMiddleware)
 */
export const firebaseAuthMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: ParentVariables
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header. Send: Bearer <firebase-id-token>' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const decoded = await verifyFirebaseToken(token)

    c.set('firebaseUid', decoded.uid)
    if (decoded.email) c.set('firebaseEmail' as any, decoded.email)
    if (decoded.name) c.set('firebaseName' as any, decoded.name)
    if (decoded.phone_number) c.set('firebasePhone' as any, decoded.phone_number)

    await next()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token verification failed'
    return c.json({ error: `Firebase auth failed: ${message}` }, 401)
  }
})
