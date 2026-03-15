/**
 * Neurodevelopment Screening — camera-based engagement and gaze tracking.
 *
 * Enhanced from basic skin-tone grid to use ML Kit face detection (when available)
 * for accurate gaze tracking, smile detection, and engagement scoring.
 *
 * Falls back to pixel-based heuristics when ML Kit is unavailable.
 *
 * Measures:
 *   - Gaze stability (how consistently child looks at camera/examiner)
 *   - Social engagement (smile response, eye contact duration)
 *   - Response time (latency to respond to stimuli)
 *   - Attention span (sustained engagement duration)
 */

// ── Types ──

export interface FaceDetection {
  boundingBox: { x: number; y: number; width: number; height: number }
  leftEye?: { x: number; y: number }
  rightEye?: { x: number; y: number }
  noseBase?: { x: number; y: number }
  smilingProbability?: number    // 0-1, from ML Kit
  leftEyeOpenProbability?: number
  rightEyeOpenProbability?: number
  headEulerAngleX?: number       // pitch (nodding)
  headEulerAngleY?: number       // yaw (turning)
  headEulerAngleZ?: number       // roll (tilting)
  confidence: number
}

export interface GazeFrame {
  faceX: number       // face center X (0-1 normalized)
  faceY: number       // face center Y (0-1 normalized)
  gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down' | 'away'
  smiling: boolean
  eyeContact: boolean  // child looking at camera
  time: number         // ms timestamp
}

export interface NeuroScreeningResult {
  engagement: number        // 0-1 overall engagement score
  gazeScore: number         // 0-1, 1 = stable gaze
  responseTime: number      // average ms to respond
  attentionSpan: number     // seconds of sustained attention
  eyeContactRatio: number   // fraction of time with eye contact
  smileRatio: number        // fraction of time smiling
  confidence: number        // 0-1 assessment confidence
  riskCategory: 'no_risk' | 'possible_risk' | 'high_risk'
  findings: string[]
}

// ── ML Kit Face Detection ──

let mlKitFaceAvailable: boolean | null = null

async function checkMLKitFaceAvailability(): Promise<boolean> {
  if (mlKitFaceAvailable !== null) return mlKitFaceAvailable
  try {
    await import('@react-native-ml-kit/face-detection')
    mlKitFaceAvailable = true
    return true
  } catch {
    mlKitFaceAvailable = false
    return false
  }
}

/**
 * Detect face using ML Kit (if available) from image URI.
 */
export async function detectFaceMLKit(imageUri: string): Promise<FaceDetection | null> {
  const available = await checkMLKitFaceAvailability()
  if (!available) return null

  try {
    const FaceDetectionModule = await import('@react-native-ml-kit/face-detection')
    const faces = await FaceDetectionModule.default.detect(imageUri, {
      performanceMode: 'fast',
      landmarkMode: 'all',
      classificationMode: 'all',
    })

    if (!faces || faces.length === 0) return null

    const face = faces[0] as unknown as Record<string, unknown>
    const landmarks = face.landmarks as Array<{ type: string; position: { x: number; y: number } }> | undefined

    return {
      boundingBox: (face.frame as { x: number; y: number; width: number; height: number }) || { x: 0, y: 0, width: 0, height: 0 },
      leftEye: landmarks?.find(l => l.type === 'leftEye')?.position,
      rightEye: landmarks?.find(l => l.type === 'rightEye')?.position,
      noseBase: landmarks?.find(l => l.type === 'noseBase')?.position,
      smilingProbability: face.smilingProbability as number | undefined,
      leftEyeOpenProbability: face.leftEyeOpenProbability as number | undefined,
      rightEyeOpenProbability: face.rightEyeOpenProbability as number | undefined,
      headEulerAngleX: face.headEulerAngleX as number | undefined,
      headEulerAngleY: face.headEulerAngleY as number | undefined,
      headEulerAngleZ: face.headEulerAngleZ as number | undefined,
      confidence: 0.9,
    }
  } catch {
    return null
  }
}

// ── Pixel-Based Face Detection (Fallback) ──

/**
 * Extract face position from pixel data using skin-tone detection.
 * Fallback when ML Kit is unavailable.
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
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]

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
  return {
    faceX: faceX / width,
    faceY: faceY / height,
    brightness: pixelCount > 0 ? totalBrightness / pixelCount : 0,
  }
}

// ── Gaze Analysis ──

/**
 * Analyze gaze stability from a sequence of gaze frames.
 */
export function analyzeGazeStability(frames: GazeFrame[]): number {
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
  return Math.max(0, Math.min(1, 1 - avgDeviation * 5))
}

/**
 * Classify gaze direction from head angles or face position.
 */
export function classifyGazeDirection(
  faceX: number,
  faceY: number,
  headYaw?: number,
  headPitch?: number
): GazeFrame['gazeDirection'] {
  if (headYaw !== undefined && headPitch !== undefined) {
    if (Math.abs(headYaw) > 30) return headYaw > 0 ? 'right' : 'left'
    if (headPitch > 15) return 'down'
    if (headPitch < -15) return 'up'
    if (Math.abs(headYaw) < 10 && Math.abs(headPitch) < 10) return 'center'
  }

  if (faceX < 0.3) return 'left'
  if (faceX > 0.7) return 'right'
  if (faceY < 0.25) return 'up'
  if (faceY > 0.65) return 'down'
  return 'center'
}

// ── Engagement Scoring ──

/**
 * Compute neurodevelopment screening results.
 * Enhanced version with eye contact ratio, smile detection, and findings.
 *
 * Also supports legacy call signature for backward compatibility.
 */
export function computeNeuroResults(
  gazeFramesOrResponseTimes: GazeFrame[] | number[],
  responseTimesOrGazeFrames?: number[] | Array<{ faceX: number; faceY: number; time: number }>,
  taskCompletions: boolean[] = [],
): NeuroScreeningResult {
  // Detect legacy call signature: (responseTimes, gazeFrames, taskCompletions)
  let gazeFrames: GazeFrame[]
  let responseTimes: number[]

  if (Array.isArray(gazeFramesOrResponseTimes) && gazeFramesOrResponseTimes.length > 0 && typeof gazeFramesOrResponseTimes[0] === 'number') {
    // Legacy signature: (responseTimes, gazeFrames, taskCompletions)
    responseTimes = gazeFramesOrResponseTimes as number[]
    const legacyFrames = (responseTimesOrGazeFrames || []) as Array<{ faceX: number; faceY: number; time: number }>
    gazeFrames = legacyFrames.map(f => ({
      faceX: f.faceX,
      faceY: f.faceY,
      gazeDirection: 'center' as const,
      smiling: false,
      eyeContact: true,
      time: f.time,
    }))
  } else {
    // New signature: (gazeFrames, responseTimes, taskCompletions)
    gazeFrames = (gazeFramesOrResponseTimes || []) as GazeFrame[]
    responseTimes = (responseTimesOrGazeFrames || []) as number[]
  }

  // Response time analysis
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 3000

  const gazeScore = analyzeGazeStability(gazeFrames)

  // Eye contact ratio
  const eyeContactFrames = gazeFrames.filter(f => f.eyeContact)
  const eyeContactRatio = gazeFrames.length > 0
    ? eyeContactFrames.length / gazeFrames.length
    : 0

  // Smile ratio
  const smilingFrames = gazeFrames.filter(f => f.smiling)
  const smileRatio = gazeFrames.length > 0
    ? smilingFrames.length / gazeFrames.length
    : 0

  // Task completion rate
  const completionRate = taskCompletions.length > 0
    ? taskCompletions.filter(Boolean).length / taskCompletions.length
    : 0.5

  // Attention span: longest continuous gaze at center/eye-contact
  let attentionSpan = 0
  let currentStreak = 0
  let maxStreak = 0
  for (const frame of gazeFrames) {
    if (frame.gazeDirection === 'center' || frame.eyeContact) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }
  // Also fallback: total duration if frames have timestamps
  if (gazeFrames.length >= 2) {
    const totalDuration = (gazeFrames[gazeFrames.length - 1].time - gazeFrames[0].time) / 1000
    attentionSpan = Math.max(maxStreak / 10, totalDuration * (maxStreak / gazeFrames.length))
  } else {
    attentionSpan = maxStreak / 10
  }

  // Composite engagement
  const responseScore = Math.max(0, Math.min(1, 1 - (avgResponseTime - 500) / 5000))
  const engagement =
    gazeScore * 0.2 +
    eyeContactRatio * 0.25 +
    completionRate * 0.2 +
    responseScore * 0.2 +
    smileRatio * 0.15

  const confidence = Math.min(0.95,
    0.3 + gazeFrames.length / 300 + responseTimes.length / 10 + taskCompletions.length / 10
  )

  // Risk categorization
  let riskCategory: NeuroScreeningResult['riskCategory'] = 'no_risk'
  const findings: string[] = []

  if (engagement < 0.35 || gazeScore < 0.25) {
    riskCategory = 'high_risk'
    if (gazeScore < 0.25) findings.push('Very poor gaze stability')
    if (eyeContactRatio < 0.15) findings.push('Minimal eye contact')
    if (smileRatio < 0.05) findings.push('No social smile observed')
    if (avgResponseTime > 5000) findings.push('Very slow response times')
  } else if (engagement < 0.6 || gazeScore < 0.45 || eyeContactRatio < 0.25 || avgResponseTime > 4000) {
    riskCategory = 'possible_risk'
    if (gazeScore < 0.45) findings.push('Reduced gaze stability')
    if (eyeContactRatio < 0.25) findings.push('Below-average eye contact')
    if (smileRatio < 0.1) findings.push('Limited social smiling')
    if (avgResponseTime > 4000) findings.push('Slow response to stimuli')
  } else {
    if (engagement > 0.75) findings.push('Good overall engagement')
    if (eyeContactRatio > 0.5) findings.push('Good eye contact')
    if (smileRatio > 0.2) findings.push('Appropriate social smiling')
  }

  return {
    engagement,
    gazeScore,
    responseTime: avgResponseTime,
    attentionSpan,
    eyeContactRatio,
    smileRatio,
    confidence,
    riskCategory,
    findings,
  }
}
