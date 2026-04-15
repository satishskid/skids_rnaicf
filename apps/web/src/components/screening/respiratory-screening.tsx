
import { useState, useRef, useEffect, useCallback } from 'react'
import { type ScreeningProps } from './types'
import { extractAudioFeatures, classifyCough } from '@/lib/ai/audio'
import { VideoAIPanel, VideoAIResult } from './video-ai-panel'
import { MediaPipeOverlay } from './mediapipe-overlay'
import { getUserMediaWithFallback } from '@/lib/camera-utils'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

function RespiratoryScreening({
  step,
  setStep,
  onComplete,
  isCapturing,
  setIsCapturing,
  progress,
  setProgress,
  instructions,
  childName,
}: ScreeningProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null)
  const [lfmResult, setLfmResult] = useState<VideoAIResult | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)

  const startVideoCamera = useCallback(async () => {
    try {
      const stream = await getUserMediaWithFallback('environment', { width: 1280, height: 720 })
      videoStreamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      console.error('Video camera access failed (non-blocking):', err)
    }
  }, [])

  const captureVideoFrame = useCallback(() => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0)
    setCapturedFrame(canvas.toDataURL('image/jpeg', 0.85))
    videoStreamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const startRecording = async () => {
    if (isStarting || isRecording) return
    setIsStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      setAudioContext(ctx)

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onerror = () => {
        toast.error('Recording failed. Please try again.')
        setIsRecording(false)
        setIsCapturing(false)
        setIsStarting(false)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      mediaRecorder.onstop = async () => {
        setIsProcessing(true)
        captureVideoFrame()
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

          if (blob.size < 100) {
            toast.error('Recording too short. Please try again.')
            setIsProcessing(false)
            return
          }

          const arrayBuffer = await blob.arrayBuffer()
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

          const features = extractAudioFeatures(audioBuffer)
          const classification = classifyCough(features)

          stream.getTracks().forEach((track) => track.stop())
          streamRef.current = null

          const urgency =
            classification.type === 'barking' || classification.type === 'whooping'
              ? 'high'
              : classification.type === 'wet'
                ? 'medium'
                : 'low'

          onComplete({
            coughType: classification.type,
            peakFrequency: features.peakFrequency,
            spectralCentroid: features.spectralCentroid,
            zeroCrossingRate: features.zeroCrossingRate,
            rms: features.rms,
            confidence: classification.confidence,
            urgency,
            riskCategory: urgency === 'high' ? 'possible_risk' : 'no_risk',
            qualityFlags: features.rms > 0.01 ? ['good_audio'] : ['low_audio'],
            lfmResult: lfmResult || undefined,
          })
        } catch (err) {
          console.error('Audio processing failed:', err)
          toast.error('Failed to process audio. Please try recording again.')
          // Clean up stream
          stream.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        } finally {
          setIsProcessing(false)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setIsCapturing(true)
      setIsStarting(false)
      setStep(1)
      startVideoCamera()

      // Auto-stop after 15 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          setIsRecording(false)
          setIsCapturing(false)
        }
      }, 15000)
    } catch {
      setIsStarting(false)
      toast.error('Microphone access denied. Please allow microphone access in your browser settings and try again.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsCapturing(false)
    }
  }

  // Step 0: Instructions
  if (step === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icons.Mic className="h-5 w-5 text-teal-600" />
              {instructions.title}
            </CardTitle>
            <CardDescription>
              Cough and respiratory analysis for {childName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI Audio Analysis explanation */}
            <Alert>
              <Icons.Cpu className="h-4 w-4" />
              <AlertDescription>
                <span className="font-semibold">AI Audio Analysis:</span> This screening
                records a short audio clip and uses on-device signal processing to analyze
                cough characteristics. Features such as peak frequency, spectral centroid,
                and zero-crossing rate are extracted to classify the cough type. All
                processing happens locally on your device.
              </AlertDescription>
            </Alert>

            {/* Steps */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Steps</h4>
              <ol className="space-y-2">
                {instructions.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Badge variant="outline" className="mt-0.5 shrink-0">
                      {i + 1}
                    </Badge>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Tips */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Tips</h4>
              <ul className="space-y-1.5">
                {instructions.tips.map((tip, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icons.Info className="h-3.5 w-3.5 shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Data collected */}
            <div>
              <h4 className="text-sm font-semibold mb-3">Data Collected</h4>
              <div className="flex flex-wrap gap-2">
                {instructions.dataCollected.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={startRecording} disabled={isStarting} className="w-full" size="lg">
              {isStarting ? (
                <>
                  <Icons.Loader className="h-4 w-4 animate-spin" />
                  Requesting Microphone...
                </>
              ) : (
                <>
                  <Icons.Mic className="h-4 w-4" />
                  Start Recording
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 1: Recording interface
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.Mic className="h-5 w-5 text-teal-600" />
            Recording Audio
          </CardTitle>
          <CardDescription>
            {isProcessing
              ? 'Analyzing audio...'
              : isRecording
                ? 'Listening... Ask the child to cough or breathe normally.'
                : 'Ready to record.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-8 py-8">
          {/* Video feed for visual respiratory assessment */}
          <div className="relative w-full aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <MediaPipeOverlay videoRef={videoRef as React.RefObject<HTMLVideoElement>} tasks={['face', 'pose']} />
            <div className="absolute bottom-2 left-0 right-0 text-center text-white text-xs bg-black/30 py-1">
              Watching for nasal flaring &amp; chest retractions
            </div>
          </div>
          {/* Large mic icon with pulsing animation when recording */}
          <div
            className={`flex h-32 w-32 items-center justify-center rounded-full transition-colors ${
              isRecording
                ? 'bg-red-500 animate-pulse'
                : isProcessing
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-muted'
            }`}
          >
            {isProcessing ? (
              <Icons.Loader className={`h-16 w-16 text-white animate-spin`} />
            ) : (
              <Icons.Mic
                className={`h-16 w-16 ${
                  isRecording ? 'text-white' : 'text-muted-foreground'
                }`}
              />
            )}
          </div>

          {isRecording && (
            <p className="text-sm text-muted-foreground text-center">
              Recording will automatically stop after 15 seconds.
              <br />
              You can also stop it manually.
            </p>
          )}

          {isProcessing ? (
            <p className="text-sm text-muted-foreground">Processing audio...</p>
          ) : isRecording ? (
            <Button
              onClick={stopRecording}
              variant="destructive"
              size="lg"
              className="w-full max-w-xs"
            >
              <Icons.Square className="h-4 w-4" />
              Stop Recording
            </Button>
          ) : (
            <Button
              onClick={startRecording}
              disabled={isStarting}
              size="lg"
              className="w-full max-w-xs"
            >
              <Icons.Mic className="h-4 w-4" />
              Record Again
            </Button>
          )}
        </CardContent>
      </Card>
      {capturedFrame && (
        <VideoAIPanel
          moduleType="respiratory"
          imageBase64={capturedFrame}
          onAnalysisComplete={setLfmResult}
          childName={childName}
        />
      )}
    </div>
  )
}

export { RespiratoryScreening }

export default RespiratoryScreening
