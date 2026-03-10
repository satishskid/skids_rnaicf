/**
 * Export Routes — CSV/JSON report generation endpoints.
 * GET /api/export/prevalence?campaign=CODE — Prevalence CSV
 * GET /api/export/full?campaign=CODE — Full report JSON
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import {
  computePrevalenceReport,
  exportConditionsToCSV,
  exportToJSON,
  generateReportFilename,
} from '@skids/shared'
import type { Child, Observation } from '@skids/shared'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Helper: fetch campaign data
async function fetchCampaignData(db: any, campaignCode: string) {
  const [childRows, obsRows] = await Promise.all([
    db.execute({
      sql: 'SELECT * FROM children WHERE campaign_code = ?',
      args: [campaignCode],
    }),
    db.execute({
      sql: 'SELECT * FROM observations WHERE campaign_code = ?',
      args: [campaignCode],
    }),
  ])

  const children: Child[] = (childRows.rows ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    dob: r.dob,
    gender: r.gender,
    class: r.class,
    campaignCode: r.campaign_code,
  }))

  const observations: Observation[] = (obsRows.rows ?? []).map((r: any) => ({
    id: r.id,
    childId: r.child_id,
    moduleType: r.module_type,
    campaignCode: r.campaign_code,
    annotationData: r.annotation_data ? JSON.parse(r.annotation_data) : undefined,
    aiAnnotations: r.ai_annotations ? JSON.parse(r.ai_annotations) : undefined,
    mediaUrl: r.media_url,
    createdAt: r.created_at,
  }))

  return { children, observations }
}

// GET /prevalence?campaign=CODE
app.get('/prevalence', async (c) => {
  const campaignCode = c.req.query('campaign')
  if (!campaignCode) return c.json({ error: 'campaign query param required' }, 400)

  const db = c.get('db')
  const { children, observations } = await fetchCampaignData(db, campaignCode)
  const report = computePrevalenceReport(children, observations, campaignCode)
  const csv = exportConditionsToCSV(report)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${generateReportFilename(campaignCode, 'csv')}"`,
    },
  })
})

// GET /full?campaign=CODE
app.get('/full', async (c) => {
  const campaignCode = c.req.query('campaign')
  if (!campaignCode) return c.json({ error: 'campaign query param required' }, 400)

  const db = c.get('db')
  const { children, observations } = await fetchCampaignData(db, campaignCode)
  const report = computePrevalenceReport(children, observations, campaignCode)

  const json = exportToJSON({
    campaignCode,
    campaignName: campaignCode,
    schoolName: '',
    location: '',
    generatedAt: new Date().toISOString(),
    dateRange: { start: '', end: '' },
    prevalence: report,
    demographics: {
      totalChildren: children.length,
      genderSplit: { male: 0, female: 0 },
      ageGroups: [],
      conditionByAge: [],
      conditionByGender: [],
    },
    executiveSummary: {
      totalScreened: report.totalScreened,
      completionRate: 0,
      referralRate: 0,
      highRiskCount: 0,
      topConditions: report.conditions.slice(0, 5).map(c => c.name),
      overallNormalRate: 0,
    },
  })

  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${generateReportFilename(campaignCode, 'json')}"`,
    },
  })
})

export const exportRoutes = app
