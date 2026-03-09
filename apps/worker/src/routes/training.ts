// Training data routes — doctor feedback for AI model training
import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const trainingRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Upload training sample (doctor feedback on observation)
trainingRoutes.post('/campaigns/:code/training', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.param('code')
  const body = await c.req.json()
  const id = body.id || crypto.randomUUID()

  if (!body.observationId || !body.feedback) {
    return c.json({ error: 'observationId and feedback are required' }, 400)
  }

  await db.execute({
    sql: `INSERT INTO training_samples (id, campaign_code, observation_id, doctor_id, doctor_name, feedback, module_type)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      campaignCode,
      body.observationId,
      body.doctorId || c.get('userId') || 'doctor',
      body.doctorName || 'Doctor',
      typeof body.feedback === 'string' ? body.feedback : JSON.stringify(body.feedback),
      body.moduleType || 'unknown',
    ],
  })

  return c.json({ id, message: 'Training sample saved' }, 201)
})

// Get training samples for a campaign
trainingRoutes.get('/campaigns/:code/training', async (c) => {
  const db = c.get('db')
  const campaignCode = c.req.param('code')

  const result = await db.execute({
    sql: 'SELECT * FROM training_samples WHERE campaign_code = ? ORDER BY created_at DESC',
    args: [campaignCode],
  })

  const samples = result.rows.map(row => ({
    id: row.id,
    campaignCode: row.campaign_code,
    observationId: row.observation_id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    feedback: typeof row.feedback === 'string' ? JSON.parse(row.feedback as string) : row.feedback,
    moduleType: row.module_type,
    createdAt: row.created_at,
  }))

  return c.json({ samples })
})

// Cross-campaign training export (JSONL or CSV)
trainingRoutes.get('/training/export', async (c) => {
  const db = c.get('db')
  const format = c.req.query('format') || 'jsonl'
  const campaignCodes = c.req.query('campaigns')?.split(',')

  let sql = `SELECT ts.*, o.module_type as obs_module, o.ai_annotations, o.annotation_data
             FROM training_samples ts
             JOIN observations o ON ts.observation_id = o.id`
  const args: unknown[] = []

  if (campaignCodes && campaignCodes.length > 0) {
    sql += ` WHERE ts.campaign_code IN (${campaignCodes.map(() => '?').join(',')})`
    args.push(...campaignCodes)
  }

  sql += ' ORDER BY ts.created_at DESC'

  const result = await db.execute({ sql, args })

  if (format === 'csv') {
    const header = 'id,campaign_code,observation_id,module_type,doctor_id,feedback,ai_annotations,created_at'
    const rows = result.rows.map(row =>
      `${row.id},${row.campaign_code},${row.observation_id},${row.obs_module},${row.doctor_id},"${(row.feedback as string || '').replace(/"/g, '""')}","${(row.ai_annotations as string || '').replace(/"/g, '""')}",${row.created_at}`
    )
    const csv = [header, ...rows].join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="training-export.csv"',
      },
    })
  }

  // JSONL format
  const lines = result.rows.map(row => JSON.stringify({
    id: row.id,
    campaignCode: row.campaign_code,
    observationId: row.observation_id,
    moduleType: row.obs_module,
    doctorId: row.doctor_id,
    feedback: typeof row.feedback === 'string' ? JSON.parse(row.feedback as string) : row.feedback,
    aiAnnotations: row.ai_annotations ? JSON.parse(row.ai_annotations as string) : [],
    annotationData: row.annotation_data ? JSON.parse(row.annotation_data as string) : null,
    createdAt: row.created_at,
  }))

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'application/jsonl',
      'Content-Disposition': 'attachment; filename="training-export.jsonl"',
    },
  })
})
