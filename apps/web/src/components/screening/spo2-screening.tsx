
import React from 'react'
import { ScreeningProps } from './types'
import { DeviceValueCapture } from './device-value-capture'
import { classifySpO2 } from '@/lib/ai/anthropometry'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'

export function SpO2Screening({
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
            <p className="text-xs text-blue-700">Normal: &ge;95% | Mild hypoxia: 90-94% | Moderate: 85-89% | Severe: &lt;85%</p>
          </CardContent></Card>
          <Button className="w-full" onClick={() => setStep(1)}>Enter Reading</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <DeviceValueCapture
      label="SpO2"
      unit="%"
      min={50}
      max={100}
      step={1}
      placeholder="e.g., 98"
      contextInfo={`Pulse oximeter reading for ${childName}`}
      classify={(value) => classifySpO2(value)}
      bluetoothService="PULSE_OXIMETER"
      bluetoothField="spo2"
      shareTargetModule="spo2"
      onSubmit={(value, evidenceImage) => {
        const classification = classifySpO2(value)
        onComplete({
          moduleType: 'spo2',
          value,
          unit: '%',
          classification: classification.label,
          severity: classification.severity,
          evidenceImage,
        })
      }}
      onBack={() => setStep(0)}
    />
  )
}

export default SpO2Screening
