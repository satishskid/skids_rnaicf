// Training data routes — doctor feedback for AI model training
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import type { InValue } from '@libsql/client'

export const trainingRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Upload training sample (doctor feedback on observation)
trainingRoutes.post('/campaigns/:code/training', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.param('code')
  const body = await c.req.json()
  const id = body.id || crypto.randomUUID()

  if (!body.observationId || !body.feedback) {
    return c.json({ error: 'observationId and feedback are required' }, 400)
  }

  await db.execute({
    sql: `INSERT INTO training_samples (id, campaign_code, observation_id, doctor_id, doctor_name, feedback, module_type)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      campaignCode,
      body.observationId,
      body.doctorId || c.get('userId') || 'doctor',
      body.doctorName || 'Doctor',
      typeof body.feedback === 'string' ? body.feedback : JSON.stringify(body.feedback),
      body.moduleType || 'unknown',
    ],
  })

  return c.json({ id, message: 'Training sample saved' }, 201)
})

// Get training samples for a campaign
trainingRoutes.get('/campaigns/:code/training', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.param('code')

  const result = await db.execute({
    sql: 'SELECT * FROM training_samples WHERE campaign_code = ? ORDER BY created_at DESC',
    args: [campaignCode],
  })

  const samples = result.rows.map(row => ({
    id: row.id,
    campaignCode: row.campaign_code,
    observationId: row.observation_id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    feedback: typeof row.feedback === 'string' ? JSON.parse(row.feedback as string) : row.feedback,
    moduleType: row.module_type,
    createdAt: row.created_at,
  }))

  return c.json({ samples })
})

// Cross-campaign training export (JSONL or CSV)
trainingRoutes.get('/training/export', async (c) => {
  const db = c.get('db')
  const format = c.req.query('format') || 'jsonl'
  const campaignCodes = c.req.query('campaigns')?.split(',')
  const moduleType = c.req.query('module')
  const stripPhi = c.req.query('strip_phi') !== 'false' // default true

  // PHI export requires admin role
  if (!stripPhi) {
    const userRole = c.get('userRole')
    if (userRole !== 'admin') {
      return c.json({ error: 'Only admin can export with PHI (strip_phi=false)' }, 403)
    }
  }

  let sql = `SELECT ts.*, o.module_type as obs_module, o.ai_annotations, o.annotation_data,
                    o.clinician_review, o.media_url, o.media_urls, o.risk_level
             FROM training_samples ts
             JOIN observations o ON ts.observation_id = o.id
             WHERE 1=1`
  const args: InValue[] = []

  if (campaignCodes && campaignCodes.length > 0) {
    sql += ` AND ts.campaign_code IN (${campaignCodes.map(() => '?').join(',')})`
    args.push(...campaignCodes)
  }

  if (moduleType) {
    sql += ' AND o.module_type = ?'
    args.push(moduleType)
  }

  sql += ' ORDER BY ts.created_at DESC'

  const result = await db.execute({ sql, args })

  // JSONL format (default) — full structured training data
  const lines = result.rows.map(row => {
    const aiAnnotations = row.ai_annotations ? JSON.parse(row.ai_annotations as string) : []
    const annotationData = row.annotation_data ? JSON.parse(row.annotation_data as string) : null
    const clinicianReview = row.clinician_review ? JSON.parse(row.clinician_review as string) : null
    const feedback = typeof row.feedback === 'string' ? safeJsonParse(row.feedback as string) : row.feedback

    const record: Record<string, unknown> = {
      id: row.id,
      observationId: row.observation_id,
      moduleType: row.obs_module,
      // AI analysis data
      aiAnnotations,
      annotationData: stripPhi ? stripPhiFromAnnotation(annotationData) : annotationData,
      // Doctor feedback
      doctorFeedback: feedback,
      clinicianReview: clinicianReview ? {
        status: clinicianReview.status,
        confirmedFindings: clinicianReview.confirmedFindings,
        corrections: clinicianReview.corrections,
        riskLevel: clinicianReview.riskLevel,
      } : null,
      // Media references (for model training — images stored in R2)
      mediaUrl: row.media_url,
      mediaUrls: row.media_urls ? JSON.parse(row.media_urls as string) : [],
      riskLevel: row.risk_level,
      createdAt: row.created_at,
    }

    // Strip PHI if requested
    if (stripPhi) {
      record.campaignCode = 'REDACTED'
      record.doctorId = hashString(row.doctor_id as string || 'unknown')
      // Don't include child name/DOB — observation_id is anonymized reference
    } else {
      record.campaignCode = row.campaign_code
      record.doctorId = row.doctor_id
    }

    return JSON.stringify(record)
  })

  if (format === 'csv') {
    const header = 'id,observation_id,module_type,doctor_status,ai_risk,doctor_risk,confidence,correction_count,created_at'
    const rows = result.rows.map(row => {
      const annotationData = row.annotation_data ? safeJsonParse(row.annotation_data as string) : null
      const clinicianReview = row.clinician_review ? safeJsonParse(row.clinician_review as string) : null
      const corrections = Array.isArray(clinicianReview?.corrections) ? clinicianReview.corrections : []
      return `${row.id},${row.observation_id},${row.obs_module},${clinicianReview?.status || ''},${annotationData?.finalRisk || ''},${clinicianReview?.riskLevel || ''},${annotationData?.finalConfidence || ''},${corrections.length},${row.created_at}`
    })
    const csv = [header, ...rows].join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="training-export.csv"',
      },
    })
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'application/jsonl',
      'Content-Disposition': 'attachment; filename="training-export.jsonl"',
    },
  })
})

// ── Training Data Stats ──

/**
 * Get training data statistics — how many reviewed samples per module, correction rates.
 */
trainingRoutes.get('/training/stats', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')

  let sql = `SELECT o.module_type,
                    COUNT(*) as total,
                    SUM(CASE WHEN json_extract(o.clinician_review, '$.status') = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                    SUM(CASE WHEN json_extract(o.clinician_review, '$.status') = 'corrected' THEN 1 ELSE 0 END) as corrected
             FROM observations o
             WHERE o.clinician_review IS NOT NULL`
  const args: InValue[] = []

  if (campaignCode) {
    sql += ' AND o.campaign_code = ?'
    args.push(campaignCode)
  }

  sql += ' GROUP BY o.module_type ORDER BY total DESC'

  const result = await db.execute({ sql, args })

  const stats = result.rows.map(row => ({
    moduleType: row.module_type,
    totalReviewed: Number(row.total),
    confirmed: Number(row.confirmed),
    corrected: Number(row.corrected),
    agreementRate: Number(row.total) > 0
      ? Math.round((Number(row.confirmed) / Number(row.total)) * 1000) / 1000
      : 0,
  }))

  const totalReviewed = stats.reduce((sum, s) => sum + s.totalReviewed, 0)

  return c.json({
    stats,
    totalReviewed,
    moduleCount: stats.length,
  })
})

// ── Helpers ──

function safeJsonParse(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

/** Strip PHI from annotation data for training export. */
function stripPhiFromAnnotation(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return null
  const cleaned = { ...data }
  // Remove any nurse/doctor names that might be in audit trail
  delete cleaned.nurseNotes
  delete cleaned.doctorNotes
  delete cleaned.doctorReviewedBy
  return cleaned
}

/** Simple hash for anonymizing IDs in export. */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `anon_${Math.abs(hash).toString(36)}`
}
