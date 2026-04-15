// Phase 02a-web — same-origin model shard serving.
//
// GET /api/models/:modelId/:version/:shard
//
// Streams LFM2.5-VL-450M weight shards from the R2 skids-models bucket to
// authenticated browsers. The pinned manifest (@skids/shared) gates every
// request: any modelId/version/shard that doesn't match the literal const
// returns 404. This prevents the route from becoming a generic file-serving
// proxy and blocks silent upgrades via URL manipulation.
//
// Design notes:
//   - Auth: session required (nurse or doctor). Anonymous weight downloads
//     are not wanted; users must be authenticated into SKIDS to pull LFM weights.
//   - No rate limiting: a nurse pulls once per device (OPFS caches thereafter).
//   - Audit log: `model.shard.fetched` on success.
//   - Cache: immutable (weights are content-addressable by version).

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { MODEL_MANIFEST, findShard, modelR2Key } from '@skids/shared'
import { logAudit } from './audit-log'

export const modelsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

modelsRoutes.get('/:modelId/:version/:shard', async (c) => {
  const { modelId, version, shard } = c.req.param()

  if (modelId !== MODEL_MANIFEST.id) {
    return c.json({ error: 'Unknown model' }, 404)
  }
  if (version !== MODEL_MANIFEST.version) {
    return c.json({ error: 'Unknown model version' }, 404)
  }
  const descriptor = findShard(MODEL_MANIFEST, shard)
  if (!descriptor) {
    return c.json({ error: 'Unknown shard' }, 404)
  }

  const bucket = c.env.R2_MODELS_BUCKET
  if (!bucket) {
    return c.json({ error: 'Model bucket not configured' }, 500)
  }

  const key = modelR2Key(MODEL_MANIFEST, shard)
  const obj = await bucket.get(key)
  if (!obj) {
    return c.json({ error: 'Model shard not found' }, 404)
  }

  const userId = c.get('userId')
  if (userId) {
    await logAudit(c.get('db'), {
      userId,
      action: 'model.shard.fetched',
      entityType: 'model_shard',
      entityId: shard,
      details: JSON.stringify({
        modelId,
        version,
        shard,
        byteLength: descriptor.sizeBytes,
      }),
    })
  }

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': String(descriptor.sizeBytes),
    },
  })
})
