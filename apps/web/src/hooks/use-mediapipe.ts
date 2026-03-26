// client-side hook

/**
 * useMediaPipe — Shared singleton hooks for MediaPipe vision tasks
 *
 * Architecture mirrors useLFMModel: tasks are created lazily, cached as
 * global singletons, and shared across all components that use them.
 *
 * Exports:
 *   useMediaPipePose()  — 33-point body pose landmarks
 *   useMediaPipeFace()  — 478-point face mesh landmarks
 *   useMediaPipeHand()  — 21-point hand landmarks (per hand)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PoseLandmarker,
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
  type PoseLandmarkerResult,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

// Re-export types for consumers
export type { PoseLandmarkerResult, FaceLandmarkerResult, HandLandmarkerResult, NormalizedLandmark }

// ---------------------------------------------------------------------------
// CDN paths
// ---------------------------------------------------------------------------
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
const MODEL_CDN = 'https://storage.googleapis.com/mediapipe-models'

const POSE_MODEL = `${MODEL_CDN}/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`
const FACE_MODEL = `${MODEL_CDN}/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`
const HAND_MODEL = `${MODEL_CDN}/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type MediaPipeStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface MediaPipeTaskState {
  status: MediaPipeStatus
  error: string | null
}

export interface MediaPipePoseActions {
  detectPose: (video: HTMLVideoElement, timestampMs: number) => void
}

export interface MediaPipeFaceActions {
  detectFace: (video: HTMLVideoElement, timestampMs: number) => void
}

export interface MediaPipeHandActions {
  detectHand: (video: HTMLVideoElement, timestampMs: number) => void
}

// ---------------------------------------------------------------------------
// Global singletons — created once, shared across all hook consumers
// ---------------------------------------------------------------------------
type WasmFilesetType = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>
let wasmFileset: WasmFilesetType | null = null
let wasmPromise: Promise<WasmFilesetType> | null = null

let poseLandmarker: PoseLandmarker | null = null
let posePromise: Promise<PoseLandmarker> | null = null

let faceLandmarker: FaceLandmarker | null = null
let facePromise: Promise<FaceLandmarker> | null = null

let handLandmarker: HandLandmarker | null = null
let handPromise: Promise<HandLandmarker> | null = null

// Callback registries — multiple components can subscribe to results
type PoseCallback = (result: PoseLandmarkerResult) => void
type FaceCallback = (result: FaceLandmarkerResult) => void
type HandCallback = (result: HandLandmarkerResult) => void

const poseCallbacks = new Set<PoseCallback>()
const faceCallbacks = new Set<FaceCallback>()
const handCallbacks = new Set<HandCallback>()

// ---------------------------------------------------------------------------
// WASM loader (shared across all tasks)
// ---------------------------------------------------------------------------
async function ensureWasm(): Promise<WasmFilesetType> {
  if (wasmFileset) return wasmFileset
  if (wasmPromise) return wasmPromise
  wasmPromise = FilesetResolver.forVisionTasks(WASM_CDN)
  wasmFileset = await wasmPromise
  return wasmFileset!
}

// ---------------------------------------------------------------------------
// Task factories
// ---------------------------------------------------------------------------
async function ensurePose(): Promise<PoseLandmarker> {
  if (poseLandmarker) return poseLandmarker
  if (posePromise) return posePromise
  posePromise = (async () => {
    const wasm = await ensureWasm()
    poseLandmarker = await PoseLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: POSE_MODEL,
        delegate: 'GPU',
      },
      runningMode: 'LIVE_STREAM' as any,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      resultListener: (result: PoseLandmarkerResult) => {
        poseCallbacks.forEach((cb) => cb(result))
      },
    } as any)
    return poseLandmarker
  })()
  return posePromise
}

async function ensureFace(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker
  if (facePromise) return facePromise
  facePromise = (async () => {
    const wasm = await ensureWasm()
    faceLandmarker = await FaceLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: FACE_MODEL,
        delegate: 'GPU',
      },
      runningMode: 'LIVE_STREAM' as any,
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
      resultListener: (result: FaceLandmarkerResult) => {
        faceCallbacks.forEach((cb) => cb(result))
      },
    } as any)
    return faceLandmarker
  })()
  return facePromise
}

async function ensureHand(): Promise<HandLandmarker> {
  if (handLandmarker) return handLandmarker
  if (handPromise) return handPromise
  handPromise = (async () => {
    const wasm = await ensureWasm()
    handLandmarker = await HandLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: HAND_MODEL,
        delegate: 'GPU' as any,
      },
      runningMode: 'LIVE_STREAM' as any,
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      resultListener: (result: HandLandmarkerResult) => {
        handCallbacks.forEach((cb) => cb(result))
      },
    } as any)
    return handLandmarker
  })()
  return handPromise
}

// ---------------------------------------------------------------------------
// useMediaPipePose
// ---------------------------------------------------------------------------
export function useMediaPipePose(
  onResult?: PoseCallback
): [MediaPipeTaskState, MediaPipePoseActions] {
  const [status, setStatus] = useState<MediaPipeStatus>(poseLandmarker ? 'ready' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const callbackRef = useRef(onResult)
  callbackRef.current = onResult

  // Stable callback wrapper so the Set entry never changes
  const stableCallback = useCallback((r: PoseLandmarkerResult) => {
    callbackRef.current?.(r)
  }, [])

  useEffect(() => {
    poseCallbacks.add(stableCallback)
    return () => { poseCallbacks.delete(stableCallback) }
  }, [stableCallback])

  // Lazy-init on first use
  useEffect(() => {
    if (poseLandmarker) { setStatus('ready'); return }
    setStatus('loading')
    ensurePose()
      .then(() => setStatus('ready'))
      .catch((e) => {
        setStatus('error')
        setError(e?.message ?? 'Failed to load PoseLandmarker')
      })
  }, [])

  const detectPose = useCallback((video: HTMLVideoElement, timestampMs: number) => {
    if (!poseLandmarker) return
    try {
      poseLandmarker.detectForVideo(video, timestampMs)
    } catch {
      // Timestamp ordering errors are non-fatal in live streams
    }
  }, [])

  return [{ status, error }, { detectPose }]
}

// ---------------------------------------------------------------------------
// useMediaPipeFace
// ---------------------------------------------------------------------------
export function useMediaPipeFace(
  onResult?: FaceCallback
): [MediaPipeTaskState, MediaPipeFaceActions] {
  const [status, setStatus] = useState<MediaPipeStatus>(faceLandmarker ? 'ready' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const callbackRef = useRef(onResult)
  callbackRef.current = onResult

  const stableCallback = useCallback((r: FaceLandmarkerResult) => {
    callbackRef.current?.(r)
  }, [])

  useEffect(() => {
    faceCallbacks.add(stableCallback)
    return () => { faceCallbacks.delete(stableCallback) }
  }, [stableCallback])

  useEffect(() => {
    if (faceLandmarker) { setStatus('ready'); return }
    setStatus('loading')
    ensureFace()
      .then(() => setStatus('ready'))
      .catch((e) => {
        setStatus('error')
        setError(e?.message ?? 'Failed to load FaceLandmarker')
      })
  }, [])

  const detectFace = useCallback((video: HTMLVideoElement, timestampMs: number) => {
    if (!faceLandmarker) return
    try {
      faceLandmarker.detectForVideo(video, timestampMs)
    } catch {
      // Non-fatal
    }
  }, [])

  return [{ status, error }, { detectFace }]
}

// ---------------------------------------------------------------------------
// useMediaPipeHand
// ---------------------------------------------------------------------------
export function useMediaPipeHand(
  onResult?: HandCallback
): [MediaPipeTaskState, MediaPipeHandActions] {
  const [status, setStatus] = useState<MediaPipeStatus>(handLandmarker ? 'ready' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const callbackRef = useRef(onResult)
  callbackRef.current = onResult

  const stableCallback = useCallback((r: HandLandmarkerResult) => {
    callbackRef.current?.(r)
  }, [])

  useEffect(() => {
    handCallbacks.add(stableCallback)
    return () => { handCallbacks.delete(stableCallback) }
  }, [stableCallback])

  useEffect(() => {
    if (handLandmarker) { setStatus('ready'); return }
    setStatus('loading')
    ensureHand()
      .then(() => setStatus('ready'))
      .catch((e) => {
        setStatus('error')
        setError(e?.message ?? 'Failed to load HandLandmarker')
      })
  }, [])

  const detectHand = useCallback((video: HTMLVideoElement, timestampMs: number) => {
    if (!handLandmarker) return
    try {
      handLandmarker.detectForVideo(video, timestampMs)
    } catch {
      // Non-fatal
    }
  }, [])

  return [{ status, error }, { detectHand }]
}

// ---------------------------------------------------------------------------
// Utility: DrawingUtils re-export for overlay rendering
// ---------------------------------------------------------------------------
export { DrawingUtils, PoseLandmarker, FaceLandmarker, HandLandmarker }
