/**
 * Skin/wound segmentation — color-based tissue classification.
 * Classifies: granulation (healthy), slough (yellow), necrotic (black).
 */

export interface WoundSegmentationResult {
  woundArea: number
  boundingBox: { x: number; y: number; w: number; h: number }
  tissueComposition: { granulation: number; slough: number; necrotic: number }
}

/** Segment wound from image pixels using color analysis. */
export function segmentWound(pixels: Uint8Array, width: number, height: number): WoundSegmentationResult {
  let woundPixels = 0
  let minX = width, maxX = 0, minY = height, maxY = 0
  let granulation = 0, slough = 0, necrotic = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]

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
  }

  const totalClassified = granulation + slough + necrotic || 1

  return {
    woundArea: woundPixels * 0.01,
    boundingBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    tissueComposition: {
      granulation: granulation / totalClassified,
      slough: slough / totalClassified,
      necrotic: necrotic / totalClassified,
    },
  }
}
