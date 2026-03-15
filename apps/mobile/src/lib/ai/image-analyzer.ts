/**
 * On-Device Image Analyzer
 *
 * Reads captured image URI → decodes to raw pixels → runs module-specific
 * analysis functions LOCALLY (no network needed).
 *
 * This is Tier 1/2 of the AI pipeline — runs BEFORE any cloud fallback.
 *
 * Supported modules:
 *   - Vision (eye): Red reflex analysis, photoscreening
 *   - Ear: Inflammation/otitis detection
 *   - Skin: Wound segmentation, clinical color analysis
 *   - Dental: Clinical color analysis (oral cavity)
 *   - General: Clinical color analysis (pallor, cyanosis, jaundice)
 */

import * as FileSystem from 'expo-file-system'
import * as jpeg from 'jpeg-js'
import { Buffer } from 'buffer'

// Import all on-device analysis functions
import { analyzeRedReflex, analyzePhotoscreening } from './vision-screening'
import { analyzeEarImage } from './ear-analysis'
import { segmentWound } from './skin-analysis'
import { analyzeClinicalColors } from './clinical-color'
import {
  visionQualityGate, earQualityGate, skinQualityGate,
  dentalQualityGate, generalQualityGate,
} from './quality-gate'
import type { QualityGateResult } from './pipeline'
import {
  isLLMPrimaryModule as _isLLMPrimaryModule,
  buildStructuredVisionPrompt,
  parseVisionAnalysis,
  queryLLM,
  loadLLMConfig,
  type LLMMessage,
} from './llm-gateway'

// Re-use the AIResult type from ai-engine
import type { AIResult } from '../ai-engine'

// Re-export for convenience
export { _isLLMPrimaryModule as isLLMPrimaryModule }

export interface ImageAnalysisResult {
  aiResult: AIResult
  qualityGate: QualityGateResult | null
  analysisType: 'vision' | 'ear' | 'skin' | 'dental' | 'general'
  onDevice: true  // always true — this is local analysis
  inferenceMs: number
}

/**
 * Decode a JPEG image URI to raw RGBA pixel data.
 * Uses jpeg-js for pure-JS decoding (no native Canvas needed).
 */
async function imageUriToPixels(uri: string): Promise<{
  pixels: Uint8Array
  width: number
  height: number
}> {
  // Read image as base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  // Decode base64 to buffer
  const buffer = Buffer.from(base64, 'base64')

  // Decode JPEG to raw RGBA pixels
  const decoded = jpeg.decode(buffer, {
    useTArray: true,  // Return Uint8Array instead of Buffer
    formatAsRGBA: true,
  })

  return {
    pixels: decoded.data as unknown as Uint8Array,
    width: decoded.width,
    height: decoded.height,
  }
}

/**
 * Determine which analysis type to use based on module type.
 */
function getAnalysisType(moduleType: string): ImageAnalysisResult['analysisType'] {
  const mod = moduleType.toLowerCase()
  if (mod.includes('vision') || mod.includes('red_reflex') || mod.includes('eye')
      || mod.includes('photoscreening') || mod === 'external_eye') {
    return 'vision'
  }
  if (mod.includes('ear') || mod.includes('ent') || mod.includes('otoscopy')) {
    return 'ear'
  }
  if (mod.includes('skin') || mod.includes('derma') || mod.includes('wound')) {
    return 'skin'
  }
  if (mod.includes('dental') || mod.includes('oral') || mod.includes('throat')
      || mod.includes('mouth')) {
    return 'dental'
  }
  return 'general'
}

/**
 * Run on-device image analysis for a captured photo.
 *
 * This runs LOCALLY — no network, no cloud, no API keys.
 * Returns structured findings that can be displayed in AIResultCard.
 */
export async function analyzeImageOnDevice(
  imageUri: string,
  moduleType: string,
): Promise<ImageAnalysisResult> {
  const startTime = performance.now()
  const analysisType = getAnalysisType(moduleType)

  try {
    // Step 1: Decode image to raw pixels
    const { pixels, width, height } = await imageUriToPixels(imageUri)

    // Step 2: Run quality gate
    let qualityGate: QualityGateResult | null = null
    try {
      switch (analysisType) {
        case 'vision':
          qualityGate = visionQualityGate(pixels, width, height)
          break
        case 'ear':
          qualityGate = earQualityGate(pixels, width, height)
          break
        case 'skin':
          qualityGate = skinQualityGate(pixels, width, height)
          break
        case 'dental':
          qualityGate = dentalQualityGate(pixels, width, height)
          break
        default:
          qualityGate = generalQualityGate(pixels, width, height)
      }
    } catch (err) {
      console.warn('Quality gate error:', err)
    }

    // Step 3: Run module-specific analysis
    const suggestedChips: string[] = []
    let classification = 'Normal'
    let confidence = 0.7
    let summary = ''

    switch (analysisType) {
      case 'vision': {
        try {
          const redReflex = analyzeRedReflex(pixels, width, height)
          // RedReflexResult: { present, symmetry, leftIntensity, rightIntensity }
          if (redReflex.symmetry < 0.7) {
            classification = 'Review Needed'
            confidence = 0.75
            summary = `Red reflex asymmetry detected (symmetry: ${Math.round(redReflex.symmetry * 100)}%). L: ${Math.round(redReflex.leftIntensity * 100)}%, R: ${Math.round(redReflex.rightIntensity * 100)}%`
            suggestedChips.push('abnormal_red_reflex')
          } else if (!redReflex.present) {
            classification = 'Review Needed'
            confidence = 0.7
            summary = 'Red reflex not clearly detected — may need retake'
            suggestedChips.push('absent_red_reflex')
          } else {
            summary = `Red reflex symmetric and present (symmetry: ${Math.round(redReflex.symmetry * 100)}%)`
            confidence = 0.8
          }

          // ── Photoscreening ensemble — run alongside red reflex for comprehensive vision analysis ──
          try {
            const photoscreen = analyzePhotoscreening(pixels, width, height)
            // PhotoscreenFinding[]: array of { finding, side, confidence, chipId }
            if (Array.isArray(photoscreen) && photoscreen.length > 0) {
              const significantFindings = photoscreen.filter(f => f.confidence > 0.5)
              if (significantFindings.length > 0) {
                classification = 'Review Needed'
                confidence = Math.max(confidence, ...significantFindings.map(f => f.confidence))
                const findingDescriptions = significantFindings.map(f =>
                  `${f.finding}${f.side ? ` (${f.side})` : ''}: ${Math.round(f.confidence * 100)}%`
                ).join('; ')
                summary += ` | Photoscreening: ${findingDescriptions}`
                for (const f of significantFindings) {
                  if (f.chipId && !suggestedChips.includes(f.chipId)) {
                    suggestedChips.push(f.chipId)
                  }
                }
              } else {
                summary += ' | Photoscreening: no significant findings'
              }
            }
          } catch (psErr) {
            console.warn('Photoscreening analysis failed (red reflex result still valid):', psErr)
          }
        } catch {
          // Red reflex failed, try clinical color
          const colors = analyzeClinicalColors(pixels, width, height)
          const abnormalChips = colors.suggestedChips || []
          summary = `Color analysis: ${abnormalChips.length > 0 ? abnormalChips.join(', ') : 'No significant findings'}`
          if (abnormalChips.length > 0) {
            classification = 'Review Needed'
            suggestedChips.push(...abnormalChips)
          }
          confidence = colors.confidence || 0.6
        }
        break
      }

      case 'ear': {
        const earResult = analyzeEarImage(pixels, width, height)
        // EarAnalysisResult: { visibility, colorScore, symmetry, inflammationIndicator, riskCategory }
        if (earResult.riskCategory === 'high_risk') {
          classification = 'Moderate Risk'
          confidence = Math.min(0.85, earResult.inflammationIndicator)
          summary = `High risk — inflammation indicator: ${Math.round(earResult.inflammationIndicator * 100)}%, visibility: ${Math.round(earResult.visibility * 100)}%`
          suggestedChips.push('ear_inflammation', 'possible_otitis')
        } else if (earResult.riskCategory === 'possible_risk') {
          classification = 'Low Risk'
          confidence = 0.65
          summary = `Possible risk — inflammation indicator: ${Math.round(earResult.inflammationIndicator * 100)}%, color score: ${Math.round(earResult.colorScore * 100)}%`
          suggestedChips.push('ear_inflammation')
        } else {
          summary = `Ear appears normal. Inflammation: ${Math.round(earResult.inflammationIndicator * 100)}%, symmetry: ${Math.round(earResult.symmetry * 100)}%`
          confidence = 0.75
        }
        break
      }

      case 'skin': {
        const skinResult = segmentWound(pixels, width, height)
        const colors = analyzeClinicalColors(pixels, width, height)
        // WoundSegmentationResult: { woundArea, boundingBox, tissueComposition: { granulation, slough, necrotic } }
        // ClinicalColorResult: { regionScores: { redness, pallor, cyanosis, darkSpots, whitePatches, yellowIcteric }, suggestedChips, confidence }

        const hasWound = skinResult.woundArea > 0.01 // >1% of image is wound
        const abnormalColors = colors.suggestedChips || []

        if (hasWound || abnormalColors.length > 0) {
          classification = 'Review Needed'
          confidence = colors.confidence || 0.7

          const findings: string[] = []
          if (hasWound) {
            const { granulation, slough, necrotic } = skinResult.tissueComposition
            findings.push(`Wound area: ${Math.round(skinResult.woundArea * 100)}% — granulation: ${Math.round(granulation * 100)}%, slough: ${Math.round(slough * 100)}%, necrotic: ${Math.round(necrotic * 100)}%`)
            suggestedChips.push('skin_lesion')
          }
          if (abnormalColors.length > 0) {
            findings.push(`Color findings: ${abnormalColors.join(', ')}`)
            suggestedChips.push(...abnormalColors)
          }
          summary = findings.join('. ')
        } else {
          summary = 'Skin appears normal — no lesions or color abnormalities detected'
          confidence = 0.75
        }
        break
      }

      case 'dental': {
        const colors = analyzeClinicalColors(pixels, width, height)
        const abnormalChips = colors.suggestedChips || []
        if (abnormalChips.length > 0) {
          classification = 'Review Needed'
          confidence = colors.confidence || 0.65
          summary = `Oral findings: ${abnormalChips.join(', ')}`
          suggestedChips.push('dental_abnormality', ...abnormalChips)
        } else {
          summary = 'Oral cavity appears normal'
          confidence = 0.7
        }
        break
      }

      default: {
        // General module — run clinical color analysis
        const colors = analyzeClinicalColors(pixels, width, height)
        const abnormalChips = colors.suggestedChips || []
        if (abnormalChips.length > 0) {
          classification = 'Review Needed'
          confidence = colors.confidence || 0.6
          summary = `Clinical findings: ${abnormalChips.join(', ')}`
          suggestedChips.push(...abnormalChips)
        } else {
          summary = 'No significant findings from image analysis'
          confidence = 0.65
        }
        break
      }
    }

    const inferenceMs = Math.round(performance.now() - startTime)

    return {
      aiResult: {
        classification,
        confidence,
        summary: `[On-device AI] ${summary}`,
        suggestedChips,
      },
      qualityGate,
      analysisType,
      onDevice: true,
      inferenceMs,
    }
  } catch (err) {
    const inferenceMs = Math.round(performance.now() - startTime)
    console.warn('On-device image analysis failed:', err)

    return {
      aiResult: {
        classification: 'Unknown',
        confidence: 0,
        summary: `[On-device AI] Analysis failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        suggestedChips: [],
      },
      qualityGate: null,
      analysisType,
      onDevice: true,
      inferenceMs,
    }
  }
}

// ── LLM-Primary Analysis for clinical image modules ──

export interface LLMPrimaryAnalysisResult {
  aiResult: AIResult
  qualityGate: QualityGateResult | null
  analysisType: ImageAnalysisResult['analysisType']
  onDevice: false
  llmProvider: string
  llmModel: string
  llmLatencyMs: number
  inferenceMs: number
  regions?: Array<{ chipId: string; label: string; region: { x: number; y: number; w: number; h: number } }>
}

/**
 * Run LLM vision as the PRIMARY analysis path for clinical image modules.
 *
 * This is used for ENT/dental/skin/throat/nose/etc. where a vision LLM
 * (Gemini Flash, LFM2-VL, MedGemma) can identify specific clinical conditions
 * that pixel-based color thresholds cannot distinguish.
 *
 * Pipeline:
 *   1. Quality gate (blur/exposure) — still runs on-device
 *   2. LLM Vision — PRIMARY path, returns structured findings with chip IDs
 *   3. Pixel analysis — runs in parallel as offline fallback
 *
 * If LLM fails (offline, timeout, error), falls back to on-device pixel analysis.
 */
export async function analyzeImageLLMPrimary(
  imageUri: string,
  moduleType: string,
  moduleName: string,
  childAge?: string,
  nurseChips?: string[],
  chipSeverities?: Record<string, string>,
): Promise<ImageAnalysisResult | LLMPrimaryAnalysisResult> {
  const startTime = performance.now()
  const analysisType = getAnalysisType(moduleType)

  // Run pixel analysis and LLM in parallel — use whichever succeeds with better result
  const pixelPromise = analyzeImageOnDevice(imageUri, moduleType).catch(() => null)

  try {
    // Step 1: Read image as base64 for LLM
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    // Step 2: Quick quality gate from pixel data (non-blocking)
    let qualityGate: QualityGateResult | null = null
    try {
      const { pixels, width, height } = await imageUriToPixels(imageUri)
      switch (analysisType) {
        case 'ear': qualityGate = earQualityGate(pixels, width, height); break
        case 'skin': qualityGate = skinQualityGate(pixels, width, height); break
        case 'dental': qualityGate = dentalQualityGate(pixels, width, height); break
        default: qualityGate = generalQualityGate(pixels, width, height)
      }
    } catch { /* quality gate is optional */ }

    // Step 3: Build module-specific structured prompt
    const messages = buildStructuredVisionPrompt(
      moduleType, moduleName, childAge, nurseChips, chipSeverities
    )

    // Attach the image to the user message
    const messagesWithImage: LLMMessage[] = messages.map(m =>
      m.role === 'user' ? { ...m, images: [base64] } : m
    )

    // Step 4: Query LLM
    const config = await loadLLMConfig()
    const responses = await queryLLM(config, messagesWithImage)
    const bestResponse = responses.find(r => !r.error && r.text)

    if (!bestResponse?.text) {
      // LLM failed — fall back to pixel analysis
      const pixelResult = await pixelPromise
      if (pixelResult) return pixelResult

      throw new Error('Both LLM and pixel analysis failed')
    }

    // Step 5: Parse structured response
    const visionResult = parseVisionAnalysis(bestResponse.text)
    const inferenceMs = Math.round(performance.now() - startTime)

    if (!visionResult || visionResult.findings.length === 0) {
      // LLM returned empty — check if pixel analysis found something
      const pixelResult = await pixelPromise
      if (pixelResult && pixelResult.aiResult.confidence > 0.5) {
        return pixelResult
      }

      // Both empty — return normal
      return {
        aiResult: {
          classification: 'Normal',
          confidence: 0.8,
          summary: `[AI Vision] ${visionResult?.summary || 'No significant findings'}`,
          suggestedChips: [],
        },
        qualityGate,
        analysisType,
        onDevice: false,
        llmProvider: bestResponse.provider,
        llmModel: bestResponse.model || bestResponse.provider,
        llmLatencyMs: bestResponse.latencyMs,
        inferenceMs,
      } as LLMPrimaryAnalysisResult
    }

    // Step 6: Convert LLM findings to AIResult
    const classificationMap: Record<string, string> = {
      normal: 'Normal', low: 'Low Risk', moderate: 'Moderate Risk', high: 'High Risk',
    }

    const suggestedChips = visionResult.findings
      .filter(f => f.chipId)
      .map(f => f.chipId!)

    const regions = visionResult.findings
      .filter(f => f.chipId && f.region)
      .map(f => ({
        chipId: f.chipId!,
        label: f.label,
        region: f.region!,
      }))

    // Build rich summary from findings
    const findingSummaries = visionResult.findings
      .slice(0, 4) // top 4 findings
      .map(f => `${f.label} (${Math.round(f.confidence * 100)}%)`)
      .join(', ')

    const urgentPrefix = visionResult.urgentFlags.length > 0
      ? `⚠ URGENT: ${visionResult.urgentFlags.join(', ')} | `
      : ''

    const llmResult: LLMPrimaryAnalysisResult = {
      aiResult: {
        classification: classificationMap[visionResult.riskLevel] || 'Normal',
        confidence: visionResult.findings.length > 0
          ? Math.max(...visionResult.findings.map(f => f.confidence))
          : 0.8,
        summary: `[AI Vision] ${urgentPrefix}${findingSummaries || visionResult.summary}`,
        suggestedChips,
      },
      qualityGate,
      analysisType,
      onDevice: false,
      llmProvider: bestResponse.provider,
      llmModel: bestResponse.model || bestResponse.provider,
      llmLatencyMs: bestResponse.latencyMs,
      inferenceMs,
      regions: regions.length > 0 ? regions : undefined,
    }

    // Step 7: Merge with pixel analysis if it also found something
    const pixelResult = await pixelPromise
    if (pixelResult && pixelResult.aiResult.suggestedChips?.length > 0) {
      // Add any pixel-detected chips that LLM missed (e.g. color anomalies)
      const llmChipSet = new Set(suggestedChips)
      const pixelOnlyChips = pixelResult.aiResult.suggestedChips.filter(c => !llmChipSet.has(c))
      if (pixelOnlyChips.length > 0) {
        llmResult.aiResult.suggestedChips = [...suggestedChips, ...pixelOnlyChips]
        llmResult.aiResult.summary += ` | [On-device] also detected: ${pixelOnlyChips.join(', ')}`
      }
    }

    return llmResult
  } catch (err) {
    // LLM path failed entirely — fall back to pixel analysis
    const pixelResult = await pixelPromise
    if (pixelResult) {
      console.warn('LLM primary analysis failed, using pixel fallback:', err)
      return pixelResult
    }

    const inferenceMs = Math.round(performance.now() - startTime)
    return {
      aiResult: {
        classification: 'Unknown',
        confidence: 0,
        summary: `[AI] Analysis unavailable: ${err instanceof Error ? err.message : 'unknown error'}`,
        suggestedChips: [],
      },
      qualityGate: null,
      analysisType,
      onDevice: true,
      inferenceMs,
    }
  }
}
