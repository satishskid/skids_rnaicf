// Data quality scoring for observations
// Migrated from V2 — zero business logic changes

export interface QualityScore {
  overall: number
  hasEvidence: boolean
  hasChips: boolean
  hasAIAnnotation: boolean
  aiConfidence: number
  hasMetadata: boolean
  grade: 'good' | 'fair' | 'poor'
}

interface ObservationForQuality {
  annotationData?: {
    selectedChips?: string[]
    evidenceImage?: string
    evidenceVideoFrames?: string[]
  }
  aiAnnotations?: Array<{
    confidence?: number
    riskCategory?: string
  }>
  captureMetadata?: Record<string, unknown>
  mediaUrl?: string
  mediaType?: string
  timestamp?: string
}

export function computeObservationQuality(obs: ObservationForQuality): QualityScore {
  const hasEvidence = !!(
    obs.annotationData?.evidenceImage ||
    obs.annotationData?.evidenceVideoFrames?.length ||
    obs.mediaUrl
  )
  const evidenceScore = hasEvidence ? 30 : 0

  const hasChips = !!(obs.annotationData?.selectedChips?.length && obs.annotationData.selectedChips.length > 0)
  const chipScore = hasChips ? 25 : 0

  const hasAIAnnotation = !!(obs.aiAnnotations?.length && obs.aiAnnotations[0]?.riskCategory)
  const aiConfidence = obs.aiAnnotations?.[0]?.confidence || 0
  const aiScore = hasAIAnnotation ? Math.round(20 * Math.max(0.5, aiConfidence)) : 0

  const meta = obs.captureMetadata || {}
  const metaFields = ['timestamp', 'deviceModel', 'processingType'].filter(
    f => meta[f] !== undefined && meta[f] !== null && meta[f] !== ''
  )
  const hasMetadata = metaFields.length >= 2
  const metaScore = Math.round((metaFields.length / 3) * 15)

  const timeScore = obs.timestamp ? 10 : 0

  const overall = Math.min(100, evidenceScore + chipScore + aiScore + metaScore + timeScore)

  let grade: 'good' | 'fair' | 'poor'
  if (overall >= 70) grade = 'good'
  else if (overall >= 40) grade = 'fair'
  else grade = 'poor'

  return { overall, hasEvidence, hasChips, hasAIAnnotation, aiConfidence, hasMetadata, grade }
}

export function computeNurseQualityStats(
  observations: ObservationForQuality[]
): { averageScore: number; good: number; fair: number; poor: number; total: number } {
  if (observations.length === 0) {
    return { averageScore: 0, good: 0, fair: 0, poor: 0, total: 0 }
  }

  let totalScore = 0
  let good = 0, fair = 0, poor = 0

  for (const obs of observations) {
    const q = computeObservationQuality(obs)
    totalScore += q.overall
    if (q.grade === 'good') good++
    else if (q.grade === 'fair') fair++
    else poor++
  }

  return {
    averageScore: Math.round(totalScore / observations.length),
    good, fair, poor,
    total: observations.length,
  }
}
