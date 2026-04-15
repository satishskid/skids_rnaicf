
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ScreeningProps } from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Icons } from '@/components/icons'
import { useBluetoothDevice } from '@/hooks/use-bluetooth-device'
import { getUserMediaWithFallback } from '@/lib/camera-utils'

// Simplified pediatric BP classification (AAP 2017 guidelines simplified)
function classifyBP(systolic: number, diastolic: number): { label: string; color: string; severity: string } {
  // Simplified thresholds for school-age children (not percentile-based for MVP)
  if (systolic >= 140 || diastolic >= 90) {
    return { label: 'Stage 2 Hypertension', color: 'bg-red-50 border-red-300 text-red-700', severity: 'high_risk' }
  }
  if (systolic >= 130 || diastolic >= 80) {
    return { label: 'Stage 1 Hypertension', color: 'bg-orange-50 border-orange-300 text-orange-700', severity: 'possible_risk' }
  }
  if (systolic >= 120 || diastolic >= 80) {
    return { label: 'Elevated', color: 'bg-yellow-50 border-yellow-300 text-yellow-700', severity: 'possible_risk' }
  }
  if (systolic < 70 || diastolic < 40) {
    return { label: 'Low - Verify Reading', color: 'bg-blue-50 border-blue-300 text-blue-700', severity: 'possible_risk' }
  }
  return { label: 'Normal', color: 'bg-green-50 border-green-300 text-green-700', severity: 'normal' }
}

export function BPScreening({
  step, setStep, onComplete, instructions, childName,
}: ScreeningProps) {
  const [systolic, setSystolic] = useState<string>('')
  const [diastolic, setDiastolic] = useState<string>('')
  const [evidenceImage, setEvidenceImage] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [bleSource, setBleSource] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ── Web Bluetooth for BLE blood pressure cuffs ──
  const ble = useBluetoothDevice({ serviceType: 'BLOOD_PRESSURE', autoDisconnect: true })

  // Auto-fill from BLE reading
  useEffect(() => {
    if (!ble.lastReading) return
    if (ble.lastReading.systolic !== undefined) setSystolic(ble.lastReading.systolic.toString())
    if (ble.lastReading.diastolic !== undefined) setDiastolic(ble.lastReading.diastolic.toString())
    setBleSource(ble.lastReading.deviceName)
  }, [ble.lastReading])

  // ── Web Share Target pickup ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem('skids_shared_reading')
      if (!stored) return
      const reading = JSON.parse(stored)
      const receivedAt = new Date(reading.receivedAt).getTime()
      if (Date.now() - receivedAt > 5 * 60 * 1000) { localStorage.removeItem('skids_shared_reading'); return }
      if (reading.module === 'bp' && reading.value) {
        setSystolic(reading.value)
        if (reading.value2) setDiastolic(reading.value2)
        setBleSource(reading.device || 'Companion App')
        localStorage.removeItem('skids_shared_reading')
      }
    } catch { /* ignore */ }
  }, [])

  const sysVal = parseFloat(systolic)
  const diaVal = parseFloat(diastolic)
  const isValid = !isNaN(sysVal) && !isNaN(diaVal) && sysVal >= 50 && sysVal <= 250 && diaVal >= 20 && diaVal <= 150 && sysVal > diaVal

  const classification = isValid ? classifyBP(sysVal, diaVal) : null

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

  const handleSubmit = () => {
    if (!isValid || !classification) return
    const riskCategory = classification.severity === 'high_risk' ? 'high_risk'
      : classification.severity === 'possible_risk' ? 'possible_risk' : 'no_risk'

    onComplete({
      moduleType: 'bp',
      systolic: sysVal,
      diastolic: diaVal,
      unit: 'mmHg',
      classification: classification.label,
      riskCategory,
      evidenceImage,
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
          <Card className="bg-red-50 border-red-200"><CardContent className="py-3">
            <p className="text-xs text-red-700">Use an appropriately sized cuff. Pediatric BP norms vary by age, sex, and height percentile. This tool uses simplified thresholds.</p>
          </CardContent></Card>
          {ble.isSupported && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">&#128225;</span>
                  <Label className="text-sm font-semibold text-blue-800">Bluetooth BP Cuff</Label>
                </div>
                <Button
                  onClick={async () => {
                    const paired = await ble.requestDevice()
                    if (paired) {
                      await ble.readOnce()
                      setStep(1)
                    }
                  }}
                  variant="outline"
                  className="w-full h-11 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  {ble.deviceName ? `Reconnect ${ble.deviceName}` : 'Pair BP Cuff'}
                </Button>
                {ble.error && <p className="text-xs text-red-600">{ble.error}</p>}
                <p className="text-xs text-gray-500 text-center">Or enter manually below</p>
              </CardContent>
            </Card>
          )}
          <Button className="w-full" onClick={() => setStep(1)}>Enter Measurement</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-base font-semibold">Blood Pressure</Label>
            <p className="text-xs text-gray-500 mt-1">Measuring {childName}</p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-gray-500">Systolic</Label>
              <Input
                type="number"
                value={systolic}
                onChange={e => setSystolic(e.target.value)}
                placeholder="120"
                min={50} max={250}
                className="text-2xl font-bold h-14 text-center"
              />
            </div>
            <div className="text-2xl font-bold text-gray-400 pb-3">/</div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-gray-500">Diastolic</Label>
              <Input
                type="number"
                value={diastolic}
                onChange={e => setDiastolic(e.target.value)}
                placeholder="80"
                min={20} max={150}
                className="text-2xl font-bold h-14 text-center"
              />
            </div>
            <div className="text-lg font-medium text-gray-500 pb-3">mmHg</div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Systolic: 50–250 mmHg &bull; Diastolic: 20–150 mmHg
          </p>

          {bleSource && (
            <p className="text-xs text-blue-600 text-center">
              &#9889; Auto-filled from {bleSource}
            </p>
          )}

          {ble.isSupported && !ble.isConnected && step === 1 && (
            <Button
              onClick={async () => {
                const paired = ble.deviceName ? true : await ble.requestDevice()
                if (paired) await ble.readOnce()
              }}
              variant="ghost"
              size="sm"
              className="w-full text-xs text-blue-600"
            >
              &#128225; {ble.deviceName ? 'Read from ' + ble.deviceName : 'Connect BLE Device'}
            </Button>
          )}

          {classification && (
            <div className={`p-3 rounded-lg border-2 ${classification.color}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{classification.label}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {sysVal}/{diaVal} mmHg
                </Badge>
              </div>
            </div>
          )}

          {!isValid && systolic && diastolic && sysVal <= diaVal && (
            <p className="text-xs text-red-500 text-center">Systolic must be greater than diastolic</p>
          )}
        </CardContent>
      </Card>

      {/* Evidence photo */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium">Evidence Photo (optional)</Label>
          <p className="text-xs text-gray-500 mb-3">Photograph the BP monitor reading</p>

          {showCamera ? (
            <div className="space-y-2">
              <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" />
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">Capture</Button>
                <Button variant="outline" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false) }}>Cancel</Button>
              </div>
            </div>
          ) : evidenceImage ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={evidenceImage} alt="Evidence" className="w-full rounded-lg" />
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setEvidenceImage(null); startCamera() }}>Retake Photo</Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full h-24 border-dashed" onClick={startCamera}>
              <div className="text-center">
                <span className="text-2xl block mb-1">&#128247;</span>
                <span className="text-sm text-gray-500">Take Photo of Reading</span>
              </div>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
        <Button onClick={handleSubmit} disabled={!isValid} className="flex-1">Save &amp; Continue</Button>
      </div>
    </div>
  )
}

export default BPScreening
