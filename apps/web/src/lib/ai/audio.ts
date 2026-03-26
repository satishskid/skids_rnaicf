/**
 * Audio analysis for respiratory/cough screening
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
 * Audio feature extraction for cough analysis
 */
export function extractAudioFeatures(audioBuffer: AudioBuffer): AudioFeatures {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate
  const duration = audioBuffer.duration

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

/**
 * Classify cough type based on audio features
 */
export function classifyCough(features: AudioFeatures): CoughClassification {
  const { peakFrequency, spectralCentroid, zeroCrossingRate, rms } = features

  if (rms < 0.01) {
    return { type: 'unknown', confidence: 0.3 }
  }

  if (peakFrequency < 500 && spectralCentroid < 1500) {
    return { type: 'barking', confidence: 0.75 }
  }

  if (spectralCentroid > 3000 && zeroCrossingRate > 0.1) {
    return { type: 'whooping', confidence: 0.7 }
  }

  if (spectralCentroid > 1500 && spectralCentroid < 3000) {
    return { type: 'wet', confidence: 0.72 }
  }

  if (spectralCentroid < 2000 && zeroCrossingRate < 0.08) {
    return { type: 'dry', confidence: 0.78 }
  }

  return { type: 'unknown', confidence: 0.5 }
}
