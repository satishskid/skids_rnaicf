/**
 * Pure-Tone Audiometry via Web Audio API
 *
 * Smartphone-based hearing screening inspired by Sound Scouts (NAL Australia)
 * and GoCheck Kids (AAP-validated).
 *
 * Tests hearing thresholds at 500, 1000, 2000, 4000 Hz for each ear separately
 * using calibrated pure tones via earphones/headphones.
 *
 * WHO definition: disabling hearing impairment = PTA > 30 dB in children
 *
 * Standard frequencies tested: 500, 1000, 2000, 4000 Hz
 * Method: Modified Hughson-Westlake (5 dB down, 10 dB up)
 * PTA = mean of thresholds at 500, 1000, 2000, 4000 Hz
 *
 * References:
 * - WHO Global Estimates on Hearing Loss (2021)
 * - Mimi app validation: sensitivity 0.971, specificity 0.912
 * - Published in International Journal of Audiology
 */

export const TEST_FREQUENCIES = [1000, 500, 2000, 4000] as const
export type TestFrequency = typeof TEST_FREQUENCIES[number]
export type Ear = 'left' | 'right'

export interface AudiometryThreshold {
  frequency: TestFrequency
  ear: Ear
  thresholddB: number // hearing threshold in dB HL
}

export interface AudiometryResult {
  thresholds: AudiometryThreshold[]
  ptaLeft: number  // pure-tone average left ear
  ptaRight: number // pure-tone average right ear
  ptaBetter: number // PTA of better ear
  classificationLeft: string
  classificationRight: string
  overallClassification: string
}

// WHO hearing loss classification by PTA (dB HL)
export function classifyHearingLoss(ptaDB: number): string {
  if (ptaDB <= 20) return 'Normal'
  if (ptaDB <= 25) return 'Slight'
  if (ptaDB <= 40) return 'Mild'
  if (ptaDB <= 55) return 'Moderate'
  if (ptaDB <= 70) return 'Moderately severe'
  if (ptaDB <= 90) return 'Severe'
  return 'Profound'
}

export function getHearingColor(ptaDB: number): string {
  if (ptaDB <= 20) return 'bg-green-50 border-green-300 text-green-700'
  if (ptaDB <= 25) return 'bg-lime-50 border-lime-300 text-lime-700'
  if (ptaDB <= 40) return 'bg-yellow-50 border-yellow-300 text-yellow-700'
  if (ptaDB <= 55) return 'bg-orange-50 border-orange-300 text-orange-700'
  return 'bg-red-50 border-red-300 text-red-700'
}

/**
 * Generate a pure tone using Web Audio API.
 * Returns a stop function to end playback.
 */
export function playTone(
  frequency: number,
  volumeDB: number,
  ear: Ear,
  durationMs: number = 1000
): { stop: () => void; promise: Promise<void> } {
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()

  // Create oscillator
  const oscillator = audioCtx.createOscillator()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime)

  // Create gain node for volume control
  // dB HL to linear gain: gain = 10^(dB/20) * referenceGain
  // We use a reference gain that maps 0 dB HL to a comfortable baseline
  const referenceGain = 0.001 // Very quiet baseline (~0 dB HL calibration reference)
  const linearGain = referenceGain * Math.pow(10, volumeDB / 20)
  const gainNode = audioCtx.createGain()
  gainNode.gain.setValueAtTime(Math.min(linearGain, 1.0), audioCtx.currentTime)

  // Apply fade in/out to avoid clicks (20ms ramps)
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime)
  gainNode.gain.linearRampToValueAtTime(
    Math.min(linearGain, 1.0),
    audioCtx.currentTime + 0.02
  )
  gainNode.gain.setValueAtTime(
    Math.min(linearGain, 1.0),
    audioCtx.currentTime + durationMs / 1000 - 0.02
  )
  gainNode.gain.linearRampToValueAtTime(
    0,
    audioCtx.currentTime + durationMs / 1000
  )

  // Pan to specific ear using StereoPannerNode
  const panner = audioCtx.createStereoPanner()
  panner.pan.setValueAtTime(ear === 'left' ? -1 : 1, audioCtx.currentTime)

  // Connect: oscillator → gain → panner → destination
  oscillator.connect(gainNode)
  gainNode.connect(panner)
  panner.connect(audioCtx.destination)

  oscillator.start()
  oscillator.stop(audioCtx.currentTime + durationMs / 1000)

  let resolved = false
  const promise = new Promise<void>((resolve) => {
    oscillator.onended = () => {
      if (!resolved) {
        resolved = true
        audioCtx.close()
        resolve()
      }
    }
  })

  return {
    stop: () => {
      if (!resolved) {
        resolved = true
        oscillator.stop()
        audioCtx.close()
      }
    },
    promise,
  }
}

/**
 * Calculate Pure-Tone Average from threshold measurements
 */
export function calculatePTA(thresholds: AudiometryThreshold[], ear: Ear): number {
  const earThresholds = thresholds.filter((t) => t.ear === ear)
  if (earThresholds.length === 0) return 0

  const sum = earThresholds.reduce((acc, t) => acc + t.thresholddB, 0)
  return Math.round(sum / earThresholds.length)
}

/**
 * Generate complete audiometry result from threshold measurements
 */
export function generateAudiometryResult(
  thresholds: AudiometryThreshold[]
): AudiometryResult {
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

/**
 * Suggest annotation chip IDs based on audiometry results
 */
export function suggestHearingChips(result: AudiometryResult): string[] {
  const chips: string[] = []

  if (result.ptaBetter <= 20) {
    chips.push('hr1') // Normal
  } else if (result.ptaBetter <= 25) {
    chips.push('hr2') // Slight
  } else if (result.ptaBetter <= 40) {
    chips.push('hr3') // Mild
  } else if (result.ptaBetter <= 55) {
    chips.push('hr4') // Moderate
  } else {
    chips.push('hr5') // Severe
  }

  // Check for asymmetry (>15 dB difference between ears)
  if (Math.abs(result.ptaLeft - result.ptaRight) > 15) {
    chips.push('hr8') // Asymmetric Loss
  }

  // Check for high-frequency pattern
  const leftThresholds = result.thresholds.filter((t) => t.ear === 'left')
  const rightThresholds = result.thresholds.filter((t) => t.ear === 'right')

  for (const earThresholds of [leftThresholds, rightThresholds]) {
    const lowFreqAvg = earThresholds
      .filter((t) => t.frequency <= 1000)
      .reduce((sum, t) => sum + t.thresholddB, 0) / 2
    const highFreqAvg = earThresholds
      .filter((t) => t.frequency >= 2000)
      .reduce((sum, t) => sum + t.thresholddB, 0) / 2

    if (highFreqAvg - lowFreqAvg > 15) {
      chips.push('hr9') // High-frequency loss
    }
    if (lowFreqAvg - highFreqAvg > 15) {
      chips.push('hr10') // Low-frequency loss
    }
  }

  return [...new Set(chips)]
}
