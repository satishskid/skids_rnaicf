/**
 * AI Annotation Schema — standardized structured annotation records for every AI-analyzed observation.
 *
 * Every image, video, or audio processed by the AI pipeline produces an AIAnnotationRecord.
 * This record captures:
 *   - Quality gate results (blur, exposure, framing)
 *   - Per-tier AI analysis (rule-based, ML model, LLM verification)
 *   - Merged findings with confidence scores and ICD codes
 *   - Heatmap/overlay URIs for doctor review
 *   - Audit trail: nurse agreement, doctor corrections
 *
 * Used by: apps/mobile (generation), apps/worker (storage), apps/web (doctor review)
 *
 * Stored as JSON in observations.annotation_data column.
 */

// ── Core Finding Type ──

export interface AIFinding {
  id: string
  label: string
  chipId: string
  confidence: number         // 0-1
  severity?: 'normal' | 'mild' | 'moderate' | 'severe'
  icdCode?: string           // e.g., 'H50' for strabismus
  riskWeight?: number        // contribution to overall risk (0-5)
  boundingBox?: BoundingBox
  reasoning?: string         // from LLM or rule explanation
}

export interface BoundingBox {
  x: number
  y: number
  w: number
  h: number
}

// ── Quality Gate ──

export interface QualityGateRecord {
  passed: boolean
  blur: number               // 0-1, 1 = sharp
  exposure: number           // 0-1, 0.5 = ideal
  framing: number            // 0-1, 1 = well-framed
  flashDetected?: boolean
  faceDetected?: boolean
  ambientNoiseDB?: number    // for audio modules
  feedback: string           // human-readable guidance
  checks: QualityCheckRecord[]
}

export interface QualityCheckRecord {
  name: string
  passed: boolean
  value: number
  threshold: number
  message: string
}

// ── Tier Result ──

export interface AITierRecord {
  tier: 1 | 2 | 3
  provider: string           // 'rule-based', 'mobilenet-v2', 'moveNet', 'ollama', 'gemini-flash', etc.
  findings: AIFinding[]
  confidence: number
  heatmapUri?: string        // R2 URL of overlay image (if uploaded)
  heatmapBase64?: string     // inline base64 (for offline storage)
  inferenceMs: number
  reasoning?: string
  error?: string
  modelVersion?: string      // e.g., 'photoscreen-v1.onnx', 'movenet-lightning-v4'
}

// ── Keypoint / Pose Data (for video modules) ──

export interface KeypointFrame {
  frameIndex: number
  timestamp: number          // ms from start of video
  keypoints: Keypoint[]
  centerOfMass?: { x: number; y: number }
}

export interface Keypoint {
  name: string               // e.g., 'left_wrist', 'right_ankle'
  x: number
  y: number
  confidence: number
}

// ── Audio-Specific Data ──

export interface AudioAnnotationData {
  ambientNoiseDB?: number
  ambientNoiseAcceptable?: boolean
  sampleRate?: number
  durationMs?: number
  frequencyProfile?: string  // 'quiet' | 'speech' | 'traffic' | 'machinery'
}

// ── Audiometry-Specific Data ──

export interface AudiometryAnnotationData {
  thresholds: AudiometryThresholdRecord[]
  ptaLeft: number
  ptaRight: number
  ptaBetter: number
  speechPTALeft: number
  speechPTARight: number
  highFreqPTALeft: number
  highFreqPTARight: number
  asymmetry: boolean
  asymmetryDB: number
  frequencyPattern: string   // 'normal' | 'flat' | 'sloping' | 'rising' | 'notch' | 'cookie-bite'
  hearingHandicap: number    // AAO-HNS percentage (0-100)
  testProtocol: string       // 'play' | 'standard' | 'self-report'
  audiogramUri?: string      // R2 URL of audiogram visualization
}

export interface AudiometryThresholdRecord {
  frequency: number          // Hz (500, 1000, 2000, 4000)
  ear: 'left' | 'right'
  thresholddB: number
}

// ── Behavioral Assessment Data ──

export interface BehavioralAnnotationData {
  tasks: BehavioralTaskRecord[]
  socialCommunicationScore: number    // 0-1
  restrictedBehaviorScore: number     // 0-1
  compositeScore: number              // 0-1
  mchatRisk?: 'low' | 'medium' | 'high'
  mchatScore?: number
  combinedRisk: 'low' | 'medium' | 'high'
  ageMonths?: number
}

export interface BehavioralTaskRecord {
  taskId: string
  taskName: string
  score: number              // 0-1
  metrics: Record<string, number>  // e.g., { responseTimeMs: 850, gazeRatio: 0.6 }
  notes?: string
}

// ── Motor Assessment Data ──

export interface MotorAnnotationData {
  tasks: MotorTaskRecord[]
  compositeScore: number     // 0-1
  riskCategory: 'age-appropriate' | 'mild-delay' | 'moderate-delay' | 'significant-delay'
  dominantSide?: 'left' | 'right' | 'ambidextrous'
  keypointFrames?: KeypointFrame[]  // stored separately if large
  keypointFrameCount?: number
}

export interface MotorTaskRecord {
  taskId: string
  taskName: string
  score: number
  symmetryScore?: number
  stabilityScore?: number
  smoothnessScore?: number
  rhythmScore?: number
  completionScore?: number
  durationMs: number
}

// ── OCR Data ──

export interface OCRAnnotationData {
  deviceType: string         // 'thermometer' | 'bp_monitor' | 'weight_scale' | 'spo2' | 'health_card'
  extractedValue?: string | number
  extractedUnit?: string
  confidence: number
  rawText: string
  boundingBox?: BoundingBox
  // Health card specific
  cardFields?: Record<string, string>  // { name, id, dob, scheme }
}

// ── Main Annotation Record ──

export type RiskLevel = 'normal' | 'low' | 'moderate' | 'high'

export interface AIAnnotationRecord {
  // Identity
  observationId: string
  moduleType: string
  timestamp: string          // ISO 8601

  // Schema version (for future migrations)
  schemaVersion: 1

  // Quality
  qualityGate: QualityGateRecord
  environmentValid: boolean

  // AI Results — all tiers that ran
  tiers: AITierRecord[]
  finalFindings: AIFinding[]
  finalConfidence: number    // 0-1, weighted by tier
  finalRisk: RiskLevel

  // Performance
  totalInferenceMs: number
  offlineCapable: boolean    // did this run entirely offline?

  // Visual annotations
  heatmapUri?: string        // R2 URL of overlay image
  annotatedFrameUri?: string // R2 URL of annotated video keyframe
  audiogramUri?: string      // R2 URL of audiogram (hearing modules)

  // Module-specific structured data
  audiometryData?: AudiometryAnnotationData
  motorData?: MotorAnnotationData
  behavioralData?: BehavioralAnnotationData
  audioData?: AudioAnnotationData
  ocrData?: OCRAnnotationData

  // Audit trail
  nurseAgreed: boolean              // did nurse accept AI suggestion?
  nurseOverrides: NurseOverride[]   // chips nurse added/removed vs AI
  nurseNotes?: string

  // Doctor review (populated later during review)
  doctorReviewStatus?: 'pending' | 'confirmed' | 'corrected'
  doctorReviewedBy?: string
  doctorReviewedAt?: string
  doctorCorrections?: DoctorCorrection[]
  doctorNotes?: string
}

export interface NurseOverride {
  chipId: string
  action: 'added' | 'removed'       // nurse added a chip AI didn't suggest, or removed one AI suggested
  chipLabel: string
  severity?: string
}

export interface DoctorCorrection {
  field: string                      // 'finding', 'risk', 'classification', etc.
  aiValue: string                    // what AI said
  correctedValue: string             // what doctor changed it to
  reason?: string
}

// ── Factory Functions ──

/**
 * Create a minimal annotation record for a new observation.
 * This is the starting point — tiers and findings get populated as pipeline runs.
 */
export function createAnnotationRecord(
  observationId: string,
  moduleType: string,
): AIAnnotationRecord {
  return {
    observationId,
    moduleType,
    timestamp: new Date().toISOString(),
    schemaVersion: 1,
    qualityGate: {
      passed: false,
      blur: 0,
      exposure: 0,
      framing: 0,
      feedback: 'Quality gate not yet run',
      checks: [],
    },
    environmentValid: false,
    tiers: [],
    finalFindings: [],
    finalConfidence: 0,
    finalRisk: 'normal',
    totalInferenceMs: 0,
    offlineCapable: true,
    nurseAgreed: true,
    nurseOverrides: [],
  }
}

/**
 * Compare AI-suggested chips with nurse-selected chips to compute overrides.
 */
export function computeNurseOverrides(
  aiSuggestedChipIds: string[],
  nurseSelectedChipIds: string[],
  chipLabels: Record<string, string>,
  chipSeverities?: Record<string, string>,
): NurseOverride[] {
  const overrides: NurseOverride[] = []

  // Chips AI suggested but nurse removed
  for (const chipId of aiSuggestedChipIds) {
    if (!nurseSelectedChipIds.includes(chipId)) {
      overrides.push({
        chipId,
        action: 'removed',
        chipLabel: chipLabels[chipId] || chipId,
      })
    }
  }

  // Chips nurse added that AI didn't suggest
  for (const chipId of nurseSelectedChipIds) {
    if (!aiSuggestedChipIds.includes(chipId)) {
      overrides.push({
        chipId,
        action: 'added',
        chipLabel: chipLabels[chipId] || chipId,
        severity: chipSeverities?.[chipId],
      })
    }
  }

  return overrides
}

/**
 * Compute nurse agreement: true if nurse accepted all AI findings without changes.
 */
export function computeNurseAgreement(
  aiSuggestedChipIds: string[],
  nurseSelectedChipIds: string[],
): boolean {
  if (aiSuggestedChipIds.length !== nurseSelectedChipIds.length) return false
  const aiSet = new Set(aiSuggestedChipIds)
  return nurseSelectedChipIds.every(id => aiSet.has(id))
}

/**
 * Create a doctor correction entry.
 */
export function createDoctorCorrection(
  field: string,
  aiValue: string,
  correctedValue: string,
  reason?: string,
): DoctorCorrection {
  return { field, aiValue, correctedValue, reason }
}

/**
 * Serialize annotation record for storage.
 * Strips large base64 fields if heatmap has been uploaded to R2.
 */
export function serializeAnnotation(record: AIAnnotationRecord): string {
  const cleaned = { ...record }

  // If heatmap was uploaded to R2, strip inline base64 to save space
  if (cleaned.heatmapUri) {
    cleaned.tiers = cleaned.tiers.map(t => ({
      ...t,
      heatmapBase64: undefined,  // strip inline, keep URI
    }))
  }

  return JSON.stringify(cleaned)
}

/**
 * Deserialize annotation record from storage.
 */
export function deserializeAnnotation(json: string): AIAnnotationRecord | null {
  try {
    const parsed = JSON.parse(json)
    // Basic validation
    if (parsed && parsed.schemaVersion === 1 && parsed.moduleType) {
      return parsed as AIAnnotationRecord
    }
    return null
  } catch {
    return null
  }
}

// ── Aggregation Helpers (for accuracy dashboard) ──

/**
 * Count finding agreement between AI and doctor review.
 * Returns { agreed, aiOnly, doctorOnly } for accuracy tracking.
 */
export function countFindingAgreement(
  record: AIAnnotationRecord,
  doctorFindings: string[],  // chip IDs confirmed by doctor
): { agreed: string[]; aiOnly: string[]; doctorOnly: string[] } {
  const aiChipIds = record.finalFindings.map(f => f.chipId)
  const aiSet = new Set(aiChipIds)
  const doctorSet = new Set(doctorFindings)

  return {
    agreed: aiChipIds.filter(id => doctorSet.has(id)),
    aiOnly: aiChipIds.filter(id => !doctorSet.has(id)),
    doctorOnly: doctorFindings.filter(id => !aiSet.has(id)),
  }
}
