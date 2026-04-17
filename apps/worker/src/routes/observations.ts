// Observation CRUD + batch sync routes
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import type { InValue } from '@libsql/client'

import { embedAndStoreBackground } from '../lib/embeddings'

export const observationRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Phase 05 — kick off the durable workflow when the rollout flag is on and
// the runtime has a workflow binding. Returns the instance id on success,
// or null to signal the caller to fall back to the inline insert path.
async function kickoffWorkflow(
  env: Bindings,
  payload: {
    id: string
    sessionId: string
    childId: string
    campaignCode: string
    moduleType: string
    bodyRegion?: string | null
    mediaUrl?: string | null
    mediaUrls?: string[] | null
    mediaType?: string | null
    captureMetadata?: unknown
    aiAnnotations?: unknown
    annotationData?: unknown
    riskLevel?: number
    screenedBy?: string
    deviceId?: string | null
    timestamp?: string
    confidence?: number
  }
): Promise<string | null> {
  if (env.FEATURE_USE_WORKFLOW !== '1' || !env.SCREENING_WF) return null
  try {
    const instance = await env.SCREENING_WF.create({
      params: { observation: payload },
    })
    return instance.id
  } catch (err) {
    console.warn('[observations] workflow kickoff failed — falling back to inline', err)
    return null
  }
}

// List observations for a campaign
observationRoutes.get('/', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')
  const childId = c.req.query('child')
  const userRole = c.get('userRole')
  const userId = c.get('userId')

  // Authority users can only access observations from assigned campaigns
  if (userRole === 'authority' && campaignCode) {
    try {
      const assignment = await db.execute({
        sql: 'SELECT id FROM campaign_assignments WHERE user_id = ? AND campaign_code = ?',
        args: [userId ?? null, campaignCode],
      })
      if (assignment.rows.length === 0) {
        return c.json({ error: 'Not authorized for this campaign' }, 403)
      }
    } catch {
      return c.json({ error: 'Not authorized for this campaign' }, 403)
    }
  }

  let sql = 'SELECT * FROM observations WHERE 1=1'
  const args: InValue[] = []

  if (userRole === 'authority') {
    // Authority without specific campaign: only see assigned campaigns
    sql += ` AND campaign_code IN (SELECT campaign_code FROM campaign_assignments WHERE user_id = ?)`
    args.push(userId ?? null)
  }

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

  // Phase 05 — durable workflow path. Null result means "fallback inline".
  const workflowId = await kickoffWorkflow(c.env, { ...body, id })
  if (workflowId) {
    return c.json({ id, workflowId, message: 'Observation enqueued for durable workflow' }, 202)
  }

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

  // Phase 1 — fire-and-forget embedding (never blocks the nurse)
  try {
    const ai = c.env.AI
    if (ai && isFeatureEnabled(c, 'turso_vectors')) {
      const exec = (c.executionCtx as unknown as { waitUntil?: (p: Promise<unknown>) => void } | undefined)
      const task = embedAndStoreBackground(db, ai, {
        id,
        module_type: body.moduleType,
        body_region: body.bodyRegion || null,
        ai_annotations: body.aiAnnotations ? JSON.stringify(body.aiAnnotations) : null,
        annotation_data: body.annotationData ? JSON.stringify(body.annotationData) : null,
        risk_level: body.riskLevel || 0,
      })
      if (exec?.waitUntil) exec.waitUntil(task); else void task
    }
  } catch (err) {
    console.warn('[observations.post] embed kickoff failed', err)
  }

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
      // Phase 1 — fire-and-forget embedding
      try {
        const ai = c.env.AI
        if (ai && isFeatureEnabled(c, 'turso_vectors')) {
          const exec = (c.executionCtx as unknown as { waitUntil?: (p: Promise<unknown>) => void } | undefined)
          const task = embedAndStoreBackground(db, ai, {
            id: obs.id,
            module_type: obs.moduleType,
            body_region: obs.bodyRegion || null,
            ai_annotations: obs.aiAnnotations ? JSON.stringify(obs.aiAnnotations) : null,
            annotation_data: obs.annotationData ? JSON.stringify(obs.annotationData) : null,
            risk_level: obs.riskLevel || 0,
          })
          if (exec?.waitUntil) exec.waitUntil(task); else void task
        }
      } catch {
        /* embed failure does not fail sync */
      }
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

// ── Doctor Review Feedback ──

/**
 * Submit doctor review for an observation.
 * Records whether doctor confirmed or corrected AI findings.
 * This is the core feedback loop for AI accuracy improvement.
 *
 * Body: {
 *   status: 'confirmed' | 'corrected',
 *   confirmedFindings: string[],    // chip IDs doctor confirms as real
 *   corrections: Array<{ field, aiValue, correctedValue, reason? }>,
 *   riskLevel: 'normal' | 'low' | 'moderate' | 'high',
 *   notes?: string,
 * }
 */
observationRoutes.patch('/:id/doctor-review', async (c) => {
  const db = c.get('db')
  const observationId = c.req.param('id')
  const doctorId = c.get('userId') || 'doctor'
  const body = await c.req.json()

  if (!body.status || !['confirmed', 'corrected'].includes(body.status)) {
    return c.json({ error: 'status must be "confirmed" or "corrected"' }, 400)
  }

  // Fetch existing observation
  const existing = await db.execute({
    sql: 'SELECT annotation_data, ai_annotations FROM observations WHERE id = ?',
    args: [observationId],
  })

  if (existing.rows.length === 0) {
    return c.json({ error: 'Observation not found' }, 404)
  }

  // Build clinician review record
  const clinicianReview = {
    doctorId,
    reviewedAt: new Date().toISOString(),
    status: body.status,
    confirmedFindings: body.confirmedFindings || [],
    corrections: body.corrections || [],
    riskLevel: body.riskLevel || 'normal',
    notes: body.notes || null,
  }

  // Update annotation_data with doctor review info if it exists
  let annotationData = null
  const rawAnnotation = existing.rows[0].annotation_data as string | null
  if (rawAnnotation) {
    try {
      const parsed = JSON.parse(rawAnnotation)
      parsed.doctorReviewStatus = body.status
      parsed.doctorReviewedBy = doctorId
      parsed.doctorReviewedAt = clinicianReview.reviewedAt
      parsed.doctorCorrections = body.corrections || []
      parsed.doctorNotes = body.notes || undefined
      annotationData = JSON.stringify(parsed)
    } catch {
      annotationData = rawAnnotation // keep original if parse fails
    }
  }

  // Update the observation
  await db.execute({
    sql: `UPDATE observations
          SET clinician_review = ?,
              annotation_data = COALESCE(?, annotation_data),
              risk_level = ?
          WHERE id = ?`,
    args: [
      JSON.stringify(clinicianReview),
      annotationData,
      body.riskLevel === 'high' ? 3 : body.riskLevel === 'moderate' ? 2 : body.riskLevel === 'low' ? 1 : 0,
      observationId,
    ],
  })

  // Also create a training sample automatically
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO training_samples (id, campaign_code, observation_id, doctor_id, doctor_name, feedback, module_type)
            VALUES (?, (SELECT campaign_code FROM observations WHERE id = ?), ?, ?, ?, ?, (SELECT module_type FROM observations WHERE id = ?))`,
      args: [
        crypto.randomUUID(),
        observationId,
        observationId,
        doctorId,
        body.doctorName || 'Doctor',
        JSON.stringify(clinicianReview),
        observationId,
      ],
    })
  } catch {
    // Non-critical — training sample creation can fail without breaking review
  }

  // Phase 05 — if the observation is bound to a live workflow, send the
  // doctor-review event so the await-review step resolves. Failure is
  // non-fatal; workflow will time out after 72h and continue.
  try {
    const wfRow = await db.execute({
      sql: 'SELECT workflow_id FROM observations WHERE id = ?',
      args: [observationId],
    })
    const workflowId = wfRow.rows[0]?.workflow_id as string | null | undefined
    if (workflowId && c.env.SCREENING_WF) {
      const instance = await c.env.SCREENING_WF.get(workflowId)
      // sendEvent is on the runtime but not yet typed in workers-types@4.2025
      const maybeInstance = instance as unknown as {
        sendEvent?: (opts: { type: string; payload: unknown }) => Promise<void>
      }
      if (typeof maybeInstance.sendEvent === 'function') {
        await maybeInstance.sendEvent({
          type: 'doctor-review',
          payload: {
            observationId,
            status: body.status,
            riskLevel: body.riskLevel ?? 'normal',
          },
        })
      }
    }
  } catch (err) {
    console.warn('[observations.patch] workflow sendEvent failed', err)
  }

  return c.json({
    message: `Review ${body.status} for observation ${observationId}`,
    clinicianReview,
  })
})

// ── Phase 06 — Sandbox second-opinion manual trigger ──

/**
 * POST /api/observations/:id/second-opinion
 *
 * Admin/doctor-initiated re-analysis. Queues a sandbox-second-opinion job
 * and returns immediately. The consumer honours session_ai_budget and is
 * idempotent on (observation_id, model_version), so repeated clicks are
 * safe. Returns 404 if the observation does not exist, 403 if the role is
 * not doctor/admin/ops_manager, 503 if the queue binding is not wired.
 */
observationRoutes.post('/:id/second-opinion', async (c) => {
  const role = c.get('userRole')
  if (role !== 'doctor' && role !== 'admin' && role !== 'ops_manager') {
    return c.json({ error: 'Doctor, admin, or ops_manager role required' }, 403)
  }
  const observationId = c.req.param('id')
  const db = c.get('db')
  const obs = await db.execute({
    sql: 'SELECT id, session_id, module_type FROM observations WHERE id = ? LIMIT 1',
    args: [observationId],
  })
  if (obs.rows.length === 0) return c.json({ error: 'Observation not found' }, 404)

  const q = c.env.SANDBOX_2ND_OPINION_Q
  if (!q) {
    return c.json({ error: 'sandbox-second-opinion queue binding not configured' }, 503)
  }
  const body = await c.req.json().catch(() => ({}))
  await q.send({
    kind: 'sandbox-second-opinion',
    observationId,
    moduleType: (obs.rows[0].module_type as string) ?? 'vision',
    confidence: typeof body.confidence === 'number' ? body.confidence : 0.5,
    riskLevel: typeof body.riskLevel === 'number' ? body.riskLevel : 0,
    requestedBy: c.get('userId'),
  })
  return c.json({ observationId, queued: true, message: 'Second-opinion request queued' }, 202)
})

// ── AI Accuracy Metrics ──

/**
 * Get accuracy metrics for a module type across a campaign.
 * Requires doctor-reviewed observations to compute.
 */
observationRoutes.get('/accuracy/:moduleType', async (c) => {
  const db = c.get('db')
  const moduleType = c.req.param('moduleType')
  const campaignCode = c.req.query('campaign')

  let sql = `SELECT o.annotation_data, o.clinician_review, o.module_type
             FROM observations o
             WHERE o.module_type = ?
               AND o.clinician_review IS NOT NULL`
  const args: InValue[] = [moduleType]

  if (campaignCode) {
    sql += ' AND o.campaign_code = ?'
    args.push(campaignCode)
  }

  const result = await db.execute({ sql, args })

  // Build reviewed observation data for accuracy computation
  const reviewed: Array<{
    aiFindings: string[]
    doctorFindings: string[]
    aiRisk: string
    doctorRisk: string
    aiConfidence: number
    nurseAgreed: boolean
    doctorStatus: string
  }> = []

  for (const row of result.rows) {
    try {
      const annotation = row.annotation_data ? JSON.parse(row.annotation_data as string) : null
      const review = row.clinician_review ? JSON.parse(row.clinician_review as string) : null

      if (!review) continue

      reviewed.push({
        aiFindings: annotation?.finalFindings?.map((f: { chipId: string }) => f.chipId) || [],
        doctorFindings: review.confirmedFindings || [],
        aiRisk: annotation?.finalRisk || 'normal',
        doctorRisk: review.riskLevel || 'normal',
        aiConfidence: annotation?.finalConfidence || 0,
        nurseAgreed: annotation?.nurseAgreed ?? true,
        doctorStatus: review.status || 'confirmed',
      })
    } catch {
      continue
    }
  }

  // Compute basic metrics inline (full computation uses shared accuracy-metrics.ts)
  const total = reviewed.length
  if (total === 0) {
    return c.json({
      moduleType,
      sampleCount: 0,
      message: 'No doctor-reviewed observations for this module',
    })
  }

  let tp = 0, fp = 0, fn = 0, tn = 0
  let doctorAgreed = 0

  for (const obs of reviewed) {
    const aiPositive = obs.aiFindings.length > 0
    const doctorPositive = obs.doctorFindings.length > 0
    if (aiPositive && doctorPositive) tp++
    else if (aiPositive && !doctorPositive) fp++
    else if (!aiPositive && doctorPositive) fn++
    else tn++
    if (obs.doctorStatus === 'confirmed') doctorAgreed++
  }

  const sensitivity = (tp + fn) > 0 ? Math.round((tp / (tp + fn)) * 1000) / 1000 : 0
  const specificity = (tn + fp) > 0 ? Math.round((tn / (tn + fp)) * 1000) / 1000 : 0
  const ppv = (tp + fp) > 0 ? Math.round((tp / (tp + fp)) * 1000) / 1000 : 0
  const npv = (tn + fn) > 0 ? Math.round((tn / (tn + fn)) * 1000) / 1000 : 0

  return c.json({
    moduleType,
    sampleCount: total,
    sensitivity,
    specificity,
    ppv,
    npv,
    accuracy: total > 0 ? Math.round(((tp + tn) / total) * 1000) / 1000 : 0,
    doctorAgreementRate: Math.round((doctorAgreed / total) * 1000) / 1000,
    doctorOverrideRate: Math.round(((total - doctorAgreed) / total) * 1000) / 1000,
    confusion: { tp, fp, fn, tn },
  })
})

/**
 * Phase 1 feature flag stub — checks c.env for an override.
 * Phase 2 will replace this with an ai_config.features_json read.
 */
function isFeatureEnabled(c: { env: Record<string, unknown> }, flag: string): boolean {
  const envKey = `FEATURE_${flag.toUpperCase()}`
  const v = c.env[envKey]
  if (v === 'false' || v === '0') return false
  return true
}
