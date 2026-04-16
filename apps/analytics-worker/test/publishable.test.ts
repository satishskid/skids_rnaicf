import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { buildPublishableSql, PUBLISHABLE_VIEWS } from '../src/publishable'

test('publishable: exactly 5 views declared', () => {
  assert.equal(PUBLISHABLE_VIEWS.length, 5)
})

test('publishable: SQL references all 5 views with COPY TO', () => {
  const sql = buildPublishableSql({
    isoDate: '2026-04-16',
    s3Endpoint: 'https://acc.r2.cloudflarestorage.com',
    s3KeyId: 'KEY',
    s3Secret: 'SECRET',
    bucket: 'skids-analytics',
  })
  for (const view of PUBLISHABLE_VIEWS) {
    assert.ok(sql.includes(`COPY (`), 'includes COPY')
    assert.ok(sql.includes(view), `references view ${view}`)
    assert.ok(sql.includes(`/${view}/dt=2026-04-16/`), `${view} uses dated partition`)
  }
})

test('publishable: SQL drops name/dob/phone from children', () => {
  const sql = buildPublishableSql({
    isoDate: '2026-04-16',
    s3Endpoint: 'https://x',
    s3KeyId: 'K',
    s3Secret: 'S',
    bucket: 'b',
  })
  // The publishable_children view should not emit `name`, `phone`, or raw
  // `dob`. We don't want a SELECT that includes those identifiers.
  const childrenBlock = sql.match(/publishable_children[\s\S]*?COPY/)?.[0] ?? sql
  assert.ok(!/SELECT[\s\S]+?\bname\b/.test(childrenBlock), 'no name column')
  assert.ok(!/SELECT[\s\S]+?\bphone\b/.test(childrenBlock), 'no phone column')
  assert.ok(sql.includes('age_months_band'), 'bands age instead of dob')
})

test('publishable: SQL uses zstd compression + parquet format', () => {
  const sql = buildPublishableSql({
    isoDate: '2026-04-16',
    s3Endpoint: 'https://x',
    s3KeyId: 'K',
    s3Secret: 'S',
    bucket: 'b',
  })
  assert.ok(sql.includes('FORMAT PARQUET'))
  assert.ok(sql.includes('COMPRESSION ZSTD'))
})
