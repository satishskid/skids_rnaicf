// Phase 03 — fixture for the cron pre-warm handler.
//
// Tiny, generic, no PHI. Used only to exercise the satori + resvg-wasm + pdf-lib
// pipeline so its WASM module + font cache stay hot in Worker memory. The
// rendered bytes are discarded; nothing is written to R2 or the DB.

import type { ParentScreeningReportData } from '@skids/pdf-templates'

export const PREWARM_PARENT_SCREENING_DATA: ParentScreeningReportData = {
  child: { name: 'Sample Child', dob: '2018-01-01', sex: 'O', campaignCode: 'PREWARM' },
  screenedAt: '2026-04-15',
  screenerName: 'Sample Screener',
  findings: [
    { category: 'defects', label: 'Sample finding', severity: 'normal' },
  ],
  disclaimer: 'Sample disclaimer for pre-warm; not a real report.',
  qrPayload: 'prewarm',
}
