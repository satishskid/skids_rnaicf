/**
 * Ear screening analysis using image processing
 * Analyzes external ear photos for color distribution, symmetry, and anomalies
 */

export interface EarAnalysisResult {
  visibility: number
  colorScore: number
  symmetry: number
  inflammationIndicator: number
  riskCategory: 'no_risk' | 'possible_risk' | 'high_risk'
}

/**
 * Analyze ear image for signs of infection or abnormality
 * Uses color analysis to detect redness/inflammation and assess visibility
 */
export function analyzeEarImage(imageData: ImageData): EarAnalysisResult {
  const { width, height, data } = imageData

  // Focus on center region where ear canal should be
  const centerRegion = {
    x: Math.floor(width * 0.25),
    y: Math.floor(height * 0.25),
    w: Math.floor(width * 0.5),
    h: Math.floor(height * 0.5)
  }

  let totalPixels = 0
  let skinTonePixels = 0
  let redPixels = 0
  let darkPixels = 0
  let brightnessSum = 0
  let rednessSum = 0

  // Left half vs right half for symmetry
  let leftBrightness = 0, rightBrightness = 0
  let leftCount = 0, rightCount = 0

  for (let y = centerRegion.y; y < centerRegion.y + centerRegion.h; y++) {
    for (let x = centerRegion.x; x < centerRegion.x + centerRegion.w; x++) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      totalPixels++
      const brightness = (r + g + b) / 3
      brightnessSum += brightness

      // Detect skin-tone pixels (ear visible)
      if (r > 120 && g > 80 && b > 60 && r > g && g > b) {
        skinTonePixels++
      }

      // Detect redness (possible inflammation)
      const redness = r - (g + b) / 2
      if (redness > 40) {
        redPixels++
        rednessSum += redness
      }

      // Detect very dark areas (poor visibility or occluded canal)
      if (brightness < 40) {
        darkPixels++
      }

      // Symmetry analysis
      const midX = centerRegion.x + centerRegion.w / 2
      if (x < midX) {
        leftBrightness += brightness
        leftCount++
      } else {
        rightBrightness += brightness
        rightCount++
      }
    }
  }

  // Visibility: how much of the region shows skin-tone (ear tissue)
  const visibility = Math.min(1, skinTonePixels / (totalPixels * 0.4))

  // Average brightness affects quality
  const avgBrightness = brightnessSum / totalPixels
  const colorScore = Math.min(1, avgBrightness / 180)

  // Inflammation indicator based on redness
  const inflammationIndicator = Math.min(1, redPixels / (totalPixels * 0.15))

  // Symmetry of left vs right halves
  const leftAvg = leftCount > 0 ? leftBrightness / leftCount : 0
  const rightAvg = rightCount > 0 ? rightBrightness / rightCount : 0
  const maxAvg = Math.max(leftAvg, rightAvg, 1)
  const symmetry = 1 - Math.abs(leftAvg - rightAvg) / maxAvg

  // Risk assessment
  let riskCategory: 'no_risk' | 'possible_risk' | 'high_risk' = 'no_risk'
  if (inflammationIndicator > 0.5 || visibility < 0.3) {
    riskCategory = 'high_risk'
  } else if (inflammationIndicator > 0.25 || visibility < 0.5 || symmetry < 0.7) {
    riskCategory = 'possible_risk'
  }

  return {
    visibility,
    colorScore,
    symmetry,
    inflammationIndicator,
    riskCategory
  }
}
