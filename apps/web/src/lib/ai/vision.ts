/**
 * Vision screening AI - Red reflex analysis
 */

export interface RedReflexResult {
  present: boolean
  symmetry: number
  leftIntensity: number
  rightIntensity: number
}

/**
 * Detect red reflex in eye images
 */
export function analyzeRedReflex(imageData: ImageData): RedReflexResult {
  const { width, height, data } = imageData

  const eyeRegions = {
    leftEye: { x: width * 0.25, y: height * 0.35, w: width * 0.15, h: height * 0.1 },
    rightEye: { x: width * 0.6, y: height * 0.35, w: width * 0.15, h: height * 0.1 }
  }

  const analyzeRegion = (region: { x: number; y: number; w: number; h: number }) => {
    let redSum = 0, count = 0
    const startX = Math.floor(region.x)
    const startY = Math.floor(region.y)
    const endX = Math.floor(region.x + region.w)
    const endY = Math.floor(region.y + region.h)

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        if (r > g && r > b && r > 100) {
          redSum += r
          count++
        }
      }
    }
    return count > 0 ? redSum / count : 0
  }

  const leftIntensity = analyzeRegion(eyeRegions.leftEye)
  const rightIntensity = analyzeRegion(eyeRegions.rightEye)

  const avgIntensity = (leftIntensity + rightIntensity) / 2
  const symmetry = 1 - Math.abs(leftIntensity - rightIntensity) / (avgIntensity + 1)
  const present = avgIntensity > 50

  return { present, symmetry, leftIntensity, rightIntensity }
}
