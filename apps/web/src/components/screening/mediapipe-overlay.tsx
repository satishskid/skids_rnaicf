
/**
 * MediaPipeOverlay — Canvas overlay that draws landmarks and computes metrics
 *
 * Usage:
 *   <MediaPipeOverlay
 *     videoRef={videoRef}
 *     tasks={['pose', 'face', 'hand']}
 *     onMetrics={callback}
 *   />
 */

import React, { useRef, useEffect, useCallback, useState } from 'react'
import {
  useMediaPipePose,
  useMediaPipeFace,
  useMediaPipeHand,
  DrawingUtils,
  PoseLandmarker,
  FaceLandmarker,
  HandLandmarker,
  type PoseLandmarkerResult,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from '@/hooks/use-mediapipe'
import {
  computeGaitSymmetry,
  computeBalance,
  computeShoulderLevel,
  computeSpineAlignment,
  computeKneeAngle,
  computeEyeContact,
  computeEyeContactDuration,
  computeMouthOpen,
  detectHandFlapping,
  type GaitSymmetryResult,
  type BalanceResult,
  type ShoulderLevelResult,
  type SpineAlignmentResult,
  type KneeAngleResult,
  type EyeContactResult,
  type EyeContactDurationResult,
  type MouthOpenResult,
  type HandFlappingResult,
} from '@/lib/ai/mediapipe-metrics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type MediaPipeTask = 'pose' | 'face' | 'hand'

export interface MediaPipeMetrics {
  pose?: {
    shoulderLevel: ShoulderLevelResult
    spineAlignment: SpineAlignmentResult
    leftKnee: KneeAngleResult
    rightKnee: KneeAngleResult
    gaitSymmetry: GaitSymmetryResult
    balance: BalanceResult
  }
  face?: {
    eyeContact: EyeContactResult
    eyeContactDuration: EyeContactDurationResult
    mouthOpen: MouthOpenResult
  }
  hand?: {
    flapping: HandFlappingResult
  }
}

interface MediaPipeOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>
  tasks: MediaPipeTask[]
  onMetrics?: (metrics: MediaPipeMetrics) => void
  /** Show numeric metrics on the overlay. Default: true */
  showMetrics?: boolean
  /** Width override (defaults to video width) */
  width?: number
  /** Height override (defaults to video height) */
  height?: number
}

// ---------------------------------------------------------------------------
// Drawing colors
// ---------------------------------------------------------------------------
const POSE_COLOR = '#00FF00'
const POSE_LINE_COLOR = '#00CC00'
const FACE_COLOR = '#00FFFF'
const HAND_COLOR = '#FFFF00'
const TEXT_BG = 'rgba(0, 0, 0, 0.6)'
const TEXT_COLOR = '#FFFFFF'

// History buffer size for temporal metrics
const HISTORY_SIZE = 90 // ~3 seconds at 30fps

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MediaPipeOverlay({
  videoRef,
  tasks,
  onMetrics,
  showMetrics = true,
  width,
  height,
}: MediaPipeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const lastTimestampRef = useRef(0)
  const onMetricsRef = useRef(onMetrics)
  onMetricsRef.current = onMetrics

  // History buffers for temporal metrics
  const poseHistoryRef = useRef<NormalizedLandmark[][]>([])
  const faceHistoryRef = useRef<NormalizedLandmark[][]>([])
  const handHistoryRef = useRef<NormalizedLandmark[][]>([])
  const timestampHistoryRef = useRef<number[]>([])

  // Latest results for drawing
  const latestPoseRef = useRef<PoseLandmarkerResult | null>(null)
  const latestFaceRef = useRef<FaceLandmarkerResult | null>(null)
  const latestHandRef = useRef<HandLandmarkerResult | null>(null)
  const latestMetricsRef = useRef<MediaPipeMetrics>({})

  // Determine which tasks to load
  const usePose = tasks.includes('pose')
  const useFace = tasks.includes('face')
  const useHand = tasks.includes('hand')

  // Pose callbacks
  const onPoseResult = useCallback((result: PoseLandmarkerResult) => {
    latestPoseRef.current = result
    if (result.landmarks?.[0]) {
      const history = poseHistoryRef.current
      history.push(result.landmarks[0])
      if (history.length > HISTORY_SIZE) history.shift()
    }
  }, [])

  const onFaceResult = useCallback((result: FaceLandmarkerResult) => {
    latestFaceRef.current = result
    if (result.faceLandmarks?.[0]) {
      const history = faceHistoryRef.current
      history.push(result.faceLandmarks[0])
      if (history.length > HISTORY_SIZE) history.shift()
      timestampHistoryRef.current.push(performance.now())
      if (timestampHistoryRef.current.length > HISTORY_SIZE) timestampHistoryRef.current.shift()
    }
  }, [])

  const onHandResult = useCallback((result: HandLandmarkerResult) => {
    latestHandRef.current = result
    if (result.landmarks?.[0]) {
      const history = handHistoryRef.current
      history.push(result.landmarks[0])
      if (history.length > HISTORY_SIZE) history.shift()
    }
  }, [])

  // Hook up MediaPipe tasks
  const [poseState, poseActions] = useMediaPipePose(usePose ? onPoseResult : undefined)
  const [faceState, faceActions] = useMediaPipeFace(useFace ? onFaceResult : undefined)
  const [handState, handActions] = useMediaPipeHand(useHand ? onHandResult : undefined)

  // Animation loop: detect + draw
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const tick = () => {
      if (!running) return

      const now = performance.now()
      // Throttle to ~30fps to avoid overloading
      if (now - lastTimestampRef.current < 33) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      if (video.readyState >= 2 && video.videoWidth > 0) {
        const ts = Math.round(now)

        // Run detection
        if (usePose && poseState.status === 'ready') poseActions.detectPose(video, ts)
        if (useFace && faceState.status === 'ready') faceActions.detectFace(video, ts + 1)
        if (useHand && handState.status === 'ready') handActions.detectHand(video, ts + 2)

        // Sync canvas size
        const w = width ?? video.videoWidth
        const h = height ?? video.videoHeight
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }

        // Clear and draw
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const drawUtils = new DrawingUtils(ctx)

        // Draw pose
        if (latestPoseRef.current?.landmarks?.[0]) {
          const landmarks = latestPoseRef.current.landmarks[0]
          drawUtils.drawLandmarks(landmarks, {
            color: POSE_COLOR,
            lineWidth: 1,
            radius: 3,
          })
          drawUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
            color: POSE_LINE_COLOR,
            lineWidth: 2,
          })
        }

        // Draw face
        if (latestFaceRef.current?.faceLandmarks?.[0]) {
          const landmarks = latestFaceRef.current.faceLandmarks[0]
          drawUtils.drawLandmarks(landmarks, {
            color: FACE_COLOR,
            lineWidth: 0.5,
            radius: 0.8,
          })
          drawUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
            color: 'rgba(0, 255, 255, 0.15)',
            lineWidth: 0.5,
          })
          drawUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
            color: FACE_COLOR,
            lineWidth: 1,
          })
        }

        // Draw hands
        if (latestHandRef.current?.landmarks) {
          for (const handLandmarks of latestHandRef.current.landmarks) {
            drawUtils.drawLandmarks(handLandmarks, {
              color: HAND_COLOR,
              lineWidth: 1,
              radius: 3,
            })
            drawUtils.drawConnectors(handLandmarks, HandLandmarker.HAND_CONNECTIONS, {
              color: HAND_COLOR,
              lineWidth: 2,
            })
          }
        }

        // Compute and display metrics
        const metrics: MediaPipeMetrics = {}

        if (usePose && latestPoseRef.current?.landmarks?.[0]) {
          const lm = latestPoseRef.current.landmarks[0]
          metrics.pose = {
            shoulderLevel: computeShoulderLevel(lm),
            spineAlignment: computeSpineAlignment(lm),
            leftKnee: computeKneeAngle(lm, 'left'),
            rightKnee: computeKneeAngle(lm, 'right'),
            gaitSymmetry: computeGaitSymmetry(poseHistoryRef.current),
            balance: computeBalance(poseHistoryRef.current),
          }
        }

        if (useFace && latestFaceRef.current?.faceLandmarks?.[0]) {
          const lm = latestFaceRef.current.faceLandmarks[0]
          metrics.face = {
            eyeContact: computeEyeContact(lm),
            eyeContactDuration: computeEyeContactDuration(
              faceHistoryRef.current,
              timestampHistoryRef.current
            ),
            mouthOpen: computeMouthOpen(lm),
          }
        }

        if (useHand && handHistoryRef.current.length > 0) {
          metrics.hand = {
            flapping: detectHandFlapping(
              handHistoryRef.current,
              timestampHistoryRef.current
            ),
          }
        }

        latestMetricsRef.current = metrics
        onMetricsRef.current?.(metrics)

        // Draw metrics text overlay
        if (showMetrics) {
          drawMetricsOverlay(ctx, metrics, canvas.width, canvas.height)
        }

        lastTimestampRef.current = now
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [
    videoRef, usePose, useFace, useHand,
    poseState.status, faceState.status, handState.status,
    poseActions, faceActions, handActions,
    showMetrics, width, height,
  ])

  // Loading state
  const isLoading =
    (usePose && poseState.status === 'loading') ||
    (useFace && faceState.status === 'loading') ||
    (useHand && handState.status === 'loading')

  const hasError =
    (usePose && poseState.status === 'error') ||
    (useFace && faceState.status === 'error') ||
    (useHand && handState.status === 'error')

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: TEXT_BG,
            color: TEXT_COLOR,
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            zIndex: 11,
          }}
        >
          Loading MediaPipe models...
        </div>
      )}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(255,0,0,0.7)',
            color: TEXT_COLOR,
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            zIndex: 11,
          }}
        >
          MediaPipe error:{' '}
          {poseState.error || faceState.error || handState.error}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metrics overlay renderer
// ---------------------------------------------------------------------------
function drawMetricsOverlay(
  ctx: CanvasRenderingContext2D,
  metrics: MediaPipeMetrics,
  canvasWidth: number,
  _canvasHeight: number
) {
  const lines: string[] = []

  if (metrics.pose) {
    const p = metrics.pose
    lines.push(`Shoulder tilt: ${p.shoulderLevel.tiltAngleDeg.toFixed(1)} deg${p.shoulderLevel.isAsymmetric ? ' [!]' : ''}`)
    lines.push(`Spine dev: ${p.spineAlignment.deviationAngleDeg.toFixed(1)} deg${p.spineAlignment.possibleScoliosis ? ' [!]' : ''}`)
    lines.push(`L knee: ${p.leftKnee.angleDeg.toFixed(0)} deg (${p.leftKnee.classification})`)
    lines.push(`R knee: ${p.rightKnee.angleDeg.toFixed(0)} deg (${p.rightKnee.classification})`)
    lines.push(`Gait sym: ${((1 - p.gaitSymmetry.asymmetryIndex) * 100).toFixed(0)}%`)
    lines.push(`Balance: ${(p.balance.balanceIndex * 100).toFixed(0)}%`)
  }

  if (metrics.face) {
    const f = metrics.face
    lines.push(`Eye contact: ${f.eyeContact.isLookingAtCamera ? 'YES' : 'no'} (${f.eyeContactDuration.contactPercentage.toFixed(0)}%)`)
    lines.push(`Mouth: ${f.mouthOpen.isOpen ? 'OPEN' : 'closed'} (${(f.mouthOpen.apertureRatio * 100).toFixed(0)}%)`)
  }

  if (metrics.hand) {
    const h = metrics.hand
    if (h.flapping.detected) {
      lines.push(`Flapping: YES ${h.flapping.frequencyHz} Hz (conf ${(h.flapping.confidence * 100).toFixed(0)}%)`)
    }
  }

  if (lines.length === 0) return

  // Draw text panel in top-right corner
  ctx.save()
  const fontSize = 13
  const lineHeight = 18
  const padding = 8
  const panelWidth = 260
  const panelHeight = lines.length * lineHeight + padding * 2
  const panelX = canvasWidth - panelWidth - 8
  const panelY = 8

  ctx.fillStyle = TEXT_BG
  ctx.beginPath()
  ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 6)
  ctx.fill()

  ctx.font = `${fontSize}px monospace`
  ctx.fillStyle = TEXT_COLOR
  ctx.textBaseline = 'top'

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], panelX + padding, panelY + padding + i * lineHeight)
  }

  ctx.restore()
}

export default MediaPipeOverlay
