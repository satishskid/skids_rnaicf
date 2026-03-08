// Campaign CRUD routes
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { generateCampaignCode } from '@skids/shared'

export const campaignRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// List all campaigns
campaignRoutes.get('/', async (c) => {
  const db = c.get('db')
  const result = await db.execute(
    'SELECT code, name, school_name, campaign_type, status, total_children, enabled_modules, created_at, city, state FROM campaigns ORDER BY created_at DESC'
  )
  const campaigns = result.rows.map(row => ({
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
