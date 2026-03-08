// Better Auth configuration — RBAC for SKIDS Screen
// Roles: admin, ops_manager, nurse, doctor, authority (matches V2)
// Campaigns = Organizations (users join campaigns with roles)
// Uses PBKDF2 hashing (fast on CF Workers free tier, 10ms CPU limit)

import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import type { Bindings } from './index'

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
      organization({
        // Campaigns = Organizations
        // Each campaign has its own member roles
        creatorRole: 'admin',
        memberRole: 'nurse',
        roles: {
          admin: {
            authorize: () => true, // full access — campaign, user mgmt, analytics
          },
          ops_manager: {
            authorize: () => true, // same as admin — manages operations
          },
          doctor: {
            authorize: (ctx: any) => {
              // Doctors: review observations, create reviews, view analytics
              const allowed = ['observation', 'review', 'analytics', 'child', 'campaign', 'report']
              return allowed.some(r => ctx.resource?.startsWith(r)) || false
            },
          },
          nurse: {
            authorize: (ctx: any) => {
              // Nurses: field screening, create observations, register children
              const allowed = ['observation', 'child', 'campaign', 'media', 'screening']
              return allowed.some(r => ctx.resource?.startsWith(r)) || false
            },
          },
          authority: {
            authorize: (ctx: any) => {
              // Authority: read-only analytics and reports
              const allowed = ['analytics', 'report', 'campaign', 'child']
              return allowed.some(r => ctx.resource?.startsWith(r)) || false
            },
          },
        },
      }),
    ],
    trustedOrigins: [
      'http://localhost:5173',          // web dev
      'http://localhost:3000',          // alt dev
      'http://localhost:8787',          // worker dev
      'http://localhost:8788',          // worker dev alt
      'https://skids-ai.vercel.app',   // V2 web
      'https://skids-web.pages.dev',   // V3 web dashboard
      'skids-screen://',               // mobile deep link
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
