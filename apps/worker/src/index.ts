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
import { adminRoutes } from './routes/admin'
import { trainingRoutes } from './routes/training'
import { r2Routes } from './routes/r2'
import { ayusyncRoutes } from './routes/ayusync'
import { welchallynRoutes } from './routes/welchallyn'
import { awsProxyRoutes } from './routes/aws-proxy'
import { aiGatewayRoutes } from './routes/ai-gateway'
import { aiConfigRoutes } from './routes/ai-config'
import { exportRoutes } from './routes/export'
import { campaignProgressRoutes } from './routes/campaign-progress'
import { screeningEventsRoutes } from './routes/screening-events'
import { reportTokenRoutes } from './routes/report-tokens'
import { pinAuthRoutes } from './routes/pin-auth'
import { educationRoutes } from './routes/education'
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
  // R2 media uploads
  CLOUDFLARE_R2_ACCESS_KEY_ID: string
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: string
  CLOUDFLARE_R2_ENDPOINT: string
  CLOUDFLARE_R2_BUCKET: string
  R2_BUCKET: R2Bucket
  // AyuSynk webhook
  AYUSYNC_WEBHOOK_SECRET: string
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

// ── PIN auth (public, no authMiddleware) ────
app.route('/api/pin-auth', pinAuthRoutes)

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

// Admin routes — require admin role
app.use('/api/admin', authMiddleware)
app.use('/api/admin/*', authMiddleware)
app.use('/api/admin', requireRole('admin'))
app.use('/api/admin/*', requireRole('admin'))
app.route('/api/admin', adminRoutes)

// Training routes — require auth
app.use('/api/training', authMiddleware)
app.use('/api/training/*', authMiddleware)
app.route('/api', trainingRoutes)

// R2 presigned upload — require auth
app.use('/api/r2', authMiddleware)
app.use('/api/r2/*', authMiddleware)
app.route('/api/r2', r2Routes)

// AyuSynk — webhook POST is public, GET is auth-protected per-handler
// Do NOT add authMiddleware here (POST is a server-to-server webhook)
app.route('/api/ayusync', ayusyncRoutes)

// Welch Allyn — mounted under /api/campaigns (already auth-protected above)
app.route('/api/campaigns', welchallynRoutes)

// AWS API proxy — require auth
app.use('/api/aws-proxy', authMiddleware)
app.use('/api/aws-proxy/*', authMiddleware)
app.route('/api/aws-proxy', awsProxyRoutes)

// AI Gateway — require auth
app.use('/api/ai', authMiddleware)
app.use('/api/ai/*', authMiddleware)
app.route('/api/ai', aiGatewayRoutes)

// AI Config — require admin
app.use('/api/ai-config', authMiddleware)
app.use('/api/ai-config/*', authMiddleware)
app.route('/api/ai-config', aiConfigRoutes)

// Export routes — require auth
app.use('/api/export', authMiddleware)
app.use('/api/export/*', authMiddleware)
app.route('/api/export', exportRoutes)

// Campaign progress — require auth
app.use('/api/campaign-progress', authMiddleware)
app.use('/api/campaign-progress/*', authMiddleware)
app.route('/api/campaign-progress', campaignProgressRoutes)

// Screening events — require auth
app.use('/api/screening-events', authMiddleware)
app.use('/api/screening-events/*', authMiddleware)
app.route('/api/screening-events', screeningEventsRoutes)

// Report tokens — POST requires auth, GET/:token is public (parent access)
app.post('/api/report-tokens', authMiddleware)
app.route('/api/report-tokens', reportTokenRoutes)

// Education — public endpoint (used by parent report)
app.route('/api/education', educationRoutes)

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
