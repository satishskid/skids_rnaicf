/**
 * Video Key-Frame Extraction
 *
 * Extracts the best frames from recorded video based on:
 * - Sharpness (Laplacian variance — higher = sharper/less blurry)
 * - Brightness (mean pixel value — not too dark, not too bright)
 *
 * Used for dental, throat, and neck video captures where
 * nurse records video and AI picks the best frames for annotation.
 */

interface KeyFrameOptions {
  fps?: number       // frames to sample per second (default: 1)
  maxFrames?: number  // max frames to return (default: 5)
  minSharpness?: number // minimum sharpness score (0-1)
}

interface KeyFrameResult {
  frames: string[]       // base64 JPEG data URLs, sorted by quality
  bestFrameIndex: number // index of the single best frame
  scores: number[]       // quality scores corresponding to frames
}

/**
 * Calculate sharpness using Laplacian variance.
 * Approximated by computing variance of edge-detected pixels.
 */
function calculateSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData
  const gray = new Float32Array(width * height)

  // Convert to grayscale
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
  }

  // Apply Laplacian kernel: [0,1,0; 1,-4,1; 0,1,0]
  let sumSq = 0
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const laplacian =
        gray[idx - width] +
        gray[idx - 1] +
        -4 * gray[idx] +
        gray[idx + 1] +
        gray[idx + width]
      sumSq += laplacian * laplacian
      count++
    }
  }

  // Variance of Laplacian (normalized)
  return count > 0 ? Math.min(1, (sumSq / count) / 5000) : 0
}

/**
 * Calculate brightness score (0-1, where 0.5 is ideal).
 * Penalizes both too dark and too bright.
 */
function calculateBrightness(imageData: ImageData): number {
  const { data } = imageData
  let sum = 0
  const pixelCount = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3
  }

  const meanBrightness = sum / pixelCount / 255 // 0-1
  // Ideal brightness around 0.45-0.65
  const idealCenter = 0.55
  const deviation = Math.abs(meanBrightness - idealCenter)
  return Math.max(0, 1 - deviation * 2)
}

/**
 * Extract key frames from a video Blob.
 * Returns base64 JPEG frames sorted by quality.
 */
export async function extractKeyFrames(
  videoBlob: Blob,
  options: KeyFrameOptions = {}
): Promise<KeyFrameResult> {
  const { fps = 1, maxFrames = 5 } = options

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoBlob)
    video.src = url
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      const duration = video.duration
      if (!duration || duration === Infinity) {
        URL.revokeObjectURL(url)
        reject(new Error('Invalid video duration'))
        return
      }

      const canvas = document.createElement('canvas')
      // Downsample for performance (max 640px wide)
      const scale = Math.min(1, 640 / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas context unavailable'))
        return
      }

      // Calculate sample times
      const interval = 1 / fps
      const sampleTimes: number[] = []
      for (let t = 0.5; t < duration; t += interval) {
        sampleTimes.push(t)
      }

      const frameData: { time: number; dataUrl: string; score: number }[] = []
      let sampleIndex = 0

      const processFrame = () => {
        if (sampleIndex >= sampleTimes.length) {
          // All frames processed — sort by score, take top N
          frameData.sort((a, b) => b.score - a.score)
          const topFrames = frameData.slice(0, maxFrames)

          URL.revokeObjectURL(url)

          resolve({
            frames: topFrames.map((f) => f.dataUrl),
            bestFrameIndex: 0, // already sorted, first is best
            scores: topFrames.map((f) => f.score),
          })
          return
        }

        video.currentTime = sampleTimes[sampleIndex]
      }

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        const sharpness = calculateSharpness(imageData)
        const brightness = calculateBrightness(imageData)
        const score = sharpness * 0.7 + brightness * 0.3

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

        frameData.push({
          time: sampleTimes[sampleIndex],
          dataUrl,
          score,
        })

        sampleIndex++
        processFrame()
      }

      video.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Video processing error'))
      }

      processFrame()
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }
  })
}
