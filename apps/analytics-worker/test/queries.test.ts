import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { QUERIES, isQueryId, validateQueryParams } from '@skids/shared'

test('QUERIES: exactly five canonical queries registered', () => {
  assert.equal(Object.keys(QUERIES).length, 5)
  for (const id of ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']) {
    assert.ok(QUERIES[id], `${id} is registered`)
    assert.equal(QUERIES[id].id, id)
  }
})

test('QUERIES: every query has title/description/columns', () => {
  for (const q of Object.values(QUERIES)) {
    assert.ok(q.title.length > 0, `${q.id} has title`)
    assert.ok(q.description.length > 0, `${q.id} has description`)
    assert.ok(q.columns.length > 0, `${q.id} has columns`)
  }
})

test('isQueryId: accepts Q1-Q5, rejects others', () => {
  assert.equal(isQueryId('Q1'), true)
  assert.equal(isQueryId('Q5'), true)
  assert.equal(isQueryId('Q6'), false)
  assert.equal(isQueryId('DROP'), false)
  assert.equal(isQueryId(''), false)
})

test('validateQueryParams: Q3 accepts missing optional params, applies defaults', () => {
  const p = validateQueryParams('Q3', {})
  assert.equal(p.campaign_code, null) // optional-string default
})

test('validateQueryParams: Q1 coerces days_back from string', () => {
  const p = validateQueryParams('Q1', { days_back: '14' as unknown as number })
  assert.equal(p.days_back, 14)
})

test('validateQueryParams: Q1 rejects non-numeric days_back', () => {
  assert.throws(() => validateQueryParams('Q1', { days_back: 'oops' as unknown as number }))
})

test('validateQueryParams: Q2 uses default days_back=7 when absent', () => {
  const p = validateQueryParams('Q2', {})
  assert.equal(p.days_back, 7)
})

test('validateQueryParams: optional-string accepts null', () => {
  const p = validateQueryParams('Q3', { campaign_code: null })
  assert.equal(p.campaign_code, null)
})

test('validateQueryParams: optional-string rejects non-string, non-null', () => {
  assert.throws(() => validateQueryParams('Q3', { campaign_code: 42 as unknown as string }))
})
