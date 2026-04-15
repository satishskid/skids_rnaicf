
import React, { useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Icons } from '@/components/icons'
import { CustomModuleDefinition } from '@skids/shared'
import { getUserMediaWithFallback } from '@/lib/camera-utils'

interface CustomScreeningProps {
  moduleDefinition: CustomModuleDefinition
  step: number
  setStep: (s: number) => void
  onComplete: (results: Record<string, unknown>) => void
  childName: string
}

export function CustomScreening({
  moduleDefinition,
  step,
  setStep,
  onComplete,
  childName,
}: CustomScreeningProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [evidenceImage, setEvidenceImage] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [notes, setNotes] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await getUserMediaWithFallback('environment')
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setShowCamera(true)
    } catch (err) {
      console.error('Camera access failed:', err)
    }
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0)
      setEvidenceImage(canvas.toDataURL('image/jpeg', 0.8))
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    setShowCamera(false)
  }, [])

  // Instructions step
  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{moduleDefinition.instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Icons.Info className="w-4 h-4" />
            <AlertTitle>Instructions for {childName}</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                {moduleDefinition.instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </AlertDescription>
          </Alert>
          <Button className="w-full" onClick={() => setStep(1)}>Start</Button>
        </CardContent>
      </Card>
    )
  }

  // Data capture step
  const handleSubmit = () => {
    onComplete({
      moduleType: moduleDefinition.id,
      customModuleId: moduleDefinition.id,
      customModuleName: moduleDefinition.name,
      values,
      notes,
      evidenceImage,
      riskCategory: 'no_risk',
    })
  }

  // Render value-type capture
  if (moduleDefinition.captureType === 'value') {
    const vc = moduleDefinition.valueConfig
    if (!vc) return <p className="text-sm text-gray-500">Module configuration error: no valueConfig</p>

    // Multi-field values (like BP with systolic/diastolic)
    const fields = vc.fields && vc.fields.length > 0 ? vc.fields : [{ label: vc.label, unit: vc.unit, min: vc.min, max: vc.max, step: vc.step }]

    const allValid = fields.every(f => {
      const v = parseFloat(values[f.label] || '')
      return !isNaN(v) && v >= f.min && v <= f.max
    })

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-base font-semibold">{moduleDefinition.name}</Label>
              <p className="text-xs text-gray-500 mt-1">Measuring {childName}</p>
            </div>

            {fields.map((field) => (
              <div key={field.label} className="space-y-1">
                <Label className="text-xs text-gray-500">{field.label}</Label>
                <div className="flex items-end gap-2">
                  <Input
                    type="number"
                    value={values[field.label] || ''}
                    onChange={e => setValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                    placeholder={`${field.min}-${field.max}`}
                    min={field.min}
                    max={field.max}
                    step={field.step || 0.1}
                    className="text-xl font-bold h-12 text-center flex-1"
                  />
                  <span className="text-sm text-gray-500 pb-2">{field.unit}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Evidence photo */}
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm font-medium">Evidence Photo (optional)</Label>
            {showCamera ? (
              <div className="space-y-2 mt-2">
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" />
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1">Capture</Button>
                  <Button variant="outline" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false) }}>Cancel</Button>
                </div>
              </div>
            ) : evidenceImage ? (
              <div className="space-y-2 mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={evidenceImage} alt="Evidence" className="w-full rounded-lg" />
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setEvidenceImage(null); startCamera() }}>Retake</Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full h-16 border-dashed mt-2" onClick={startCamera}>
                <span className="text-sm text-gray-500">&#128247; Take Photo</span>
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
          <Button onClick={handleSubmit} disabled={!allValid} className="flex-1">Save &amp; Continue</Button>
        </div>
      </div>
    )
  }

  // Render form-type capture
  if (moduleDefinition.captureType === 'form') {
    const fields = moduleDefinition.formFields || []

    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <Label className="text-base font-semibold">{moduleDefinition.name}</Label>
            <p className="text-xs text-gray-500">Assessing {childName}</p>

            {fields.map((field) => (
              <div key={field.label} className="space-y-1">
                <Label className="text-xs">{field.label} {field.required && '*'}</Label>
                {field.type === 'select' && field.options ? (
                  <Select value={values[field.label] || ''} onValueChange={v => setValues(prev => ({ ...prev, [field.label]: v }))}>
                    <SelectTrigger><SelectValue placeholder={`Select ${field.label}`} /></SelectTrigger>
                    <SelectContent>
                      {field.options.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === 'number' ? (
                  <Input type="number" value={values[field.label] || ''} onChange={e => setValues(prev => ({ ...prev, [field.label]: e.target.value }))} />
                ) : (
                  <Input value={values[field.label] || ''} onChange={e => setValues(prev => ({ ...prev, [field.label]: e.target.value }))} />
                )}
              </div>
            ))}

            <div className="space-y-1">
              <Label className="text-xs">Additional Notes</Label>
              <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional observations..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
          <Button onClick={handleSubmit} className="flex-1">Save &amp; Continue</Button>
        </div>
      </div>
    )
  }

  // Render photo-type capture
  if (moduleDefinition.captureType === 'photo' || moduleDefinition.captureType === 'video') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <Label className="text-base font-semibold">{moduleDefinition.name}</Label>
            <p className="text-xs text-gray-500">Examining {childName}</p>

            {showCamera ? (
              <div className="space-y-2">
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" />
                <Button onClick={capturePhoto} className="w-full">Capture Photo</Button>
                <Button variant="outline" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false) }} className="w-full">Cancel</Button>
              </div>
            ) : evidenceImage ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={evidenceImage} alt="Capture" className="w-full rounded-lg" />
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setEvidenceImage(null); startCamera() }}>Retake</Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full h-32 border-dashed" onClick={startCamera}>
                <div className="text-center">
                  <Icons.Camera className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <span className="text-sm text-gray-500">Take Photo</span>
                </div>
              </Button>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe findings..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
          <Button onClick={handleSubmit} disabled={!evidenceImage} className="flex-1">Save &amp; Continue</Button>
        </div>
      </div>
    )
  }

  return <p className="text-sm text-gray-500">Unknown capture type: {moduleDefinition.captureType}</p>
}

export default CustomScreening
