// Local AI engine for mobile — runs WHO classification and maps results to annotation chips
// Pure TypeScript, no browser/server deps. Value modules only (Phase 1).
// Image/audio AI will be added in a future phase.

import type { ModuleType } from './types'

export interface AIResult {
  suggestedChips: string[]
  confidence: number
  summary: string
  classification?: string
  zScore?: number
  percentile?: number
}

// ── WHO LMS tables (subset from shared anthropometry) ──────────

interface LMSEntry { L: number; M: number; S: number }

const HEIGHT_FOR_AGE_BOYS: Record<number, LMSEntry> = {
  24: { L: 1, M: 87.8, S: 0.0399 }, 36: { L: 1, M: 96.1, S: 0.0397 },
  48: { L: 1, M: 103.3, S: 0.0399 }, 60: { L: 1, M: 110.0, S: 0.0403 },
  72: { L: 1, M: 116.0, S: 0.0407 }, 84: { L: 1, M: 121.7, S: 0.0412 },
  96: { L: 1, M: 127.3, S: 0.0418 }, 108: { L: 1, M: 132.6, S: 0.0422 },
  120: { L: 1, M: 137.8, S: 0.0427 }, 132: { L: 1, M: 143.1, S: 0.0434 },
  144: { L: 1, M: 149.1, S: 0.0441 }, 156: { L: 1, M: 155.5, S: 0.0442 },
  168: { L: 1, M: 161.8, S: 0.0434 }, 180: { L: 1, M: 166.9, S: 0.0419 },
  192: { L: 1, M: 170.4, S: 0.0402 }, 204: { L: 1, M: 172.5, S: 0.0390 },
  216: { L: 1, M: 173.7, S: 0.0381 },
}

const HEIGHT_FOR_AGE_GIRLS: Record<number, LMSEntry> = {
  24: { L: 1, M: 86.4, S: 0.0405 }, 36: { L: 1, M: 95.1, S: 0.0402 },
  48: { L: 1, M: 102.7, S: 0.0400 }, 60: { L: 1, M: 109.4, S: 0.0402 },
  72: { L: 1, M: 115.1, S: 0.0406 }, 84: { L: 1, M: 121.0, S: 0.0410 },
  96: { L: 1, M: 126.6, S: 0.0415 }, 108: { L: 1, M: 132.2, S: 0.0420 },
  120: { L: 1, M: 137.8, S: 0.0426 }, 132: { L: 1, M: 143.7, S: 0.0432 },
  144: { L: 1, M: 150.0, S: 0.0433 }, 156: { L: 1, M: 155.3, S: 0.0424 },
  168: { L: 1, M: 158.7, S: 0.0411 }, 180: { L: 1, M: 160.5, S: 0.0400 },
  192: { L: 1, M: 161.3, S: 0.0394 }, 204: { L: 1, M: 161.7, S: 0.0391 },
  216: { L: 1, M: 161.9, S: 0.0389 },
}

const WEIGHT_FOR_AGE_BOYS: Record<number, LMSEntry> = {
  24: { L: -0.3521, M: 12.2, S: 0.1174 }, 36: { L: -0.4232, M: 14.3, S: 0.1174 },
  48: { L: -0.5181, M: 16.3, S: 0.1203 }, 60: { L: -0.6040, M: 18.3, S: 0.1241 },
  72: { L: -0.6855, M: 20.5, S: 0.1290 }, 84: { L: -0.7558, M: 22.9, S: 0.1342 },
  96: { L: -0.8115, M: 25.5, S: 0.1395 }, 108: { L: -0.8563, M: 28.1, S: 0.1439 },
  120: { L: -0.8868, M: 31.2, S: 0.1493 },
}

const WEIGHT_FOR_AGE_GIRLS: Record<number, LMSEntry> = {
  24: { L: -0.3833, M: 11.5, S: 0.1189 }, 36: { L: -0.4561, M: 13.9, S: 0.1247 },
  48: { L: -0.5453, M: 16.1, S: 0.1321 }, 60: { L: -0.6293, M: 18.2, S: 0.1389 },
  72: { L: -0.7090, M: 20.5, S: 0.1461 }, 84: { L: -0.7750, M: 23.0, S: 0.1524 },
  96: { L: -0.8200, M: 25.6, S: 0.1569 }, 108: { L: -0.8498, M: 28.7, S: 0.1611 },
  120: { L: -0.8695, M: 32.0, S: 0.1644 },
}

function findNearestLMS(table: Record<number, LMSEntry>, key: number): LMSEntry {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b)
  if (key <= keys[0]) return table[keys[0]]
  if (key >= keys[keys.length - 1]) return table[keys[keys.length - 1]]
  let lower = keys[0], upper = keys[keys.length - 1]
  for (const k of keys) {
    if (k <= key) lower = k
    if (k >= key && k < upper) upper = k
  }
  if (lower === upper) return table[lower]
  const frac = (key - lower) / (upper - lower)
  const lo = table[lower], hi = table[upper]
  return { L: lo.L + frac * (hi.L - lo.L), M: lo.M + frac * (hi.M - lo.M), S: lo.S + frac * (hi.S - lo.S) }
}

function calcZ(value: number, lms: LMSEntry): number {
  const { L, M, S } = lms
  if (L === 0) return Math.log(value / M) / S
  return (Math.pow(value / M, L) - 1) / (L * S)
}

function zToPercentile(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? (1 - p) * 100 : p * 100
}

// ── Value module classifiers ──────────────────────

function classifyHeight(value: number, ageMonths: number, gender: 'male' | 'female'): AIResult {
  const table = gender === 'male' ? HEIGHT_FOR_AGE_BOYS : HEIGHT_FOR_AGE_GIRLS
  const lms = findNearestLMS(table, ageMonths)
  const z = calcZ(value, lms)
  const pct = zToPercentile(z)
  const zRound = Math.round(z * 100) / 100

  if (z < -3) return { suggestedChips: ['ga10'], confidence: 0.9, summary: `Severely stunted (Z=${zRound})`, classification: 'Severely stunted', zScore: zRound, percentile: Math.round(pct * 10) / 10 }
  if (z < -2) return { suggestedChips: ['ga10'], confidence: 0.85, summary: `Stunted (Z=${zRound})`, classification: 'Stunted', zScore: zRound, percentile: Math.round(pct * 10) / 10 }
  if (z > 2) return { suggestedChips: [], confidence: 0.8, summary: `Tall for age (Z=${zRound})`, classification: 'Tall', zScore: zRound, percentile: Math.round(pct * 10) / 10 }
  return { suggestedChips: [], confidence: 0.9, summary: `Normal height (Z=${zRound})`, classification: 'Normal', zScore: zRound, percentile: Math.round(pct * 10) / 10 }
}

function classifyWeight(value: number, ageMonths: number, gender: 'male' | 'female'): AIResult {
  const table = gender === 'male' ? WEIGHT_FOR_AGE_BOYS : WEIGHT_FOR_AGE_GIRLS
  const lms = findNearestLMS(table, ageMonths)
  const z = calcZ(value, lms)
  const pct = zToPercentile(z)
  const zRound = Math.round(z * 100) / 100

  if (z < -3) return { suggestedChips: ['ga2', 'ga14'], confidence: 0.9, summary: `Severely underweight (Z=${zRound})`, classification: 'Severely underweight', zScore: zRound, percentile: Math.round(pct * 10) / 10 }
  if (z < -2) return { suggestedChips: ['ga2'], confidence: 0.85, summary: `Underweight (Z=${zRound})`, classification: 'Underweight', zScore: zRound, percentile: Math.round(pct * 10) / 10 }
  if (z > 2) return { suggestedChips: ['ga11'], confidence: 0.8, summary: `Overweight (Z=${zRound})`, classification: 'Overweight', zScore: zRound, percentile: Math.round(pct * 10) / 10 }
  return { suggestedChips: [], confidence: 0.9, summary: `Normal weight (Z=${zRound})`, classification: 'Normal', zScore: zRound, percentile: Math.round(pct * 10) / 10 }
}

function classifySpO2(value: number): AIResult {
  if (value >= 95) return { suggestedChips: [], confidence: 0.95, summary: `Normal SpO2 (${value}%)`, classification: 'Normal' }
  if (value >= 90) return { suggestedChips: [], confidence: 0.9, summary: `Mild hypoxia (${value}%)`, classification: 'Mild Hypoxia' }
  if (value >= 85) return { suggestedChips: ['ga4'], confidence: 0.9, summary: `Moderate hypoxia (${value}%)`, classification: 'Moderate Hypoxia' }
  return { suggestedChips: ['ga4'], confidence: 0.95, summary: `Severe hypoxia (${value}%)`, classification: 'Severe Hypoxia' }
}

function classifyHemoglobin(value: number, ageMonths: number, gender: 'male' | 'female'): AIResult {
  let normalThreshold: number, mildThreshold: number, moderateThreshold: number
  if (ageMonths < 60) { normalThreshold = 11.0; mildThreshold = 10.0; moderateThreshold = 7.0 }
  else if (ageMonths < 144) { normalThreshold = 11.5; mildThreshold = 11.0; moderateThreshold = 8.0 }
  else if (ageMonths < 180) { normalThreshold = 12.0; mildThreshold = 11.0; moderateThreshold = 8.0 }
  else {
    if (gender === 'male') { normalThreshold = 13.0; mildThreshold = 11.0; moderateThreshold = 8.0 }
    else { normalThreshold = 12.0; mildThreshold = 11.0; moderateThreshold = 8.0 }
  }

  if (value >= normalThreshold) return { suggestedChips: [], confidence: 0.9, summary: `Normal Hb (${value} g/dL)`, classification: 'Normal' }
  if (value >= mildThreshold) return { suggestedChips: ['ee5', 'na3'], confidence: 0.85, summary: `Mild anemia (${value} g/dL)`, classification: 'Mild Anemia' }
  if (value >= moderateThreshold) return { suggestedChips: ['ee5', 'na3', 'ga3'], confidence: 0.9, summary: `Moderate anemia (${value} g/dL)`, classification: 'Moderate Anemia' }
  return { suggestedChips: ['ee5', 'na3', 'ga3'], confidence: 0.95, summary: `Severe anemia (${value} g/dL)`, classification: 'Severe Anemia' }
}

function classifyMUAC(valueCm: number): AIResult {
  const valueMm = valueCm * 10
  if (valueMm < 115) return { suggestedChips: ['muac1'], confidence: 0.95, summary: `SAM (${valueMm}mm)`, classification: 'SAM' }
  if (valueMm <= 125) return { suggestedChips: ['muac2'], confidence: 0.9, summary: `MAM (${valueMm}mm)`, classification: 'MAM' }
  return { suggestedChips: ['muac3'], confidence: 0.95, summary: `Normal MUAC (${valueMm}mm)`, classification: 'Normal' }
}

function classifyBP(valueStr: string, ageMonths: number): AIResult {
  const parts = valueStr.split('/')
  if (parts.length !== 2) return { suggestedChips: [], confidence: 0.5, summary: 'Invalid BP format (use systolic/diastolic)', classification: 'Invalid' }
  const systolic = parseInt(parts[0], 10)
  const diastolic = parseInt(parts[1], 10)
  if (isNaN(systolic) || isNaN(diastolic)) return { suggestedChips: [], confidence: 0.5, summary: 'Invalid BP values', classification: 'Invalid' }

  // Simplified pediatric BP classification
  const isChild = ageMonths < 156
  const highSystolic = isChild ? 120 : 130
  const highDiastolic = isChild ? 80 : 85

  if (systolic >= highSystolic + 20 || diastolic >= highDiastolic + 10) {
    return { suggestedChips: [], confidence: 0.85, summary: `Stage 2 Hypertension (${systolic}/${diastolic})`, classification: 'Stage 2 HTN' }
  }
  if (systolic >= highSystolic || diastolic >= highDiastolic) {
    return { suggestedChips: [], confidence: 0.8, summary: `Elevated BP (${systolic}/${diastolic})`, classification: 'Elevated' }
  }
  return { suggestedChips: [], confidence: 0.9, summary: `Normal BP (${systolic}/${diastolic})`, classification: 'Normal' }
}

// ── Main entry point ─────────────────────────────

export interface ChildContext {
  ageMonths?: number
  gender?: 'male' | 'female'
}

export function runLocalAI(
  moduleType: ModuleType,
  value: string,
  childContext: ChildContext = {}
): AIResult | null {
  const { ageMonths = 60, gender = 'male' } = childContext
  const num = parseFloat(value)

  switch (moduleType) {
    case 'height':
      return isNaN(num) ? null : classifyHeight(num, ageMonths, gender)
    case 'weight':
      return isNaN(num) ? null : classifyWeight(num, ageMonths, gender)
    case 'spo2':
      return isNaN(num) ? null : classifySpO2(num)
    case 'hemoglobin':
      return isNaN(num) ? null : classifyHemoglobin(num, ageMonths, gender)
    case 'muac':
      return isNaN(num) ? null : classifyMUAC(num)
    case 'bp':
      return classifyBP(value, ageMonths)
    default:
      // Photo/video/audio/form modules — no local AI yet
      return null
  }
}
