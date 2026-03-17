/**
 * ModuleDefinition — self-contained definition for a screening module.
 *
 * Adding a new module = create one file with this interface + register it.
 * No need to touch ModuleScreen, annotations, image-analyzer, or ai-engine.
 */

import type { ModuleType, AgeGroup } from '../lib/types'
import type { QualityGateResult } from '../lib/ai/pipeline'
import type { AIResult } from '../lib/ai-engine'
import type { ChipDef } from '../lib/annotations'

export type ModuleGroup = 'vitals' | 'head_to_toe'
export type CaptureType = 'photo' | 'video' | 'audio' | 'value' | 'form'
export type AnalysisType = 'vision' | 'ear' | 'skin' | 'dental' | 'general'

export type { ChipDef }

export interface ModuleGuidance {
  instruction: string
  lookFor: string[]
  equipment?: string[]
  environment?: string
  positioning?: string
  tips?: string[]
}

export interface FormProps {
  onResult: (result: AIResult) => void
  childAge?: number
  childName?: string
  accentColor?: string
}

export interface ModuleDefinition {
  // ── Identity ──
  type: ModuleType
  name: string
  description: string
  icon: string
  duration: string
  color: string
  group: ModuleGroup

  // ── Capture ──
  captureType: CaptureType
  cameraFacing?: 'user' | 'environment'
  recommendedAge: AgeGroup[]

  // ── Clinical Chips ──
  chips: ChipDef[]

  // ── AI Config (optional — modules work without AI) ──
  analysisType?: AnalysisType
  qualityGate?: (pixels: Uint8Array, w: number, h: number) => QualityGateResult
  /** For value-type modules: classify a numeric/string input. */
  classify?: (value: string, ageMonths?: number, gender?: string) => AIResult | null

  // ── Custom Form (optional — for protocol modules like hearing, mchat) ──
  FormComponent?: React.ComponentType<FormProps>

  // ── Guidance (optional — shown to nurse before capture) ──
  guidance?: ModuleGuidance
}
