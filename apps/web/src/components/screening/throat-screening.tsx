
import React, { useState } from 'react'
import { ScreeningProps } from './types'
import { getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import { ImageAnnotator } from './image-annotator'
import { VideoCapture } from './video-capture'
import { analyzeClinicalColors, mapSuggestionsToChipIds } from '@/lib/ai/clinical-color'
import { classifyENTBase64, type ENTAnalysisResult } from '@/lib/ai/ent-classifier'
import { AnnotationPin, AnnotationData, Severity } from '@skids/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'

const MODULE_TYPE = 'throat'

export function ThroatScreening({
  step, setStep, onComplete, instructions, childName, childAge, orgConfig,
}: ScreeningProps) {
  const [bestFrame, setBestFrame] = useState<string | null>(null)
  const [allFrames, setAllFrames] = useState<string[]>([])
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [pins, setPins] = useState<AnnotationPin[]>([])
  const [aiSuggestedChips, setAiSuggestedChips] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [activePin, setActivePin] = useState<{ label: string; severity?: Severity } | null>(null)
  const [entResult, setEntResult] = useState<ENTAnalysisResult | null>(null)
  const [entRunning, setEntRunning] = useState(false)

  const chips = getAnnotationConfig(MODULE_TYPE)

  const handleFramesReady = (frames: string[], best: string) => {
    setAllFrames(frames)
    setBestFrame(best)
    analyzeClinicalColors(best).then(result => {
      const suggested = mapSuggestionsToChipIds(result.suggestedChips, MODULE_TYPE)
      setAiSuggestedChips(suggested)
      setSelectedChips(prev => [...new Set([...prev, ...suggested])])
    }).catch(() => {})
    // Run ENT classifier in background (no-op if model not downloaded)
    setEntRunning(true)
    classifyENTBase64(best, 0.4).then(result => {
      setEntResult(result)
      if (result?.findings.length) {
        const entChipIds = result.findings.map(f => f.chipId)
        setAiSuggestedChips(prev => [...new Set([...prev, ...entChipIds])])
      }
    }).catch(() => {}).finally(() => setEntRunning(false))
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
    onComplete({
      moduleType: MODULE_TYPE, annotationData,
      riskCategory: selectedChips.length === 0 ? 'no_risk' : 'possible_risk',
      entFindings: entResult ? entResult.findings.map(f => ({
        chipId: f.chipId, label: f.label, confidence: f.confidence, icdCode: f.icdCode,
      })) : undefined,
      entInferenceMs: entResult?.inferenceTimeMs,
    })
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
          maxDuration={10}
          cameraFacing="environment"
          instructions={`Ask ${childName} to say "Aah". Use phone flashlight. Quick capture — child comfort first.`}
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
          {/* ENT AI status */}
          {entRunning && (
            <div className="flex items-center gap-2 mt-2 text-xs text-blue-600">
              <Icons.Loader2 className="w-3 h-3 animate-spin" />
              <span>AI analyzing image...</span>
            </div>
          )}
          {entResult && entResult.findings.length > 0 && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-medium text-blue-700 mb-1">AI Detected ({entResult.inferenceTimeMs}ms):</p>
              <div className="flex flex-wrap gap-1">
                {entResult.findings.map(f => (
                  <Badge key={f.chipId} variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                    {f.label} ({Math.round(f.confidence * 100)}%)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent></Card>
      <Card><CardContent className="pt-4">
        <AnnotationChips chips={chips} selectedChips={selectedChips}
          onToggleChip={handleToggleChip} chipSeverities={chipSeverities}
          onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
          aiSuggestedChips={aiSuggestedChips} notes={notes} onNotesChange={setNotes}
          onComplete={handleComplete}
          onBack={() => { setBestFrame(null); setAllFrames([]); setStep(1) }}
          imageDataUrl={bestFrame || undefined}
          moduleType="throat" moduleName="Throat Screening"
          childAge={childAge} orgConfig={orgConfig}
          onAiSuggestChips={(chipIds) => {
            setAiSuggestedChips(prev => [...new Set([...prev, ...chipIds])])
            setSelectedChips(prev => [...new Set([...prev, ...chipIds])])
          }} />
      </CardContent></Card>
    </div>
  )
}
