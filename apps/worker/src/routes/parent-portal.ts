/**
 * Parent Portal Routes — QR code + DOB verification for parent report access.
 *
 * Flow:
 * 1. Child wears QR health card (printed during campaign enrollment)
 * 2. School broadcasts ONE parent portal URL: /parent
 * 3. Parent scans QR from card → code auto-filled, or enters manually
 * 4. POST /api/parent-portal/lookup → returns child first name (verification prompt)
 * 5. Parent enters DOB → POST /api/parent-portal/verify → full report if match
 *
 * Security: QR code (possession) + DOB (knowledge) + admin release gate (authorization)
 * All endpoints are PUBLIC — no auth required.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Runtime migration: add qr_code column and reports_released if missing
// Module-level flags avoid redundant ALTER TABLE calls within the same isolate lifetime
let columnsEnsured = false
async function ensureColumns(db: any) {
  if (columnsEnsured) return
  try {
    await db.execute({ sql: `ALTER TABLE children ADD COLUMN qr_code TEXT`, args: [] })
  } catch {
    // Column already exists
  }
  try {
    await db.execute({ sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_children_qr ON children(qr_code)`, args: [] })
  } catch {
    // Index already exists
  }
  try {
    await db.execute({ sql: `ALTER TABLE campaigns ADD COLUMN reports_released INTEGER DEFAULT 0`, args: [] })
  } catch {
    // Column already exists
  }
  columnsEnsured = true
}

// Rate limiting: track failed attempts per QR code
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 30

function checkRateLimit(code: string): { allowed: boolean; remainingAttempts?: number; lockedMinutes?: number } {
  const entry = failedAttempts.get(code)
  if (!entry) return { allowed: true, remainingAttempts: MAX_ATTEMPTS }

  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    const minutesLeft = Math.ceil((entry.lockedUntil - Date.now()) / 60000)
    return { allowed: false, lockedMinutes: minutesLeft }
  }

  // Reset if lockout expired
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    failedAttempts.delete(code)
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS }
  }

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - entry.count }
}

function recordFailedAttempt(code: string) {
  const entry = failedAttempts.get(code) || { count: 0, lockedUntil: 0 }
  entry.count++
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000
  }
  failedAttempts.set(code, entry)
}

function clearFailedAttempts(code: string) {
  failedAttempts.delete(code)
}

// POST /lookup — Look up child by QR code, return first name for verification
app.post('/lookup', async (c) => {
  const db = c.get('db')
  await ensureColumns(db)

  const body = await c.req.json<{ code: string }>()
  if (!body.code || body.code.length < 4) {
    return c.json({ error: 'Valid QR code is required' }, 400)
  }

  const code = body.code.trim().toUpperCase()

  // Rate limit check
  const rateCheck = checkRateLimit(code)
  if (!rateCheck.allowed) {
    return c.json({
      error: `Too many failed attempts. Please try again in ${rateCheck.lockedMinutes} minutes.`,
    }, 429)
  }

  try {
    // Find child by QR code
    const result = await db.execute({
      sql: `SELECT ch.id, ch.name, ch.campaign_code, cm.reports_released, cm.name as campaign_name
            FROM children ch
            LEFT JOIN campaigns cm ON cm.code = ch.campaign_code
            WHERE ch.qr_code = ?`,
      args: [code],
    })

    const child = result.rows?.[0] as any
    if (!child) {
      return c.json({ error: 'QR code not found. Please check and try again.' }, 404)
    }

    // Check if reports are released for this campaign
    if (!child.reports_released) {
      return c.json({
        status: 'not_released',
        message: 'Health screening reports for this campaign are not yet available. Please check back later.',
      })
    }

    // Return first name only — parent must verify DOB to see full report
    const firstName = child.name.split(' ')[0]
    return c.json({
      status: 'verification_required',
      childFirstName: firstName,
      campaignCode: child.campaign_code,
    })
  } catch {
    return c.json({ error: 'Unable to look up QR code' }, 500)
  }
})

// POST /verify — Verify DOB and return full report data
app.post('/verify', async (c) => {
  const db = c.get('db')
  await ensureColumns(db)

  const body = await c.req.json<{ code: string; dob: string }>()
  if (!body.code || !body.dob) {
    return c.json({ error: 'QR code and date of birth are required' }, 400)
  }

  const code = body.code.trim().toUpperCase()

  // Rate limit check
  const rateCheck = checkRateLimit(code)
  if (!rateCheck.allowed) {
    return c.json({
      error: `Too many failed attempts. Please try again in ${rateCheck.lockedMinutes} minutes.`,
    }, 429)
  }

  try {
    // Find child by QR code with campaign check
    const result = await db.execute({
      sql: `SELECT ch.*, cm.reports_released, cm.name as campaign_name
            FROM children ch
            LEFT JOIN campaigns cm ON cm.code = ch.campaign_code
            WHERE ch.qr_code = ?`,
      args: [code],
    })

    const child = result.rows?.[0] as any
    if (!child) {
      recordFailedAttempt(code)
      return c.json({ error: 'QR code not found' }, 404)
    }

    if (!child.reports_released) {
      return c.json({
        status: 'not_released',
        message: 'Reports are not yet available for this campaign.',
      })
    }

    // Verify DOB
    const normalizeDate = (d: string) => {
      try { return new Date(d).toISOString().split('T')[0] } catch { return d }
    }
    const childDob = normalizeDate(child.dob)
    const providedDob = normalizeDate(body.dob)

    if (childDob !== providedDob) {
      recordFailedAttempt(code)
      const remaining = MAX_ATTEMPTS - (failedAttempts.get(code)?.count || 0)
      return c.json({
        error: 'Date of birth does not match our records.',
        remainingAttempts: Math.max(0, remaining),
      }, 403)
    }

    // DOB verified! Clear rate limit and return full report
    clearFailedAttempts(code)

    // Fetch observations
    const obsRes = await db.execute({
      sql: 'SELECT * FROM observations WHERE child_id = ? AND campaign_code = ?',
      args: [child.id, child.campaign_code],
    })

    const observations = (obsRes.rows ?? []).map((r: any) => ({
      id: r.id,
      childId: r.child_id,
      moduleType: r.module_type,
      campaignCode: r.campaign_code,
      annotationData: r.annotation_data ? JSON.parse(r.annotation_data) : undefined,
      aiAnnotations: r.ai_annotations ? JSON.parse(r.ai_annotations) : undefined,
      mediaUrl: r.media_url,
      createdAt: r.created_at,
    }))

    // Fetch reviews
    const reviewRes = await db.execute({
      sql: `SELECT r.* FROM reviews r
            INNER JOIN observations o ON o.id = r.observation_id
            WHERE o.child_id = ? AND o.campaign_code = ?`,
      args: [child.id, child.campaign_code],
    })

    const reviews = (reviewRes.rows ?? []).map((r: any) => ({
      id: r.id,
      observationId: r.observation_id,
      clinicianId: r.clinician_id,
      clinicianName: r.clinician_name,
      decision: r.decision,
      notes: r.notes,
      reviewedAt: r.reviewed_at,
    }))

    return c.json({
      status: 'verified',
      child: {
        id: child.id,
        name: child.name,
        dob: child.dob,
        gender: child.gender,
        class: child.class,
        section: child.section,
        schoolName: child.school_name,
      },
      observations,
      reviews,
      campaignCode: child.campaign_code,
      campaignName: child.campaign_name,
    })
  } catch {
    return c.json({ error: 'Verification failed' }, 500)
  }
})

// POST /generate-qr — Generate QR codes for children that don't have them (admin migration)
app.post('/generate-qr', async (c) => {
  const db = c.get('db')
  await ensureColumns(db)

  const body = await c.req.json<{ campaignCode: string }>()
  if (!body.campaignCode) {
    return c.json({ error: 'campaignCode required' }, 400)
  }

  // Find children without QR codes
  const result = await db.execute({
    sql: 'SELECT id, name FROM children WHERE campaign_code = ? AND (qr_code IS NULL OR qr_code = "")',
    args: [body.campaignCode],
  })

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let generated = 0

  for (const row of result.rows) {
    const child = row as any
    let qrCode = ''
    let retries = 0
    while (retries < 5) {
      qrCode = ''
      const randomBytes = crypto.getRandomValues(new Uint8Array(8))
      for (let i = 0; i < 8; i++) {
        qrCode += chars[randomBytes[i] % chars.length]
      }
      try {
        await db.execute({
          sql: 'UPDATE children SET qr_code = ? WHERE id = ?',
          args: [qrCode, child.id],
        })
        generated++
        break
      } catch {
        retries++
      }
    }
  }

  return c.json({
    generated,
    total: result.rows.length,
    message: `Generated QR codes for ${generated} children`,
  })
})

// ═══════════════════════════════════════════════════════════════════
// UNIFIED API — Firebase-authenticated parent endpoints
// These routes require Firebase ID token (set by firebaseAuthMiddleware in index.ts)
// ═══════════════════════════════════════════════════════════════════

// Ensure parent_claims table exists (runtime migration)
let claimsTableEnsured = false
async function ensureParentClaimsTable(db: any) {
  if (claimsTableEnsured) return
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS parent_claims (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        child_id TEXT NOT NULL REFERENCES children(id),
        firebase_uid TEXT NOT NULL,
        parent_phone TEXT,
        parent_name TEXT,
        parent_email TEXT,
        verified_at TEXT DEFAULT (datetime('now')),
        UNIQUE(child_id, firebase_uid)
      )`,
      args: [],
    })
    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_parent_claims_firebase ON parent_claims(firebase_uid)`,
      args: [],
    })
    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_parent_claims_child ON parent_claims(child_id)`,
      args: [],
    })
  } catch {
    // Already exists
  }
  claimsTableEnsured = true
}

/**
 * POST /claim-child — Parent claims a V3 screening child via QR + DOB
 *
 * Input: { qrCode, dob }
 * Auth: Firebase ID token (firebaseUid set by middleware)
 * Action: Verifies QR+DOB, creates parent_claims record linking V3 child_id ↔ firebase_uid
 * Output: { childId, name, dob, gender, campaignCode, schoolName }
 */
app.post('/claim-child', async (c) => {
  const db = c.get('db')
  await ensureColumns(db)
  await ensureParentClaimsTable(db)

  const firebaseUid = c.get('firebaseUid' as any) as string
  if (!firebaseUid) {
    return c.json({ error: 'Firebase auth required' }, 401)
  }

  const body = await c.req.json<{
    qrCode: string
    dob: string
    parentName?: string
    parentPhone?: string
    parentEmail?: string
  }>()

  if (!body.qrCode || !body.dob) {
    return c.json({ error: 'qrCode and dob are required' }, 400)
  }

  const code = body.qrCode.trim().toUpperCase()

  // Rate limit check
  const rateCheck = checkRateLimit(code)
  if (!rateCheck.allowed) {
    return c.json({
      error: `Too many failed attempts. Please try again in ${rateCheck.lockedMinutes} minutes.`,
    }, 429)
  }

  try {
    // Find child by QR code
    const result = await db.execute({
      sql: `SELECT ch.*, cm.reports_released, cm.name as campaign_name
            FROM children ch
            LEFT JOIN campaigns cm ON cm.code = ch.campaign_code
            WHERE ch.qr_code = ?`,
      args: [code],
    })

    const child = result.rows?.[0] as any
    if (!child) {
      recordFailedAttempt(code)
      return c.json({ error: 'QR code not found' }, 404)
    }

    // Verify DOB
    const normalizeDate = (d: string) => {
      try { return new Date(d).toISOString().split('T')[0] } catch { return d }
    }
    if (normalizeDate(child.dob) !== normalizeDate(body.dob)) {
      recordFailedAttempt(code)
      const remaining = MAX_ATTEMPTS - (failedAttempts.get(code)?.count || 0)
      return c.json({
        error: 'Date of birth does not match our records.',
        remainingAttempts: Math.max(0, remaining),
      }, 403)
    }

    clearFailedAttempts(code)

    // Check if already claimed by this parent
    const existing = await db.execute({
      sql: 'SELECT id FROM parent_claims WHERE child_id = ? AND firebase_uid = ?',
      args: [child.id, firebaseUid],
    })

    if (existing.rows?.length > 0) {
      // Already claimed — just return success
      return c.json({
        status: 'already_claimed',
        childId: child.id,
        name: child.name,
        dob: child.dob,
        gender: child.gender,
        campaignCode: child.campaign_code,
        schoolName: child.school_name,
      })
    }

    // Limit: max 10 children per Firebase user (prevents abuse)
    const countRes = await db.execute({
      sql: 'SELECT COUNT(*) as cnt FROM parent_claims WHERE firebase_uid = ?',
      args: [firebaseUid],
    })
    const claimCount = (countRes.rows?.[0] as any)?.cnt || 0
    if (claimCount >= 10) {
      return c.json({ error: 'Maximum number of linked children reached (10)' }, 429)
    }

    // Create parent claim
    const claimId = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    await db.execute({
      sql: `INSERT INTO parent_claims (id, child_id, firebase_uid, parent_phone, parent_name, parent_email)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        claimId,
        child.id,
        firebaseUid,
        body.parentPhone || null,
        body.parentName || null,
        body.parentEmail || null,
      ],
    })

    return c.json({
      status: 'claimed',
      childId: child.id,
      name: child.name,
      dob: child.dob,
      gender: child.gender,
      campaignCode: child.campaign_code,
      schoolName: child.school_name,
      class: child.class,
      section: child.section,
    })
  } catch (err) {
    console.error('claim-child error:', err)
    return c.json({ error: 'Failed to claim child' }, 500)
  }
})

/**
 * GET /my-children — List all V3 children claimed by this parent
 *
 * Auth: Firebase ID token
 * Output: { children: [{ id, name, dob, gender, schoolName, campaignCode, class, section }] }
 */
app.get('/my-children', async (c) => {
  const db = c.get('db')
  await ensureParentClaimsTable(db)

  const firebaseUid = c.get('firebaseUid' as any) as string
  if (!firebaseUid) {
    return c.json({ error: 'Firebase auth required' }, 401)
  }

  try {
    const result = await db.execute({
      sql: `SELECT ch.id, ch.name, ch.dob, ch.gender, ch.school_name, ch.campaign_code,
                   ch.class, ch.section, ch.qr_code,
                   cm.name as campaign_name, cm.reports_released,
                   pc.verified_at as claimed_at
            FROM parent_claims pc
            INNER JOIN children ch ON ch.id = pc.child_id
            LEFT JOIN campaigns cm ON cm.code = ch.campaign_code
            WHERE pc.firebase_uid = ?
            ORDER BY pc.verified_at DESC`,
      args: [firebaseUid],
    })

    const children = (result.rows ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      dob: r.dob,
      gender: r.gender,
      schoolName: r.school_name,
      campaignCode: r.campaign_code,
      campaignName: r.campaign_name,
      class: r.class,
      section: r.section,
      qrCode: r.qr_code,
      reportsReleased: !!r.reports_released,
      claimedAt: r.claimed_at,
    }))

    return c.json({ children })
  } catch (err) {
    console.error('my-children error:', err)
    return c.json({ error: 'Failed to fetch children' }, 500)
  }
})

/**
 * GET /child/:id/screening — Get all screening data for a claimed child
 *
 * Auth: Firebase ID token (must have claimed this child)
 * Output: { screenings: [{ campaignCode, campaignName, observations, reviews }] }
 */
app.get('/child/:id/screening', async (c) => {
  const db = c.get('db')
  await ensureParentClaimsTable(db)

  const firebaseUid = c.get('firebaseUid' as any) as string
  if (!firebaseUid) {
    return c.json({ error: 'Firebase auth required' }, 401)
  }

  const childId = c.req.param('id')

  try {
    // Verify parent has claimed this child
    const claim = await db.execute({
      sql: 'SELECT id FROM parent_claims WHERE child_id = ? AND firebase_uid = ?',
      args: [childId, firebaseUid],
    })

    if (!claim.rows?.length) {
      return c.json({ error: 'You have not claimed this child. Scan the QR code first.' }, 403)
    }

    // Get child info
    const childRes = await db.execute({
      sql: 'SELECT * FROM children WHERE id = ?',
      args: [childId],
    })
    const child = childRes.rows?.[0] as any
    if (!child) {
      return c.json({ error: 'Child not found' }, 404)
    }

    // Get observations ONLY from released campaigns (filter at SQL level for security)
    const obsRes = await db.execute({
      sql: `SELECT o.*, cm.name as campaign_name, cm.reports_released
            FROM observations o
            INNER JOIN campaigns cm ON cm.code = o.campaign_code
            WHERE o.child_id = ? AND cm.reports_released = 1
            ORDER BY o.created_at DESC`,
      args: [childId],
    })

    // Get reviews only for released-campaign observations
    const reviewRes = await db.execute({
      sql: `SELECT r.* FROM reviews r
            INNER JOIN observations o ON o.id = r.observation_id
            INNER JOIN campaigns cm ON cm.code = o.campaign_code
            WHERE o.child_id = ? AND cm.reports_released = 1`,
      args: [childId],
    })

    // Group by campaign
    const campaignMap = new Map<string, {
      campaignCode: string
      campaignName: string
      reportsReleased: boolean
      observations: any[]
      reviews: any[]
    }>()

    for (const row of (obsRes.rows ?? [])) {
      const r = row as any
      if (!campaignMap.has(r.campaign_code)) {
        campaignMap.set(r.campaign_code, {
          campaignCode: r.campaign_code,
          campaignName: r.campaign_name || r.campaign_code,
          reportsReleased: !!r.reports_released,
          observations: [],
          reviews: [],
        })
      }

      const campaign = campaignMap.get(r.campaign_code)!
      campaign.observations.push({
        id: r.id,
        moduleType: r.module_type,
        bodyRegion: r.body_region,
        annotationData: r.annotation_data ? JSON.parse(r.annotation_data) : undefined,
        aiAnnotations: r.ai_annotations ? JSON.parse(r.ai_annotations) : undefined,
        mediaUrl: r.media_url,
        riskLevel: r.risk_level,
        timestamp: r.timestamp,
        createdAt: r.created_at,
      })
    }

    // Attach reviews to their campaigns
    for (const row of (reviewRes.rows ?? [])) {
      const r = row as any
      // Find which campaign this review belongs to
      for (const [, campaign] of campaignMap) {
        const obsMatch = campaign.observations.find((o: any) => o.id === r.observation_id)
        if (obsMatch) {
          campaign.reviews.push({
            id: r.id,
            observationId: r.observation_id,
            clinicianId: r.clinician_id,
            clinicianName: r.clinician_name,
            decision: r.decision,
            notes: r.notes,
            reviewedAt: r.reviewed_at,
          })
          break
        }
      }
    }

    // Already filtered at SQL level — all campaigns here have reports_released = 1
    const screenings = Array.from(campaignMap.values())

    return c.json({
      child: {
        id: child.id,
        name: child.name,
        dob: child.dob,
        gender: child.gender,
        class: child.class,
        section: child.section,
        schoolName: child.school_name,
      },
      screenings,
    })
  } catch (err) {
    console.error('child screening error:', err)
    return c.json({ error: 'Failed to fetch screening data' }, 500)
  }
})

/**
 * GET /child/:id/report — Full computed report for a claimed child
 *
 * Auth: Firebase ID token (must have claimed this child)
 * Output: { child, observations, reviews, campaignCode, campaignName }
 * (4D report computation happens client-side using @skids/shared)
 */
app.get('/child/:id/report', async (c) => {
  const db = c.get('db')
  await ensureParentClaimsTable(db)

  const firebaseUid = c.get('firebaseUid' as any) as string
  if (!firebaseUid) {
    return c.json({ error: 'Firebase auth required' }, 401)
  }

  const childId = c.req.param('id')
  const campaignCode = c.req.query('campaign') // Optional: specific campaign

  try {
    // Verify parent has claimed this child
    const claim = await db.execute({
      sql: 'SELECT id FROM parent_claims WHERE child_id = ? AND firebase_uid = ?',
      args: [childId, firebaseUid],
    })

    if (!claim.rows?.length) {
      return c.json({ error: 'You have not claimed this child.' }, 403)
    }

    // Get child
    const childRes = await db.execute({
      sql: `SELECT ch.*, cm.name as campaign_name, cm.reports_released
            FROM children ch
            LEFT JOIN campaigns cm ON cm.code = ch.campaign_code
            WHERE ch.id = ?`,
      args: [childId],
    })
    const child = childRes.rows?.[0] as any
    if (!child) {
      return c.json({ error: 'Child not found' }, 404)
    }

    // Check reports released
    if (!child.reports_released) {
      return c.json({
        status: 'not_released',
        message: 'Reports are not yet available for this campaign.',
      })
    }

    const targetCampaign = campaignCode || child.campaign_code

    // Fetch observations
    const obsRes = await db.execute({
      sql: 'SELECT * FROM observations WHERE child_id = ? AND campaign_code = ?',
      args: [childId, targetCampaign],
    })

    const observations = (obsRes.rows ?? []).map((r: any) => ({
      id: r.id,
      childId: r.child_id,
      moduleType: r.module_type,
      bodyRegion: r.body_region,
      campaignCode: r.campaign_code,
      annotationData: r.annotation_data ? JSON.parse(r.annotation_data) : undefined,
      aiAnnotations: r.ai_annotations ? JSON.parse(r.ai_annotations) : undefined,
      mediaUrl: r.media_url,
      mediaUrls: r.media_urls ? JSON.parse(r.media_urls) : undefined,
      riskLevel: r.risk_level,
      timestamp: r.timestamp,
      createdAt: r.created_at,
    }))

    // Fetch reviews
    const reviewRes = await db.execute({
      sql: `SELECT r.* FROM reviews r
            INNER JOIN observations o ON o.id = r.observation_id
            WHERE o.child_id = ? AND o.campaign_code = ?`,
      args: [childId, targetCampaign],
    })

    const reviews = (reviewRes.rows ?? []).map((r: any) => ({
      id: r.id,
      observationId: r.observation_id,
      clinicianId: r.clinician_id,
      clinicianName: r.clinician_name,
      decision: r.decision,
      notes: r.notes,
      qualityRating: r.quality_rating,
      reviewedAt: r.reviewed_at,
    }))

    return c.json({
      status: 'verified',
      child: {
        id: child.id,
        name: child.name,
        dob: child.dob,
        gender: child.gender,
        class: child.class,
        section: child.section,
        schoolName: child.school_name,
        campaignCode: child.campaign_code,
      },
      observations,
      reviews,
      campaignCode: targetCampaign,
      campaignName: child.campaign_name,
    })
  } catch (err) {
    console.error('child report error:', err)
    return c.json({ error: 'Failed to fetch report' }, 500)
  }
})

export const parentPortalRoutes = app
