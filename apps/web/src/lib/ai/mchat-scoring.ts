/**
 * M-CHAT-R/F Scoring — Modified Checklist for Autism in Toddlers, Revised with Follow-Up.
 *
 * Validated screening instrument for ASD risk in children 16–30 months.
 * 20 yes/no items scored per published algorithm:
 *   - Low Risk: 0–2 → no follow-up needed
 *   - Medium Risk: 3–7 → administer Follow-Up interview
 *   - High Risk: 8–20 → refer immediately
 *
 * Items 2, 5, 12 are "best-response" items where "Yes" = PASS (no risk).
 * All other items: "No" = PASS (no risk).
 *
 * Reference: Robins DL, et al. Pediatrics 2014;133(1):e37-45.
 */

export interface MChatItem {
  id: number
  text: string
  /** If true, "Yes" = PASS (no risk). If false, "No" = PASS (no risk). */
  yesIsPass: boolean
  /** Critical item — contributes to high-risk determination */
  critical: boolean
  domain: 'social' | 'communication' | 'behavior' | 'sensory'
}

export const MCHAT_ITEMS: MChatItem[] = [
  { id: 1, text: 'If you point at something across the room, does your child look at it?', yesIsPass: true, critical: false, domain: 'social' },
  { id: 2, text: 'Have you ever wondered if your child might be deaf?', yesIsPass: false, critical: false, domain: 'sensory' },
  { id: 3, text: 'Does your child play pretend or make-believe?', yesIsPass: true, critical: false, domain: 'behavior' },
  { id: 4, text: 'Does your child like climbing on things?', yesIsPass: true, critical: false, domain: 'behavior' },
  { id: 5, text: 'Does your child make unusual finger movements near their eyes?', yesIsPass: false, critical: true, domain: 'behavior' },
  { id: 6, text: 'Does your child point with one finger to ask for something or to get help?', yesIsPass: true, critical: true, domain: 'communication' },
  { id: 7, text: 'Does your child point with one finger to show you something interesting?', yesIsPass: true, critical: true, domain: 'communication' },
  { id: 8, text: 'Is your child interested in other children?', yesIsPass: true, critical: false, domain: 'social' },
  { id: 9, text: 'Does your child show you things by bringing them to you or holding them up?', yesIsPass: true, critical: true, domain: 'communication' },
  { id: 10, text: 'Does your child respond to their name when you call?', yesIsPass: true, critical: true, domain: 'social' },
  { id: 11, text: 'When you smile at your child, does the child smile back?', yesIsPass: true, critical: false, domain: 'social' },
  { id: 12, text: 'Does your child get upset by everyday noises?', yesIsPass: false, critical: false, domain: 'sensory' },
  { id: 13, text: 'Does your child walk?', yesIsPass: true, critical: false, domain: 'behavior' },
  { id: 14, text: 'Does your child look you in the eye when you are talking, playing, or dressing?', yesIsPass: true, critical: true, domain: 'social' },
  { id: 15, text: 'Does your child try to copy what you do?', yesIsPass: true, critical: false, domain: 'social' },
  { id: 16, text: 'If you turn your head to look at something, does your child look to see what you are looking at?', yesIsPass: true, critical: false, domain: 'social' },
  { id: 17, text: 'Does your child try to get you to look at them?', yesIsPass: true, critical: false, domain: 'communication' },
  { id: 18, text: 'Does your child understand when you tell them to do something?', yesIsPass: true, critical: false, domain: 'communication' },
  { id: 19, text: 'If something new happens, does your child look at your face to see how you feel about it?', yesIsPass: true, critical: true, domain: 'social' },
  { id: 20, text: 'Does your child like movement activities?', yesIsPass: true, critical: false, domain: 'behavior' },
]

export interface MChatAnswer {
  itemId: number
  response: boolean  // true = "Yes", false = "No"
}

export type MChatRisk = 'low' | 'medium' | 'high'

export interface MChatResult {
  totalScore: number           // 0–20 (number of FAIL items)
  criticalScore: number        // 0–7 (number of critical FAIL items)
  risk: MChatRisk
  failedItems: number[]        // Item IDs that FAILED
  criticalFailedItems: number[] // Critical item IDs that FAILED
  domainScores: Record<string, { total: number; failed: number }>
  recommendation: string
}

/**
 * Score M-CHAT-R responses according to published algorithm.
 */
export function scoreMChat(answers: MChatAnswer[]): MChatResult {
  const failedItems: number[] = []
  const criticalFailedItems: number[] = []
  const domainScores: Record<string, { total: number; failed: number }> = {
    social: { total: 0, failed: 0 },
    communication: { total: 0, failed: 0 },
    behavior: { total: 0, failed: 0 },
    sensory: { total: 0, failed: 0 },
  }

  for (const item of MCHAT_ITEMS) {
    domainScores[item.domain].total++

    const answer = answers.find(a => a.itemId === item.id)
    if (!answer) continue

    // Determine if this answer is a FAIL
    const passed = item.yesIsPass ? answer.response : !answer.response
    if (!passed) {
      failedItems.push(item.id)
      domainScores[item.domain].failed++
      if (item.critical) {
        criticalFailedItems.push(item.id)
      }
    }
  }

  const totalScore = failedItems.length
  const criticalScore = criticalFailedItems.length

  // Risk determination per published algorithm
  let risk: MChatRisk
  let recommendation: string
  if (totalScore >= 8) {
    risk = 'high'
    recommendation = 'Immediate referral for diagnostic evaluation and early intervention services.'
  } else if (totalScore >= 3) {
    risk = 'medium'
    recommendation = 'Administer M-CHAT-R/F Follow-Up interview. If score remains ≥2 after follow-up, refer for evaluation.'
  } else {
    risk = 'low'
    recommendation = 'Low risk. Re-screen at 24-month well-child visit if currently under 24 months.'
  }

  return {
    totalScore,
    criticalScore,
    risk,
    failedItems,
    criticalFailedItems,
    domainScores,
    recommendation,
  }
}

/**
 * Map M-CHAT results to observation features for storage and sync.
 */
export function mchatToFeatures(result: MChatResult): Record<string, unknown> {
  return {
    mchatTotalScore: result.totalScore,
    mchatCriticalScore: result.criticalScore,
    mchatRisk: result.risk,
    mchatFailedItems: result.failedItems,
    mchatCriticalFailedItems: result.criticalFailedItems,
    mchatDomainScores: result.domainScores,
    mchatRecommendation: result.recommendation,
    riskCategory: result.risk === 'high' ? 'high_risk' :
                  result.risk === 'medium' ? 'possible_risk' : 'no_risk',
  }
}
