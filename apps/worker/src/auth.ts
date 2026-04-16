// Better Auth configuration — RBAC for SKIDS Screen
// Roles: admin, ops_manager, nurse, doctor, authority (matches V2)
// Campaigns = Organizations (users join campaigns with roles)
// Uses PBKDF2 hashing (fast on CF Workers free tier, 10ms CPU limit)

import { betterAuth } from 'better-auth'
import { organization, bearer } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/organization/access'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import type { Bindings } from './index'

// ── Access control: SKIDS role model ─────────────────────────
//
// Better Auth 1.5+ requires `Role<T>` to carry both `authorize` and
// `statements`. Rather than a loose `{authorize: () => true} as any` cast
// (which was the 2026-04-15 shim), we use `createAccessControl` to emit
// fully-typed roles whose resources are declared up front.
//
// Resource list (SKIDS-specific + org defaults):
//   - default org resources: organization, member, invitation, team, ac
//   - observation, review, analytics, child, campaign, report, media,
//     screening — mirror the permission check tree used in
//     apps/worker/src routes.
//
// Role → resource/action matrix matches the legacy predicates verbatim
// (any resource listed in `allowed` was authorized; no action-level check
// was performed). We express this as the full CRUD verb set per resource
// the role can touch, giving Better Auth's authorize() a complete view.

const skidsStatements = {
  ...defaultStatements,
  observation: ['create', 'read', 'update', 'delete'],
  review: ['create', 'read', 'update'],
  analytics: ['read'],
  child: ['create', 'read', 'update', 'delete'],
  campaign: ['create', 'read', 'update', 'delete'],
  report: ['create', 'read'],
  media: ['create', 'read'],
  screening: ['create', 'read', 'update'],
} as const

const ac = createAccessControl(skidsStatements)

// admin / ops_manager — full access across all resources.
const adminRole = ac.newRole({
  organization: ['update', 'delete'],
  member: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  team: ['create', 'update', 'delete'],
  ac: ['create', 'read', 'update', 'delete'],
  observation: ['create', 'read', 'update', 'delete'],
  review: ['create', 'read', 'update'],
  analytics: ['read'],
  child: ['create', 'read', 'update', 'delete'],
  campaign: ['create', 'read', 'update', 'delete'],
  report: ['create', 'read'],
  media: ['create', 'read'],
  screening: ['create', 'read', 'update'],
})

const opsManagerRole = adminRole // same permission surface as admin

// doctor — review observations, create reviews, read analytics, issue reports.
const doctorRole = ac.newRole({
  observation: ['read', 'update'],
  review: ['create', 'read', 'update'],
  analytics: ['read'],
  child: ['read'],
  campaign: ['read'],
  report: ['create', 'read'],
})

// nurse — field screening: create observations, register children, capture media.
const nurseRole = ac.newRole({
  observation: ['create', 'read', 'update'],
  child: ['create', 'read', 'update'],
  campaign: ['read'],
  media: ['create', 'read'],
  screening: ['create', 'read', 'update'],
})

// authority — read-only analytics and reports.
const authorityRole = ac.newRole({
  analytics: ['read'],
  report: ['read'],
  campaign: ['read'],
  child: ['read'],
})

// ── PBKDF2 password hashing (CF Workers compatible) ──────────
// Default scrypt is too slow for CF free tier (10ms CPU limit)
// PBKDF2 with 100k iterations + SHA-256 is fast & secure on edge

function arrayToBase64(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary)
}

function base64ToArray(b64: string): Uint8Array {
  const binary = atob(b64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i)
  }
  return arr
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  return `pbkdf2:${arrayToBase64(salt)}:${arrayToBase64(new Uint8Array(hash))}`
}

async function verifyPassword(data: { hash: string; password: string }): Promise<boolean> {
  const { hash, password } = data
  if (!hash.startsWith('pbkdf2:')) return false
  const [, saltB64, hashB64] = hash.split(':')
  const salt = base64ToArray(saltB64)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const computed = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  const computedB64 = arrayToBase64(new Uint8Array(computed))
  return computedB64 === hashB64
}

// ── Better Auth config ───────────────────────────────────────

export function createAuth(env: Bindings) {
  const dialect = new LibsqlDialect({
    url: env.TURSO_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  })

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: {
      dialect,
      type: 'sqlite',
    },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    user: {
      // Store role directly on user for quick access
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'nurse',
          input: true,
        },
        orgCode: {
          type: 'string',
          defaultValue: 'zpedi',
          input: true,
        },
      },
    },
    plugins: [
      bearer(), // Accept Authorization: Bearer tokens (converts to session cookie internally)
      organization({
        // Campaigns = Organizations. Each campaign has its own member roles.
        // Role definitions live above in ac.newRole(...) form so that both
        // `authorize` and `statements` are present — required by
        // Better Auth's Role<T> type (no more `as any`).
        creatorRole: 'admin',
        memberRole: 'nurse',
        ac,
        roles: {
          admin: adminRole,
          ops_manager: opsManagerRole,
          doctor: doctorRole,
          nurse: nurseRole,
          authority: authorityRole,
        },
      }),
    ],
    trustedOrigins: [
      'http://localhost:5173',
      'http://localhost:5199',
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8787',
      'http://localhost:8788',
      'https://skids-ai.vercel.app',
      'https://skids-web.pages.dev',
      'https://skids-ops.pages.dev',
      'https://parent.skids.clinic',
      'https://skidsparent.pages.dev',
      'skids-screen://',
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

// ── PIN hashing (deterministic, for direct DB lookup) ────────
// SHA-256(pin + ':' + orgCode) → hex string
// Deterministic: same pin+orgCode always produces same hash (enables index lookup)

export async function hashPin(pin: string, orgCode: string): Promise<string> {
  const data = new TextEncoder().encode(pin + ':' + orgCode)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
