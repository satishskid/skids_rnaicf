/**
 * rPPG (Remote Photoplethysmography) heart rate extraction
 * Uses the CHROM method for robust contactless heart rate measurement
 */

/**
 * Extract face region and compute average color channels for rPPG
 */
export function extractFaceSignal(video: HTMLVideoElement, canvas: HTMLCanvasElement): { r: number; g: number; b: number } | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  ctx.drawImage(video, 0, 0)

  const faceRegion = {
    x: canvas.width * 0.3,
    y: canvas.height * 0.1,
    width: canvas.width * 0.4,
    height: canvas.height * 0.5
  }

  const imageData = ctx.getImageData(faceRegion.x, faceRegion.y, faceRegion.width, faceRegion.height)
  const pixels = imageData.data

  let totalR = 0, totalG = 0, totalB = 0, count = 0

  for (let i = 0; i < pixels.length; i += 40) {
    totalR += pixels[i]
    totalG += pixels[i + 1]
    totalB += pixels[i + 2]
    count++
  }

  if (count === 0) return null

  return {
    r: totalR / count,
    g: totalG / count,
    b: totalB / count
  }
}

/**
 * CHROM method for rPPG heart rate extraction
 * More robust than simple green channel analysis
 */
export function computeHeartRateCHROM(signalBuffer: Array<{ r: number; g: number; b: number; time: number }>): number {
  if (signalBuffer.length < 90) return 0

  const xSignal: number[] = []
  const ySignal: number[] = []
  const times: number[] = []

  signalBuffer.forEach(s => {
    xSignal.push(3 * s.r - 2 * s.g)
    ySignal.push(1.5 * s.r + s.g - 1.5 * s.b)
    times.push(s.time)
  })

  const xMean = xSignal.reduce((a, b) => a + b, 0) / xSignal.length
  const yMean = ySignal.reduce((a, b) => a + b, 0) / ySignal.length

  const xNorm = xSignal.map(x => x - xMean)
  const yNorm = ySignal.map(y => y - yMean)

  const xStd = Math.sqrt(xNorm.reduce((a, b) => a + b * b, 0) / xNorm.length)
  const yStd = Math.sqrt(yNorm.reduce((a, b) => a + b * b, 0) / yNorm.length)

  if (xStd === 0 || yStd === 0) return 0

  const chromSignal = xNorm.map((x, i) => x / xStd - yNorm[i] / yStd)

  const sampleRate = 30
  let peaks = 0
  let lastPeakIdx = 0
  const minPeakDistance = Math.floor(sampleRate * 0.4)

  for (let i = 1; i < chromSignal.length - 1; i++) {
    if (chromSignal[i] > chromSignal[i - 1] && chromSignal[i] > chromSignal[i + 1]) {
      if (i - lastPeakIdx >= minPeakDistance) {
        peaks++
        lastPeakIdx = i
      }
    }
  }

  const duration = (times[times.length - 1] - times[0]) / 1000
  const heartRate = Math.round((peaks / duration) * 60)

  return Math.max(40, Math.min(200, heartRate))
}
