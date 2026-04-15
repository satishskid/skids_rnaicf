/**
 * Cohort Definition & Population Health Analytics Routes
 * Saved cohort filters, cohort resolution, and epi stats.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import type { InValue } from '@libsql/client'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ─── Cohort Definitions ─────────────────────────────────────

// GET / — list cohort definitions
app.get('/', async (c) => {
  const db = c.get('db')
  const orgCode = c.req.query('orgCode')

  let sql = 'SELECT * FROM cohort_definitions WHERE 1=1'
  const args: InValue[] = []
  if (orgCode) { sql += ' AND org_code = ?'; args.push(orgCode) }
  sql += ' ORDER BY updated_at DESC'

  const result = await db.execute({ sql, args })
  return c.json({ cohorts: result.rows })
})

// POST / — save cohort definition
app.post('/', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const body = await c.req.json<{
    orgCode: string
    name: string
    description?: string
    filterJson: unknown
  }>()

  if (!body.orgCode || !body.name || !body.filterJson) {
    return c.json({ error: 'orgCode, name, and filterJson are required' }, 400)
  }

  const result = await db.execute({
    sql: `INSERT INTO cohort_definitions (org_code, name, description, filter_json, created_by)
          VALUES (?, ?, ?, ?, ?) RETURNING *`,
    args: [
      body.orgCode, body.name, body.description || null,
      typeof body.filterJson === 'string' ? body.filterJson : JSON.stringify(body.filterJson),
      userId || null,
    ],
  })

  return c.json({ cohort: result.rows[0] }, 201)
})

// PUT /:id — update cohort definition
app.put('/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = await c.req.json<{
    name?: string
    description?: string
    filterJson?: unknown
  }>()

  const fields: string[] = []
  const args: InValue[] = []

  if (body.name !== undefined) { fields.push('name = ?'); args.push(body.name) }
  if (body.description !== undefined) { fields.push('description = ?'); args.push(body.description) }
  if (body.filterJson !== undefined) {
    fields.push('filter_json = ?')
    args.push(typeof body.filterJson === 'string' ? body.filterJson : JSON.stringify(body.filterJson))
  }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)
  fields.push("updated_at = datetime('now')")
  args.push(id)

  const result = await db.execute({
    sql: `UPDATE cohort_definitions SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
    args,
  })

  if (!result.rows.length) return c.json({ error: 'Cohort not found' }, 404)
  return c.json({ cohort: result.rows[0] })
})

// DELETE /:id — delete cohort definition
app.delete('/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  await db.execute({ sql: 'DELETE FROM cohort_definitions WHERE id = ?', args: [id] })
  return c.json({ ok: true })
})

// ─── Cohort Resolution ──────────────────────────────────────

// GET /:id/members — resolve cohort → child list
app.get('/:id/members', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const cohortResult = await db.execute({
    sql: 'SELECT * FROM cohort_definitions WHERE id = ?', args: [id],
  })
  if (!cohortResult.rows.length) return c.json({ error: 'Cohort not found' }, 404)

  const cohort = cohortResult.rows[0] as Record<string, unknown>
  const filter = JSON.parse(cohort.filter_json as string) as CohortFilter

  const { sql, args } = buildCohortQuery(filter)
  const result = await db.execute({ sql, args })

  return c.json({ cohortId: id, cohortName: cohort.name, count: result.rows.length, members: result.rows })
})

// POST /resolve — resolve an ad-hoc filter (without saving)
app.post('/resolve', async (c) => {
  const db = c.get('db')
  const body = await c.req.json<{ filterJson: CohortFilter }>()

  if (!body.filterJson) return c.json({ error: 'filterJson is required' }, 400)

  const { sql, args } = buildCohortQuery(body.filterJson)
  const result = await db.execute({ sql, args })

  return c.json({ count: result.rows.length, members: result.rows })
})

// ─── Cohort Analytics ───────────────────────────────────────

// GET /:id/analytics — run analytics on a cohort
app.get('/:id/analytics', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const cohortResult = await db.execute({
    sql: 'SELECT * FROM cohort_definitions WHERE id = ?', args: [id],
  })
  if (!cohortResult.rows.length) return c.json({ error: 'Cohort not found' }, 404)

  const cohort = cohortResult.rows[0] as Record<string, unknown>
  const filter = JSON.parse(cohort.filter_json as string) as CohortFilter

  const { sql, args } = buildCohortQuery(filter)
  const membersResult = await db.execute({ sql, args })
  const childIds = (membersResult.rows as Record<string, unknown>[]).map(r => r.id as string)

  if (childIds.length === 0) {
    return c.json({
      cohortId: id, cohortName: cohort.name, count: 0,
      demographics: { male: 0, female: 0 }, ageGroups: {}, screeningCoverage: 0,
    })
  }

  // Demographics
  const males = (membersResult.rows as Record<string, unknown>[]).filter(r => r.gender === 'male').length
  const females = (membersResult.rows as Record<string, unknown>[]).filter(r => r.gender === 'female').length

  // Age distribution
  const ageGroups: Record<string, number> = {}
  for (const row of membersResult.rows as Record<string, unknown>[]) {
    const dob = row.dob as string
    if (dob) {
      const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      const group = age < 3 ? '0-2' : age < 6 ? '3-5' : age < 10 ? '6-9' : age < 14 ? '10-13' : '14+'
      ageGroups[group] = (ageGroups[group] || 0) + 1
    }
  }

  // Screening coverage
  const placeholders = childIds.map(() => '?').join(',')
  const obsResult = await db.execute({
    sql: `SELECT COUNT(DISTINCT child_id) as screened FROM observations WHERE child_id IN (${placeholders})`,
    args: childIds,
  })
  const screened = Number((obsResult.rows[0] as Record<string, unknown>)?.screened || 0)

  // Top conditions (from annotation_data)
  const condResult = await db.execute({
    sql: `SELECT module_type, COUNT(*) as count
          FROM observations
          WHERE child_id IN (${placeholders}) AND risk_level > 0
          GROUP BY module_type
          ORDER BY count DESC
          LIMIT 10`,
    args: childIds,
  })

  return c.json({
    cohortId: id,
    cohortName: cohort.name,
    count: childIds.length,
    demographics: { male: males, female: females },
    ageGroups,
    screeningCoverage: childIds.length > 0 ? Math.round((screened / childIds.length) * 1000) / 10 : 0,
    topFindings: condResult.rows,
  })
})

// GET /:id/compare/:otherId — compare two cohorts
app.get('/:id/compare/:otherId', async (c) => {
  const db = c.get('db')
  const { id, otherId } = c.req.param()

  const [cohortAResult, cohortBResult] = await Promise.all([
    db.execute({ sql: 'SELECT * FROM cohort_definitions WHERE id = ?', args: [id] }),
    db.execute({ sql: 'SELECT * FROM cohort_definitions WHERE id = ?', args: [otherId] }),
  ])

  if (!cohortAResult.rows.length || !cohortBResult.rows.length) {
    return c.json({ error: 'One or both cohorts not found' }, 404)
  }

  const filterA = JSON.parse((cohortAResult.rows[0] as Record<string, unknown>).filter_json as string) as CohortFilter
  const filterB = JSON.parse((cohortBResult.rows[0] as Record<string, unknown>).filter_json as string) as CohortFilter

  const [membersA, membersB] = await Promise.all([
    db.execute(buildCohortQuery(filterA)),
    db.execute(buildCohortQuery(filterB)),
  ])

  const idsA = (membersA.rows as Record<string, unknown>[]).map(r => r.id as string)
  const idsB = (membersB.rows as Record<string, unknown>[]).map(r => r.id as string)

  // Get screening findings for both
  const getFindings = async (ids: string[]) => {
    if (ids.length === 0) return []
    const ph = ids.map(() => '?').join(',')
    const res = await db.execute({
      sql: `SELECT module_type, COUNT(DISTINCT child_id) as affected
            FROM observations WHERE child_id IN (${ph}) AND risk_level > 0
            GROUP BY module_type ORDER BY affected DESC`,
      args: ids,
    })
    return res.rows.map((r: Record<string, unknown>) => ({
      module: r.module_type,
      affected: Number(r.affected),
      prevalence: ids.length > 0 ? Math.round((Number(r.affected) / ids.length) * 1000) / 10 : 0,
    }))
  }

  const [findingsA, findingsB] = await Promise.all([getFindings(idsA), getFindings(idsB)])

  return c.json({
    cohortA: { id, name: (cohortAResult.rows[0] as Record<string, unknown>).name, count: idsA.length, findings: findingsA },
    cohortB: { id: otherId, name: (cohortBResult.rows[0] as Record<string, unknown>).name, count: idsB.length, findings: findingsB },
  })
})

// ─── Population Health Dashboard ────────────────────────────

// GET /population-health/dashboard — org-wide epi summary
app.get('/population-health/dashboard', async (c) => {
  const db = c.get('db')
  const orgCode = c.req.query('orgCode')

  // Total children and screening coverage
  let childSql = 'SELECT COUNT(*) as total FROM children WHERE 1=1'
  const childArgs: InValue[] = []
  if (orgCode) {
    childSql += ' AND campaign_code IN (SELECT code FROM campaigns WHERE org_code = ?)'
    childArgs.push(orgCode)
  }
  const [totalResult, screenedResult, conditionResult, campaignResult] = await Promise.all([
    db.execute({ sql: childSql, args: childArgs }),
    db.execute({
      sql: orgCode
        ? 'SELECT COUNT(DISTINCT child_id) as screened FROM observations WHERE campaign_code IN (SELECT code FROM campaigns WHERE org_code = ?)'
        : 'SELECT COUNT(DISTINCT child_id) as screened FROM observations',
      args: orgCode ? [orgCode] : [],
    }),
    db.execute({
      sql: orgCode
        ? `SELECT module_type, COUNT(DISTINCT child_id) as affected
           FROM observations WHERE risk_level > 0
           AND campaign_code IN (SELECT code FROM campaigns WHERE org_code = ?)
           GROUP BY module_type ORDER BY affected DESC LIMIT 15`
        : `SELECT module_type, COUNT(DISTINCT child_id) as affected
           FROM observations WHERE risk_level > 0
           GROUP BY module_type ORDER BY affected DESC LIMIT 15`,
      args: orgCode ? [orgCode] : [],
    }),
    db.execute({
      sql: orgCode
        ? 'SELECT code, name, school_name, city, state, total_children FROM campaigns WHERE org_code = ? ORDER BY created_at DESC'
        : 'SELECT code, name, school_name, city, state, total_children FROM campaigns ORDER BY created_at DESC',
      args: orgCode ? [orgCode] : [],
    }),
  ])

  const total = Number((totalResult.rows[0] as Record<string, unknown>)?.total || 0)
  const screened = Number((screenedResult.rows[0] as Record<string, unknown>)?.screened || 0)

  // Geographic aggregation
  const orgFilter = orgCode ? ' WHERE org_code = ?' : ''
  const orgArgs = orgCode ? [orgCode] : []

  const [byState, byDistrict, byCity] = await Promise.all([
    db.execute({
      sql: `SELECT cam.state, COUNT(DISTINCT ch.id) as children,
                   COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN ch.id END) as screened,
                   COUNT(DISTINCT cam.code) as campaigns
            FROM campaigns cam
            LEFT JOIN children ch ON ch.campaign_code = cam.code
            LEFT JOIN observations o ON o.child_id = ch.id
            ${orgFilter ? 'WHERE cam.org_code = ?' : 'WHERE 1=1'}
            AND cam.state IS NOT NULL AND cam.state != ''
            GROUP BY cam.state ORDER BY children DESC`,
      args: orgArgs,
    }),
    db.execute({
      sql: `SELECT cam.district, cam.state, COUNT(DISTINCT ch.id) as children,
                   COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN ch.id END) as screened,
                   COUNT(DISTINCT cam.code) as campaigns
            FROM campaigns cam
            LEFT JOIN children ch ON ch.campaign_code = cam.code
            LEFT JOIN observations o ON o.child_id = ch.id
            ${orgFilter ? 'WHERE cam.org_code = ?' : 'WHERE 1=1'}
            AND cam.district IS NOT NULL AND cam.district != ''
            GROUP BY cam.district, cam.state ORDER BY children DESC`,
      args: orgArgs,
    }),
    db.execute({
      sql: `SELECT cam.city, cam.district, cam.state, COUNT(DISTINCT ch.id) as children,
                   COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN ch.id END) as screened,
                   COUNT(DISTINCT cam.code) as campaigns
            FROM campaigns cam
            LEFT JOIN children ch ON ch.campaign_code = cam.code
            LEFT JOIN observations o ON o.child_id = ch.id
            ${orgFilter ? 'WHERE cam.org_code = ?' : 'WHERE 1=1'}
            AND cam.city IS NOT NULL AND cam.city != ''
            GROUP BY cam.city, cam.district, cam.state ORDER BY children DESC`,
      args: orgArgs,
    }),
  ])

  return c.json({
    totalChildren: total,
    screenedChildren: screened,
    screeningCoverage: total > 0 ? Math.round((screened / total) * 1000) / 10 : 0,
    topConditions: conditionResult.rows,
    campaigns: campaignResult.rows,
    byState: byState.rows,
    byDistrict: byDistrict.rows,
    byCity: byCity.rows,
  })
})

// ─── Helpers ────────────────────────────────────────────────

interface CohortFilter {
  campaignCodes?: string[]
  gender?: string
  ageMin?: number
  ageMax?: number
  classes?: string[]
  conditions?: string[]  // module_types with risk > 0
  states?: string[]      // geographic filters
  districts?: string[]
  cities?: string[]
}

function buildCohortQuery(filter: CohortFilter): { sql: string; args: InValue[] } {
  let sql = 'SELECT c.* FROM children c WHERE 1=1'
  const args: InValue[] = []

  if (filter.campaignCodes?.length) {
    const ph = filter.campaignCodes.map(() => '?').join(',')
    sql += ` AND c.campaign_code IN (${ph})`
    args.push(...filter.campaignCodes)
  }

  if (filter.gender) {
    sql += ' AND c.gender = ?'
    args.push(filter.gender)
  }

  if (filter.ageMin !== undefined || filter.ageMax !== undefined) {
    // Calculate DOB range from age range
    const now = new Date()
    if (filter.ageMax !== undefined) {
      const minDob = new Date(now.getFullYear() - filter.ageMax - 1, now.getMonth(), now.getDate())
      sql += ' AND c.dob >= ?'
      args.push(minDob.toISOString().slice(0, 10))
    }
    if (filter.ageMin !== undefined) {
      const maxDob = new Date(now.getFullYear() - filter.ageMin, now.getMonth(), now.getDate())
      sql += ' AND c.dob <= ?'
      args.push(maxDob.toISOString().slice(0, 10))
    }
  }

  if (filter.classes?.length) {
    const ph = filter.classes.map(() => '?').join(',')
    sql += ` AND c.class IN (${ph})`
    args.push(...filter.classes)
  }

  if (filter.conditions?.length) {
    // Children who have at-risk observations for these modules
    const ph = filter.conditions.map(() => '?').join(',')
    sql += ` AND c.id IN (SELECT DISTINCT child_id FROM observations WHERE module_type IN (${ph}) AND risk_level > 0)`
    args.push(...filter.conditions)
  }

  // Geographic filters (via campaign location)
  if (filter.states?.length) {
    const ph = filter.states.map(() => '?').join(',')
    sql += ` AND c.campaign_code IN (SELECT code FROM campaigns WHERE state IN (${ph}))`
    args.push(...filter.states)
  }
  if (filter.districts?.length) {
    const ph = filter.districts.map(() => '?').join(',')
    sql += ` AND c.campaign_code IN (SELECT code FROM campaigns WHERE district IN (${ph}))`
    args.push(...filter.districts)
  }
  if (filter.cities?.length) {
    const ph = filter.cities.map(() => '?').join(',')
    sql += ` AND c.campaign_code IN (SELECT code FROM campaigns WHERE city IN (${ph}))`
    args.push(...filter.cities)
  }

  return { sql, args }
}

export const cohortRoutes = app
