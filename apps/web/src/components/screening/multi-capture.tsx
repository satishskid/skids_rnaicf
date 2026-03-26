
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Icons } from '@/components/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getUserMediaWithFallback } from '@/lib/camera-utils'
import { VideoCapture } from './video-capture'
import { type CaptureItem } from '@skids/shared'

export interface MultiCaptureConfig {
  maxPhotos: number              // e.g., 10 for skin, 4 for posture
  allowVideo: boolean            // enable video capture mode
  videoMaxDuration?: number      // seconds (default 15)
  cameraFacing: 'user' | 'environment'
  autoLabels?: string[]          // e.g., ["Lesion #1", "Lesion #2"] — auto-increment
  labelPrefix?: string           // e.g., "Lesion" → "Lesion #1", "Lesion #2"
  childName?: string
  moduleTitle: string
}

interface MultiCaptureProps {
  config: MultiCaptureConfig
  onComplete: (captures: CaptureItem[], videoFrames?: string[]) => void
  onBack: () => void
  /** Optional per-image AI analysis function */
  analyzeImage?: (imageData: ImageData) => Record<string, unknown> | null
}

type CaptureMode = 'choose' | 'photo' | 'video' | 'gallery'

export function MultiCapture({ config, onComplete, onBack, analyzeImage }: MultiCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>('choose')
  const [captures, setCaptures] = useState<CaptureItem[]>([])
  const [videoFrames, setVideoFrames] = useState<string[] | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await getUserMediaWithFallback(config.cameraFacing, { width: 1280, height: 720, exact: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      toast.error('Camera access denied')
    }
  }, [config.cameraFacing])

  const stopCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream
      stream?.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    if (mode === 'photo') startCamera()
    return () => { if (mode === 'photo') stopCamera() }
  }, [mode, startCamera])

  const getLabel = (index: number): string => {
    if (config.autoLabels && index < config.autoLabels.length) {
      return config.autoLabels[index]
    }
    if (config.labelPrefix) {
      return `${config.labelPrefix} #${index + 1}`
    }
    return `Photo #${index + 1}`
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)

    const imageDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85)

    let aiAnalysis: Record<string, unknown> | undefined
    if (analyzeImage) {
      const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
      const result = analyzeImage(imageData)
      if (result) aiAnalysis = result
    }

    const newCapture: CaptureItem = {
      id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      imageDataUrl,
      label: getLabel(captures.length),
      timestamp: new Date().toISOString(),
      aiAnalysis,
    }

    setCaptures(prev => [...prev, newCapture])

    if (captures.length + 1 >= config.maxPhotos) {
      stopCamera()
      setMode('gallery')
    }
  }

  const removeCapture = (id: string) => {
    setCaptures(prev => prev.filter(c => c.id !== id))
  }

  const retakeCapture = (id: string) => {
    setCaptures(prev => prev.filter(c => c.id !== id))
    if (mode !== 'photo') {
      setMode('photo')
    }
  }

  const handleVideoComplete = (frames: string[], bestFrame: string) => {
    setVideoFrames(frames)
    // Also create a capture item from the best frame
    const cap: CaptureItem = {
      id: `vid-${Date.now()}`,
      imageDataUrl: bestFrame,
      label: 'Video Best Frame',
      timestamp: new Date().toISOString(),
    }
    setCaptures(prev => [...prev, cap])
    setMode('gallery')
  }

  const handleFinish = () => {
    if (captures.length === 0 && !videoFrames) {
      toast.error('Please capture at least one photo or video')
      return
    }
    onComplete(captures, videoFrames || undefined)
  }

  // Mode: Choose between photo or video
  if (mode === 'choose') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{config.moduleTitle} — Capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Choose how to capture evidence{config.childName ? ` for ${config.childName}` : ''}:
          </p>

          <Button className="w-full h-16" variant="outline" onClick={() => setMode('photo')}>
            <div className="flex items-center gap-3">
              <Icons.Camera className="w-6 h-6 text-blue-600" />
              <div className="text-left">
                <p className="font-medium">Multiple Photos</p>
                <p className="text-xs text-gray-500">Take up to {config.maxPhotos} photos</p>
              </div>
            </div>
          </Button>

          {config.allowVideo && (
            <Button className="w-full h-16" variant="outline" onClick={() => setMode('video')}>
              <div className="flex items-center gap-3">
                <Icons.Video className="w-6 h-6 text-red-600" />
                <div className="text-left">
                  <p className="font-medium">Record Video</p>
                  <p className="text-xs text-gray-500">Record up to {config.videoMaxDuration || 15}s, AI extracts key frames</p>
                </div>
              </div>
            </Button>
          )}

          <Button variant="ghost" size="sm" className="w-full" onClick={onBack}>
            Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Mode: Photo capture with gallery strip
  if (mode === 'photo') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>{config.moduleTitle}</span>
            <Badge variant="outline">{captures.length} / {config.maxPhotos}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Camera viewfinder */}
          <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs bg-black/30 py-1">
              {getLabel(captures.length)}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Capture button */}
          <Button className="w-full" onClick={capturePhoto} disabled={captures.length >= config.maxPhotos}>
            <Icons.Camera className="w-4 h-4 mr-2" />
            Capture {getLabel(captures.length)}
          </Button>

          {/* Gallery strip */}
          {captures.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Captured ({captures.length}):</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {captures.map((cap, i) => (
                  <div key={cap.id} className="relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 border-gray-200">
                    <img src={cap.imageDataUrl} alt={cap.label || `Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeCapture(cap.id)}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-md p-0.5"
                    >
                      <Icons.X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] bg-black/50 text-white py-0.5 truncate">
                      {cap.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { stopCamera(); setMode('choose') }}>
              Back
            </Button>
            {captures.length > 0 && (
              <Button className="flex-1" onClick={() => { stopCamera(); setMode('gallery') }}>
                Review ({captures.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Mode: Video capture
  if (mode === 'video') {
    return (
      <VideoCapture
        onFramesReady={handleVideoComplete}
        onBack={() => setMode('choose')}
        maxDuration={config.videoMaxDuration || 15}
        cameraFacing={config.cameraFacing}
        instructions={`Record ${config.moduleTitle.toLowerCase()} for ${config.childName || 'the child'}`}
      />
    )
  }

  // Mode: Gallery review
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>Review — {config.moduleTitle}</span>
          <Badge variant="outline">{captures.length} captures</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {videoFrames && (
          <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-xs font-medium text-purple-700 mb-1">Video recorded — {videoFrames.length} key frames extracted</p>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {videoFrames.map((frame, i) => (
                <img key={i} src={frame} alt={`Frame ${i + 1}`} className="w-14 h-14 rounded object-cover flex-shrink-0" />
              ))}
            </div>
          </div>
        )}

        {/* Photo grid */}
        <div className="grid grid-cols-2 gap-2">
          {captures.map(cap => (
            <div key={cap.id} className="relative rounded-lg overflow-hidden border border-gray-200">
              <img src={cap.imageDataUrl} alt={cap.label} className="w-full aspect-square object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 flex justify-between items-center">
                <span className="truncate">{cap.label}</span>
                <button onClick={() => retakeCapture(cap.id)} className="text-red-300 hover:text-red-100 ml-1 flex-shrink-0">
                  <Icons.RefreshCw className="w-3 h-3" />
                </button>
              </div>
              {cap.aiAnalysis && (
                <div className="absolute top-1 right-1">
                  <Badge className="text-[8px] px-1 py-0 bg-blue-500">AI</Badge>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add more or finish */}
        <div className="flex gap-2">
          {captures.length < config.maxPhotos && (
            <Button variant="outline" className="flex-1" onClick={() => setMode('photo')}>
              <Icons.Plus className="w-3 h-3 mr-1" />
              Add Photo
            </Button>
          )}
          {config.allowVideo && !videoFrames && (
            <Button variant="outline" className="flex-1" onClick={() => setMode('video')}>
              <Icons.Video className="w-3 h-3 mr-1" />
              Add Video
            </Button>
          )}
        </div>

        <Button className="w-full" onClick={handleFinish} disabled={captures.length === 0 && !videoFrames}>
          <Icons.Check className="w-4 h-4 mr-2" />
          Done — {captures.length} capture{captures.length !== 1 ? 's' : ''}
        </Button>
      </CardContent>
    </Card>
  )
}
