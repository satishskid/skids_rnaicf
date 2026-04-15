
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
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useStethoscope } from '@/hooks/use-stethoscope'
import { useAyuSynkBridge } from '@/hooks/use-ayusynk-bridge'
import { CARDIAC_POINTS, AudioAnalysisResult } from '@/lib/ai/auscultation'
import {
  parseAyuSynkReportText,
  parseAyuSynkStreamUrl,
  createStreamImport,
  importWavFile,
  mapAyuSynkToSkids,
  type AyuSynkToSkidsMapping,
} from '@/lib/ayusynk/import'
import type { AyuSynkDiagnosisReport, HeartLocation } from '@/lib/ayusynk/types'
import { launchAyuShare, getAyuSharePlayStoreUrl } from '@/lib/ayusynk/deeplink'

const MODULE_TYPE = 'cardiac'
const RECORDING_DURATION = 10 // seconds

type InputMode = 'select' | 'usb_stethoscope' | 'ayusynk' | 'ayushare_launch' | 'bridge'
type AyuSynkTab = 'report' | 'stream' | 'wav'

interface PointRecording {
  pointId: string
  blob: Blob
  analysis: AudioAnalysisResult
}

export function CardiacScreening({
  step, setStep, onComplete, instructions, childName,
  campaignCode, childId, childDob, childGender,
}: ScreeningProps) {
  const stethoscope = useStethoscope()
  const bridge = useAyuSynkBridge()

  // Input mode selection
  const [inputMode, setInputMode] = useState<InputMode>('select')

  // Bridge-specific state
  const [bridgeRecordedPoints, setBridgeRecordedPoints] = useState<Set<string>>(new Set())
  const [bridgeActivePoint, setBridgeActivePoint] = useState<string | null>(null)
  const [bridgeCountdown, setBridgeCountdown] = useState<number | null>(null)

  // USB stethoscope state
  const [activePoint, setActivePoint] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<Map<string, PointRecording>>(new Map())
  const [countdown, setCountdown] = useState<number | null>(null)

  // AyuSynk state
  const [ayusynkTab, setAyusynkTab] = useState<AyuSynkTab>('report')
  const [ayusynkReportText, setAyusynkReportText] = useState('')
  const [ayusynkStreamUrl, setAyusynkStreamUrl] = useState('')
  const [ayusynkWavLocation, setAyusynkWavLocation] = useState<HeartLocation>('aortic')
  const [ayusynkReport, setAyusynkReport] = useState<AyuSynkDiagnosisReport | null>(null)
  const [ayusynkMapping, setAyusynkMapping] = useState<AyuSynkToSkidsMapping | null>(null)
  const [ayusynkError, setAyusynkError] = useState<string | null>(null)

  // Annotation state (shared)
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [notes, setNotes] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const wavInputRef = useRef<HTMLInputElement>(null)

  const chips = getAnnotationConfig(MODULE_TYPE)

  // Initialize device enumeration
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
      ctx.fillStyle = '#22d3ee'

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

  // Countdown timer
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

  // ============================================
  // USB STETHOSCOPE HANDLERS
  // ============================================

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

  // ============================================
  // AYUSYNK HANDLERS
  // ============================================

  const handleAyuSynkReportImport = () => {
    setAyusynkError(null)
    const result = parseAyuSynkReportText(ayusynkReportText)
    if (result.status === 'error') {
      setAyusynkError(result.error || 'Failed to parse report')
      return
    }
    if (result.report) {
      setAyusynkReport(result.report)
      const mapping = mapAyuSynkToSkids(result.report)
      setAyusynkMapping(mapping)
      // Auto-select suggested chips
      setSelectedChips(prev => [...new Set([...prev, ...mapping.suggestedChips])])
      // Auto-populate notes
      setNotes(prev => prev ? `${prev}\n\n${mapping.summaryText}` : mapping.summaryText)
      setStep(2) // Jump to findings
    }
  }

  const handleAyuSynkStreamImport = () => {
    setAyusynkError(null)
    const { valid, streamUrl, error } = parseAyuSynkStreamUrl(ayusynkStreamUrl)
    if (!valid) {
      setAyusynkError(error || 'Invalid URL')
      return
    }
    const report = createStreamImport(streamUrl!)
    setAyusynkReport(report)
    const mapping = mapAyuSynkToSkids(report)
    setAyusynkMapping(mapping)
    setNotes(prev => prev ? `${prev}\n\n${mapping.summaryText}` : mapping.summaryText)
    setStep(2)
  }

  const handleAyuSynkWavImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAyusynkError(null)
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-uploaded
    e.target.value = ''

    const result = importWavFile(file, ayusynkWavLocation)
    if (result.status === 'error') {
      setAyusynkError(result.error || 'Failed to import WAV')
      return
    }

    if (result.report) {
      setAyusynkReport(result.report)
      // Store the WAV as a recording too
      if (result.recordings?.[0]) {
        const rec = result.recordings[0]
        const analysis: AudioAnalysisResult = {
          classification: 'AyuSynk WAV Import',
          confidence: 0.5,
          features: {},
          description: `Imported from AyuSynk stethoscope — ${rec.location} point`,
        }
        setRecordings(prev => new Map(prev).set(rec.location, {
          pointId: rec.location,
          blob: file,
          analysis,
        }))
      }
      setNotes(prev => {
        const wavNote = `[AyuSynk WAV Import]\nFile: ${file.name}\nLocation: ${ayusynkWavLocation}\nSize: ${(file.size / 1024).toFixed(1)} KB`
        return prev ? `${prev}\n\n${wavNote}` : wavNote
      })
      setStep(2)
    }
  }

  // ============================================
  // BRIDGE HANDLERS (real-time BLE via APK)
  // ============================================

  // Bridge countdown timer
  useEffect(() => {
    if (bridgeCountdown === null || bridgeCountdown <= 0) return
    const timer = setTimeout(() => setBridgeCountdown(prev => (prev !== null ? prev - 1 : null)), 1000)
    return () => clearTimeout(timer)
  }, [bridgeCountdown])

  // Auto-stop bridge recording when countdown reaches 0
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

  // Auto-import bridge AI report into SKIDS findings
  useEffect(() => {
    if (!bridge.state.lastReport) return
    const report = bridge.toSkidsReport(bridge.state.lastReport, bridgeActivePoint || 'cardiac')
    setAyusynkReport(report)
    const mapping = mapAyuSynkToSkids(report)
    setAyusynkMapping(mapping)
    setSelectedChips(prev => [...new Set([...prev, ...mapping.suggestedChips])])
    setNotes(prev => prev ? `${prev}\n\n${mapping.summaryText}` : mapping.summaryText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.state.lastReport])

  const handleBridgeStartRecording = (pointId: string) => {
    const point = CARDIAC_POINTS.find(p => p.id === pointId)
    setBridgeActivePoint(pointId)
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

  const handleBridgeGenerateReport = () => {
    bridge.generateReport()
  }

  // ============================================
  // COMPLETE HANDLER
  // ============================================

  const handleComplete = () => {
    const annotationData: AnnotationData = {
      selectedChips,
      chipSeverities,
      pins: [],
      aiSuggestedChips: ayusynkMapping?.suggestedChips || [],
      notes,
    }

    const recordingSummary: Record<string, { classification: string; features: Record<string, number> }> = {}
    recordings.forEach((rec, pointId) => {
      recordingSummary[pointId] = {
        classification: rec.analysis.classification,
        features: rec.analysis.features,
      }
    })

    // Include AyuSynk data in the observation
    const ayusynkData = ayusynkReport ? {
      ayusynkReportId: ayusynkReport.id,
      ayusynkSource: ayusynkReport.source,
      ayusynkLiveStreamUrl: ayusynkReport.liveStreamUrl,
      ayusynkReports: ayusynkReport.reports.map(r => ({
        position: r.positionName,
        condition: r.conditionDetected,
        confidence: r.conditionConfidence,
        reportUrl: r.reportUrl,
      })),
    } : {}

    const riskCategory = ayusynkMapping?.riskCategory ||
      (selectedChips.some(c => ['ca2', 'ca3', 'ca4', 'ca5', 'ca6', 'ca7'].includes(c)) ? 'possible_risk' : 'no_risk')

    onComplete({
      moduleType: MODULE_TYPE,
      recordingSummary,
      pointsRecorded: Array.from(recordings.keys()),
      annotationData,
      riskCategory,
      ...ayusynkData,
    })
  }

  // ============================================
  // STEP 0: Mode Selection + Instructions
  // ============================================
  if (step === 0) {
    // Sub-view: input mode selection
    if (inputMode === 'select') {
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Icons.Info className="w-4 h-4" />
              <AlertTitle>Cardiac Auscultation for {childName}</AlertTitle>
              <AlertDescription>
                <p className="text-sm mt-1">Choose your stethoscope input method:</p>
              </AlertDescription>
            </Alert>

            {/* Option 1: AyuShare App (Deep Link — Recommended) */}
            <button
              className="w-full text-left border-2 border-emerald-300 hover:border-emerald-500 rounded-xl p-4 transition-all hover:bg-emerald-50 ring-1 ring-emerald-200"
              onClick={() => setInputMode('ayushare_launch')}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Icons.Stethoscope className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">AyuShare App</p>
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Recommended</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Opens AyuShare app to record with AyuSynk stethoscope.
                    AI diagnosis report auto-sent to SKIDS after recording.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 2: USB Stethoscope */}
            <button
              className="w-full text-left border-2 border-blue-200 hover:border-blue-400 rounded-xl p-4 transition-all hover:bg-blue-50"
              onClick={() => setInputMode('usb_stethoscope')}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Icons.Mic className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">USB / Built-in Microphone</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Record directly via USB stethoscope or device microphone.
                    Records at 4 cardiac points with real-time waveform.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 3: AyuSynk Manual Import */}
            <button
              className="w-full text-left border-2 border-teal-200 hover:border-teal-400 rounded-xl p-4 transition-all hover:bg-teal-50"
              onClick={() => setInputMode('ayusynk')}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <Icons.Stethoscope className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">AyuSynk Digital Stethoscope</p>
                    <Badge className="bg-teal-100 text-teal-700 text-[10px]">AI Diagnosis</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Import from AyuSynk app: AI diagnosis reports, live stream URLs,
                    or WAV recordings. Supports heart abnormality detection with confidence scores.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 3: Bridge Mode (only visible when APK bridge is active) */}
            {bridge.state.bridgeAvailable && (
              <button
                className="w-full text-left border-2 border-violet-300 hover:border-violet-500 rounded-xl p-4 transition-all bg-violet-50/50 hover:bg-violet-50 ring-2 ring-violet-200"
                onClick={() => setInputMode('bridge')}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Icons.Wifi className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">AyuSynk Bridge</p>
                      <Badge className="bg-violet-100 text-violet-700 text-[10px]">Live BLE</Badge>
                      <Badge className="bg-green-100 text-green-700 text-[10px]">Connected</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Real-time BLE stethoscope via SKIDS Bridge app.
                      Scan, connect, record, and get AI diagnosis — all from here.
                    </p>
                  </div>
                </div>
              </button>
            )}

            {/* Instructions */}
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-600">Tips:</p>
              {instructions.tips.map((t, i) => (
                <p key={i} className="flex items-start gap-1.5">
                  <span className="text-slate-400 mt-0.5">&#x2022;</span>{t}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )
    }

    // Sub-view: Bridge Mode — BLE scan, connect, record
    if (inputMode === 'bridge') {
      return (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Icons.Wifi className="w-5 h-5 text-violet-600" />
                AyuSynk Bridge
              </CardTitle>
              <Badge className={bridge.state.deviceConnected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}>
                {bridge.state.deviceConnected ? `Connected: ${bridge.state.deviceName}` : 'Not connected'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error display */}
            {bridge.state.lastError && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs flex items-center justify-between">
                  {bridge.state.lastError}
                  <Button size="sm" variant="ghost" className="h-5 text-[10px]" onClick={bridge.clearError}>Dismiss</Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Not connected — show scan/connect flow */}
            {!bridge.state.deviceConnected && (
              <>
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-violet-800 mb-1">Turn on your AyuSynk stethoscope, then tap Scan.</p>
                </div>

                <Button
                  className="w-full bg-violet-600 hover:bg-violet-700"
                  onClick={bridge.scan}
                  disabled={bridge.state.isScanning}
                >
                  {bridge.state.isScanning ? (
                    <><Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</>
                  ) : (
                    <><Icons.Search className="w-4 h-4 mr-2" />Scan for Stethoscopes</>
                  )}
                </Button>

                {/* Found devices list */}
                {bridge.state.foundDevices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">Found devices:</p>
                    {bridge.state.foundDevices.map(d => (
                      <button
                        key={d.address}
                        className="w-full text-left text-sm p-3 rounded-lg border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50 transition-all"
                        onClick={() => bridge.connectDevice(d.address)}
                      >
                        <p className="font-medium text-slate-800">{d.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{d.address}</p>
                      </button>
                    ))}
                  </div>
                )}

                {bridge.state.isScanning && bridge.state.foundDevices.length === 0 && (
                  <p className="text-xs text-slate-400 text-center animate-pulse">Looking for devices...</p>
                )}
              </>
            )}

            {/* Connected — show filter selection + "Begin" button */}
            {bridge.state.deviceConnected && (
              <>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-green-800">{bridge.state.deviceName}</p>
                        <p className="text-[10px] text-green-600">Bluetooth connected</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200"
                        onClick={bridge.disconnectDevice}>
                        Disconnect
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Filter selection */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Audio Filter</p>
                  <div className="flex gap-2">
                    {(['HEART', 'LUNG', 'NO_FILTER'] as const).map(f => (
                      <Button
                        key={f}
                        size="sm"
                        variant={bridge.state.currentFilter === f ? 'default' : 'outline'}
                        className="flex-1 text-xs"
                        onClick={() => bridge.changeFilter(f)}
                      >
                        {f === 'NO_FILTER' ? 'Raw' : f === 'HEART' ? 'Heart' : 'Lung'}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button className="w-full" onClick={() => setStep(1)}>
                  Begin Recording at Cardiac Points
                </Button>
              </>
            )}

            <Button variant="outline" onClick={() => setInputMode('select')} className="w-full">
              <Icons.ArrowLeft className="w-4 h-4 mr-1" />Back to Input Selection
            </Button>
          </CardContent>
        </Card>
      )
    }

    // Sub-view: USB stethoscope setup
    if (inputMode === 'usb_stethoscope') {
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Alert><Icons.Info className="w-4 h-4" /><AlertTitle>Instructions for {childName}</AlertTitle>
              <AlertDescription><ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                {instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol></AlertDescription></Alert>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-800">Stethoscope Device</p>
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
                            ? 'border-blue-400 bg-blue-100'
                            : 'border-gray-200 hover:border-blue-200'
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

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setInputMode('select')} className="flex-1">
                <Icons.ArrowLeft className="w-4 h-4 mr-1" />Back
              </Button>
              <Button className="flex-1" onClick={() => setStep(1)}
                disabled={!stethoscope.selectedDeviceId}>
                Begin Recording
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    // Sub-view: AyuShare deep link launch
    if (inputMode === 'ayushare_launch') {
      const childAgeYears = childDob ? Math.floor((Date.now() - new Date(childDob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined
      const gender = childGender === 'male' ? 'M' as const : childGender === 'female' ? 'F' as const : undefined

      const handleLaunch = () => {
        if (!campaignCode || !childId) {
          alert('Campaign or child not selected. Please join a campaign and select a child first.')
          return
        }
        launchAyuShare({
          campaignCode,
          childId,
          childAge: childAgeYears,
          childGender: gender,
        })
      }

      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-emerald-50 border-emerald-200">
              <Icons.Stethoscope className="w-4 h-4 text-emerald-600" />
              <AlertTitle>AyuShare — Record with AyuSynk</AlertTitle>
              <AlertDescription>
                <p className="text-sm mt-1">
                  Tap the button below to open the AyuShare app. Record heart sounds,
                  then tap Save. The AI report will be sent to SKIDS automatically.
                </p>
              </AlertDescription>
            </Alert>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-slate-500">Child:</span> <span className="font-medium">{childName}</span></p>
              {childAgeYears !== undefined && <p><span className="text-slate-500">Age:</span> <span className="font-medium">{childAgeYears} years</span></p>}
              {gender && <p><span className="text-slate-500">Gender:</span> <span className="font-medium">{gender}</span></p>}
              {campaignCode && <p><span className="text-slate-500">Campaign:</span> <span className="font-mono text-xs">{campaignCode}</span></p>}
            </div>

            <Button
              className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700"
              onClick={handleLaunch}
              disabled={!campaignCode || !childId}
            >
              <Icons.Stethoscope className="w-5 h-5 mr-2" />
              Open AyuShare &amp; Record
            </Button>

            <p className="text-xs text-center text-slate-400">
              AyuShare must be installed on this device.{' '}
              <a href={getAyuSharePlayStoreUrl()} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">
                Install from Play Store
              </a>
            </p>

            <div className="pt-2 border-t">
              <p className="text-xs text-slate-500 mb-2">After recording in AyuShare:</p>
              <ol className="text-xs text-slate-500 list-decimal list-inside space-y-1">
                <li>AyuShare will close and return you here</li>
                <li>AI report is generated automatically (10-15 seconds)</li>
                <li>Report appears in this child&apos;s screening data</li>
              </ol>
            </div>

            <Button variant="ghost" size="sm" className="w-full text-slate-400" onClick={() => setInputMode('select')}>
              <Icons.ArrowLeft className="w-4 h-4 mr-1" /> Back to input methods
            </Button>
          </CardContent>
        </Card>
      )
    }

    // Sub-view: AyuSynk import
    if (inputMode === 'ayusynk') {
      return (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Icons.Stethoscope className="w-5 h-5 text-teal-600" />
                AyuSynk Import
              </CardTitle>
              <Badge className="bg-teal-100 text-teal-700">v4.4.0</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tab selector */}
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              {([
                { id: 'report' as const, label: 'AI Report', icon: '&#x1F9E0;' },
                { id: 'stream' as const, label: 'Live Stream', icon: '&#x1F4E1;' },
                { id: 'wav' as const, label: 'WAV File', icon: '&#x1F3B5;' },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  className={`flex-1 text-xs font-medium py-2 px-2 rounded-md transition-all ${
                    ayusynkTab === tab.id
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => { setAyusynkTab(tab.id); setAyusynkError(null) }}
                  dangerouslySetInnerHTML={{ __html: `${tab.icon} ${tab.label}` }}
                />
              ))}
            </div>

            {/* Error display */}
            {ayusynkError && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{ayusynkError}</AlertDescription>
              </Alert>
            )}

            {/* Tab: AI Report */}
            {ayusynkTab === 'report' && (
              <div className="space-y-3">
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-teal-800 mb-1">How to get the report:</p>
                  <ol className="text-xs text-teal-700 space-y-0.5 list-decimal list-inside">
                    <li>Open AyuSynk app on your Android phone</li>
                    <li>Connect to AyuSynk stethoscope (BLE or USB)</li>
                    <li>Record at auscultation points (aortic, pulmonic, etc.)</li>
                    <li>Tap <strong>Report</strong> to generate AI diagnosis</li>
                    <li>Tap <strong>Share Report</strong> and copy the text</li>
                    <li>Paste it below</li>
                  </ol>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Paste AyuSynk Report Text
                  </label>
                  <Textarea
                    value={ayusynkReportText}
                    onChange={(e) => setAyusynkReportText(e.target.value)}
                    placeholder={`Aortic\nhttps://report-url...\nAbnormality Detected:\nNormal(Confidence:0.92)`}
                    rows={6}
                    className="text-xs font-mono"
                  />
                </div>

                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  onClick={handleAyuSynkReportImport}
                  disabled={!ayusynkReportText.trim()}
                >
                  <Icons.FileText className="w-4 h-4 mr-2" />
                  Import AI Diagnosis Report
                </Button>
              </div>
            )}

            {/* Tab: Live Stream */}
            {ayusynkTab === 'stream' && (
              <div className="space-y-3">
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-teal-800 mb-1">How to get the stream URL:</p>
                  <ol className="text-xs text-teal-700 space-y-0.5 list-decimal list-inside">
                    <li>In AyuSynk app, connect to stethoscope</li>
                    <li>Tap <strong>Start Online Streaming</strong></li>
                    <li>Tap <strong>Share URL</strong> and copy the link</li>
                    <li>Paste it below</li>
                  </ol>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    AyuSynk Live Stream URL
                  </label>
                  <Input
                    value={ayusynkStreamUrl}
                    onChange={(e) => setAyusynkStreamUrl(e.target.value)}
                    placeholder="https://stream.ayudevice.com/..."
                    className="text-xs"
                  />
                </div>

                {ayusynkStreamUrl && parseAyuSynkStreamUrl(ayusynkStreamUrl).valid && (
                  <Card className="border-teal-200 bg-teal-50">
                    <CardContent className="p-3">
                      <p className="text-xs font-medium text-teal-800 mb-2">Live Audio Preview</p>
                      <audio
                        controls
                        src={ayusynkStreamUrl}
                        className="w-full h-8"
                        onError={() => setAyusynkError('Could not load stream — check URL or ensure streaming is active in AyuSynk app')}
                      />
                      <p className="text-[10px] text-teal-600 mt-1">
                        Ensure AyuSynk streaming is active on the Android device
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  onClick={handleAyuSynkStreamImport}
                  disabled={!ayusynkStreamUrl.trim()}
                >
                  <Icons.Radio className="w-4 h-4 mr-2" />
                  Import Stream &amp; Continue
                </Button>
              </div>
            )}

            {/* Tab: WAV File */}
            {ayusynkTab === 'wav' && (
              <div className="space-y-3">
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-teal-800 mb-1">How to get the WAV file:</p>
                  <ol className="text-xs text-teal-700 space-y-0.5 list-decimal list-inside">
                    <li>In AyuSynk app, record at an auscultation point</li>
                    <li>Tap <strong>Share</strong> to export the WAV file</li>
                    <li>Transfer to this device (email, Drive, USB, etc.)</li>
                    <li>Select the location and file below</li>
                  </ol>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Auscultation Location
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['aortic', 'pulmonic', 'tricuspid', 'mitral'] as HeartLocation[]).map(loc => (
                      <button
                        key={loc}
                        className={`text-xs py-2 px-3 rounded-lg border transition-all capitalize ${
                          ayusynkWavLocation === loc
                            ? 'border-teal-400 bg-teal-100 text-teal-800 font-medium'
                            : 'border-slate-200 text-slate-600 hover:border-teal-200'
                        }`}
                        onClick={() => setAyusynkWavLocation(loc)}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    WAV File
                  </label>
                  <input
                    ref={wavInputRef}
                    type="file"
                    accept="audio/wav,audio/wave,.wav"
                    onChange={handleAyuSynkWavImport}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => wavInputRef.current?.click()}
                  >
                    <Icons.Upload className="w-4 h-4 mr-2" />
                    Select WAV File from AyuSynk
                  </Button>
                </div>
              </div>
            )}

            {/* Back button */}
            <Button variant="outline" onClick={() => setInputMode('select')} className="w-full">
              <Icons.ArrowLeft className="w-4 h-4 mr-1" />Back to Input Selection
            </Button>
          </CardContent>
        </Card>
      )
    }
  }

  // ============================================
  // STEP 1: Body Diagram + Recording (USB or Bridge)
  // ============================================
  if (step === 1) {
    const isBridgeMode = inputMode === 'bridge'
    const recordedPoints = isBridgeMode ? bridgeRecordedPoints : new Set(recordings.keys())
    const isCurrentlyRecording = isBridgeMode ? bridge.state.isRecording : stethoscope.state.isRecording
    const currentActivePoint = isBridgeMode ? bridgeActivePoint : activePoint
    const currentCountdown = isBridgeMode ? bridgeCountdown : countdown

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Cardiac Auscultation &mdash; {childName}</h3>
        <p className="text-xs text-gray-500">
          Tap each point to record. Hold stethoscope on the point for {RECORDING_DURATION} seconds.
        </p>

        {/* Bridge connection status bar */}
        {isBridgeMode && (
          <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
            bridge.state.deviceConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            <span>{bridge.state.deviceConnected ? `BLE: ${bridge.state.deviceName}` : 'Stethoscope disconnected'}</span>
            <Badge variant="outline" className="text-[10px]">{bridge.state.currentFilter}</Badge>
          </div>
        )}

        <BodyDiagram
          points={CARDIAC_POINTS}
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
          view="anterior"
        />

        {/* Recording indicator (USB mode) */}
        {!isBridgeMode && stethoscope.state.isRecording && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-semibold text-red-700">
                    Recording: {CARDIAC_POINTS.find(p => p.id === activePoint)?.label}
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

        {/* Recording indicator (Bridge mode) */}
        {isBridgeMode && bridge.state.isRecording && (
          <Card className="border-violet-300 bg-violet-50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-violet-500 animate-pulse" />
                  <span className="text-sm font-semibold text-violet-700">
                    BLE Recording: {CARDIAC_POINTS.find(p => p.id === bridgeActivePoint)?.label}
                  </span>
                </div>
                <Badge variant="outline" className="text-violet-600">{bridgeCountdown}s</Badge>
              </div>
              {/* Audio level bar from bridge samples */}
              <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${Math.min(100, (bridge.state.audioSamples.length > 0 ? Math.abs(bridge.state.audioSamples[0]) / 32768 : 0) * 100)}%` }}
                />
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={handleBridgeStopRecording}>
                Stop Early
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recorded points summary (USB mode) */}
        {!isBridgeMode && recordings.size > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Recorded ({recordings.size}/4 points)</p>
              <div className="space-y-1">
                {Array.from(recordings.entries()).map(([pointId, rec]) => {
                  const point = CARDIAC_POINTS.find(p => p.id === pointId)
                  return (
                    <div key={pointId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{point?.label}</span>
                      <Badge variant="outline" className="text-xs">{rec.analysis.classification}</Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recorded points summary (Bridge mode) */}
        {isBridgeMode && bridgeRecordedPoints.size > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Recorded ({bridgeRecordedPoints.size}/4 points via BLE)
              </p>
              <div className="space-y-1">
                {Array.from(bridgeRecordedPoints).map(pointId => {
                  const point = CARDIAC_POINTS.find(p => p.id === pointId)
                  return (
                    <div key={pointId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{point?.label}</span>
                      <Badge variant="outline" className="bg-violet-50 text-violet-600 text-xs">BLE Recorded</Badge>
                    </div>
                  )
                })}
              </div>

              {/* Generate AI Report button (Bridge mode only) */}
              {bridgeRecordedPoints.size >= 1 && (
                <Button
                  className="w-full mt-3 bg-violet-600 hover:bg-violet-700"
                  onClick={handleBridgeGenerateReport}
                  disabled={bridge.state.isGeneratingReport}
                >
                  {bridge.state.isGeneratingReport ? (
                    <><Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating AI Report...</>
                  ) : (
                    <><Icons.Stethoscope className="w-4 h-4 mr-2" />Generate AI Diagnosis</>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bridge error */}
        {isBridgeMode && bridge.state.lastError && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{bridge.state.lastError}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            setStep(0)
            setInputMode(isBridgeMode ? 'bridge' : 'usb_stethoscope')
          }} className="flex-1">Back</Button>
          <Button onClick={() => setStep(2)} className="flex-1"
            disabled={isBridgeMode ? bridgeRecordedPoints.size === 0 : recordings.size === 0}>
            Continue to Findings
          </Button>
        </div>
      </div>
    )
  }

  // ============================================
  // STEP 2: Findings + Annotation
  // ============================================
  return (
    <div className="space-y-4">
      {/* AyuSynk AI Results (if imported) */}
      {ayusynkMapping && ayusynkMapping.locationResults.length > 0 && (
        <Card className="border-teal-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icons.Stethoscope className="w-4 h-4 text-teal-600" />
              AyuSynk AI Diagnosis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ayusynkMapping.locationResults.map((lr, i) => (
              <div key={i} className={`text-sm p-3 rounded-lg border ${
                lr.chipId === 'ca1' || !lr.chipId
                  ? 'bg-green-50 border-green-200'
                  : lr.confidence >= 0.7
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <strong className="text-slate-800">{lr.location}</strong>
                  <div className="flex items-center gap-2">
                    {lr.confidence > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round(lr.confidence * 100)}%
                      </Badge>
                    )}
                    <Badge className={`text-[10px] ${
                      lr.chipId === 'ca1' || !lr.chipId
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {lr.condition || 'Unknown'}
                    </Badge>
                  </div>
                </div>
                {lr.reportUrl && (
                  <a
                    href={lr.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-teal-600 underline mt-1 block"
                  >
                    View Full Report
                  </a>
                )}
              </div>
            ))}

            {/* Risk summary */}
            <div className={`text-xs font-medium p-2 rounded-lg text-center ${
              ayusynkMapping.riskCategory === 'high_risk'
                ? 'bg-red-100 text-red-700'
                : ayusynkMapping.riskCategory === 'possible_risk'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
            }`}>
              AI Risk Assessment: {
                ayusynkMapping.riskCategory === 'high_risk' ? 'High Risk — Refer'
                  : ayusynkMapping.riskCategory === 'possible_risk' ? 'Possible Risk — Follow Up'
                    : 'Normal — No Abnormality Detected'
              }
            </div>

            {/* Live stream link */}
            {ayusynkReport?.liveStreamUrl && (
              <div className="bg-teal-50 rounded-lg p-2">
                <p className="text-[10px] font-medium text-teal-700 mb-1">Live Stream Recording</p>
                <audio controls src={ayusynkReport.liveStreamUrl} className="w-full h-8" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* USB Recording Results (if recorded) */}
      {recordings.size > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recording Results</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from(recordings.entries()).map(([pointId, rec]) => {
                const point = CARDIAC_POINTS.find(p => p.id === pointId)
                return (
                  <div key={pointId} className="text-sm p-2 bg-blue-50 rounded-lg">
                    <strong>{point?.label}</strong>: {rec.analysis.classification}
                    <p className="text-xs text-gray-500">{rec.analysis.description}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Annotation chips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cardiac Findings &mdash; {childName}</CardTitle>
          {ayusynkMapping && ayusynkMapping.suggestedChips.length > 0 && (
            <p className="text-[10px] text-teal-600 mt-1">
              AyuSynk AI auto-selected: {ayusynkMapping.suggestedChipLabels.join(', ')}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <AnnotationChips chips={chips} selectedChips={selectedChips}
            onToggleChip={(id) => setSelectedChips(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])}
            chipSeverities={chipSeverities}
            onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
            aiSuggestedChips={ayusynkMapping?.suggestedChips || []}
            notes={notes} onNotesChange={setNotes}
            onComplete={handleComplete}
            onBack={() => {
              if (ayusynkReport) {
                setStep(0)
                setInputMode('select')
              } else {
                setStep(1)
              }
            }} />
        </CardContent>
      </Card>
    </div>
  )
}

export default CardiacScreening
