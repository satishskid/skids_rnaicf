// Phase 03 — POST /api/reports/render
//
// Internal issuance endpoint. Renders a PDF, stores it in R2_REPORTS_BUCKET,
// inserts a hashed-token row into report_tokens, and returns the consumer URL
// `/api/reports/:id/pdf?t=<r>.<hmac>` for downstream delivery (parent SMS,
// admin tooling, etc). The raw token is delivered exactly once, in the
// response — it is never persisted server-side.

import { Hono } from 'hono'
import { renderTemplate } from '@skids/pdf-templates'
import { issueToken, reportRenderInputSchema } from '@skids/shared'
import type { Bindings, Variables } from '../index'
import { logAudit } from './audit-log'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  const arr = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, '0')
  return s
}

app.post('/render', async (c) => {
  const userId = c.get('userId')
  const userRole = c.get('userRole')
  if (!userId) return c.json({ error: 'Authentication required' }, 401)
  if (userRole !== 'admin' && userRole !== 'ops_manager') {
    return c.json({ error: 'Admin or ops_manager role required' }, 403)
  }
  if (!c.env.REPORT_SIGNING_KEY) {
    return c.json({ error: 'REPORT_SIGNING_KEY not configured' }, 500)
  }

  const raw = await c.req.json().catch(() => null)
  const parsed = reportRenderInputSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', issues: parsed.error.flatten() }, 400)
  }
  const input = parsed.data

  // 1. Render PDF
  const pdfBytes = await renderTemplate(input.templateName, input.data, input.locale)

  // 2. Generate report id + token
  const reportId = `rpt_${crypto.randomUUID().replace(/-/g, '')}`
  const issued = await issueToken(c.env.REPORT_SIGNING_KEY, reportId)

  // 3. Upload to R2
  const dataHash = (await sha256Hex(JSON.stringify(input.data))).slice(0, 16)
  const r2Key = `reports/${reportId}/${todayIsoDate()}/${dataHash}.pdf`
  await c.env.R2_REPORTS_BUCKET.put(r2Key, pdfBytes, {
    httpMetadata: { contentType: 'application/pdf' },
  })

  // 4. Insert report_tokens row
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
  const db = c.get('db')
  await db.execute({
    sql: `INSERT INTO report_tokens (
      token_hash, child_id, campaign_code, report_type, created_by,
      expires_at, access_count, revoked_at,
      report_id, report_r2_key, rate_limit
    ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
    args: [
      issued.hash,
      input.childId,
      input.campaignCode,
      input.reportType,
      userId,
      expiresAt,
      reportId,
      r2Key,
      input.rateLimit,
    ],
  })

  // 5. Audit
  await logAudit(db, {
    userId,
    action: 'report.issued',
    entityType: 'report',
    entityId: reportId,
    campaignCode: input.campaignCode,
    details: JSON.stringify({
      templateName: input.templateName,
      locale: input.locale,
      reportType: input.reportType,
      expiresInDays: input.expiresInDays,
      bytes: pdfBytes.byteLength,
    }),
  })

  return c.json({
    reportId,
    tokenUrl: `/api/reports/${reportId}/pdf?t=${issued.urlParam}`,
    expiresAt,
  })
})

export const reportRenderRoutes = app
