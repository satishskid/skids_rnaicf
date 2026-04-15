
import React, { useState } from 'react'
import { ScreeningProps } from './types'
import { getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import { ImageAnnotator } from './image-annotator'
import { analyzeClinicalColors, mapSuggestionsToChipIds } from '@/lib/ai/clinical-color'
import { segmentWound } from '@/lib/ai/skin'
import { AnnotationPin, AnnotationData, Severity, type CaptureItem } from '@skids/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'
import { MultiCapture, type MultiCaptureConfig } from './multi-capture'
import { TapToSegment } from './tap-to-segment'

const MODULE_TYPE = 'skin'

export function SkinScreening({
  step, setStep, onComplete, instructions, childName, childAge, orgConfig,
}: ScreeningProps) {
  const [captures, setCaptures] = useState<CaptureItem[]>([])
  const [videoFrames, setVideoFrames] = useState<string[] | undefined>()
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [pins, setPins] = useState<AnnotationPin[]>([])
  const [aiSuggestedChips, setAiSuggestedChips] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [activePin, setActivePin] = useState<{ label: string; severity?: Severity } | null>(null)
  const [reviewImageIndex, setReviewImageIndex] = useState(0)

  const chips = getAnnotationConfig(MODULE_TYPE)

  const multiCaptureConfig: MultiCaptureConfig = {
    maxPhotos: 10,
    allowVideo: true,
    videoMaxDuration: 15,
    cameraFacing: 'environment',
    labelPrefix: 'Lesion',
    childName,
    moduleTitle: 'Skin Examination',
  }

  const analyzeImage = (imageData: ImageData): Record<string, unknown> | null => {
    const result = segmentWound(imageData)
    return {
      woundDetected: result.woundArea > 0,
      woundArea: result.woundArea,
      granulation: result.tissueComposition.granulation,
      slough: result.tissueComposition.slough,
      necrotic: result.tissueComposition.necrotic,
    }
  }

  const handleCapturesComplete = (capturedItems: CaptureItem[], frames?: string[]) => {
    setCaptures(capturedItems)
    setVideoFrames(frames)

    // Run AI color analysis on the first capture for chip suggestions
    if (capturedItems.length > 0) {
      analyzeClinicalColors(capturedItems[0].imageDataUrl).then(result => {
        const suggested = mapSuggestionsToChipIds(result.suggestedChips, MODULE_TYPE)
        setAiSuggestedChips(suggested)
        setSelectedChips(prev => [...new Set([...prev, ...suggested])])
      }).catch(() => {})
    }

    setStep(2) // go to annotation step
  }

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
    const primaryImage = captures[0]?.imageDataUrl || videoFrames?.[0]
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins, aiSuggestedChips, notes,
      evidenceImage: primaryImage,
      evidenceVideoFrames: videoFrames,
      captures,
    }

    // Aggregate wound analysis from all captures
    const woundCaptures = captures.filter(c => c.aiAnalysis?.woundDetected)
    const totalWoundArea = captures.reduce((sum, c) => sum + ((c.aiAnalysis?.woundArea as number) || 0), 0)

    onComplete({
      moduleType: MODULE_TYPE,
      annotationData,
      captureCount: captures.length,
      hasVideo: !!videoFrames,
      woundDetected: woundCaptures.length > 0,
      totalWoundArea,
      confidence: 0.85,
      riskCategory: selectedChips.length === 0 ? 'no_risk' : 'possible_risk',
      qualityFlags: ['analyzed'],
    })
  }

  // Step 0: Instructions
  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Icons.Info className="w-4 h-4" />
            <AlertTitle>Multi-Capture Skin Exam</AlertTitle>
            <AlertDescription className="text-sm">
              Take multiple photos of different skin areas or record a video. AI analyzes each image for wound characteristics. All processing stays on device.
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
          <div className="space-y-1">
            {instructions.tips.map((tip, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <Icons.Info className="w-3 h-3 text-gray-400" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={() => setStep(1)}>
            <Icons.Camera className="w-4 h-4 mr-2" />
            Start Capture
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Step 1: MultiCapture (photos or video)
  if (step === 1) {
    return (
      <MultiCapture
        config={multiCaptureConfig}
        onComplete={handleCapturesComplete}
        onBack={() => setStep(0)}
        analyzeImage={analyzeImage}
      />
    )
  }

  // Step 2: Annotation on captured images
  const currentImage = captures[reviewImageIndex]?.imageDataUrl || videoFrames?.[0]

  return (
    <div className="space-y-4">
      {/* Image navigation for multiple captures */}
      {captures.length > 1 && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-medium text-gray-600 mb-2">Captured images ({captures.length}):</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {captures.map((cap, i) => (
                <button
                  key={cap.id}
                  onClick={() => setReviewImageIndex(i)}
                  className={`relative flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 ${
                    i === reviewImageIndex ? 'border-blue-500' : 'border-gray-200'
                  }`}
                >
                  <img src={cap.imageDataUrl} alt={cap.label} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 text-[7px] bg-black/50 text-white text-center truncate">
                    {cap.label}
                  </span>
                  {cap.aiAnalysis?.woundDetected && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image annotator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Annotate — {captures[reviewImageIndex]?.label || 'Skin'}</span>
            {captures[reviewImageIndex]?.aiAnalysis?.woundDetected && (
              <span className="text-xs text-red-600 font-normal">
                Wound area: {(captures[reviewImageIndex].aiAnalysis!.woundArea as number).toFixed(1)} cm²
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentImage && (
            <>
              <ImageAnnotator
                imageSrc={currentImage}
                pins={pins}
                onAddPin={(pin) => setPins(prev => [...prev, pin])}
                onRemovePin={(id) => setPins(prev => prev.filter(p => p.id !== id))}
                activeLabel={activePin?.label}
                activeSeverity={activePin?.severity}
              />
              <div className="mt-3">
                <TapToSegment
                  imageBase64={currentImage}
                  imageKey={captures[reviewImageIndex]?.id}
                  onSegmentComplete={(mask, outline, result) => {
                    // Store segmentation data with the current capture
                    setCaptures(prev => prev.map((cap, i) =>
                      i === reviewImageIndex
                        ? { ...cap, aiAnalysis: { ...cap.aiAnalysis, segmentationMask: outline, segmentationArea: result.area } }
                        : cap
                    ))
                  }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Annotation chips */}
      <Card>
        <CardContent className="pt-4">
          <AnnotationChips
            chips={chips}
            selectedChips={selectedChips}
            onToggleChip={handleToggleChip}
            chipSeverities={chipSeverities}
            onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
            aiSuggestedChips={aiSuggestedChips}
            notes={notes}
            onNotesChange={setNotes}
            onComplete={handleComplete}
            onBack={() => setStep(1)}
            imageDataUrl={captures[0]?.imageDataUrl}
            moduleType={MODULE_TYPE}
            moduleName="Skin Screening"
            childAge={childAge}
            orgConfig={orgConfig}
            onAiSuggestChips={(chipIds) => {
              setAiSuggestedChips(prev => [...new Set([...prev, ...chipIds])])
              setSelectedChips(prev => [...new Set([...prev, ...chipIds])])
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default SkinScreening
