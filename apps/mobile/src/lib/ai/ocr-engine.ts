/**
 * OCR Engine — On-device text recognition for medical device readings and health cards.
 *
 * Uses @react-native-ml-kit/text-recognition for offline OCR (Latin + Devanagari).
 * Falls back to regex-based extraction from LLM vision when ML Kit unavailable.
 *
 * Use cases:
 *   - Ayushman Bharat card scanning (ID, name, DOB)
 *   - Thermometer reading (temperature)
 *   - BP monitor display (systolic/diastolic/pulse)
 *   - Weighing scale display (weight)
 *   - SpO2 monitor (oxygen saturation + pulse)
 */

// ── Types ──

export interface OCRTextBlock {
  text: string
  confidence: number
  boundingBox: { x: number; y: number; width: number; height: number }
  lines: OCRTextLine[]
}

export interface OCRTextLine {
  text: string
  confidence: number
  boundingBox: { x: number; y: number; width: number; height: number }
}

export interface OCRResult {
  rawText: string
  blocks: OCRTextBlock[]
  confidence: number  // overall 0-1
}

export interface ExtractedValue {
  value: string
  unit: string
  confidence: number
  rawText: string
  boundingBox?: { x: number; y: number; width: number; height: number }
  validated: boolean
  validationMessage?: string
}

export type DeviceType = 'thermometer' | 'bp_monitor' | 'weighing_scale' | 'spo2_monitor' | 'health_card' | 'generic'

// ── ML Kit OCR ──

let mlKitAvailable: boolean | null = null

/**
 * Check if ML Kit text recognition is available.
 */
async function checkMLKitAvailability(): Promise<boolean> {
  if (mlKitAvailable !== null) return mlKitAvailable
  try {
    await import('@react-native-ml-kit/text-recognition')
    mlKitAvailable = true
    return true
  } catch {
    mlKitAvailable = false
    return false
  }
}

/**
 * Run OCR on an image URI using ML Kit.
 */
export async function recognizeText(imageUri: string): Promise<OCRResult> {
  const available = await checkMLKitAvailability()

  if (available) {
    try {
      const TextRecognition = await import('@react-native-ml-kit/text-recognition')
      const result = await TextRecognition.default.recognize(imageUri)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks: OCRTextBlock[] = (result.blocks || []).map((block: any) => ({
        text: block.text ?? '',
        confidence: block.confidence ?? 0.8,
        boundingBox: block.frame || { x: 0, y: 0, width: 0, height: 0 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lines: (block.lines || []).map((line: any) => ({
          text: line.text ?? '',
          confidence: line.confidence ?? 0.8,
          boundingBox: line.frame || { x: 0, y: 0, width: 0, height: 0 },
        })),
      }))

      const rawText = blocks.map(b => b.text).join('\n')
      const avgConfidence = blocks.length > 0
        ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
        : 0

      return { rawText, blocks, confidence: avgConfidence }
    } catch (err) {
      console.warn('ML Kit OCR failed:', err)
    }
  }

  // Fallback: return empty result (caller should try LLM vision)
  return { rawText: '', blocks: [], confidence: 0 }
}

// ── Value Extraction ──

/**
 * Extract a temperature reading from OCR text.
 * Looks for decimal numbers in range 35.0-42.0°C (or 95.0-107.6°F).
 */
export function extractTemperature(ocrResult: OCRResult): ExtractedValue | null {
  const allText = ocrResult.rawText

  // Match patterns like: 98.6, 37.2, 36.8°C, 99.1°F
  const patterns = [
    /(\d{2,3}\.?\d{0,1})\s*°?\s*[CcFf]/g,
    /(\d{2,3}\.\d{1,2})/g,
  ]

  for (const pattern of patterns) {
    const matches = [...allText.matchAll(pattern)]
    for (const match of matches) {
      const numStr = match[1]
      const num = parseFloat(numStr)

      // Celsius range
      if (num >= 35.0 && num <= 42.0) {
        return {
          value: num.toFixed(1),
          unit: '°C',
          confidence: ocrResult.confidence * 0.9,
          rawText: match[0],
          validated: true,
          validationMessage: num > 37.5 ? 'Elevated temperature' : 'Normal range',
        }
      }

      // Fahrenheit range
      if (num >= 95.0 && num <= 107.6) {
        const celsius = ((num - 32) * 5) / 9
        return {
          value: celsius.toFixed(1),
          unit: '°C',
          confidence: ocrResult.confidence * 0.85,
          rawText: match[0],
          validated: true,
          validationMessage: `${num}°F = ${celsius.toFixed(1)}°C`,
        }
      }
    }
  }

  return null
}

/**
 * Extract blood pressure reading from OCR text.
 * Looks for patterns like: 120/80, SYS 120 DIA 80 PUL 72
 */
export function extractBloodPressure(ocrResult: OCRResult): {
  systolic: ExtractedValue | null
  diastolic: ExtractedValue | null
  pulse: ExtractedValue | null
} {
  const allText = ocrResult.rawText

  // Pattern: "120/80" or "120 / 80" or "SYS:120 DIA:80"
  const slashPattern = /(\d{2,3})\s*[/\\]\s*(\d{2,3})/
  const labeledPattern = /(?:SYS|sys|systolic|Systolic)\s*:?\s*(\d{2,3})[\s\S]*?(?:DIA|dia|diastolic|Diastolic)\s*:?\s*(\d{2,3})/i
  const pulsePattern = /(?:PUL|pul|pulse|Pulse|HR|hr|heart\s*rate)\s*:?\s*(\d{2,3})/i

  let systolicVal: number | null = null
  let diastolicVal: number | null = null
  let pulseVal: number | null = null

  // Try slash pattern first
  const slashMatch = allText.match(slashPattern)
  if (slashMatch) {
    systolicVal = parseInt(slashMatch[1])
    diastolicVal = parseInt(slashMatch[2])
  }

  // Try labeled pattern
  if (!systolicVal) {
    const labeledMatch = allText.match(labeledPattern)
    if (labeledMatch) {
      systolicVal = parseInt(labeledMatch[1])
      diastolicVal = parseInt(labeledMatch[2])
    }
  }

  // Extract pulse
  const pulseMatch = allText.match(pulsePattern)
  if (pulseMatch) {
    pulseVal = parseInt(pulseMatch[1])
  }

  // Validate ranges
  const systolic = systolicVal && systolicVal >= 60 && systolicVal <= 200
    ? {
        value: String(systolicVal),
        unit: 'mmHg',
        confidence: ocrResult.confidence * 0.9,
        rawText: String(systolicVal),
        validated: true,
        validationMessage: systolicVal > 140 ? 'Elevated' : systolicVal < 90 ? 'Low' : 'Normal range',
      }
    : null

  const diastolic = diastolicVal && diastolicVal >= 30 && diastolicVal <= 130
    ? {
        value: String(diastolicVal),
        unit: 'mmHg',
        confidence: ocrResult.confidence * 0.9,
        rawText: String(diastolicVal),
        validated: true,
        validationMessage: diastolicVal > 90 ? 'Elevated' : diastolicVal < 60 ? 'Low' : 'Normal range',
      }
    : null

  const pulse = pulseVal && pulseVal >= 40 && pulseVal <= 200
    ? {
        value: String(pulseVal),
        unit: 'bpm',
        confidence: ocrResult.confidence * 0.85,
        rawText: String(pulseVal),
        validated: true,
      }
    : null

  return { systolic, diastolic, pulse }
}

/**
 * Extract weight from OCR text.
 * Looks for: 25.5, 25.5 kg, 56.2 lbs
 */
export function extractWeight(ocrResult: OCRResult): ExtractedValue | null {
  const allText = ocrResult.rawText

  const patterns = [
    /(\d{1,3}\.?\d{0,2})\s*(?:kg|KG|Kg)/g,
    /(\d{1,3}\.?\d{0,2})\s*(?:lbs?|LBS?)/g,
    /(\d{1,3}\.\d{1,2})/g,
  ]

  for (let pi = 0; pi < patterns.length; pi++) {
    const matches = [...allText.matchAll(patterns[pi])]
    for (const match of matches) {
      const num = parseFloat(match[1])

      // kg range for children: 2-100 kg
      if (pi !== 1 && num >= 2.0 && num <= 100.0) {
        return {
          value: num.toFixed(1),
          unit: 'kg',
          confidence: ocrResult.confidence * (pi === 0 ? 0.95 : 0.8),
          rawText: match[0],
          validated: true,
        }
      }

      // lbs range for children: 4-220 lbs
      if (pi === 1 && num >= 4.0 && num <= 220.0) {
        const kg = num * 0.453592
        return {
          value: kg.toFixed(1),
          unit: 'kg',
          confidence: ocrResult.confidence * 0.85,
          rawText: match[0],
          validated: true,
          validationMessage: `${num} lbs = ${kg.toFixed(1)} kg`,
        }
      }
    }
  }

  return null
}

/**
 * Extract SpO2 reading from OCR text.
 * Looks for: 98%, SpO2: 98, 98 %SpO2
 */
export function extractSpO2(ocrResult: OCRResult): {
  spo2: ExtractedValue | null
  pulse: ExtractedValue | null
} {
  const allText = ocrResult.rawText

  let spo2Val: number | null = null
  let pulseVal: number | null = null

  // SpO2 pattern
  const spo2Patterns = [
    /(?:SpO2|SPO2|spo2|O2|Sat)\s*:?\s*(\d{2,3})\s*%?/i,
    /(\d{2,3})\s*%/g,
  ]

  for (const pattern of spo2Patterns) {
    const match = allText.match(pattern)
    if (match) {
      const val = parseInt(match[1])
      if (val >= 70 && val <= 100) {
        spo2Val = val
        break
      }
    }
  }

  // Pulse from SpO2 monitor
  const pulseMatch = allText.match(/(?:PR|pr|pulse|Pulse|HR|BPM|bpm)\s*:?\s*(\d{2,3})/i)
  if (pulseMatch) {
    const val = parseInt(pulseMatch[1])
    if (val >= 40 && val <= 200) pulseVal = val
  }

  return {
    spo2: spo2Val
      ? {
          value: String(spo2Val),
          unit: '%',
          confidence: ocrResult.confidence * 0.9,
          rawText: String(spo2Val),
          validated: true,
          validationMessage: spo2Val < 95 ? 'Low \u2014 needs attention' : 'Normal',
        }
      : null,
    pulse: pulseVal
      ? {
          value: String(pulseVal),
          unit: 'bpm',
          confidence: ocrResult.confidence * 0.85,
          rawText: String(pulseVal),
          validated: true,
        }
      : null,
  }
}

/**
 * Extract Ayushman Bharat health card information.
 * ID format: XX-XXXX-XXXX-XXXX (14 digits with dashes)
 */
export function extractHealthCard(ocrResult: OCRResult): {
  cardId: string | null
  name: string | null
  dob: string | null
  scheme: string | null
  confidence: number
} {
  const allText = ocrResult.rawText

  // Ayushman card ID pattern: 14-digit with optional separators
  const idPatterns = [
    /(\d{2}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})/,
    /(?:ABHA|PMJAY|ID|Card\s*No)\s*:?\s*(\d{10,14})/i,
  ]

  let cardId: string | null = null
  for (const pattern of idPatterns) {
    const match = allText.match(pattern)
    if (match) {
      cardId = match[1].replace(/\s/g, '')
      break
    }
  }

  // Name extraction (look for "Name:" label)
  let name: string | null = null
  const nameMatch = allText.match(/(?:Name|NAME|नाम)\s*:?\s*([A-Za-z\s\u0900-\u097F]{3,50})/i)
  if (nameMatch) {
    name = nameMatch[1].trim()
  }

  // DOB extraction
  let dob: string | null = null
  const dobPatterns = [
    /(?:DOB|D\.O\.B|Date\s*of\s*Birth|जन्म\s*तिथि)\s*:?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})/i,
    /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4})/,
  ]
  for (const pattern of dobPatterns) {
    const match = allText.match(pattern)
    if (match) {
      dob = match[1]
      break
    }
  }

  // Scheme detection
  let scheme: string | null = null
  const schemeKeywords = ['PMJAY', 'Ayushman', 'ABHA', 'NHA', 'आयुष्मान']
  for (const keyword of schemeKeywords) {
    if (allText.includes(keyword)) {
      scheme = keyword === 'आयुष्मान' ? 'Ayushman Bharat' : keyword
      break
    }
  }

  return {
    cardId,
    name,
    dob,
    scheme,
    confidence: ocrResult.confidence * (cardId ? 0.9 : 0.5),
  }
}

// ── Unified extraction ──

/**
 * Extract values from OCR result based on device type.
 */
export async function extractFromDevice(
  imageUri: string,
  deviceType: DeviceType
): Promise<{
  ocrResult: OCRResult
  extracted: Record<string, ExtractedValue | null>
}> {
  const ocrResult = await recognizeText(imageUri)

  let extracted: Record<string, ExtractedValue | null> = {}

  switch (deviceType) {
    case 'thermometer':
      extracted = { temperature: extractTemperature(ocrResult) }
      break

    case 'bp_monitor': {
      const bp = extractBloodPressure(ocrResult)
      extracted = { systolic: bp.systolic, diastolic: bp.diastolic, pulse: bp.pulse }
      break
    }

    case 'weighing_scale':
      extracted = { weight: extractWeight(ocrResult) }
      break

    case 'spo2_monitor': {
      const spo2 = extractSpO2(ocrResult)
      extracted = { spo2: spo2.spo2, pulse: spo2.pulse }
      break
    }

    case 'health_card': {
      const card = extractHealthCard(ocrResult)
      extracted = {
        cardId: card.cardId ? { value: card.cardId, unit: '', confidence: card.confidence, rawText: card.cardId, validated: !!card.cardId } : null,
        name: card.name ? { value: card.name, unit: '', confidence: card.confidence, rawText: card.name, validated: true } : null,
        dob: card.dob ? { value: card.dob, unit: '', confidence: card.confidence, rawText: card.dob, validated: true } : null,
        scheme: card.scheme ? { value: card.scheme, unit: '', confidence: card.confidence, rawText: card.scheme, validated: true } : null,
      }
      break
    }

    case 'generic':
      // Return raw text, let caller handle extraction
      extracted = {
        text: {
          value: ocrResult.rawText,
          unit: '',
          confidence: ocrResult.confidence,
          rawText: ocrResult.rawText,
          validated: ocrResult.rawText.length > 0,
        },
      }
      break
  }

  return { ocrResult, extracted }
}
