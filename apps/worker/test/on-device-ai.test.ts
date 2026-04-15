// Route tests for POST /api/on-device-ai/:outcome — role/outcome matrix
// + manifest validation + audit_log write verification.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { MODEL_MANIFEST } from '@skids/shared'
import { onDeviceAiRoutes } from '../src/routes/on-device-ai'

type AuditCall = {
  userId: string
  action: string
  entityType?: string
  entityId?: string
  details?: string
}

function makeDbStub(auditCalls: AuditCall[]) {
  return {
    execute: async (arg: { sql: string; args: unknown[] }) => {
      if (/INSERT INTO audit_log/i.test(arg.sql)) {
        auditCalls.push({
          userId: String(arg.args[1]),
          action: String(arg.args[2]),
          entityType: arg.args[3] ? String(arg.args[3]) : undefined,
          entityId: arg.args[4] ? String(arg.args[4]) : undefined,
          details: arg.args[6] ? String(arg.args[6]) : undefined,
        })
      }
      return { rows: [] }
    },
  }
}

function mount(opts: { userId?: string; userRole?: string; db: unknown }) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    if (!opts.userId) return c.json({ error: 'Unauthorized' }, 401)
    c.set('userId', opts.userId)
    c.set('userRole', opts.userRole ?? 'nurse')
    c.set('db', opts.db)
    await next()
  })
  app.route('/api/on-device-ai', onDeviceAiRoutes as unknown as Hono)
  return app
}

function validBody(
  overrides: Partial<{
    runOn: 'device' | 'cloud-doctor-hitl'
    modelId: string
    modelVersion: string
    observationId?: string
    editedPayload?: unknown
  }> = {},
) {
  return {
    suggestionId: '11111111-1111-4111-8111-111111111111',
    modelId: overrides.modelId ?? MODEL_MANIFEST.id,
    modelVersion: overrides.modelVersion ?? MODEL_MANIFEST.version,
    moduleType: 'vision-screening',
    observationId: overrides.observationId,
    childId: 'child-123',
    suggestionSchemaVersion: 1,
    suggestionPayload: { suggestions: [], modelInfo: { name: 'LFM2.5', version: '0.1', runtimeMs: 100, runOn: 'device' } },
    runtimeMs: 100,
    runOn: overrides.runOn ?? 'device',
    ...(overrides.editedPayload !== undefined ? { editedPayload: overrides.editedPayload } : {}),
  }
}

function post(app: Hono, outcome: string, body: unknown) {
  return app.request(`/api/on-device-ai/${outcome}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test('401 when unauthenticated', async () => {
  const audit: AuditCall[] = []
  const app = mount({ db: makeDbStub(audit) })
  const res = await post(app, 'suggested', validBody())
  assert.equal(res.status, 401)
  assert.equal(audit.length, 0)
})

test('404 when :outcome is not a known HITL outcome', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', db: makeDbStub(audit) })
  const res = await post(app, 'bogus', validBody())
  assert.equal(res.status, 404)
  assert.equal(audit.length, 0)
})

test('400 on invalid JSON body', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', db: makeDbStub(audit) })
  const res = await app.request('/api/on-device-ai/suggested', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json',
  })
  assert.equal(res.status, 400)
  assert.equal(audit.length, 0)
})

test('400 when Zod validation fails (bad suggestionId)', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', db: makeDbStub(audit) })
  const body = { ...validBody(), suggestionId: 'not-a-uuid' }
  const res = await post(app, 'suggested', body)
  assert.equal(res.status, 400)
  assert.equal(audit.length, 0)
})

test('400 when modelId does not match pinned manifest', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', db: makeDbStub(audit) })
  const res = await post(app, 'suggested', validBody({ modelId: 'bogus/other' }))
  assert.equal(res.status, 400)
  assert.equal(audit.length, 0)
})

test('400 when modelVersion does not match pinned manifest', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', db: makeDbStub(audit) })
  const res = await post(app, 'suggested', validBody({ modelVersion: 'bogus' }))
  assert.equal(res.status, 400)
  assert.equal(audit.length, 0)
})

test('400 when outcome=edited but editedPayload missing', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'doc-1', userRole: 'doctor', db: makeDbStub(audit) })
  const res = await post(app, 'edited', validBody({ runOn: 'device' }))
  assert.equal(res.status, 400)
  assert.equal(audit.length, 0)
})

test('suggested — nurse allowed, writes on_device_ai.suggested', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', userRole: 'nurse', db: makeDbStub(audit) })
  const res = await post(app, 'suggested', validBody())
  assert.equal(res.status, 200)
  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.action, 'on_device_ai.suggested')
  assert.equal(audit[0]!.entityType, 'suggestion')
  assert.equal(audit[0]!.entityId, '11111111-1111-4111-8111-111111111111')
})

test('suggested — doctor allowed', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'doc-1', userRole: 'doctor', db: makeDbStub(audit) })
  const res = await post(app, 'suggested', validBody())
  assert.equal(res.status, 200)
  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.action, 'on_device_ai.suggested')
})

test('accepted + runOn=cloud-doctor-hitl — nurse REJECTED (403)', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', userRole: 'nurse', db: makeDbStub(audit) })
  const res = await post(app, 'accepted', validBody({ runOn: 'cloud-doctor-hitl' }))
  assert.equal(res.status, 403)
  assert.equal(audit.length, 0)
})

test('rejected + runOn=cloud-doctor-hitl — nurse REJECTED (403)', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', userRole: 'nurse', db: makeDbStub(audit) })
  const res = await post(app, 'rejected', validBody({ runOn: 'cloud-doctor-hitl' }))
  assert.equal(res.status, 403)
  assert.equal(audit.length, 0)
})

test('accepted + runOn=cloud-doctor-hitl — doctor ALLOWED', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'doc-1', userRole: 'doctor', db: makeDbStub(audit) })
  const res = await post(app, 'accepted', validBody({ runOn: 'cloud-doctor-hitl' }))
  assert.equal(res.status, 200)
  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.action, 'on_device_ai.accepted')
})

test('accepted + runOn=cloud-doctor-hitl — admin ALLOWED', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'admin-1', userRole: 'admin', db: makeDbStub(audit) })
  const res = await post(app, 'accepted', validBody({ runOn: 'cloud-doctor-hitl' }))
  assert.equal(res.status, 200)
  assert.equal(audit.length, 1)
})

test('accepted + runOn=device — nurse ALLOWED', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', userRole: 'nurse', db: makeDbStub(audit) })
  const res = await post(app, 'accepted', validBody({ runOn: 'device' }))
  assert.equal(res.status, 200)
  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.action, 'on_device_ai.accepted')
})

test('rejected + runOn=device — nurse ALLOWED', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'nurse-1', userRole: 'nurse', db: makeDbStub(audit) })
  const res = await post(app, 'rejected', validBody({ runOn: 'device' }))
  assert.equal(res.status, 200)
  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.action, 'on_device_ai.rejected')
})

test('edited + runOn=device — doctor ALLOWED, target_type=observation when observationId present', async () => {
  const audit: AuditCall[] = []
  const app = mount({ userId: 'doc-1', userRole: 'doctor', db: makeDbStub(audit) })
  const res = await post(
    app,
    'edited',
    validBody({
      runOn: 'device',
      observationId: 'obs-xyz',
      editedPayload: { corrected: true },
    }),
  )
  assert.equal(res.status, 200)
  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.action, 'on_device_ai.edited')
  assert.equal(audit[0]!.entityType, 'observation')
  assert.equal(audit[0]!.entityId, 'obs-xyz')
})
