/**
 * AyuSynk Webhook Route — Receives AI heart/lung diagnosis reports from AyuShare.
 *
 * POST /api/ayusync/report — Server-to-server webhook (NO auth, optional secret)
 * GET  /api/ayusync/report — Query reports (auth required, handled per-handler)
 */

import { Hono } from 'hono'
import { createAuth } from '../auth'
import type { Bindings, Variables } from '../index'

export const ayusyncRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── POST /api/ayusync/report — Webhook from AyuShare ──
// NO auth middleware — this is a server-to-server webhook

ayusyncRoutes.post('/report', async (c) => {
  try {
    // Optional: validate shared secret
    const webhookSecret = c.env.AYUSYNC_WEBHOOK_SECRET
    if (webhookSecret) {
      const authHeader =
        c.req.header('x-ayusync-secret') || c.req.header('authorization')
      if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
    }

    const payload = await c.req.json<{
      data?: { reports?: unknown[] }
      reference_id?: string
      status?: string
    }>()

    if (!payload.data?.reports || !Array.isArray(payload.data.reports)) {
      return c.json({ error: 'Missing data.reports array' }, 400)
    }

    // Parse reference_id → campaignCode + childId
    // Format: "{campaignCode}_{childId}"
    let campaignCode = ''
    let childId = ''
    if (payload.reference_id) {
      const parts = payload.reference_id.split('_')
      if (parts.length >= 2) {
        campaignCode = parts[0]
        childId = parts.slice(1).join('_') // childId might contain underscores
      }
    }

    if (!campaignCode) {
      console.warn('[AyuSynk] No campaign code in reference_id — storing with empty campaign')
    }

    const db = c.get('db')
    const id = `ayu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    await db.execute({
      sql: `INSERT INTO ayusync_reports (id, campaign_code, child_id, reference_id, status, reports, source)
            VALUES (?, ?, ?, ?, ?, ?, 'ayushare_webhook')`,
      args: [
        id,
        campaignCode,
        childId,
        payload.reference_id || '',
        payload.status || 'unknown',
        JSON.stringify(payload.data.reports),
      ],
    })

    console.log(
      `[AyuSynk] Report stored: ${id} | campaign: ${campaignCode} | child: ${childId} | reports: ${payload.data.reports.length}`,
    )

    return c.json({ success: true })
  } catch (err) {
    console.error('[AyuSynk] Webhook error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ── GET /api/ayusync/report — Query reports (AUTH REQUIRED) ──

ayusyncRoutes.get('/report', async (c) => {
  try {
    // Manual auth check (since this route group is mounted without global auth)
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const campaign = c.req.query('campaign')
    const childId = c.req.query('child')

    if (!campaign) {
      return c.json({ error: 'Missing campaign parameter' }, 400)
    }

    const db = c.get('db')

    let result
    if (childId) {
      result = await db.execute({
        sql: `SELECT * FROM ayusync_reports
              WHERE campaign_code = ? AND child_id = ?
              ORDER BY received_at DESC LIMIT 100`,
        args: [campaign, childId],
      })
    } else {
      result = await db.execute({
        sql: `SELECT * FROM ayusync_reports
              WHERE campaign_code = ?
              ORDER BY received_at DESC LIMIT 100`,
        args: [campaign],
      })
    }

    const reports = result.rows.map((row) => ({
      id: row.id,
      campaignCode: row.campaign_code,
      childId: row.child_id,
      referenceId: row.reference_id,
      status: row.status,
      reports: JSON.parse((row.reports as string) || '[]'),
      source: row.source,
      processed: row.processed === 1,
      receivedAt: row.received_at,
    }))

    return c.json({ success: true, reports })
  } catch (err) {
    console.error('[AyuSynk] Query error:', err)
    return c.json({ error: 'Failed to fetch reports' }, 500)
  }
})
