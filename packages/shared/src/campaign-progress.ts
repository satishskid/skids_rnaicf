// Campaign progress computation for admin dashboard
// Computes pipeline stages, nurse activity, module progress, and review breakdown
// Ported from V2 — adapted to V3 types

import type { ClinicianReview } from './types'
import { MODULE_CONFIGS } from './modules'
import type { SyncedObservation } from './observation-utils'

// ============================================
// TYPES
// ============================================

export interface PipelineStage {
  name: string
  count: number
  percentage: number
  color: string
}

export interface NurseActivity {
  nurseName: string
  childrenScreened: number
  observationsCreated: number
  lastActiveAt: string
}

export interface ModuleProgress {
  moduleType: string
  moduleName: string
  completed: number
  total: number
  percentage: number
}

// Canonical definition lives in ./types; re-exported here for source-compat
// with existing consumers that imported it from this module.
export type { ChildScreeningStatus } from './types'
import type { ChildScreeningStatus } from './types'

export interface ChildProgress {
  childId: string
  childName: string
  status: ChildScreeningStatus
  completedModules: string[]
  totalModules: number
  retakeModules: string[]
  hasReferral: boolean
  observationCount: number
}

export interface CampaignProgress {
  totalChildren: number
  registeredChildren: number
  screenedChildren: number
  fullyScreenedChildren: number
  reviewedChildren: number
  referredChildren: number
  completedChildren: number

  childProgress: ChildProgress[]
  pipeline: PipelineStage[]
  nurseActivity: NurseActivity[]
  moduleProgress: ModuleProgress[]
  reviewBreakdown: {
    approved: number
    referred: number
    followUp: number
    discharged: number
    pending: number
  }
  screeningRate: {
    today: number
    thisWeek: number
    total: number
  }
}

// ============================================
// HELPERS
// ============================================

function getModuleName(moduleType: string): string {
  const config = MODULE_CONFIGS.find(m => m.type === moduleType)
  return config ? config.name : moduleType
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return d >= weekAgo && d <= now
}

// ============================================
// MAIN COMPUTATION
// ============================================

export function computeCampaignDashboard(
  children: Array<{ id: string; name: string }>,
  observations: SyncedObservation[],
  reviews: Record<string, ClinicianReview>,
  enabledModules: string[],
): CampaignProgress {
  const total = children.length
  if (total === 0) {
    return emptyProgress()
  }

  // Group observations by child
  const obsByChild: Record<string, SyncedObservation[]> = {}
  for (const obs of observations) {
    if (!obsByChild[obs.childId]) obsByChild[obs.childId] = []
    obsByChild[obs.childId].push(obs)
  }

  // Count children at each stage
  let screened = 0
  let fullyScreened = 0
  let reviewed = 0
  let referred = 0
  let completed = 0

  const childProgressList: ChildProgress[] = []

  for (const child of children) {
    const childObs = obsByChild[child.id] || []
    const completedModules = [...new Set(childObs.map(o => o.moduleType))]
    const allModulesDone = enabledModules.every(m => completedModules.includes(m))

    // Review analysis
    const hasAnyReview = childObs.some(o => reviews[o.id])
    const allReviewed = childObs.length > 0 && childObs.every(o => reviews[o.id])
    const hasReferral = childObs.some(o => reviews[o.id]?.decision === 'refer')
    const hasRetake = childObs.some(o => reviews[o.id]?.decision === 'retake')
    const hasFollowUp = childObs.some(o => reviews[o.id]?.decision === 'follow_up')
    const retakeModules = childObs
      .filter(o => reviews[o.id]?.decision === 'retake')
      .map(o => o.moduleType)

    // Determine lifecycle status
    let status: ChildScreeningStatus = 'to_screen'
    if (childObs.length === 0) {
      status = 'to_screen'
    } else if (hasRetake) {
      status = 'retake'
    } else if (hasReferral && allReviewed) {
      status = 'referred'
    } else if (allReviewed && !hasFollowUp) {
      status = 'complete'
    } else if (hasAnyReview || allModulesDone) {
      status = 'under_review'
    } else if (allModulesDone) {
      status = 'screened'
    } else {
      status = 'in_progress'
    }

    // Update aggregate counts
    if (childObs.length > 0) screened++
    if (allModulesDone) fullyScreened++
    if (allReviewed) reviewed++
    if (hasReferral) referred++
    if (allReviewed && !hasFollowUp) completed++

    childProgressList.push({
      childId: child.id,
      childName: child.name,
      status,
      completedModules,
      totalModules: enabledModules.length,
      retakeModules,
      hasReferral,
      observationCount: childObs.length,
    })
  }

  // Pipeline stages
  const pipeline: PipelineStage[] = [
    { name: 'Registered', count: total, percentage: 100, color: '#94a3b8' },
    { name: 'Screened', count: screened, percentage: pct(screened, total), color: '#3b82f6' },
    { name: 'Fully Screened', count: fullyScreened, percentage: pct(fullyScreened, total), color: '#6366f1' },
    { name: 'Reviewed', count: reviewed, percentage: pct(reviewed, total), color: '#22c55e' },
    { name: 'Completed', count: completed, percentage: pct(completed, total), color: '#10b981' },
  ]

  // Nurse activity
  const nurseMap: Record<string, { children: Set<string>; obsCount: number; lastActive: string }> = {}
  for (const obs of observations) {
    const nurse = obs._nurseName || 'Unknown'
    if (!nurseMap[nurse]) {
      nurseMap[nurse] = { children: new Set(), obsCount: 0, lastActive: obs.timestamp }
    }
    nurseMap[nurse].children.add(obs.childId)
    nurseMap[nurse].obsCount++
    if (obs.timestamp > nurseMap[nurse].lastActive) {
      nurseMap[nurse].lastActive = obs.timestamp
    }
  }
  const nurseActivity: NurseActivity[] = Object.entries(nurseMap)
    .map(([name, data]) => ({
      nurseName: name,
      childrenScreened: data.children.size,
      observationsCreated: data.obsCount,
      lastActiveAt: data.lastActive,
    }))
    .sort((a, b) => b.observationsCreated - a.observationsCreated)

  // Module progress
  const moduleProgress: ModuleProgress[] = enabledModules.map(moduleType => {
    const childrenWithModule = new Set(
      observations.filter(o => o.moduleType === moduleType).map(o => o.childId)
    )
    return {
      moduleType,
      moduleName: getModuleName(moduleType),
      completed: childrenWithModule.size,
      total,
      percentage: pct(childrenWithModule.size, total),
    }
  })

  // Review breakdown
  const reviewValues = Object.values(reviews)
  const reviewBreakdown = {
    approved: reviewValues.filter(r => r.decision === 'approve').length,
    referred: reviewValues.filter(r => r.decision === 'refer').length,
    followUp: reviewValues.filter(r => r.decision === 'follow_up').length,
    discharged: reviewValues.filter(r => r.decision === 'discharge').length,
    pending: observations.length - reviewValues.length,
  }

  // Screening rate
  const screeningRate = {
    today: observations.filter(o => isToday(o.timestamp)).length,
    thisWeek: observations.filter(o => isThisWeek(o.timestamp)).length,
    total: observations.length,
  }

  return {
    totalChildren: total,
    registeredChildren: total,
    screenedChildren: screened,
    fullyScreenedChildren: fullyScreened,
    reviewedChildren: reviewed,
    referredChildren: referred,
    completedChildren: completed,
    childProgress: childProgressList,
    pipeline,
    nurseActivity,
    moduleProgress,
    reviewBreakdown,
    screeningRate,
  }
}

// ============================================
// UTILITIES
// ============================================

function pct(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

function emptyProgress(): CampaignProgress {
  return {
    totalChildren: 0,
    registeredChildren: 0,
    screenedChildren: 0,
    fullyScreenedChildren: 0,
    reviewedChildren: 0,
    referredChildren: 0,
    completedChildren: 0,
    childProgress: [],
    pipeline: [
      { name: 'Registered', count: 0, percentage: 0, color: '#94a3b8' },
      { name: 'Screened', count: 0, percentage: 0, color: '#3b82f6' },
      { name: 'Fully Screened', count: 0, percentage: 0, color: '#6366f1' },
      { name: 'Reviewed', count: 0, percentage: 0, color: '#22c55e' },
      { name: 'Completed', count: 0, percentage: 0, color: '#10b981' },
    ],
    nurseActivity: [],
    moduleProgress: [],
    reviewBreakdown: { approved: 0, referred: 0, followUp: 0, discharged: 0, pending: 0 },
    screeningRate: { today: 0, thisWeek: 0, total: 0 },
  }
}
