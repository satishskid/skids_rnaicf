/**
 * AyuSynk Import — Parse live stream URLs, report URLs, and WAV files
 * from the AyuSynk Android stethoscope app into SKIDS observations.
 */

import {
  AyuSynkDiagnosisReport,
  AyuSynkRecording,
  AyuSynkReportData,
  AyuSynkImportResult,
  HeartLocation,
  mapAyuSynkConditionToChip,
} from './types'

// ============================================
// LIVE STREAM URL IMPORT
// ============================================

/**
 * Parse an AyuSynk live stream URL.
 * AyuSynk's `getLiveStreamUrl()` returns a URL that can be opened
 * in any browser to listen to the stethoscope audio in real-time.
 */
export function parseAyuSynkStreamUrl(url: string): { valid: boolean; streamUrl?: string; error?: string } {
  const trimmed = url.trim()

  // Basic URL validation
  try {
    const parsed = new URL(trimmed)
    // AyuSynk stream URLs are typically HTTP/HTTPS
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Invalid protocol — expected http or https' }
    }
    return { valid: true, streamUrl: trimmed }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Create a diagnosis report from a live stream URL.
 * The audio is played/recorded in the browser from the stream.
 */
export function createStreamImport(streamUrl: string, notes?: string): AyuSynkDiagnosisReport {
  return {
    id: `ayusynk_stream_${Date.now()}`,
    importedAt: new Date().toISOString(),
    source: 'live_stream',
    liveStreamUrl: streamUrl,
    reports: [],
    notes,
  }
}

// ============================================
// AI REPORT URL IMPORT
// ============================================

/**
 * Parse AyuSynk report data from a shared text.
 *
 * When the nurse taps "Share Report" in the AyuSynk app, it generates
 * a text message like:
 *
 *   Aortic
 *   https://report-url.example.com/report/12345
 *   Abnormality Detected:
 *   Systolic Murmur(Confidence:0.85)
 *
 * This function parses that format.
 */
export function parseAyuSynkReportText(text: string): AyuSynkImportResult {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)

  if (lines.length === 0) {
    return { status: 'error', error: 'Empty report text' }
  }

  const reports: AyuSynkReportData[] = []
  let i = 0

  while (i < lines.length) {
    // Try to parse a report block:
    // Line 1: Position name (e.g., "Aortic")
    // Line 2: Report URL
    // Line 3: "Abnormality Detected:"
    // Line 4: Condition(Confidence:X.XX)

    const positionName = lines[i]
    i++

    // Look for URL on next line
    let reportUrl = ''
    if (i < lines.length && (lines[i].startsWith('http://') || lines[i].startsWith('https://'))) {
      reportUrl = lines[i]
      i++
    }

    // Look for "Abnormality Detected:" line
    if (i < lines.length && lines[i].toLowerCase().includes('abnormality detected')) {
      i++
    }

    // Parse condition and confidence
    let conditionDetected = ''
    let conditionConfidence = 0

    if (i < lines.length) {
      const conditionLine = lines[i]
      // Format: "Systolic Murmur(Confidence:0.85)"
      const match = conditionLine.match(/^(.+?)\s*\(Confidence:\s*([\d.]+)\)$/i)
      if (match) {
        conditionDetected = match[1].trim()
        conditionConfidence = parseFloat(match[2]) || 0
      } else {
        // Try without confidence
        conditionDetected = conditionLine
      }
      i++
    }

    if (positionName && (reportUrl || conditionDetected)) {
      reports.push({
        positionName,
        reportUrl,
        conditionDetected,
        conditionConfidence,
      })
    }
  }

  if (reports.length === 0) {
    return { status: 'error', error: 'Could not parse any report data from text' }
  }

  const diagnosisReport: AyuSynkDiagnosisReport = {
    id: `ayusynk_report_${Date.now()}`,
    importedAt: new Date().toISOString(),
    source: 'report_url',
    reports,
  }

  return { status: 'success', report: diagnosisReport }
}

// ============================================
// WAV FILE IMPORT
// ============================================

/**
 * Import a WAV file from AyuSynk (shared via Android Share intent or file picker).
 */
export function importWavFile(
  file: File,
  location: HeartLocation,
): AyuSynkImportResult {
  // Validate file type
  if (!file.type.includes('audio') && !file.name.toLowerCase().endsWith('.wav')) {
    return { status: 'error', error: 'File must be a WAV audio file' }
  }

  // Validate file size (max 50 MB)
  if (file.size > 50 * 1024 * 1024) {
    return { status: 'error', error: 'File too large (max 50 MB)' }
  }

  const recording: AyuSynkRecording = {
    id: `ayusynk_wav_${Date.now()}`,
    location,
    filterType: 'HEART',
    durationSeconds: 0, // Will be determined from audio metadata
    audioBlob: file,
    recordedAt: new Date().toISOString(),
  }

  const report: AyuSynkDiagnosisReport = {
    id: `ayusynk_wav_${Date.now()}`,
    importedAt: new Date().toISOString(),
    source: 'wav_import',
    reports: [],
  }

  return { status: 'success', report, recordings: [recording] }
}

// ============================================
// MAP TO SKIDS OBSERVATIONS
// ============================================

export interface AyuSynkToSkidsMapping {
  /** SKIDS chip IDs to auto-select based on AyuSynk AI findings */
  suggestedChips: string[]
  /** Chip labels for display */
  suggestedChipLabels: string[]
  /** Summary text for observation notes */
  summaryText: string
  /** Risk category */
  riskCategory: 'no_risk' | 'possible_risk' | 'high_risk'
  /** Per-location results */
  locationResults: {
    location: string
    condition: string
    confidence: number
    chipId: string | null
    reportUrl?: string
  }[]
}

/**
 * Convert AyuSynk AI report to SKIDS observation data.
 * Maps AyuSynk conditions to SKIDS cardiac chips and risk categories.
 */
export function mapAyuSynkToSkids(report: AyuSynkDiagnosisReport): AyuSynkToSkidsMapping {
  const suggestedChips: string[] = []
  const suggestedChipLabels: string[] = []
  const locationResults: AyuSynkToSkidsMapping['locationResults'] = []
  let hasAbnormality = false
  let highConfidenceAbnormality = false

  for (const r of report.reports) {
    const chipMatch = mapAyuSynkConditionToChip(r.conditionDetected)
    const chipId = chipMatch?.chipId || null

    if (chipId && !suggestedChips.includes(chipId)) {
      suggestedChips.push(chipId)
      suggestedChipLabels.push(chipMatch!.label)
    }

    if (chipId && chipId !== 'ca1') {
      hasAbnormality = true
      if (r.conditionConfidence >= 0.7) {
        highConfidenceAbnormality = true
      }
    }

    locationResults.push({
      location: r.positionName,
      condition: r.conditionDetected,
      confidence: r.conditionConfidence,
      chipId,
      reportUrl: r.reportUrl,
    })
  }

  // Build summary text
  const lines: string[] = [
    `[AyuSynk Digital Stethoscope — AI Report]`,
    `Imported: ${new Date(report.importedAt).toLocaleString()}`,
    `Source: ${report.source.replace('_', ' ')}`,
    '',
  ]

  for (const lr of locationResults) {
    lines.push(
      `${lr.location}: ${lr.condition}${lr.confidence ? ` (${Math.round(lr.confidence * 100)}% confidence)` : ''}`
    )
  }

  if (report.liveStreamUrl) {
    lines.push('', `Live Stream: ${report.liveStreamUrl}`)
  }

  // Determine risk
  const riskCategory = highConfidenceAbnormality
    ? 'high_risk'
    : hasAbnormality
      ? 'possible_risk'
      : 'no_risk'

  return {
    suggestedChips,
    suggestedChipLabels,
    summaryText: lines.join('\n'),
    riskCategory,
    locationResults,
  }
}
