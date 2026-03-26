
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useBluetoothDevice } from '@/hooks/use-bluetooth-device'
import type { BLEServiceType, BLEReading } from '@/lib/ble'
import { getUserMediaWithFallback } from '@/lib/camera-utils'

interface DeviceValueCaptureProps {
  label: string
  unit: string
  min: number
  max: number
  step?: number
  placeholder?: string
  onSubmit: (value: number, evidenceImage?: string) => void
  onBack?: () => void
  /** Classification function: given value, returns {label, color} */
  classify?: (value: number) => { label: string; color: string; severity: string }
  /** Additional context (e.g., child's age) for classification display */
  contextInfo?: string
  /** BLE service type for auto-reading from a paired Bluetooth device */
  bluetoothService?: BLEServiceType
  /** Which field from BLEReading to auto-fill (e.g., 'spo2', 'heartRate') */
  bluetoothField?: keyof BLEReading
  /** Module type for Web Share Target pickup (e.g., 'spo2') */
  shareTargetModule?: string
}

export function DeviceValueCapture({
  label,
  unit,
  min,
  max,
  step = 0.1,
  placeholder,
  onSubmit,
  onBack,
  classify,
  contextInfo,
  bluetoothService,
  bluetoothField,
  shareTargetModule,
}: DeviceValueCaptureProps) {
  const [value, setValue] = useState<string>('')
  const [evidenceImage, setEvidenceImage] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [bleSource, setBleSource] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ── Web Bluetooth (only active when bluetoothService prop is provided) ──
  const ble = useBluetoothDevice({
    serviceType: bluetoothService || 'PULSE_OXIMETER', // default doesn't matter if not rendered
    autoDisconnect: true,
  })
  const showBLE = !!bluetoothService && ble.isSupported

  // Auto-fill from BLE reading
  useEffect(() => {
    if (!ble.lastReading || !bluetoothField) return
    const readValue = ble.lastReading[bluetoothField]
    if (readValue !== undefined && readValue !== null && typeof readValue === 'number') {
      setValue(readValue.toString())
      setBleSource(ble.lastReading.deviceName)
    }
  }, [ble.lastReading, bluetoothField])

  // ── Web Share Target pickup (check for shared reading from companion app) ──
  useEffect(() => {
    if (!shareTargetModule) return
    try {
      const stored = localStorage.getItem('skids_shared_reading')
      if (!stored) return
      const reading = JSON.parse(stored)
      // Check if recent (<5 minutes) and matches this module
      const receivedAt = new Date(reading.receivedAt).getTime()
      if (Date.now() - receivedAt > 5 * 60 * 1000) {
        localStorage.removeItem('skids_shared_reading')
        return
      }
      if (reading.module === shareTargetModule && reading.value) {
        setValue(reading.value)
        setBleSource(reading.device || 'Companion App')
        localStorage.removeItem('skids_shared_reading')
      }
    } catch {
      // ignore parse errors
    }
  }, [shareTargetModule])

  const numValue = parseFloat(value)
  const isValid = !isNaN(numValue) && numValue >= min && numValue <= max

  const classification = isValid && classify ? classify(numValue) : null

  const startCamera = useCallback(async () => {
    try {
      const stream = await getUserMediaWithFallback('environment')
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
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
    // Stop camera
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setShowCamera(false)
  }, [])

  const handleSubmit = () => {
    if (!isValid) return
    onSubmit(numValue, evidenceImage || undefined)
  }

  return (
    <div className="space-y-4">
      {/* BLE device connection (only on supported platforms with bluetoothService prop) */}
      {showBLE && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">&#128225;</span>
              <Label className="text-sm font-semibold text-blue-800">
                Bluetooth {ble.serviceLabel}
              </Label>
            </div>

            {ble.isConnecting ? (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Connecting...
              </div>
            ) : ble.isConnected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    &#9679; {ble.deviceName}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-gray-500"
                    onClick={ble.disconnect}
                  >
                    Disconnect
                  </Button>
                </div>
                <Button
                  onClick={async () => { await ble.readOnce() }}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700"
                >
                  Read Value
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {ble.deviceName && (
                  <p className="text-xs text-gray-500">Last paired: {ble.deviceName}</p>
                )}
                <Button
                  onClick={async () => {
                    const paired = await ble.requestDevice()
                    if (paired) await ble.readOnce()
                  }}
                  variant="outline"
                  className="w-full h-11 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Pair {ble.serviceLabel}
                </Button>
              </div>
            )}

            {ble.error && (
              <p className="text-xs text-red-600 bg-red-50 rounded p-2">{ble.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Value input */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-base font-semibold">{label}</Label>
            {contextInfo && (
              <p className="text-xs text-gray-500 mt-1">{contextInfo}</p>
            )}
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder || `Enter ${label.toLowerCase()}`}
                min={min}
                max={max}
                step={step}
                className="text-2xl font-bold h-14 text-center"
              />
            </div>
            <div className="text-lg font-medium text-gray-500 pb-3">{unit}</div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Range: {min} - {max} {unit}
          </p>

          {bleSource && (
            <p className="text-xs text-blue-600 text-center">
              &#9889; Auto-filled from {bleSource}
            </p>
          )}

          {/* Classification display */}
          {classification && (
            <div className={`p-3 rounded-lg border-2 ${classification.color}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{classification.label}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {classification.severity}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence photo */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium">Evidence Photo (optional)</Label>
          <p className="text-xs text-gray-500 mb-3">
            Photograph the device reading for verification
          </p>

          {showCamera ? (
            <div className="space-y-2">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg"
              />
              <div className="flex gap-2">
                <Button onClick={capturePhoto} className="flex-1">
                  Capture
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    streamRef.current?.getTracks().forEach((t) => t.stop())
                    setShowCamera(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : evidenceImage ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={evidenceImage}
                alt="Evidence"
                className="w-full rounded-lg"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setEvidenceImage(null)
                  startCamera()
                }}
              >
                Retake Photo
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={startCamera}
            >
              <div className="text-center">
                <span className="text-2xl block mb-1">&#128247;</span>
                <span className="text-sm text-gray-500">Take Photo of Reading</span>
              </div>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={!isValid} className="flex-1">
          Save &amp; Continue
        </Button>
      </div>
    </div>
  )
}
