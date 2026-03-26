/**
 * Training Data Pipeline — Converts doctor review decisions into labeled samples.
 *
 * Every doctor review creates a labeled training example:
 *   - Input: observation features (chips, severities, AI scores, module type)
 *   - Label: doctor's decision (approve/refer/follow_up/discharge) + notes
 *
 * This builds a proprietary dataset for:
 *   1. Fine-tuning ENT classifier with doctor-verified ground truth
 *   2. Training decision-support models (should this be referred?)
 *   3. Measuring nurse-AI-doctor agreement rates
 *
 * Data stored in IndexedDB, exportable as JSONL for model training.
 */

export interface TrainingSample {
  id: string
  timestamp: string
  campaignCode: string

  // Input features
  moduleType: string
  bodyRegion?: string
  nurseChips: string[]
  chipSeverities: Record<string, string>
  aiRiskCategory: string
  aiConfidence: number
  aiSummaryText: string

  // ENT AI features (if available)
  entFindings?: Array<{ chipId: string; label: string; confidence: number }>

  // M-CHAT features (if available)
  mchatScore?: number
  mchatRisk?: string

  // Photoscreening features (if available)
  photoscreenRisk?: string
  photoscreenFindings?: Array<{ label: string; confidence: number }>

  // Doctor label (ground truth)
  doctorDecision: 'approve' | 'refer' | 'follow_up' | 'discharge'
  doctorNotes: string
  doctorId: string

  // Agreement metrics
  nurseAIAgreement: number  // 0-1, how much nurse and AI agreed
  doctorAIAgreement: number // 0-1, how much doctor agrees with AI risk

  // Server sync tracking
  _syncedAt?: string  // ISO timestamp when synced to server; undefined = unsynced
}

export interface TrainingDatasetStats {
  totalSamples: number
  byModule: Record<string, number>
  byDecision: Record<string, number>
  byRisk: Record<string, number>
  agreementRate: number   // average nurse-AI agreement
  referralRate: number    // % referred by doctor
  lastExportDate?: string
}

const TRAINING_DB_NAME = 'zpediscreen-training'
const TRAINING_STORE = 'samples'
const TRAINING_DB_VERSION = 1

/**
 * Open the training data IndexedDB.
 */
function openTrainingDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TRAINING_DB_NAME, TRAINING_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TRAINING_STORE)) {
        const store = db.createObjectStore(TRAINING_STORE, { keyPath: 'id' })
        store.createIndex('moduleType', 'moduleType', { unique: false })
        store.createIndex('doctorDecision', 'doctorDecision', { unique: false })
        store.createIndex('campaignCode', 'campaignCode', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Compute nurse-AI agreement score.
 * Measures overlap between nurse-selected chips and AI risk assessment.
 */
function computeNurseAIAgreement(
  nurseChips: string[],
  aiRiskCategory: string,
  entFindings?: Array<{ chipId: string }>
): number {
  if (!entFindings || entFindings.length === 0) {
    // No AI findings — agreement is based on risk category vs chip count
    const nurseRisk = nurseChips.length === 0 ? 'no_risk' :
                      nurseChips.length <= 2 ? 'possible_risk' : 'high_risk'
    return nurseRisk === aiRiskCategory ? 1.0 : 0.5
  }

  // Compute Jaccard similarity between nurse chips and AI findings
  const aiChips = new Set(entFindings.map(f => f.chipId))
  const nurseSet = new Set(nurseChips)
  const intersection = [...aiChips].filter(c => nurseSet.has(c)).length
  const union = new Set([...aiChips, ...nurseSet]).size
  return union === 0 ? 1.0 : intersection / union
}

/**
 * Compute doctor-AI agreement score.
 */
function computeDoctorAIAgreement(
  doctorDecision: string,
  aiRiskCategory: string
): number {
  // Map decisions to risk levels
  const decisionRisk: Record<string, number> = {
    approve: 0, discharge: 0, follow_up: 1, refer: 2,
  }
  const aiRisk: Record<string, number> = {
    no_risk: 0, possible_risk: 1, high_risk: 2,
  }
  const dRisk = decisionRisk[doctorDecision] ?? 1
  const aRisk = aiRisk[aiRiskCategory] ?? 1
  return 1 - Math.abs(dRisk - aRisk) / 2
}

/**
 * Create a training sample from a doctor's review decision.
 * Call this every time a doctor reviews an observation.
 */
export async function captureTrainingSample(params: {
  observationId: string
  campaignCode: string
  moduleType: string
  bodyRegion?: string
  nurseChips: string[]
  chipSeverities: Record<string, string>
  aiRiskCategory: string
  aiConfidence: number
  aiSummaryText: string
  entFindings?: Array<{ chipId: string; label: string; confidence: number }>
  mchatScore?: number
  mchatRisk?: string
  photoscreenRisk?: string
  photoscreenFindings?: Array<{ label: string; confidence: number }>
  doctorDecision: 'approve' | 'refer' | 'follow_up' | 'discharge'
  doctorNotes: string
  doctorId: string
}): Promise<TrainingSample> {
  const sample: TrainingSample = {
    id: `train-${params.observationId}`,
    timestamp: new Date().toISOString(),
    campaignCode: params.campaignCode,
    moduleType: params.moduleType,
    bodyRegion: params.bodyRegion,
    nurseChips: params.nurseChips,
    chipSeverities: params.chipSeverities,
    aiRiskCategory: params.aiRiskCategory,
    aiConfidence: params.aiConfidence,
    aiSummaryText: params.aiSummaryText,
    entFindings: params.entFindings,
    mchatScore: params.mchatScore,
    mchatRisk: params.mchatRisk,
    photoscreenRisk: params.photoscreenRisk,
    photoscreenFindings: params.photoscreenFindings,
    doctorDecision: params.doctorDecision,
    doctorNotes: params.doctorNotes,
    doctorId: params.doctorId,
    nurseAIAgreement: computeNurseAIAgreement(
      params.nurseChips, params.aiRiskCategory, params.entFindings
    ),
    doctorAIAgreement: computeDoctorAIAgreement(
      params.doctorDecision, params.aiRiskCategory
    ),
  }

  // Store in IndexedDB
  const db = await openTrainingDB()
  const tx = db.transaction(TRAINING_STORE, 'readwrite')
  tx.objectStore(TRAINING_STORE).put(sample)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  return sample
}

/**
 * Get all training samples, optionally filtered.
 */
export async function getTrainingSamples(filter?: {
  moduleType?: string
  campaignCode?: string
  decision?: string
}): Promise<TrainingSample[]> {
  const db = await openTrainingDB()
  const tx = db.transaction(TRAINING_STORE, 'readonly')
  const store = tx.objectStore(TRAINING_STORE)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      let samples = request.result as TrainingSample[]
      if (filter?.moduleType) {
        samples = samples.filter(s => s.moduleType === filter.moduleType)
      }
      if (filter?.campaignCode) {
        samples = samples.filter(s => s.campaignCode === filter.campaignCode)
      }
      if (filter?.decision) {
        samples = samples.filter(s => s.doctorDecision === filter.decision)
      }
      resolve(samples)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Compute dataset statistics.
 */
export async function getDatasetStats(): Promise<TrainingDatasetStats> {
  const samples = await getTrainingSamples()

  const byModule: Record<string, number> = {}
  const byDecision: Record<string, number> = {}
  const byRisk: Record<string, number> = {}
  let totalAgreement = 0

  for (const s of samples) {
    byModule[s.moduleType] = (byModule[s.moduleType] || 0) + 1
    byDecision[s.doctorDecision] = (byDecision[s.doctorDecision] || 0) + 1
    byRisk[s.aiRiskCategory] = (byRisk[s.aiRiskCategory] || 0) + 1
    totalAgreement += s.nurseAIAgreement
  }

  const referrals = (byDecision['refer'] || 0) + (byDecision['follow_up'] || 0)

  return {
    totalSamples: samples.length,
    byModule,
    byDecision,
    byRisk,
    agreementRate: samples.length > 0 ? totalAgreement / samples.length : 0,
    referralRate: samples.length > 0 ? referrals / samples.length : 0,
  }
}

/**
 * Export training dataset as JSONL (one JSON object per line).
 * Standard format for ML training pipelines.
 */
export async function exportAsJSONL(filter?: {
  moduleType?: string
  campaignCode?: string
}): Promise<string> {
  const samples = await getTrainingSamples(filter)
  return samples.map(s => JSON.stringify(s)).join('\n')
}

/**
 * Export training dataset as CSV for analysis in spreadsheets.
 */
export async function exportAsCSV(filter?: {
  moduleType?: string
  campaignCode?: string
}): Promise<string> {
  const samples = await getTrainingSamples(filter)
  if (samples.length === 0) return ''

  const headers = [
    'id', 'timestamp', 'campaignCode', 'moduleType',
    'nurseChipCount', 'aiRiskCategory', 'aiConfidence',
    'entFindingCount', 'doctorDecision', 'doctorNotes',
    'nurseAIAgreement', 'doctorAIAgreement',
  ]

  const rows = samples.map(s => [
    s.id, s.timestamp, s.campaignCode, s.moduleType,
    s.nurseChips.length, s.aiRiskCategory, s.aiConfidence,
    s.entFindings?.length || 0, s.doctorDecision,
    `"${(s.doctorNotes || '').replace(/"/g, '""')}"`,
    s.nurseAIAgreement.toFixed(2), s.doctorAIAgreement.toFixed(2),
  ])

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

/**
 * Clear all training data.
 */
export async function clearTrainingData(): Promise<void> {
  const db = await openTrainingDB()
  const tx = db.transaction(TRAINING_STORE, 'readwrite')
  tx.objectStore(TRAINING_STORE).clear()
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ============================================
// SERVER SYNC
// ============================================

export interface SyncResult {
  synced: number
  failed: number
  alreadySynced: number
}

/**
 * Sync unsynced training samples to the server API.
 * Marks synced samples with _syncedAt in IndexedDB.
 */
export async function syncTrainingSamples(
  campaignCode: string,
  doctorId: string,
  doctorName: string
): Promise<SyncResult> {
  const db = await openTrainingDB()
  const tx = db.transaction(TRAINING_STORE, 'readonly')
  const store = tx.objectStore(TRAINING_STORE)

  const allSamples = await new Promise<TrainingSample[]>((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as TrainingSample[])
    req.onerror = () => reject(req.error)
  })

  const campaignSamples = allSamples.filter(s => s.campaignCode === campaignCode)
  const unsynced = campaignSamples.filter(s => !s._syncedAt)
  const alreadySynced = campaignSamples.length - unsynced.length

  if (unsynced.length === 0) {
    return { synced: 0, failed: 0, alreadySynced }
  }

  try {
    const { apiCall } = await import('@/lib/api')
    const data = await apiCall<{ success: boolean; synced?: number }>(`/campaigns/${campaignCode}/training`, {
      method: 'POST',
      body: JSON.stringify({ doctorId, doctorName, samples: unsynced }),
    })

    if (data.success) {
      // Mark samples as synced in IndexedDB
      const writeTx = db.transaction(TRAINING_STORE, 'readwrite')
      const writeStore = writeTx.objectStore(TRAINING_STORE)
      const syncedAt = new Date().toISOString()
      for (const sample of unsynced) {
        writeStore.put({ ...sample, _syncedAt: syncedAt })
      }
      await new Promise<void>((resolve, reject) => {
        writeTx.oncomplete = () => resolve()
        writeTx.onerror = () => reject(writeTx.error)
      })
      return { synced: data.saved || unsynced.length, failed: 0, alreadySynced }
    } else {
      return { synced: 0, failed: unsynced.length, alreadySynced }
    }
  } catch {
    return { synced: 0, failed: unsynced.length, alreadySynced }
  }
}

/**
 * Count unsynced training samples.
 */
export async function getUnsyncedCount(campaignCode?: string): Promise<number> {
  const db = await openTrainingDB()
  const tx = db.transaction(TRAINING_STORE, 'readonly')
  const store = tx.objectStore(TRAINING_STORE)

  const allSamples = await new Promise<TrainingSample[]>((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as TrainingSample[])
    req.onerror = () => reject(req.error)
  })

  let filtered = allSamples.filter(s => !s._syncedAt)
  if (campaignCode) {
    filtered = filtered.filter(s => s.campaignCode === campaignCode)
  }
  return filtered.length
}
