// Cohort-level analytics and prevalence report computation
// Used by authority dashboard for campaign-wide reporting
// Ported from V2 — adapted to V3 types

import type { Child, Observation, Severity, ModuleType } from './types'
import { MODULE_CONFIGS } from './modules'
import {
  computeFourDReport,
  FOUR_D_CONDITIONS,
  FOUR_D_CATEGORY_LABELS,
  type FourDCategory,
  type FourDReport,
} from './four-d-mapping'
import { CONDITION_DESCRIPTIONS } from './condition-descriptions'

// ============================================
// TYPES
// ============================================

export interface CohortAnalytics {
  totalChildren: number
  totalScreened: number
  totalFullyScreened: number
  totalObservations: number
  riskBreakdown: { noRisk: number; possibleRisk: number; highRisk: number }
  moduleCompletion: Array<{
    moduleType: string
    moduleName: string
    /** Distinct children screened on this module. SQL `COUNT(DISTINCT child_id) AS total`. */
    total: number
    /** @deprecated alias of total — aggregator still writes this. */
    count: number
    percentage: number
  }>
  categoryBreakdown: Array<{
    category: FourDCategory
    label: string
    present: number
    absent: number
    notScreened: number
  }>
  topConditions: Array<{
    conditionId: string
    conditionName: string
    category: FourDCategory
    count: number
    prevalence: number
  }>
}

export interface PrevalenceReport {
  generatedAt: string
  campaignCode: string
  totalScreened: number
  conditions: Array<{
    conditionId: string
    conditionName: string
    name: string
    category: FourDCategory
    icdCode?: string
    description: string
    count: number
    prevalence: number
    severityBreakdown: Record<string, number>
  }>
  categoryPrevalence: Array<{
    category: FourDCategory
    label: string
    totalConditionsFound: number
    conditionsFound: number
    childrenAffected: number
    prevalence: number
  }>
}

// ============================================
// HELPERS
// ============================================

function groupObservationsByChild(
  observations: Observation[]
): Record<string, Observation[]> {
  const groups: Record<string, Observation[]> = {}
  for (const obs of observations) {
    const childId = (obs.captureMetadata?.childId as string) || ''
    if (!childId) continue
    if (!groups[childId]) groups[childId] = []
    groups[childId].push(obs)
  }
  return groups
}

function computeAllFourDReports(
  children: Child[],
  observations: Observation[]
): Map<string, FourDReport> {
  const obsByChild = groupObservationsByChild(observations)
  const reports = new Map<string, FourDReport>()

  for (const child of children) {
    const childObs = obsByChild[child.id] || []
    if (childObs.length === 0) continue
    try {
      const report = computeFourDReport(child, childObs, 'System')
      reports.set(child.id, report)
    } catch {
      // Skip children whose report computation fails
    }
  }

  return reports
}

// ============================================
// COHORT ANALYTICS
// ============================================

export function computeCohortAnalytics(
  children: Child[],
  observations: Observation[],
  enabledModules: string[]
): CohortAnalytics {
  const obsByChild = groupObservationsByChild(observations)

  // Screening coverage
  const screenedChildren = children.filter(c => (obsByChild[c.id]?.length || 0) > 0)
  const fullyScreenedChildren = children.filter(c => {
    const childObs = obsByChild[c.id] || []
    const childModules = new Set(childObs.map(o => o.moduleType))
    return enabledModules.every(m => childModules.has(m as ModuleType))
  })

  // Risk breakdown across all observations
  const riskBreakdown = { noRisk: 0, possibleRisk: 0, highRisk: 0 }
  for (const obs of observations) {
    const risk = obs.aiAnnotations?.[0]?.riskCategory
    if (risk === 'no_risk') riskBreakdown.noRisk++
    else if (risk === 'possible_risk') riskBreakdown.possibleRisk++
    else if (risk === 'high_risk') riskBreakdown.highRisk++
  }

  // Module completion: unique children per module
  const moduleChildSets: Record<string, Set<string>> = {}
  for (const obs of observations) {
    const childId = (obs.captureMetadata?.childId as string) || ''
    if (!moduleChildSets[obs.moduleType]) moduleChildSets[obs.moduleType] = new Set()
    moduleChildSets[obs.moduleType].add(childId)
  }
  const moduleCompletion = enabledModules.map(mt => {
    const count = moduleChildSets[mt]?.size || 0
    const config = MODULE_CONFIGS.find(m => m.type === mt)
    return {
      moduleType: mt,
      moduleName: config?.name || mt,
      total: count,
      count,
      percentage: children.length > 0 ? Math.round((count / children.length) * 100) : 0,
    }
  })

  // 4D category breakdown (aggregate across all children)
  const reports = computeAllFourDReports(children, observations)
  const categoryAgg: Record<FourDCategory, { present: number; absent: number; notScreened: number }> = {
    defects: { present: 0, absent: 0, notScreened: 0 },
    delay: { present: 0, absent: 0, notScreened: 0 },
    disability: { present: 0, absent: 0, notScreened: 0 },
    deficiency: { present: 0, absent: 0, notScreened: 0 },
    behavioral: { present: 0, absent: 0, notScreened: 0 },
    immunization: { present: 0, absent: 0, notScreened: 0 },
    learning: { present: 0, absent: 0, notScreened: 0 },
  }
  for (const report of reports.values()) {
    for (const [cat, summary] of Object.entries(report.summary)) {
      const c = cat as FourDCategory
      categoryAgg[c].present += summary.present
      categoryAgg[c].absent += summary.absent
      categoryAgg[c].notScreened += summary.notScreened
    }
  }
  const categoryBreakdown = (Object.keys(categoryAgg) as FourDCategory[]).map(cat => ({
    category: cat,
    label: FOUR_D_CATEGORY_LABELS[cat],
    ...categoryAgg[cat],
  }))

  // Top conditions by prevalence
  const conditionCounts: Record<string, number> = {}
  for (const report of reports.values()) {
    for (const results of Object.values(report.categories)) {
      for (const result of results) {
        if (result.status === 'present') {
          conditionCounts[result.condition.id] = (conditionCounts[result.condition.id] || 0) + 1
        }
      }
    }
  }
  const topConditions = Object.entries(conditionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([condId, count]) => {
      const cond = FOUR_D_CONDITIONS.find(c => c.id === condId)!
      return {
        conditionId: condId,
        conditionName: cond.name,
        category: cond.category,
        count,
        prevalence: screenedChildren.length > 0
          ? Math.round((count / screenedChildren.length) * 1000) / 10
          : 0,
      }
    })

  return {
    totalChildren: children.length,
    totalScreened: screenedChildren.length,
    totalFullyScreened: fullyScreenedChildren.length,
    totalObservations: observations.length,
    riskBreakdown,
    moduleCompletion,
    categoryBreakdown,
    topConditions,
  }
}

// ============================================
// PREVALENCE REPORT
// ============================================

export function computePrevalenceReport(
  children: Child[],
  observations: Observation[],
  campaignCode: string
): PrevalenceReport {
  const reports = computeAllFourDReports(children, observations)
  const screenedCount = reports.size

  // Per-condition prevalence
  const conditionData: Record<string, {
    count: number
    severityBreakdown: Record<string, number>
  }> = {}

  for (const cond of FOUR_D_CONDITIONS) {
    conditionData[cond.id] = { count: 0, severityBreakdown: {} }
  }

  // Collect chip severities per child for severity breakdown
  const obsByChild = groupObservationsByChild(observations)

  for (const report of reports.values()) {
    const childObs = obsByChild[report.childId] || []
    // Collect all chip severities for this child
    const chipSevMap: Record<string, Severity> = {}
    for (const obs of childObs) {
      const sevs = obs.annotationData?.chipSeverities || {}
      Object.entries(sevs).forEach(([chipId, sev]) => {
        chipSevMap[chipId] = sev as Severity
      })
    }

    for (const results of Object.values(report.categories)) {
      for (const result of results) {
        if (result.status === 'present') {
          const cd = conditionData[result.condition.id]
          cd.count++
          // Find severity from the matched chip
          const matchedChip = result.condition.chipIds.find(cid => chipSevMap[cid])
          const sev = matchedChip ? (chipSevMap[matchedChip] || 'normal') : (result.severity || 'normal')
          cd.severityBreakdown[sev] = (cd.severityBreakdown[sev] || 0) + 1
        }
      }
    }
  }

  const conditions = FOUR_D_CONDITIONS.map(cond => ({
    conditionId: cond.id,
    conditionName: cond.name,
    name: cond.name,
    category: cond.category,
    icdCode: cond.icdCode,
    description: CONDITION_DESCRIPTIONS[cond.id] || '',
    count: conditionData[cond.id].count,
    prevalence: screenedCount > 0
      ? Math.round((conditionData[cond.id].count / screenedCount) * 1000) / 10
      : 0,
    severityBreakdown: conditionData[cond.id].severityBreakdown,
  }))

  // Category-level prevalence
  const categoryMap: Record<FourDCategory, { conditionsFound: Set<string>; childrenAffected: Set<string> }> = {
    defects: { conditionsFound: new Set(), childrenAffected: new Set() },
    delay: { conditionsFound: new Set(), childrenAffected: new Set() },
    disability: { conditionsFound: new Set(), childrenAffected: new Set() },
    deficiency: { conditionsFound: new Set(), childrenAffected: new Set() },
    behavioral: { conditionsFound: new Set(), childrenAffected: new Set() },
    immunization: { conditionsFound: new Set(), childrenAffected: new Set() },
    learning: { conditionsFound: new Set(), childrenAffected: new Set() },
  }

  for (const [childId, report] of reports.entries()) {
    for (const [cat, results] of Object.entries(report.categories)) {
      for (const result of results) {
        if (result.status === 'present') {
          categoryMap[cat as FourDCategory].conditionsFound.add(result.condition.id)
          categoryMap[cat as FourDCategory].childrenAffected.add(childId)
        }
      }
    }
  }

  const categoryPrevalence = (Object.keys(categoryMap) as FourDCategory[]).map(cat => ({
    category: cat,
    label: FOUR_D_CATEGORY_LABELS[cat],
    totalConditionsFound: categoryMap[cat].conditionsFound.size,
    conditionsFound: categoryMap[cat].conditionsFound.size,
    childrenAffected: categoryMap[cat].childrenAffected.size,
    prevalence: screenedCount > 0
      ? Math.round((categoryMap[cat].childrenAffected.size / screenedCount) * 1000) / 10
      : 0,
  }))

  return {
    generatedAt: new Date().toISOString(),
    campaignCode,
    totalScreened: screenedCount,
    conditions,
    categoryPrevalence,
  }
}
