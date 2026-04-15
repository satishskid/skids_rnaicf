import type { FourDCategory } from '@skids/shared'

export const TEMPLATE_VERSION = '2026-04-15.v1'

export type RenderLocale = 'en' | 'hi' | 'mr' | 'bn' | 'ta' | 'te' | 'kn' | 'ml' | 'gu' | 'pa'

export type TemplateName = 'parent-screening-report'

export interface ParentScreeningReportFinding {
  category: FourDCategory
  label: string
  severity: 'normal' | 'mild' | 'moderate' | 'severe'
  notes?: string
}

export interface ParentScreeningReportData {
  child: {
    name: string
    dob: string
    sex: 'M' | 'F' | 'O'
    campaignCode: string
  }
  screenedAt: string
  screenerName: string
  findings: ParentScreeningReportFinding[]
  disclaimer: string
  qrPayload: string
}

export type TemplateDataMap = {
  'parent-screening-report': ParentScreeningReportData
}

export type TemplateData<T extends TemplateName> = TemplateDataMap[T]
