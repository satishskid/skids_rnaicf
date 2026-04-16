/**
 * AI Chip Suggestion Engine — Routes observations through appropriate AI
 * algorithms and returns suggested annotation chip IDs with dashed borders.
 *
 * Per-module routing: each module type maps to specific AI algorithms.
 */

import type { ModuleType } from '@skids/shared'
import {
  type AnthropometryResult,
  classifyMUAC,
  classifySpO2,
  classifyAnemia,
  classifyCough,
  type AudioFeatures,
  generateAudiometryResult,
  type HearingThresholds,
  suggestHearingChips,
  analyzePixels,
  mapSuggestionsToChipIds,
  type ClinicalColorResult,
} from '@skids/shared'

export interface ChipSuggestion {
  chipId: string
  confidence: number
  source: 'algorithm' | 'color' | 'onnx' | 'llm'
  reason?: string
}

/**
 * Get AI-suggested chips for a given module based on captured data.
 * Returns chip IDs that should be displayed with dashed borders (suggestions).
 */
export function suggestChipsForModule(
  moduleType: ModuleType,
  data: {
    anthropometry?: AnthropometryResult
    audioFeatures?: AudioFeatures
    hearingThresholds?: HearingThresholds
    imagePixels?: { pixels: Uint8ClampedArray; width: number; height: number }
    muac?: number
    spo2?: number
    hemoglobin?: number
    age?: number
    gender?: 'male' | 'female'
  }
): ChipSuggestion[] {
  const suggestions: ChipSuggestion[] = []

  switch (moduleType) {
    case 'height': {
      // AnthropometryResult carries a single zScore; for height modules this is HAZ.
      if (data.anthropometry && data.anthropometry.zScore < -2) {
        suggestions.push({
          chipId: 'ht1',
          confidence: 0.8,
          source: 'algorithm',
          reason: `Stunting (HAZ ${data.anthropometry.zScore.toFixed(1)})`,
        })
      }
      break
    }

    case 'weight': {
      // For weight modules the zScore is WAZ (or BAZ if the upstream classifier produced it).
      if (data.anthropometry && data.anthropometry.zScore < -2) {
        suggestions.push({
          chipId: 'wt1',
          confidence: 0.8,
          source: 'algorithm',
          reason: `Underweight (WAZ ${data.anthropometry.zScore.toFixed(1)})`,
        })
      }
      if (data.anthropometry && data.anthropometry.zScore > 2) {
        suggestions.push({
          chipId: 'wt2',
          confidence: 0.7,
          source: 'algorithm',
          reason: `Overweight (z ${data.anthropometry.zScore.toFixed(1)})`,
        })
      }
      break
    }

    case 'muac': {
      if (data.muac !== undefined) {
        const cls = classifyMUAC(data.muac)
        if (cls.severity === 'severe') {
          suggestions.push({ chipId: 'defc9', confidence: 0.9, source: 'algorithm', reason: 'MUAC < 115mm (SAM)' })
        } else if (cls.severity === 'moderate') {
          suggestions.push({ chipId: 'defc10', confidence: 0.85, source: 'algorithm', reason: 'MUAC 115-125mm (MAM)' })
        }
      }
      break
    }

    case 'spo2': {
      if (data.spo2 !== undefined) {
        const cls = classifySpO2(data.spo2)
        if (cls.severity !== 'normal') {
          suggestions.push({ chipId: 'sp1', confidence: 0.8, source: 'algorithm', reason: cls.label })
        }
      }
      break
    }

    case 'hemoglobin': {
      if (data.hemoglobin !== undefined && data.age !== undefined && data.gender) {
        const cls = classifyAnemia(data.hemoglobin, data.age, data.gender)
        if (cls.severity !== 'none') {
          suggestions.push({ chipId: 'defc3', confidence: 0.8, source: 'algorithm', reason: cls.label })
        }
      }
      break
    }

    case 'respiratory': {
      if (data.audioFeatures) {
        const cough = classifyCough(data.audioFeatures)
        if (cough.type !== 'unknown') {
          suggestions.push({
            chipId: `co_${cough.type}`,
            confidence: cough.confidence,
            source: 'algorithm',
            reason: `${cough.type} cough detected`,
          })
        }
      }
      break
    }

    case 'hearing': {
      if (data.hearingThresholds) {
        const result = generateAudiometryResult(data.hearingThresholds)
        const hearingChips = suggestHearingChips(result)
        for (const chipId of hearingChips) {
          suggestions.push({
            chipId,
            confidence: 0.8,
            source: 'algorithm',
            reason: `Hearing: ${result.overallClassification}`,
          })
        }
      }
      break
    }

    // Photo-based modules use color analysis
    case 'dental':
    case 'throat':
    case 'eyes_external':
    case 'general_appearance':
    case 'nails':
    case 'skin':
    case 'ear':
    case 'nose':
    case 'hair': {
      if (data.imagePixels) {
        const colorResult = analyzePixels(
          data.imagePixels.pixels,
          data.imagePixels.width,
          data.imagePixels.height
        )
        const chipIds = mapSuggestionsToChipIds(colorResult.suggestedChips, moduleType)
        for (const chipId of chipIds) {
          suggestions.push({
            chipId,
            confidence: colorResult.confidence * 0.7,
            source: 'color',
            reason: 'Color analysis suggestion',
          })
        }
      }
      break
    }
  }

  return suggestions
}

/**
 * Merge AI suggestions with nurse-selected chips.
 * AI suggestions that match nurse selections get boosted confidence.
 */
export function mergeWithNurseChips(
  suggestions: ChipSuggestion[],
  nurseSelectedChipIds: string[]
): {
  confirmed: ChipSuggestion[]   // Both AI and nurse agree
  aiOnly: ChipSuggestion[]      // AI suggests, nurse didn't select
  nurseOnly: string[]            // Nurse selected, AI didn't suggest
} {
  const nurseSet = new Set(nurseSelectedChipIds)
  const aiSet = new Set(suggestions.map(s => s.chipId))

  return {
    confirmed: suggestions.filter(s => nurseSet.has(s.chipId)),
    aiOnly: suggestions.filter(s => !nurseSet.has(s.chipId)),
    nurseOnly: nurseSelectedChipIds.filter(id => !aiSet.has(id)),
  }
}
