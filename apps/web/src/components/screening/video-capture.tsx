
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { extractKeyFrames } from '@/lib/ai/video-frames'
import { getUserMediaWithFallback } from '@/lib/camera-utils'

interface VideoCaptureProps {
  onFramesReady: (frames: string[], bestFrame: string) => void
  onBack?: () => void
  maxDuration?: number // seconds, default 15
  cameraFacing?: 'user' | 'environment'
  instructions?: string
}

export function VideoCapture({
  onFramesReady,
  onBack,
  maxDuration = 15,
  cameraFacing = 'environment',
  instructions,
}: VideoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [frames, setFrames] = useState<string[]>([])
  const [selectedFrame, setSelectedFrame] = useState<number>(0)
  const [cameraActive, setCameraActive] = useState(false)

  // Start camera preview
  const startCamera = useCallback(async () => {
    try {
      const stream = await getUserMediaWithFallback(cameraFacing, { width: 1280, height: 720 })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch (err) {
      console.error('Camera access failed:', err)
    }
  }, [cameraFacing])

  useEffect(() => {
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [startCamera])

  // Recording timer
  useEffect(() => {
    if (!isRecording) return
    const interval = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= maxDuration) {
          stopRecording()
          return prev
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, maxDuration])

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    try {
      chunksRef.current = []
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      })
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorder.start(100) // collect data every 100ms
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setRecordingTime(0)
    } catch {
      console.error('Failed to start video recording')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return
    mediaRecorderRef.current.stop()
    setIsRecording(false)
    setIsProcessing(true)

    // Process video after a short delay for final data
    setTimeout(async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      try {
        const keyFrames = await extractKeyFrames(blob, { fps: 1, maxFrames: 5 })
        setFrames(keyFrames.frames)
        setSelectedFrame(keyFrames.bestFrameIndex)
      } catch (err) {
        console.error('Frame extraction failed:', err)
        // Fallback: grab current video frame
        if (videoRef.current) {
          const canvas = document.createElement('canvas')
          canvas.width = videoRef.current.videoWidth || 640
          canvas.height = videoRef.current.videoHeight || 480
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0)
            const fallbackFrame = canvas.toDataURL('image/jpeg', 0.8)
            setFrames([fallbackFrame])
            setSelectedFrame(0)
          }
        }
      }
      setIsProcessing(false)
    }, 500)
  }, [])

  const handleConfirm = () => {
    if (frames.length > 0) {
      onFramesReady(frames, frames[selectedFrame] || frames[0])
    }
  }

  const handleRetake = () => {
    setFrames([])
    setSelectedFrame(0)
    startCamera()
  }

  // Frames review mode
  if (frames.length > 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">AI Key Frames</h3>
              <Badge variant="outline" className="text-xs">
                {frames.length} frames extracted
              </Badge>
            </div>

            {/* Selected frame display */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frames[selectedFrame]}
              alt={`Frame ${selectedFrame + 1}`}
              className="w-full rounded-lg border-2 border-blue-300 mb-3"
            />

            {/* Frame filmstrip */}
            {frames.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {frames.map((frame, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedFrame(i)}
                    className={`relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 ${
                      i === selectedFrame
                        ? 'border-blue-500'
                        : 'border-gray-200'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={frame}
                      alt={`Frame ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[10px] px-1">
                      {i + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 text-center mt-2">
              Frame {selectedFrame + 1} of {frames.length} — best visibility selected by AI
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetake} className="flex-1">
            Retake
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Use This Frame &amp; Annotate
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {instructions && (
        <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          {instructions}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {/* Camera preview */}
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
            />

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-sm font-mono bg-black/50 px-2 py-0.5 rounded">
                  {recordingTime}s / {maxDuration}s
                </span>
              </div>
            )}

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm">Extracting key frames...</p>
                </div>
              </div>
            )}
          </div>

          {/* Recording progress bar */}
          {isRecording && (
            <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-1000"
                style={{ width: `${(recordingTime / maxDuration) * 100}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex gap-3">
        {onBack && !isRecording && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        {!isRecording && cameraActive && (
          <Button
            onClick={startRecording}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            &#9679; Start Recording
          </Button>
        )}
        {isRecording && (
          <Button
            onClick={stopRecording}
            className="flex-1"
            variant="outline"
          >
            &#9632; Stop Recording
          </Button>
        )}
      </div>
    </div>
  )
}
