/**
 * Audit Log Routes — Immutable record of who did what when.
 * Critical for medical-legal compliance.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const auditLogRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET / — query audit log entries
auditLogRoutes.get('/', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.query('campaign')
  const userId = c.req.query('userId')
  const action = c.req.query('action')
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
  const offset = parseInt(c.req.query('offset') || '0')

  let sql = `SELECT al.*, u.name as userName, u.role as userRole
             FROM audit_log al
             LEFT JOIN user u ON u.id = al.user_id
             WHERE 1=1`
  const args: unknown[] = []

  if (campaignCode) { sql += ' AND al.campaign_code = ?'; args.push(campaignCode) }
  if (userId) { sql += ' AND al.user_id = ?'; args.push(userId) }
  if (action) { sql += ' AND al.action = ?'; args.push(action) }

  sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?'
  args.push(limit, offset)

  const result = await db.execute({ sql, args })

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM audit_log WHERE 1=1'
  const countArgs: unknown[] = []
  if (campaignCode) { countSql += ' AND campaign_code = ?'; countArgs.push(campaignCode) }
  if (userId) { countSql += ' AND user_id = ?'; countArgs.push(userId) }
  if (action) { countSql += ' AND action = ?'; countArgs.push(action) }

  const countResult = await db.execute({ sql: countSql, args: countArgs })
  const total = Number((countResult.rows[0] as Record<string, unknown>)?.total || 0)

  return c.json({
    entries: result.rows,
    total,
    limit,
    offset,
  })
})

// GET /actions — list distinct action types
auditLogRoutes.get('/actions', async (c) => {
  const db = c.get('db')
  const result = await db.execute('SELECT DISTINCT action FROM audit_log ORDER BY action')
  return c.json({ actions: result.rows.map(r => r.action) })
})

/**
 * Helper: Log an audit entry from any route handler.
 * Call this from other routes to create audit trail.
 *
 * Usage:
 *   import { logAudit } from './audit-log'
 *   await logAudit(db, { userId, action: 'observation.created', ... })
 */
export async function logAudit(
  db: import('@libsql/client').Client,
  entry: {
    userId: string
    action: string
    entityType?: string
    entityId?: string
    campaignCode?: string
    details?: string
    ipAddress?: string
  }
) {
  try {
    const id = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, campaign_code, details, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        id,
        entry.userId,
        entry.action,
        entry.entityType || null,
        entry.entityId || null,
        entry.campaignCode || null,
        entry.details || null,
        entry.ipAddress || null,
      ],
    })
  } catch (err) {
    // Non-critical — don't fail the main operation
    console.warn('[AuditLog] Failed to log:', err)
  }
}
