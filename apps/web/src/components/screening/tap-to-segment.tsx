
import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  segmentWithPoints,
  clearEmbeddingCache,
  isSAMAvailable,
  preloadSAMModels,
  type SegmentationPoint,
  type SegmentationResult,
} from '@/lib/ai/segmentation'
import type { ModelLoadProgress } from '@/lib/ai/model-loader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TapToSegmentProps {
  /** Base64 data URL or blob URL of the image to segment */
  imageBase64: string
  /** Called when a segmentation mask is generated */
  onSegmentComplete?: (mask: Uint8Array, outline: string, result: SegmentationResult) => void
  /** Optional unique key for embedding cache (defaults to hash of first 100 chars) */
  imageKey?: string
  /** Mask overlay color [R, G, B] 0-255 */
  maskColor?: [number, number, number]
  /** Additional class names on the root container */
  className?: string
}

type Status = 'idle' | 'loading-models' | 'encoding' | 'segmenting' | 'ready' | 'error'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function TapToSegment({
  imageBase64,
  onSegmentComplete,
  imageKey,
  maskColor = [59, 130, 246],
  className = '',
}: TapToSegmentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState<ModelLoadProgress | null>(null)
  const [modelsCached, setModelsCached] = useState<boolean | null>(null)

  // Points the user has tapped
  const [points, setPoints] = useState<SegmentationPoint[]>([])

  // Current segmentation result
  const [result, setResult] = useState<SegmentationResult | null>(null)

  // Display size of the rendered image (needed for coordinate mapping)
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null)

  // Foreground vs background mode
  const [mode, setMode] = useState<'foreground' | 'background'>('foreground')

  // Derive a stable image key
  const resolvedKey = imageKey || imageBase64.slice(0, 100)

  // -----------------------------------------------------------------------
  // Check if models are cached on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    isSAMAvailable().then(setModelsCached)
  }, [])

  // -----------------------------------------------------------------------
  // Clear state when image changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    setPoints([])
    setResult(null)
    setStatus('idle')
    setErrorMsg(null)
    clearEmbeddingCache()
  }, [imageBase64])

  // -----------------------------------------------------------------------
  // Track rendered image size
  // -----------------------------------------------------------------------
  const updateDisplaySize = useCallback(() => {
    if (imgRef.current) {
      setDisplaySize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      })
    }
  }, [])

  useEffect(() => {
    updateDisplaySize()
    window.addEventListener('resize', updateDisplaySize)
    return () => window.removeEventListener('resize', updateDisplaySize)
  }, [updateDisplaySize])

  // -----------------------------------------------------------------------
  // Handle tap / click on the image
  // -----------------------------------------------------------------------
  const handleImageClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (!imgRef.current || !displaySize) return
      if (status === 'loading-models' || status === 'encoding' || status === 'segmenting') return

      const rect = imgRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Clamp to image bounds
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return

      const newPoint: SegmentationPoint = {
        x,
        y,
        label: mode === 'foreground' ? 1 : 0,
      }

      const updatedPoints = [...points, newPoint]
      setPoints(updatedPoints)

      // Run segmentation
      setStatus('segmenting')
      setErrorMsg(null)

      try {
        const segResult = await segmentWithPoints(
          imageBase64,
          updatedPoints,
          resolvedKey,
          displaySize,
          (p) => {
            setProgress(p)
            setStatus('loading-models')
          }
        )

        if (segResult) {
          setResult(segResult)
          setStatus('ready')
          onSegmentComplete?.(segResult.mask, segResult.outlineDataUrl, segResult)
        } else {
          setStatus('error')
          setErrorMsg('Segmentation returned no result. The model may not have loaded correctly.')
        }
      } catch (err) {
        console.error('[TapToSegment]', err)
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Segmentation failed')
      }
    },
    [points, mode, displaySize, imageBase64, resolvedKey, onSegmentComplete]
  )

  // -----------------------------------------------------------------------
  // Preload models manually
  // -----------------------------------------------------------------------
  const handlePreload = useCallback(async () => {
    setStatus('loading-models')
    setErrorMsg(null)
    try {
      await preloadSAMModels((p) => setProgress(p))
      setModelsCached(true)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Model download failed')
    }
  }, [])

  // -----------------------------------------------------------------------
  // Undo last point
  // -----------------------------------------------------------------------
  const handleUndo = useCallback(() => {
    if (points.length === 0) return
    const newPts = points.slice(0, -1)
    setPoints(newPts)
    if (newPts.length === 0) {
      setResult(null)
      setStatus('idle')
    }
    // Note: re-running segmentation with fewer points could be done here,
    // but we keep it simple — user can tap again to regenerate
  }, [points])

  // -----------------------------------------------------------------------
  // Reset all
  // -----------------------------------------------------------------------
  const handleReset = useCallback(() => {
    setPoints([])
    setResult(null)
    setStatus('idle')
    setErrorMsg(null)
  }, [])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const isProcessing = status === 'loading-models' || status === 'encoding' || status === 'segmenting'

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={mode === 'foreground' ? 'default' : 'outline'}
          className="cursor-pointer select-none"
          onClick={() => setMode('foreground')}
        >
          + Foreground
        </Badge>
        <Badge
          variant={mode === 'background' ? 'destructive' : 'outline'}
          className="cursor-pointer select-none"
          onClick={() => setMode('background')}
        >
          - Background
        </Badge>

        <div className="flex-1" />

        {points.length > 0 && (
          <>
            <Button variant="ghost" size="sm" onClick={handleUndo} disabled={isProcessing}>
              Undo
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={isProcessing}>
              Reset
            </Button>
          </>
        )}

        {modelsCached === false && status === 'idle' && (
          <Button variant="outline" size="sm" onClick={handlePreload}>
            Download AI Models
          </Button>
        )}
      </div>

      {/* Image + overlay container */}
      <div
        ref={containerRef}
        className="relative select-none rounded-lg overflow-hidden border border-border bg-muted"
        style={{ cursor: isProcessing ? 'wait' : 'crosshair' }}
        onClick={handleImageClick}
      >
        {/* Source image */}
        <img
          ref={imgRef}
          src={imageBase64}
          alt="Tap to segment"
          className="w-full h-auto block"
          onLoad={updateDisplaySize}
          draggable={false}
        />

        {/* Mask overlay */}
        {result && (
          <img
            src={result.maskDataUrl}
            alt=""
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ mixBlendMode: 'normal' }}
            draggable={false}
          />
        )}

        {/* Outline overlay */}
        {result && (
          <img
            src={result.outlineDataUrl}
            alt=""
            className="absolute inset-0 w-full h-full pointer-events-none"
            draggable={false}
          />
        )}

        {/* Point markers */}
        {points.map((pt, i) => (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: pt.x - 6,
              top: pt.y - 6,
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid white',
              backgroundColor: pt.label === 1
                ? `rgb(${maskColor[0]}, ${maskColor[1]}, ${maskColor[2]})`
                : '#ef4444',
              boxShadow: '0 0 4px rgba(0,0,0,0.5)',
            }}
          />
        ))}

        {/* Processing spinner overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="bg-background/90 backdrop-blur rounded-lg px-4 py-3 flex flex-col items-center gap-2 shadow-lg">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">
                {status === 'loading-models'
                  ? `Downloading model${progress ? ` (${progress.percent}%)` : '...'}`
                  : 'Segmenting...'}
              </span>
              {progress && status === 'loading-models' && (
                <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {status === 'idle' && points.length === 0 && (
          <span>Tap on the image to segment a region</span>
        )}
        {status === 'ready' && result && (
          <span>
            Mask: {result.area}% of image | {result.inferenceTimeMs}ms
            {points.length > 0 && ` | ${points.length} point${points.length > 1 ? 's' : ''}`}
          </span>
        )}
        {status === 'error' && (
          <span className="text-destructive">{errorMsg || 'Segmentation failed'}</span>
        )}
      </div>
    </div>
  )
}
