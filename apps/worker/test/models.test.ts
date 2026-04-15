// Route-level unit tests for GET /api/models/:modelId/:version/:shard.
// No real R2, no real DB — both are stubbed. Auth middleware is stubbed via
// a wrapper app that sets userId/userRole before delegating to modelsRoutes.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Hono } from 'hono'
import { MODEL_MANIFEST, modelR2Key } from '@skids/shared'
import { modelsRoutes } from '../src/routes/models'

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

function makeR2Stub(objects: Record<string, Uint8Array>) {
  return {
    get: async (key: string) => {
      const bytes = objects[key]
      if (!bytes) return null
      return { body: new Response(bytes as unknown as BodyInit).body }
    },
  }
}

function mountWithAuth(opts: {
  userId?: string
  userRole?: string
  db: unknown
}) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    if (!opts.userId) return c.json({ error: 'Unauthorized' }, 401)
    c.set('userId', opts.userId)
    c.set('userRole', opts.userRole ?? 'nurse')
    c.set('db', opts.db)
    await next()
  })
  app.route('/api/models', modelsRoutes as unknown as Hono)
  return app
}

function shardUrl(modelId: string, version: string, shard: string): string {
  return `/api/models/${encodeURIComponent(modelId)}/${encodeURIComponent(version)}/${encodeURIComponent(shard)}`
}

const validShard = MODEL_MANIFEST.shards[0]!.name
const validKey = modelR2Key(MODEL_MANIFEST, validShard)
const shardBytes = new Uint8Array([0xaa, 0xbb, 0xcc])

test('401 when unauthenticated', async () => {
  const audit: AuditCall[] = []
  const app = mountWithAuth({ db: makeDbStub(audit) })
  const res = await app.request(
    shardUrl(MODEL_MANIFEST.id, MODEL_MANIFEST.version, validShard),
    {},
    { R2_MODELS_BUCKET: makeR2Stub({ [validKey]: shardBytes }) },
  )
  assert.equal(res.status, 401)
  assert.equal(audit.length, 0)
})

test('404 when modelId does not match pinned manifest', async () => {
  const audit: AuditCall[] = []
  const app = mountWithAuth({ userId: 'nurse-1', db: makeDbStub(audit) })
  const res = await app.request(
    shardUrl('bogus/other-model', MODEL_MANIFEST.version, validShard),
    {},
    { R2_MODELS_BUCKET: makeR2Stub({ [validKey]: shardBytes }) },
  )
  assert.equal(res.status, 404)
  assert.equal(audit.length, 0)
})

test('404 when version does not match pinned manifest', async () => {
  const audit: AuditCall[] = []
  const app = mountWithAuth({ userId: 'nurse-1', db: makeDbStub(audit) })
  const res = await app.request(
    shardUrl(MODEL_MANIFEST.id, 'bogus-version', validShard),
    {},
    { R2_MODELS_BUCKET: makeR2Stub({ [validKey]: shardBytes }) },
  )
  assert.equal(res.status, 404)
  assert.equal(audit.length, 0)
})

test('404 when shard name is not in manifest (blocks path traversal)', async () => {
  const audit: AuditCall[] = []
  const app = mountWithAuth({ userId: 'nurse-1', db: makeDbStub(audit) })
  const res = await app.request(
    shardUrl(MODEL_MANIFEST.id, MODEL_MANIFEST.version, '../../../etc/passwd'),
    {},
    { R2_MODELS_BUCKET: makeR2Stub({ [validKey]: shardBytes }) },
  )
  assert.equal(res.status, 404)
  assert.equal(audit.length, 0)
})

test('404 when R2 object missing', async () => {
  const audit: AuditCall[] = []
  const app = mountWithAuth({ userId: 'nurse-1', db: makeDbStub(audit) })
  const res = await app.request(
    shardUrl(MODEL_MANIFEST.id, MODEL_MANIFEST.version, validShard),
    {},
    { R2_MODELS_BUCKET: makeR2Stub({}) },
  )
  assert.equal(res.status, 404)
  assert.equal(audit.length, 0)
})

test('happy path — nurse pulls shard, correct headers + bytes, audit log written', async () => {
  const audit: AuditCall[] = []
  const app = mountWithAuth({ userId: 'nurse-7', userRole: 'nurse', db: makeDbStub(audit) })
  const res = await app.request(
    shardUrl(MODEL_MANIFEST.id, MODEL_MANIFEST.version, validShard),
    {},
    { R2_MODELS_BUCKET: makeR2Stub({ [validKey]: shardBytes }) },
  )
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'application/octet-stream')
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff')
  const body = new Uint8Array(await res.arrayBuffer())
  assert.deepEqual(Array.from(body), Array.from(shardBytes))

  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.action, 'model.shard.fetched')
  assert.equal(audit[0]!.userId, 'nurse-7')
  assert.equal(audit[0]!.entityType, 'model_shard')
  assert.equal(audit[0]!.entityId, validShard)
  const details = JSON.parse(audit[0]!.details!)
  assert.equal(details.modelId, MODEL_MANIFEST.id)
  assert.equal(details.version, MODEL_MANIFEST.version)
  assert.equal(details.shard, validShard)
  assert.equal(typeof details.byteLength, 'number')
})

test('happy path — doctor also allowed (no role gating beyond authenticated)', async () => {
  const audit: AuditCall[] = []
  const app = mountWithAuth({ userId: 'doc-3', userRole: 'doctor', db: makeDbStub(audit) })
  const res = await app.request(
    shardUrl(MODEL_MANIFEST.id, MODEL_MANIFEST.version, validShard),
    {},
    { R2_MODELS_BUCKET: makeR2Stub({ [validKey]: shardBytes }) },
  )
  assert.equal(res.status, 200)
  assert.equal(audit.length, 1)
})
