
import React from 'react'
import { ScreeningProps } from './types'
import { DeviceValueCapture } from './device-value-capture'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'

export function HeightScreening({
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
            <p className="text-xs text-blue-700">WHO height-for-age Z-score will be calculated based on the child&apos;s age and gender.</p>
          </CardContent></Card>
          <Button className="w-full" onClick={() => setStep(1)}>Enter Measurement</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <DeviceValueCapture
      label="Height"
      unit="cm"
      min={30}
      max={220}
      step={0.1}
      placeholder="e.g., 140.5"
      contextInfo={`Measuring ${childName}`}
      classify={(value) => {
        if (value < 60) return { label: 'Below typical range', color: 'bg-yellow-50 border-yellow-300 text-yellow-700', severity: 'mild' }
        if (value > 190) return { label: 'Above typical range', color: 'bg-blue-50 border-blue-300 text-blue-700', severity: 'normal' }
        return { label: 'Value recorded', color: 'bg-green-50 border-green-300 text-green-700', severity: 'normal' }
      }}
      onSubmit={(value, evidenceImage) => {
        onComplete({
          moduleType: 'height',
          value,
          unit: 'cm',
          evidenceImage,
        })
      }}
      onBack={() => setStep(0)}
    />
  )
}

export default HeightScreening
