/**
 * Campaign Progress Route — Real-time campaign pipeline metrics.
 * GET /api/campaign-progress/:code — Full progress dashboard data.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { computeCampaignDashboard, MODULE_CONFIGS } from '@skids/shared'
import type { Child, ClinicianReview, ModuleType, SyncedObservation } from '@skids/shared'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.get('/:code', async (c) => {
  try {
    const code = c.req.param('code')
    const db = c.get('db')

    const [childRows, obsRows, reviewRows, campaignRow] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM children WHERE campaign_code = ?', args: [code] }),
      db.execute({ sql: 'SELECT * FROM observations WHERE campaign_code = ?', args: [code] }),
      db.execute({ sql: 'SELECT * FROM reviews WHERE campaign_code = ?', args: [code] }),
      db.execute({ sql: 'SELECT * FROM campaigns WHERE code = ?', args: [code] }),
    ])

    const campaign = campaignRow.rows?.[0] as any
    if (!campaign) return c.json({ error: 'Campaign not found' }, 404)

    const enabledModules: ModuleType[] = campaign.enabled_modules
      ? JSON.parse(campaign.enabled_modules)
      : MODULE_CONFIGS.map(m => m.type)

    const children: Child[] = (childRows.rows ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      dob: r.dob,
      gender: r.gender,
      class: r.class,
      campaignCode: r.campaign_code,
    }))

    const observations = (obsRows.rows ?? []).map((r: any) => ({
      id: r.id,
      childId: r.child_id,
      moduleType: r.module_type,
      campaignCode: r.campaign_code,
      annotationData: r.annotation_data ? JSON.parse(r.annotation_data) : undefined,
      aiAnnotations: r.ai_annotations ? JSON.parse(r.ai_annotations) : undefined,
      mediaUrl: r.media_url,
      timestamp: r.timestamp || r.created_at,
      _nurseName: r.screened_by,
    })) as unknown as SyncedObservation[]

    const reviews: Record<string, ClinicianReview> = {}
    for (const r of (reviewRows.rows ?? []) as any[]) {
      reviews[r.observation_id] = {
        id: r.id,
        clinicianId: r.clinician_id,
        clinicianName: r.clinician_name ?? '',
        timestamp: r.reviewed_at,
        notes: r.notes ?? '',
        decision: r.decision,
      }
    }

    const progress = computeCampaignDashboard(children, observations, reviews, enabledModules)

    return c.json({ progress })
  } catch (err: any) {
    console.error('campaign-progress error:', err?.message)
    return c.json({ error: 'Failed to compute campaign progress' }, 500)
  }
})

export const campaignProgressRoutes = app
