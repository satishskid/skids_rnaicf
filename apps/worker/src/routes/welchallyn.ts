/**
 * Welch Allyn Vision Screener Route — Batch import Spot Vision Screener results.
 *
 * POST /api/campaigns/:code/welchallyn — Import vision screening results
 * GET  /api/campaigns/:code/welchallyn — Fetch imported observations
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const welchallynRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── POST /:code/welchallyn — Batch import ──

welchallynRoutes.post('/:code/welchallyn', async (c) => {
  try {
    const db = c.get('db')
    const userId = c.get('userId') || 'unknown'
    const code = c.req.param('code')

    // Verify campaign exists
    const campaign = await db.execute({
      sql: 'SELECT code FROM campaigns WHERE code = ?',
      args: [code],
    })
    if (campaign.rows.length === 0) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const body = await c.req.json<{
      observations?: Array<{
        childId: string
        childName: string
        screeningData: {
          recordId: string
          timestamp?: string
          passed?: boolean
          resultText?: string
          conditions?: unknown[]
          od?: Record<string, unknown>
          os?: Record<string, unknown>
          interpupilDistance?: number
          deviceSerial?: string
        }
        mapping: {
          suggestedChips?: string[]
          suggestedChipLabels?: string[]
          summaryText?: string
          riskCategory?: string
          prescription?: { od?: string; os?: string }
        }
      }>
    }>()

    const observations = body.observations || []
    if (!Array.isArray(observations) || observations.length === 0) {
      return c.json({ error: 'observations array required' }, 400)
    }

    let stored = 0

    for (const obs of observations) {
      const id = `wa_${obs.screeningData.recordId || Date.now()}_${obs.childId}`
      const timestamp = obs.screeningData.timestamp || new Date().toISOString()

      // Map risk category to numeric risk_level
      let riskLevel = 0
      if (obs.mapping.riskCategory === 'high') riskLevel = 2
      else if (obs.mapping.riskCategory === 'medium') riskLevel = 1

      const captureMetadata = JSON.stringify({
        source: 'welchallyn_spot',
        welchAllyn: obs.screeningData,
        mapping: obs.mapping,
        importedBy: userId,
        deviceId: `welchallyn_${obs.screeningData.deviceSerial || 'unknown'}`,
      })

      const annotationData = JSON.stringify({
        selectedChips: obs.mapping.suggestedChips || [],
        chipSeverities: {},
        pins: [],
        aiSuggestedChips: obs.mapping.suggestedChips || [],
        notes: obs.mapping.summaryText || '',
      })

      await db.execute({
        sql: `INSERT OR REPLACE INTO observations
              (id, session_id, child_id, campaign_code, module_type, capture_metadata,
               annotation_data, risk_level, screened_by, device_id, timestamp)
              VALUES (?, ?, ?, ?, 'vision', ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          `wa_import_${Date.now()}`,
          obs.childId,
          code,
          captureMetadata,
          annotationData,
          riskLevel,
          userId,
          `welchallyn_${obs.screeningData.deviceSerial || 'unknown'}`,
          timestamp,
        ],
      })
      stored++
    }

    console.log(`[Welch Allyn] Stored ${stored} observations for campaign ${code}`)

    return c.json({ success: true, stored, total: observations.length })
  } catch (err) {
    console.error('[Welch Allyn] Import error:', err)
    return c.json({ error: 'Failed to import Welch Allyn results' }, 500)
  }
})

// ── GET /:code/welchallyn — Fetch Welch Allyn observations ──

welchallynRoutes.get('/:code/welchallyn', async (c) => {
  try {
    const db = c.get('db')
    const code = c.req.param('code')

    const result = await db.execute({
      sql: `SELECT * FROM observations
            WHERE campaign_code = ? AND module_type = 'vision'
              AND json_extract(capture_metadata, '$.source') = 'welchallyn_spot'
            ORDER BY timestamp DESC LIMIT 500`,
      args: [code],
    })

    const observations = result.rows.map((row) => ({
      id: row.id,
      childId: row.child_id,
      moduleType: row.module_type,
      captureMetadata: JSON.parse((row.capture_metadata as string) || '{}'),
      annotationData: JSON.parse((row.annotation_data as string) || '{}'),
      riskLevel: row.risk_level,
      timestamp: row.timestamp,
      createdAt: row.created_at,
    }))

    return c.json({ success: true, observations })
  } catch (err) {
    console.error('[Welch Allyn] Query error:', err)
    return c.json({ error: 'Failed to fetch observations' }, 500)
  }
})
