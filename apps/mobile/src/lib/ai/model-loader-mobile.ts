/**
 * Mobile Model Loader — Downloads, caches, and loads ML models for on-device inference.
 *
 * Mirrors the web model-loader.ts pattern but uses:
 *   - expo-file-system for persistent caching (instead of Cache API)
 *   - onnxruntime-react-native for ONNX inference (when available)
 *   - Fallback to rule-based analysis if models unavailable
 *
 * Models can be:
 *   - Bundled as app assets (for critical models)
 *   - Lazy-downloaded from R2 on first use (for optional models)
 */

import * as FileSystemLegacy from 'expo-file-system/legacy'

const MODEL_CACHE_DIR = `${FileSystemLegacy.documentDirectory ?? ''}ai-models/`

export interface ModelLoadProgress {
  loaded: number
  total: number
  percent: number
}

export interface LoadedModel {
  path: string
  inputName: string
  outputNames: string[]
  session: unknown // ORT InferenceSession — typed as unknown to avoid hard dep
}

const loadedModels = new Map<string, LoadedModel>()

// ── Cache management ──

/** Ensure model cache directory exists. */
async function ensureCacheDir(): Promise<void> {
  const info = await FileSystemLegacy.getInfoAsync(MODEL_CACHE_DIR)
  if (!info.exists) {
    await FileSystemLegacy.makeDirectoryAsync(MODEL_CACHE_DIR, { intermediates: true })
  }
}

/** Get local file path for a model URL. */
function getModelCachePath(modelUrl: string): string {
  const filename = modelUrl.split('/').pop() || 'model.onnx'
  return `${MODEL_CACHE_DIR}${filename}`
}

/** Check if model is cached locally. */
export async function isModelCached(modelUrl: string): Promise<boolean> {
  const path = getModelCachePath(modelUrl)
  const info = await FileSystemLegacy.getInfoAsync(path)
  return info.exists
}

/** Download model to local cache with progress tracking. */
async function downloadModel(
  modelUrl: string,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<string> {
  await ensureCacheDir()
  const cachePath = getModelCachePath(modelUrl)

  // Check cache first
  const cached = await FileSystemLegacy.getInfoAsync(cachePath)
  if (cached.exists) {
    const size = (cached as { size?: number }).size ?? 0
    onProgress?.({ loaded: size, total: size, percent: 100 })
    return cachePath
  }

  // Download with progress
  const downloadResumable = FileSystemLegacy.createDownloadResumable(
    modelUrl,
    cachePath,
    {},
    (downloadProgress) => {
      const percent = downloadProgress.totalBytesExpectedToWrite > 0
        ? Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100)
        : 0
      onProgress?.({
        loaded: downloadProgress.totalBytesWritten,
        total: downloadProgress.totalBytesExpectedToWrite,
        percent,
      })
    }
  )

  const result = await downloadResumable.downloadAsync()
  if (!result?.uri) {
    throw new Error(`Failed to download model from ${modelUrl}`)
  }

  return result.uri
}

// ── Model loading ──

/**
 * Load an ONNX model for mobile inference.
 * Uses onnxruntime-react-native if available.
 */
export async function loadModel(
  modelUrl: string,
  onProgress?: (progress: ModelLoadProgress) => void
): Promise<LoadedModel | null> {
  const existing = loadedModels.get(modelUrl)
  if (existing) return existing

  try {
    const modelPath = await downloadModel(modelUrl, onProgress)

    // Try loading with ONNX Runtime for React Native
    let ort: typeof import('onnxruntime-react-native') | null = null
    try {
      ort = await import('onnxruntime-react-native')
    } catch {
      // onnxruntime-react-native not installed — return null
      console.warn('onnxruntime-react-native not available. ML model inference disabled.')
      return null
    }

    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    })

    const inputName = session.inputNames[0]
    const outputNames = [...session.outputNames]

    const loaded: LoadedModel = { path: modelPath, session, inputName, outputNames }
    loadedModels.set(modelUrl, loaded)
    return loaded
  } catch (err) {
    console.error('Failed to load model:', modelUrl, err)
    return null
  }
}

/**
 * Run inference on a loaded ONNX model.
 */
export async function runInference(
  model: LoadedModel,
  inputData: Float32Array,
  inputShape: number[]
): Promise<Map<string, Float32Array> | null> {
  try {
    const ort = await import('onnxruntime-react-native')

    const inputTensor = new ort.Tensor('float32', inputData, inputShape)
    const feeds: Record<string, unknown> = { [model.inputName]: inputTensor }

    const session = model.session as { run(feeds: Record<string, unknown>): Promise<Record<string, { data?: ArrayBufferLike }>> }
    const results = await session.run(feeds)

    const outputs = new Map<string, Float32Array>()
    for (const name of model.outputNames) {
      const output = results[name]
      if (output?.data) {
        outputs.set(name, new Float32Array(output.data as ArrayBuffer))
      }
    }

    return outputs
  } catch (err) {
    console.error('ONNX inference failed:', err)
    return null
  }
}

// ── Image preprocessing ──

/**
 * Preprocess RGBA pixel data to model input format (NCHW, normalized).
 * Same normalization as web model-loader for consistency.
 */
export function preprocessPixels(
  pixels: Uint8Array,
  width: number,
  height: number,
  targetSize: number = 224,
  mean: [number, number, number] = [0.485, 0.456, 0.406],
  std: [number, number, number] = [0.229, 0.224, 0.225]
): { data: Float32Array; shape: number[] } {
  // Simple nearest-neighbor resize
  const numPixels = targetSize * targetSize
  const float32 = new Float32Array(3 * numPixels)

  for (let ty = 0; ty < targetSize; ty++) {
    for (let tx = 0; tx < targetSize; tx++) {
      const sx = Math.floor((tx / targetSize) * width)
      const sy = Math.floor((ty / targetSize) * height)
      const srcIdx = (sy * width + sx) * 4
      const dstIdx = ty * targetSize + tx

      const r = (pixels[srcIdx] ?? 0) / 255
      const g = (pixels[srcIdx + 1] ?? 0) / 255
      const b = (pixels[srcIdx + 2] ?? 0) / 255

      // NCHW format: [1, 3, H, W]
      float32[dstIdx] = (r - mean[0]) / std[0]
      float32[numPixels + dstIdx] = (g - mean[1]) / std[1]
      float32[2 * numPixels + dstIdx] = (b - mean[2]) / std[2]
    }
  }

  return { data: float32, shape: [1, 3, targetSize, targetSize] }
}

// ── Cache utilities ──

/** Clear all cached models. */
export async function clearModelCache(): Promise<void> {
  try {
    await FileSystemLegacy.deleteAsync(MODEL_CACHE_DIR, { idempotent: true })
    loadedModels.clear()
  } catch {
    // Ignore deletion errors
  }
}

/** Get total size of cached models in bytes. */
export async function getCachedModelSize(): Promise<number> {
  try {
    const info = await FileSystemLegacy.getInfoAsync(MODEL_CACHE_DIR)
    if (!info.exists) return 0

    const files = await FileSystemLegacy.readDirectoryAsync(MODEL_CACHE_DIR)
    let total = 0
    for (const file of files) {
      const fileInfo = await FileSystemLegacy.getInfoAsync(`${MODEL_CACHE_DIR}${file}`)
      if (fileInfo.exists) {
        total += (fileInfo as { size?: number }).size ?? 0
      }
    }
    return total
  } catch {
    return 0
  }
}

/** List cached model files. */
export async function listCachedModels(): Promise<Array<{ name: string; size: number }>> {
  try {
    const info = await FileSystemLegacy.getInfoAsync(MODEL_CACHE_DIR)
    if (!info.exists) return []

    const files = await FileSystemLegacy.readDirectoryAsync(MODEL_CACHE_DIR)
    const models: Array<{ name: string; size: number }> = []
    for (const file of files) {
      const fileInfo = await FileSystemLegacy.getInfoAsync(`${MODEL_CACHE_DIR}${file}`)
      if (fileInfo.exists) {
        models.push({ name: file, size: (fileInfo as { size?: number }).size ?? 0 })
      }
    }
    return models
  } catch {
    return []
  }
}
