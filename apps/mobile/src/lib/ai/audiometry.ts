/**
 * Pure-Tone Audiometry — smartphone hearing screening.
 *
 * Tests thresholds at 500, 1000, 2000, 4000 Hz per ear.
 * Method: Modified Hughson-Westlake (5 dB down, 10 dB up).
 * WHO: disabling hearing impairment = PTA > 30 dB in children.
 *
 * Enhanced with:
 *   - Speech-frequency PTA (500, 1000, 2000 Hz) — most clinically relevant for children
 *   - High-frequency PTA (2000, 4000 Hz) — early noise damage detection
 *   - Hearing handicap estimation (AAO-HNS formula)
 *   - Frequency pattern detection (flat, sloping, rising, notch, normal)
 *   - Age-appropriate test protocol selection
 *   - Audiogram data generation for visualization
 *
 * References:
 * - WHO Global Estimates on Hearing Loss (2021)
 * - AAO-HNS Hearing Handicap Formula
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
  // Enhanced fields
  speechPTALeft: number       // 500, 1000, 2000 Hz average
  speechPTARight: number
  highFreqPTALeft: number     // 2000, 4000 Hz average
  highFreqPTARight: number
  asymmetry: boolean          // >15 dB difference between ears
  asymmetryDB: number         // absolute difference
  frequencyPattern: FrequencyPattern
  hearingHandicap: number     // AAO-HNS percentage (0-100)
  testProtocol: TestProtocol
}

export type FrequencyPattern = 'normal' | 'flat' | 'sloping' | 'rising' | 'notch' | 'cookie-bite'
export type TestProtocol = 'play' | 'standard' | 'self-report'

/** Audiogram data point for visualization. */
export interface AudiogramPoint {
  frequency: number
  ear: Ear
  thresholdDB: number
  isInterpolated: boolean
}

/** Ambient noise measurement result. */
export interface AmbientNoiseResult {
  levelDB: number         // approximate dB SPL
  acceptable: boolean     // <40 dB for valid audiometry
  recommendation: string  // guidance for nurse
}

// ── WHO Classification ──

/** WHO hearing loss classification by PTA (dB HL) */
export function classifyHearingLoss(ptaDB: number): string {
  if (ptaDB <= 15) return 'Normal'
  if (ptaDB <= 25) return 'Slight'
  if (ptaDB <= 40) return 'Mild'
  if (ptaDB <= 55) return 'Moderate'
  if (ptaDB <= 70) return 'Moderately severe'
  if (ptaDB <= 90) return 'Severe'
  return 'Profound'
}

/** Get severity color for hearing classification. */
export function getHearingColor(ptaDB: number): string {
  if (ptaDB <= 15) return '#16a34a'    // green
  if (ptaDB <= 25) return '#65a30d'    // lime
  if (ptaDB <= 40) return '#ca8a04'    // yellow
  if (ptaDB <= 55) return '#ea580c'    // orange
  if (ptaDB <= 70) return '#dc2626'    // red
  if (ptaDB <= 90) return '#991b1b'    // dark red
  return '#7c3aed'                      // purple
}

// ── PTA Calculations ──

/** Calculate Pure-Tone Average from threshold measurements */
export function calculatePTA(thresholds: AudiometryThreshold[], ear: Ear): number {
  const earThresholds = thresholds.filter(t => t.ear === ear)
  if (earThresholds.length === 0) return 0
  return Math.round(earThresholds.reduce((sum, t) => sum + t.thresholddB, 0) / earThresholds.length)
}

/** Speech-frequency PTA (500, 1000, 2000 Hz) — most relevant for children's communication. */
export function calculateSpeechPTA(thresholds: AudiometryThreshold[], ear: Ear): number {
  const speechFreqs = [500, 1000, 2000]
  const relevant = thresholds.filter(t => t.ear === ear && speechFreqs.includes(t.frequency))
  if (relevant.length === 0) return 0
  return Math.round(relevant.reduce((sum, t) => sum + t.thresholddB, 0) / relevant.length)
}

/** High-frequency PTA (2000, 4000 Hz) — early noise-induced damage indicator. */
export function calculateHighFreqPTA(thresholds: AudiometryThreshold[], ear: Ear): number {
  const highFreqs = [2000, 4000]
  const relevant = thresholds.filter(t => t.ear === ear && highFreqs.includes(t.frequency))
  if (relevant.length === 0) return 0
  return Math.round(relevant.reduce((sum, t) => sum + t.thresholddB, 0) / relevant.length)
}

// ── Frequency Pattern Detection ──

/** Detect the audiometric configuration/pattern. */
function detectFrequencyPattern(thresholds: AudiometryThreshold[], ear: Ear): FrequencyPattern {
  const get = (freq: number) => {
    const t = thresholds.find(th => th.ear === ear && th.frequency === freq)
    return t?.thresholddB ?? 0
  }

  const t500 = get(500)
  const t1000 = get(1000)
  const t2000 = get(2000)
  const t4000 = get(4000)

  // All within normal range
  if (Math.max(t500, t1000, t2000, t4000) <= 20) return 'normal'

  // Cookie-bite: mid-frequency loss with better low and high
  if (t1000 > t500 + 10 && t1000 > t4000 + 10) return 'cookie-bite'
  if (t2000 > t500 + 10 && t2000 > t4000 + 10) return 'cookie-bite'

  // Sloping: progressive high-frequency loss
  if (t4000 - t500 > 20) return 'sloping'

  // Rising: better at high frequencies (rare in children)
  if (t500 - t4000 > 20) return 'rising'

  // Notch: specific 4000 Hz dip (noise-induced)
  if (t4000 > t2000 + 15 && t4000 > t1000 + 15) return 'notch'

  // Flat: similar across all frequencies
  const range = Math.max(t500, t1000, t2000, t4000) - Math.min(t500, t1000, t2000, t4000)
  if (range <= 20 && Math.max(t500, t1000, t2000, t4000) > 20) return 'flat'

  return 'flat'
}

// ── Hearing Handicap ──

/**
 * AAO-HNS Hearing Handicap Formula.
 * Estimates percentage disability based on better-ear PTA.
 * Formula: (better ear PTA - 25) × 1.5, capped at 0-100%.
 */
export function calculateHearingHandicap(betterEarPTA: number): number {
  if (betterEarPTA <= 25) return 0
  return Math.min(100, Math.round((betterEarPTA - 25) * 1.5))
}

// ── Age-Appropriate Protocol ──

/** Select test protocol based on child's age in months. */
export function selectTestProtocol(ageMonths: number): TestProtocol {
  if (ageMonths < 60) return 'play'        // 3-5 years: conditioned play audiometry
  if (ageMonths < 96) return 'standard'     // 5-8 years: standard hand-raise
  return 'self-report'                       // 8+: full self-report
}

/** Get protocol instructions for the nurse. */
export function getProtocolInstructions(protocol: TestProtocol): {
  title: string
  instructions: string[]
  responseMethod: string
} {
  switch (protocol) {
    case 'play':
      return {
        title: 'Play Audiometry (Age 3-5)',
        instructions: [
          'Show child how to drop a block in a bucket when they hear a sound',
          'Practice with a loud tone first',
          'Use engaging toys to maintain attention',
          'Take breaks if child loses interest',
        ],
        responseMethod: 'Child drops block or touches toy when they hear the sound',
      }
    case 'standard':
      return {
        title: 'Standard Audiometry (Age 5-8)',
        instructions: [
          'Ask child to raise their hand when they hear a beep',
          'Demonstrate with a practice tone',
          'Encourage child to respond even to very soft sounds',
          'Watch for uncertain responses \u2014 they still count',
        ],
        responseMethod: 'Child raises hand when they hear the tone',
      }
    case 'self-report':
      return {
        title: 'Self-Report Audiometry (Age 8+)',
        instructions: [
          'Child presses button or taps screen when they hear a tone',
          'Explain: "Press as soon as you hear any sound, even if very quiet"',
          'Ensure child understands before starting',
        ],
        responseMethod: 'Child presses button/taps screen when tone is heard',
      }
  }
}

// ── Ambient Noise ──

/**
 * Estimate ambient noise level from audio recording.
 * @param channelData - PCM float samples from 3-second ambient recording
 * @param sampleRate - Audio sample rate (typically 44100)
 */
export function measureAmbientNoise(channelData: Float32Array, sampleRate: number): AmbientNoiseResult {
  // Calculate RMS
  let sumSquares = 0
  for (let i = 0; i < channelData.length; i++) {
    sumSquares += channelData[i] * channelData[i]
  }
  const rms = Math.sqrt(sumSquares / channelData.length)

  // Convert RMS to approximate dB SPL
  // Smartphone mic reference: -38 dBFS ≈ 94 dB SPL (typical MEMS mic)
  const dbFS = rms > 0 ? 20 * Math.log10(rms) : -100
  const dbSPL = Math.round(dbFS + 94 + 38) // approximate

  const acceptable = dbSPL < 40

  let recommendation: string
  if (dbSPL < 30) {
    recommendation = 'Very quiet \u2014 excellent for hearing test'
  } else if (dbSPL < 40) {
    recommendation = 'Acceptable noise level for screening'
  } else if (dbSPL < 50) {
    recommendation = 'Room is noisy \u2014 results may be affected. Move to a quieter room if possible'
  } else {
    recommendation = 'Too noisy for accurate hearing screening. Find a quiet room before testing'
  }

  return { levelDB: Math.max(0, dbSPL), acceptable, recommendation }
}

// ── Audiogram Data ──

/**
 * Generate audiogram data points for visualization.
 * Returns points sorted by frequency for each ear.
 */
export function generateAudiogramData(thresholds: AudiometryThreshold[]): AudiogramPoint[] {
  const freqOrder = [500, 1000, 2000, 4000]
  const points: AudiogramPoint[] = []

  for (const ear of ['left', 'right'] as Ear[]) {
    for (const freq of freqOrder) {
      const threshold = thresholds.find(t => t.ear === ear && t.frequency === freq)
      points.push({
        frequency: freq,
        ear,
        thresholdDB: threshold?.thresholddB ?? -1,
        isInterpolated: !threshold,
      })
    }
  }

  return points
}

/** WHO classification zones for audiogram (dB ranges). */
export const AUDIOGRAM_ZONES = [
  { label: 'Normal', minDB: -10, maxDB: 20, color: '#dcfce7' },
  { label: 'Slight', minDB: 20, maxDB: 25, color: '#fef9c3' },
  { label: 'Mild', minDB: 25, maxDB: 40, color: '#fef3c7' },
  { label: 'Moderate', minDB: 40, maxDB: 55, color: '#fed7aa' },
  { label: 'Moderately Severe', minDB: 55, maxDB: 70, color: '#fecaca' },
  { label: 'Severe', minDB: 70, maxDB: 90, color: '#fca5a5' },
  { label: 'Profound', minDB: 90, maxDB: 120, color: '#f87171' },
] as const

// ── Main Result Generator ──

/** Generate complete enhanced audiometry result from threshold measurements. */
export function generateAudiometryResult(
  thresholds: AudiometryThreshold[],
  ageMonths?: number
): AudiometryResult {
  const ptaLeft = calculatePTA(thresholds, 'left')
  const ptaRight = calculatePTA(thresholds, 'right')
  const ptaBetter = Math.min(ptaLeft, ptaRight)

  const speechPTALeft = calculateSpeechPTA(thresholds, 'left')
  const speechPTARight = calculateSpeechPTA(thresholds, 'right')
  const highFreqPTALeft = calculateHighFreqPTA(thresholds, 'left')
  const highFreqPTARight = calculateHighFreqPTA(thresholds, 'right')

  const asymmetryDB = Math.abs(ptaLeft - ptaRight)
  const asymmetry = asymmetryDB > 15

  // Use better ear for pattern detection
  const patternEar: Ear = ptaLeft <= ptaRight ? 'left' : 'right'
  const frequencyPattern = detectFrequencyPattern(thresholds, patternEar)

  const hearingHandicap = calculateHearingHandicap(ptaBetter)
  const testProtocol = ageMonths ? selectTestProtocol(ageMonths) : 'standard'

  return {
    thresholds,
    ptaLeft,
    ptaRight,
    ptaBetter,
    classificationLeft: classifyHearingLoss(ptaLeft),
    classificationRight: classifyHearingLoss(ptaRight),
    overallClassification: classifyHearingLoss(ptaBetter),
    speechPTALeft,
    speechPTARight,
    highFreqPTALeft,
    highFreqPTARight,
    asymmetry,
    asymmetryDB,
    frequencyPattern,
    hearingHandicap,
    testProtocol,
  }
}

// ── Chip Suggestions ──

/** Suggest annotation chip IDs based on enhanced audiometry results. */
export function suggestHearingChips(result: AudiometryResult): string[] {
  const chips: string[] = []

  // Overall classification
  if (result.ptaBetter <= 20) chips.push('hr1')     // Normal hearing
  else if (result.ptaBetter <= 25) chips.push('hr2') // Slight loss
  else if (result.ptaBetter <= 40) chips.push('hr3') // Mild loss
  else if (result.ptaBetter <= 55) chips.push('hr4') // Moderate loss
  else chips.push('hr5')                              // Severe/profound

  // Unilateral vs bilateral
  if (result.asymmetry) {
    chips.push('hr6')  // Unilateral/asymmetric
    chips.push('hr8')  // Significant asymmetry
  }

  // Frequency pattern
  if (result.frequencyPattern === 'sloping') chips.push('hr7')    // High-frequency loss
  else if (result.frequencyPattern === 'notch') chips.push('hr9') // 4kHz notch
  else if (result.frequencyPattern === 'rising') chips.push('hr10')

  // Speech-frequency specific concern (even if PTA is borderline)
  const speechPTABetter = Math.min(result.speechPTALeft, result.speechPTARight)
  if (speechPTABetter > 25 && result.ptaBetter <= 25) {
    // PTA is borderline but speech frequencies affected
    chips.push('hr3') // flag as mild concern
  }

  // High-frequency early warning
  const highFreqBetter = Math.min(result.highFreqPTALeft, result.highFreqPTARight)
  if (highFreqBetter > 30 && result.ptaBetter <= 25) {
    chips.push('hr7') // high-frequency loss even if PTA normal
  }

  return [...new Set(chips)]
}
