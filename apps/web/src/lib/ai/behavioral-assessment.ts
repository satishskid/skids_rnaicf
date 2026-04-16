/**
 * Behavioral assessment stub — web side.
 *
 * The full implementation lives at `apps/mobile/src/lib/ai/behavioral-assessment.ts`
 * (668 lines). The web `behavioral-screening.tsx` component is currently
 * orphaned (no router entry) and was importing from this path before the file
 * existed. This minimal stub unblocks the monorepo typecheck; when the
 * feature is ported to web, replace the body with the real implementation.
 *
 * TODO(web-behavioral): port the scoring + assessment logic from the mobile
 * source, or factor the lib into packages/shared.
 */

export interface BehavioralTask {
  id: string
  name: string
  description: string
  instructions?: string[]
  /** Age range in months [minInclusive, maxInclusive]. */
  ageRange?: [number, number]
}

export const BEHAVIORAL_TASKS: BehavioralTask[] = []

export function getBehavioralTasksForAge(_ageMonths: number): BehavioralTask[] {
  return BEHAVIORAL_TASKS
}

export interface BehavioralTaskScore {
  taskId: string
  score: number
  concern: boolean
  details: string
  confidence: number
}

export interface BehavioralAssessmentResult {
  compositeScore: number
  socialCommunicationScore: number
  restrictedBehaviorScore: number
  combinedRisk: 'low' | 'medium' | 'high'
  recommendations: string[]
}

export function generateBehavioralAssessment(
  _taskScores: BehavioralTaskScore[],
  _ageMonths: number,
): BehavioralAssessmentResult {
  return {
    compositeScore: 0,
    socialCommunicationScore: 0,
    restrictedBehaviorScore: 0,
    combinedRisk: 'low',
    recommendations: [],
  }
}
