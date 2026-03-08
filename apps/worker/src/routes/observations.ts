// Observation CRUD + batch sync routes
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const observationRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// List observations for a campaign
observationRoutes.get('/', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')
  const childId = c.req.query('child')

  let sql = 'SELECT * FROM observations WHERE 1=1'
  const args: unknown[] = []

  if (campaignCode) {
    sql += ' AND campaign_code = ?'
    args.push(campaignCode)
  }
  if (childId) {
    sql += ' AND child_id = ?'
    args.push(childId)
  }

  sql += ' ORDER BY timestamp DESC'

  const result = await db.execute({ sql, args })

  const observations = result.rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    childId: row.child_id,
    campaignCode: row.campaign_code,
    moduleType: row.module_type,
    bodyRegion: row.body_region,
    mediaUrl: row.media_url,
    mediaUrls: row.media_urls ? JSON.parse(row.media_urls as string) : [],
    mediaType: row.media_type,
    captureMetadata: row.capture_metadata ? JSON.parse(row.capture_metadata as string) : {},
    aiAnnotations: row.ai_annotations ? JSON.parse(row.ai_annotations as string) : [],
    annotationData: row.annotation_data ? JSON.parse(row.annotation_data as string) : null,
    clinicianReview: row.clinician_review ? JSON.parse(row.clinician_review as string) : null,
    riskLevel: row.risk_level,
    screenedBy: row.screened_by,
    deviceId: row.device_id,
    timestamp: row.timestamp,
    syncedAt: row.synced_at,
  }))

  return c.json({ observations })
})

// Create single observation
observationRoutes.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const id = body.id || crypto.randomUUID()

  await db.execute({
    sql: `INSERT INTO observations (id, session_id, child_id, campaign_code, module_type, body_region, media_url, media_urls, media_type, capture_metadata, ai_annotations, annotation_data, risk_level, screened_by, device_id, timestamp, synced_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      id,
      body.sessionId,
      body.childId,
      body.campaignCode,
      body.moduleType,
      body.bodyRegion || null,
      body.mediaUrl || null,
      body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
      body.mediaType || null,
      body.captureMetadata ? JSON.stringify(body.captureMetadata) : null,
      body.aiAnnotations ? JSON.stringify(body.aiAnnotations) : null,
      body.annotationData ? JSON.stringify(body.annotationData) : null,
      body.riskLevel || 0,
      body.screenedBy || 'nurse',
      body.deviceId || null,
      body.timestamp || new Date().toISOString(),
    ],
  })

  return c.json({ id, message: 'Observation saved' }, 201)
})

// Batch sync — accept multiple observations at once
observationRoutes.post('/sync', async (c) => {
  const db = c.get('db')
  const { observations, campaignCode, deviceId, nurseName } = await c.req.json()

  if (!Array.isArray(observations) || observations.length === 0) {
    return c.json({ error: 'observations array required' }, 400)
  }

  let synced = 0
  const errors: string[] = []

  for (const obs of observations) {
    try {
      await db.execute({
        sql: `INSERT OR REPLACE INTO observations (id, session_id, child_id, campaign_code, module_type, body_region, media_url, media_urls, media_type, capture_metadata, ai_annotations, annotation_data, risk_level, screened_by, device_id, timestamp, synced_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          obs.id,
          obs.sessionId,
          obs.childId,
          campaignCode || obs.campaignCode,
          obs.moduleType,
          obs.bodyRegion || null,
          obs.mediaUrl || null,
          obs.mediaUrls ? JSON.stringify(obs.mediaUrls) : null,
          obs.mediaType || null,
          obs.captureMetadata ? JSON.stringify(obs.captureMetadata) : JSON.stringify(obs.features || {}),
          obs.aiAnnotations ? JSON.stringify(obs.aiAnnotations) : JSON.stringify([{
            id: `${obs.id}-ai`,
            modelId: `${obs.moduleType}_v1`,
            features: obs.features || {},
            summaryText: obs.summaryText || '',
            confidence: obs.confidence || 0,
            qualityFlags: [],
            riskCategory: obs.riskCategory || 'no_risk',
          }]),
          obs.annotationData ? JSON.stringify(obs.annotationData) : null,
          obs.riskLevel || 0,
          nurseName || obs.screenedBy || 'nurse',
          deviceId || obs.deviceId || null,
          obs.timestamp || new Date().toISOString(),
        ],
      })
      synced++
    } catch (e) {
      errors.push(`${obs.id}: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  return c.json({
    synced,
    total: observations.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Synced ${synced}/${observations.length} observations`,
  })
})
