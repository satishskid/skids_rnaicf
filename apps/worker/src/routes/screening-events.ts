/**
 * Screening Events Route — Polling endpoint for parallel screening awareness.
 * GET /api/screening-events/:code — Returns recent screening activity.
 * Nurses poll this to see what other nurses are doing in the same campaign.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /:code — Recent activity (last 5 minutes by default)
app.get('/:code', async (c) => {
  const code = c.req.param('code')
  const minutes = parseInt(c.req.query('minutes') || '5')
  const db = c.get('db')

  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString()

  // Get recent observations with nurse names
  const recentObs = await db.execute({
    sql: `SELECT o.id, o.child_id, o.module_type, o.created_at, o.screened_by,
            c.name as child_name
          FROM observations o
          LEFT JOIN children c ON c.id = o.child_id
          WHERE o.campaign_code = ? AND o.created_at > ?
          ORDER BY o.created_at DESC
          LIMIT 50`,
    args: [code, cutoff],
  })

  // Get active nurses (those who created observations recently)
  const activeNurses = await db.execute({
    sql: `SELECT screened_by, COUNT(*) as count, MAX(created_at) as lastActive
          FROM observations
          WHERE campaign_code = ? AND created_at > ? AND screened_by IS NOT NULL
          GROUP BY screened_by
          ORDER BY lastActive DESC`,
    args: [code, cutoff],
  })

  // Get overall counts
  const stats = await db.execute({
    sql: `SELECT
            COUNT(DISTINCT child_id) as childrenScreened,
            COUNT(*) as totalObservations
          FROM observations
          WHERE campaign_code = ?`,
    args: [code],
  })

  const stat = (stats.rows?.[0] as any) || { childrenScreened: 0, totalObservations: 0 }

  return c.json({
    recentActivity: (recentObs.rows ?? []).map((r: any) => ({
      id: r.id,
      childId: r.child_id,
      childName: r.child_name,
      moduleType: r.module_type,
      nurseName: r.screened_by,
      createdAt: r.created_at,
    })),
    activeNurses: (activeNurses.rows ?? []).map((r: any) => ({
      name: r.screened_by,
      observations: r.count,
      lastActive: r.lastActive,
    })),
    stats: {
      childrenScreened: stat.childrenScreened,
      totalObservations: stat.totalObservations,
    },
  })
})

export const screeningEventsRoutes = app
