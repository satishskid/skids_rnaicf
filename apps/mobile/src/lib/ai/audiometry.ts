/**
 * Pure-Tone Audiometry — smartphone hearing screening.
 *
 * Tests thresholds at 500, 1000, 2000, 4000 Hz per ear.
 * Method: Modified Hughson-Westlake (5 dB down, 10 dB up).
 * WHO: disabling hearing impairment = PTA > 30 dB in children.
 *
 * References:
 * - WHO Global Estimates on Hearing Loss (2021)
 * - Sound Scouts (NAL Australia), GoCheck Kids (AAP-validated)
 */

export const TEST_FREQUENCIES = [1000, 500, 2000, 4000] as const
export type TestFrequency = (typeof TEST_FREQUENCIES)[number]
export type Ear = 'left' | 'right'

export interface AudiometryThreshold {
  frequency: TestFrequency
  ear: Ear
  thresholddB: number
}

export interface AudiometryResult {
  thresholds: AudiometryThreshold[]
  ptaLeft: number
  ptaRight: number
  ptaBetter: number
  classificationLeft: string
  classificationRight: string
  overallClassification: string
}

/** WHO hearing loss classification by PTA (dB HL) */
export function classifyHearingLoss(ptaDB: number): string {
  if (ptaDB <= 20) return 'Normal'
  if (ptaDB <= 25) return 'Slight'
  if (ptaDB <= 40) return 'Mild'
  if (ptaDB <= 55) return 'Moderate'
  if (ptaDB <= 70) return 'Moderately severe'
  if (ptaDB <= 90) return 'Severe'
  return 'Profound'
}

/** Calculate Pure-Tone Average from threshold measurements */
export function calculatePTA(thresholds: AudiometryThreshold[], ear: Ear): number {
  const earThresholds = thresholds.filter(t => t.ear === ear)
  if (earThresholds.length === 0) return 0
  return Math.round(earThresholds.reduce((sum, t) => sum + t.thresholddB, 0) / earThresholds.length)
}

/** Generate complete audiometry result from threshold measurements */
export function generateAudiometryResult(thresholds: AudiometryThreshold[]): AudiometryResult {
  const ptaLeft = calculatePTA(thresholds, 'left')
  const ptaRight = calculatePTA(thresholds, 'right')
  const ptaBetter = Math.min(ptaLeft, ptaRight)

  return {
    thresholds,
    ptaLeft,
    ptaRight,
    ptaBetter,
    classificationLeft: classifyHearingLoss(ptaLeft),
    classificationRight: classifyHearingLoss(ptaRight),
    overallClassification: classifyHearingLoss(ptaBetter),
  }
}

/** Suggest annotation chip IDs based on audiometry results */
export function suggestHearingChips(result: AudiometryResult): string[] {
  const chips: string[] = []

  if (result.ptaBetter <= 20) chips.push('hr1')
  else if (result.ptaBetter <= 25) chips.push('hr2')
  else if (result.ptaBetter <= 40) chips.push('hr3')
  else if (result.ptaBetter <= 55) chips.push('hr4')
  else chips.push('hr5')

  // Asymmetry check (>15 dB between ears)
  if (Math.abs(result.ptaLeft - result.ptaRight) > 15) {
    chips.push('hr8')
  }

  // High-frequency vs low-frequency pattern
  for (const ear of ['left', 'right'] as Ear[]) {
    const earThresholds = result.thresholds.filter(t => t.ear === ear)
    const lowAvg = earThresholds.filter(t => t.frequency <= 1000).reduce((s, t) => s + t.thresholddB, 0) / 2
    const highAvg = earThresholds.filter(t => t.frequency >= 2000).reduce((s, t) => s + t.thresholddB, 0) / 2

    if (highAvg - lowAvg > 15) chips.push('hr9')
    if (lowAvg - highAvg > 15) chips.push('hr10')
  }

  return [...new Set(chips)]
}
