import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { initResvg, renderTemplate } from '../src/render'
import type { ParentScreeningReportData } from '../src/types'

const require = createRequire(import.meta.url)

// resvg-wasm ships its .wasm next to the JS entry; locate via require.resolve
// so this test does not depend on a particular package layout.
const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm')
const wasmBytes = readFileSync(wasmPath)
await initResvg(wasmBytes.buffer.slice(wasmBytes.byteOffset, wasmBytes.byteOffset + wasmBytes.byteLength) as ArrayBuffer)

const mockChildData: ParentScreeningReportData = {
  child: { name: 'Aarav Sharma', dob: '2018-06-12', sex: 'M', campaignCode: 'BLR-2026-Q2' },
  screenedAt: '2026-04-12',
  screenerName: 'Nurse Priya K.',
  findings: [
    { category: 'defects', label: 'Red reflex absent (left eye)', severity: 'moderate' },
    { category: 'delay', label: 'Speech milestones delayed', severity: 'mild' },
    { category: 'deficiency', label: 'Low haemoglobin (suspected)', severity: 'mild' },
    { category: 'immunization', label: 'DTP booster overdue', severity: 'moderate' },
  ],
  disclaimer: 'This is a screening summary, not a diagnosis. Please consult a paediatrician.',
  qrPayload: 'https://skids.health/r/abc123def456',
}

const PDF_MAGIC = '%PDF-'

function assertPdf(bytes: Uint8Array, label: string) {
  assert.ok(bytes instanceof Uint8Array, `${label}: result is Uint8Array`)
  assert.ok(bytes.length > 1024, `${label}: bytes.length > 1KB (got ${bytes.length})`)
  const head = new TextDecoder().decode(bytes.slice(0, 5))
  assert.equal(head, PDF_MAGIC, `${label}: starts with %PDF-`)
}

test('renderTemplate parent-screening-report en', async () => {
  const bytes = await renderTemplate('parent-screening-report', mockChildData, 'en')
  assertPdf(bytes, 'en')
})

test('renderTemplate parent-screening-report hi', async () => {
  const hiData: ParentScreeningReportData = {
    ...mockChildData,
    child: { ...mockChildData.child, name: 'आरव शर्मा' },
    findings: [
      { category: 'defects', label: 'बायीं आँख में रेड रिफ्लेक्स अनुपस्थित', severity: 'moderate' },
      { category: 'delay', label: 'भाषा विकास में देरी', severity: 'mild' },
    ],
    disclaimer: 'यह केवल स्क्रीनिंग सारांश है, निदान नहीं। कृपया बाल रोग विशेषज्ञ से परामर्श करें।',
  }
  const bytes = await renderTemplate('parent-screening-report', hiData, 'hi')
  assertPdf(bytes, 'hi')
})
