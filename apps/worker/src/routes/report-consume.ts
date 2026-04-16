// Phase 03 — GET /api/reports/:id/pdf?t=<raw>.<hmac>
//
// Public consumer endpoint. Intentionally unauthenticated — the URL token IS
// the auth. No session middleware on this route; it is mounted outside the
// authMiddleware blocks in apps/worker/src/index.ts.
//
// Order of checks (cheapest -> most expensive):
//   1. parse + HMAC verify   (no DB hit on tampered tokens)
//   2. DB lookup gated on    expires_at > now() AND revoked_at IS NULL AND
//                            access_count < rate_limit
//   3. UPDATE access_count + used_at
//   4. R2 GET + stream

import { Hono } from 'hono'
import { verifyToken } from '@skids/shared'
import type { Bindings, Variables } from '../index'
import { logAudit } from './audit-log'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.get('/:id/pdf', async (c) => {
  if (!c.env.REPORT_SIGNING_KEY) {
    return c.json({ error: 'REPORT_SIGNING_KEY not configured' }, 500)
  }
  const reportId = c.req.param('id')
  const tParam = c.req.query('t')
  if (!tParam) return c.json({ error: 'Missing token' }, 403)

  // 1. HMAC verify (constant-time inside verifyToken).
  const verified = await verifyToken(c.env.REPORT_SIGNING_KEY, reportId, tParam)
  if (!verified) return c.json({ error: 'Invalid token' }, 403)

  // 2. DB lookup. Phase 03 uses `report_access_tokens` (distinct from the
  // legacy parent-portal `report_tokens` table served by report-tokens.ts).
  const db = c.get('db')
  const nowIso = new Date().toISOString()
  const row = await db.execute({
    sql: `SELECT token_hash, report_id, report_r2_key, child_id, campaign_code,
                 access_count, rate_limit, expires_at, revoked_at
          FROM report_access_tokens
          WHERE token_hash = ? AND report_id = ?
            AND expires_at > ? AND revoked_at IS NULL
            AND access_count < rate_limit`,
    args: [verified.hash, reportId, nowIso],
  })
  const r = row.rows?.[0] as Record<string, unknown> | undefined
  if (!r) return c.json({ error: 'Invalid or expired token' }, 403)

  // 3. Increment access_count + stamp used_at on first hit.
  await db.execute({
    sql: `UPDATE report_access_tokens
          SET access_count = access_count + 1,
              used_at = COALESCE(used_at, ?)
          WHERE token_hash = ?`,
    args: [nowIso, verified.hash],
  })
  const accessCountAfter = (r.access_count as number) + 1

  // 4. R2 GET + stream.
  const r2Key = String(r.report_r2_key)
  const obj = await c.env.R2_REPORTS_BUCKET.get(r2Key)
  if (!obj) {
    await logAudit(db, {
      userId: 'public',
      action: 'report.access_failed',
      entityType: 'report',
      entityId: reportId,
      details: JSON.stringify({ reason: 'r2_object_missing', r2Key }),
      ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
    })
    return c.json({ error: 'Report not found' }, 404)
  }

  // 5. Audit on every successful access.
  await logAudit(db, {
    userId: 'public',
    action: 'report.accessed',
    entityType: 'report',
    entityId: reportId,
    campaignCode: String(r.campaign_code),
    details: JSON.stringify({
      accessCountAfter,
      userAgent: c.req.header('user-agent') ?? null,
    }),
    ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
  })

  const filename = `skids-report-${reportId}.pdf`
  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})

export const reportConsumeRoutes = app
