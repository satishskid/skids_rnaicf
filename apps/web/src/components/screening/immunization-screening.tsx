
import React, { useState, useRef } from 'react'
import { ScreeningProps } from './types'
import { getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import { AnnotationData, Severity, VaccineEntry } from '@skids/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'
import { Label } from '@/components/ui/label'

const MODULE_TYPE = 'immunization'

type DoseStatus = 'given' | 'not_given' | 'unknown'
type EvidenceType = 'oral' | 'card_photo'

interface DoseRecord {
  status: DoseStatus
  dateGiven?: string
  evidenceType?: EvidenceType
}

interface VaccineRecord {
  vaccineId: string
  doses: Record<number, DoseRecord> // dose index -> record
}

export function ImmunizationScreening({
  step, setStep, onComplete, instructions, childName,
}: ScreeningProps & { schedule?: VaccineEntry[] }) {
  const [records, setRecords] = useState<Record<string, VaccineRecord>>({})
  const [cardPhoto, setCardPhoto] = useState<string | null>(null)
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [notes, setNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chips = getAnnotationConfig(MODULE_TYPE)

  // Get schedule from window (passed via appSettings)
  const getSchedule = (): VaccineEntry[] => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skids_immunization_schedule')
        if (stored) return JSON.parse(stored)
      } catch { /* ignore */ }
    }
    return []
  }

  const schedule = getSchedule()

  const updateDose = (vaccineId: string, doseIndex: number, update: Partial<DoseRecord>) => {
    setRecords(prev => {
      const vaccineRecord = prev[vaccineId] || { vaccineId, doses: {} }
      const currentDose = vaccineRecord.doses[doseIndex] || { status: 'unknown' as DoseStatus }
      return {
        ...prev,
        [vaccineId]: {
          ...vaccineRecord,
          doses: {
            ...vaccineRecord.doses,
            [doseIndex]: { ...currentDose, ...update }
          }
        }
      }
    })
  }

  const getDoseStatus = (vaccineId: string, doseIndex: number): DoseStatus => {
    return records[vaccineId]?.doses[doseIndex]?.status || 'unknown'
  }

  const handleCardPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-uploaded
    e.target.value = ''
    const reader = new FileReader()
    reader.onloadend = () => {
      setCardPhoto(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Compute classification
  const computeClassification = (): { label: string; color: string; risk: 'no_risk' | 'possible_risk' | 'high_risk' } => {
    if (schedule.length === 0) return { label: 'No Schedule', color: 'gray', risk: 'no_risk' }

    let totalDoses = 0
    let givenDoses = 0
    let unknownDoses = 0

    schedule.forEach(vaccine => {
      for (let d = 0; d < vaccine.doses; d++) {
        totalDoses++
        const status = getDoseStatus(vaccine.id, d)
        if (status === 'given') givenDoses++
        if (status === 'unknown') unknownDoses++
      }
    })

    if (totalDoses === 0) return { label: 'No Vaccines', color: 'gray', risk: 'no_risk' }

    const pct = givenDoses / totalDoses
    if (pct >= 1) return { label: 'Fully Immunized', color: 'green', risk: 'no_risk' }
    if (pct >= 0.5) return { label: 'Partially Immunized', color: 'yellow', risk: 'possible_risk' }
    if (givenDoses > 0) return { label: 'Under-Immunized', color: 'orange', risk: 'possible_risk' }
    if (unknownDoses === totalDoses) return { label: 'Unknown Status', color: 'gray', risk: 'possible_risk' }
    return { label: 'Not Immunized', color: 'red', risk: 'high_risk' }
  }

  const handleToggleChip = (chipId: string) => {
    setSelectedChips(prev =>
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    )
  }

  const handleComplete = () => {
    const classification = computeClassification()
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins: [], aiSuggestedChips: [], notes,
    }
    onComplete({
      moduleType: MODULE_TYPE,
      records,
      cardPhoto,
      classification: classification.label,
      annotationData,
      riskCategory: classification.risk,
    })
  }

  // Step 0: Instructions
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
            <p className="text-xs font-medium text-amber-800 mb-1">Check for:</p>
            <div className="flex flex-wrap gap-1">
              {instructions.conditions.map((c, i) => (
                <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          </CardContent></Card>
          {schedule.length === 0 && (
            <Alert className="border-red-200 bg-red-50">
              <Icons.AlertTriangle className="w-4 h-4 text-red-600" />
              <AlertTitle className="text-red-800">No Immunization Schedule</AlertTitle>
              <AlertDescription className="text-red-700 text-sm">
                No immunization schedule has been configured. Ask your admin to set up the vaccine schedule in Settings &rarr; Modules tab.
              </AlertDescription>
            </Alert>
          )}
          <Button className="w-full" onClick={() => setStep(1)} disabled={schedule.length === 0}>
            Begin Immunization Check
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Step 1: Vaccine checklist
  if (step === 1) {
    const statusColors: Record<DoseStatus, string> = {
      given: 'bg-green-500 text-white',
      not_given: 'bg-red-500 text-white',
      unknown: 'bg-gray-200 text-gray-600',
    }
    const statusLabels: Record<DoseStatus, string> = {
      given: 'Given',
      not_given: 'Not Given',
      unknown: '?',
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Immunization Record &mdash; {childName}</h3>
        <p className="text-xs text-gray-500">
          Ask parent/guardian about vaccination history. Mark each dose as Given, Not Given, or Unknown.
        </p>

        {/* Evidence capture */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Vaccination Card Photo</Label>
                <p className="text-xs text-gray-500">Take a photo of the vaccination card if available</p>
              </div>
              {cardPhoto ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 font-medium">Captured</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setCardPhoto(null)}>Remove</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}>
                  <Icons.Camera className="w-3 h-3 mr-1" />Capture
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCardPhotoCapture}
            />
            {cardPhoto && (
              <div className="mt-2">
                <img src={cardPhoto} alt="Vaccination card" className="w-full rounded-lg max-h-40 object-cover" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vaccine list */}
        {schedule.map(vaccine => (
          <Card key={vaccine.id}>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">{vaccine.name}</Label>
              <div className="space-y-2">
                {Array.from({ length: vaccine.doses }, (_, doseIndex) => {
                  const status = getDoseStatus(vaccine.id, doseIndex)
                  const ageLabel = vaccine.ageLabels[doseIndex] || `Dose ${doseIndex + 1}`
                  return (
                    <div key={doseIndex} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{ageLabel}</span>
                      <div className="flex gap-1 flex-1">
                        {(['given', 'not_given', 'unknown'] as DoseStatus[]).map(s => (
                          <button
                            key={s}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              status === s
                                ? statusColors[s]
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            onClick={() => updateDose(vaccine.id, doseIndex, { status: s })}
                          >
                            {statusLabels[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
          <Button onClick={() => setStep(2)} className="flex-1">Continue to Summary</Button>
        </div>
      </div>
    )
  }

  // Step 2: Summary + annotation chips
  const classification = computeClassification()
  const classificationBg: Record<string, string> = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
    gray: 'bg-gray-50 border-gray-200',
  }
  const classificationText: Record<string, string> = {
    green: 'text-green-700',
    yellow: 'text-yellow-700',
    orange: 'text-orange-700',
    red: 'text-red-700',
    gray: 'text-gray-700',
  }

  // Count dose stats
  let totalDoses = 0, givenCount = 0, notGivenCount = 0, unknownCount = 0
  schedule.forEach(vaccine => {
    for (let d = 0; d < vaccine.doses; d++) {
      totalDoses++
      const s = getDoseStatus(vaccine.id, d)
      if (s === 'given') givenCount++
      else if (s === 'not_given') notGivenCount++
      else unknownCount++
    }
  })

  return (
    <div className="space-y-4">
      <Card className={classificationBg[classification.color] || 'bg-gray-50'}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-base ${classificationText[classification.color] || ''}`}>
            {classification.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-100 rounded-lg p-2">
              <p className="text-lg font-bold text-green-700">{givenCount}</p>
              <p className="text-xs text-green-600">Given</p>
            </div>
            <div className="bg-red-100 rounded-lg p-2">
              <p className="text-lg font-bold text-red-700">{notGivenCount}</p>
              <p className="text-xs text-red-600">Not Given</p>
            </div>
            <div className="bg-gray-100 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-700">{unknownCount}</p>
              <p className="text-xs text-gray-600">Unknown</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {givenCount} of {totalDoses} total doses recorded as given
          </p>

          {cardPhoto && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500 mb-1">Evidence: Vaccination card photo captured</p>
              <img src={cardPhoto} alt="Vaccination card" className="w-full rounded-lg max-h-32 object-cover" />
            </div>
          )}

          {/* Per-vaccine breakdown */}
          <div className="mt-3 pt-3 border-t space-y-1">
            {schedule.map(vaccine => {
              const given = Array.from({ length: vaccine.doses }, (_, i) =>
                getDoseStatus(vaccine.id, i) === 'given'
              ).filter(Boolean).length
              return (
                <div key={vaccine.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{vaccine.name}</span>
                  <span className={given === vaccine.doses ? 'text-green-600 font-medium' : 'text-orange-600'}>
                    {given}/{vaccine.doses} doses
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <AnnotationChips chips={chips} selectedChips={selectedChips}
            onToggleChip={handleToggleChip} chipSeverities={chipSeverities}
            onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
            aiSuggestedChips={[]} notes={notes} onNotesChange={setNotes}
            onComplete={handleComplete}
            onBack={() => setStep(1)} />
        </CardContent>
      </Card>
    </div>
  )
}

export default ImmunizationScreening
