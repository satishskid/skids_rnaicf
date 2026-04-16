import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { EXPORT_TABLES, findTable } from '../src/tables'

test('EXPORT_TABLES: every table has a sensible config', () => {
  for (const t of EXPORT_TABLES) {
    assert.ok(t.name.length > 0, `table has name: ${JSON.stringify(t)}`)
    assert.ok(['snapshot', 'incremental'].includes(t.mode), `valid mode for ${t.name}`)
    if (t.mode === 'incremental') {
      assert.ok(t.cursorCol, `incremental table ${t.name} must have cursorCol`)
    }
  }
})

test('EXPORT_TABLES: no duplicate table names', () => {
  const names = EXPORT_TABLES.map(t => t.name)
  assert.equal(new Set(names).size, names.length)
})

test('EXPORT_TABLES: observations is campaign-partitioned', () => {
  const obs = findTable('observations')
  assert.ok(obs)
  assert.equal(obs!.partitionBy, 'campaign_code')
  assert.equal(obs!.mode, 'incremental')
})

test('EXPORT_TABLES: audit_log is present (Phase 04 catch-up)', () => {
  assert.ok(findTable('audit_log'), 'audit_log should be in EXPORT_TABLES after migration 0004')
})

test('EXPORT_TABLES: campaign_progress is intentionally absent', () => {
  // See tables.ts docstring — it was in the spec but never migrated.
  assert.equal(findTable('campaign_progress'), undefined)
})
