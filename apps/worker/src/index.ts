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
import { createAuth } from './auth'
import { authMiddleware, requireRole } from './middleware/auth'
import type { Client } from '@libsql/client'

// Cloudflare Workers bindings
export type Bindings = {
  TURSO_URL: string
  TURSO_AUTH_TOKEN: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_API_KEY: string
  BETTER_AUTH_URL: string
  ENVIRONMENT: string
  LANGFUSE_SECRET_KEY: string
  LANGFUSE_PUBLIC_KEY: string
  LANGFUSE_BASE_URL: string
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
  origin: (origin) => {
    // Allow known web origins
    // Allow any localhost port for dev
    if (origin && origin.startsWith('http://localhost:')) return origin
    const allowed = [
      'https://skids-ai.vercel.app',
      'https://skids-web.pages.dev',
    ]
    if (allowed.includes(origin)) return origin
    // Allow mobile (no origin) and Expo dev
    if (!origin || origin.startsWith('exp://')) return origin || '*'
    return 'https://skids-web.pages.dev'
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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

// ── Better Auth handler ─────────────────────
// Handles: /api/auth/* (login, register, session, OAuth, org)
app.all('/api/auth/*', async (c) => {
  const auth = createAuth(c.env)
  return auth.handler(c.req.raw)
})

// ── Auth-protected routes ───────────────────
// Health check is public
app.route('/api/health', healthRoutes)

// Protected routes — require valid session
// Note: must cover both base path and sub-paths
app.use('/api/campaigns', authMiddleware)
app.use('/api/campaigns/*', authMiddleware)
app.use('/api/children', authMiddleware)
app.use('/api/children/*', authMiddleware)
app.use('/api/observations', authMiddleware)
app.use('/api/observations/*', authMiddleware)
app.use('/api/reviews', authMiddleware)
app.use('/api/reviews/*', authMiddleware)

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
