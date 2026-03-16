/**
 * Campaign Assignment Routes — assign users (especially authorities) to specific campaigns.
 * Admin/ops_manager only. Used for authority scoping — authorities see only assigned campaigns.
 *
 * GET    /api/campaign-assignments?userId=X    — list assignments for a user
 * GET    /api/campaign-assignments?campaign=X  — list assignments for a campaign
 * POST   /api/campaign-assignments             — create assignment
 * DELETE /api/campaign-assignments/:id         — remove assignment
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const campaignAssignmentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Runtime migration — ensure table exists
async function ensureTable(db: any) {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS campaign_assignments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      campaign_code TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      assigned_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, campaign_code)
    )`,
    args: [],
  })
  // Indexes
  await db.execute({ sql: 'CREATE INDEX IF NOT EXISTS idx_ca_user ON campaign_assignments(user_id)', args: [] })
  await db.execute({ sql: 'CREATE INDEX IF NOT EXISTS idx_ca_campaign ON campaign_assignments(campaign_code)', args: [] })
}

// GET / — list assignments by userId or campaign
campaignAssignmentRoutes.get('/', async (c) => {
  const db = c.get('db')
  await ensureTable(db)

  const userId = c.req.query('userId')
  const campaign = c.req.query('campaign')

  if (userId) {
    const result = await db.execute({
      sql: `SELECT ca.id, ca.user_id, ca.campaign_code, ca.assigned_by, ca.assigned_at,
                   cm.name as campaign_name, cm.status as campaign_status
            FROM campaign_assignments ca
            LEFT JOIN campaigns cm ON cm.code = ca.campaign_code
            WHERE ca.user_id = ?
            ORDER BY ca.assigned_at DESC`,
      args: [userId],
    })
    return c.json({
      assignments: result.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        campaignCode: r.campaign_code,
        campaignName: r.campaign_name,
        campaignStatus: r.campaign_status,
        assignedBy: r.assigned_by,
        assignedAt: r.assigned_at,
      })),
    })
  }

  if (campaign) {
    const result = await db.execute({
      sql: `SELECT ca.id, ca.user_id, ca.campaign_code, ca.assigned_by, ca.assigned_at,
                   u.name as user_name, u.email as user_email, u.role as user_role
            FROM campaign_assignments ca
            LEFT JOIN user u ON u.id = ca.user_id
            WHERE ca.campaign_code = ?
            ORDER BY ca.assigned_at DESC`,
      args: [campaign],
    })
    return c.json({
      assignments: result.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userEmail: r.user_email,
        userRole: r.user_role,
        campaignCode: r.campaign_code,
        assignedBy: r.assigned_by,
        assignedAt: r.assigned_at,
      })),
    })
  }

  return c.json({ error: 'Provide userId or campaign query param' }, 400)
})

// POST / — create assignment
campaignAssignmentRoutes.post('/', async (c) => {
  const db = c.get('db')
  await ensureTable(db)

  const { userId, campaignCode } = await c.req.json<{ userId: string; campaignCode: string }>()

  if (!userId || !campaignCode) {
    return c.json({ error: 'userId and campaignCode required' }, 400)
  }

  const id = crypto.randomUUID()
  const assignedBy = c.get('userId') || 'admin'

  try {
    await db.execute({
      sql: 'INSERT INTO campaign_assignments (id, user_id, campaign_code, assigned_by) VALUES (?, ?, ?, ?)',
      args: [id, userId, campaignCode, assignedBy],
    })
    return c.json({ id, userId, campaignCode, message: 'Assignment created' }, 201)
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: 'User already assigned to this campaign' }, 409)
    }
    throw e
  }
})

// DELETE /:id — remove assignment
campaignAssignmentRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  await ensureTable(db)

  const id = c.req.param('id')
  const result = await db.execute({ sql: 'DELETE FROM campaign_assignments WHERE id = ?', args: [id] })

  if (result.rowsAffected === 0) {
    return c.json({ error: 'Assignment not found' }, 404)
  }
  return c.json({ message: 'Assignment removed' })
})
