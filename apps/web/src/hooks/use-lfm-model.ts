// client-side hook

/**
 * useLFMModel — Shared singleton hook for LFM2.5-VL-1.6B model
 *
 * The model downloads ONCE, caches in browser IndexedDB/Cache API,
 * and is shared across all screening modules.
 *
 * Architecture:
 *   1 model (LFM2.5-VL-1.6B) + module-specific prompts = module-specific output
 */

import { useState, useEffect, useCallback, useRef } from 'react'

export type ModelStatus = 'idle' | 'checking' | 'loading' | 'ready' | 'error' | 'unsupported'

interface LFMModelState {
  status: ModelStatus
  progress: number
  statusText: string
  cacheSize: string | null
  gpuInfo: string | null
}

interface LFMModelActions {
  loadModel: () => Promise<void>
  generate: (imageBase64: string, prompt: string, options?: GenerateOptions) => Promise<string>
  isReady: boolean
}

interface GenerateOptions {
  maxNewTokens?: number
  onToken?: (token: string) => void
  /** Max time in ms before auto-cancelling (default: 30000). Prevents UI hanging. */
  timeoutMs?: number
}

// Global singleton - model loaded once, shared across all components
let globalInferModule: any = null
let globalModelLoaded = false
let globalModelLoading = false
let loadPromise: Promise<void> | null = null

async function getInferModule() {
  if (!globalInferModule) {
    try {
      // Try without .js extension first (webpack-compatible)
      globalInferModule = await import('@/lib/ai/webgpu/infer')
    } catch {
      throw new Error('WebGPU inference module not available')
    }
  }
  return globalInferModule
}

export function useLFMModel(): [LFMModelState, LFMModelActions] {
  const [status, setStatus] = useState<ModelStatus>(globalModelLoaded ? 'ready' : 'idle')
  const [progress, setProgress] = useState(globalModelLoaded ? 100 : 0)
  const [statusText, setStatusText] = useState(globalModelLoaded ? 'Ready' : '')
  const [cacheSize, setCacheSize] = useState<string | null>(null)
  const [gpuInfo, setGpuInfo] = useState<string | null>(null)

  // Check WebGPU support + auto-load from cache on mount
  useEffect(() => {
    if (globalModelLoaded) {
      setStatus('ready')
      setProgress(100)
      setStatusText('Ready')
      return
    }

    (async () => {
      // Check WebGPU
      const nav = navigator as any
      if (!nav.gpu) {
        setStatus('unsupported')
        setStatusText('WebGPU not supported in this browser')
        return
      }

      try {
        const adapter = await nav.gpu.requestAdapter()
        const info = (adapter as any)?.info || {}
        setGpuInfo(info.description || info.vendor || info.architecture || 'WebGPU')
      } catch {
        setGpuInfo(null)
      }

      // Check if model is cached
      setStatus('checking')
      try {
        const infer = await getInferModule()
        const info = await infer.getCacheInfo()
        if (info && info.used > 500 * 1024 * 1024) {
          setCacheSize(`${(info.used / 1024 / 1024 / 1024).toFixed(1)} GB cached`)
          // Auto-load from cache
          await loadModelInternal(setStatus, setProgress, setStatusText, setCacheSize)
        } else {
          setStatus('idle')
        }
      } catch {
        setStatus('idle')
      }
    })()
  }, [])

  const loadModel = useCallback(async () => {
    await loadModelInternal(setStatus, setProgress, setStatusText, setCacheSize)
  }, [])

  const generate = useCallback(async (imageBase64: string, prompt: string, options?: GenerateOptions): Promise<string> => {
    if (!globalModelLoaded) throw new Error('Model not loaded')
    const infer = await getInferModule()
    infer.clearImageCache?.()

    let fullText = ''
    const TIMEOUT_MS = options?.timeoutMs || 30000 // 30s max — never hang the UI

    // Race between inference and timeout
    const inferPromise = infer.generate([
      { role: 'user', content: [{ type: 'image', value: imageBase64 }, { type: 'text', value: prompt }] }
    ], {
      maxNewTokens: options?.maxNewTokens || 256,
      onToken: (token: string) => {
        fullText += token
        options?.onToken?.(token)
      }
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timed out (30s). Try a simpler image or shorter prompt.')), TIMEOUT_MS)
    })

    try {
      await Promise.race([inferPromise, timeoutPromise])
    } catch (e: any) {
      // If we got partial text before timeout, return what we have
      if (fullText.length > 10) return fullText + '\n[Analysis truncated due to timeout]'
      throw e
    }

    return fullText
  }, [])

  return [
    { status, progress, statusText, cacheSize, gpuInfo },
    { loadModel, generate, isReady: status === 'ready' }
  ]
}

// Internal load function (prevents duplicate loads)
async function loadModelInternal(
  setStatus: (s: ModelStatus) => void,
  setProgress: (p: number) => void,
  setStatusText: (t: string) => void,
  setCacheSize: (s: string | null) => void
) {
  if (globalModelLoaded) { setStatus('ready'); return }
  if (globalModelLoading && loadPromise) { await loadPromise; setStatus('ready'); return }

  globalModelLoading = true
  setStatus('loading')
  setProgress(0)
  setStatusText('Initializing...')

  loadPromise = (async () => {
    try {
      const infer = await getInferModule()
      await infer.loadModel('LFM2.5-VL-1.6B-merge-linear-Q4-Q4', {
        progressCallback: (p: any) => {
          if (p.status === 'loading') {
            setProgress(Math.round(p.progress || 0))
            setStatusText(p.file ? `${p.file.split('/').pop()}` : 'Loading...')
          } else if (p.status === 'done') {
            setProgress(100)
          }
        }
      })
      globalModelLoaded = true
      setStatus('ready')
      setStatusText('Ready')

      const info = await infer.getCacheInfo()
      if (info) setCacheSize(`${(info.used / 1024 / 1024 / 1024).toFixed(1)} GB cached`)
    } catch (e: any) {
      setStatus('error')
      setStatusText(e.message)
      throw e
    } finally {
      globalModelLoading = false
    }
  })()

  await loadPromise
}
