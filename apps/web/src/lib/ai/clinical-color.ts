/**
 * Clinical Color Analysis — HSV/LAB color-space analysis for clinical indicators
 *
 * Detects clinically relevant color ranges in captured images:
 * - Redness/erythema (inflammation, injection, gingivitis)
 * - Pallor (anemia — conjunctival, nail bed)
 * - Cyanosis (peripheral — nails, lips)
 * - White patches (plaque, candidiasis, leukoplakia)
 * - Dark spots (caries, necrotic tissue)
 * - Yellow/icteric (jaundice — sclera, skin)
 */

import type { ClinicalColorResult } from '@skids/shared'

interface RGB { r: number; g: number; b: number }
interface HSV { h: number; s: number; v: number }
interface LAB { l: number; a: number; b: number }

// RGB → HSV conversion
function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : d / max
  return { h, s: s * 100, v: max * 100 }
}

// RGB → LAB conversion (via XYZ)
function rgbToLab(r: number, g: number, b: number): LAB {
  // sRGB → linear
  let rl = r / 255; let gl = g / 255; let bl = b / 255
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92

  // Linear RGB → XYZ (D65)
  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047
  let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.0
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883

  // XYZ → LAB
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
  x = f(x); y = f(y); z = f(z)

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  }
}

// Analyze image pixels for clinical color indicators
function analyzePixels(imageData: ImageData): ClinicalColorResult {
  const { data, width, height } = imageData
  const totalPixels = width * height

  // Skip edge pixels (10% border on each side) to focus on center
  const xStart = Math.floor(width * 0.1)
  const xEnd = Math.floor(width * 0.9)
  const yStart = Math.floor(height * 0.1)
  const yEnd = Math.floor(height * 0.9)

  let rednessCount = 0
  let pallorCount = 0
  let cyanosisCount = 0
  let darkCount = 0
  let whiteCount = 0
  let yellowCount = 0
  let analyzedPixels = 0

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]

      const hsv = rgbToHsv(r, g, b)
      const lab = rgbToLab(r, g, b)
      analyzedPixels++

      // Redness/erythema: H=0-20 or 340-360, S>40%, V>30%
      if ((hsv.h <= 20 || hsv.h >= 340) && hsv.s > 40 && hsv.v > 30) {
        rednessCount++
      }

      // Pallor: high L* in LAB, low a* (lack of redness)
      if (lab.l > 80 && lab.a < 5) {
        pallorCount++
      }

      // Cyanosis: H=200-260, low V
      if (hsv.h >= 200 && hsv.h <= 260 && hsv.v < 60) {
        cyanosisCount++
      }

      // Dark spots: very low V
      if (hsv.v < 25) {
        darkCount++
      }

      // White patches: low S, high V
      if (hsv.s < 20 && hsv.v > 70 && hsv.h < 30) {
        whiteCount++
      }

      // Yellow/icteric: H=40-65, S>40
      if (hsv.h >= 40 && hsv.h <= 65 && hsv.s > 40) {
        yellowCount++
      }
    }
  }

  // Normalize to 0-1 scores
  const norm = (count: number) => Math.min(1, count / (analyzedPixels * 0.3))

  const regionScores = {
    redness: norm(rednessCount),
    pallor: norm(pallorCount),
    cyanosis: norm(cyanosisCount),
    darkSpots: norm(darkCount),
    whitePatches: norm(whiteCount),
    yellowIcteric: norm(yellowCount),
  }

  // Suggest chips based on thresholds
  const suggestedChips: string[] = []
  const THRESHOLD = 0.15

  if (regionScores.redness > THRESHOLD) {
    suggestedChips.push('redness', 'erythema', 'injection', 'gingivitis')
  }
  if (regionScores.pallor > THRESHOLD) {
    suggestedChips.push('pallor', 'anemia')
  }
  if (regionScores.cyanosis > THRESHOLD) {
    suggestedChips.push('cyanosis')
  }
  if (regionScores.darkSpots > THRESHOLD) {
    suggestedChips.push('caries', 'dark_spots')
  }
  if (regionScores.whitePatches > THRESHOLD) {
    suggestedChips.push('plaque', 'candidiasis', 'white_patches')
  }
  if (regionScores.yellowIcteric > THRESHOLD) {
    suggestedChips.push('jaundice', 'icterus')
  }

  return {
    regionScores,
    suggestedChips,
    confidence: Math.min(1, analyzedPixels / totalPixels),
  }
}

/**
 * Analyze an image (as base64 data URL or ImageData) for clinical color indicators.
 */
export async function analyzeClinicalColors(input: string | ImageData): Promise<ClinicalColorResult> {
  if (input instanceof ImageData) {
    return analyzePixels(input)
  }

  // Convert base64 to ImageData
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Downsample large images for performance (max 640px)
      const scale = Math.min(1, 640 / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas context unavailable')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve(analyzePixels(imageData))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = input
  })
}

/**
 * Map clinical color suggestions to module-specific chip IDs.
 * Each module has its own chip ID scheme, so we need a mapping.
 */
export function mapSuggestionsToChipIds(
  suggestions: string[],
  moduleType: string
): string[] {
  const mappings: Record<string, Record<string, string[]>> = {
    dental: {
      redness: ['d5'], // Gingivitis
      caries: ['d1'], // Dental Caries
      dark_spots: ['d1'],
      white_patches: ['d6', 'd10'], // Plaque, Candidiasis
      plaque: ['d6'],
      candidiasis: ['d10'],
    },
    throat: {
      redness: ['t5'], // Pharyngeal Erythema
      erythema: ['t5'],
    },
    eyes_external: {
      redness: ['ee4'], // Conjunctival Injection
      injection: ['ee4'],
      pallor: ['ee5'], // Conjunctival Pallor
      anemia: ['ee5'],
    },
    general_appearance: {
      pallor: ['ga3'],
      anemia: ['ga3'],
      jaundice: ['ga4'],
      icterus: ['ga4'],
      cyanosis: ['ga5'],
    },
    nails: {
      pallor: ['na3'],
      anemia: ['na3'],
      cyanosis: ['na4'],
    },
    skin: {
      redness: ['s1'], // Could be eczema
    },
  }

  const moduleMap = mappings[moduleType]
  if (!moduleMap) return []

  const chipIds = new Set<string>()
  for (const suggestion of suggestions) {
    const ids = moduleMap[suggestion]
    if (ids) ids.forEach((id) => chipIds.add(id))
  }
  return Array.from(chipIds)
}
