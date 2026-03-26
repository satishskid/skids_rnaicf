
import React from 'react'
import { ScreeningProps } from './types'
import { DeviceValueCapture } from './device-value-capture'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'

export function WeightScreening({
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
            <p className="text-xs text-blue-700">WHO weight-for-age Z-score and BMI will be calculated based on the child&apos;s age and gender.</p>
          </CardContent></Card>
          <Button className="w-full" onClick={() => setStep(1)}>Enter Measurement</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <DeviceValueCapture
      label="Weight"
      unit="kg"
      min={1}
      max={200}
      step={0.1}
      placeholder="e.g., 35.5"
      contextInfo={`Measuring ${childName}`}
      classify={(value) => {
        if (value < 5) return { label: 'Very low weight', color: 'bg-red-50 border-red-300 text-red-700', severity: 'severe' }
        if (value < 10) return { label: 'Low weight', color: 'bg-yellow-50 border-yellow-300 text-yellow-700', severity: 'mild' }
        return { label: 'Value recorded', color: 'bg-green-50 border-green-300 text-green-700', severity: 'normal' }
      }}
      onSubmit={(value, evidenceImage) => {
        onComplete({
          moduleType: 'weight',
          value,
          unit: 'kg',
          evidenceImage,
        })
      }}
      onBack={() => setStep(0)}
    />
  )
}
