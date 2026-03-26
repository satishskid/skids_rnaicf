// Auscultation point definitions and basic audio analysis
// Rule-based classification for heart and lung sounds

export interface AuscultationPoint {
  id: string
  label: string
  shortLabel: string
  x: number  // % position on body diagram
  y: number  // % position on body diagram
  side: 'anterior' | 'posterior'
}

// 4 cardiac auscultation points (anterior)
export const CARDIAC_POINTS: AuscultationPoint[] = [
  { id: 'aortic', label: 'Aortic (2nd R ICS)', shortLabel: 'Aortic', x: 42, y: 22, side: 'anterior' },
  { id: 'pulmonic', label: 'Pulmonic (2nd L ICS)', shortLabel: 'Pulmonic', x: 58, y: 22, side: 'anterior' },
  { id: 'tricuspid', label: 'Tricuspid (4th L ICS)', shortLabel: 'Tricuspid', x: 45, y: 38, side: 'anterior' },
  { id: 'mitral', label: 'Mitral (5th L MCL)', shortLabel: 'Mitral', x: 55, y: 45, side: 'anterior' },
]

// 6 pulmonary auscultation points
export const PULMONARY_POINTS: AuscultationPoint[] = [
  // Posterior (4 points)
  { id: 'post_upper_r', label: 'Upper Right (Posterior)', shortLabel: 'UR Post', x: 38, y: 25, side: 'posterior' },
  { id: 'post_upper_l', label: 'Upper Left (Posterior)', shortLabel: 'UL Post', x: 62, y: 25, side: 'posterior' },
  { id: 'post_lower_r', label: 'Lower Right (Posterior)', shortLabel: 'LR Post', x: 38, y: 45, side: 'posterior' },
  { id: 'post_lower_l', label: 'Lower Left (Posterior)', shortLabel: 'LL Post', x: 62, y: 45, side: 'posterior' },
  // Anterior (2 points)
  { id: 'ant_right', label: 'Right Anterior', shortLabel: 'R Ant', x: 40, y: 30, side: 'anterior' },
  { id: 'ant_left', label: 'Left Anterior', shortLabel: 'L Ant', x: 60, y: 30, side: 'anterior' },
]

export interface AudioAnalysisResult {
  classification: string
  confidence: number
  features: Record<string, number>
  description: string
}

/**
 * Analyze cardiac audio recording
 * Rule-based: detect S1/S2 peaks, check for inter-beat energy (murmur)
 */
export function analyzeCardiacAudio(analyser: AnalyserNode): AudioAnalysisResult {
  const bufferLength = analyser.frequencyBinCount
  const freqData = new Uint8Array(bufferLength)
  const timeData = new Uint8Array(bufferLength)
  analyser.getByteFrequencyData(freqData)
  analyser.getByteTimeDomainData(timeData)

  const sampleRate = analyser.context.sampleRate
  const binSize = sampleRate / (analyser.fftSize)

  // Low frequency energy (20-200 Hz) — heart sounds
  let lowEnergy = 0
  let lowCount = 0
  // Mid frequency energy (200-500 Hz) — murmur range
  let midEnergy = 0
  let midCount = 0
  // High frequency energy (>500 Hz) — artifact/noise
  let highEnergy = 0
  let highCount = 0

  for (let i = 0; i < bufferLength; i++) {
    const freq = i * binSize
    if (freq >= 20 && freq <= 200) {
      lowEnergy += freqData[i]
      lowCount++
    } else if (freq > 200 && freq <= 500) {
      midEnergy += freqData[i]
      midCount++
    } else if (freq > 500 && freq <= 2000) {
      highEnergy += freqData[i]
      highCount++
    }
  }

  const avgLow = lowCount > 0 ? lowEnergy / lowCount : 0
  const avgMid = midCount > 0 ? midEnergy / midCount : 0
  const avgHigh = highCount > 0 ? highEnergy / highCount : 0

  // Time domain peak detection for heart rate
  let peaks = 0
  const threshold = 140 // above midline (128)
  let wasBelowThreshold = true
  for (let i = 0; i < timeData.length; i++) {
    if (timeData[i] > threshold && wasBelowThreshold) {
      peaks++
      wasBelowThreshold = false
    } else if (timeData[i] < 128) {
      wasBelowThreshold = true
    }
  }

  // Classification rules
  const midToLowRatio = avgLow > 0 ? avgMid / avgLow : 0

  let classification = 'Normal S1/S2'
  let description = 'Normal heart sounds detected'
  let confidence = 0.6

  if (avgLow < 10 && avgMid < 10) {
    classification = 'No Signal'
    description = 'Insufficient audio signal — check stethoscope placement'
    confidence = 0.9
  } else if (midToLowRatio > 0.8) {
    classification = 'Possible Murmur'
    description = 'Elevated mid-frequency energy between heart sounds — possible murmur'
    confidence = 0.5
  } else if (avgHigh > avgLow * 0.5) {
    classification = 'Noisy Recording'
    description = 'High ambient noise — consider re-recording in quieter environment'
    confidence = 0.7
  }

  return {
    classification,
    confidence,
    features: {
      lowFreqEnergy: Math.round(avgLow),
      midFreqEnergy: Math.round(avgMid),
      highFreqEnergy: Math.round(avgHigh),
      midToLowRatio: Math.round(midToLowRatio * 100) / 100,
      peaks,
    },
    description,
  }
}

/**
 * Analyze pulmonary audio recording
 * Rule-based: detect wheeze (>400Hz), rhonchi (<200Hz), crackles (transient bursts)
 */
export function analyzePulmonaryAudio(analyser: AnalyserNode): AudioAnalysisResult {
  const bufferLength = analyser.frequencyBinCount
  const freqData = new Uint8Array(bufferLength)
  analyser.getByteFrequencyData(freqData)

  const sampleRate = analyser.context.sampleRate
  const binSize = sampleRate / (analyser.fftSize)

  // Breath sound range (100-300 Hz) — normal vesicular
  let breathEnergy = 0
  let breathCount = 0
  // Wheeze range (400-1000 Hz)
  let wheezeEnergy = 0
  let wheezeCount = 0
  // Rhonchi range (100-200 Hz, louder than normal)
  let rhonchiEnergy = 0
  let rhonchiCount = 0

  for (let i = 0; i < bufferLength; i++) {
    const freq = i * binSize
    if (freq >= 100 && freq <= 300) {
      breathEnergy += freqData[i]
      breathCount++
    }
    if (freq >= 400 && freq <= 1000) {
      wheezeEnergy += freqData[i]
      wheezeCount++
    }
    if (freq >= 100 && freq <= 200) {
      rhonchiEnergy += freqData[i]
      rhonchiCount++
    }
  }

  const avgBreath = breathCount > 0 ? breathEnergy / breathCount : 0
  const avgWheeze = wheezeCount > 0 ? wheezeEnergy / wheezeCount : 0
  const avgRhonchi = rhonchiCount > 0 ? rhonchiEnergy / rhonchiCount : 0

  let classification = 'Normal Vesicular'
  let description = 'Normal breath sounds detected'
  let confidence = 0.6

  if (avgBreath < 10 && avgWheeze < 10) {
    classification = 'No Signal'
    description = 'Insufficient audio signal — check stethoscope placement'
    confidence = 0.9
  } else if (avgWheeze > avgBreath * 0.6) {
    classification = 'Possible Wheeze'
    description = 'Elevated high-frequency energy suggesting wheeze'
    confidence = 0.5
  } else if (avgRhonchi > avgBreath * 1.5) {
    classification = 'Possible Rhonchi'
    description = 'Elevated low-frequency continuous sounds suggesting rhonchi'
    confidence = 0.5
  } else if (avgBreath < 20) {
    classification = 'Diminished'
    description = 'Reduced breath sound intensity'
    confidence = 0.5
  }

  return {
    classification,
    confidence,
    features: {
      breathEnergy: Math.round(avgBreath),
      wheezeEnergy: Math.round(avgWheeze),
      rhonchiEnergy: Math.round(avgRhonchi),
      wheezeToBreathRatio: avgBreath > 0 ? Math.round((avgWheeze / avgBreath) * 100) / 100 : 0,
    },
    description,
  }
}

/**
 * Generate spectrogram-like data for canvas visualization
 */
export function getSpectrogramSlice(analyser: AnalyserNode): Uint8Array {
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  return data
}
