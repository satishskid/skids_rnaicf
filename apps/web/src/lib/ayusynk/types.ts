/**
 * AyuSynk Digital Stethoscope — Integration Types
 *
 * SDK: AyuSynkSdk v4.4.0 (Android .aar)
 * Integration: Web-based via live stream URLs and AI report URLs
 * Client ID: ySdydiuSkydkuSSA
 *
 * The AyuSynk stethoscope connects via BLE or USB to an Android phone.
 * The SDK provides:
 *   - Real-time audio streaming with waveform
 *   - Audio recording with heart/lung filters
 *   - AI-powered diagnosis reports (heart abnormality detection)
 *   - Online live streaming with shareable URL
 *
 * Since SKIDS Screen is a PWA (web), we integrate via:
 *   1. Live stream URL — nurse shares AyuSynk stream link
 *   2. AI Report URL — nurse shares generated report
 *   3. WAV file import — nurse exports WAV from AyuSynk, imports into SKIDS
 */

// ============================================
// DEVICE & CONNECTION
// ============================================

export type AyuSynkConnectionMode = 'ble' | 'usb'

export interface AyuSynkDeviceInfo {
  name: string
  address: string // BLE address or 'usb'
  mode: AyuSynkConnectionMode
  batteryLevel?: number       // 0-100
  signalStrength?: 'weak' | 'strong'
  firmwareVersion?: string
}

// ============================================
// AUSCULTATION LOCATIONS
// ============================================

/** Matches AyuSynk SDK: LocationType.Heart.* */
export type HeartLocation = 'aortic' | 'pulmonic' | 'tricuspid' | 'mitral'

/** Matches AyuSynk SDK: LocationType.Lung.* */
export type LungLocation =
  | 'right_upper_anterior'
  | 'left_upper_anterior'
  | 'right_lower_anterior'
  | 'left_lower_anterior'
  | 'right_upper_posterior'
  | 'left_upper_posterior'
  | 'right_lower_posterior'
  | 'left_lower_posterior'

export type AuscultationLocation = HeartLocation | LungLocation

/** Map AyuSynk LocationType to our CARDIAC_POINTS IDs */
export const AYUSYNK_HEART_LOCATION_MAP: Record<HeartLocation, string> = {
  aortic: 'aortic',
  pulmonic: 'pulmonic',
  tricuspid: 'tricuspid',
  mitral: 'mitral',
}

// ============================================
// AUDIO FILTERS
// ============================================

/** Matches AyuSynk SDK: FilterType */
export type AyuSynkFilterType = 'NO_FILTER' | 'HEART' | 'LUNG'

// ============================================
// RECORDING
// ============================================

export interface AyuSynkRecording {
  id: string
  location: AuscultationLocation
  filterType: AyuSynkFilterType
  durationSeconds: number
  /** WAV file blob (imported from AyuSynk) */
  audioBlob?: Blob
  /** Cloud URL if uploaded to R2 */
  audioUrl?: string
  /** Timestamp of recording */
  recordedAt: string
}

// ============================================
// AI DIAGNOSIS REPORT
// ============================================

/**
 * Matches AyuSynk SDK: ReportData
 *
 * The SDK's generateDiagnosisReport() sends audio to AyuDevice cloud,
 * which returns AI analysis with:
 * - positionName: auscultation location
 * - reportUrl: URL to the full diagnosis report
 * - conditionDetected: AI-detected heart abnormality
 * - conditionConfidence: confidence score
 */
export interface AyuSynkReportData {
  positionName: string
  reportUrl: string
  conditionDetected: string
  conditionConfidence: number
}

/** Full report from AyuSynk for a recording session */
export interface AyuSynkDiagnosisReport {
  /** Unique ID for this import */
  id: string
  /** When the report was imported into SKIDS */
  importedAt: string
  /** Source: how the report entered SKIDS */
  source: 'live_stream' | 'report_url' | 'wav_import' | 'manual'
  /** Device info if available */
  device?: AyuSynkDeviceInfo
  /** Individual location reports */
  reports: AyuSynkReportData[]
  /** Live stream URL if available */
  liveStreamUrl?: string
  /** Raw notes from the nurse about this session */
  notes?: string
}

// ============================================
// INTEGRATION STATUS
// ============================================

export type AyuSynkImportStatus = 'idle' | 'importing' | 'success' | 'error'

export interface AyuSynkImportResult {
  status: AyuSynkImportStatus
  report?: AyuSynkDiagnosisReport
  recordings?: AyuSynkRecording[]
  error?: string
}

// ============================================
// MAPPING TO SKIDS CHIPS
// ============================================

/**
 * Map AyuSynk AI conditions to SKIDS cardiac annotation chip IDs.
 *
 * AyuSynk v4.3.1+ detects heart abnormalities.
 * We map their condition strings to our chip IDs:
 *   ca1 = Normal S1/S2
 *   ca2 = Systolic Murmur (R01.1)
 *   ca3 = Diastolic Murmur (R01.1)
 *   ca4 = Gallop S3/S4 (R01.2)
 *   ca5 = Split S2 (R01.2)
 *   ca6 = Arrhythmia (I49.9)
 *   ca7 = Pericardial Rub (I31.9)
 */
export const AYUSYNK_CONDITION_TO_CHIP: Record<string, { chipId: string; label: string }> = {
  // Normal
  'normal': { chipId: 'ca1', label: 'Normal S1/S2' },
  'normal s1/s2': { chipId: 'ca1', label: 'Normal S1/S2' },
  'no abnormality': { chipId: 'ca1', label: 'Normal S1/S2' },

  // Murmurs
  'systolic murmur': { chipId: 'ca2', label: 'Systolic Murmur' },
  'murmur': { chipId: 'ca2', label: 'Systolic Murmur' },
  'heart murmur': { chipId: 'ca2', label: 'Systolic Murmur' },
  'diastolic murmur': { chipId: 'ca3', label: 'Diastolic Murmur' },

  // Extra sounds
  'gallop': { chipId: 'ca4', label: 'Gallop (S3/S4)' },
  's3 gallop': { chipId: 'ca4', label: 'Gallop (S3/S4)' },
  's4 gallop': { chipId: 'ca4', label: 'Gallop (S3/S4)' },
  'split s2': { chipId: 'ca5', label: 'Split S2' },

  // Rhythm
  'arrhythmia': { chipId: 'ca6', label: 'Arrhythmia' },
  'irregular rhythm': { chipId: 'ca6', label: 'Arrhythmia' },
  'atrial fibrillation': { chipId: 'ca6', label: 'Arrhythmia' },

  // Pericardial
  'pericardial rub': { chipId: 'ca7', label: 'Pericardial Rub' },
  'friction rub': { chipId: 'ca7', label: 'Pericardial Rub' },
}

/**
 * Try to match an AyuSynk condition string to a SKIDS chip.
 * Uses fuzzy matching (lowercase, contains check).
 */
export function mapAyuSynkConditionToChip(condition: string): { chipId: string; label: string } | null {
  const normalized = condition.toLowerCase().trim()

  // Exact match first
  if (AYUSYNK_CONDITION_TO_CHIP[normalized]) {
    return AYUSYNK_CONDITION_TO_CHIP[normalized]
  }

  // Partial match
  for (const [key, value] of Object.entries(AYUSYNK_CONDITION_TO_CHIP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value
    }
  }

  return null
}
