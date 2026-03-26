/**
 * Skin/wound analysis using color-based segmentation
 */

export interface WoundSegmentationResult {
  woundArea: number
  boundingBox: { x: number; y: number; w: number; h: number }
  tissueComposition: { granulation: number; slough: number; necrotic: number }
}

/**
 * Wound segmentation using color-based analysis
 */
export function segmentWound(imageData: ImageData): WoundSegmentationResult {
  const { width, height, data } = imageData

  let woundPixels = 0
  let minX = width, maxX = 0, minY = height, maxY = 0
  let granulation = 0, slough = 0, necrotic = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const x = (i / 4) % width
    const y = Math.floor((i / 4) / width)

    const isWoundColor =
      (r > 120 && g < 100 && b < 100) ||
      (r > 150 && g > 100 && g < 150 && b < 100) ||
      (r < 80 && g < 80 && b < 80)

    if (isWoundColor) {
      woundPixels++
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)

      if (r > 150 && g < 120) granulation++
      else if (r > 150 && g > 100 && g < 150) slough++
      else if (r < 80 && g < 80) necrotic++
    }
  }

  const totalClassified = granulation + slough + necrotic || 1

  return {
    woundArea: woundPixels * 0.01,
    boundingBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    tissueComposition: {
      granulation: granulation / totalClassified,
      slough: slough / totalClassified,
      necrotic: necrotic / totalClassified
    }
  }
}
