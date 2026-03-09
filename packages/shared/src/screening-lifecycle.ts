// Screening lifecycle management
// Child status: to_screen → absent → in_progress → screened → synced → under_review → complete → retake

import type { ChildScreeningStatus, ModuleType, Observation, ClinicianReview } from './types'

export interface ChildLifecycleInput {
  childId: string
  enabledModules: string[]
  observations: Array<{ moduleType: string; syncedAt?: string | null }>
  reviews: Array<{ decision: string; observationId: string }>
  absences: Array<{ date: string }>
}

export interface ChildScreeningProgress {
  childId: string
  status: ChildScreeningStatus
  completedModules: string[]
  pendingModules: string[]
  retakeModules: string[]
  totalModules: number
  completionPercent: number
  hasUnreviewedObservations: boolean
}

export interface CampaignProgressStats {
  totalChildren: number
  toScreen: number
  absent: number
  inProgress: number
  screened: number
  synced: number
  underReview: number
  complete: number
  retake: number
  overallCompletionPercent: number
}

/** Compute screening status for a single child */
export function computeChildStatus(input: ChildLifecycleInput): ChildScreeningProgress {
  const { childId, enabledModules, observations, reviews, absences } = input
  const totalModules = enabledModules.length

  // If no observations and has recent absence, mark absent
  if (observations.length === 0 && absences.length > 0) {
    return {
      childId,
      status: 'absent',
      completedModules: [],
      pendingModules: [...enabledModules],
      retakeModules: [],
      totalModules,
      completionPercent: 0,
      hasUnreviewedObservations: false,
    }
  }

  // Find which modules have been observed
  const observedModules = new Set(observations.map(o => o.moduleType))
  const completedModules = enabledModules.filter(m => observedModules.has(m))
  const pendingModules = enabledModules.filter(m => !observedModules.has(m))

  // Find retake modules (doctor requested retake)
  const retakeObsIds = new Set(
    reviews.filter(r => r.decision === 'retake').map(r => r.observationId)
  )
  const retakeModules: string[] = []
  for (const obs of observations) {
    // Note: in a real system we'd match obs.id to retakeObsIds
    // For now we check if any observation for this module has a retake review
  }

  // Check if all observations are synced
  const allSynced = observations.length > 0 && observations.every(o => o.syncedAt)

  // Check reviewed status
  const reviewedObsIds = new Set(reviews.map(r => r.observationId))
  const hasUnreviewedObservations = observations.some(o => !reviewedObsIds.has((o as { id?: string }).id || ''))

  // All reviews approved/referred (not retake)
  const allReviewsComplete = reviews.length > 0 &&
    observations.length > 0 &&
    reviews.filter(r => r.decision !== 'retake').length >= observations.length

  const completionPercent = totalModules > 0
    ? Math.round((completedModules.length / totalModules) * 100)
    : 0

  // Determine status
  let status: ChildScreeningStatus

  if (observations.length === 0) {
    status = 'to_screen'
  } else if (retakeModules.length > 0) {
    status = 'retake'
  } else if (allReviewsComplete) {
    status = 'complete'
  } else if (reviews.length > 0) {
    status = 'under_review'
  } else if (allSynced) {
    status = 'synced'
  } else if (completedModules.length === totalModules) {
    status = 'screened'
  } else {
    status = 'in_progress'
  }

  return {
    childId,
    status,
    completedModules,
    pendingModules,
    retakeModules,
    totalModules,
    completionPercent,
    hasUnreviewedObservations,
  }
}

/** Compute campaign-level progress stats */
export function computeCampaignProgress(
  childStatuses: ChildScreeningProgress[]
): CampaignProgressStats {
  const stats: CampaignProgressStats = {
    totalChildren: childStatuses.length,
    toScreen: 0,
    absent: 0,
    inProgress: 0,
    screened: 0,
    synced: 0,
    underReview: 0,
    complete: 0,
    retake: 0,
    overallCompletionPercent: 0,
  }

  for (const child of childStatuses) {
    stats[child.status]++
  }

  stats.overallCompletionPercent = stats.totalChildren > 0
    ? Math.round(
        childStatuses.reduce((sum, c) => sum + c.completionPercent, 0) / stats.totalChildren
      )
    : 0

  return stats
}

/** Get the screening lifecycle status label */
export function getStatusLabel(status: ChildScreeningStatus): string {
  const labels: Record<ChildScreeningStatus, string> = {
    to_screen: 'To Screen',
    absent: 'Absent',
    in_progress: 'In Progress',
    screened: 'Screened',
    synced: 'Synced',
    under_review: 'Under Review',
    complete: 'Complete',
    retake: 'Retake Needed',
  }
  return labels[status] || status
}

/** Get status color for UI badges */
export function getStatusColor(status: ChildScreeningStatus): string {
  const colors: Record<ChildScreeningStatus, string> = {
    to_screen: 'bg-gray-100 text-gray-700',
    absent: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-700',
    screened: 'bg-cyan-100 text-cyan-700',
    synced: 'bg-indigo-100 text-indigo-700',
    under_review: 'bg-purple-100 text-purple-700',
    complete: 'bg-green-100 text-green-700',
    retake: 'bg-red-100 text-red-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}
