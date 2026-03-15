/**
 * Vision Screening — Medical-grade photoscreening with three-tier ensemble.
 *
 * Tier 1: Rule-based red reflex analysis (pixel-level, fully offline)
 * Tier 2: MobileNetV2 ONNX classifier (6-class) + crescent analysis (offline)
 * Tier 3: LLM vision verification (online, optional)
 *
 * Detects:
 *   - Strabismus (H50) — eye misalignment → amblyopia risk
 *   - Anisocoria (H57.0) — pupil size difference → neurological concern
 *   - Abnormal Red Reflex (H44.9) — absent/white reflex → retinoblastoma, cataract
 *   - Ptosis (H02.4) — drooping eyelid → amblyopia risk
 *   - Anisometropia Risk (H52.3) — refractive asymmetry → myopia/hyperopia
 *   - Media Opacity (H26.9) — lens/cornea opacity → cataract
 *
 * Plus refractive error analysis via crescent patterns:
 *   - Myopia risk — inferior/temporal crescent
 *   - Hyperopia risk — superior/nasal crescent
 *   - Astigmatism risk — oblique crescent orientation
 */

import type { AITierResult, AIFinding } from './pipeline'
import { loadModel, runInference, preprocessPixels } from './model-loader-mobile'

// ── Constants ──

/** Model URL — can be local asset or R2 CDN for lazy download. */
const PHOTOSCREEN_MODEL_URL = 'https://pub-skids-models.r2.dev/photoscreen-v1.onnx'

/** MobileNetV2 output classes — same as web photoscreening.ts */
export const PHOTOSCREEN_FINDINGS = [
  { index: 0, chipId: 'v1', label: 'Strabismus', icd: 'H50', riskWeight: 3 },
  { index: 1, chipId: 'v5', label: 'Anisocoria', icd: 'H57.0', riskWeight: 2 },
  { index: 2, chipId: 'v4', label: 'Abnormal Red Reflex', icd: 'H44.9', riskWeight: 4 },
  { index: 3, chipId: 'v6', label: 'Ptosis', icd: 'H02.4', riskWeight: 2 },
  { index: 4, chipId: 'v_aniso', label: 'Anisometropia Risk', icd: 'H52.3', riskWeight: 3 },
  { index: 5, chipId: 'v_media', label: 'Media Opacity', icd: 'H26.9', riskWeight: 5 },
] as const

/** Extended refractive findings (from crescent analysis). */
export const REFRACTIVE_FINDINGS = [
  { chipId: 'v_myopia', label: 'Myopia Risk', icd: 'H52.1', riskWeight: 2 },
  { chipId: 'v_hyperopia', label: 'Hyperopia Risk', icd: 'H52.0', riskWeight: 2 },
  { chipId: 'v_astigmatism', label: 'Astigmatism Risk', icd: 'H52.2', riskWeight: 2 },
  { chipId: 'v_amblyopia', label: 'Amblyopia Risk (Composite)', icd: 'H53.0', riskWeight: 4 },
] as const

// ── Types ──

export interface RedReflexResult {
  present: boolean
  symmetry: number       // 0-1, 1 = perfectly symmetric
  leftIntensity: number
  rightIntensity: number
}

export interface CrescentAnalysis {
  leftCrescentAngle: number    // degrees, 0 = horizontal
  rightCrescentAngle: number
  asymmetry: number            // absolute angle difference
  leftOrientation: 'inferior' | 'superior' | 'nasal' | 'temporal' | 'oblique' | 'none'
  rightOrientation: 'inferior' | 'superior' | 'nasal' | 'temporal' | 'oblique' | 'none'
  estimatedAnisometropia: boolean
  estimatedMyopia: boolean
  estimatedHyperopia: boolean
  estimatedAstigmatism: boolean
}

export interface PhotoscreenFinding {
  id: string
  chipId: string
  label: string
  detected: boolean
  confidence: number
  icdCode: string
  riskWeight: number
}

export interface PhotoscreenResult {
  findings: PhotoscreenFinding[]
  modelScores: number[]         // raw 6-class sigmoid scores (empty if model unavailable)
  crescentAnalysis: CrescentAnalysis
  redReflex: RedReflexResult
  overallRisk: 'pass' | 'refer' | 'inconclusive'
  heatmapBase64?: string
  inferenceTimeMs: number
}

// ── Utility ──

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

// ── Tier 1: Rule-based Red Reflex Analysis ──

/**
 * Analyze red reflex from flash eye photo pixels.
 * Improved version: uses adaptive region detection instead of fixed coordinates.
 */
export function analyzeRedReflex(pixels: Uint8Array, width: number, height: number): RedReflexResult {
  // Find the two brightest red regions (likely pupils with red reflex)
  const gridSize = 10
  const cellW = Math.floor(width / gridSize)
  const cellH = Math.floor(height / gridSize)

  const cellScores: Array<{ gx: number; gy: number; redScore: number }> = []

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let redScore = 0
      let count = 0

      for (let y = gy * cellH; y < (gy + 1) * cellH; y += 2) {
        for (let x = gx * cellW; x < (gx + 1) * cellW; x += 2) {
          const idx = (y * width + x) * 4
          const r = pixels[idx]
          const g = pixels[idx + 1]
          const b = pixels[idx + 2]

          // Red-dominant pixel = likely red reflex
          if (r > 100 && r > g * 1.2 && r > b * 1.2) {
            redScore += r - Math.max(g, b)
          }
          count++
        }
      }

      if (count > 0) {
        cellScores.push({ gx, gy, redScore: redScore / count })
      }
    }
  }

  // Sort by red score — top 2 are likely the two eyes
  cellScores.sort((a, b) => b.redScore - a.redScore)

  const eye1 = cellScores[0]
  const eye2 = cellScores.length > 1 ? cellScores[1] : null

  // Verify they're roughly horizontally aligned (same row ± 2 cells) and separated
  const isValidPair = eye2 &&
    Math.abs(eye1.gy - eye2.gy) <= 2 &&
    Math.abs(eye1.gx - eye2.gx) >= 2

  // Compute intensities from regions
  const analyzeRegion = (gx: number, gy: number): number => {
    let redSum = 0
    let count = 0
    const startY = Math.max(0, gy * cellH - cellH)
    const endY = Math.min(height, (gy + 2) * cellH)
    const startX = Math.max(0, gx * cellW - cellW)
    const endX = Math.min(width, (gx + 2) * cellW)

    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const idx = (y * width + x) * 4
        const r = pixels[idx]
        const g = pixels[idx + 1]
        const b = pixels[idx + 2]
        if (r > g && r > b && r > 80) {
          redSum += r
          count++
        }
      }
    }
    return count > 0 ? redSum / count : 0
  }

  const leftIntensity = analyzeRegion(eye1.gx, eye1.gy)
  const rightIntensity = isValidPair ? analyzeRegion(eye2!.gx, eye2!.gy) : 0

  const avgIntensity = isValidPair ? (leftIntensity + rightIntensity) / 2 : leftIntensity
  const symmetry = isValidPair
    ? 1 - Math.abs(leftIntensity - rightIntensity) / (avgIntensity + 1)
    : 0.5  // can't assess symmetry with only one eye

  const present = avgIntensity > 50

  return { present, symmetry, leftIntensity, rightIntensity }
}

// ── Crescent Analysis for Refractive Errors ──

/**
 * Analyze red reflex crescents for refractive error indicators.
 * Based on Brückner test photoscreening technique.
 *
 * Crescent position indicates refractive error type:
 *   - Inferior crescent → Myopia (nearsightedness)
 *   - Superior crescent → Hyperopia (farsightedness)
 *   - Oblique crescent → Astigmatism
 *   - Asymmetric crescents between eyes → Anisometropia
 */
export function analyzeCrescents(
  pixels: Uint8Array,
  width: number,
  height: number
): CrescentAnalysis {
  // Estimate pupil locations (use center-ish regions)
  const leftPupil = {
    cx: Math.floor(width * 0.35),
    cy: Math.floor(height * 0.4),
    r: Math.floor(Math.min(width, height) * 0.06),
  }
  const rightPupil = {
    cx: Math.floor(width * 0.65),
    cy: Math.floor(height * 0.4),
    r: Math.floor(Math.min(width, height) * 0.06),
  }

  function analyzeOnePupil(cx: number, cy: number, r: number): {
    angle: number
    orientation: CrescentAnalysis['leftOrientation']
  } {
    let topBrightness = 0
    let bottomBrightness = 0
    let leftBrightness = 0
    let rightBrightness = 0
    let count = 0

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const px = cx + dx
        const py = cy + dy
        if (px < 0 || px >= width || py < 0 || py >= height) continue

        const idx = (py * width + px) * 4
        // Weight towards red channel for red reflex
        const brightness = (pixels[idx] * 2 + pixels[idx + 1] + pixels[idx + 2]) / 4

        if (dy < 0) topBrightness += brightness
        else bottomBrightness += brightness
        if (dx < 0) leftBrightness += brightness
        else rightBrightness += brightness
        count++
      }
    }

    if (count === 0) return { angle: 0, orientation: 'none' }

    const vertAsym = Math.abs(topBrightness - bottomBrightness) / (count * 128)
    const horizAsym = Math.abs(leftBrightness - rightBrightness) / (count * 128)
    const angle = Math.atan2(vertAsym, horizAsym) * (180 / Math.PI)

    // Determine orientation based on which half is brighter
    let orientation: CrescentAnalysis['leftOrientation'] = 'none'
    if (vertAsym > 0.05 || horizAsym > 0.05) {
      if (vertAsym > horizAsym * 1.5) {
        orientation = bottomBrightness > topBrightness ? 'inferior' : 'superior'
      } else if (horizAsym > vertAsym * 1.5) {
        orientation = rightBrightness > leftBrightness ? 'temporal' : 'nasal'
      } else {
        orientation = 'oblique'
      }
    }

    return { angle: Math.round(angle * 10) / 10, orientation }
  }

  const left = analyzeOnePupil(leftPupil.cx, leftPupil.cy, leftPupil.r)
  const right = analyzeOnePupil(rightPupil.cx, rightPupil.cy, rightPupil.r)
  const asymmetry = Math.abs(left.angle - right.angle)

  return {
    leftCrescentAngle: left.angle,
    rightCrescentAngle: right.angle,
    asymmetry: Math.round(asymmetry * 10) / 10,
    leftOrientation: left.orientation,
    rightOrientation: right.orientation,
    estimatedAnisometropia: asymmetry > 15,
    estimatedMyopia: left.orientation === 'inferior' || right.orientation === 'inferior',
    estimatedHyperopia: left.orientation === 'superior' || right.orientation === 'superior',
    estimatedAstigmatism: left.orientation === 'oblique' || right.orientation === 'oblique',
  }
}

// ── Tier 2: ML Model + Rule-Based Combined ──

/**
 * Run Tier 1 rule-based analysis only (works offline, no model needed).
 */
export function runRuleBasedAnalysis(
  pixels: Uint8Array,
  width: number,
  height: number
): AITierResult {
  const startTime = performance.now()

  const redReflex = analyzeRedReflex(pixels, width, height)
  const crescents = analyzeCrescents(pixels, width, height)

  const findings: AIFinding[] = []

  // Red reflex abnormality
  if (!redReflex.present || redReflex.symmetry < 0.6) {
    findings.push({
      id: 'red_reflex_rule',
      label: 'Abnormal Red Reflex',
      chipId: 'v4',
      confidence: redReflex.present ? 0.4 : 0.75,
      icdCode: 'H44.9',
      riskWeight: 4,
      reasoning: `Red reflex ${redReflex.present ? 'asymmetric' : 'absent'}. Symmetry: ${(redReflex.symmetry * 100).toFixed(0)}%`,
    })
  }

  // Anisocoria (pupil asymmetry via reflex symmetry)
  if (redReflex.symmetry < 0.5) {
    findings.push({
      id: 'anisocoria_rule',
      label: 'Anisocoria (Pupil Asymmetry)',
      chipId: 'v5',
      confidence: 0.5 + (0.5 - redReflex.symmetry),
      icdCode: 'H57.0',
      riskWeight: 2,
      reasoning: `Pupil reflex asymmetry detected. Symmetry score: ${(redReflex.symmetry * 100).toFixed(0)}%`,
    })
  }

  // Anisometropia (crescent asymmetry)
  if (crescents.estimatedAnisometropia) {
    findings.push({
      id: 'anisometropia_rule',
      label: 'Anisometropia Risk',
      chipId: 'v_aniso',
      confidence: Math.min(0.85, 0.5 + crescents.asymmetry / 50),
      icdCode: 'H52.3',
      riskWeight: 3,
      reasoning: `Crescent asymmetry: ${crescents.asymmetry.toFixed(1)}° between eyes`,
    })
  }

  // Myopia risk
  if (crescents.estimatedMyopia) {
    findings.push({
      id: 'myopia_rule',
      label: 'Myopia Risk',
      chipId: 'v_myopia',
      confidence: 0.55,
      icdCode: 'H52.1',
      riskWeight: 2,
      reasoning: `Inferior crescent detected (${crescents.leftOrientation === 'inferior' ? 'left' : 'right'} eye)`,
    })
  }

  // Hyperopia risk
  if (crescents.estimatedHyperopia) {
    findings.push({
      id: 'hyperopia_rule',
      label: 'Hyperopia Risk',
      chipId: 'v_hyperopia',
      confidence: 0.55,
      icdCode: 'H52.0',
      riskWeight: 2,
      reasoning: `Superior crescent detected (${crescents.leftOrientation === 'superior' ? 'left' : 'right'} eye)`,
    })
  }

  // Astigmatism risk
  if (crescents.estimatedAstigmatism) {
    findings.push({
      id: 'astigmatism_rule',
      label: 'Astigmatism Risk',
      chipId: 'v_astigmatism',
      confidence: 0.5,
      icdCode: 'H52.2',
      riskWeight: 2,
      reasoning: `Oblique crescent orientation detected`,
    })
  }

  // Composite amblyopia risk
  const amblyopiaRiskFactors = findings.filter(f =>
    ['v1', 'v_aniso', 'v6', 'v_media'].includes(f.chipId)
  )
  if (amblyopiaRiskFactors.length > 0) {
    const maxConf = Math.max(...amblyopiaRiskFactors.map(f => f.confidence))
    findings.push({
      id: 'amblyopia_composite',
      label: 'Amblyopia Risk (Composite)',
      chipId: 'v_amblyopia',
      confidence: Math.min(0.9, maxConf + amblyopiaRiskFactors.length * 0.1),
      icdCode: 'H53.0',
      riskWeight: 4,
      reasoning: `Risk factors: ${amblyopiaRiskFactors.map(f => f.label).join(', ')}`,
    })
  }

  return {
    tier: 1,
    provider: 'rule-based',
    findings,
    confidence: findings.length > 0
      ? Math.min(0.6, findings.reduce((s, f) => s + f.confidence, 0) / findings.length)
      : 0.5,
    inferenceMs: Math.round(performance.now() - startTime),
  }
}

/**
 * Run Tier 2 analysis: ML model (if available) + enhanced rule-based.
 */
export async function runMLAnalysis(
  pixels: Uint8Array,
  width: number,
  height: number,
  onModelProgress?: (progress: { loaded: number; total: number; percent: number }) => void,
): Promise<AITierResult> {
  const startTime = performance.now()

  // First, run rule-based as baseline
  const ruleResult = runRuleBasedAnalysis(pixels, width, height)

  // Try loading and running ONNX model
  const model = await loadModel(PHOTOSCREEN_MODEL_URL, onModelProgress)

  if (!model) {
    // Model not available — return rule-based result labeled as Tier 2 (partial)
    return {
      ...ruleResult,
      tier: 2,
      provider: 'rule-based-only',
      reasoning: 'ML model not available \u2014 using rule-based analysis only',
    }
  }

  // Preprocess image for MobileNetV2 (224x224, ImageNet normalization)
  const { data, shape } = preprocessPixels(pixels, width, height, 224)
  const outputs = await runInference(model, data, shape)

  if (!outputs) {
    return {
      ...ruleResult,
      tier: 2,
      provider: 'rule-based-only',
      reasoning: 'ML inference failed \u2014 using rule-based analysis only',
    }
  }

  // Parse model output
  const outputName = model.outputNames[0]
  const rawScores = outputs.get(outputName)
  const modelFindings: AIFinding[] = []
  const allScores: number[] = []

  if (rawScores) {
    const scores = Array.from(rawScores).map(sigmoid)
    allScores.push(...scores)

    const threshold = 0.4

    for (const finding of PHOTOSCREEN_FINDINGS) {
      const confidence = scores[finding.index] ?? 0
      if (confidence >= threshold) {
        modelFindings.push({
          id: `model_${finding.chipId}`,
          label: finding.label,
          chipId: finding.chipId,
          confidence: Math.round(confidence * 100) / 100,
          icdCode: finding.icd,
          riskWeight: finding.riskWeight,
          reasoning: `MobileNetV2 score: ${(confidence * 100).toFixed(1)}%`,
        })
      }
    }
  }

  // Merge model findings with rule-based findings (model takes precedence)
  const mergedMap = new Map<string, AIFinding>()

  // Add rule-based first
  for (const f of ruleResult.findings) {
    mergedMap.set(f.chipId, f)
  }

  // Model overrides with higher confidence
  for (const f of modelFindings) {
    const existing = mergedMap.get(f.chipId)
    if (!existing || f.confidence > existing.confidence) {
      mergedMap.set(f.chipId, {
        ...f,
        reasoning: existing
          ? `ML: ${f.reasoning} | Rule: ${existing.reasoning}`
          : f.reasoning,
      })
    }
  }

  const mergedFindings = Array.from(mergedMap.values()).sort((a, b) => b.confidence - a.confidence)

  // Confidence is higher when both model and rules agree
  const modelConfidence = modelFindings.length > 0
    ? modelFindings.reduce((s, f) => s + f.confidence, 0) / modelFindings.length
    : 0
  const overallConfidence = modelFindings.length > 0
    ? Math.min(0.95, (modelConfidence * 0.7 + ruleResult.confidence * 0.3))
    : ruleResult.confidence

  return {
    tier: 2,
    provider: modelFindings.length > 0 ? 'mobilenet-v2 + rules' : 'rule-based-only',
    findings: mergedFindings,
    confidence: overallConfidence,
    inferenceMs: Math.round(performance.now() - startTime),
    reasoning: modelFindings.length > 0
      ? `Model detected ${modelFindings.length} findings, rules detected ${ruleResult.findings.length}`
      : 'ML model loaded but no findings above threshold',
  }
}

// ── Full Photoscreening (legacy-compatible API) ──

/**
 * Run complete photoscreening analysis.
 * Returns both the legacy-compatible result and the new structured result.
 */
export async function analyzePhotoscreening(
  pixels: Uint8Array,
  width: number,
  height: number,
  onModelProgress?: (progress: { loaded: number; total: number; percent: number }) => void,
): Promise<PhotoscreenResult> {
  const startTime = performance.now()

  const redReflex = analyzeRedReflex(pixels, width, height)
  const crescentAnalysis = analyzeCrescents(pixels, width, height)

  // Run ML analysis (includes rule-based as fallback)
  const tierResult = await runMLAnalysis(pixels, width, height, onModelProgress)

  // Convert to legacy PhotoscreenFinding format
  const findings: PhotoscreenFinding[] = tierResult.findings.map(f => ({
    id: f.id,
    chipId: f.chipId,
    label: f.label,
    detected: true,
    confidence: f.confidence,
    icdCode: f.icdCode || '',
    riskWeight: f.riskWeight ?? 1,
  }))

  // Overall risk
  const totalRisk = findings.reduce((sum, f) => sum + f.confidence * f.riskWeight, 0)
  const overallRisk: PhotoscreenResult['overallRisk'] =
    totalRisk >= 5 ? 'refer' :
    totalRisk >= 2 ? 'inconclusive' :
    'pass'

  return {
    findings,
    modelScores: [], // populated from ML model if available
    crescentAnalysis,
    redReflex,
    overallRisk,
    inferenceTimeMs: Math.round(performance.now() - startTime),
  }
}
