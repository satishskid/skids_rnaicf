// ============================================
// Welch Allyn Spot Vision Screener — Type Definitions
// Matches SpotResults.csv & SpotResultsExtended.csv export format
// Device: Welch Allyn Spot Vision Screener (SW 3.1.02)
// ============================================

/** Raw row from SpotResults.csv */
export interface SpotResultRow {
  id: string
  location: string
  firstName: string
  lastName: string
  gender: 'M' | 'F'
  dateOfBirth: string        // YYYY-MM-DD
  ageInMonths: number
  dobOrAge: 'dob' | 'age'
  prescription: string       // 'None' | eyewear info
  recordId: string           // e.g. "11151123_OR_ce390f4e9f34_20251016_133529_0"
  swVersion: string
  terminationCode: number    // 1 = normal
  resultCode: number         // 1 = screening complete
  timestamp: string          // YYYY-MM-DD HH:MM:SS

  eyewearDuring: string
  whichEye: string           // 'Both' | 'OD' | 'OS'
  rxAnalysisVersion: number

  // Inter-pupillary distance (mm)
  interpupil: number

  // OD (Right Eye) refraction
  odRx0: number
  odRx60: number
  odRx120: number
  odSE: number               // Spherical equivalent
  odDS: number               // Sphere
  odDC: number               // Cylinder
  odAxis: number
  odPupilSize: number
  odGazeX: number
  odGazeY: number

  // OS (Left Eye) refraction
  osRx0: number
  osRx60: number
  osRx120: number
  osSE: number
  osDS: number
  osDC: number
  osAxis: number
  osPupilSize: number
  osGazeX: number
  osGazeY: number
}

/** Extended result from SpotResultsExtended.csv with formatted fields */
export interface SpotResultExtended extends SpotResultRow {
  // Formatted prescription strings
  formattedOdDS: string      // e.g. "+1.25"
  formattedOdDC: string      // e.g. "-2.50"
  formattedOdAxis: string    // e.g. "@1°"
  formattedOsDS: string
  formattedOsDC: string
  formattedOsAxis: string

  // Formatted gaze
  formattedOdGazeText: string
  formattedOsGazeText: string

  // Status flags (1 = pass, 2 = fail)
  formattedOdSEStatus: number
  formattedOdDCStatus: number
  formattedOsSEStatus: number
  formattedOsDCStatus: number
  formattedAnisometropiaStatus: number
  formattedAnisoCoriaStatus: number
  formattedGazeAsymmetryStatus: number

  // Overall result
  formattedResultStatus: 'Passed' | 'Failed'
  formattedResultSummary: string        // "Screening Complete"
  formattedResultOdText: string         // "Myopia,nearsighted" etc
  formattedResultOsText: string
  formattedResultBothText: string
  formattedResultCombinedText: string   // "Myopia(OD, OS), Astigmatism(OD)"
}

/** Parsed Welch Allyn screening for a single child */
export interface WelchAllynScreening {
  // Identity
  id: string
  recordId: string
  firstName: string
  lastName: string
  fullName: string
  gender: 'M' | 'F'
  dateOfBirth: string
  ageInMonths: number
  timestamp: string

  // Device info
  deviceSerial: string       // extracted from recordId
  swVersion: string

  // Overall result
  passed: boolean
  resultText: string         // "All Measurements In Range" or conditions
  conditions: WelchAllynCondition[]

  // Right eye (OD)
  od: EyeRefraction
  // Left eye (OS)
  os: EyeRefraction

  // Binocular
  interpupilDistance: number
  anisometropia: boolean
  anisocoria: boolean
  gazeAsymmetry: boolean

  // PDF report (if available)
  pdfFileName?: string
  pdfBlob?: Blob

  // Referral criteria used
  criteriaAgeMin: number
  criteriaAgeMax: number
}

export interface EyeRefraction {
  sphericalEquivalent: number  // SE
  sphere: number               // DS
  cylinder: number             // DC
  axis: number
  pupilSize: number
  gazeX: number
  gazeY: number

  // Formatted strings
  formattedDS: string
  formattedDC: string
  formattedAxis: string
  formattedGaze: string

  // Status (true = normal/pass)
  sePass: boolean
  dcPass: boolean
}

export type WelchAllynConditionType =
  | 'myopia'
  | 'hyperopia'
  | 'astigmatism'
  | 'anisometropia'
  | 'anisocoria'
  | 'gaze_asymmetry'

export interface WelchAllynCondition {
  type: WelchAllynConditionType
  eye: 'OD' | 'OS' | 'Both'
  label: string              // Human-readable
  description: string        // e.g. "nearsighted"
  severity: 'mild' | 'moderate' | 'severe'
  value?: number             // SE or DC value
}

/** Welch Allyn condition → SKIDS vision chip mapping */
export const WELCHALLYN_TO_SKIDS_CHIP: Record<WelchAllynConditionType, {
  chipId: string
  label: string
}> = {
  myopia:          { chipId: 'v7', label: 'Myopia' },
  hyperopia:       { chipId: 'v8', label: 'Hyperopia/Astigmatism' },
  astigmatism:     { chipId: 'v8', label: 'Hyperopia/Astigmatism' },
  anisometropia:   { chipId: 'v9', label: 'Amblyopia' },
  anisocoria:      { chipId: 'v5', label: 'Pupil Asymmetry' },
  gaze_asymmetry:  { chipId: 'v1', label: 'Squint/Strabismus' },
}

/** Full import result from ZIP or CSV */
export interface WelchAllynImportResult {
  screenings: WelchAllynScreening[]
  totalCount: number
  passedCount: number
  failedCount: number
  deviceSerial: string
  exportDate: string
  hasPdfs: boolean
  criteria: SpotCriteriaRow[]
}

/** Referral criteria from SpotCriteria.csv */
export interface SpotCriteriaRow {
  ageRangeFrom: number
  ageRangeTo: number
  anisometropia: number
  astigmatism: number
  myopia: number
  hyperopia: number
  anisocoria: number
  gazeVertical: number
  gazeNasal: number
  gazeTemporal: number
  gazeAsymmetry: number
}
