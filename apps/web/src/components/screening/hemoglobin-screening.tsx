
import React from 'react'
import { ScreeningProps } from './types'
import { DeviceValueCapture } from './device-value-capture'
import { classifyAnemia } from '@/lib/ai/anthropometry'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'

export function HemoglobinScreening({
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
          <Card className="bg-blue-50 border-blue-200"><CardContent className="py-3">
            <p className="text-xs text-blue-700">WHO 2011 anemia classification. Exact cutoffs depend on child&apos;s age and gender. Using school-age (5-11y) defaults for on-screen classification.</p>
          </CardContent></Card>
          <Button className="w-full" onClick={() => setStep(1)}>Enter Reading</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <DeviceValueCapture
      label="Hemoglobin"
      unit="g/dL"
      min={3}
      max={20}
      step={0.1}
      placeholder="e.g., 11.5"
      contextInfo={`Hemoglobin reading for ${childName} (WHO 2011 cutoffs)`}
      classify={(value) => classifyAnemia(value, 120, 'male')}
      onSubmit={(value, evidenceImage) => {
        const classification = classifyAnemia(value, 120, 'male')
        onComplete({
          moduleType: 'hemoglobin',
          value,
          unit: 'g/dL',
          classification: classification.label,
          severity: classification.severity,
          evidenceImage,
        })
      }}
      onBack={() => setStep(0)}
    />
  )
}
