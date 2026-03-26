/**
 * Neurodevelopment screening using camera-based engagement tracking
 * Measures response times, gaze patterns, and engagement metrics
 */

export interface EngagementMetrics {
  responseTime: number      // Average response time in ms
  gazeStability: number     // How stable the gaze is (0-1)
  engagement: number        // Overall engagement score (0-1)
  attentionSpan: number     // Sustained attention duration in seconds
  socialResponse: number    // Social responsiveness score (0-1)
}

export interface NeuroScreeningResult {
  engagement: number
  gazeScore: number
  responseTime: number
  attentionSpan: number
  confidence: number
  riskCategory: 'no_risk' | 'possible_risk' | 'high_risk'
}

/**
 * Track face position changes to estimate gaze stability
 * Uses face region brightness/position shifts as proxy for gaze movement
 */
export function analyzeGazeStability(
  frames: Array<{ faceX: number; faceY: number; time: number }>
): number {
  if (frames.length < 5) return 0.5

  let totalDeviation = 0
  const avgX = frames.reduce((s, f) => s + f.faceX, 0) / frames.length
  const avgY = frames.reduce((s, f) => s + f.faceY, 0) / frames.length

  for (const frame of frames) {
    const dx = frame.faceX - avgX
    const dy = frame.faceY - avgY
    totalDeviation += Math.sqrt(dx * dx + dy * dy)
  }

  const avgDeviation = totalDeviation / frames.length
  // Normalize: lower deviation = higher stability
  return Math.max(0, Math.min(1, 1 - avgDeviation / 100))
}

/**
 * Extract face position from video frame for gaze tracking
 */
export function extractFacePosition(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): { faceX: number; faceY: number; brightness: number } | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  ctx.drawImage(video, 0, 0)

  // Scan the upper portion of the frame for the brightest skin-tone region (face)
  const scanRegion = {
    x: Math.floor(canvas.width * 0.2),
    y: Math.floor(canvas.height * 0.05),
    w: Math.floor(canvas.width * 0.6),
    h: Math.floor(canvas.height * 0.6)
  }

  const imageData = ctx.getImageData(scanRegion.x, scanRegion.y, scanRegion.w, scanRegion.h)
  const pixels = imageData.data

  // Divide region into grid cells to find face center
  const gridSize = 8
  const cellW = Math.floor(scanRegion.w / gridSize)
  const cellH = Math.floor(scanRegion.h / gridSize)

  let maxSkinScore = 0
  let faceX = scanRegion.x + scanRegion.w / 2
  let faceY = scanRegion.y + scanRegion.h / 2
  let totalBrightness = 0
  let pixelCount = 0

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let skinScore = 0
      let cellBrightness = 0
      let cellPixels = 0

      for (let y = gy * cellH; y < (gy + 1) * cellH; y += 3) {
        for (let x = gx * cellW; x < (gx + 1) * cellW; x += 3) {
          const idx = (y * scanRegion.w + x) * 4
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]

          // Skin tone detection
          if (r > 100 && g > 60 && b > 40 && r > g && g > b && (r - g) > 10) {
            skinScore++
          }

          cellBrightness += (r + g + b) / 3
          cellPixels++
        }
      }

      if (skinScore > maxSkinScore) {
        maxSkinScore = skinScore
        faceX = scanRegion.x + gx * cellW + cellW / 2
        faceY = scanRegion.y + gy * cellH + cellH / 2
      }

      totalBrightness += cellBrightness
      pixelCount += cellPixels
    }
  }

  if (maxSkinScore < 5) return null

  return {
    faceX,
    faceY,
    brightness: pixelCount > 0 ? totalBrightness / pixelCount : 0
  }
}

/**
 * Compute neurodevelopment screening results from collected engagement data
 */
export function computeNeuroResults(
  responseTimes: number[],
  gazeFrames: Array<{ faceX: number; faceY: number; time: number }>,
  taskCompletions: boolean[]
): NeuroScreeningResult {
  // Average response time
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 3000

  // Gaze stability
  const gazeScore = analyzeGazeStability(gazeFrames)

  // Task completion rate as engagement proxy
  const completionRate = taskCompletions.length > 0
    ? taskCompletions.filter(Boolean).length / taskCompletions.length
    : 0.5

  // Attention span from gaze data
  let attentionSpan = 0
  if (gazeFrames.length >= 2) {
    attentionSpan = (gazeFrames[gazeFrames.length - 1].time - gazeFrames[0].time) / 1000
  }

  // Combined engagement score
  const responseScore = Math.max(0, Math.min(1, 1 - (avgResponseTime - 500) / 5000))
  const engagement = (gazeScore * 0.3 + completionRate * 0.4 + responseScore * 0.3)

  // Confidence based on data quantity
  const confidence = Math.min(0.95, 0.5 + gazeFrames.length / 200 + responseTimes.length / 10)

  // Risk assessment
  let riskCategory: 'no_risk' | 'possible_risk' | 'high_risk' = 'no_risk'
  if (engagement < 0.4 || gazeScore < 0.3) {
    riskCategory = 'high_risk'
  } else if (engagement < 0.65 || gazeScore < 0.5 || avgResponseTime > 4000) {
    riskCategory = 'possible_risk'
  }

  return {
    engagement,
    gazeScore,
    responseTime: avgResponseTime,
    attentionSpan,
    confidence,
    riskCategory
  }
}
