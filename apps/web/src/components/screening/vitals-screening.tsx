
import { useRef, useState } from 'react'
import type { ScreeningProps } from './types'
import { extractFaceSignal, computeHeartRateCHROM } from '@/lib/ai/rppg'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getUserMediaWithFallback } from '@/lib/camera-utils'

export function VitalsScreening({
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const signalBufferRef = useRef<Array<{ r: number; g: number; b: number; time: number }>>([])
  const [hrValue, setHrValue] = useState(0)
  const [status, setStatus] = useState<'waiting' | 'measuring' | 'complete'>('waiting')

  const startMeasurement = async () => {
    try {
      const stream = await getUserMediaWithFallback('user', { width: 640, height: 480, exact: true })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      setIsCapturing(true)
      setProgress(0)
      setStatus('measuring')
      signalBufferRef.current = []

      let frameCount = 0
      const targetFrames = 300

      const captureFrame = () => {
        if (!videoRef.current || !canvasRef.current || frameCount >= targetFrames) {
          return
        }

        const signal = extractFaceSignal(videoRef.current, canvasRef.current)
        if (signal) {
          signalBufferRef.current.push({ ...signal, time: Date.now() })
        }

        frameCount++
        setProgress((frameCount / targetFrames) * 100)

        if (frameCount % 30 === 0 && signalBufferRef.current.length >= 90) {
          const hr = computeHeartRateCHROM(signalBufferRef.current)
          setHrValue(hr)
        }

        if (frameCount < targetFrames) {
          requestAnimationFrame(captureFrame)
        } else {
          const finalHr = computeHeartRateCHROM(signalBufferRef.current)
          const mediaStream = videoRef.current?.srcObject as MediaStream
          mediaStream?.getTracks().forEach((track) => track.stop())

          setIsCapturing(false)
          setStatus('complete')

          const riskCategory = finalHr > 120 || finalHr < 60 ? 'possible_risk' : 'no_risk'

          onComplete({
            heartRate: finalHr,
            heartRateConfidence: signalBufferRef.current.length > 200 ? 0.89 : 0.65,
            signalQuality: signalBufferRef.current.length / targetFrames,
            confidence: Math.min(0.95, signalBufferRef.current.length / 200),
            riskCategory,
            qualityFlags:
              signalBufferRef.current.length > 200
                ? ['good_signal']
                : ['low_signal_quality'],
          })
        }
      }

      setTimeout(() => requestAnimationFrame(captureFrame), 500)
    } catch {
      toast.error('Camera access denied')
    }
  }

  if (step === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icons.Heart className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{instructions.title}</CardTitle>
              <CardDescription>
                Contactless heart rate measurement for {childName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Icons.Info className="h-4 w-4 text-blue-500" />
              How rPPG Technology Works
            </div>
            <p className="text-sm text-muted-foreground">
              Remote Photoplethysmography (rPPG) detects subtle color changes in
              facial skin caused by blood flow using your device&apos;s camera.
              The CHROM algorithm isolates the pulse signal from ambient light
              variations to estimate heart rate without any physical contact.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Steps</h4>
            <ol className="space-y-2">
              {instructions.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-700">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Tips</h4>
            <ul className="space-y-1.5">
              {instructions.tips.map((tip, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icons.CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Data Collected</h4>
            <div className="flex flex-wrap gap-2">
              {instructions.dataCollected.map((item, i) => (
                <Badge key={i} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <div className="flex items-start gap-2">
              <Icons.Shield className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                All video data is processed locally on your device. No facial
                images are stored or transmitted. Only the computed heart rate
                value is saved.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setStep(1)
              startMeasurement()
            }}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
            size="lg"
          >
            <Icons.Heart className="h-4 w-4" />
            Start Measurement
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Icons.Heart className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Measuring Heart Rate</CardTitle>
              <CardDescription>
                {status === 'measuring'
                  ? 'Keep still and face the camera'
                  : 'Measurement complete'}
              </CardDescription>
            </div>
          </div>
          {status === 'measuring' && (
            <Badge variant="outline" className="animate-pulse border-red-300 text-red-600">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-red-500 inline-block" />
              Recording
            </Badge>
          )}
          {status === 'complete' && (
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <Icons.CheckCircle className="h-3 w-3" />
              Done
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {isCapturing && hrValue > 0 && (
            <div className="absolute top-4 right-4 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-white backdrop-blur-sm">
              <Icons.Heart className="h-4 w-4 text-red-400 animate-pulse" />
              <span className="text-lg font-bold tabular-nums">{hrValue}</span>
              <span className="text-xs text-white/70">BPM</span>
            </div>
          )}

          {isCapturing && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-white/80 mb-1.5">
                  <span>
                    {status === 'measuring'
                      ? 'Capturing facial color changes...'
                      : 'Processing...'}
                  </span>
                  <span className="tabular-nums">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {!isCapturing && status === 'waiting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white space-y-2">
                <Icons.Camera className="h-10 w-10 mx-auto opacity-60" />
                <p className="text-sm opacity-80">Waiting for camera...</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium tabular-nums">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {status === 'measuring'
              ? `Collecting signal data (~${Math.max(0, Math.ceil((300 - (progress / 100) * 300) / 30))}s remaining)`
              : status === 'complete'
                ? 'Heart rate measurement complete'
                : 'Preparing measurement...'}
          </p>
        </div>

        {hrValue > 0 && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Current Estimate</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">{hrValue}</span>
                  <span className="text-sm text-muted-foreground">BPM</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Icons.Activity className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default VitalsScreening
