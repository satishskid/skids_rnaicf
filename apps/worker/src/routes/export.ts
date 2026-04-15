/**
 * Export Routes — CSV/JSON report generation endpoints.
 * GET /api/export/prevalence?campaign=CODE — Prevalence CSV
 * GET /api/export/full?campaign=CODE — Full report JSON
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import type { InValue } from '@libsql/client'
import {
  computePrevalenceReport,
  exportConditionsToCSV,
  exportToJSON,
  generateReportFilename,
  buildCampaignFhirBundle,
  childToFhirPatient,
  observationToFhirObservation,
  createFhirBundle,
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

// Authority-scoped campaign access check
async function verifyAuthorityAccess(db: any, userId: string, userRole: string, campaignCode: string): Promise<boolean> {
  if (userRole === 'admin' || userRole === 'ops_manager') return true
  if (userRole !== 'authority') return true // nurse/doctor can export their own

  const result = await db.execute({
    sql: 'SELECT 1 FROM campaign_assignments WHERE user_id = ? AND campaign_code = ?',
    args: [userId, campaignCode],
  })
  return (result.rows?.length ?? 0) > 0
}

// GET /prevalence?campaign=CODE
app.get('/prevalence', async (c) => {
  const campaignCode = c.req.query('campaign')
  if (!campaignCode) return c.json({ error: 'campaign query param required' }, 400)

  const db = c.get('db')
  const userId = c.get('userId') || ''
  const userRole = c.get('userRole') || ''
  if (!(await verifyAuthorityAccess(db, userId, userRole, campaignCode))) {
    return c.json({ error: 'Authority users can only export assigned campaigns' }, 403)
  }

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

  const db2 = c.get('db')
  const userId2 = c.get('userId') || ''
  const userRole2 = c.get('userRole') || ''
  if (!(await verifyAuthorityAccess(db2, userId2, userRole2, campaignCode))) {
    return c.json({ error: 'Authority users can only export assigned campaigns' }, 403)
  }

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
      topConditions: report.conditions.slice(0, 5).map(c => ({ name: c.name, prevalence: c.count })),
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

// ─── FHIR R4 Exports ────────────────────────────────────────

// GET /fhir/campaign/:code — full campaign as FHIR bundle
app.get('/fhir/campaign/:code', async (c) => {
  const { code } = c.req.param()
  const db = c.get('db')
  const { children, observations } = await fetchCampaignData(db, code)
  const bundle = buildCampaignFhirBundle(children, observations)

  return c.json(bundle, 200, {
    'Content-Disposition': `attachment; filename="fhir-campaign-${code}.json"`,
  })
})

// GET /fhir/patient/:childId — single patient FHIR bundle
app.get('/fhir/patient/:childId', async (c) => {
  const { childId } = c.req.param()
  const db = c.get('db')

  const [childRes, obsRes] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM children WHERE id = ?', args: [childId] }),
    db.execute({ sql: 'SELECT * FROM observations WHERE child_id = ?', args: [childId] }),
  ])

  if (!childRes.rows.length) return c.json({ error: 'Child not found' }, 404)

  const r: any = childRes.rows[0]
  const child: Child = { id: r.id, name: r.name, dob: r.dob, gender: r.gender, class: r.class, campaignCode: r.campaign_code }
  const patient = childToFhirPatient(child)

  const obsResources = (obsRes.rows ?? []).map((o: any) =>
    observationToFhirObservation({
      id: o.id, childId: o.child_id, moduleType: o.module_type, campaignCode: o.campaign_code,
      annotationData: o.annotation_data ? JSON.parse(o.annotation_data) : undefined,
      aiAnnotations: o.ai_annotations ? JSON.parse(o.ai_annotations) : undefined,
      createdAt: o.created_at,
    } as Observation, child.name)
  )

  const bundle = createFhirBundle([patient, ...obsResources])
  return c.json(bundle)
})

// GET /fhir/study/:id — study as FHIR bundle (ResearchStudy + enrolled patients + observations)
app.get('/fhir/study/:id', async (c) => {
  const { id } = c.req.param()
  const db = c.get('db')

  // Fetch study
  const studyRes = await db.execute({ sql: 'SELECT * FROM studies WHERE id = ?', args: [id] })
  if (!studyRes.rows.length) return c.json({ error: 'Study not found' }, 404)

  const s: any = studyRes.rows[0]
  const studyResource = {
    resourceType: 'ResearchStudy' as const,
    id: s.id,
    status: s.status === 'active' ? 'active' : s.status === 'completed' ? 'completed' : 'in-review',
    title: s.title,
    description: s.description || undefined,
    principalInvestigator: s.pi_name ? { display: s.pi_name } : undefined,
    category: [{ text: s.study_type }],
    identifier: [
      { system: 'urn:skids:study-code', value: s.short_code },
      ...(s.irb_number ? [{ system: 'urn:skids:irb-number', value: s.irb_number }] : []),
    ],
  }

  // Fetch enrolled children + their observations
  const enrollRes = await db.execute({
    sql: `SELECT c.* FROM study_enrollments se
          JOIN children c ON c.id = se.child_id
          WHERE se.study_id = ?`,
    args: [id],
  })

  const children: Child[] = (enrollRes.rows ?? []).map((r: any) => ({
    id: r.id, name: r.name, dob: r.dob, gender: r.gender, class: r.class, campaignCode: r.campaign_code,
  }))

  const childIds = children.map(c => c.id)
  let observations: Observation[] = []

  if (childIds.length > 0) {
    const ph = childIds.map(() => '?').join(',')
    const obsRes = await db.execute({
      sql: `SELECT * FROM observations WHERE child_id IN (${ph})`,
      args: childIds,
    })
    observations = (obsRes.rows ?? []).map((r: any) => ({
      id: r.id, childId: r.child_id, moduleType: r.module_type, campaignCode: r.campaign_code,
      annotationData: r.annotation_data ? JSON.parse(r.annotation_data) : undefined,
      aiAnnotations: r.ai_annotations ? JSON.parse(r.ai_annotations) : [],
      mediaUrl: r.media_url, createdAt: r.created_at,
      sessionId: r.session_id ?? r.id,
      captureMetadata: {},
      timestamp: r.timestamp ?? r.created_at,
    }))
  }

  // Build FHIR bundle
  const childMap = new Map(children.map(ch => [ch.id, ch]))
  const resources: any[] = [studyResource]
  for (const child of children) resources.push(childToFhirPatient(child))
  for (const obs of observations) {
    const child = obs.childId ? childMap.get(obs.childId) : undefined
    resources.push(observationToFhirObservation(obs, child?.name))
  }

  const bundle = createFhirBundle(resources)
  return c.json(bundle, 200, {
    'Content-Disposition': `attachment; filename="fhir-study-${s.short_code}.json"`,
  })
})

// GET /study/:id/csv — tabular CSV export (one row per child per event per instrument)
app.get('/study/:id/csv', async (c) => {
  const { id } = c.req.param()
  const db = c.get('db')

  const result = await db.execute({
    sql: `SELECT se.child_id, c.name as child_name, c.dob, c.gender, c.class,
          sa.name as arm_name, se.enrolled_at, se.status as enrollment_status,
          sev.name as event_name, sev.day_offset,
          i.name as instrument_name, i.category as instrument_category,
          ir.response_json, ir.score_json, ir.completed, ir.completed_at
          FROM study_enrollments se
          JOIN children c ON c.id = se.child_id
          LEFT JOIN study_arms sa ON sa.id = se.arm_id
          CROSS JOIN study_events sev ON sev.study_id = se.study_id
          LEFT JOIN study_event_instruments sei ON sei.study_event_id = sev.id
          LEFT JOIN instruments i ON i.id = sei.instrument_id
          LEFT JOIN instrument_responses ir ON ir.instrument_id = i.id AND ir.child_id = se.child_id
          WHERE se.study_id = ?
          ORDER BY c.name, sev.sort_order, i.name`,
    args: [id],
  })

  // Build CSV
  const headers = ['child_id', 'child_name', 'dob', 'gender', 'class', 'arm', 'enrolled_at', 'enrollment_status', 'event', 'day_offset', 'instrument', 'instrument_category', 'completed', 'completed_at', 'score_json']
  const rows = (result.rows as any[]).map(r => [
    r.child_id, r.child_name, r.dob, r.gender, r.class || '',
    r.arm_name || '', r.enrolled_at, r.enrollment_status,
    r.event_name || '', r.day_offset ?? '', r.instrument_name || '', r.instrument_category || '',
    r.completed ?? '', r.completed_at || '', r.score_json || '',
  ])

  const csvContent = [headers.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n')

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="study-${id}-export.csv"`,
    },
  })
})

// GET /cohort/:id/csv — cohort data CSV export
app.get('/cohort/:id/csv', async (c) => {
  const { id } = c.req.param()
  const db = c.get('db')

  // Get cohort filter
  const cohortRes = await db.execute({ sql: 'SELECT * FROM cohort_definitions WHERE id = ?', args: [id] })
  if (!cohortRes.rows.length) return c.json({ error: 'Cohort not found' }, 404)

  const cohort = cohortRes.rows[0] as any
  const filter = JSON.parse(cohort.filter_json)

  // Build SQL from filter (same logic as cohorts.ts)
  let sql = 'SELECT c.* FROM children c WHERE 1=1'
  const args: InValue[] = []

  if (filter.campaignCodes?.length) {
    const ph = filter.campaignCodes.map(() => '?').join(',')
    sql += ` AND c.campaign_code IN (${ph})`
    args.push(...filter.campaignCodes)
  }
  if (filter.gender) { sql += ' AND c.gender = ?'; args.push(filter.gender) }
  if (filter.ageMax !== undefined) {
    const minDob = new Date(new Date().getFullYear() - filter.ageMax - 1, new Date().getMonth(), new Date().getDate())
    sql += ' AND c.dob >= ?'; args.push(minDob.toISOString().slice(0, 10))
  }
  if (filter.ageMin !== undefined) {
    const maxDob = new Date(new Date().getFullYear() - filter.ageMin, new Date().getMonth(), new Date().getDate())
    sql += ' AND c.dob <= ?'; args.push(maxDob.toISOString().slice(0, 10))
  }
  if (filter.classes?.length) {
    const ph = filter.classes.map(() => '?').join(',')
    sql += ` AND c.class IN (${ph})`; args.push(...filter.classes)
  }
  if (filter.conditions?.length) {
    const ph = filter.conditions.map(() => '?').join(',')
    sql += ` AND c.id IN (SELECT DISTINCT child_id FROM observations WHERE module_type IN (${ph}) AND risk_level > 0)`
    args.push(...filter.conditions)
  }

  const membersRes = await db.execute({ sql, args })
  const childIds = (membersRes.rows as any[]).map(r => r.id)

  // Fetch observations for these children
  let obsRows: any[] = []
  if (childIds.length > 0) {
    const ph = childIds.map(() => '?').join(',')
    const obsRes = await db.execute({
      sql: `SELECT o.child_id, o.module_type, o.risk_level, o.ai_annotations, o.created_at
            FROM observations o WHERE o.child_id IN (${ph})
            ORDER BY o.child_id, o.module_type`,
      args: childIds,
    })
    obsRows = obsRes.rows as any[]
  }

  // Build CSV: one row per child with observation summary
  const headers = ['child_id', 'name', 'dob', 'gender', 'class', 'campaign_code', 'modules_screened', 'risk_findings']
  const childObsMap = new Map<string, any[]>()
  for (const o of obsRows) {
    if (!childObsMap.has(o.child_id)) childObsMap.set(o.child_id, [])
    childObsMap.get(o.child_id)!.push(o)
  }

  const rows = (membersRes.rows as any[]).map(r => {
    const obs = childObsMap.get(r.id) || []
    const modules = [...new Set(obs.map((o: any) => o.module_type))].join(';')
    const findings = obs.filter((o: any) => Number(o.risk_level) > 0).map((o: any) => o.module_type).join(';')
    return [r.id, r.name, r.dob, r.gender, r.class || '', r.campaign_code, modules, findings]
  })

  const csvContent = [headers.join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n')

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="cohort-${cohort.name.replace(/\s+/g, '-')}.csv"`,
    },
  })
})

// Helper: escape CSV values
function escapeCsv(val: unknown): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const exportRoutes = app
