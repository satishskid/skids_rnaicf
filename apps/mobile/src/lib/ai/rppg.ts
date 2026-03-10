/**
 * rPPG (Remote Photoplethysmography) — contactless heart rate via camera.
 * Uses CHROM (Chrominance) method for robust extraction from face video.
 *
 * Input: Array of RGB color samples from face region over time
 * Output: Heart rate in BPM (40-200 range)
 *
 * Reference: De Haan & Jeanne, "Robust Pulse Rate from Chrominance-Based rPPG", IEEE 2013
 */

export interface RGBSample {
  r: number
  g: number
  b: number
  time: number // ms timestamp
}

/**
 * Extract average RGB from face region pixel data.
 * On React Native, pixel data comes from camera frame processing.
 *
 * @param pixels - RGBA Uint8Array from camera frame
 * @param width - frame width
 * @param height - frame height
 * @returns Average RGB of face region (center 40% × 50%)
 */
export function extractFaceSignalFromPixels(
  pixels: Uint8Array,
  width: number,
  height: number
): { r: number; g: number; b: number } | null {
  const faceX = Math.floor(width * 0.3)
  const faceY = Math.floor(height * 0.1)
  const faceW = Math.floor(width * 0.4)
  const faceH = Math.floor(height * 0.5)

  let totalR = 0, totalG = 0, totalB = 0, count = 0

  for (let y = faceY; y < faceY + faceH; y += 4) {
    for (let x = faceX; x < faceX + faceW; x += 4) {
      const idx = (y * width + x) * 4
      totalR += pixels[idx]
      totalG += pixels[idx + 1]
      totalB += pixels[idx + 2]
      count++
    }
  }

  if (count === 0) return null
  return { r: totalR / count, g: totalG / count, b: totalB / count }
}

/**
 * CHROM method for rPPG heart rate extraction.
 * Requires ≥90 frames (~3 seconds at 30 fps).
 */
export function computeHeartRateCHROM(signalBuffer: RGBSample[]): number {
  if (signalBuffer.length < 90) return 0

  const xSignal: number[] = []
  const ySignal: number[] = []
  const times: number[] = []

  signalBuffer.forEach(s => {
    xSignal.push(3 * s.r - 2 * s.g)
    ySignal.push(1.5 * s.r + s.g - 1.5 * s.b)
    times.push(s.time)
  })

  const xMean = xSignal.reduce((a, b) => a + b, 0) / xSignal.length
  const yMean = ySignal.reduce((a, b) => a + b, 0) / ySignal.length

  const xNorm = xSignal.map(x => x - xMean)
  const yNorm = ySignal.map(y => y - yMean)

  const xStd = Math.sqrt(xNorm.reduce((a, b) => a + b * b, 0) / xNorm.length)
  const yStd = Math.sqrt(yNorm.reduce((a, b) => a + b * b, 0) / yNorm.length)

  if (xStd === 0 || yStd === 0) return 0

  const chromSignal = xNorm.map((x, i) => x / xStd - yNorm[i] / yStd)

  // Peak detection
  const sampleRate = 30
  let peaks = 0
  let lastPeakIdx = 0
  const minPeakDistance = Math.floor(sampleRate * 0.4) // min 0.4s between peaks

  for (let i = 1; i < chromSignal.length - 1; i++) {
    if (chromSignal[i] > chromSignal[i - 1] && chromSignal[i] > chromSignal[i + 1]) {
      if (i - lastPeakIdx >= minPeakDistance) {
        peaks++
        lastPeakIdx = i
      }
    }
  }

  const duration = (times[times.length - 1] - times[0]) / 1000
  const heartRate = Math.round((peaks / duration) * 60)

  return Math.max(40, Math.min(200, heartRate))
}
