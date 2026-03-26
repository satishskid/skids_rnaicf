
import React, { useState, useEffect, useRef } from 'react'
import { ScreeningProps, getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import { BodyDiagram } from './body-diagram'
import { AnnotationData, Severity } from '@skids/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { useStethoscope } from '@/hooks/use-stethoscope'
import { useAyuSynkBridge } from '@/hooks/use-ayusynk-bridge'
import { PULMONARY_POINTS, AudioAnalysisResult } from '@/lib/ai/auscultation'
import { launchAyuShare, getAyuSharePlayStoreUrl } from '@/lib/ayusynk/deeplink'

const MODULE_TYPE = 'pulmonary'
const RECORDING_DURATION = 10

type InputMode = 'usb' | 'bridge' | 'ayushare_launch'

interface PointRecording {
  pointId: string
  blob: Blob
  analysis: AudioAnalysisResult
}

export function PulmonaryScreening({
  step, setStep, onComplete, instructions, childName,
  campaignCode, childId, childDob, childGender,
}: ScreeningProps) {
  const stethoscope = useStethoscope()
  const bridge = useAyuSynkBridge()
  const [inputMode, setInputMode] = useState<InputMode>('usb')
  const [activePoint, setActivePoint] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<Map<string, PointRecording>>(new Map())

  // Bridge-specific state
  const [bridgeRecordedPoints, setBridgeRecordedPoints] = useState<Set<string>>(new Set())
  const [bridgeActivePoint, setBridgeActivePoint] = useState<string | null>(null)
  const [bridgeCountdown, setBridgeCountdown] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [currentView, setCurrentDiagramView] = useState<'anterior' | 'posterior'>('posterior')
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [notes, setNotes] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const chips = getAnnotationConfig(MODULE_TYPE)

  useEffect(() => {
    stethoscope.enumerateDevices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Waveform visualization
  useEffect(() => {
    if (!stethoscope.state.isRecording || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const freqData = stethoscope.state.frequencyData
      if (!freqData) return

      ctx.fillStyle = '#1e293b'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barCount = Math.min(64, freqData.length)
      const barWidth = canvas.width / barCount
      ctx.fillStyle = '#34d399'

      for (let i = 0; i < barCount; i++) {
        const barHeight = (freqData[i] / 255) * canvas.height
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight)
      }

      const level = stethoscope.state.audioLevel
      ctx.fillStyle = level > 0.5 ? '#ef4444' : level > 0.2 ? '#eab308' : '#22c55e'
      ctx.fillRect(0, 0, canvas.width * level, 3)

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [stethoscope.state.isRecording, stethoscope.state.frequencyData, stethoscope.state.audioLevel])

  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const timer = setTimeout(() => setCountdown(prev => (prev !== null ? prev - 1 : null)), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    if (countdown === 0 && stethoscope.state.isRecording) {
      handleStopRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  const handleStartRecording = async (pointId: string) => {
    setActivePoint(pointId)
    const success = await stethoscope.startRecording()
    if (success) {
      setCountdown(RECORDING_DURATION)
    }
  }

  const handleStopRecording = async () => {
    const blob = await stethoscope.stopRecording()
    if (blob && activePoint) {
      const analysis: AudioAnalysisResult = {
        classification: 'Recorded',
        confidence: 0.5,
        features: {},
        description: 'Audio captured — manual review recommended',
      }
      setRecordings(prev => new Map(prev).set(activePoint, { pointId: activePoint, blob, analysis }))
    }
    setCountdown(null)
    setActivePoint(null)
  }

  // Bridge countdown timer
  useEffect(() => {
    if (bridgeCountdown === null || bridgeCountdown <= 0) return
    const timer = setTimeout(() => setBridgeCountdown(prev => (prev !== null ? prev - 1 : null)), 1000)
    return () => clearTimeout(timer)
  }, [bridgeCountdown])

  useEffect(() => {
    if (bridgeCountdown === 0 && bridge.state.isRecording) {
      bridge.stopRecording()
      if (bridgeActivePoint) {
        setBridgeRecordedPoints(prev => new Set(prev).add(bridgeActivePoint))
      }
      setBridgeActivePoint(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeCountdown])

  const handleBridgeStartRecording = (pointId: string) => {
    setBridgeActivePoint(pointId)
    bridge.changeFilter('LUNG')
    bridge.startRecording(pointId)
    setBridgeCountdown(RECORDING_DURATION)
  }

  const handleBridgeStopRecording = () => {
    bridge.stopRecording()
    if (bridgeActivePoint) {
      setBridgeRecordedPoints(prev => new Set(prev).add(bridgeActivePoint))
    }
    setBridgeCountdown(null)
    setBridgeActivePoint(null)
  }

  const isBridgeMode = inputMode === 'bridge'

  const handleComplete = () => {
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins: [], aiSuggestedChips: [], notes,
    }

    const recordingSummary: Record<string, { classification: string; features: Record<string, number> }> = {}
    if (isBridgeMode) {
      bridgeRecordedPoints.forEach(pointId => {
        recordingSummary[pointId] = { classification: 'BLE Recorded', features: {} }
      })
    } else {
      recordings.forEach((rec, pointId) => {
        recordingSummary[pointId] = {
          classification: rec.analysis.classification,
          features: rec.analysis.features,
        }
      })
    }

    const pointsRecorded = isBridgeMode
      ? Array.from(bridgeRecordedPoints)
      : Array.from(recordings.keys())

    onComplete({
      moduleType: MODULE_TYPE,
      recordingSummary,
      pointsRecorded,
      annotationData,
      riskCategory: selectedChips.some(c => ['pu2', 'pu3', 'pu4', 'pu5', 'pu6', 'pu7', 'pu8'].includes(c)) ? 'possible_risk' : 'no_risk',
    })
  }

  // Step 0: Instructions + device check
  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert><Icons.Info className="w-4 h-4" /><AlertTitle>Instructions for {childName}</AlertTitle>
            <AlertDescription><ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              {instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol></AlertDescription></Alert>

          {/* AyuShare Deep Link Launch */}
          <Card className={`border-2 cursor-pointer transition-all ${
            inputMode === 'ayushare_launch' ? 'border-emerald-400 bg-emerald-50' : 'border-emerald-200 hover:border-emerald-300'
          }`} onClick={() => setInputMode('ayushare_launch')}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Icons.Stethoscope className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">AyuShare App</p>
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Recommended</Badge>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Open AyuShare to record lung sounds with AyuSynk. AI report auto-sent to SKIDS.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-teal-50 border-teal-200">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-teal-800">Stethoscope Device</p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => stethoscope.enumerateDevices()}>
                  <Icons.RefreshCw className="w-3 h-3 mr-1" />Refresh
                </Button>
              </div>
              {stethoscope.devices.length === 0 ? (
                <p className="text-xs text-gray-500">No audio devices found. Connect a USB stethoscope and tap Refresh.</p>
              ) : (
                <div className="space-y-1">
                  {stethoscope.devices.map(d => (
                    <button
                      key={d.deviceId}
                      className={`w-full text-left text-xs p-2 rounded-lg border transition-all ${
                        stethoscope.selectedDeviceId === d.deviceId
                          ? 'border-teal-400 bg-teal-100'
                          : 'border-gray-200 hover:border-teal-200'
                      }`}
                      onClick={() => stethoscope.selectDevice(d.deviceId)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bridge option — only shown when APK bridge is active */}
          {bridge.state.bridgeAvailable && (
            <Card className={`border-2 cursor-pointer transition-all ${
              inputMode === 'bridge' ? 'border-violet-400 bg-violet-50' : 'border-violet-200 hover:border-violet-300'
            }`} onClick={() => setInputMode('bridge')}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Icons.Wifi className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">AyuSynk Bridge (BLE)</p>
                    <Badge className="bg-green-100 text-green-700 text-[10px]">Connected</Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Record via BLE stethoscope with lung filter.
                    {bridge.state.deviceConnected && ` Device: ${bridge.state.deviceName}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Alert className="border-amber-200 bg-amber-50">
            <Icons.AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertTitle className="text-amber-800 text-sm">Platform Note</AlertTitle>
            <AlertDescription className="text-amber-700 text-xs">
              USB stethoscopes work best on Chrome (desktop/Android). iOS Safari has known audio routing limitations.
            </AlertDescription>
          </Alert>

          {inputMode === 'ayushare_launch' ? (
            <Button
              className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (!campaignCode || !childId) {
                  alert('Campaign or child not selected.')
                  return
                }
                const childAgeYears = childDob ? Math.floor((Date.now() - new Date(childDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined
                const gender = childGender === 'male' ? 'M' as const : childGender === 'female' ? 'F' as const : undefined
                launchAyuShare({ campaignCode, childId, childAge: childAgeYears, childGender: gender })
              }}
              disabled={!campaignCode || !childId}
            >
              <Icons.Stethoscope className="w-5 h-5 mr-2" />
              Open AyuShare &amp; Record Lungs
            </Button>
          ) : (
            <Button className="w-full" onClick={() => setStep(1)}
              disabled={inputMode === 'usb' ? !stethoscope.selectedDeviceId : !bridge.state.deviceConnected}>
              Begin Pulmonary Auscultation {inputMode === 'bridge' ? '(BLE)' : ''}
            </Button>
          )}
          {inputMode === 'ayushare_launch' && (
            <p className="text-xs text-center text-slate-400">
              AyuShare must be installed.{' '}
              <a href={getAyuSharePlayStoreUrl()} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">
                Install from Play Store
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Step 1: Body diagram + recording
  if (step === 1) {
    const recordedPoints = isBridgeMode ? bridgeRecordedPoints : new Set(recordings.keys())
    const currentActivePoint = isBridgeMode ? bridgeActivePoint : activePoint
    const isCurrentlyRecording = isBridgeMode ? bridge.state.isRecording : stethoscope.state.isRecording
    const currentCountdown = isBridgeMode ? bridgeCountdown : countdown
    const totalRecorded = isBridgeMode ? bridgeRecordedPoints.size : recordings.size
    const posteriorPoints = PULMONARY_POINTS.filter(p => p.side === 'posterior')
    const anteriorPoints = PULMONARY_POINTS.filter(p => p.side === 'anterior')

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Pulmonary Auscultation &mdash; {childName}</h3>
        <p className="text-xs text-gray-500">
          Tap each lung field point. Hold stethoscope for {RECORDING_DURATION} seconds per point.
          {isBridgeMode && ' (BLE — Lung filter active)'}
        </p>

        {/* Bridge connection status */}
        {isBridgeMode && (
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 w-fit">
            <div className={`w-2 h-2 rounded-full ${bridge.state.deviceConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-violet-700">
              {bridge.state.deviceConnected ? `BLE: ${bridge.state.deviceName}` : 'BLE disconnected'}
            </span>
          </div>
        )}

        {/* View toggle */}
        <div className="flex gap-2 justify-center">
          <Button size="sm"
            variant={currentView === 'posterior' ? 'default' : 'outline'}
            onClick={() => setCurrentDiagramView('posterior')}>
            Posterior ({posteriorPoints.filter(p => recordedPoints.has(p.id)).length}/{posteriorPoints.length})
          </Button>
          <Button size="sm"
            variant={currentView === 'anterior' ? 'default' : 'outline'}
            onClick={() => setCurrentDiagramView('anterior')}>
            Anterior ({anteriorPoints.filter(p => recordedPoints.has(p.id)).length}/{anteriorPoints.length})
          </Button>
        </div>

        <BodyDiagram
          points={PULMONARY_POINTS}
          recordedPoints={recordedPoints}
          activePoint={currentActivePoint}
          onSelectPoint={(id) => {
            if (isCurrentlyRecording) return
            if (isBridgeMode) {
              handleBridgeStartRecording(id)
            } else {
              handleStartRecording(id)
            }
          }}
          view={currentView}
        />

        {/* USB Recording indicator */}
        {!isBridgeMode && stethoscope.state.isRecording && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-semibold text-red-700">
                    Recording: {PULMONARY_POINTS.find(p => p.id === activePoint)?.label}
                  </span>
                </div>
                <Badge variant="outline" className="text-red-600">{countdown}s</Badge>
              </div>
              <canvas ref={canvasRef} width={280} height={60} className="w-full rounded bg-slate-800" />
              <Button size="sm" variant="outline" className="w-full" onClick={handleStopRecording}>
                Stop Early
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bridge Recording indicator */}
        {isBridgeMode && bridge.state.isRecording && (
          <Card className="border-violet-300 bg-violet-50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-violet-500 animate-pulse" />
                  <span className="text-sm font-semibold text-violet-700">
                    BLE Recording: {PULMONARY_POINTS.find(p => p.id === bridgeActivePoint)?.label}
                  </span>
                </div>
                <Badge variant="outline" className="text-violet-600">{bridgeCountdown}s</Badge>
              </div>
              {/* Audio level bar from bridge samples */}
              <div className="h-2 bg-slate-200 rounded overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-100"
                  style={{ width: `${Math.min(100, (bridge.state.filteredSamples.length > 0
                    ? bridge.state.filteredSamples.reduce((a, b) => a + Math.abs(b), 0) / bridge.state.filteredSamples.length / 128 * 100
                    : 0))}%` }}
                />
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={handleBridgeStopRecording}>
                Stop Early
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recorded points summary */}
        {totalRecorded > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Recorded ({totalRecorded}/{PULMONARY_POINTS.length} points)
              </p>
              <div className="space-y-1">
                {isBridgeMode ? (
                  Array.from(bridgeRecordedPoints).map(pointId => {
                    const point = PULMONARY_POINTS.find(p => p.id === pointId)
                    return (
                      <div key={pointId} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{point?.label}</span>
                        <Badge variant="outline" className="text-violet-600 text-xs">BLE Recorded</Badge>
                      </div>
                    )
                  })
                ) : (
                  Array.from(recordings.entries()).map(([pointId, rec]) => {
                    const point = PULMONARY_POINTS.find(p => p.id === pointId)
                    return (
                      <div key={pointId} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{point?.label}</span>
                        <Badge variant="outline" className="text-xs">{rec.analysis.classification}</Badge>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">Back</Button>
          <Button onClick={() => setStep(2)} className="flex-1" disabled={totalRecorded === 0}>
            Continue to Findings
          </Button>
        </div>
      </div>
    )
  }

  // Step 2: Annotation chips
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle>Pulmonary Findings &mdash; {childName}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {isBridgeMode ? (
              Array.from(bridgeRecordedPoints).map(pointId => {
                const point = PULMONARY_POINTS.find(p => p.id === pointId)
                return (
                  <div key={pointId} className="text-sm p-2 bg-violet-50 rounded-lg">
                    <strong>{point?.label}</strong>: BLE Recorded
                    <p className="text-xs text-gray-500">Audio captured via BLE stethoscope (lung filter)</p>
                  </div>
                )
              })
            ) : (
              Array.from(recordings.entries()).map(([pointId, rec]) => {
                const point = PULMONARY_POINTS.find(p => p.id === pointId)
                return (
                  <div key={pointId} className="text-sm p-2 bg-teal-50 rounded-lg">
                    <strong>{point?.label}</strong>: {rec.analysis.classification}
                    <p className="text-xs text-gray-500">{rec.analysis.description}</p>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <AnnotationChips chips={chips} selectedChips={selectedChips}
            onToggleChip={(id) => setSelectedChips(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])}
            chipSeverities={chipSeverities}
            onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
            aiSuggestedChips={[]} notes={notes} onNotesChange={setNotes}
            onComplete={handleComplete}
            onBack={() => setStep(1)} />
        </CardContent>
      </Card>
    </div>
  )
}
