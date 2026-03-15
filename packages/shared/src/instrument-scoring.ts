/**
 * instrument-scoring.ts
 *
 * Generic survey/instrument scoring engine.
 * Takes SurveyJS schema + response → computed scores.
 * Includes built-in scorers for known validated instruments.
 */

// ─── Types ──────────────────────────────────────────────────

export interface InstrumentScore {
  total: number
  maxPossible: number
  percentage: number
  riskLevel: 'low' | 'medium' | 'high'
  subscales?: Record<string, { score: number; max: number }>
  interpretation?: string
}

export interface ScoringContext {
  schemaJson: unknown
  responseJson: Record<string, unknown>
  scoringLogic?: string
}

// ─── Main Scoring Function ──────────────────────────────────

/**
 * Score an instrument response.
 * Tries built-in scorers first, then custom scoring logic, then generic sum.
 */
export function scoreInstrument(ctx: ScoringContext): InstrumentScore {
  const { responseJson, scoringLogic } = ctx

  // Try built-in scorers by checking response keys
  const keys = Object.keys(responseJson)

  // M-CHAT-R/F detection
  if (keys.some(k => k.startsWith('mchat_'))) {
    return scoreMCHAT(responseJson)
  }

  // PSC (Pediatric Symptom Checklist)
  if (keys.some(k => k.startsWith('psc_'))) {
    return scorePSC(responseJson)
  }

  // SDQ (Strengths and Difficulties Questionnaire)
  if (keys.some(k => k.startsWith('sdq_'))) {
    return scoreSDQ(responseJson)
  }

  // PHQ-A (Patient Health Questionnaire for Adolescents)
  if (keys.some(k => k.startsWith('phq_'))) {
    return scorePHQ(responseJson)
  }

  // Custom scoring logic (safe string evaluation)
  if (scoringLogic) {
    try {
      return evaluateCustomScoring(scoringLogic, responseJson)
    } catch {
      // Fall through to generic
    }
  }

  // Generic: sum all numeric values
  return genericSumScore(responseJson)
}

// ─── Built-in Scorers ───────────────────────────────────────

/**
 * M-CHAT-R/F (Modified Checklist for Autism in Toddlers)
 * 20 items, 0-1 scoring. Items 2,5,12 are reverse-scored.
 * Low risk: 0-2, Medium risk: 3-7, High risk: 8-20
 */
function scoreMCHAT(response: Record<string, unknown>): InstrumentScore {
  const reverseItems = [2, 5, 12]
  let total = 0

  for (let i = 1; i <= 20; i++) {
    const val = response[`mchat_${i}`]
    const numVal = typeof val === 'number' ? val : (val === true || val === 'yes' || val === '1' ? 1 : 0)
    if (reverseItems.includes(i)) {
      total += numVal === 0 ? 1 : 0 // Reverse
    } else {
      total += numVal
    }
  }

  const riskLevel = total <= 2 ? 'low' : total <= 7 ? 'medium' : 'high'
  const interpretation = riskLevel === 'low'
    ? 'Low risk — no follow-up required'
    : riskLevel === 'medium'
      ? 'Medium risk — follow-up interview recommended'
      : 'High risk — immediate referral for diagnostic evaluation'

  return { total, maxPossible: 20, percentage: (total / 20) * 100, riskLevel, interpretation }
}

/**
 * PSC-35 (Pediatric Symptom Checklist)
 * 35 items scored 0-2. Cutoff: ≥28 (ages 6-16), ≥24 (ages 4-5).
 */
function scorePSC(response: Record<string, unknown>): InstrumentScore {
  let total = 0
  const subscales: Record<string, { score: number; max: number }> = {
    attention: { score: 0, max: 10 },
    internalizing: { score: 0, max: 10 },
    externalizing: { score: 0, max: 14 },
  }

  const attentionItems = [4, 7, 8, 9, 14]
  const internalizingItems = [11, 13, 19, 22, 27]
  const externalizingItems = [16, 29, 31, 32, 33, 34, 35]

  for (let i = 1; i <= 35; i++) {
    const val = Number(response[`psc_${i}`] || 0)
    const score = Math.min(Math.max(val, 0), 2)
    total += score

    if (attentionItems.includes(i)) subscales.attention.score += score
    if (internalizingItems.includes(i)) subscales.internalizing.score += score
    if (externalizingItems.includes(i)) subscales.externalizing.score += score
  }

  const riskLevel = total >= 28 ? 'high' : total >= 20 ? 'medium' : 'low'
  const interpretation = riskLevel === 'high'
    ? 'Score indicates significant psychosocial impairment — further evaluation recommended'
    : riskLevel === 'medium'
      ? 'Borderline score — monitor and rescreen'
      : 'Score within normal range'

  return { total, maxPossible: 70, percentage: (total / 70) * 100, riskLevel, subscales, interpretation }
}

/**
 * SDQ (Strengths and Difficulties Questionnaire)
 * 25 items scored 0-2. Total difficulties = sum of 4 subscales (excl. prosocial).
 */
function scoreSDQ(response: Record<string, unknown>): InstrumentScore {
  const subscales: Record<string, { score: number; max: number }> = {
    emotional: { score: 0, max: 10 },
    conduct: { score: 0, max: 10 },
    hyperactivity: { score: 0, max: 10 },
    peer: { score: 0, max: 10 },
    prosocial: { score: 0, max: 10 },
  }

  const subscaleMap: Record<string, number[]> = {
    emotional: [3, 8, 13, 16, 24],
    conduct: [5, 7, 12, 18, 22],
    hyperactivity: [2, 10, 15, 21, 25],
    peer: [6, 11, 14, 19, 23],
    prosocial: [1, 4, 9, 17, 20],
  }

  for (const [scale, items] of Object.entries(subscaleMap)) {
    for (const item of items) {
      const val = Number(response[`sdq_${item}`] || 0)
      subscales[scale].score += Math.min(Math.max(val, 0), 2)
    }
  }

  // Total difficulties = all except prosocial
  const total = subscales.emotional.score + subscales.conduct.score +
    subscales.hyperactivity.score + subscales.peer.score

  const riskLevel = total >= 20 ? 'high' : total >= 14 ? 'medium' : 'low'
  const interpretation = riskLevel === 'high'
    ? 'Very high total difficulties score — clinical assessment recommended'
    : riskLevel === 'medium'
      ? 'Raised total difficulties score — may benefit from further assessment'
      : 'Close to average total difficulties score'

  return { total, maxPossible: 40, percentage: (total / 40) * 100, riskLevel, subscales, interpretation }
}

/**
 * PHQ-A (Patient Health Questionnaire - Adolescent)
 * 9 items scored 0-3. Minimal: 0-4, Mild: 5-9, Moderate: 10-14, Severe: 15-27
 */
function scorePHQ(response: Record<string, unknown>): InstrumentScore {
  let total = 0
  for (let i = 1; i <= 9; i++) {
    const val = Number(response[`phq_${i}`] || 0)
    total += Math.min(Math.max(val, 0), 3)
  }

  const riskLevel = total >= 15 ? 'high' : total >= 10 ? 'medium' : 'low'
  const interpretation = total < 5
    ? 'Minimal depression'
    : total < 10
      ? 'Mild depression — watchful waiting, repeat at follow-up'
      : total < 15
        ? 'Moderate depression — treatment plan recommended'
        : total < 20
          ? 'Moderately severe depression — active treatment with counseling/medication'
          : 'Severe depression — immediate treatment, consider referral to specialist'

  return { total, maxPossible: 27, percentage: (total / 27) * 100, riskLevel, interpretation }
}

// ─── Custom & Generic Scorers ───────────────────────────────

/**
 * Evaluate custom scoring logic (simple expression evaluator).
 * The scoring logic string should be a simple JSON mapping: { "question_key": weight, ... }
 */
function evaluateCustomScoring(logic: string, response: Record<string, unknown>): InstrumentScore {
  try {
    const weights = JSON.parse(logic) as Record<string, number>
    let total = 0
    let maxPossible = 0

    for (const [key, weight] of Object.entries(weights)) {
      const val = Number(response[key] || 0)
      total += val * weight
      maxPossible += Math.abs(weight) * 10 // Assume max value 10
    }

    const percentage = maxPossible > 0 ? (total / maxPossible) * 100 : 0
    const riskLevel = percentage >= 70 ? 'high' : percentage >= 40 ? 'medium' : 'low'

    return { total, maxPossible, percentage, riskLevel }
  } catch {
    return genericSumScore(response)
  }
}

/** Generic scorer: sum all numeric response values */
function genericSumScore(response: Record<string, unknown>): InstrumentScore {
  let total = 0
  let count = 0

  for (const val of Object.values(response)) {
    const num = Number(val)
    if (!isNaN(num) && typeof val !== 'boolean') {
      total += num
      count++
    }
  }

  const maxPossible = count * 10 // Estimated
  const percentage = maxPossible > 0 ? Math.min((total / maxPossible) * 100, 100) : 0
  const riskLevel = percentage >= 70 ? 'high' : percentage >= 40 ? 'medium' : 'low'

  return { total, maxPossible, percentage, riskLevel, interpretation: 'Generic scoring — review required' }
}
