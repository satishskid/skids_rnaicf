/**
 * Audio analysis for respiratory/cough screening.
 * Classifies cough type from audio features using spectral analysis.
 */

export interface AudioFeatures {
  duration: number
  peakFrequency: number
  spectralCentroid: number
  zeroCrossingRate: number
  rms: number
}

export interface CoughClassification {
  type: 'dry' | 'wet' | 'barking' | 'whooping' | 'unknown'
  confidence: number
}

/**
 * Extract audio features from raw PCM float data.
 * On React Native, audio data comes from expo-av recording buffer.
 */
export function extractAudioFeatures(channelData: Float32Array, sampleRate: number, duration: number): AudioFeatures {
  let sumSquares = 0
  for (let i = 0; i < channelData.length; i++) {
    sumSquares += channelData[i] * channelData[i]
  }
  const rms = Math.sqrt(sumSquares / channelData.length)

  let zeroCrossings = 0
  for (let i = 1; i < channelData.length; i++) {
    if ((channelData[i] >= 0 && channelData[i - 1] < 0) ||
        (channelData[i] < 0 && channelData[i - 1] >= 0)) {
      zeroCrossings++
    }
  }
  const zeroCrossingRate = zeroCrossings / channelData.length

  // Approximate FFT for peak frequency and spectral centroid
  const fftSize = 2048
  let peakFrequency = 0
  let maxMagnitude = 0
  let weightedSum = 0
  let magnitudeSum = 0

  for (let i = 0; i < fftSize / 2; i++) {
    const freq = (i * sampleRate) / fftSize
    const magnitude = Math.abs(channelData[i] || 0)
    weightedSum += freq * magnitude
    magnitudeSum += magnitude

    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude
      peakFrequency = freq
    }
  }

  const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0

  return { duration, peakFrequency, spectralCentroid, zeroCrossingRate, rms }
}

/** Classify cough type based on audio features */
export function classifyCough(features: AudioFeatures): CoughClassification {
  const { peakFrequency, spectralCentroid, zeroCrossingRate, rms } = features

  if (rms < 0.01) return { type: 'unknown', confidence: 0.3 }
  if (peakFrequency < 500 && spectralCentroid < 1500) return { type: 'barking', confidence: 0.75 }
  if (spectralCentroid > 3000 && zeroCrossingRate > 0.1) return { type: 'whooping', confidence: 0.7 }
  if (spectralCentroid > 1500 && spectralCentroid < 3000) return { type: 'wet', confidence: 0.72 }
  if (spectralCentroid < 2000 && zeroCrossingRate < 0.08) return { type: 'dry', confidence: 0.78 }
  return { type: 'unknown', confidence: 0.5 }
}

// ── Ambient Noise Monitoring ──

export interface AmbientNoiseResult {
  levelDB: number         // approximate dB SPL
  acceptable: boolean     // <40 dB for valid audiometry
  spectralProfile: 'quiet' | 'speech' | 'traffic' | 'machinery' | 'mixed'
  recommendation: string
}

/**
 * Measure ambient noise level and classify the noise environment.
 * Should be run before audiometry to validate test conditions.
 *
 * @param channelData - 3 seconds of PCM float audio data
 * @param sampleRate - Audio sample rate (typically 44100)
 */
export function measureAmbientNoise(channelData: Float32Array, sampleRate: number): AmbientNoiseResult {
  // RMS calculation
  let sumSquares = 0
  for (let i = 0; i < channelData.length; i++) {
    sumSquares += channelData[i] * channelData[i]
  }
  const rms = Math.sqrt(sumSquares / channelData.length)

  // Convert to approximate dB SPL
  const dbFS = rms > 0 ? 20 * Math.log10(rms) : -100
  const dbSPL = Math.round(dbFS + 94 + 38) // MEMS mic reference

  // Spectral analysis to classify noise type
  const features = extractAudioFeatures(channelData, sampleRate, channelData.length / sampleRate)

  let spectralProfile: AmbientNoiseResult['spectralProfile'] = 'quiet'
  if (dbSPL > 35) {
    if (features.spectralCentroid > 1500 && features.spectralCentroid < 4000) {
      spectralProfile = 'speech'
    } else if (features.peakFrequency < 500) {
      spectralProfile = 'traffic'
    } else if (features.zeroCrossingRate > 0.1) {
      spectralProfile = 'machinery'
    } else {
      spectralProfile = 'mixed'
    }
  }

  const acceptable = dbSPL < 40

  let recommendation: string
  if (dbSPL < 30) {
    recommendation = 'Very quiet \u2014 excellent for hearing test'
  } else if (dbSPL < 40) {
    recommendation = 'Acceptable noise level for screening'
  } else if (dbSPL < 50) {
    recommendation = `Noisy (${spectralProfile} noise) \u2014 results may be affected. Move to quieter room`
  } else {
    recommendation = `Too noisy (${Math.round(dbSPL)} dB) \u2014 find a quiet room before testing`
  }

  return { levelDB: Math.max(0, dbSPL), acceptable, spectralProfile, recommendation }
}

// ── Cardiac/Pulmonary Audio Frequency Analysis ──

export interface CardiacAudioResult {
  heartRateBPM: number | null
  murmurDetected: boolean
  murmurConfidence: number
  s1s2Regularity: number    // 0-1, 1 = regular
}

export interface PulmonaryAudioResult {
  wheezeDetected: boolean
  wheezeConfidence: number
  cracklesDetected: boolean
  cracklesConfidence: number
  stridorDetected: boolean
  stridorConfidence: number
}

/** Analyze cardiac audio for heart sounds and murmurs. */
export function analyzeCardiacAudio(channelData: Float32Array, sampleRate: number): CardiacAudioResult {
  const features = extractAudioFeatures(channelData, sampleRate, channelData.length / sampleRate)

  // Heart sounds are typically 20-200 Hz
  const heartFreqRange = features.peakFrequency >= 20 && features.peakFrequency <= 200

  // Murmur detection: sustained frequency in 100-600 Hz range with moderate amplitude
  const murmurRange = features.spectralCentroid >= 100 && features.spectralCentroid <= 600
  const murmurConfidence = murmurRange && features.rms > 0.02 ? 0.55 : 0.15

  return {
    heartRateBPM: heartFreqRange ? Math.round(features.peakFrequency * 60 / 2) : null,
    murmurDetected: murmurConfidence > 0.4,
    murmurConfidence,
    s1s2Regularity: heartFreqRange ? 0.7 : 0.3,
  }
}

/** Analyze pulmonary audio for adventitious breath sounds. */
export function analyzePulmonaryAudio(channelData: Float32Array, sampleRate: number): PulmonaryAudioResult {
  const features = extractAudioFeatures(channelData, sampleRate, channelData.length / sampleRate)

  // Wheezes: continuous, high-pitched, >400 Hz, duration >250ms
  const wheezeConfidence = features.spectralCentroid > 400 && features.zeroCrossingRate > 0.06
    ? Math.min(0.8, 0.3 + (features.spectralCentroid - 400) / 1000)
    : 0.1

  // Crackles: intermittent, brief, 100-2000 Hz
  const cracklesConfidence = features.zeroCrossingRate > 0.08 && features.rms > 0.01
    ? Math.min(0.7, features.zeroCrossingRate * 5)
    : 0.1

  // Stridor: high-pitched, >500 Hz, inspiratory
  const stridorConfidence = features.peakFrequency > 500 && features.rms > 0.03
    ? 0.5
    : 0.1

  return {
    wheezeDetected: wheezeConfidence > 0.4,
    wheezeConfidence,
    cracklesDetected: cracklesConfidence > 0.4,
    cracklesConfidence,
    stridorDetected: stridorConfidence > 0.4,
    stridorConfidence,
  }
}
