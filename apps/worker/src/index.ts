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
// Phase 03 — PDF report issuance + consumer + cron pre-warm
import { reportRenderRoutes } from './routes/report-render'
import { reportConsumeRoutes } from './routes/report-consume'
import { scheduledHandler } from './scheduled'
import { pinAuthRoutes } from './routes/pin-auth'
import { educationRoutes } from './routes/education'
import { accountRoutes } from './routes/account'
import { campaignAssignmentRoutes } from './routes/campaign-assignments'
import { parentPortalRoutes } from './routes/parent-portal'
import { consentRoutes } from './routes/consents'
import { instrumentRoutes } from './routes/instruments'
import { studyRoutes } from './routes/studies'
import { cohortRoutes } from './routes/cohorts'
import { deviceStatusRoutes } from './routes/device-status'
import { auditLogRoutes } from './routes/audit-log'
import { similarityRoutes } from './routes/similarity'
import { adminEmbeddingsRoutes } from './routes/admin-embeddings'
import { modelsRoutes } from './routes/models'
import { onDeviceAiRoutes } from './routes/on-device-ai'
import { createTursoClient } from '@skids/db'
import { createAuth } from './auth'
import { authMiddleware, requireRole } from './middleware/auth'
import { firebaseAuthMiddleware } from './middleware/firebase-auth'
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
  AI: Ai                  // Cloudflare Workers AI (free, no API key needed)
  GEMINI_API_KEY?: string   // Phase 2 — OPTIONAL per-org overflow only (tier 3)
  // Phase 2 — Cloudflare AI Gateway + Langfuse
  AI_GATEWAY_ACCOUNT_ID: string
  AI_GATEWAY_ID: string
  // Primary cloud provider (required — same model family as workers-ai tier 1)
  GROQ_API_KEY: string
  // Optional per-org overflow, enabled via ai_config.features_json.overflow_providers
  ANTHROPIC_API_KEY?: string
  // Phase 1 — Turso vectors feature flag (default ON; set to '0' or 'false' to disable)
  FEATURE_TURSO_VECTORS?: string
  // Phase 2 — AI Gateway feature flag (default ON; set to '0' or 'false' to bypass gateway)
  FEATURE_AI_GATEWAY?: string
  // Phase 02a — on-device Liquid AI weight shards (R2 bucket `skids-models`)
  R2_MODELS_BUCKET: R2Bucket
  // Phase 03 — PDF report bucket + URL HMAC signing key (see wrangler.toml)
  R2_REPORTS_BUCKET: R2Bucket
  REPORT_SIGNING_KEY: string
  // Phase 03 — cron pre-warm kill switch ('1' = enabled). Default off.
  FEATURE_REPORT_PREWARM?: string
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
      'https://skids-ops.pages.dev',
      'https://parent.skids.clinic',
      'https://skidsparent.pages.dev',
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

// Similarity search (Phase 1) — requires auth
app.use('/api/similarity', authMiddleware)
app.use('/api/similarity/*', authMiddleware)
app.route('/api/similarity', similarityRoutes)
app.route('/api/reviews', reviewRoutes)

// Admin routes — require admin role
app.use('/api/admin', authMiddleware)
app.use('/api/admin/*', authMiddleware)
app.use('/api/admin', requireRole('admin'))
app.use('/api/admin/*', requireRole('admin'))
app.route('/api/admin', adminRoutes)

// Phase 1 — admin embedding backfill (admin-only via requireRole above)
app.route('/api/admin', adminEmbeddingsRoutes)

// Campaign assignments — admin/ops_manager only (authority scoping)
app.use('/api/campaign-assignments', authMiddleware)
app.use('/api/campaign-assignments/*', authMiddleware)
app.use('/api/campaign-assignments', requireRole('admin', 'ops_manager'))
app.use('/api/campaign-assignments/*', requireRole('admin', 'ops_manager'))
app.route('/api/campaign-assignments', campaignAssignmentRoutes)

// Training routes — require auth
app.use('/api/training', authMiddleware)
app.use('/api/training/*', authMiddleware)
app.route('/api', trainingRoutes)

// R2 — APK download is public, presign/upload/file require auth
app.use('/api/r2/presign', authMiddleware)
app.use('/api/r2/upload', authMiddleware)
app.use('/api/r2/file/*', authMiddleware)
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
// Phase 2 — cloud AI is DOCTOR-ONLY (admin allowed for Settings test-gateway).
// Nurses receive 403 with a pointer to the Phase 02a on-device flow.
app.use('/api/ai', authMiddleware)
app.use('/api/ai/*', authMiddleware)
app.use('/api/ai', requireRole('doctor', 'admin'))
app.use('/api/ai/*', requireRole('doctor', 'admin'))
app.route('/api/ai', aiGatewayRoutes)

// AI Config — require admin (API keys, model settings)
app.use('/api/ai-config', authMiddleware)
app.use('/api/ai-config/*', authMiddleware)
app.use('/api/ai-config', requireRole('admin'))
app.use('/api/ai-config/*', requireRole('admin'))
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

// Report tokens — POST root + bulk-release + campaign listing require auth
// GET /api/report-tokens/:token is public (parent access via 12-char token)
// POST /api/report-tokens/:token/verify is public (parent DOB verification)
app.post('/api/report-tokens', authMiddleware)
app.post('/api/report-tokens/bulk-release', authMiddleware)
app.get('/api/report-tokens/campaign/*', authMiddleware)
app.route('/api/report-tokens', reportTokenRoutes)

// Phase 03 — PDF report routes.
// /api/reports/render is admin-gated; /api/reports/:id/pdf is intentionally
// public (URL HMAC token IS the auth — no authMiddleware on this mount).
app.use('/api/reports/render', authMiddleware)
app.route('/api/reports', reportRenderRoutes)
app.route('/api/reports', reportConsumeRoutes)

// Parent portal — mixed auth:
// POST /generate-qr requires Better Auth (admin backfill migration)
// POST /lookup, /verify are public (QR code + DOB verification)
// POST /claim-child, GET /my-children, /child/* require Firebase auth (parent portal)
app.post('/api/parent-portal/generate-qr', authMiddleware)
app.post('/api/parent-portal/generate-qr', requireRole('admin', 'ops_manager'))
app.post('/api/parent-portal/claim-child', firebaseAuthMiddleware)
app.get('/api/parent-portal/my-children', firebaseAuthMiddleware)
app.get('/api/parent-portal/child/*', firebaseAuthMiddleware)
app.route('/api/parent-portal', parentPortalRoutes)

// Self-service account routes — require auth (any role)
app.use('/api/account', authMiddleware)
app.use('/api/account/*', authMiddleware)
app.route('/api/account', accountRoutes)

// Education — public endpoint (used by parent report)
app.route('/api/education', educationRoutes)

// ── Clinical Research Platform ──────────────────
// Consent management — require auth
app.use('/api/consents', authMiddleware)
app.use('/api/consents/*', authMiddleware)
app.route('/api/consents', consentRoutes)

// Instruments / Surveys — require auth
app.use('/api/instruments', authMiddleware)
app.use('/api/instruments/*', authMiddleware)
app.route('/api/instruments', instrumentRoutes)

// Clinical Studies — require auth
app.use('/api/studies', authMiddleware)
app.use('/api/studies/*', authMiddleware)
app.route('/api/studies', studyRoutes)

// Cohort definitions & population health — require auth
app.use('/api/cohorts', authMiddleware)
app.use('/api/cohorts/*', authMiddleware)
app.route('/api/cohorts', cohortRoutes)

// Device readiness — any auth for reporting, admin/ops_manager for fleet view
app.use('/api/device-status', authMiddleware)
app.use('/api/device-status/*', authMiddleware)
app.use('/api/device-status/fleet', requireRole('admin', 'ops_manager'))
app.use('/api/device-status/fleet/*', requireRole('admin', 'ops_manager'))
app.route('/api/device-status', deviceStatusRoutes)

// Audit log — admin only
app.use('/api/audit-log', authMiddleware)
app.use('/api/audit-log/*', authMiddleware)
app.use('/api/audit-log', requireRole('admin'))
app.use('/api/audit-log/*', requireRole('admin'))
app.route('/api/audit-log', auditLogRoutes)

// Phase 02a — on-device Liquid AI weight shards, same-origin from R2 (nurse + doctor).
app.use('/api/models', authMiddleware)
app.use('/api/models/*', authMiddleware)
app.route('/api/models', modelsRoutes)

// Phase 02a — on-device AI HITL outcome audit (any authenticated clinical role;
// role/outcome matrix enforced inside the route).
app.use('/api/on-device-ai', authMiddleware)
app.use('/api/on-device-ai/*', authMiddleware)
app.route('/api/on-device-ai', onDeviceAiRoutes)

// Root
app.get('/', (c) => {
  return c.json({
    name: 'SKIDS Screen API',
    version: '3.1.0',
    stack: 'Hono + Turso + Better Auth on Cloudflare Workers',
    docs: '/api/health',
  })
})

// Default export upgraded to the object form to attach the Phase 03 scheduled
// handler alongside fetch. Keeps `app.fetch` wiring intact.
export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
} satisfies ExportedHandler<Bindings>
export type AppType = typeof app
