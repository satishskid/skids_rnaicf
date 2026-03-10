/**
 * Neurodevelopment screening — camera-based engagement and gaze tracking.
 * Measures response times, gaze stability, attention span.
 */

export interface NeuroScreeningResult {
  engagement: number    // 0-1
  gazeScore: number     // 0-1, 1 = stable
  responseTime: number  // avg ms
  attentionSpan: number // seconds
  confidence: number    // 0-1
  riskCategory: 'no_risk' | 'possible_risk' | 'high_risk'
}

/** Analyze gaze stability from face position tracking frames. */
export function analyzeGazeStability(
  frames: Array<{ faceX: number; faceY: number; time: number }>
): number {
  if (frames.length < 5) return 0.5

  const avgX = frames.reduce((s, f) => s + f.faceX, 0) / frames.length
  const avgY = frames.reduce((s, f) => s + f.faceY, 0) / frames.length

  let totalDeviation = 0
  for (const frame of frames) {
    const dx = frame.faceX - avgX
    const dy = frame.faceY - avgY
    totalDeviation += Math.sqrt(dx * dx + dy * dy)
  }

  const avgDeviation = totalDeviation / frames.length
  return Math.max(0, Math.min(1, 1 - avgDeviation / 100))
}

/**
 * Extract face position from pixel data for gaze tracking.
 * Uses skin-tone detection as face proxy.
 */
export function extractFacePosition(
  pixels: Uint8Array,
  width: number,
  height: number
): { faceX: number; faceY: number; brightness: number } | null {
  const scanX = Math.floor(width * 0.2)
  const scanY = Math.floor(height * 0.05)
  const scanW = Math.floor(width * 0.6)
  const scanH = Math.floor(height * 0.6)

  const gridSize = 8
  const cellW = Math.floor(scanW / gridSize)
  const cellH = Math.floor(scanH / gridSize)

  let maxSkinScore = 0
  let faceX = scanX + scanW / 2
  let faceY = scanY + scanH / 2
  let totalBrightness = 0
  let pixelCount = 0

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let skinScore = 0
      let cellBrightness = 0
      let cellPixels = 0

      for (let y = gy * cellH; y < (gy + 1) * cellH; y += 3) {
        for (let x = gx * cellW; x < (gx + 1) * cellW; x += 3) {
          const absX = scanX + x
          const absY = scanY + y
          const idx = (absY * width + absX) * 4
          const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]

          if (r > 100 && g > 60 && b > 40 && r > g && g > b && (r - g) > 10) {
            skinScore++
          }
          cellBrightness += (r + g + b) / 3
          cellPixels++
        }
      }

      if (skinScore > maxSkinScore) {
        maxSkinScore = skinScore
        faceX = scanX + gx * cellW + cellW / 2
        faceY = scanY + gy * cellH + cellH / 2
      }
      totalBrightness += cellBrightness
      pixelCount += cellPixels
    }
  }

  if (maxSkinScore < 5) return null
  return { faceX, faceY, brightness: pixelCount > 0 ? totalBrightness / pixelCount : 0 }
}

/** Compute neurodevelopment screening results from engagement data. */
export function computeNeuroResults(
  responseTimes: number[],
  gazeFrames: Array<{ faceX: number; faceY: number; time: number }>,
  taskCompletions: boolean[]
): NeuroScreeningResult {
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 3000

  const gazeScore = analyzeGazeStability(gazeFrames)

  const completionRate = taskCompletions.length > 0
    ? taskCompletions.filter(Boolean).length / taskCompletions.length
    : 0.5

  let attentionSpan = 0
  if (gazeFrames.length >= 2) {
    attentionSpan = (gazeFrames[gazeFrames.length - 1].time - gazeFrames[0].time) / 1000
  }

  const responseScore = Math.max(0, Math.min(1, 1 - (avgResponseTime - 500) / 5000))
  const engagement = gazeScore * 0.3 + completionRate * 0.4 + responseScore * 0.3
  const confidence = Math.min(0.95, 0.5 + gazeFrames.length / 200 + responseTimes.length / 10)

  let riskCategory: 'no_risk' | 'possible_risk' | 'high_risk' = 'no_risk'
  if (engagement < 0.4 || gazeScore < 0.3) riskCategory = 'high_risk'
  else if (engagement < 0.65 || gazeScore < 0.5 || avgResponseTime > 4000) riskCategory = 'possible_risk'

  return { engagement, gazeScore, responseTime: avgResponseTime, attentionSpan, confidence, riskCategory }
}
