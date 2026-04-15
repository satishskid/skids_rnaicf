
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ScreeningProps } from './types'
import { getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import { ImageAnnotator } from './image-annotator'
import { analyzeClinicalColors, mapSuggestionsToChipIds } from '@/lib/ai/clinical-color'
import { AnnotationPin, AnnotationData, Severity } from '@skids/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'
import { getUserMediaWithFallback } from '@/lib/camera-utils'

const MODULE_TYPE = 'general_appearance'
const CAMERA_FACING = 'user' as const

export function GeneralAppearanceScreening({
  step, setStep, onComplete, instructions, childName,
}: ScreeningProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [pins, setPins] = useState<AnnotationPin[]>([])
  const [aiSuggestedChips, setAiSuggestedChips] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [activePin, setActivePin] = useState<{ label: string; severity?: Severity } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const chips = getAnnotationConfig(MODULE_TYPE)

  const startCamera = useCallback(async () => {
    try {
      const stream = await getUserMediaWithFallback(CAMERA_FACING, { width: 1280, height: 720 })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      console.error('Camera access failed:', err)
    }
  }, [])

  useEffect(() => {
    if (step === 1) startCamera()
    return () => { if (step === 1) streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [step, startCamera])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedImage(dataUrl)
    streamRef.current?.getTracks().forEach(t => t.stop())

    analyzeClinicalColors(dataUrl).then(result => {
      const suggested = mapSuggestionsToChipIds(result.suggestedChips, MODULE_TYPE)
      setAiSuggestedChips(suggested)
      setSelectedChips(prev => [...new Set([...prev, ...suggested])])
    }).catch(() => {})

    setStep(2)
  }, [setStep])

  const handleToggleChip = (chipId: string) => {
    setSelectedChips(prev =>
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    )
    const chip = chips.find(c => c.id === chipId)
    if (chip?.locationPin && !selectedChips.includes(chipId)) {
      setActivePin({ label: chip.label, severity: chipSeverities[chipId] })
    } else {
      setActivePin(null)
    }
  }

  const handleComplete = () => {
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins, aiSuggestedChips, notes,
      evidenceImage: capturedImage || undefined,
    }
    onComplete({ moduleType: MODULE_TYPE, annotationData, riskCategory: selectedChips.length === 0 ? 'no_risk' : 'possible_risk' })
  }

  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Icons.Info className="w-4 h-4" />
            <AlertTitle>Instructions for {childName}</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                {instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </AlertDescription>
          </Alert>
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-3">
              <p className="text-xs font-medium text-amber-800 mb-1">Conditions to look for:</p>
              <div className="flex flex-wrap gap-1">
                {instructions.conditions.map((c, i) => (
                  <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            </CardContent>
          </Card>
          <Button className="w-full" onClick={() => setStep(1)}>Start Camera</Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 1) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>Capture — {instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm bg-black/30 py-1">
              Position {childName}&apos;s face in frame
            </div>
          </div>
          <Button className="w-full" onClick={capturePhoto}>
            <Icons.Camera className="w-4 h-4 mr-2" /> Capture Photo
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle>Annotate — {instructions.title}</CardTitle></CardHeader>
        <CardContent>
          {capturedImage && (
            <ImageAnnotator imageSrc={capturedImage} pins={pins}
              onAddPin={(pin) => setPins(prev => [...prev, pin])}
              onRemovePin={(id) => setPins(prev => prev.filter(p => p.id !== id))}
              activeLabel={activePin?.label} activeSeverity={activePin?.severity} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <AnnotationChips chips={chips} selectedChips={selectedChips}
            onToggleChip={handleToggleChip} chipSeverities={chipSeverities}
            onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
            aiSuggestedChips={aiSuggestedChips} notes={notes} onNotesChange={setNotes}
            onComplete={handleComplete}
            onBack={() => { setCapturedImage(null); setStep(1); startCamera() }} />
        </CardContent>
      </Card>
    </div>
  )
}

export default GeneralAppearanceScreening
