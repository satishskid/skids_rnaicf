// ============================================
// Welch Allyn Spot Vision Screener — CSV / ZIP Parser
// Parses SpotResults.csv, SpotResultsExtended.csv, SpotCriteria.csv
// Extracts PDFs from ZIP archive
// ============================================

import type {
  SpotResultExtended,
  WelchAllynScreening,
  WelchAllynCondition,
  WelchAllynConditionType,
  WelchAllynImportResult,
  EyeRefraction,
  SpotCriteriaRow,
} from './types'

// ============================================
// CSV PARSING
// ============================================

/** Parse a CSV string into rows of key-value pairs */
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  // Parse header — handle quoted fields
  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim()
    })
    rows.push(row)
  }

  return rows
}

/** Parse a single CSV line handling quoted fields */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/** Parse number, return 0 if not valid */
function num(val: string | undefined): number {
  if (!val) return 0
  // Handle "+4.25" format (with plus sign)
  const cleaned = val.replace(/[^\d.\-+eE]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// ============================================
// EXTENDED CSV → SCREENING RECORDS
// ============================================

/** Parse SpotResultsExtended.csv into structured screening records */
export function parseSpotResultsExtended(csvText: string): WelchAllynScreening[] {
  const rows = parseCSV(csvText)
  return rows.map(r => rowToScreening(r)).filter(Boolean) as WelchAllynScreening[]
}

/** Parse SpotResults.csv (basic format, fewer fields) */
export function parseSpotResults(csvText: string): WelchAllynScreening[] {
  const rows = parseCSV(csvText)
  return rows.map(r => rowToScreeningBasic(r)).filter(Boolean) as WelchAllynScreening[]
}

/** Parse SpotCriteria.csv */
export function parseSpotCriteria(csvText: string): SpotCriteriaRow[] {
  const rows = parseCSV(csvText)
  return rows.map(r => ({
    ageRangeFrom: num(r['Age Range From (months)']),
    ageRangeTo: num(r['Age Range To (months)']),
    anisometropia: num(r['Anisometropia']),
    astigmatism: num(r['Astigmatism']),
    myopia: num(r['Myopia']),
    hyperopia: num(r['Hyperopia']),
    anisocoria: num(r['Anisocoria']),
    gazeVertical: num(r['Gaze Vertical']),
    gazeNasal: num(r['Gaze Nasal']),
    gazeTemporal: num(r['Gaze Temporal']),
    gazeAsymmetry: num(r['Gaze Asymmetry']),
  }))
}

/** Convert an extended CSV row to a WelchAllynScreening */
function rowToScreening(r: Record<string, string>): WelchAllynScreening | null {
  const id = r['Id']
  if (!id) return null

  const recordId = r['Record ID'] || ''
  const deviceSerial = recordId.split('_')[0] || ''

  const resultStatus = r['Formatted Result Status'] || ''
  const passed = resultStatus.toLowerCase() === 'passed'

  // Parse conditions from combined text
  const combinedText = r['Formatted Result Combined Text'] || ''
  const odText = r['Formatted Result Od Text'] || ''
  const osText = r['Formatted Result Os Text'] || ''
  const bothText = r['Formatted Result Both Text'] || ''
  const conditions = parseConditions(combinedText, odText, osText, bothText, r)

  // Build eye refractions
  const od: EyeRefraction = {
    sphericalEquivalent: num(r['Od SE']),
    sphere: num(r['Od DS']),
    cylinder: num(r['Od DC']),
    axis: num(r['Od Axis']),
    pupilSize: num(r['Formatted Od Pupil Size'] || r['Od Pupil Size']),
    gazeX: num(r['Od Gaze X']),
    gazeY: num(r['Od Gaze Y']),
    formattedDS: r['Formatted Od DS'] || formatDiopter(num(r['Od DS'])),
    formattedDC: r['Formatted Od DC'] || formatDiopter(num(r['Od DC'])),
    formattedAxis: r['Formatted Od Axis'] || `@${Math.round(num(r['Od Axis']))}°`,
    formattedGaze: r['Formatted Od Gaze Text'] || '',
    sePass: num(r['Formatted Od SE Status']) === 1,
    dcPass: num(r['Formatted Od DC Status']) === 1,
  }

  const os: EyeRefraction = {
    sphericalEquivalent: num(r['OS SE']),
    sphere: num(r['Os DS']),
    cylinder: num(r['Os DC']),
    axis: num(r['Os Axis']),
    pupilSize: num(r['Formatted Os Pupil Size'] || r['Os Pupil Size']),
    gazeX: num(r['Os Gaze X']),
    gazeY: num(r['Os Gaze Y']),
    formattedDS: r['Formatted Os DS'] || formatDiopter(num(r['Os DS'])),
    formattedDC: r['Formatted Os DC'] || formatDiopter(num(r['Os DC'])),
    formattedAxis: r['Formatted Os Axis'] || `@${Math.round(num(r['Os Axis']))}°`,
    formattedGaze: r['Formatted Os Gaze Text'] || '',
    sePass: num(r['Formatted Os SE Status']) === 1,
    dcPass: num(r['Formatted Os DC Status']) === 1,
  }

  return {
    id,
    recordId,
    firstName: r['First Name'] || '',
    lastName: r['Last Name'] || '',
    fullName: `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim(),
    gender: (r['Gender'] as 'M' | 'F') || 'M',
    dateOfBirth: r['Date of Birth'] || '',
    ageInMonths: num(r['Age (in Months)']),
    timestamp: r['Timestamp'] || '',
    deviceSerial,
    swVersion: r['SW Version'] || '',
    passed,
    resultText: combinedText || (passed ? 'All Measurements In Range' : 'Refer'),
    conditions,
    od,
    os,
    interpupilDistance: num(r['Interpupil']),
    anisometropia: num(r['Formatted Anisometropia Status']) === 2,
    anisocoria: num(r['Formatted Anisocoria Status']) === 2,
    gazeAsymmetry: num(r['Formatted Gaze Asymmetry Status']) === 2,
    pdfFileName: recordId ? `${recordId}.pdf` : undefined,
    criteriaAgeMin: num(r['Criteria Age Min']),
    criteriaAgeMax: num(r['Criteria Age Max']),
  }
}

/** Convert a basic SpotResults.csv row (fallback if Extended not available) */
function rowToScreeningBasic(r: Record<string, string>): WelchAllynScreening | null {
  const id = r['Id']
  if (!id) return null

  const recordId = r['Record ID'] || ''
  const deviceSerial = recordId.split('_')[0] || ''

  // In basic format, Formatted Result Status is a number code
  // Result Code 1 = complete, Termination Code 1 = normal
  // We need to determine pass/fail from individual status fields
  const resultStatusNum = num(r['Formatted Result Status'])
  const passed = resultStatusNum === 1

  // Build conditions from individual status flags
  const conditions: WelchAllynCondition[] = []
  const odSEFail = num(r['Formatted Od SE Status']) === 2
  const osSEFail = num(r['Formatted Os SE Status']) === 2
  const odDCFail = num(r['Formatted Od DC Status']) === 2
  const osDCFail = num(r['Formatted Os DC Status']) === 2
  const anisoFail = num(r['Formatted Anisometropia Status']) === 2
  const anisoCoriaFail = num(r['Formatted Anisocoria Status']) === 2
  const gazeFail = num(r['Formatted Gaze Asymmetry Status']) === 2

  const odSE = num(r['Od SE'])
  const osSE = num(r['OS SE'])

  // Determine myopia/hyperopia from SE values
  if (odSEFail || osSEFail) {
    const seVal = odSEFail ? odSE : osSE
    const eye: 'OD' | 'OS' | 'Both' = (odSEFail && osSEFail) ? 'Both' : odSEFail ? 'OD' : 'OS'
    if (seVal < 0) {
      conditions.push(makeCondition('myopia', eye, seVal))
    } else {
      conditions.push(makeCondition('hyperopia', eye, seVal))
    }
  }

  if (odDCFail || osDCFail) {
    const eye: 'OD' | 'OS' | 'Both' = (odDCFail && osDCFail) ? 'Both' : odDCFail ? 'OD' : 'OS'
    conditions.push(makeCondition('astigmatism', eye, num(r['Od DC'])))
  }

  if (anisoFail) conditions.push(makeCondition('anisometropia', 'Both', Math.abs(odSE - osSE)))
  if (anisoCoriaFail) conditions.push(makeCondition('anisocoria', 'Both'))
  if (gazeFail) conditions.push(makeCondition('gaze_asymmetry', 'Both'))

  const od: EyeRefraction = {
    sphericalEquivalent: odSE,
    sphere: num(r['Od DS']),
    cylinder: num(r['Od DC']),
    axis: num(r['Od Axis']),
    pupilSize: num(r['Od Pupil Size']),
    gazeX: num(r['Od Gaze X']),
    gazeY: num(r['Od Gaze Y']),
    formattedDS: formatDiopter(num(r['Od DS'])),
    formattedDC: formatDiopter(num(r['Od DC'])),
    formattedAxis: `@${Math.round(num(r['Od Axis']))}°`,
    formattedGaze: '',
    sePass: !odSEFail,
    dcPass: !odDCFail,
  }

  const os: EyeRefraction = {
    sphericalEquivalent: osSE,
    sphere: num(r['Os DS']),
    cylinder: num(r['Os DC']),
    axis: num(r['Os Axis']),
    pupilSize: num(r['Os Pupil Size']),
    gazeX: num(r['Os Gaze X']),
    gazeY: num(r['Os Gaze Y']),
    formattedDS: formatDiopter(num(r['Os DS'])),
    formattedDC: formatDiopter(num(r['Os DC'])),
    formattedAxis: `@${Math.round(num(r['Os Axis']))}°`,
    formattedGaze: '',
    sePass: !osSEFail,
    dcPass: !osDCFail,
  }

  const combinedText = conditions.length === 0
    ? 'All Measurements In Range'
    : conditions.map(c => `${c.label}(${c.eye})`).join(', ')

  return {
    id,
    recordId,
    firstName: r['First Name'] || '',
    lastName: r['Last Name'] || '',
    fullName: `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim(),
    gender: (r['Gender'] as 'M' | 'F') || 'M',
    dateOfBirth: r['Date of Birth'] || '',
    ageInMonths: num(r['Age (in Months)']),
    timestamp: r['Timestamp'] || '',
    deviceSerial,
    swVersion: r['SW Version'] || '',
    passed,
    resultText: combinedText,
    conditions,
    od,
    os,
    interpupilDistance: num(r['Interpupil']),
    anisometropia: anisoFail,
    anisocoria: anisoCoriaFail,
    gazeAsymmetry: gazeFail,
    pdfFileName: recordId ? `${recordId}.pdf` : undefined,
    criteriaAgeMin: num(r['Criteria Age Min']),
    criteriaAgeMax: num(r['Criteria Age Max']),
  }
}

// ============================================
// CONDITION HELPERS
// ============================================

function makeCondition(
  type: WelchAllynConditionType,
  eye: 'OD' | 'OS' | 'Both',
  value?: number,
): WelchAllynCondition {
  const labels: Record<WelchAllynConditionType, { label: string; desc: string }> = {
    myopia:          { label: 'Myopia', desc: 'nearsighted' },
    hyperopia:       { label: 'Hyperopia', desc: 'farsighted' },
    astigmatism:     { label: 'Astigmatism', desc: 'problem focusing' },
    anisometropia:   { label: 'Anisometropia', desc: 'unequal power' },
    anisocoria:      { label: 'Anisocoria', desc: 'unequal pupils' },
    gaze_asymmetry:  { label: 'Gaze Asymmetry', desc: 'eye alignment' },
  }

  const info = labels[type]
  const absVal = Math.abs(value || 0)
  let severity: 'mild' | 'moderate' | 'severe' = 'mild'
  if (type === 'myopia' || type === 'hyperopia') {
    severity = absVal >= 4 ? 'severe' : absVal >= 2 ? 'moderate' : 'mild'
  } else if (type === 'astigmatism') {
    severity = absVal >= 3 ? 'severe' : absVal >= 2 ? 'moderate' : 'mild'
  } else if (type === 'anisometropia') {
    severity = absVal >= 2 ? 'severe' : absVal >= 1.5 ? 'moderate' : 'mild'
  }

  return { type, eye, label: info.label, description: info.desc, severity, value }
}

/** Parse conditions from Extended CSV formatted text fields */
function parseConditions(
  combinedText: string,
  odText: string,
  osText: string,
  bothText: string,
  r: Record<string, string>,
): WelchAllynCondition[] {
  const conditions: WelchAllynCondition[] = []
  if (!combinedText || combinedText === 'All Measurements In Range') return conditions

  // Parse "Myopia(OD, OS), Astigmatism(OD)" format
  const parts = combinedText.split(/,\s*(?=[A-Z])/)
  for (const part of parts) {
    const match = part.match(/(\w+)\(([^)]+)\)/)
    if (!match) continue

    const condName = match[1].toLowerCase()
    const eyeStr = match[2]
    const eye: 'OD' | 'OS' | 'Both' =
      (eyeStr.includes('OD') && eyeStr.includes('OS')) ? 'Both'
      : eyeStr.includes('OD') ? 'OD' : 'OS'

    let type: WelchAllynConditionType | null = null
    let value: number | undefined

    switch (condName) {
      case 'myopia':
        type = 'myopia'
        value = eye === 'OS' ? num(r['OS SE']) : num(r['Od SE'])
        break
      case 'hyperopia':
        type = 'hyperopia'
        value = eye === 'OS' ? num(r['OS SE']) : num(r['Od SE'])
        break
      case 'astigmatism':
        type = 'astigmatism'
        value = eye === 'OS' ? num(r['Os DC']) : num(r['Od DC'])
        break
      case 'anisometropia':
        type = 'anisometropia'
        value = Math.abs(num(r['Od SE']) - num(r['OS SE']))
        break
      case 'anisocoria':
        type = 'anisocoria'
        break
    }

    if (type) {
      conditions.push(makeCondition(type, eye, value))
    }
  }

  // Check gaze asymmetry separately (not in combined text)
  if (num(r['Formatted Gaze Asymmetry Status']) === 2) {
    conditions.push(makeCondition('gaze_asymmetry', 'Both'))
  }

  return conditions
}

// ============================================
// ZIP PARSING (using JSZip-compatible approach)
// ============================================

/**
 * Parse a Welch Allyn ZIP export file.
 * Extracts CSV data and PDF blobs.
 * Uses browser's native decompression where possible.
 */
export async function parseWelchAllynZip(zipFile: File): Promise<WelchAllynImportResult> {
  // Dynamically import JSZip (loaded client-side only)
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(zipFile)

  let screenings: WelchAllynScreening[] = []
  let criteria: SpotCriteriaRow[] = []

  // 1. Try SpotResultsExtended.csv first (has formatted text)
  const extendedFile = zip.file('db/SpotResultsExtended.csv')
  const basicFile = zip.file('db/SpotResults.csv')

  if (extendedFile) {
    const csvText = await extendedFile.async('text')
    screenings = parseSpotResultsExtended(csvText)
  } else if (basicFile) {
    const csvText = await basicFile.async('text')
    screenings = parseSpotResults(csvText)
  }

  // 2. Parse criteria
  const criteriaFile = zip.file('import/SpotCriteria.csv')
  if (criteriaFile) {
    const csvText = await criteriaFile.async('text')
    criteria = parseSpotCriteria(csvText)
  }

  // 3. Match PDFs to screenings
  const pdfFolder = zip.folder('pdf')
  if (pdfFolder) {
    for (const screening of screenings) {
      if (screening.pdfFileName) {
        const pdfFile = zip.file(`pdf/${screening.pdfFileName}`)
        if (pdfFile) {
          const blob = await pdfFile.async('blob')
          screening.pdfBlob = new Blob([blob], { type: 'application/pdf' })
        }
      }
    }
  }

  // Extract metadata
  const deviceSerial = screenings[0]?.deviceSerial || ''
  const exportDate = screenings[0]?.timestamp?.split(' ')[0] || ''
  const passedCount = screenings.filter(s => s.passed).length
  const hasPdfs = screenings.some(s => s.pdfBlob)

  return {
    screenings,
    totalCount: screenings.length,
    passedCount,
    failedCount: screenings.length - passedCount,
    deviceSerial,
    exportDate,
    hasPdfs,
    criteria,
  }
}

/**
 * Parse a single CSV file (for manual upload without ZIP).
 * Auto-detects if it's Extended or Basic format.
 */
export function parseWelchAllynCSV(csvText: string): WelchAllynScreening[] {
  // Extended format has "Formatted Result Status Text" column
  if (csvText.includes('Formatted Result Status Text')) {
    return parseSpotResultsExtended(csvText)
  }
  return parseSpotResults(csvText)
}

// ============================================
// HELPERS
// ============================================

/** Format diopter value as prescription string */
function formatDiopter(val: number): string {
  if (val === 0) return '0.00'
  const sign = val > 0 ? '+' : ''
  return `${sign}${val.toFixed(2)}`
}

/** Get age in years from months */
export function ageMonthsToYears(months: number): string {
  const years = Math.floor(months / 12)
  const remaining = months % 12
  if (remaining === 0) return `${years}y`
  return `${years}y ${remaining}m`
}

/** Match Welch Allyn screening to a SKIDS child by name/DOB */
export function matchScreeningToChild(
  screening: WelchAllynScreening,
  children: Array<{ id: string; name: string; dateOfBirth?: string }>,
): string | null {
  // 1. Exact DOB match + name similarity
  for (const child of children) {
    if (child.dateOfBirth === screening.dateOfBirth) {
      const nameScore = nameSimilarity(screening.fullName, child.name)
      if (nameScore > 0.5) return child.id
    }
  }

  // 2. Name match only (fuzzy)
  for (const child of children) {
    const nameScore = nameSimilarity(screening.fullName, child.name)
    if (nameScore > 0.8) return child.id
  }

  return null
}

/** Simple name similarity (0-1) */
function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.9

  // Token overlap
  const tokensA = a.toLowerCase().split(/\s+/)
  const tokensB = b.toLowerCase().split(/\s+/)
  const common = tokensA.filter(t => tokensB.some(tb => tb.includes(t) || t.includes(tb)))
  return common.length / Math.max(tokensA.length, tokensB.length)
}
