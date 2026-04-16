// Phase 03 — typed contract + Zod validator for POST /api/reports/render.
// One source of truth for both the worker route and any caller (web admin
// tooling, ops scripts).

import { z } from 'zod'

// Bumped on any breaking template change. Part of the report_renders cache_key
// hash so old PDFs auto-invalidate.
export const REPORT_RENDER_INPUT_VERSION = '2026-04-15.v1'

export const REPORT_RENDER_LOCALES = ['en', 'hi'] as const
export type ReportRenderLocale = (typeof REPORT_RENDER_LOCALES)[number]

export const REPORT_TEMPLATE_NAMES = ['parent-screening-report'] as const
export type ReportTemplateName = (typeof REPORT_TEMPLATE_NAMES)[number]

const parentScreeningReportFinding = z.object({
  category: z.enum(['defects', 'delay', 'disability', 'deficiency', 'behavioral', 'immunization', 'learning']),
  label: z.string().min(1).max(200),
  severity: z.enum(['normal', 'mild', 'moderate', 'severe']),
  notes: z.string().max(1000).optional(),
})

const parentScreeningReportData = z.object({
  child: z.object({
    name: z.string().min(1).max(120),
    dob: z.string().min(1),
    sex: z.enum(['M', 'F', 'O']),
    campaignCode: z.string().min(1).max(64),
  }),
  screenedAt: z.string().min(1),
  screenerName: z.string().min(1).max(120),
  findings: z.array(parentScreeningReportFinding).max(64),
  disclaimer: z.string().min(1).max(2000),
  qrPayload: z.string().max(512),
})

export const reportRenderInputSchema = z.object({
  templateName: z.enum(REPORT_TEMPLATE_NAMES),
  data: parentScreeningReportData,
  locale: z.enum(REPORT_RENDER_LOCALES),
  // child_id + campaign_code are needed for the report_access_tokens row but
  // are not part of the renderable payload — passed as siblings so we can
  // FK-link without trusting the renderable `data.child.campaignCode` alone.
  childId: z.string().min(1).max(64),
  campaignCode: z.string().min(1).max(64),
  reportType: z.enum(['fourd', 'child', 'parent']),
  expiresInDays: z.number().int().min(1).max(365).default(30),
  rateLimit: z.number().int().min(1).max(10000).default(60),
})

export type ReportRenderInput = z.infer<typeof reportRenderInputSchema>
