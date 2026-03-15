/**
 * Image Quality Gate — validates image quality before AI analysis.
 *
 * Checks: blur detection, exposure, face/eye framing, flash presence, distance.
 * All pure pixel analysis — no ML, works fully offline.
 *
 * Used by the three-tier pipeline as the first step before any AI inference.
 */

import type { QualityGateResult, QualityCheck } from './pipeline'

// ── Blur Detection (Laplacian Variance) ──

/**
 * Estimate image sharpness using Laplacian operator variance.
 * Higher variance = sharper image.
 * Threshold: >100 = sharp, <50 = blurry.
 */
function detectBlur(pixels: Uint8Array, width: number, height: number): number {
  // Convert to grayscale and compute Laplacian
  let sum = 0
  let sumSq = 0
  let count = 0

  // Skip edges (Laplacian needs 1px border)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const getGray = (px: number, py: number) => {
        const idx = (py * width + px) * 4
        return (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114)
      }

      // Laplacian kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
      const laplacian =
        getGray(x, y - 1) +
        getGray(x - 1, y) +
        getGray(x + 1, y) +
        getGray(x, y + 1) -
        4 * getGray(x, y)

      sum += laplacian
      sumSq += laplacian * laplacian
      count++
    }
  }

  if (count === 0) return 0
  const mean = sum / count
  const variance = sumSq / count - mean * mean
  return variance
}

// ── Exposure Check ──

/**
 * Check if image exposure is adequate.
 * Returns mean brightness of center region (0-255).
 * Ideal range: 80-200.
 */
function checkExposure(pixels: Uint8Array, width: number, height: number): number {
  // Sample center 60% of image
  const startX = Math.floor(width * 0.2)
  const endX = Math.floor(width * 0.8)
  const startY = Math.floor(height * 0.2)
  const endY = Math.floor(height * 0.8)

  let totalBrightness = 0
  let count = 0

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const idx = (y * width + x) * 4
      const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3
      totalBrightness += brightness
      count++
    }
  }

  return count > 0 ? totalBrightness / count : 0
}

// ── Face/Skin Detection ──

/**
 * Detect face-like region using skin-tone heuristics.
 * Returns { found, centerX, centerY, areaRatio }.
 */
function detectFaceRegion(pixels: Uint8Array, width: number, height: number): {
  found: boolean
  centerX: number
  centerY: number
  areaRatio: number  // fraction of image that is face
  faceTop: number
  faceBottom: number
} {
  let skinCount = 0
  let sumX = 0
  let sumY = 0
  let minY = height
  let maxY = 0
  const totalPixels = width * height

  // Scan with step for performance
  const step = 3
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4
      const r = pixels[idx]
      const g = pixels[idx + 1]
      const b = pixels[idx + 2]

      // Skin tone detection (works across skin colors)
      if (r > 80 && g > 40 && b > 20 &&
          r > g && g > b &&
          (r - g) > 10 && (r - b) > 15 &&
          r < 250 && g < 230) {
        skinCount++
        sumX += x
        sumY += y
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const adjustedCount = skinCount * step * step // account for step
  const areaRatio = adjustedCount / totalPixels

  if (skinCount < 50) {
    return { found: false, centerX: width / 2, centerY: height / 2, areaRatio: 0, faceTop: 0, faceBottom: height }
  }

  return {
    found: true,
    centerX: sumX / skinCount,
    centerY: sumY / skinCount,
    areaRatio: Math.min(1, areaRatio),
    faceTop: minY,
    faceBottom: maxY,
  }
}

// ── Flash Detection (for vision modules) ──

/**
 * Detect flash/bright specular reflection in pupil region.
 * Looks for very bright white spots (R>220, G>220, B>220) in expected eye region.
 */
function detectFlash(pixels: Uint8Array, width: number, height: number): boolean {
  // Expected pupil region: center-ish, upper third of image
  const regionX = Math.floor(width * 0.2)
  const regionW = Math.floor(width * 0.6)
  const regionY = Math.floor(height * 0.15)
  const regionH = Math.floor(height * 0.35)

  let brightSpots = 0

  for (let y = regionY; y < regionY + regionH; y += 2) {
    for (let x = regionX; x < regionX + regionW; x += 2) {
      const idx = (y * width + x) * 4
      const r = pixels[idx]
      const g = pixels[idx + 1]
      const b = pixels[idx + 2]

      // Very bright white spot = flash reflection
      if (r > 220 && g > 220 && b > 220) {
        brightSpots++
      }
    }
  }

  // Need at least a few bright spots to indicate flash
  return brightSpots > 5
}

// ── Red Reflex Presence ──

/**
 * Check if red reflex is visible in expected pupil regions.
 * Looks for red-dominant pixels in eye area.
 */
function detectRedReflex(pixels: Uint8Array, width: number, height: number): {
  leftEyeRed: boolean
  rightEyeRed: boolean
  count: number
} {
  const regions = [
    // Left eye region (from viewer's perspective)
    { x: Math.floor(width * 0.2), y: Math.floor(height * 0.25), w: Math.floor(width * 0.2), h: Math.floor(height * 0.15) },
    // Right eye region
    { x: Math.floor(width * 0.6), y: Math.floor(height * 0.25), w: Math.floor(width * 0.2), h: Math.floor(height * 0.15) },
  ]

  const results = regions.map(region => {
    let redCount = 0
    for (let y = region.y; y < region.y + region.h; y += 2) {
      for (let x = region.x; x < region.x + region.w; x += 2) {
        const idx = (y * width + x) * 4
        const r = pixels[idx]
        const g = pixels[idx + 1]
        const b = pixels[idx + 2]
        if (r > 120 && r > g * 1.3 && r > b * 1.3) {
          redCount++
        }
      }
    }
    return redCount
  })

  return {
    leftEyeRed: results[0] > 10,
    rightEyeRed: results[1] > 10,
    count: results[0] + results[1],
  }
}

// ── Public API ──

export interface QualityGateOptions {
  requireFlash?: boolean      // for vision/red reflex modules
  requireFace?: boolean       // for face-based modules
  requireBothEyes?: boolean   // for vision modules
  minFaceRatio?: number       // minimum face-to-frame ratio (default 0.15)
  maxFaceRatio?: number       // maximum face-to-frame ratio (default 0.8)
  blurThreshold?: number      // minimum blur variance (default 80)
  minBrightness?: number      // minimum mean brightness (default 60)
  maxBrightness?: number      // maximum mean brightness (default 220)
}

const DEFAULT_OPTIONS: Required<QualityGateOptions> = {
  requireFlash: false,
  requireFace: true,
  requireBothEyes: false,
  minFaceRatio: 0.15,
  maxFaceRatio: 0.8,
  blurThreshold: 80,
  minBrightness: 60,
  maxBrightness: 220,
}

/**
 * Run quality gate on an image.
 * Returns pass/fail with human-readable feedback for the nurse.
 */
export function runQualityGate(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: QualityGateOptions = {}
): QualityGateResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const checks: QualityCheck[] = []

  // 1. Blur check
  const blurVariance = detectBlur(pixels, width, height)
  const blurScore = Math.min(1, blurVariance / 200) // normalize to 0-1
  checks.push({
    name: 'Sharpness',
    passed: blurVariance >= opts.blurThreshold,
    value: blurVariance,
    threshold: opts.blurThreshold,
    message: blurVariance >= opts.blurThreshold
      ? 'Image is sharp'
      : 'Image is blurry \u2014 hold the tablet steady',
  })

  // 2. Exposure check
  const meanBrightness = checkExposure(pixels, width, height)
  const exposureScore = meanBrightness < opts.minBrightness
    ? meanBrightness / opts.minBrightness
    : meanBrightness > opts.maxBrightness
      ? 1 - (meanBrightness - opts.maxBrightness) / (255 - opts.maxBrightness)
      : 1.0
  const exposurePassed = meanBrightness >= opts.minBrightness && meanBrightness <= opts.maxBrightness
  checks.push({
    name: 'Exposure',
    passed: exposurePassed,
    value: meanBrightness,
    threshold: opts.minBrightness,
    message: meanBrightness < opts.minBrightness
      ? 'Too dark \u2014 improve lighting or turn on flash'
      : meanBrightness > opts.maxBrightness
        ? 'Too bright \u2014 reduce lighting or move away from window'
        : 'Lighting is good',
  })

  // 3. Face detection
  const face = detectFaceRegion(pixels, width, height)
  let faceScore = 0
  if (opts.requireFace) {
    const facePassed = face.found && face.areaRatio >= opts.minFaceRatio && face.areaRatio <= opts.maxFaceRatio
    faceScore = facePassed ? 1.0 : face.found ? 0.5 : 0
    checks.push({
      name: 'Face framing',
      passed: facePassed,
      value: face.areaRatio,
      threshold: opts.minFaceRatio,
      message: !face.found
        ? 'No face detected \u2014 center the child\'s face in frame'
        : face.areaRatio < opts.minFaceRatio
          ? 'Face too small \u2014 move closer to the child'
          : face.areaRatio > opts.maxFaceRatio
            ? 'Face too close \u2014 move back slightly'
            : 'Face is well-framed',
    })
  } else {
    faceScore = 1.0
  }

  // 4. Flash detection (vision modules)
  let flashDetected = false
  if (opts.requireFlash) {
    flashDetected = detectFlash(pixels, width, height)
    checks.push({
      name: 'Flash',
      passed: flashDetected,
      value: flashDetected ? 1 : 0,
      threshold: 1,
      message: flashDetected
        ? 'Flash detected'
        : 'Flash not detected \u2014 turn on flash for red reflex',
    })
  }

  // 5. Both eyes visible (vision modules)
  if (opts.requireBothEyes) {
    const redReflex = detectRedReflex(pixels, width, height)
    const bothEyes = redReflex.leftEyeRed && redReflex.rightEyeRed
    checks.push({
      name: 'Both eyes visible',
      passed: bothEyes || redReflex.count > 15,
      value: redReflex.count,
      threshold: 15,
      message: bothEyes
        ? 'Both eyes visible with red reflex'
        : redReflex.count > 5
          ? 'Partial eye detection \u2014 ensure both eyes are visible'
          : 'Eyes not detected \u2014 child should look at camera',
    })
  }

  // Overall result
  const allPassed = checks.every(c => c.passed)
  const criticalFailed = checks.filter(c => !c.passed)
  const feedback = allPassed
    ? 'Image quality is good \u2014 ready for analysis'
    : criticalFailed.map(c => c.message).join('. ')

  return {
    passed: allPassed,
    blur: blurScore,
    exposure: Math.max(0, Math.min(1, exposureScore)),
    framing: faceScore,
    flashDetected: opts.requireFlash ? flashDetected : undefined,
    faceDetected: face.found,
    feedback,
    checks,
  }
}

// ── Module-specific presets ──

/** Quality gate for red reflex / photoscreening. */
export function visionQualityGate(pixels: Uint8Array, w: number, h: number): QualityGateResult {
  return runQualityGate(pixels, w, h, {
    requireFlash: true,
    requireFace: true,
    requireBothEyes: true,
    minFaceRatio: 0.2,
    maxFaceRatio: 0.7,
    blurThreshold: 100,
    minBrightness: 40,    // dim room expected for red reflex
    maxBrightness: 200,
  })
}

/** Quality gate for dental/oral photos. */
export function dentalQualityGate(pixels: Uint8Array, w: number, h: number): QualityGateResult {
  return runQualityGate(pixels, w, h, {
    requireFlash: false,
    requireFace: false,     // oral cavity, not face
    requireBothEyes: false,
    blurThreshold: 80,
    minBrightness: 80,
    maxBrightness: 230,
  })
}

/** Quality gate for skin/external exam photos. */
export function skinQualityGate(pixels: Uint8Array, w: number, h: number): QualityGateResult {
  return runQualityGate(pixels, w, h, {
    requireFlash: false,
    requireFace: false,
    requireBothEyes: false,
    blurThreshold: 60,
    minBrightness: 70,
    maxBrightness: 230,
  })
}

/** Quality gate for ear/ENT photos. */
export function earQualityGate(pixels: Uint8Array, w: number, h: number): QualityGateResult {
  return runQualityGate(pixels, w, h, {
    requireFlash: false,
    requireFace: false,
    requireBothEyes: false,
    blurThreshold: 100,   // ear photos need to be sharp
    minBrightness: 80,
    maxBrightness: 240,
  })
}

/** Quality gate for general face/head-to-toe. */
export function generalQualityGate(pixels: Uint8Array, w: number, h: number): QualityGateResult {
  return runQualityGate(pixels, w, h, {
    requireFlash: false,
    requireFace: true,
    requireBothEyes: false,
    minFaceRatio: 0.1,
    maxFaceRatio: 0.9,
    blurThreshold: 50,
    minBrightness: 60,
    maxBrightness: 230,
  })
}
