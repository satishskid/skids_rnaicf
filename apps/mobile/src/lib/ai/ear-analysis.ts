/**
 * Ear screening — inflammation and otitis detection via image color analysis.
 */

export interface EarAnalysisResult {
  visibility: number          // 0-1, how much ear tissue is visible
  colorScore: number          // 0-1, brightness quality
  symmetry: number            // 0-1, left/right symmetry
  inflammationIndicator: number // 0-1, redness level
  riskCategory: 'no_risk' | 'possible_risk' | 'high_risk'
}

/**
 * Analyze ear image for signs of infection or abnormality.
 * @param pixels - RGBA Uint8Array
 */
export function analyzeEarImage(pixels: Uint8Array, width: number, height: number): EarAnalysisResult {
  const cx = Math.floor(width * 0.25)
  const cy = Math.floor(height * 0.25)
  const cw = Math.floor(width * 0.5)
  const ch = Math.floor(height * 0.5)

  let totalPixels = 0, skinTonePixels = 0, redPixels = 0
  let brightnessSum = 0
  let leftBrightness = 0, rightBrightness = 0
  let leftCount = 0, rightCount = 0

  for (let y = cy; y < cy + ch; y++) {
    for (let x = cx; x < cx + cw; x++) {
      const idx = (y * width + x) * 4
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]
      totalPixels++
      const brightness = (r + g + b) / 3
      brightnessSum += brightness

      if (r > 120 && g > 80 && b > 60 && r > g && g > b) skinTonePixels++

      const redness = r - (g + b) / 2
      if (redness > 40) redPixels++

      const midX = cx + cw / 2
      if (x < midX) { leftBrightness += brightness; leftCount++ }
      else { rightBrightness += brightness; rightCount++ }
    }
  }

  const visibility = Math.min(1, skinTonePixels / (totalPixels * 0.4))
  const avgBrightness = brightnessSum / totalPixels
  const colorScore = Math.min(1, avgBrightness / 180)
  const inflammationIndicator = Math.min(1, redPixels / (totalPixels * 0.15))

  const leftAvg = leftCount > 0 ? leftBrightness / leftCount : 0
  const rightAvg = rightCount > 0 ? rightBrightness / rightCount : 0
  const maxAvg = Math.max(leftAvg, rightAvg, 1)
  const symmetry = 1 - Math.abs(leftAvg - rightAvg) / maxAvg

  let riskCategory: 'no_risk' | 'possible_risk' | 'high_risk' = 'no_risk'
  if (inflammationIndicator > 0.5 || visibility < 0.3) riskCategory = 'high_risk'
  else if (inflammationIndicator > 0.25 || visibility < 0.5 || symmetry < 0.7) riskCategory = 'possible_risk'

  return { visibility, colorScore, symmetry, inflammationIndicator, riskCategory }
}
