// Campaign CRUD routes
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { generateCampaignCode } from '@skids/shared'

export const campaignRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// List campaigns — authority users see only assigned campaigns, others see all
campaignRoutes.get('/', async (c) => {
  const db = c.get('db')
  const userRole = c.get('userRole')
  const userId = c.get('userId')

  let result

  if (userRole === 'authority') {
    // Authority users only see campaigns assigned to them
    try {
      result = await db.execute({
        sql: `SELECT c.code, c.name, c.school_name, c.campaign_type, c.status,
                     c.total_children, c.enabled_modules, c.created_at, c.city, c.state, c.reports_released
              FROM campaigns c
              INNER JOIN campaign_assignments ca ON ca.campaign_code = c.code
              WHERE ca.user_id = ?
              ORDER BY c.created_at DESC`,
        args: [userId],
      })
    } catch {
      // campaign_assignments table might not exist yet — return empty
      result = { rows: [] }
    }
  } else {
    // admin, ops_manager, doctor, nurse — see all campaigns
    result = await db.execute(
      'SELECT code, name, school_name, campaign_type, status, total_children, enabled_modules, created_at, city, state, reports_released FROM campaigns ORDER BY created_at DESC'
    )
  }

  const campaigns = result.rows.map((row: any) => ({
    code: row.code,
    name: row.name,
    schoolName: row.school_name,
    campaignType: row.campaign_type,
    status: row.status,
    totalChildren: row.total_children,
    enabledModules: JSON.parse((row.enabled_modules as string) || '[]'),
    createdAt: row.created_at,
    city: row.city,
    state: row.state,
    reportsReleased: !!row.reports_released,
  }))
  return c.json({ campaigns })
})

// Get campaign by code
campaignRoutes.get('/:code', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')
  const result = await db.execute({
    sql: 'SELECT * FROM campaigns WHERE code = ?',
    args: [code],
  })
  if (result.rows.length === 0) {
    return c.json({ error: 'Campaign not found' }, 404)
  }
  const row = result.rows[0]
  return c.json({
    code: row.code,
    name: row.name,
    schoolName: row.school_name,
    academicYear: row.academic_year,
    campaignType: row.campaign_type,
    status: row.status,
    enabledModules: JSON.parse((row.enabled_modules as string) || '[]'),
    customModules: JSON.parse((row.custom_modules as string) || '[]'),
    totalChildren: row.total_children,
    createdBy: row.created_by,
    createdAt: row.created_at,
    city: row.city,
    state: row.state,
    district: row.district,
    address: row.address,
    pincode: row.pincode,
    reportsReleased: !!row.reports_released,
  })
})

// Create campaign
campaignRoutes.post('/', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const code = body.code || generateCampaignCode()

  await db.execute({
    sql: `INSERT INTO campaigns (code, name, org_code, school_name, academic_year, campaign_type, status, enabled_modules, custom_modules, total_children, created_by, city, state, district, address, pincode)
          VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      code,
      body.name,
      body.orgCode || null,
      body.schoolName || null,
      body.academicYear || null,
      body.campaignType || 'school_health_4d',
      JSON.stringify(body.enabledModules || []),
      JSON.stringify(body.customModules || []),
      body.totalChildren || 0,
      body.createdBy || 'system',
      body.city || null,
      body.state || null,
      body.district || null,
      body.address || null,
      body.pincode || null,
    ],
  })

  return c.json({ code, message: 'Campaign created' }, 201)
})

// Update campaign status
campaignRoutes.patch('/:code/status', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')
  const { status } = await c.req.json()

  await db.execute({
    sql: 'UPDATE campaigns SET status = ?, completed_at = CASE WHEN ? = \'completed\' THEN datetime(\'now\') ELSE completed_at END WHERE code = ?',
    args: [status, status, code],
  })

  return c.json({ code, status, message: 'Status updated' })
})

// Campaign progress + child lifecycle stats
campaignRoutes.get('/:code/status', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')

  // Get campaign
  const campaignResult = await db.execute({
    sql: 'SELECT code, name, total_children, enabled_modules, status FROM campaigns WHERE code = ?',
    args: [code],
  })
  if (campaignResult.rows.length === 0) {
    return c.json({ error: 'Campaign not found' }, 404)
  }
  const campaign = campaignResult.rows[0]
  const enabledModules = JSON.parse((campaign.enabled_modules as string) || '[]') as string[]

  // Count children
  const childCount = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM children WHERE campaign_code = ?',
    args: [code],
  })

  // Count observations by module
  const obsByModule = await db.execute({
    sql: 'SELECT module_type, COUNT(*) as count FROM observations WHERE campaign_code = ? GROUP BY module_type',
    args: [code],
  })

  // Count unique screened children
  const screenedChildren = await db.execute({
    sql: 'SELECT COUNT(DISTINCT child_id) as count FROM observations WHERE campaign_code = ?',
    args: [code],
  })

  // Review stats
  const reviewStats = await db.execute({
    sql: 'SELECT decision, COUNT(*) as count FROM reviews WHERE campaign_code = ? GROUP BY decision',
    args: [code],
  })

  // Device sync info
  const devices = await db.execute({
    sql: `SELECT device_id, screened_by as nurse_name,
          MAX(synced_at) as last_sync_at, COUNT(*) as observation_count
          FROM observations WHERE campaign_code = ? AND device_id IS NOT NULL
          GROUP BY device_id`,
    args: [code],
  })

  const totalChildren = (childCount.rows[0]?.count as number) || 0
  const totalScreened = (screenedChildren.rows[0]?.count as number) || 0
  const totalObservations = obsByModule.rows.reduce((sum, r) => sum + (r.count as number), 0)

  const moduleProgress: Record<string, number> = {}
  for (const row of obsByModule.rows) {
    moduleProgress[row.module_type as string] = row.count as number
  }

  const reviewDecisions: Record<string, number> = {}
  for (const row of reviewStats.rows) {
    reviewDecisions[row.decision as string] = row.count as number
  }

  return c.json({
    campaignCode: code,
    campaignName: campaign.name,
    campaignStatus: campaign.status,
    totalChildren,
    totalScreened,
    totalObservations,
    enabledModules,
    moduleProgress,
    reviewDecisions,
    completionPercent: totalChildren > 0 ? Math.round((totalScreened / totalChildren) * 100) : 0,
    syncedDevices: devices.rows.map(d => ({
      deviceId: d.device_id,
      nurseName: d.nurse_name,
      lastSyncAt: d.last_sync_at,
      observationCount: d.observation_count,
    })),
  })
})

// Batch add children (dedup by admission_number + campaign, max 500)
campaignRoutes.post('/:code/children', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')
  const { children } = await c.req.json()

  if (!Array.isArray(children) || children.length === 0) {
    return c.json({ error: 'children array required' }, 400)
  }
  if (children.length > 500) {
    return c.json({ error: 'Maximum 500 children per batch' }, 400)
  }

  let added = 0
  let skipped = 0
  const errors: string[] = []

  for (const child of children) {
    try {
      // Dedup check by name (case-insensitive) + campaign
      const existing = await db.execute({
        sql: 'SELECT id FROM children WHERE campaign_code = ? AND LOWER(name) = LOWER(?)',
        args: [code, child.name],
      })

      if (existing.rows.length > 0) {
        skipped++
        continue
      }

      const id = child.id || crypto.randomUUID()
      await db.execute({
        sql: `INSERT INTO children (id, name, dob, gender, location, admission_number, class, section, academic_year, school_name, campaign_code, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          child.name,
          child.dob || '2015-01-01',
          child.gender || null,
          child.location || null,
          child.admissionNumber || null,
          child.class || null,
          child.section || null,
          child.academicYear || null,
          child.schoolName || null,
          code,
          child.createdBy || c.get('userId') || 'import',
        ],
      })
      added++
    } catch (e) {
      errors.push(`${child.name}: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  // Update total_children count
  const countResult = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM children WHERE campaign_code = ?',
    args: [code],
  })
  await db.execute({
    sql: 'UPDATE campaigns SET total_children = ? WHERE code = ?',
    args: [countResult.rows[0]?.count || 0, code],
  })

  return c.json({
    added,
    skipped,
    total: children.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Added ${added}, skipped ${skipped} duplicates`,
  })
})

// Mark child absent / Get absences
campaignRoutes.post('/:code/absent', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')
  const body = await c.req.json()
  const id = crypto.randomUUID()

  if (!body.childId || !body.date) {
    return c.json({ error: 'childId and date are required' }, 400)
  }

  await db.execute({
    sql: 'INSERT INTO absences (id, child_id, campaign_code, date, reason, marked_by) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, body.childId, code, body.date, body.reason || null, body.markedBy || c.get('userId') || 'nurse'],
  })

  return c.json({ id, message: 'Absence recorded' }, 201)
})

campaignRoutes.get('/:code/absent', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')
  const childId = c.req.query('child')

  let sql = 'SELECT * FROM absences WHERE campaign_code = ?'
  const args: unknown[] = [code]

  if (childId) {
    sql += ' AND child_id = ?'
    args.push(childId)
  }

  sql += ' ORDER BY date DESC'
  const result = await db.execute({ sql, args })

  const absences = result.rows.map(row => ({
    id: row.id,
    childId: row.child_id,
    campaignCode: row.campaign_code,
    date: row.date,
    reason: row.reason,
    markedBy: row.marked_by,
    createdAt: row.created_at,
  }))

  return c.json({ absences })
})

// Toggle reports_released flag (admin/ops_manager)
campaignRoutes.post('/:code/release-reports', async (c) => {
  try {
    const db = c.get('db')
    const code = c.req.param('code')
    const userRole = c.get('userRole')

    if (userRole !== 'admin' && userRole !== 'ops_manager') {
      return c.json({ error: 'Admin or ops_manager access required' }, 403)
    }

    // Ensure column exists
    try {
      await db.execute({ sql: 'ALTER TABLE campaigns ADD COLUMN reports_released INTEGER DEFAULT 0', args: [] })
    } catch { /* already exists */ }

    const body = await c.req.json<{ released: boolean }>().catch(() => ({ released: true }))
    const released = body.released ? 1 : 0

    await db.execute({
      sql: 'UPDATE campaigns SET reports_released = ? WHERE code = ?',
      args: [released, code],
    })

    return c.json({
      code,
      reportsReleased: !!released,
      message: released ? 'Reports released — parents can now access via QR code' : 'Reports access revoked',
    })
  } catch (err) {
    return c.json({ error: 'Failed to release reports', detail: String(err) }, 500)
  }
})

// Archive campaign
campaignRoutes.post('/:code/archive', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')

  // Set status to archived
  await db.execute({
    sql: "UPDATE campaigns SET status = 'archived', completed_at = datetime('now') WHERE code = ?",
    args: [code],
  })

  // Count what was archived
  const stats = await db.execute({
    sql: `SELECT
            (SELECT COUNT(*) FROM children WHERE campaign_code = ?) as children,
            (SELECT COUNT(*) FROM observations WHERE campaign_code = ?) as observations,
            (SELECT COUNT(*) FROM reviews WHERE campaign_code = ?) as reviews`,
    args: [code, code, code],
  })

  return c.json({
    code,
    status: 'archived',
    archivedAt: new Date().toISOString(),
    stats: {
      children: stats.rows[0]?.children || 0,
      observations: stats.rows[0]?.observations || 0,
      reviews: stats.rows[0]?.reviews || 0,
    },
    message: 'Campaign archived',
  })
})

// Recall archived campaign
campaignRoutes.get('/:code/recall', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')

  // Get campaign
  const campaign = await db.execute({
    sql: 'SELECT * FROM campaigns WHERE code = ?',
    args: [code],
  })
  if (campaign.rows.length === 0) {
    return c.json({ error: 'Campaign not found' }, 404)
  }

  // Get all related data
  const children = await db.execute({
    sql: 'SELECT * FROM children WHERE campaign_code = ?',
    args: [code],
  })
  const observations = await db.execute({
    sql: 'SELECT * FROM observations WHERE campaign_code = ?',
    args: [code],
  })
  const reviews = await db.execute({
    sql: 'SELECT * FROM reviews WHERE campaign_code = ?',
    args: [code],
  })

  return c.json({
    campaign: campaign.rows[0],
    children: children.rows,
    observations: observations.rows,
    reviews: reviews.rows,
    recalledAt: new Date().toISOString(),
  })
})

// Campaign JSON export
campaignRoutes.get('/:code/export', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')

  const campaign = await db.execute({ sql: 'SELECT * FROM campaigns WHERE code = ?', args: [code] })
  if (campaign.rows.length === 0) return c.json({ error: 'Campaign not found' }, 404)

  const children = await db.execute({ sql: 'SELECT * FROM children WHERE campaign_code = ?', args: [code] })
  const observations = await db.execute({ sql: 'SELECT * FROM observations WHERE campaign_code = ?', args: [code] })
  const reviews = await db.execute({ sql: 'SELECT * FROM reviews WHERE campaign_code = ?', args: [code] })

  const exportData = {
    exportedAt: new Date().toISOString(),
    campaign: campaign.rows[0],
    children: children.rows,
    observations: observations.rows.map(row => ({
      ...row,
      ai_annotations: row.ai_annotations ? JSON.parse(row.ai_annotations as string) : [],
      annotation_data: row.annotation_data ? JSON.parse(row.annotation_data as string) : null,
      capture_metadata: row.capture_metadata ? JSON.parse(row.capture_metadata as string) : {},
    })),
    reviews: reviews.rows,
    stats: {
      totalChildren: children.rows.length,
      totalObservations: observations.rows.length,
      totalReviews: reviews.rows.length,
    },
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="campaign-${code}-export.json"`,
    },
  })
})
