// SKIDS Screen V3 — Hono API on Cloudflare Workers
// Backend: Hono + Turso + Better Auth

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { campaignRoutes } from './routes/campaigns'
import { childrenRoutes } from './routes/children'
import { observationRoutes } from './routes/observations'
import { reviewRoutes } from './routes/reviews'
import { healthRoutes } from './routes/health'
import { createTursoClient } from '@skids/db'
import type { Client } from '@libsql/client'

// Cloudflare Workers bindings
export type Bindings = {
  TURSO_URL: string
  TURSO_AUTH_TOKEN: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_API_KEY: string
  BETTER_AUTH_URL: string
  ENVIRONMENT: string
  // R2_BUCKET: R2Bucket  // uncomment when ready
  // AI: Ai              // uncomment when ready
}

// Variables set per-request
export type Variables = {
  db: Client
  userId?: string
  userRole?: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── Global middleware ────────────────────────
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://skids-ai.vercel.app'],
  credentials: true,
}))

// Inject Turso client per request (CF Workers are stateless)
app.use('*', async (c, next) => {
  const db = createTursoClient({
    url: c.env.TURSO_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  })
  c.set('db', db)
  await next()
})

// ── Routes ──────────────────────────────────
app.route('/api/health', healthRoutes)
app.route('/api/campaigns', campaignRoutes)
app.route('/api/children', childrenRoutes)
app.route('/api/observations', observationRoutes)
app.route('/api/reviews', reviewRoutes)

// Root
app.get('/', (c) => {
  return c.json({
    name: 'SKIDS Screen API',
    version: '3.0.0',
    stack: 'Hono + Turso + Better Auth on Cloudflare Workers',
    docs: '/api/health',
  })
})

export default app
export type AppType = typeof app
