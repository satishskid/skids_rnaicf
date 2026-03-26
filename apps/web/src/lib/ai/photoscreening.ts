// client-side only

/**
 * Photoscreening Classifier — GoCheck Kids-style amblyopia risk detection.
 *
 * Detects amblyopia risk factors from a flash photograph of both eyes:
 * - Anisocoria (pupil size asymmetry)
 * - Strabismus (eye misalignment via corneal light reflex)
 * - Anisometropia (refractive error asymmetry from crescent analysis)
 * - Media opacity (abnormal red reflex indicating cataract/retinoblastoma)
 *
 * Uses MobileNetV2 ONNX model (~5 MB) for classification + rule-based
 * crescent analysis for refractive error estimation.
 *
 * Integrates with the vision screening module — runs after photo capture.
 */

import { loadModel, runInference, preprocessImage, type ModelLoadProgress } from './model-loader'

const PHOTOSCREEN_MODEL_URL = '/models/photoscreen-v1.onnx'

export const PHOTOSCREEN_FINDINGS = [
  { index: 0, chipId: 'v1', label: 'Strabismus', icd: 'H50', riskWeight: 3 },
  { index: 1, chipId: 'v5', label: 'Anisocoria', icd: 'H57.0', riskWeight: 2 },
  { index: 2, chipId: 'v4', label: 'Abnormal Red Reflex', icd: 'H44.9', riskWeight: 4 },
  { index: 3, chipId: 'v6', label: 'Ptosis', icd: 'H02.4', riskWeight: 2 },
  { index: 4, chipId: 'v_aniso', label: 'Anisometropia Risk', icd: 'H52.3', riskWeight: 3 },
  { index: 5, chipId: 'v_media', label: 'Media Opacity', icd: 'H26.9', riskWeight: 5 },
] as const

export interface PhotoscreenFinding {
  chipId: string
  label: string
  confidence: number
  icdCode: string
  riskWeight: number
}

export interface PhotoscreenResult {
  findings: PhotoscreenFinding[]
  allScores: number[]
  crescentAnalysis: CrescentAnalysis | null
  overallRisk: 'pass' | 'refer' | 'inconclusive'
  inferenceTimeMs: number
}

/**
 * Crescent analysis — rule-based refractive error estimation from
 * the shape of the red reflex crescent in each eye.
 */
export interface CrescentAnalysis {
  leftCrescentAngle: number   // degrees, 0 = no crescent
  rightCrescentAngle: number
  asymmetry: number           // difference between eyes
  estimatedAnisometropia: boolean
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/**
 * Analyze red reflex crescents for refractive error indicators.
 * In photorefraction, the crescent (bright/dark pattern within the pupil)
 * indicates the eye's refractive state. Asymmetric crescents = anisometropia risk.
 */
function analyzeCrescents(imageData: ImageData): CrescentAnalysis {
  const { width, height, data } = imageData

  // Define approximate pupil regions (assumes face centered, flash photo)
  const leftPupil = {
    cx: Math.floor(width * 0.35), cy: Math.floor(height * 0.4),
    r: Math.floor(Math.min(width, height) * 0.06),
  }
  const rightPupil = {
    cx: Math.floor(width * 0.65), cy: Math.floor(height * 0.4),
    r: Math.floor(Math.min(width, height) * 0.06),
  }

  function analyzeOnePupil(cx: number, cy: number, r: number): number {
    // Scan pupil region, compute brightness distribution to detect crescent
    let topHalfBrightness = 0, bottomHalfBrightness = 0
    let leftHalfBrightness = 0, rightHalfBrightness = 0
    let count = 0

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const px = cx + dx
        const py = cy + dy
        if (px < 0 || px >= width || py < 0 || py >= height) continue

        const idx = (py * width + px) * 4
        const brightness = (data[idx] * 2 + data[idx + 1] + data[idx + 2]) / 4 // Weight red channel

        if (dy < 0) topHalfBrightness += brightness
        else bottomHalfBrightness += brightness
        if (dx < 0) leftHalfBrightness += brightness
        else rightHalfBrightness += brightness
        count++
      }
    }

    if (count === 0) return 0

    // Crescent angle estimation from brightness asymmetry
    const vertAsym = Math.abs(topHalfBrightness - bottomHalfBrightness) / (count * 128)
    const horizAsym = Math.abs(leftHalfBrightness - rightHalfBrightness) / (count * 128)
    return Math.atan2(vertAsym, horizAsym) * (180 / Math.PI)
  }

  const leftAngle = analyzeOnePupil(leftPupil.cx, leftPupil.cy, leftPupil.r)
  const rightAngle = analyzeOnePupil(rightPupil.cx, rightPupil.cy, rightPupil.r)
  const asymmetry = Math.abs(leftAngle - rightAngle)

  return {
    leftCrescentAngle: Math.round(leftAngle * 10) / 10,
    rightCrescentAngle: Math.round(rightAngle * 10) / 10,
    asymmetry: Math.round(asymmetry * 10) / 10,
    estimatedAnisometropia: asymmetry > 15, // >15° difference suggests anisometropia
  }
}

/**
 * Run photoscreening analysis on a flash photograph of both eyes.
 *
 * @param imageData - Raw pixel data from flash photo
 * @param threshold - Minimum confidence to report a finding (default: 0.4)
 * @param onProgress - Callback for model download progress
 */
export async function runPhotoscreening(
  imageData: ImageData,
  threshold: number = 0.4,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<PhotoscreenResult> {
  const startTime = performance.now()

  // Always run crescent analysis (rule-based, no model needed)
  const crescentAnalysis = analyzeCrescents(imageData)

  // Try ONNX model for deep classification
  const findings: PhotoscreenFinding[] = []
  let allScores: number[] = []

  const model = await loadModel(PHOTOSCREEN_MODEL_URL, onProgress)
  if (model) {
    const { data, shape } = preprocessImage(imageData, 224)
    const outputs = await runInference(model, data, shape)

    if (outputs) {
      const outputName = model.outputNames[0]
      const rawScores = outputs.get(outputName)
      if (rawScores) {
        allScores = Array.from(rawScores).map(sigmoid)

        for (const finding of PHOTOSCREEN_FINDINGS) {
          const confidence = allScores[finding.index]
          if (confidence >= threshold) {
            findings.push({
              chipId: finding.chipId,
              label: finding.label,
              confidence: Math.round(confidence * 100) / 100,
              icdCode: finding.icd,
              riskWeight: finding.riskWeight,
            })
          }
        }
      }
    }
  }

  // Add crescent-based finding if significant asymmetry detected
  if (crescentAnalysis.estimatedAnisometropia) {
    const existing = findings.find(f => f.chipId === 'v_aniso')
    if (!existing) {
      findings.push({
        chipId: 'v_aniso',
        label: 'Anisometropia Risk',
        confidence: Math.min(0.9, 0.5 + crescentAnalysis.asymmetry / 50),
        icdCode: 'H52.3',
        riskWeight: 3,
      })
    }
  }

  findings.sort((a, b) => b.confidence - a.confidence)

  // Overall risk determination
  const totalRisk = findings.reduce((sum, f) => sum + f.confidence * f.riskWeight, 0)
  const overallRisk: PhotoscreenResult['overallRisk'] =
    totalRisk >= 5 ? 'refer' :
    totalRisk >= 2 ? 'inconclusive' :
    'pass'

  return {
    findings,
    allScores,
    crescentAnalysis,
    overallRisk,
    inferenceTimeMs: Math.round(performance.now() - startTime),
  }
}

/**
 * Convenience wrapper for base64 images.
 */
export async function runPhotoscreeningBase64(
  base64Image: string,
  threshold: number = 0.4,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<PhotoscreenResult> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve(await runPhotoscreening(imageData, threshold, onProgress))
    }
    img.onerror = () => resolve({
      findings: [], allScores: [], crescentAnalysis: null,
      overallRisk: 'inconclusive', inferenceTimeMs: 0,
    })
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`
  })
}
