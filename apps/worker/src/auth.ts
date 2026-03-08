// Better Auth configuration — RBAC for SKIDS Screen
// Roles: patient, nurse, doctor, admin
// Campaigns = Organizations (nurses/doctors join campaigns with roles)

import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import type { Bindings } from './index'

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
    },
    plugins: [
      organization({
        // Campaigns = Organizations
        // Each campaign has its own member roles
        creatorRole: 'admin',
        memberRole: 'nurse',
        roles: {
          admin: {
            authorize: () => true, // full access
          },
          doctor: {
            authorize: (ctx) => {
              // Doctors can read observations, create reviews, view analytics
              const allowedResources = ['observation', 'review', 'analytics', 'child', 'campaign']
              return allowedResources.some(r => ctx.resource?.startsWith(r)) || false
            },
          },
          nurse: {
            authorize: (ctx) => {
              // Nurses can create observations, register children, upload media
              const allowedResources = ['observation', 'child', 'campaign', 'media']
              return allowedResources.some(r => ctx.resource?.startsWith(r)) || false
            },
          },
          patient: {
            authorize: (ctx) => {
              // Patients can only view their own data
              return ctx.resource === 'own-data'
            },
          },
        },
      }),
    ],
    trustedOrigins: [
      'http://localhost:5173',   // web dev
      'http://localhost:3000',   // alt dev
      'http://localhost:8787',   // worker dev
      'https://skids-ai.vercel.app',  // V2 web
      'skids-screen://',         // mobile deep link
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
