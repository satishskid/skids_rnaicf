
import React, { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { ScreeningProps } from './types'
import { analyzeEarImage } from '@/lib/ai/ear'
import { classifyENTImage, type ENTAnalysisResult } from '@/lib/ai/ent-classifier'
import { Icons } from '@/components/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { getUserMediaWithFallback } from '@/lib/camera-utils'
import { type CaptureItem } from '@skids/shared'
import { VideoAIPanel, type VideoAIResult } from './video-ai-panel'

interface EarCapture {
  ear: 'left' | 'right'
  imageDataUrl: string
  analysis: {
    visibility: number
    inflammationIndicator: number
    symmetry: number
    colorScore: number
    riskCategory: string
  }
  entResult?: ENTAnalysisResult | null
}

export function EarScreening({ step, setStep, onComplete, instructions, childName }: ScreeningProps) {
  const [captures, setCaptures] = useState<EarCapture[]>([])
  const [currentEar, setCurrentEar] = useState<'right' | 'left'>('right')
  const [entRunning, setEntRunning] = useState(false)
  const [lfmResult, setLfmResult] = useState<VideoAIResult | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const startCamera = async () => {
    try {
      const stream = await getUserMediaWithFallback('environment', { width: 1280, height: 720, exact: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      toast.error('Camera access denied')
    }
  }

  const stopCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream
      stream?.getTracks().forEach(track => track.stop())
    }
  }

  const captureAndAnalyze = () => {
    if (!videoRef.current || !canvasRef.current) return

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    const result = analyzeEarImage(imageData)
    const imageDataUrl = canvasRef.current.toDataURL('image/jpeg')

    stopCamera()

    const capture: EarCapture = {
      ear: currentEar,
      imageDataUrl,
      analysis: {
        visibility: result.visibility,
        inflammationIndicator: result.inflammationIndicator,
        symmetry: result.symmetry,
        colorScore: result.colorScore,
        riskCategory: result.riskCategory,
      },
    }

    // Run ENT classifier in background
    setEntRunning(true)
    classifyENTImage(imageData, 0.4)
      .then(entRes => {
        capture.entResult = entRes
        setCaptures(prev => prev.map(c => c.ear === capture.ear ? { ...c, entResult: entRes } : c))
      })
      .catch(() => {})
      .finally(() => setEntRunning(false))

    setCaptures(prev => [...prev.filter(c => c.ear !== currentEar), capture])

    // If we just captured right ear, move to left ear next
    if (currentEar === 'right') {
      setCurrentEar('left')
      setStep(3) // show single-ear result + prompt for next ear
    } else {
      setStep(4) // show review of both ears
    }
  }

  const retakeCurrentEar = () => {
    setCaptures(prev => prev.filter(c => c.ear !== currentEar))
    setStep(2) // back to camera
  }

  const finishScreening = () => {
    const rightCapture = captures.find(c => c.ear === 'right')
    const leftCapture = captures.find(c => c.ear === 'left')

    const captureItems: CaptureItem[] = captures.map(c => ({
      id: `ear-${c.ear}-${Date.now()}`,
      imageDataUrl: c.imageDataUrl,
      label: `${c.ear === 'left' ? 'Left' : 'Right'} Ear`,
      timestamp: new Date().toISOString(),
      aiAnalysis: c.analysis,
    }))

    // Use worst-case risk for overall assessment
    const risks = captures.map(c => c.analysis.riskCategory)
    const overallRisk = risks.includes('possible_risk') ? 'possible_risk' : 'no_risk'

    onComplete({
      rightEar: rightCapture ? {
        visibility: rightCapture.analysis.visibility,
        colorScore: rightCapture.analysis.colorScore,
        symmetry: rightCapture.analysis.symmetry,
        inflammationIndicator: rightCapture.analysis.inflammationIndicator,
        riskCategory: rightCapture.analysis.riskCategory,
      } : null,
      leftEar: leftCapture ? {
        visibility: leftCapture.analysis.visibility,
        colorScore: leftCapture.analysis.colorScore,
        symmetry: leftCapture.analysis.symmetry,
        inflammationIndicator: leftCapture.analysis.inflammationIndicator,
        riskCategory: leftCapture.analysis.riskCategory,
      } : null,
      captures: captureItems,
      ear: 'both',
      confidence: Math.min(0.9, 0.6 + Math.min(
        rightCapture?.analysis.visibility || 0,
        leftCapture?.analysis.visibility || 0
      ) * 0.3),
      riskCategory: overallRisk,
      lfmResult: lfmResult || undefined,
      qualityFlags: captures.every(c => c.analysis.visibility > 0.5) ? ['adequate_view'] : ['limited_view'],
    })
  }

  useEffect(() => {
    if (step === 2) startCamera()
  }, [step])

  // Step 0: Instructions
  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Ear Examination</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Icons.Info className="w-4 h-4" />
            <AlertTitle>Both Ears Required</AlertTitle>
            <AlertDescription className="text-sm">
              You will capture images of both the right and left ear for doctor review. The app will guide you through each ear sequentially.
            </AlertDescription>
          </Alert>

          <div className="space-y-1">
            {instructions.tips.map((tip, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <Icons.Info className="w-3 h-3 text-gray-400" />
                <span>{tip}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-800 font-medium mb-1">Capture sequence:</p>
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">1</Badge>
              <span>Right Ear</span>
              <Icons.ArrowRight className="w-3 h-3" />
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">2</Badge>
              <span>Left Ear</span>
              <Icons.ArrowRight className="w-3 h-3" />
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">✓</Badge>
              <span>Review</span>
            </div>
          </div>

          <Button className="w-full" onClick={() => { setCurrentEar('right'); setStep(2) }}>
            <Icons.Camera className="w-4 h-4 mr-2" />
            Start — Right Ear First
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Step 2: Camera capture
  if (step === 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            {currentEar === 'right' ? 'Right' : 'Left'} Ear — Capture
            <Badge variant="outline" className="text-xs">
              {currentEar === 'right' ? '1 of 2' : '2 of 2'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-square bg-gray-900 rounded-lg overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm bg-black/30 py-1">
              Position camera near {childName}&apos;s {currentEar} ear
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <Button className="w-full" onClick={captureAndAnalyze}>
            <Icons.Camera className="w-4 h-4 mr-2" />
            Capture & Analyze
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Step 3: Single ear result, prompt for other ear
  if (step === 3) {
    const lastCapture = captures.find(c => c.ear === (currentEar === 'left' ? 'right' : currentEar))
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{lastCapture?.ear === 'right' ? 'Right' : 'Left'} Ear — Captured</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastCapture && (
            <>
              <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden">
                <img src={lastCapture.imageDataUrl} alt={`${lastCapture.ear} ear`} className="w-full h-full object-cover" />
              </div>
              <EarAnalysisDisplay capture={lastCapture} entRunning={entRunning} />
            </>
          )}

          {lastCapture && (
            <VideoAIPanel
              moduleType="ear"
              imageBase64={lastCapture.imageDataUrl}
              onAnalysisComplete={setLfmResult}
              childName={childName}
            />
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => {
              setCurrentEar(lastCapture?.ear || 'right')
              setStep(2)
            }}>
              Retake
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              <Icons.Camera className="w-4 h-4 mr-2" />
              Capture {currentEar === 'left' ? 'Left' : 'Right'} Ear
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Step 4: Review both ears side-by-side
  if (step === 4) {
    const rightCapture = captures.find(c => c.ear === 'right')
    const leftCapture = captures.find(c => c.ear === 'left')

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Review — Both Ears</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {/* Right Ear */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-center text-gray-600">Right Ear</p>
              <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden">
                {rightCapture ? (
                  <img src={rightCapture.imageDataUrl} alt="Right ear" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">Not captured</div>
                )}
              </div>
              {rightCapture && (
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>Visibility: {Math.round(rightCapture.analysis.visibility * 100)}%</p>
                  <p>Inflammation: {Math.round(rightCapture.analysis.inflammationIndicator * 100)}%</p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setCurrentEar('right'); setStep(2) }}>
                Retake Right
              </Button>
            </div>

            {/* Left Ear */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-center text-gray-600">Left Ear</p>
              <div className="aspect-square bg-gray-900 rounded-lg overflow-hidden">
                {leftCapture ? (
                  <img src={leftCapture.imageDataUrl} alt="Left ear" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">Not captured</div>
                )}
              </div>
              {leftCapture && (
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>Visibility: {Math.round(leftCapture.analysis.visibility * 100)}%</p>
                  <p>Inflammation: {Math.round(leftCapture.analysis.inflammationIndicator * 100)}%</p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setCurrentEar('left'); setStep(2) }}>
                Retake Left
              </Button>
            </div>
          </div>

          {/* ENT AI findings for both */}
          {captures.some(c => c.entResult && c.entResult.findings.length > 0) && (
            <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-medium text-blue-700 mb-1">AI Detected:</p>
              <div className="flex flex-wrap gap-1">
                {captures.flatMap(c =>
                  (c.entResult?.findings || []).map(f => (
                    <Badge key={`${c.ear}-${f.chipId}`} variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                      {c.ear === 'left' ? 'L' : 'R'}: {f.label} ({Math.round(f.confidence * 100)}%)
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )}

          {/* On-device AI analysis for review */}
          {(rightCapture || leftCapture) && (
            <VideoAIPanel
              moduleType="ear"
              imageBase64={(rightCapture || leftCapture)!.imageDataUrl}
              onAnalysisComplete={setLfmResult}
              childName={childName}
            />
          )}

          {(!rightCapture || !leftCapture) && (
            <Alert>
              <Icons.AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                {!rightCapture ? 'Right ear not captured. ' : ''}{!leftCapture ? 'Left ear not captured. ' : ''}
                You can still complete but both ears are recommended for doctor review.
              </AlertDescription>
            </Alert>
          )}

          <Button className="w-full" onClick={finishScreening} disabled={captures.length === 0}>
            <Icons.Check className="w-4 h-4 mr-2" />
            Complete Ear Examination
          </Button>
        </CardContent>
      </Card>
    )
  }

  return null
}

function EarAnalysisDisplay({ capture, entRunning }: { capture: EarCapture; entRunning: boolean }) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-600 space-y-1">
        <p>Visibility: {Math.round(capture.analysis.visibility * 100)}%</p>
        <p>Inflammation indicator: {Math.round(capture.analysis.inflammationIndicator * 100)}%</p>
        <p>Symmetry: {Math.round(capture.analysis.symmetry * 100)}%</p>
      </div>
      {entRunning && (
        <div className="flex items-center gap-2 text-xs text-blue-600">
          <Icons.Loader2 className="w-3 h-3 animate-spin" />
          <span>AI analyzing image...</span>
        </div>
      )}
      {capture.entResult && capture.entResult.findings.length > 0 && (
        <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs font-medium text-blue-700 mb-1">AI Detected ({capture.entResult.inferenceTimeMs}ms):</p>
          <div className="flex flex-wrap gap-1">
            {capture.entResult.findings.map(f => (
              <Badge key={f.chipId} variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                {f.label} ({Math.round(f.confidence * 100)}%)
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
