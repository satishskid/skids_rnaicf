// Phase 03 — unit tests for the URL token integrity layer.
// Uses node:test (no new devDependencies). Web Crypto is available in Node >=20.
//
// Run:
//   pnpm --filter @skids/shared test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { issueToken, verifyToken, hashRawToken } from '../src/report-token'

const SIGNING_KEY = 'test-signing-key-do-not-use-in-prod'
const REPORT_ID = 'rpt_01HABCDEF0123456'

test('issueToken — returns raw, hash, hmac, urlParam with the right shape', async () => {
  const t = await issueToken(SIGNING_KEY, REPORT_ID)
  assert.match(t.raw, /^[A-Za-z0-9_-]+$/)
  assert.equal(t.hash.length, 64) // sha256 hex
  assert.match(t.hash, /^[0-9a-f]+$/)
  assert.match(t.hmac, /^[A-Za-z0-9_-]+$/)
  assert.equal(t.urlParam, `${t.raw}.${t.hmac}`)
})

test('issueToken — two issuances differ (CSPRNG)', async () => {
  const a = await issueToken(SIGNING_KEY, REPORT_ID)
  const b = await issueToken(SIGNING_KEY, REPORT_ID)
  assert.notEqual(a.raw, b.raw)
  assert.notEqual(a.hash, b.hash)
  assert.notEqual(a.hmac, b.hmac)
})

test('verifyToken — round-trip succeeds and rederives the storage hash', async () => {
  const t = await issueToken(SIGNING_KEY, REPORT_ID)
  const v = await verifyToken(SIGNING_KEY, REPORT_ID, t.urlParam)
  assert.ok(v, 'verifyToken should return a result')
  assert.equal(v!.raw, t.raw)
  assert.equal(v!.hash, t.hash)
})

test('verifyToken — rejects mutated raw component', async () => {
  const t = await issueToken(SIGNING_KEY, REPORT_ID)
  // Flip one base64url char in the raw section (preserve total length).
  const mutated = (t.raw.startsWith('A') ? 'B' : 'A') + t.raw.slice(1) + '.' + t.hmac
  const v = await verifyToken(SIGNING_KEY, REPORT_ID, mutated)
  assert.equal(v, null)
})

test('verifyToken — rejects mutated hmac component', async () => {
  const t = await issueToken(SIGNING_KEY, REPORT_ID)
  const mutated = t.raw + '.' + (t.hmac.startsWith('A') ? 'B' : 'A') + t.hmac.slice(1)
  const v = await verifyToken(SIGNING_KEY, REPORT_ID, mutated)
  assert.equal(v, null)
})

test('verifyToken — rejects wrong signing key', async () => {
  const t = await issueToken(SIGNING_KEY, REPORT_ID)
  const v = await verifyToken('different-key', REPORT_ID, t.urlParam)
  assert.equal(v, null)
})

test('verifyToken — rejects HMAC issued for a different reportId (replay)', async () => {
  const t = await issueToken(SIGNING_KEY, REPORT_ID)
  const v = await verifyToken(SIGNING_KEY, 'rpt_other_report', t.urlParam)
  assert.equal(v, null)
})

test('verifyToken — rejects malformed inputs', async () => {
  assert.equal(await verifyToken(SIGNING_KEY, REPORT_ID, ''), null)
  assert.equal(await verifyToken(SIGNING_KEY, REPORT_ID, 'no-dot-here'), null)
  assert.equal(await verifyToken(SIGNING_KEY, REPORT_ID, '.justhmac'), null)
  assert.equal(await verifyToken(SIGNING_KEY, REPORT_ID, 'rawonly.'), null)
  assert.equal(await verifyToken('', REPORT_ID, 'a.b'), null)
})

test('hashRawToken — matches the hash produced by issueToken', async () => {
  const t = await issueToken(SIGNING_KEY, REPORT_ID)
  assert.equal(await hashRawToken(t.raw), t.hash)
})
