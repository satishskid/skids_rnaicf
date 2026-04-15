/**
 * Consent Management Routes
 * Handles consent templates and individual consent records.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import type { InValue } from '@libsql/client'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ─── Consent Templates ──────────────────────────────────────

// GET /templates — list consent templates for org
app.get('/templates', async (c) => {
  const db = c.get('db')
  const orgCode = c.req.query('orgCode')
  const status = c.req.query('status')

  let sql = 'SELECT * FROM consent_templates WHERE 1=1'
  const args: InValue[] = []

  if (orgCode) {
    sql += ' AND org_code = ?'
    args.push(orgCode)
  }
  if (status) {
    sql += ' AND status = ?'
    args.push(status)
  }
  sql += ' ORDER BY updated_at DESC'

  const result = await db.execute({ sql, args })
  return c.json({ templates: result.rows })
})

// POST /templates — create a consent template
app.post('/templates', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const body = await c.req.json<{
    orgCode: string
    title: string
    version?: string
    language?: string
    bodyHtml: string
    requiresWitness?: boolean
    minAgeForAssent?: number
    status?: string
  }>()

  if (!body.orgCode || !body.title || !body.bodyHtml) {
    return c.json({ error: 'orgCode, title, and bodyHtml are required' }, 400)
  }

  const result = await db.execute({
    sql: `INSERT INTO consent_templates (org_code, title, version, language, body_html, requires_witness, min_age_for_assent, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      body.orgCode,
      body.title,
      body.version || '1.0',
      body.language || 'en',
      body.bodyHtml,
      body.requiresWitness ? 1 : 0,
      body.minAgeForAssent ?? null,
      body.status || 'draft',
      userId || null,
    ],
  })

  return c.json({ template: result.rows[0] }, 201)
})

// GET /templates/:id — get a single template
app.get('/templates/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const result = await db.execute({
    sql: 'SELECT * FROM consent_templates WHERE id = ?',
    args: [id],
  })

  if (!result.rows.length) return c.json({ error: 'Template not found' }, 404)
  return c.json({ template: result.rows[0] })
})

// PUT /templates/:id — update a template
app.put('/templates/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = await c.req.json<{
    title?: string
    version?: string
    language?: string
    bodyHtml?: string
    requiresWitness?: boolean
    minAgeForAssent?: number
    status?: string
  }>()

  const fields: string[] = []
  const args: InValue[] = []

  if (body.title !== undefined) { fields.push('title = ?'); args.push(body.title) }
  if (body.version !== undefined) { fields.push('version = ?'); args.push(body.version) }
  if (body.language !== undefined) { fields.push('language = ?'); args.push(body.language) }
  if (body.bodyHtml !== undefined) { fields.push('body_html = ?'); args.push(body.bodyHtml) }
  if (body.requiresWitness !== undefined) { fields.push('requires_witness = ?'); args.push(body.requiresWitness ? 1 : 0) }
  if (body.minAgeForAssent !== undefined) { fields.push('min_age_for_assent = ?'); args.push(body.minAgeForAssent) }
  if (body.status !== undefined) { fields.push('status = ?'); args.push(body.status) }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400)

  fields.push("updated_at = datetime('now')")
  args.push(id)

  const result = await db.execute({
    sql: `UPDATE consent_templates SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
    args,
  })

  if (!result.rows.length) return c.json({ error: 'Template not found' }, 404)
  return c.json({ template: result.rows[0] })
})

// ─── Consent Records ────────────────────────────────────────

// POST / — record a consent
app.post('/', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const body = await c.req.json<{
    templateId: string
    campaignCode?: string
    childId?: string
    guardianName: string
    guardianRelation?: string
    guardianSignature?: string
    childAssentSignature?: string
    witnessName?: string
    witnessSignature?: string
    consented?: boolean
    deviceInfo?: string
  }>()

  if (!body.templateId || !body.guardianName) {
    return c.json({ error: 'templateId and guardianName are required' }, 400)
  }

  const result = await db.execute({
    sql: `INSERT INTO consents (template_id, campaign_code, child_id, guardian_name, guardian_relation,
          guardian_signature, child_assent_signature, witness_name, witness_signature,
          consented, device_info, collected_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      body.templateId,
      body.campaignCode || null,
      body.childId || null,
      body.guardianName,
      body.guardianRelation || null,
      body.guardianSignature || null,
      body.childAssentSignature || null,
      body.witnessName || null,
      body.witnessSignature || null,
      body.consented !== false ? 1 : 0,
      body.deviceInfo || null,
      userId || null,
    ],
  })

  return c.json({ consent: result.rows[0] }, 201)
})

// GET / — query consents (by childId, campaignCode, or templateId)
app.get('/', async (c) => {
  const db = c.get('db')
  const childId = c.req.query('childId')
  const campaignCode = c.req.query('campaignCode')
  const templateId = c.req.query('templateId')

  let sql = 'SELECT * FROM consents WHERE 1=1'
  const args: InValue[] = []

  if (childId) { sql += ' AND child_id = ?'; args.push(childId) }
  if (campaignCode) { sql += ' AND campaign_code = ?'; args.push(campaignCode) }
  if (templateId) { sql += ' AND template_id = ?'; args.push(templateId) }

  sql += ' ORDER BY created_at DESC LIMIT 200'

  const result = await db.execute({ sql, args })
  return c.json({ consents: result.rows })
})

// PUT /:id/withdraw — withdraw a consent
app.put('/:id/withdraw', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()
  const body = await c.req.json<{ reason?: string }>()

  const result = await db.execute({
    sql: `UPDATE consents SET withdrawn_at = datetime('now'), withdrawn_reason = ? WHERE id = ? AND withdrawn_at IS NULL RETURNING *`,
    args: [body.reason || null, id],
  })

  if (!result.rows.length) return c.json({ error: 'Consent not found or already withdrawn' }, 404)
  return c.json({ consent: result.rows[0] })
})

// GET /campaign-summary/:code — consent stats for a campaign
app.get('/campaign-summary/:code', async (c) => {
  const db = c.get('db')
  const { code } = c.req.param()

  const [totalResult, consentResult] = await Promise.all([
    db.execute({ sql: 'SELECT COUNT(*) as total FROM children WHERE campaign_code = ?', args: [code] }),
    db.execute({
      sql: `SELECT
        SUM(CASE WHEN consented = 1 AND withdrawn_at IS NULL THEN 1 ELSE 0 END) as consented,
        SUM(CASE WHEN consented = 0 THEN 1 ELSE 0 END) as declined,
        SUM(CASE WHEN withdrawn_at IS NOT NULL THEN 1 ELSE 0 END) as withdrawn
      FROM consents WHERE campaign_code = ?`,
      args: [code],
    }),
  ])

  const total = Number(totalResult.rows[0]?.total || 0)
  const consented = Number(consentResult.rows[0]?.consented || 0)
  const declined = Number(consentResult.rows[0]?.declined || 0)
  const withdrawn = Number(consentResult.rows[0]?.withdrawn || 0)
  const pending = total - consented - declined

  return c.json({ campaignCode: code, total, consented, declined, withdrawn, pending })
})

export const consentRoutes = app
