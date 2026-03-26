/**
 * WHO Anthropometry — Growth reference Z-score calculations
 *
 * Implements WHO 2006 (0-5y) and 2007 (5-19y) growth reference tables.
 * Uses LMS method: Z = ((value/M)^L - 1) / (L * S)
 *
 * References:
 * - WHO Child Growth Standards (2006): birth-5 years
 * - WHO Reference 2007: 5-19 years
 * - WHO 2011 Haemoglobin concentrations for anaemia diagnosis
 */

import type { AnthropometryResult } from '@skids/shared'

// Subset of WHO LMS tables — key ages for school screening
// Format: { ageMonths: { L, M, S } }
// Source: WHO Multicentre Growth Reference Study Group

interface LMSEntry { L: number; M: number; S: number }

// Height-for-age (cm) — BOYS
const HEIGHT_FOR_AGE_BOYS: Record<number, LMSEntry> = {
  24: { L: 1, M: 87.8, S: 0.0399 },
  36: { L: 1, M: 96.1, S: 0.0397 },
  48: { L: 1, M: 103.3, S: 0.0399 },
  60: { L: 1, M: 110.0, S: 0.0403 },
  72: { L: 1, M: 116.0, S: 0.0407 },
  84: { L: 1, M: 121.7, S: 0.0412 },
  96: { L: 1, M: 127.3, S: 0.0418 },
  108: { L: 1, M: 132.6, S: 0.0422 },
  120: { L: 1, M: 137.8, S: 0.0427 },
  132: { L: 1, M: 143.1, S: 0.0434 },
  144: { L: 1, M: 149.1, S: 0.0441 },
  156: { L: 1, M: 155.5, S: 0.0442 },
  168: { L: 1, M: 161.8, S: 0.0434 },
  180: { L: 1, M: 166.9, S: 0.0419 },
  192: { L: 1, M: 170.4, S: 0.0402 },
  204: { L: 1, M: 172.5, S: 0.0390 },
  216: { L: 1, M: 173.7, S: 0.0381 },
  228: { L: 1, M: 174.3, S: 0.0376 },
}

// Height-for-age (cm) — GIRLS
const HEIGHT_FOR_AGE_GIRLS: Record<number, LMSEntry> = {
  24: { L: 1, M: 86.4, S: 0.0405 },
  36: { L: 1, M: 95.1, S: 0.0402 },
  48: { L: 1, M: 102.7, S: 0.0400 },
  60: { L: 1, M: 109.4, S: 0.0402 },
  72: { L: 1, M: 115.1, S: 0.0406 },
  84: { L: 1, M: 121.0, S: 0.0410 },
  96: { L: 1, M: 126.6, S: 0.0415 },
  108: { L: 1, M: 132.2, S: 0.0420 },
  120: { L: 1, M: 137.8, S: 0.0426 },
  132: { L: 1, M: 143.7, S: 0.0432 },
  144: { L: 1, M: 150.0, S: 0.0433 },
  156: { L: 1, M: 155.3, S: 0.0424 },
  168: { L: 1, M: 158.7, S: 0.0411 },
  180: { L: 1, M: 160.5, S: 0.0400 },
  192: { L: 1, M: 161.3, S: 0.0394 },
  204: { L: 1, M: 161.7, S: 0.0391 },
  216: { L: 1, M: 161.9, S: 0.0389 },
  228: { L: 1, M: 161.9, S: 0.0389 },
}

// Weight-for-age (kg) — BOYS
const WEIGHT_FOR_AGE_BOYS: Record<number, LMSEntry> = {
  24: { L: -0.3521, M: 12.2, S: 0.1174 },
  36: { L: -0.4232, M: 14.3, S: 0.1174 },
  48: { L: -0.5181, M: 16.3, S: 0.1203 },
  60: { L: -0.6040, M: 18.3, S: 0.1241 },
  72: { L: -0.6855, M: 20.5, S: 0.1290 },
  84: { L: -0.7558, M: 22.9, S: 0.1342 },
  96: { L: -0.8115, M: 25.5, S: 0.1395 },
  108: { L: -0.8563, M: 28.1, S: 0.1439 },
  120: { L: -0.8868, M: 31.2, S: 0.1493 },
}

// Weight-for-age (kg) — GIRLS
const WEIGHT_FOR_AGE_GIRLS: Record<number, LMSEntry> = {
  24: { L: -0.3833, M: 11.5, S: 0.1189 },
  36: { L: -0.4561, M: 13.9, S: 0.1247 },
  48: { L: -0.5453, M: 16.1, S: 0.1321 },
  60: { L: -0.6293, M: 18.2, S: 0.1389 },
  72: { L: -0.7090, M: 20.5, S: 0.1461 },
  84: { L: -0.7750, M: 23.0, S: 0.1524 },
  96: { L: -0.8200, M: 25.6, S: 0.1569 },
  108: { L: -0.8498, M: 28.7, S: 0.1611 },
  120: { L: -0.8695, M: 32.0, S: 0.1644 },
}

// BMI-for-age — BOYS
const BMI_FOR_AGE_BOYS: Record<number, LMSEntry> = {
  24: { L: -0.6320, M: 16.0, S: 0.0772 },
  36: { L: -1.2861, M: 15.5, S: 0.0737 },
  48: { L: -1.5596, M: 15.3, S: 0.0729 },
  60: { L: -1.6800, M: 15.2, S: 0.0752 },
  72: { L: -1.7470, M: 15.3, S: 0.0792 },
  84: { L: -1.7750, M: 15.5, S: 0.0845 },
  96: { L: -1.7750, M: 15.8, S: 0.0903 },
  108: { L: -1.7500, M: 16.1, S: 0.0963 },
  120: { L: -1.7050, M: 16.6, S: 0.1027 },
  132: { L: -1.6420, M: 17.1, S: 0.1088 },
  144: { L: -1.5650, M: 17.7, S: 0.1144 },
  156: { L: -1.4830, M: 18.4, S: 0.1192 },
  168: { L: -1.4000, M: 19.1, S: 0.1228 },
  180: { L: -1.3200, M: 19.8, S: 0.1249 },
  192: { L: -1.2500, M: 20.5, S: 0.1259 },
  204: { L: -1.1900, M: 21.1, S: 0.1259 },
  216: { L: -1.1400, M: 21.6, S: 0.1254 },
  228: { L: -1.1000, M: 22.0, S: 0.1247 },
}

// BMI-for-age — GIRLS
const BMI_FOR_AGE_GIRLS: Record<number, LMSEntry> = {
  24: { L: -0.2290, M: 15.7, S: 0.0840 },
  36: { L: -0.7730, M: 15.3, S: 0.0816 },
  48: { L: -1.1130, M: 15.2, S: 0.0831 },
  60: { L: -1.3370, M: 15.2, S: 0.0867 },
  72: { L: -1.4930, M: 15.3, S: 0.0917 },
  84: { L: -1.5950, M: 15.5, S: 0.0972 },
  96: { L: -1.6620, M: 15.8, S: 0.1036 },
  108: { L: -1.7020, M: 16.2, S: 0.1099 },
  120: { L: -1.7200, M: 16.7, S: 0.1162 },
  132: { L: -1.7180, M: 17.3, S: 0.1219 },
  144: { L: -1.6980, M: 18.0, S: 0.1266 },
  156: { L: -1.6650, M: 18.7, S: 0.1300 },
  168: { L: -1.6220, M: 19.4, S: 0.1321 },
  180: { L: -1.5740, M: 20.0, S: 0.1327 },
  192: { L: -1.5250, M: 20.5, S: 0.1324 },
  204: { L: -1.4800, M: 20.9, S: 0.1315 },
  216: { L: -1.4400, M: 21.2, S: 0.1304 },
  228: { L: -1.4100, M: 21.4, S: 0.1296 },
}

// Find nearest LMS entry for given age in months
function findNearestLMS(table: Record<number, LMSEntry>, ageMonths: number): LMSEntry {
  const ages = Object.keys(table).map(Number).sort((a, b) => a - b)

  // Clamp to table range
  if (ageMonths <= ages[0]) return table[ages[0]]
  if (ageMonths >= ages[ages.length - 1]) return table[ages[ages.length - 1]]

  // Interpolate between nearest entries
  let lower = ages[0]
  let upper = ages[ages.length - 1]
  for (const age of ages) {
    if (age <= ageMonths) lower = age
    if (age >= ageMonths && age < upper) upper = age
  }

  if (lower === upper) return table[lower]

  // Linear interpolation
  const fraction = (ageMonths - lower) / (upper - lower)
  const lmsLower = table[lower]
  const lmsUpper = table[upper]

  return {
    L: lmsLower.L + fraction * (lmsUpper.L - lmsLower.L),
    M: lmsLower.M + fraction * (lmsUpper.M - lmsLower.M),
    S: lmsLower.S + fraction * (lmsUpper.S - lmsLower.S),
  }
}

// Calculate Z-score using LMS method
function calculateZScore(value: number, lms: LMSEntry): number {
  const { L, M, S } = lms
  if (L === 0) {
    return Math.log(value / M) / S
  }
  return (Math.pow(value / M, L) - 1) / (L * S)
}

// Z-score to percentile
function zToPercentile(z: number): number {
  // Approximation using error function
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? (1 - p) * 100 : p * 100
}

// Height-for-age Z-score
export function heightForAge(
  heightCm: number,
  ageMonths: number,
  gender: 'male' | 'female'
): AnthropometryResult {
  const table = gender === 'male' ? HEIGHT_FOR_AGE_BOYS : HEIGHT_FOR_AGE_GIRLS
  const lms = findNearestLMS(table, ageMonths)
  const z = calculateZScore(heightCm, lms)
  const percentile = zToPercentile(z)

  let classification = 'Normal'
  if (z < -3) classification = 'Severely stunted'
  else if (z < -2) classification = 'Stunted'
  else if (z > 2) classification = 'Tall'

  return {
    value: heightCm,
    unit: 'cm',
    zScore: Math.round(z * 100) / 100,
    percentile: Math.round(percentile * 10) / 10,
    classification,
    referenceTable: ageMonths <= 60 ? 'WHO 2006' : 'WHO 2007',
  }
}

// Weight-for-age Z-score
export function weightForAge(
  weightKg: number,
  ageMonths: number,
  gender: 'male' | 'female'
): AnthropometryResult {
  const table = gender === 'male' ? WEIGHT_FOR_AGE_BOYS : WEIGHT_FOR_AGE_GIRLS
  const lms = findNearestLMS(table, ageMonths)
  const z = calculateZScore(weightKg, lms)
  const percentile = zToPercentile(z)

  let classification = 'Normal'
  if (z < -3) classification = 'Severely underweight'
  else if (z < -2) classification = 'Underweight'
  else if (z > 2) classification = 'Overweight'

  return {
    value: weightKg,
    unit: 'kg',
    zScore: Math.round(z * 100) / 100,
    percentile: Math.round(percentile * 10) / 10,
    classification,
    referenceTable: ageMonths <= 60 ? 'WHO 2006' : 'WHO 2007',
  }
}

// BMI-for-age Z-score
export function bmiForAge(
  weightKg: number,
  heightCm: number,
  ageMonths: number,
  gender: 'male' | 'female'
): AnthropometryResult {
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  const table = gender === 'male' ? BMI_FOR_AGE_BOYS : BMI_FOR_AGE_GIRLS
  const lms = findNearestLMS(table, ageMonths)
  const z = calculateZScore(bmi, lms)
  const percentile = zToPercentile(z)

  let classification = 'Normal'
  if (z > 3) classification = 'Obese (severe)'
  else if (z > 2) classification = 'Obese'
  else if (z > 1) classification = 'Overweight'
  else if (z < -3) classification = 'Severely wasted'
  else if (z < -2) classification = 'Wasted'

  return {
    value: Math.round(bmi * 10) / 10,
    unit: 'kg/m\u00B2',
    zScore: Math.round(z * 100) / 100,
    percentile: Math.round(percentile * 10) / 10,
    classification,
    referenceTable: ageMonths <= 60 ? 'WHO 2006' : 'WHO 2007',
  }
}

// Weight-for-Height (kg for given height cm) — BOYS
// WHO 2006 Child Growth Standards (45-120 cm)
const WEIGHT_FOR_HEIGHT_BOYS: Record<number, LMSEntry> = {
  45: { L: -0.3521, M: 2.4, S: 0.0924 },
  50: { L: -0.3521, M: 3.2, S: 0.0904 },
  55: { L: -0.3521, M: 4.3, S: 0.0882 },
  60: { L: -0.3521, M: 5.5, S: 0.0862 },
  65: { L: -0.3521, M: 7.0, S: 0.0847 },
  70: { L: -0.3521, M: 8.2, S: 0.0842 },
  75: { L: -0.3521, M: 9.2, S: 0.0844 },
  80: { L: -0.3521, M: 10.1, S: 0.0850 },
  85: { L: -0.3521, M: 10.9, S: 0.0860 },
  90: { L: -0.3521, M: 11.7, S: 0.0877 },
  95: { L: -0.3521, M: 12.6, S: 0.0898 },
  100: { L: -0.3521, M: 13.5, S: 0.0923 },
  105: { L: -0.3521, M: 14.5, S: 0.0952 },
  110: { L: -0.3521, M: 15.6, S: 0.0984 },
  115: { L: -0.3521, M: 16.8, S: 0.1018 },
  120: { L: -0.3521, M: 18.2, S: 0.1054 },
}

// Weight-for-Height (kg for given height cm) — GIRLS
const WEIGHT_FOR_HEIGHT_GIRLS: Record<number, LMSEntry> = {
  45: { L: -0.3833, M: 2.3, S: 0.0948 },
  50: { L: -0.3833, M: 3.1, S: 0.0922 },
  55: { L: -0.3833, M: 4.1, S: 0.0896 },
  60: { L: -0.3833, M: 5.3, S: 0.0873 },
  65: { L: -0.3833, M: 6.7, S: 0.0855 },
  70: { L: -0.3833, M: 7.8, S: 0.0847 },
  75: { L: -0.3833, M: 8.8, S: 0.0847 },
  80: { L: -0.3833, M: 9.7, S: 0.0854 },
  85: { L: -0.3833, M: 10.5, S: 0.0866 },
  90: { L: -0.3833, M: 11.3, S: 0.0886 },
  95: { L: -0.3833, M: 12.1, S: 0.0912 },
  100: { L: -0.3833, M: 13.0, S: 0.0944 },
  105: { L: -0.3833, M: 14.0, S: 0.0980 },
  110: { L: -0.3833, M: 15.1, S: 0.1019 },
  115: { L: -0.3833, M: 16.3, S: 0.1059 },
  120: { L: -0.3833, M: 17.7, S: 0.1098 },
}

// Weight-for-Height Z-score (wasting indicator)
// Uses height as the index (not age). Applicable for children 45-120cm (~0-5 years).
export function weightForHeight(
  weightKg: number,
  heightCm: number,
  gender: 'male' | 'female'
): AnthropometryResult {
  const table = gender === 'male' ? WEIGHT_FOR_HEIGHT_BOYS : WEIGHT_FOR_HEIGHT_GIRLS
  const lms = findNearestLMS(table, heightCm)  // height as key, interpolation works identically
  const z = calculateZScore(weightKg, lms)
  const percentile = zToPercentile(z)

  let classification = 'Normal'
  if (z < -3) classification = 'Severe wasting (SAM)'
  else if (z < -2) classification = 'Moderate wasting (MAM)'
  else if (z > 3) classification = 'Obese'
  else if (z > 2) classification = 'Overweight'

  return {
    value: weightKg,
    unit: 'kg',
    zScore: Math.round(z * 100) / 100,
    percentile: Math.round(percentile * 10) / 10,
    classification,
    referenceTable: 'WHO 2006 WFH',
  }
}

// MUAC classification (WHO, children 6-59 months)
export function classifyMUAC(
  muacMm: number
): { label: string; color: string; severity: string; band: 'red' | 'yellow' | 'green' } {
  if (muacMm < 115) {
    return { label: 'SAM (Severe Acute Malnutrition)', color: 'bg-red-50 border-red-300 text-red-700', severity: 'severe', band: 'red' }
  }
  if (muacMm <= 125) {
    return { label: 'MAM (Moderate Acute Malnutrition)', color: 'bg-yellow-50 border-yellow-300 text-yellow-700', severity: 'moderate', band: 'yellow' }
  }
  return { label: 'Normal', color: 'bg-green-50 border-green-300 text-green-700', severity: 'normal', band: 'green' }
}

// SpO2 classification
export function classifySpO2(value: number): { label: string; color: string; severity: string } {
  if (value >= 95) return { label: 'Normal', color: 'bg-green-50 border-green-300 text-green-700', severity: 'normal' }
  if (value >= 90) return { label: 'Mild Hypoxia', color: 'bg-yellow-50 border-yellow-300 text-yellow-700', severity: 'mild' }
  if (value >= 85) return { label: 'Moderate Hypoxia', color: 'bg-orange-50 border-orange-300 text-orange-700', severity: 'moderate' }
  return { label: 'Severe Hypoxia', color: 'bg-red-50 border-red-300 text-red-700', severity: 'severe' }
}

// Hemoglobin / Anemia classification (WHO 2011)
export function classifyAnemia(
  hbValue: number,
  ageMonths: number,
  gender: 'male' | 'female'
): { label: string; color: string; severity: string } {
  // WHO 2011 cutoffs
  let normalThreshold: number
  let mildThreshold: number
  let moderateThreshold: number

  if (ageMonths < 60) {
    // 6-59 months
    normalThreshold = 11.0
    mildThreshold = 10.0
    moderateThreshold = 7.0
  } else if (ageMonths < 144) {
    // 5-11 years
    normalThreshold = 11.5
    mildThreshold = 11.0
    moderateThreshold = 8.0
  } else if (ageMonths < 180) {
    // 12-14 years
    normalThreshold = 12.0
    mildThreshold = 11.0
    moderateThreshold = 8.0
  } else {
    // 15+ years
    if (gender === 'male') {
      normalThreshold = 13.0
      mildThreshold = 11.0
      moderateThreshold = 8.0
    } else {
      normalThreshold = 12.0
      mildThreshold = 11.0
      moderateThreshold = 8.0
    }
  }

  if (hbValue >= normalThreshold) {
    return { label: 'Normal', color: 'bg-green-50 border-green-300 text-green-700', severity: 'normal' }
  }
  if (hbValue >= mildThreshold) {
    return { label: 'Mild Anemia', color: 'bg-yellow-50 border-yellow-300 text-yellow-700', severity: 'mild' }
  }
  if (hbValue >= moderateThreshold) {
    return { label: 'Moderate Anemia', color: 'bg-orange-50 border-orange-300 text-orange-700', severity: 'moderate' }
  }
  return { label: 'Severe Anemia', color: 'bg-red-50 border-red-300 text-red-700', severity: 'severe' }
}
