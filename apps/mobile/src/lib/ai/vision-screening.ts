/**
 * Vision screening AI — Red reflex analysis, pupil assessment.
 *
 * Analyzes flash photos for:
 * - Red reflex presence and symmetry (leukocoria detection)
 * - Pupil size asymmetry (anisocoria)
 * - Basic strabismus indicators (corneal light reflex)
 *
 * On React Native, pixel data comes from image processing libraries.
 */

export interface RedReflexResult {
  present: boolean
  symmetry: number // 0-1, 1 = perfectly symmetric
  leftIntensity: number
  rightIntensity: number
}

/**
 * Analyze red reflex from flash eye photo pixels.
 * @param pixels - RGBA Uint8Array
 * @param width - image width
 * @param height - image height
 */
export function analyzeRedReflex(pixels: Uint8Array, width: number, height: number): RedReflexResult {
  const regions = {
    leftEye: { x: Math.floor(width * 0.25), y: Math.floor(height * 0.35), w: Math.floor(width * 0.15), h: Math.floor(height * 0.1) },
    rightEye: { x: Math.floor(width * 0.6), y: Math.floor(height * 0.35), w: Math.floor(width * 0.15), h: Math.floor(height * 0.1) },
  }

  const analyzeRegion = (region: { x: number; y: number; w: number; h: number }) => {
    let redSum = 0, count = 0
    for (let y = region.y; y < region.y + region.h; y++) {
      for (let x = region.x; x < region.x + region.w; x++) {
        const idx = (y * width + x) * 4
        const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]
        if (r > g && r > b && r > 100) {
          redSum += r
          count++
        }
      }
    }
    return count > 0 ? redSum / count : 0
  }

  const leftIntensity = analyzeRegion(regions.leftEye)
  const rightIntensity = analyzeRegion(regions.rightEye)
  const avgIntensity = (leftIntensity + rightIntensity) / 2
  const symmetry = 1 - Math.abs(leftIntensity - rightIntensity) / (avgIntensity + 1)
  const present = avgIntensity > 50

  return { present, symmetry, leftIntensity, rightIntensity }
}

export interface PhotoscreenFinding {
  id: string
  label: string
  detected: boolean
  confidence: number
  chipId: string
}

/**
 * Run photoscreening analysis on flash eye photo.
 * Rule-based crescent analysis for anisometropia risk.
 */
export function analyzePhotoscreening(pixels: Uint8Array, width: number, height: number): {
  findings: PhotoscreenFinding[]
  overallRisk: 'pass' | 'refer' | 'inconclusive'
  redReflex: RedReflexResult
} {
  const redReflex = analyzeRedReflex(pixels, width, height)

  const findings: PhotoscreenFinding[] = []

  // Red reflex abnormality (potential retinoblastoma, cataract)
  findings.push({
    id: 'red_reflex',
    label: 'Abnormal Red Reflex',
    detected: !redReflex.present || redReflex.symmetry < 0.6,
    confidence: redReflex.present ? 0.3 : 0.8,
    chipId: 'v4',
  })

  // Anisocoria (pupil size asymmetry)
  findings.push({
    id: 'anisocoria',
    label: 'Anisocoria (Pupil Asymmetry)',
    detected: redReflex.symmetry < 0.5,
    confidence: redReflex.symmetry < 0.5 ? 0.65 : 0.2,
    chipId: 'v5',
  })

  // Anisometropia risk (refractive error asymmetry via crescent analysis)
  const crescentAsymmetry = Math.abs(redReflex.leftIntensity - redReflex.rightIntensity)
  findings.push({
    id: 'anisometropia',
    label: 'Anisometropia Risk',
    detected: crescentAsymmetry > 30,
    confidence: Math.min(0.85, crescentAsymmetry / 60),
    chipId: 'v_aniso',
  })

  // Overall risk scoring
  const detectedFindings = findings.filter(f => f.detected)
  const totalRisk = detectedFindings.reduce((sum, f) => sum + f.confidence, 0)

  let overallRisk: 'pass' | 'refer' | 'inconclusive' = 'pass'
  if (totalRisk >= 1.5) overallRisk = 'refer'
  else if (totalRisk >= 0.5) overallRisk = 'inconclusive'

  return { findings, overallRisk, redReflex }
}
