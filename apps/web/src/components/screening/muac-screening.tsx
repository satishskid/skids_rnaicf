
import React from 'react'
import { ScreeningProps } from './types'
import { DeviceValueCapture } from './device-value-capture'
import { classifyMUAC } from '@/lib/ai/anthropometry'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'

export function MUACScreening({
  step, setStep, onComplete, instructions, childName,
}: ScreeningProps) {

  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert><Icons.Info className="w-4 h-4" /><AlertTitle>Instructions for {childName}</AlertTitle>
            <AlertDescription><ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              {instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol></AlertDescription></Alert>

          {/* WHO MUAC color band legend */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="py-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">WHO MUAC Color Bands (6-59 months)</p>
              <div className="flex gap-2">
                <div className="flex-1 text-center py-2 rounded-lg bg-red-100 border-2 border-red-300">
                  <span className="text-xs font-bold text-red-700">&lt; 115 mm</span>
                  <p className="text-[10px] text-red-600 font-medium">SAM (Red)</p>
                </div>
                <div className="flex-1 text-center py-2 rounded-lg bg-yellow-100 border-2 border-yellow-300">
                  <span className="text-xs font-bold text-yellow-700">115-125 mm</span>
                  <p className="text-[10px] text-yellow-600 font-medium">MAM (Yellow)</p>
                </div>
                <div className="flex-1 text-center py-2 rounded-lg bg-green-100 border-2 border-green-300">
                  <span className="text-xs font-bold text-green-700">&gt; 125 mm</span>
                  <p className="text-[10px] text-green-600 font-medium">Normal (Green)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={() => setStep(1)}>Enter Measurement</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <DeviceValueCapture
      label="MUAC"
      unit="mm"
      min={60}
      max={320}
      step={1}
      placeholder="e.g., 135"
      contextInfo={`Mid-upper arm circumference for ${childName} (WHO cutoffs, 6-59 months)`}
      classify={(value) => classifyMUAC(value)}
      onSubmit={(value, evidenceImage) => {
        const classification = classifyMUAC(value)
        // Map MUAC band to annotation chip for 4D report integration
        const chipId = classification.band === 'red' ? 'muac1'
          : classification.band === 'yellow' ? 'muac2' : 'muac3'
        onComplete({
          moduleType: 'muac',
          value,
          unit: 'mm',
          classification: classification.label,
          severity: classification.severity,
          band: classification.band,
          evidenceImage,
          riskCategory: classification.band === 'red' ? 'high_risk'
            : classification.band === 'yellow' ? 'possible_risk' : 'no_risk',
          annotationData: {
            selectedChips: [chipId],
            chipSeverities: classification.band !== 'green'
              ? { [chipId]: classification.band === 'red' ? 'severe' : 'moderate' }
              : {},
          },
        })
      }}
      onBack={() => setStep(0)}
    />
  )
}
