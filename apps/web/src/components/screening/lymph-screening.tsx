
import React, { useState } from 'react'
import { ScreeningProps } from './types'
import { getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import { AnnotationData, Severity } from '@skids/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const MODULE_TYPE = 'lymph'

interface LymphNodeFinding {
  present: boolean
  size?: string
  consistency?: 'soft' | 'firm' | 'hard'
  tender?: boolean
  fixed?: boolean
}

const NODE_GROUPS = [
  { key: 'cervicalAnterior', label: 'Cervical (Anterior)' },
  { key: 'cervicalPosterior', label: 'Cervical (Posterior)' },
  { key: 'submandibular', label: 'Submandibular' },
  { key: 'submental', label: 'Submental' },
  { key: 'axillary', label: 'Axillary' },
  { key: 'epitrochlear', label: 'Epitrochlear' },
  { key: 'inguinal', label: 'Inguinal' },
] as const

export function LymphScreening({
  step, setStep, onComplete, instructions, childName,
}: ScreeningProps) {
  const [findings, setFindings] = useState<Record<string, LymphNodeFinding>>({})
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [notes, setNotes] = useState('')

  const chips = getAnnotationConfig(MODULE_TYPE)

  const updateFinding = (key: string, update: Partial<LymphNodeFinding>) => {
    setFindings(prev => ({
      ...prev,
      [key]: { ...prev[key], present: prev[key]?.present || false, ...update }
    }))
  }

  const handleToggleChip = (chipId: string) => {
    setSelectedChips(prev =>
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    )
  }

  const handleComplete = () => {
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins: [], aiSuggestedChips: [], notes,
    }
    const presentNodes = Object.entries(findings).filter(([, v]) => v.present)
    onComplete({
      moduleType: MODULE_TYPE,
      findings,
      annotationData,
      riskCategory: presentNodes.length === 0 ? 'no_risk' : 'possible_risk',
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
            <p className="text-xs font-medium text-amber-800 mb-1">Check for:</p>
            <div className="flex flex-wrap gap-1">
              {instructions.conditions.map((c, i) => (
                <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          </CardContent></Card>
          <Button className="w-full" onClick={() => setStep(1)}>Begin Palpation</Button>
        </CardContent>
      </Card>
    )
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Lymph Node Palpation — {childName}</h3>
        <p className="text-xs text-gray-500">Use gentle circular motion. Compare both sides. Note size, consistency, tenderness, mobility.</p>

        {NODE_GROUPS.map(({ key, label }) => {
          const finding = findings[key] || { present: false }
          return (
            <Card key={key} className={finding.present ? 'border-orange-300 bg-orange-50/30' : ''}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{label}</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={finding.present ? 'default' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => updateFinding(key, { present: !finding.present })}
                    >
                      {finding.present ? 'Present' : 'Absent'}
                    </Button>
                  </div>
                </div>

                {finding.present && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs text-gray-500">Size (cm)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10"
                        placeholder="e.g., 1.5"
                        className="h-8 text-sm"
                        value={finding.size || ''}
                        onChange={(e) => updateFinding(key, { size: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Consistency</Label>
                      <Select
                        value={finding.consistency || ''}
                        onValueChange={(v) => updateFinding(key, { consistency: v as 'soft' | 'firm' | 'hard' })}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="soft">Soft</SelectItem>
                          <SelectItem value="firm">Firm</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`${key}-tender`}
                        checked={finding.tender || false}
                        onChange={(e) => updateFinding(key, { tender: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor={`${key}-tender`} className="text-xs">Tender</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`${key}-fixed`}
                        checked={finding.fixed || false}
                        onChange={(e) => updateFinding(key, { fixed: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor={`${key}-fixed`} className="text-xs">Fixed / Non-mobile</Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
          <Button onClick={() => setStep(2)} className="flex-1">Continue to Findings</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle>Summary — Lymph Nodes</CardTitle></CardHeader>
        <CardContent>
          {Object.entries(findings).filter(([, v]) => v.present).length === 0 ? (
            <p className="text-sm text-gray-500">No lymph nodes palpable — normal finding.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(findings).filter(([, v]) => v.present).map(([key, f]) => {
                const group = NODE_GROUPS.find(g => g.key === key)
                return (
                  <div key={key} className="text-sm p-2 bg-orange-50 rounded-lg">
                    <strong>{group?.label}</strong>: {f.size || '?'}cm, {f.consistency || '?'},
                    {f.tender ? ' tender' : ' non-tender'}, {f.fixed ? ' fixed' : ' mobile'}
                  </div>
                )
              })}
            </div>
          )}
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

export default LymphScreening
