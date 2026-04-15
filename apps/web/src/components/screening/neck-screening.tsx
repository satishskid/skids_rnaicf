
import React, { useState } from 'react'
import { ScreeningProps } from './types'
import { getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import { ImageAnnotator } from './image-annotator'
import { VideoCapture } from './video-capture'
import { analyzeClinicalColors, mapSuggestionsToChipIds } from '@/lib/ai/clinical-color'
import { AnnotationPin, AnnotationData, Severity } from '@skids/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'
import { VideoAIPanel, VideoAIResult } from './video-ai-panel'

const MODULE_TYPE = 'neck'

export function NeckScreening({
  step, setStep, onComplete, instructions, childName,
}: ScreeningProps) {
  const [bestFrame, setBestFrame] = useState<string | null>(null)
  const [allFrames, setAllFrames] = useState<string[]>([])
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [pins, setPins] = useState<AnnotationPin[]>([])
  const [aiSuggestedChips, setAiSuggestedChips] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [activePin, setActivePin] = useState<{ label: string; severity?: Severity } | null>(null)
  const [lfmResult, setLfmResult] = useState<VideoAIResult | null>(null)

  const chips = getAnnotationConfig(MODULE_TYPE)

  const handleFramesReady = (frames: string[], best: string) => {
    setAllFrames(frames)
    setBestFrame(best)
    analyzeClinicalColors(best).then(result => {
      const suggested = mapSuggestionsToChipIds(result.suggestedChips, MODULE_TYPE)
      setAiSuggestedChips(suggested)
      setSelectedChips(prev => [...new Set([...prev, ...suggested])])
    }).catch(() => {})
    setStep(2)
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
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins, aiSuggestedChips, notes,
      evidenceImage: bestFrame || undefined,
      evidenceVideoFrames: allFrames,
    }
    onComplete({ moduleType: MODULE_TYPE, annotationData, riskCategory: selectedChips.length === 0 ? 'no_risk' : 'possible_risk', lfmResult: lfmResult || undefined })
  }

  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert><Icons.Info className="w-4 h-4" /><AlertTitle>Instructions for {childName}</AlertTitle>
            <AlertDescription><ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              {instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol></AlertDescription></Alert>
          <Card className="bg-amber-50 border-amber-200"><CardContent className="py-3">
            <p className="text-xs font-medium text-amber-800 mb-1">Conditions to look for:</p>
            <div className="flex flex-wrap gap-1">
              {instructions.conditions.map((c, i) => (
                <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          </CardContent></Card>
          <Button className="w-full" onClick={() => setStep(1)}>Start Recording</Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Record — {instructions.title}</h3>
        <VideoCapture
          onFramesReady={handleFramesReady}
          onBack={() => setStep(0)}
          maxDuration={15}
          cameraFacing="environment"
          instructions={`Record ${childName} from front while they swallow water. Watch for thyroid movement. Then palpate lymph node chains.`}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle>Annotate — {instructions.title}</CardTitle></CardHeader>
        <CardContent>
          {bestFrame && (
            <ImageAnnotator imageSrc={bestFrame} pins={pins}
              onAddPin={(pin) => setPins(prev => [...prev, pin])}
              onRemovePin={(id) => setPins(prev => prev.filter(p => p.id !== id))}
              activeLabel={activePin?.label} activeSeverity={activePin?.severity} />
          )}
        </CardContent></Card>
      {bestFrame && (
        <VideoAIPanel
          moduleType="neck"
          imageBase64={bestFrame}
          onAnalysisComplete={setLfmResult}
          childName={childName}
        />
      )}
      <Card><CardContent className="pt-4">
        <AnnotationChips chips={chips} selectedChips={selectedChips}
          onToggleChip={handleToggleChip} chipSeverities={chipSeverities}
          onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
          aiSuggestedChips={aiSuggestedChips} notes={notes} onNotesChange={setNotes}
          onComplete={handleComplete}
          onBack={() => { setBestFrame(null); setAllFrames([]); setStep(1) }} />
      </CardContent></Card>
    </div>
  )
}

export default NeckScreening
