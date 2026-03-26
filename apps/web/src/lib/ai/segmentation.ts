// client-side only

/**
 * MobileSAM Segmentation — Segment Anything Model (mobile) for browser-based
 * tap-to-segment on ENT / dermatology / clinical images.
 *
 * Architecture:
 * - Image encoder: MobileViT (~28 MB ONNX) — runs once per image
 * - Mask decoder: Lightweight quantized (~8.8 MB ONNX) — runs per point prompt
 *
 * Models are fetched on-demand from public CDN URLs and cached via Cache API
 * (persistent across sessions). Falls back gracefully if models unavailable.
 */

import type { ModelLoadProgress } from './model-loader'

// ---------------------------------------------------------------------------
// CDN model URLs (public HuggingFace Spaces / GitHub — no auth required)
// ---------------------------------------------------------------------------
const SAM_ENCODER_URL =
  'https://huggingface.co/spaces/Akbartus/projects/resolve/main/mobilesam.encoder.onnx'
const SAM_DECODER_URL =
  'https://github.com/akbartus/MobileSAM-in-the-Browser/raw/main/models/mobilesam.decoder.quant.onnx'

const MODEL_CACHE_NAME = 'zpediscreen-ai-models-v1'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SegmentationPoint {
  x: number  // pixel coordinate in the *displayed* image
  y: number  // pixel coordinate in the *displayed* image
  label: 1 | 0  // 1 = foreground, 0 = background
}

export interface SegmentationResult {
  mask: Uint8Array        // binary mask (0 or 255) at original resolution
  maskWidth: number
  maskHeight: number
  maskDataUrl: string     // PNG data URL of the mask overlay
  outlineDataUrl: string  // PNG data URL of the mask outline
  area: number            // percentage of image covered by mask
  inferenceTimeMs: number
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let encoderSession: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let decoderSession: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedEmbedding: { imageKey: string; data: any } | null = null
let cachedImageSize: { w: number; h: number } | null = null

// ---------------------------------------------------------------------------
// Model download with Cache API persistence + progress tracking
// ---------------------------------------------------------------------------
async function fetchModelBytes(
  url: string,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<ArrayBuffer> {
  // Try Cache API first
  try {
    const cache = await caches.open(MODEL_CACHE_NAME)
    const cached = await cache.match(url)
    if (cached) {
      const buf = await cached.arrayBuffer()
      onProgress?.({ loaded: buf.byteLength, total: buf.byteLength, percent: 100 })
      return buf
    }
  } catch { /* cache not available */ }

  // Network fetch with progress
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Model download failed: ${resp.status} ${resp.statusText}`)

  const total = parseInt(resp.headers.get('content-length') || '0', 10)
  const reader = resp.body?.getReader()
  if (!reader) {
    const buf = await resp.arrayBuffer()
    onProgress?.({ loaded: buf.byteLength, total: buf.byteLength, percent: 100 })
    return buf
  }

  const chunks: Uint8Array[] = []
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress?.({ loaded, total: total || loaded, percent: total ? Math.round((loaded / total) * 100) : 0 })
  }

  const combined = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length }

  // Persist in Cache API
  try {
    const cache = await caches.open(MODEL_CACHE_NAME)
    await cache.put(url, new Response(combined.buffer, {
      headers: { 'Content-Type': 'application/octet-stream' },
    }))
  } catch { /* cache write failed — model still works */ }

  return combined.buffer
}

// ---------------------------------------------------------------------------
// Load encoder / decoder sessions
// ---------------------------------------------------------------------------
async function getEncoderSession(onProgress?: (p: ModelLoadProgress) => void) {
  if (encoderSession) return encoderSession
  const ort = await import('onnxruntime-web')
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = true
  const bytes = await fetchModelBytes(SAM_ENCODER_URL, onProgress)
  encoderSession = await ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
  return encoderSession
}

async function getDecoderSession(onProgress?: (p: ModelLoadProgress) => void) {
  if (decoderSession) return decoderSession
  const ort = await import('onnxruntime-web')
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = true
  const bytes = await fetchModelBytes(SAM_DECODER_URL, onProgress)
  decoderSession = await ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
  return decoderSession
}

// ---------------------------------------------------------------------------
// Image → embedding (cached per image key)
// ---------------------------------------------------------------------------

/** Internal target size for SAM encoder input */
const ENCODER_W = 1024
const ENCODER_H = 684

async function encodeImage(
  imageBitmap: ImageBitmap,
  imageKey: string,
  onProgress?: (p: ModelLoadProgress) => void
) {
  if (cachedEmbedding && cachedEmbedding.imageKey === imageKey) {
    return cachedEmbedding.data
  }

  const ort = await import('onnxruntime-web')
  const session = await getEncoderSession(onProgress)

  // Resize image to encoder input size via offscreen canvas
  const canvas = document.createElement('canvas')
  canvas.width = ENCODER_W
  canvas.height = ENCODER_H
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imageBitmap, 0, 0, ENCODER_W, ENCODER_H)
  const imageData = ctx.getImageData(0, 0, ENCODER_W, ENCODER_H)

  // Create tensor via ort.Tensor.fromImage (RGB uint8, shape [1, 3, H, W])
  const inputTensor = await ort.Tensor.fromImage(imageData)
  const feeds: Record<string, unknown> = { input_image: inputTensor }
  const results = await session.run(feeds)
  const embedding = results.image_embeddings

  cachedEmbedding = { imageKey, data: embedding }
  cachedImageSize = { w: ENCODER_W, h: ENCODER_H }
  return embedding
}

// ---------------------------------------------------------------------------
// Decode mask from embedding + point prompt
// ---------------------------------------------------------------------------
async function decodeMask(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  embedding: any,
  points: SegmentationPoint[],
  displayWidth: number,
  displayHeight: number,
) {
  const ort = await import('onnxruntime-web')
  const session = await getDecoderSession()

  // Scale tap coords from display-space → encoder-space (1024x684)
  const scaleX = ENCODER_W / displayWidth
  const scaleY = ENCODER_H / displayHeight

  // Build point_coords and point_labels tensors
  // MobileSAM decoder expects N+1 points (extra padding point with label -1)
  const nPts = points.length
  const coordsArr = new Float32Array((nPts + 1) * 2)
  const labelsArr = new Float32Array(nPts + 1)

  for (let i = 0; i < nPts; i++) {
    coordsArr[i * 2] = points[i].x * scaleX
    coordsArr[i * 2 + 1] = points[i].y * scaleY
    labelsArr[i] = points[i].label
  }
  // Padding point
  coordsArr[nPts * 2] = 0
  coordsArr[nPts * 2 + 1] = 0
  labelsArr[nPts] = -1

  const pointCoords = new ort.Tensor('float32', coordsArr, [1, nPts + 1, 2])
  const pointLabels = new ort.Tensor('float32', labelsArr, [1, nPts + 1])
  const maskInput = new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256])
  const hasMask = new ort.Tensor('float32', new Float32Array([0]), [1])
  const origImSize = new ort.Tensor('float32', new Float32Array([ENCODER_H, ENCODER_W]), [2])

  const feeds = {
    image_embeddings: embedding,
    point_coords: pointCoords,
    point_labels: pointLabels,
    mask_input: maskInput,
    has_mask_input: hasMask,
    orig_im_size: origImSize,
  }

  const results = await session.run(feeds)
  const maskTensor = results.masks
  return maskTensor
}

// ---------------------------------------------------------------------------
// Mask post-processing: threshold → binary, overlay + outline rendering
// ---------------------------------------------------------------------------

function maskToOverlay(
  binaryMask: Uint8Array,
  width: number,
  height: number,
  color: [number, number, number] = [59, 130, 246]
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(width, height)

  for (let i = 0; i < binaryMask.length; i++) {
    const alpha = binaryMask[i] > 127 ? 100 : 0
    imgData.data[i * 4] = color[0]
    imgData.data[i * 4 + 1] = color[1]
    imgData.data[i * 4 + 2] = color[2]
    imgData.data[i * 4 + 3] = alpha
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL('image/png')
}

function maskToOutline(
  binaryMask: Uint8Array,
  width: number,
  height: number,
  color: [number, number, number] = [59, 130, 246],
  lineWidth: number = 2
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Find edge pixels: mask pixel with at least one non-mask neighbour
  const edgeData = ctx.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (binaryMask[idx] <= 127) continue

      // Check 4-connected neighbours
      const isEdge =
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        binaryMask[idx - 1] <= 127 ||
        binaryMask[idx + 1] <= 127 ||
        binaryMask[idx - width] <= 127 ||
        binaryMask[idx + width] <= 127

      if (isEdge) {
        const p = idx * 4
        edgeData.data[p] = color[0]
        edgeData.data[p + 1] = color[1]
        edgeData.data[p + 2] = color[2]
        edgeData.data[p + 3] = 255
      }
    }
  }
  ctx.putImageData(edgeData, 0, 0)

  // Thicken the outline by drawing the edge image at slight offsets
  if (lineWidth > 1) {
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = width
    tmpCanvas.height = height
    const tmpCtx = tmpCanvas.getContext('2d')!
    tmpCtx.putImageData(edgeData, 0, 0)

    ctx.clearRect(0, 0, width, height)
    const half = Math.floor(lineWidth / 2)
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        ctx.drawImage(tmpCanvas, dx, dy)
      }
    }
  }

  return canvas.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run MobileSAM segmentation with point prompts.
 *
 * @param imageSource - base64 data URL or object URL of the image
 * @param points - click/tap coordinates in *display* pixel space
 * @param imageKey - unique key for embedding caching (e.g. observation ID)
 * @param displaySize - { width, height } of the displayed image element
 * @param onProgress - model download progress callback
 */
export async function segmentWithPoints(
  imageSource: string,
  points: SegmentationPoint[],
  imageKey: string,
  displaySize: { width: number; height: number },
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<SegmentationResult | null> {
  if (points.length === 0) return null
  const startTime = performance.now()

  try {
    // Load image as ImageBitmap
    const resp = await fetch(imageSource)
    const blob = await resp.blob()
    const bitmap = await createImageBitmap(blob)

    // Step 1: Encode image (cached per imageKey)
    const embedding = await encodeImage(bitmap, imageKey, onProgress)
    if (!embedding) return null

    // Step 2: Decode mask from points
    const maskTensor = await decodeMask(embedding, points, displaySize.width, displaySize.height)
    if (!maskTensor) return null

    // Step 3: Convert mask tensor to ImageData, then extract binary mask
    const maskImageData = maskTensor.toImageData()
    const w = maskImageData.width
    const h = maskImageData.height
    const pixels = maskImageData.data // RGBA

    // Extract binary mask from alpha or red channel
    const binaryMask = new Uint8Array(w * h)
    let maskArea = 0
    for (let i = 0; i < w * h; i++) {
      // The mask output is a grayscale image; check red channel
      if (pixels[i * 4] > 127) {
        binaryMask[i] = 255
        maskArea++
      }
    }

    const area = Math.round((maskArea / (w * h)) * 1000) / 10

    // Step 4: Generate overlay + outline at display resolution
    const maskDataUrl = maskToOverlay(binaryMask, w, h)
    const outlineDataUrl = maskToOutline(binaryMask, w, h)

    return {
      mask: binaryMask,
      maskWidth: w,
      maskHeight: h,
      maskDataUrl,
      outlineDataUrl,
      area,
      inferenceTimeMs: Math.round(performance.now() - startTime),
    }
  } catch (err) {
    console.error('[MobileSAM] Segmentation failed:', err)
    return null
  }
}

/**
 * Clear the cached image embedding (e.g., when switching to a different image).
 */
export function clearEmbeddingCache(): void {
  cachedEmbedding = null
  cachedImageSize = null
}

/**
 * Check if MobileSAM models are already cached in Cache API.
 */
export async function isSAMAvailable(): Promise<boolean> {
  try {
    const cache = await caches.open(MODEL_CACHE_NAME)
    const [enc, dec] = await Promise.all([
      cache.match(SAM_ENCODER_URL),
      cache.match(SAM_DECODER_URL),
    ])
    return !!enc && !!dec
  } catch {
    return false
  }
}

/**
 * Pre-download both models (e.g. from a settings page). Returns when both are cached.
 */
export async function preloadSAMModels(
  onProgress?: (progress: ModelLoadProgress & { model: 'encoder' | 'decoder' }) => void
): Promise<boolean> {
  try {
    await getEncoderSession(onProgress ? (p) => onProgress({ ...p, model: 'encoder' }) : undefined)
    await getDecoderSession(onProgress ? (p) => onProgress({ ...p, model: 'decoder' }) : undefined)
    return true
  } catch (err) {
    console.error('[MobileSAM] Preload failed:', err)
    return false
  }
}
