
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { ScreeningProps } from './types'
import { analyzeMotorPerformance } from '@/lib/ai/motor'
import { Icons } from '@/components/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUserMediaWithFallback } from '@/lib/camera-utils'
import { MediaPipeOverlay, type MediaPipeMetrics } from './mediapipe-overlay'

export function MotorScreening({ step, setStep, onComplete, instructions, childName }: ScreeningProps) {
  const [currentTask, setCurrentTask] = useState(0)
  const [positions, setPositions] = useState<Array<{ x: number; y: number; time: number }>>([])
  const [isTracking, setIsTracking] = useState(false)
  const [motorMetrics, setMotorMetrics] = useState<MediaPipeMetrics | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trackingRef = useRef(false)

  const tasks = ['Standing Balance', 'Walking Test', 'Reach Test']

  const startCamera = async () => {
    try {
      const stream = await getUserMediaWithFallback('user')
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      // Continue without camera - manual observation mode
    }
  }

  // Track movement from video frames by detecting the brightest/most-moving region
  const trackMovement = useCallback(() => {
    if (!trackingRef.current || !videoRef.current || !canvasRef.current) return

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvasRef.current.width = videoRef.current.videoWidth || 320
    canvasRef.current.height = videoRef.current.videoHeight || 240
    ctx.drawImage(videoRef.current, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    const pixels = imageData.data
    const w = canvasRef.current.width
    const h = canvasRef.current.height

    // Find center of motion by looking for skin-tone pixels
    let weightedX = 0, weightedY = 0, totalWeight = 0

    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const idx = (y * w + x) * 4
        const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]

        // Detect skin-tone as proxy for body position
        if (r > 100 && g > 60 && b > 40 && r > g && g > b) {
          const weight = r - g // More reddish = more likely skin
          weightedX += x * weight
          weightedY += y * weight
          totalWeight += weight
        }
      }
    }

    if (totalWeight > 0) {
      setPositions(prev => [...prev, {
        x: weightedX / totalWeight,
        y: weightedY / totalWeight,
        time: Date.now()
      }])
    }

    if (trackingRef.current) {
      requestAnimationFrame(trackMovement)
    }
  }, [])

  const startTracking = () => {
    setIsTracking(true)
    trackingRef.current = true
    setPositions([])
    requestAnimationFrame(trackMovement)

    // Auto-stop after 10 seconds per task
    setTimeout(() => {
      trackingRef.current = false
      setIsTracking(false)
    }, 10000)
  }

  useEffect(() => {
    if (step === 1) startCamera()
    return () => { trackingRef.current = false }
  }, [step])

  const completeTask = () => {
    trackingRef.current = false
    setIsTracking(false)

    if (currentTask < tasks.length - 1) {
      setCurrentTask(prev => prev + 1)
      setPositions([])
    } else {
      const analysis = analyzeMotorPerformance(positions)

      // Stop camera
      const stream = videoRef.current?.srcObject as MediaStream
      stream?.getTracks().forEach(track => track.stop())

      const riskCategory = analysis.stability < 0.5 || analysis.tremor > 0.3 ? 'possible_risk' : 'no_risk'

      onComplete({
        balance: analysis.stability,
        symmetry: analysis.symmetry,
        avgSpeed: analysis.avgSpeed,
        tremor: analysis.tremor,
        confidence: 0.8,
        riskCategory,
        qualityFlags: analysis.stability > 0.5 ? ['adequate'] : ['needs_review'],
        mediapipeMetrics: motorMetrics ? {
          gaitSymmetry: motorMetrics.pose?.gaitSymmetry,
          balance: motorMetrics.pose?.balance,
          shoulderLevel: motorMetrics.pose?.shoulderLevel,
          spineAlignment: motorMetrics.pose?.spineAlignment,
          leftKnee: motorMetrics.pose?.leftKnee,
          rightKnee: motorMetrics.pose?.rightKnee,
          handFlapping: motorMetrics.hand?.flapping,
        } : undefined,
      })
    }
  }

  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Movement Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className="bg-gray-50">
            <CardContent className="py-3">
              <div className="space-y-2">
                {tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm">
                      {i + 1}
                    </div>
                    <span className="text-sm">{task}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-1">
            {instructions.tips.map((tip, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <Icons.Info className="w-3 h-3 text-gray-400" />
                <span>{tip}</span>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={() => setStep(1)}>
            Start Tasks
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{tasks[currentTask]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-video bg-gradient-to-br from-green-500 to-teal-500 rounded-lg overflow-hidden">
          {videoRef.current?.srcObject ? (
            <>
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/60 rounded-lg p-4 text-white text-center">
                  <Icons.Activity className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Ask {childName} to {tasks[currentTask].toLowerCase()}</p>
                  {isTracking && (
                    <p className="text-xs mt-1 text-green-300">Tracking movement... ({positions.length} frames)</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-white text-center p-4">
              <div>
                <Icons.Activity className="w-12 h-12 mx-auto mb-3" />
                <p>Ask {childName} to {tasks[currentTask].toLowerCase()}</p>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          {videoRef.current?.srcObject && (
            <MediaPipeOverlay
              videoRef={videoRef as React.RefObject<HTMLVideoElement>}
              tasks={['pose', 'hand']}
              onMetrics={setMotorMetrics}
            />
          )}
        </div>

        <div className="flex gap-2">
          {tasks.map((_, i) => (
            <div key={i} className={`flex-1 h-2 rounded-full ${i <= currentTask ? 'bg-green-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {!isTracking && (
            <Button variant="outline" className="flex-1" onClick={startTracking}>
              <Icons.Play className="w-4 h-4 mr-2" />
              Track Movement
            </Button>
          )}
          <Button className="flex-1" onClick={completeTask}>
            {currentTask < tasks.length - 1 ? 'Next Task' : 'Complete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default MotorScreening
