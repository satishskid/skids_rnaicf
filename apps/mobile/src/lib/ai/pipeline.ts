/**
 * Three-Tier Ensemble AI Pipeline
 *
 * Every image/video screening module follows the same pattern:
 *   Tier 1: Quality Gate — image quality, exposure, framing validation
 *   Tier 2: On-Device ML — TFLite/ONNX model + rule-based analysis (offline)
 *   Tier 3: LLM Vision — Ollama local or cloud verification (online, optional)
 *
 * Output: Structured annotation record with findings, confidence, heatmap, reasoning.
 */

// Safe timing fallback
const now = (): number => typeof performance !== 'undefined' ? performance.now() : Date.now()

// ── Types ──

export interface QualityGateResult {
  passed: boolean
  blur: number           // 0-1, 1 = sharp
  exposure: number       // 0-1, 0.5 = ideal
  framing: number        // 0-1, 1 = well-framed
  flashDetected?: boolean // for vision modules requiring flash
  faceDetected?: boolean
  feedback: string       // human-readable guidance for nurse
  checks: QualityCheck[]
}

export interface QualityCheck {
  name: string
  passed: boolean
  value: number
  threshold: number
  message: string
}

export interface AIFinding {
  id: string
  label: string
  chipId: string
  confidence: number     // 0-1
  severity?: 'normal' | 'mild' | 'moderate' | 'severe'
  icdCode?: string
  riskWeight?: number
  boundingBox?: BoundingBox
  reasoning?: string     // from LLM or rule explanation
}

export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
}

export interface AITierResult {
  tier: 1 | 2 | 3
  provider: string       // 'rule-based', 'mobilenet-v2', 'ollama', 'gemini', etc.
  findings: AIFinding[]
  confidence: number     // overall confidence 0-1
  heatmapBase64?: string // overlay image showing where model looked
  inferenceMs: number
  reasoning?: string     // from LLM tier
  error?: string
}

export interface PipelineResult {
  moduleType: string
  timestamp: string

  // Quality
  qualityGate: QualityGateResult

  // AI Results
  tiers: AITierResult[]
  finalFindings: AIFinding[]
  finalConfidence: number
  finalRisk: 'normal' | 'low' | 'moderate' | 'high'

  // Metadata
  totalInferenceMs: number
  offlineCapable: boolean  // did this run entirely offline?

  // Annotations for doctor review
  heatmapBase64?: string
  annotatedFrameBase64?: string // video modules: annotated keyframe
}

// ── Ensemble Merging ──

/**
 * Merge findings from multiple tiers into a final set.
 * Higher-tier results take precedence when they have higher confidence.
 * Rule: If Tier 3 (LLM) explicitly disagrees with Tier 2, use Tier 3 if confidence > 0.7.
 */
export function mergeFindings(tiers: AITierResult[]): AIFinding[] {
  const findingMap = new Map<string, AIFinding>()

  // Process tiers in order (1, 2, 3) — later tiers override earlier ones
  const sorted = [...tiers].sort((a, b) => a.tier - b.tier)

  for (const tier of sorted) {
    for (const finding of tier.findings) {
      const existing = findingMap.get(finding.chipId)
      if (!existing) {
        findingMap.set(finding.chipId, { ...finding })
      } else {
        // Higher tier with higher confidence overrides
        if (tier.tier > (findingMap.get(finding.chipId)?.riskWeight ?? 0) || finding.confidence > existing.confidence) {
          findingMap.set(finding.chipId, {
            ...existing,
            ...finding,
            // Keep highest confidence
            confidence: Math.max(existing.confidence, finding.confidence),
            // Append reasoning
            reasoning: [existing.reasoning, finding.reasoning].filter(Boolean).join(' | '),
          })
        }
      }
    }
  }

  return Array.from(findingMap.values()).sort((a, b) => b.confidence - a.confidence)
}

/**
 * Compute overall risk from merged findings.
 */
export function computeOverallRisk(findings: AIFinding[]): PipelineResult['finalRisk'] {
  if (findings.length === 0) return 'normal'

  const totalWeightedRisk = findings.reduce(
    (sum, f) => sum + f.confidence * (f.riskWeight ?? 1),
    0
  )

  if (totalWeightedRisk >= 5) return 'high'
  if (totalWeightedRisk >= 2.5) return 'moderate'
  if (totalWeightedRisk >= 1) return 'low'
  return 'normal'
}

/**
 * Compute overall confidence from tier results.
 * Uses the highest-tier result that succeeded.
 */
export function computeOverallConfidence(tiers: AITierResult[]): number {
  const successful = tiers.filter(t => !t.error && t.findings.length > 0)
  if (successful.length === 0) return 0

  // Weighted by tier: Tier 3 = 1.0, Tier 2 = 0.85, Tier 1 = 0.6
  const tierWeights: Record<number, number> = { 1: 0.6, 2: 0.85, 3: 1.0 }
  const best = successful.reduce((prev, curr) =>
    (tierWeights[curr.tier] ?? 0) * curr.confidence > (tierWeights[prev.tier] ?? 0) * prev.confidence
      ? curr : prev
  )

  return Math.min(1, best.confidence * (tierWeights[best.tier] ?? 0.6))
}

// ── Pipeline Runner ──

export interface PipelineConfig {
  moduleType: string
  enableTier2: boolean   // run ML model (default: true if available)
  enableTier3: boolean   // run LLM verification (default: true if online)
  tier3Threshold: number // only run LLM if tier2 confidence < this (default: 0.7)
  qualityRequired: boolean // reject if quality gate fails (default: true for photo, false for questionnaire)
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  moduleType: '',
  enableTier2: true,
  enableTier3: true,
  tier3Threshold: 0.7,
  qualityRequired: true,
}

/**
 * Run the full pipeline for a module.
 * This is the main entry point called from ModuleScreen.
 *
 * @param config - Pipeline configuration
 * @param pixels - Raw pixel data (RGBA Uint8Array) for image modules
 * @param width - Image width
 * @param height - Image height
 * @param qualityGateFn - Module-specific quality gate function
 * @param tier2Fn - Module-specific Tier 2 analysis function
 * @param tier3Fn - Optional Tier 3 LLM verification function
 */
export async function runPipeline(
  config: PipelineConfig,
  pixels: Uint8Array,
  width: number,
  height: number,
  qualityGateFn: (pixels: Uint8Array, width: number, height: number) => QualityGateResult,
  tier2Fn: (pixels: Uint8Array, width: number, height: number) => Promise<AITierResult>,
  tier3Fn?: (imageBase64: string, tier2Result: AITierResult) => Promise<AITierResult>,
): Promise<PipelineResult> {
  const startTime = now()
  const tiers: AITierResult[] = []

  // Step 1: Quality Gate
  const qualityGate = qualityGateFn(pixels, width, height)

  if (config.qualityRequired && !qualityGate.passed) {
    return {
      moduleType: config.moduleType,
      timestamp: new Date().toISOString(),
      qualityGate,
      tiers: [],
      finalFindings: [],
      finalConfidence: 0,
      finalRisk: 'normal',
      totalInferenceMs: Math.round(now() - startTime),
      offlineCapable: true,
    }
  }

  // Step 2: On-Device ML (Tier 2)
  if (config.enableTier2) {
    try {
      const tier2Result = await tier2Fn(pixels, width, height)
      tiers.push(tier2Result)
    } catch (err) {
      tiers.push({
        tier: 2,
        provider: 'on-device-ml',
        findings: [],
        confidence: 0,
        inferenceMs: 0,
        error: err instanceof Error ? err.message : 'Tier 2 analysis failed',
      })
    }
  }

  // Step 3: LLM Verification (Tier 3) — only if online and confidence is low
  const tier2Best = tiers.find(t => t.tier === 2 && !t.error)
  if (
    config.enableTier3 &&
    tier3Fn &&
    (!tier2Best || tier2Best.confidence < config.tier3Threshold)
  ) {
    try {
      // We'd need image as base64 — placeholder for now
      const tier3Result = await tier3Fn('', tier2Best || { tier: 2, provider: 'none', findings: [], confidence: 0, inferenceMs: 0 })
      tiers.push(tier3Result)
    } catch (err) {
      tiers.push({
        tier: 3,
        provider: 'llm-vision',
        findings: [],
        confidence: 0,
        inferenceMs: 0,
        error: err instanceof Error ? err.message : 'Tier 3 verification failed',
      })
    }
  }

  // Step 4: Merge results
  const finalFindings = mergeFindings(tiers)
  const finalConfidence = computeOverallConfidence(tiers)
  const finalRisk = computeOverallRisk(finalFindings)

  // Pick best heatmap from tiers
  const heatmapBase64 = tiers.find(t => t.heatmapBase64)?.heatmapBase64

  return {
    moduleType: config.moduleType,
    timestamp: new Date().toISOString(),
    qualityGate,
    tiers,
    finalFindings,
    finalConfidence,
    finalRisk,
    totalInferenceMs: Math.round(now() - startTime),
    offlineCapable: tiers.every(t => t.tier <= 2),
    heatmapBase64,
  }
}
