/**
 * AI Accuracy Metrics — sensitivity, specificity, agreement tracking per module.
 *
 * Tracks:
 *   - Sensitivity (true positive rate): AI caught real findings
 *   - Specificity (true negative rate): AI didn't over-flag
 *   - Positive Predictive Value (PPV): When AI flags, how often it's correct
 *   - Negative Predictive Value (NPV): When AI says normal, how often it's correct
 *   - Agreement rate: AI vs nurse, AI vs doctor
 *   - Confidence calibration: Is 80% confidence actually 80% correct?
 *   - Per-module breakdown with targets
 *
 * All functions are pure — no DB calls. Worker routes compute metrics from stored data.
 *
 * Used by: apps/worker (aggregation endpoint), apps/web (accuracy dashboard)
 */

import type { AIAnnotationRecord, RiskLevel } from './annotation-schema'

// ── Metric Types ──

export interface ModuleAccuracyMetrics {
  moduleType: string
  sampleCount: number

  // Binary classification metrics (AI positive = any finding)
  sensitivity: number       // TP / (TP + FN) — how many real issues AI caught
  specificity: number       // TN / (TN + FP) — how many normals AI correctly labeled
  ppv: number               // TP / (TP + FP) — positive predictive value
  npv: number               // TN / (TN + FN) — negative predictive value
  accuracy: number          // (TP + TN) / total

  // Agreement metrics
  nurseAgreementRate: number    // fraction where nurse accepted all AI suggestions
  doctorAgreementRate: number   // fraction where doctor confirmed AI findings
  doctorOverrideRate: number    // fraction where doctor corrected AI

  // Confidence calibration
  calibration: CalibrationBucket[]

  // Per-finding breakdown
  findingMetrics: FindingAccuracy[]

  // Risk level confusion matrix
  riskConfusion: RiskConfusionMatrix

  // Timestamp
  computedAt: string
}

export interface CalibrationBucket {
  confidenceRange: [number, number]  // e.g., [0.8, 0.9]
  predicted: number                   // number of predictions in this range
  correct: number                     // number that turned out correct
  actualRate: number                  // correct / predicted
}

export interface FindingAccuracy {
  chipId: string
  label: string
  truePositives: number
  falsePositives: number
  falseNegatives: number
  trueNegatives: number
  sensitivity: number
  specificity: number
  ppv: number
  prevalence: number         // how common this finding is in the dataset
}

export interface RiskConfusionMatrix {
  // Rows: AI predicted risk. Columns: Doctor confirmed risk.
  matrix: Record<RiskLevel, Record<RiskLevel, number>>
  kappaCoefficient: number   // Cohen's kappa for inter-rater reliability
}

// ── Accuracy Targets ──

export interface AccuracyTarget {
  moduleType: string
  sensitivityTarget: number
  specificityTarget: number
  description: string
}

export const MODULE_ACCURACY_TARGETS: AccuracyTarget[] = [
  {
    moduleType: 'vision_red_reflex',
    sensitivityTarget: 0.85,
    specificityTarget: 0.90,
    description: 'Red reflex / photoscreening',
  },
  {
    moduleType: 'vision_external',
    sensitivityTarget: 0.80,
    specificityTarget: 0.90,
    description: 'External eye exam',
  },
  {
    moduleType: 'hearing_pure_tone',
    sensitivityTarget: 0.95,
    specificityTarget: 0.95,
    description: 'Pure-tone audiometry',
  },
  {
    moduleType: 'ent_ear',
    sensitivityTarget: 0.80,
    specificityTarget: 0.85,
    description: 'Ear / otoscopy exam',
  },
  {
    moduleType: 'dental',
    sensitivityTarget: 0.80,
    specificityTarget: 0.85,
    description: 'Dental / oral cavity exam',
  },
  {
    moduleType: 'motor_assessment',
    sensitivityTarget: 0.75,
    specificityTarget: 0.80,
    description: 'Neuromotor assessment',
  },
  {
    moduleType: 'autism_screening',
    sensitivityTarget: 0.90,
    specificityTarget: 0.80,
    description: 'Autism / neurodevelopmental screening',
  },
  {
    moduleType: 'mchat',
    sensitivityTarget: 0.90,
    specificityTarget: 0.85,
    description: 'M-CHAT-R/F questionnaire',
  },
  {
    moduleType: 'ocr',
    sensitivityTarget: 0.98,
    specificityTarget: 0.98,
    description: 'OCR device reading extraction',
  },
  {
    moduleType: 'skin_exam',
    sensitivityTarget: 0.75,
    specificityTarget: 0.85,
    description: 'Skin / dermatological exam',
  },
]

// ── Computation Functions ──

interface ReviewedObservation {
  annotation: AIAnnotationRecord
  doctorConfirmedFindings: string[]  // chip IDs doctor confirmed as real findings
  doctorRiskLevel: RiskLevel         // doctor's assessed risk
  doctorReviewStatus: 'confirmed' | 'corrected'
}

/**
 * Compute accuracy metrics for a set of reviewed observations.
 * Requires doctor-reviewed data — observations without doctor review are excluded.
 */
export function computeModuleAccuracy(
  moduleType: string,
  observations: ReviewedObservation[],
): ModuleAccuracyMetrics {
  if (observations.length === 0) {
    return createEmptyMetrics(moduleType)
  }

  // Binary classification: AI positive = has any non-normal finding
  let tp = 0, fp = 0, fn = 0, tn = 0

  // Agreement tracking
  let nurseAgreed = 0
  let doctorAgreed = 0
  let doctorOverrode = 0

  // Per-finding tracking
  const findingCounts = new Map<string, { tp: number; fp: number; fn: number; tn: number; label: string }>()

  // Confidence calibration buckets
  const calBuckets: Map<string, { predicted: number; correct: number }> = new Map()
  const bucketRanges: [number, number][] = [
    [0.0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.0],
  ]
  for (const [lo, hi] of bucketRanges) {
    calBuckets.set(`${lo}-${hi}`, { predicted: 0, correct: 0 })
  }

  // Risk confusion matrix
  const riskLevels: RiskLevel[] = ['normal', 'low', 'moderate', 'high']
  const riskMatrix: Record<RiskLevel, Record<RiskLevel, number>> = {
    normal: { normal: 0, low: 0, moderate: 0, high: 0 },
    low: { normal: 0, low: 0, moderate: 0, high: 0 },
    moderate: { normal: 0, low: 0, moderate: 0, high: 0 },
    high: { normal: 0, low: 0, moderate: 0, high: 0 },
  }

  // Collect all unique chip IDs across all observations
  const allChipIds = new Set<string>()

  for (const obs of observations) {
    const aiFindings = obs.annotation.finalFindings.map(f => f.chipId)
    const doctorFindings = obs.doctorConfirmedFindings

    // Collect chip IDs
    for (const id of [...aiFindings, ...doctorFindings]) {
      allChipIds.add(id)
    }

    // Binary classification
    const aiPositive = aiFindings.length > 0
    const doctorPositive = doctorFindings.length > 0

    if (aiPositive && doctorPositive) tp++
    else if (aiPositive && !doctorPositive) fp++
    else if (!aiPositive && doctorPositive) fn++
    else tn++

    // Agreement
    if (obs.annotation.nurseAgreed) nurseAgreed++
    if (obs.doctorReviewStatus === 'confirmed') doctorAgreed++
    else doctorOverrode++

    // Per-finding classification
    const aiSet = new Set(aiFindings)
    const doctorSet = new Set(doctorFindings)

    for (const chipId of allChipIds) {
      if (!findingCounts.has(chipId)) {
        const finding = obs.annotation.finalFindings.find(f => f.chipId === chipId)
        findingCounts.set(chipId, { tp: 0, fp: 0, fn: 0, tn: 0, label: finding?.label || chipId })
      }
      const counts = findingCounts.get(chipId)!
      const aiHas = aiSet.has(chipId)
      const doctorHas = doctorSet.has(chipId)

      if (aiHas && doctorHas) counts.tp++
      else if (aiHas && !doctorHas) counts.fp++
      else if (!aiHas && doctorHas) counts.fn++
      else counts.tn++
    }

    // Confidence calibration
    const confidence = obs.annotation.finalConfidence
    for (const [lo, hi] of bucketRanges) {
      if (confidence >= lo && confidence < hi) {
        const key = `${lo}-${hi}`
        const bucket = calBuckets.get(key)!
        bucket.predicted++
        // "Correct" if AI risk matches doctor risk
        if (obs.annotation.finalRisk === obs.doctorRiskLevel) {
          bucket.correct++
        }
        break
      }
    }

    // Risk confusion matrix
    const aiRisk = obs.annotation.finalRisk
    const doctorRisk = obs.doctorRiskLevel
    riskMatrix[aiRisk][doctorRisk]++
  }

  const total = observations.length

  // Compute per-finding metrics
  const findingMetrics: FindingAccuracy[] = Array.from(findingCounts.entries()).map(([chipId, counts]) => {
    const sens = (counts.tp + counts.fn) > 0 ? counts.tp / (counts.tp + counts.fn) : 0
    const spec = (counts.tn + counts.fp) > 0 ? counts.tn / (counts.tn + counts.fp) : 0
    const ppvVal = (counts.tp + counts.fp) > 0 ? counts.tp / (counts.tp + counts.fp) : 0
    const prevalence = (counts.tp + counts.fn) / total
    return {
      chipId,
      label: counts.label,
      truePositives: counts.tp,
      falsePositives: counts.fp,
      falseNegatives: counts.fn,
      trueNegatives: counts.tn,
      sensitivity: round4(sens),
      specificity: round4(spec),
      ppv: round4(ppvVal),
      prevalence: round4(prevalence),
    }
  })

  // Calibration
  const calibration: CalibrationBucket[] = bucketRanges.map(([lo, hi]) => {
    const key = `${lo}-${hi}`
    const bucket = calBuckets.get(key)!
    return {
      confidenceRange: [lo, hi],
      predicted: bucket.predicted,
      correct: bucket.correct,
      actualRate: bucket.predicted > 0 ? round4(bucket.correct / bucket.predicted) : 0,
    }
  })

  // Cohen's kappa
  const kappaCoefficient = computeCohensKappa(riskMatrix, riskLevels, total)

  return {
    moduleType,
    sampleCount: total,
    sensitivity: round4((tp + fn) > 0 ? tp / (tp + fn) : 0),
    specificity: round4((tn + fp) > 0 ? tn / (tn + fp) : 0),
    ppv: round4((tp + fp) > 0 ? tp / (tp + fp) : 0),
    npv: round4((tn + fn) > 0 ? tn / (tn + fn) : 0),
    accuracy: round4(total > 0 ? (tp + tn) / total : 0),
    nurseAgreementRate: round4(total > 0 ? nurseAgreed / total : 0),
    doctorAgreementRate: round4(total > 0 ? doctorAgreed / total : 0),
    doctorOverrideRate: round4(total > 0 ? doctorOverrode / total : 0),
    calibration,
    findingMetrics,
    riskConfusion: {
      matrix: riskMatrix,
      kappaCoefficient,
    },
    computedAt: new Date().toISOString(),
  }
}

/**
 * Compute Cohen's Kappa coefficient for inter-rater reliability.
 * Measures agreement between AI risk and doctor risk beyond chance.
 * Range: -1 to 1. >0.6 = substantial agreement. >0.8 = almost perfect.
 */
function computeCohensKappa(
  matrix: Record<RiskLevel, Record<RiskLevel, number>>,
  levels: RiskLevel[],
  total: number,
): number {
  if (total === 0) return 0

  // Observed agreement
  let observed = 0
  for (const level of levels) {
    observed += matrix[level][level]
  }
  const po = observed / total

  // Expected agreement (by chance)
  let pe = 0
  for (const level of levels) {
    // Row sum (AI predicted this level)
    let rowSum = 0
    for (const col of levels) rowSum += matrix[level][col]

    // Column sum (doctor assigned this level)
    let colSum = 0
    for (const row of levels) colSum += matrix[row][level]

    pe += (rowSum / total) * (colSum / total)
  }

  if (pe >= 1) return 1
  return round4((po - pe) / (1 - pe))
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function createEmptyMetrics(moduleType: string): ModuleAccuracyMetrics {
  return {
    moduleType,
    sampleCount: 0,
    sensitivity: 0,
    specificity: 0,
    ppv: 0,
    npv: 0,
    accuracy: 0,
    nurseAgreementRate: 0,
    doctorAgreementRate: 0,
    doctorOverrideRate: 0,
    calibration: [],
    findingMetrics: [],
    riskConfusion: {
      matrix: {
        normal: { normal: 0, low: 0, moderate: 0, high: 0 },
        low: { normal: 0, low: 0, moderate: 0, high: 0 },
        moderate: { normal: 0, low: 0, moderate: 0, high: 0 },
        high: { normal: 0, low: 0, moderate: 0, high: 0 },
      },
      kappaCoefficient: 0,
    },
    computedAt: new Date().toISOString(),
  }
}

// ── Summary Helpers ──

/**
 * Check if module meets its accuracy target.
 */
export function meetsAccuracyTarget(metrics: ModuleAccuracyMetrics): {
  meetsSensitivity: boolean
  meetsSpecificity: boolean
  target: AccuracyTarget | undefined
} {
  const target = MODULE_ACCURACY_TARGETS.find(t => t.moduleType === metrics.moduleType)
  if (!target) {
    return { meetsSensitivity: true, meetsSpecificity: true, target: undefined }
  }
  return {
    meetsSensitivity: metrics.sensitivity >= target.sensitivityTarget,
    meetsSpecificity: metrics.specificity >= target.specificityTarget,
    target,
  }
}

/**
 * Generate a human-readable accuracy summary for a module.
 */
export function generateAccuracySummary(metrics: ModuleAccuracyMetrics): string {
  if (metrics.sampleCount === 0) {
    return `No reviewed samples for ${metrics.moduleType}`
  }

  const targetCheck = meetsAccuracyTarget(metrics)
  const parts: string[] = []

  parts.push(`${metrics.moduleType}: ${metrics.sampleCount} reviewed samples`)
  parts.push(`Sensitivity: ${pct(metrics.sensitivity)}${targetCheck.target ? ` (target: ${pct(targetCheck.target.sensitivityTarget)})` : ''}`)
  parts.push(`Specificity: ${pct(metrics.specificity)}${targetCheck.target ? ` (target: ${pct(targetCheck.target.specificityTarget)})` : ''}`)
  parts.push(`PPV: ${pct(metrics.ppv)}, NPV: ${pct(metrics.npv)}`)
  parts.push(`Doctor agreement: ${pct(metrics.doctorAgreementRate)}, Override rate: ${pct(metrics.doctorOverrideRate)}`)
  parts.push(`Kappa: ${metrics.riskConfusion.kappaCoefficient.toFixed(3)}`)

  if (!targetCheck.meetsSensitivity || !targetCheck.meetsSpecificity) {
    parts.push('⚠ Below accuracy target — model retraining recommended')
  }

  return parts.join('\n')
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

/**
 * Compute aggregate metrics across all modules.
 */
export function computeAggregateMetrics(
  perModule: ModuleAccuracyMetrics[],
): {
  totalSamples: number
  weightedSensitivity: number
  weightedSpecificity: number
  overallDoctorAgreement: number
  modulesAboveTarget: number
  modulesBelowTarget: number
} {
  let totalSamples = 0
  let weightedSens = 0
  let weightedSpec = 0
  let weightedAgreement = 0
  let aboveTarget = 0
  let belowTarget = 0

  for (const m of perModule) {
    totalSamples += m.sampleCount
    weightedSens += m.sensitivity * m.sampleCount
    weightedSpec += m.specificity * m.sampleCount
    weightedAgreement += m.doctorAgreementRate * m.sampleCount

    const target = meetsAccuracyTarget(m)
    if (target.meetsSensitivity && target.meetsSpecificity) aboveTarget++
    else belowTarget++
  }

  return {
    totalSamples,
    weightedSensitivity: totalSamples > 0 ? round4(weightedSens / totalSamples) : 0,
    weightedSpecificity: totalSamples > 0 ? round4(weightedSpec / totalSamples) : 0,
    overallDoctorAgreement: totalSamples > 0 ? round4(weightedAgreement / totalSamples) : 0,
    modulesAboveTarget: aboveTarget,
    modulesBelowTarget: belowTarget,
  }
}
