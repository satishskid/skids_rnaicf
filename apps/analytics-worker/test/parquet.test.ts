import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { partitionKey, splitIntoParts, normaliseRow } from '../src/parquet'
import type { ExportTableConfig } from '../src/types'

const OBS: ExportTableConfig = {
  name: 'observations',
  mode: 'incremental',
  partitionBy: 'campaign_code',
  cursorCol: 'created_at',
}
const AI: ExportTableConfig = { name: 'ai_usage', mode: 'incremental', partitionBy: null, cursorCol: 'created_at' }

test('partitionKey: campaign-partitioned includes campaign segment', () => {
  const k = partitionKey('v1', OBS, 'CAMP01', '2026-04-16', 0)
  assert.equal(k, 'v1/observations/campaign_code=CAMP01/dt=2026-04-16/part-0001.parquet')
})

test('partitionKey: non-partitioned skips campaign segment', () => {
  const k = partitionKey('v1', AI, null, '2026-04-16', 2)
  assert.equal(k, 'v1/ai_usage/dt=2026-04-16/part-0003.parquet')
})

test('splitIntoParts: small rows returns single part', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ id: i }))
  const parts = splitIntoParts(rows, 1024)
  assert.equal(parts.length, 1)
  assert.equal(parts[0].length, 100)
})

test('splitIntoParts: splits when over limit', () => {
  // 50 MiB / 1 MiB per row = 50 rows per part
  const rows = Array.from({ length: 120 }, (_, i) => ({ id: i }))
  const parts = splitIntoParts(rows, 1024 * 1024)
  assert.equal(parts.length, 3)
  assert.equal(parts[0].length, 50)
  assert.equal(parts[2].length, 20)
})

test('normaliseRow: objects become JSON strings, bigints become numbers', () => {
  const out = normaliseRow({
    id: '1',
    meta: { foo: 'bar' },
    count: 42n,
    missing: undefined,
    nullish: null,
  })
  assert.equal(out.id, '1')
  assert.equal(out.meta, '{"foo":"bar"}')
  assert.equal(out.count, 42)
  assert.equal(out.missing, null)
  assert.equal(out.nullish, null)
})
