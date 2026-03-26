// ============================================
// Welch Allyn → SKIDS Vision Observation Mapper
// Converts Spot Vision Screener results into SKIDS
// annotation data, risk categories, and observation payloads
// ============================================

import type {
  WelchAllynScreening,
  WelchAllynCondition,
  EyeRefraction,
} from './types'
import { WELCHALLYN_TO_SKIDS_CHIP } from './types'
import { ageMonthsToYears } from './parser'

export interface WelchAllynToSkidsMapping {
  /** SKIDS chip IDs to auto-select */
  suggestedChips: string[]
  /** Human-readable labels for suggested chips */
  suggestedChipLabels: string[]
  /** Rich summary text for notes field */
  summaryText: string
  /** Risk category for the screening */
  riskCategory: 'no_risk' | 'possible_risk' | 'high_risk'
  /** Per-condition details */
  conditionDetails: Array<{
    condition: string
    eye: string
    chipId: string
    chipLabel: string
    severity: string
    value?: number
  }>
  /** Formatted prescription strings */
  prescription: {
    od: string   // e.g. "+1.25 / -2.50 x 1°"
    os: string
  }
  /** Refraction data for structured storage */
  refractionData: {
    od: RefractionSummary
    os: RefractionSummary
    interpupilDistance: number
  }
}

interface RefractionSummary {
  se: number
  ds: number
  dc: number
  axis: number
  pupilSize: number
  gazeX: number
  gazeY: number
  passed: boolean
}

/**
 * Map a Welch Allyn screening to SKIDS vision observation data.
 */
export function mapWelchAllynToSkids(screening: WelchAllynScreening): WelchAllynToSkidsMapping {
  // Build chip suggestions from conditions
  const chipSet = new Set<string>()
  const chipLabelSet = new Set<string>()
  const conditionDetails: WelchAllynToSkidsMapping['conditionDetails'] = []

  for (const cond of screening.conditions) {
    const mapping = WELCHALLYN_TO_SKIDS_CHIP[cond.type]
    if (mapping) {
      chipSet.add(mapping.chipId)
      chipLabelSet.add(mapping.label)
      conditionDetails.push({
        condition: cond.label,
        eye: cond.eye,
        chipId: mapping.chipId,
        chipLabel: mapping.label,
        severity: cond.severity,
        value: cond.value,
      })
    }
  }

  // Determine risk category
  let riskCategory: 'no_risk' | 'possible_risk' | 'high_risk' = 'no_risk'
  if (!screening.passed) {
    const hasSevere = screening.conditions.some(c => c.severity === 'severe')
    const hasMultiple = screening.conditions.length >= 2
    riskCategory = (hasSevere || hasMultiple) ? 'high_risk' : 'possible_risk'
  }

  // Build formatted prescription
  const odRx = formatPrescription(screening.od)
  const osRx = formatPrescription(screening.os)

  // Build summary text
  const summaryText = buildSummaryText(screening, conditionDetails)

  return {
    suggestedChips: Array.from(chipSet),
    suggestedChipLabels: Array.from(chipLabelSet),
    summaryText,
    riskCategory,
    conditionDetails,
    prescription: { od: odRx, os: osRx },
    refractionData: {
      od: {
        se: screening.od.sphericalEquivalent,
        ds: screening.od.sphere,
        dc: screening.od.cylinder,
        axis: screening.od.axis,
        pupilSize: screening.od.pupilSize,
        gazeX: screening.od.gazeX,
        gazeY: screening.od.gazeY,
        passed: screening.od.sePass && screening.od.dcPass,
      },
      os: {
        se: screening.os.sphericalEquivalent,
        ds: screening.os.sphere,
        dc: screening.os.cylinder,
        axis: screening.os.axis,
        pupilSize: screening.os.pupilSize,
        gazeX: screening.os.gazeX,
        gazeY: screening.os.gazeY,
        passed: screening.os.sePass && screening.os.dcPass,
      },
      interpupilDistance: screening.interpupilDistance,
    },
  }
}

/** Format eye refraction as prescription string: "+1.25 / -2.50 x 1°" */
function formatPrescription(eye: EyeRefraction): string {
  return `${eye.formattedDS} / ${eye.formattedDC} x ${eye.formattedAxis}`
}

/** Build rich summary text for SKIDS notes */
function buildSummaryText(
  screening: WelchAllynScreening,
  details: WelchAllynToSkidsMapping['conditionDetails'],
): string {
  const lines: string[] = []

  lines.push(`[Welch Allyn Spot Vision Screener]`)
  lines.push(`Device: ${screening.deviceSerial} (SW ${screening.swVersion})`)
  lines.push(`Date: ${screening.timestamp}`)
  lines.push(`Patient: ${screening.fullName}, ${screening.gender}, Age ${ageMonthsToYears(screening.ageInMonths)}`)
  lines.push(`DOB: ${screening.dateOfBirth}`)
  lines.push('')
  lines.push(`Result: ${screening.passed ? 'PASSED ✓' : 'FAILED — Refer ✗'}`)
  lines.push(`Status: ${screening.resultText}`)
  lines.push('')

  // Refraction
  lines.push(`OD (Right): SE ${formatSE(screening.od.sphericalEquivalent)}, Rx ${screening.od.formattedDS} / ${screening.od.formattedDC} ${screening.od.formattedAxis}`)
  lines.push(`OS (Left):  SE ${formatSE(screening.os.sphericalEquivalent)}, Rx ${screening.os.formattedDS} / ${screening.os.formattedDC} ${screening.os.formattedAxis}`)
  lines.push(`IPD: ${screening.interpupilDistance.toFixed(1)} mm`)

  // Conditions
  if (details.length > 0) {
    lines.push('')
    lines.push('Findings:')
    for (const d of details) {
      const valStr = d.value !== undefined ? ` (${formatSE(d.value)})` : ''
      lines.push(`  • ${d.condition} — ${d.eye}${valStr} [${d.severity}]`)
    }
  }

  return lines.join('\n')
}

function formatSE(val: number): string {
  if (val === 0) return '0.00'
  return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)
}

/**
 * Generate a batch summary for multiple screenings (for campaign reports).
 */
export function generateBatchSummary(screenings: WelchAllynScreening[]): string {
  const total = screenings.length
  const passed = screenings.filter(s => s.passed).length
  const failed = total - passed

  const lines: string[] = []
  lines.push(`=== Welch Allyn Batch Vision Screening Summary ===`)
  lines.push(`Total Screened: ${total}`)
  lines.push(`Passed: ${passed} (${((passed / total) * 100).toFixed(0)}%)`)
  lines.push(`Refer: ${failed} (${((failed / total) * 100).toFixed(0)}%)`)
  lines.push('')

  // Condition prevalence
  const condCounts: Record<string, number> = {}
  for (const s of screenings) {
    for (const c of s.conditions) {
      condCounts[c.label] = (condCounts[c.label] || 0) + 1
    }
  }

  if (Object.keys(condCounts).length > 0) {
    lines.push('Condition Prevalence:')
    for (const [name, count] of Object.entries(condCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${name}: ${count}/${total} (${((count / total) * 100).toFixed(0)}%)`)
    }
    lines.push('')
  }

  // Failed children list
  if (failed > 0) {
    lines.push('Children Requiring Referral:')
    for (const s of screenings.filter(s => !s.passed)) {
      lines.push(`  • ${s.fullName} (${ageMonthsToYears(s.ageInMonths)}) — ${s.resultText}`)
    }
  }

  return lines.join('\n')
}
