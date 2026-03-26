// client-side only

/**
 * ONNX Model Loader — Downloads, caches, and loads ONNX models for browser inference.
 *
 * - Lazy-loads models only when first needed
 * - Caches in Cache API (persistent across sessions, ~3.5-23 MB per model)
 * - Shows progress callback during first-time download
 * - Falls back gracefully if model load fails
 */

const MODEL_CACHE_NAME = 'zpediscreen-ai-models-v1'

export interface ModelLoadProgress {
  loaded: number
  total: number
  percent: number
}

interface CachedModel {
  session: unknown // ort.InferenceSession — typed as unknown to avoid SSR import issues
  inputName: string
  outputNames: string[]
}

const loadedModels = new Map<string, CachedModel>()

/**
 * Check if a model is already cached in Cache API.
 */
export async function isModelCached(modelUrl: string): Promise<boolean> {
  try {
    const cache = await caches.open(MODEL_CACHE_NAME)
    const response = await cache.match(modelUrl)
    return !!response
  } catch {
    return false
  }
}

/**
 * Download model bytes, using Cache API for persistence.
 * Returns ArrayBuffer of the ONNX model.
 */
async function fetchModelBytes(
  modelUrl: string,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<ArrayBuffer> {
  // Check cache first
  try {
    const cache = await caches.open(MODEL_CACHE_NAME)
    const cached = await cache.match(modelUrl)
    if (cached) {
      const buffer = await cached.arrayBuffer()
      onProgress?.({ loaded: buffer.byteLength, total: buffer.byteLength, percent: 100 })
      return buffer
    }
  } catch {
    // Cache API not available, fall through to network
  }

  // Fetch from network with progress tracking
  const response = await fetch(modelUrl)
  if (!response.ok) {
    throw new Error(`Failed to download model: ${response.status} ${response.statusText}`)
  }

  const total = parseInt(response.headers.get('content-length') || '0', 10)
  const reader = response.body?.getReader()

  if (!reader) {
    const buffer = await response.arrayBuffer()
    onProgress?.({ loaded: buffer.byteLength, total: buffer.byteLength, percent: 100 })
    return buffer
  }

  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress?.({
      loaded,
      total: total || loaded,
      percent: total ? Math.round((loaded / total) * 100) : 0,
    })
  }

  // Combine chunks into single ArrayBuffer
  const combined = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }

  // Store in cache for next time
  try {
    const cache = await caches.open(MODEL_CACHE_NAME)
    const cacheResponse = new Response(combined.buffer, {
      headers: { 'Content-Type': 'application/octet-stream' },
    })
    await cache.put(modelUrl, cacheResponse)
  } catch {
    // Cache write failed — model still works, just won't be cached
  }

  return combined.buffer
}

/**
 * Load an ONNX model and create an InferenceSession.
 * Returns the session ready for inference, or null if loading fails.
 */
export async function loadModel(
  modelUrl: string,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<CachedModel | null> {
  // Check in-memory cache first
  const existing = loadedModels.get(modelUrl)
  if (existing) return existing

  try {
    // Dynamically import onnxruntime-web (avoids SSR issues)
    const ort = await import('onnxruntime-web')

    // Configure execution providers: WebGPU > WASM
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = true

    // Download model bytes
    const modelBytes = await fetchModelBytes(modelUrl, onProgress)

    // Create inference session
    const session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'], // WebGPU requires explicit opt-in, start with WASM for compatibility
      graphOptimizationLevel: 'all',
    })

    const inputName = session.inputNames[0]
    const outputNames = [...session.outputNames]

    const cached: CachedModel = { session, inputName, outputNames }
    loadedModels.set(modelUrl, cached)

    return cached
  } catch (err) {
    console.error('Failed to load ONNX model:', modelUrl, err)
    return null
  }
}

/**
 * Run inference on a loaded model.
 * Input: Float32Array of preprocessed image data (NCHW format).
 * Returns: Map of output name → Float32Array.
 */
export async function runInference(
  model: CachedModel,
  inputData: Float32Array,
  inputShape: number[]
): Promise<Map<string, Float32Array> | null> {
  try {
    const ort = await import('onnxruntime-web')

    const inputTensor = new ort.Tensor('float32', inputData, inputShape)
    const feeds: Record<string, unknown> = { [model.inputName]: inputTensor }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = model.session as any
    const results = await session.run(feeds)

    const outputs = new Map<string, Float32Array>()
    for (const name of model.outputNames) {
      const output = results[name]
      if (output && output.data) {
        outputs.set(name, new Float32Array(output.data as ArrayBuffer))
      }
    }

    return outputs
  } catch (err) {
    console.error('ONNX inference failed:', err)
    return null
  }
}

/**
 * Preprocess an image (from canvas ImageData) to ONNX model input format.
 * Resizes to targetSize × targetSize, normalizes to [0,1], converts to NCHW.
 */
export function preprocessImage(
  imageData: ImageData,
  targetSize: number = 224,
  mean: [number, number, number] = [0.485, 0.456, 0.406],
  std: [number, number, number] = [0.229, 0.224, 0.225]
): { data: Float32Array; shape: number[] } {
  // Create offscreen canvas for resize
  const canvas = document.createElement('canvas')
  canvas.width = targetSize
  canvas.height = targetSize
  const ctx = canvas.getContext('2d')!

  // Draw source image scaled to target size
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = imageData.width
  srcCanvas.height = imageData.height
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.putImageData(imageData, 0, 0)
  ctx.drawImage(srcCanvas, 0, 0, targetSize, targetSize)

  const resized = ctx.getImageData(0, 0, targetSize, targetSize)
  const pixels = resized.data // RGBA flat array

  // Convert to NCHW Float32 with ImageNet normalization
  const numPixels = targetSize * targetSize
  const float32 = new Float32Array(3 * numPixels)

  for (let i = 0; i < numPixels; i++) {
    const r = pixels[i * 4] / 255
    const g = pixels[i * 4 + 1] / 255
    const b = pixels[i * 4 + 2] / 255

    float32[i] = (r - mean[0]) / std[0]                    // R channel
    float32[numPixels + i] = (g - mean[1]) / std[1]        // G channel
    float32[2 * numPixels + i] = (b - mean[2]) / std[2]    // B channel
  }

  return { data: float32, shape: [1, 3, targetSize, targetSize] }
}

/**
 * Clear all cached models from Cache API.
 */
export async function clearModelCache(): Promise<void> {
  try {
    await caches.delete(MODEL_CACHE_NAME)
    loadedModels.clear()
  } catch {
    // Ignore cache deletion errors
  }
}

/**
 * Get total size of cached models.
 */
export async function getCachedModelSize(): Promise<number> {
  try {
    const cache = await caches.open(MODEL_CACHE_NAME)
    const keys = await cache.keys()
    let total = 0
    for (const key of keys) {
      const response = await cache.match(key)
      if (response) {
        const blob = await response.blob()
        total += blob.size
      }
    }
    return total
  } catch {
    return 0
  }
}
