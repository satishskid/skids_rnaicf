
import React, { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { ScreeningProps, getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import { analyzeRedReflex } from '@/lib/ai/vision'
import { Icons } from '@/components/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { getUserMediaWithFallback } from '@/lib/camera-utils'
import type { PhotoscreenResult } from '@/lib/ai/photoscreening'
import type { AnnotationData, Severity } from '@skids/shared'
import {
  parseWelchAllynZip,
  parseWelchAllynCSV,
  ageMonthsToYears,
} from '@/lib/welchallyn/parser'
import { mapWelchAllynToSkids } from '@/lib/welchallyn/mapper'
import type { WelchAllynScreening, WelchAllynImportResult } from '@/lib/welchallyn/types'
import type { WelchAllynToSkidsMapping } from '@/lib/welchallyn/mapper'

const MODULE_TYPE = 'vision'

type InputMode = 'select' | 'camera' | 'welchallyn' | 'symbols'

// ── Symbol-matching visual acuity test (LEA-style) ─────────────────────
// Show a target symbol at decreasing sizes; child picks the matching one
// from 4 shuffled options. Tests visual acuity in a child-friendly way.
const VISION_SYMBOLS = [
  { id: 'circle', emoji: '\u{2B55}',  label: 'Circle', bg: 'bg-blue-50',   border: 'border-blue-400',   ring: 'ring-blue-400' },
  { id: 'square', emoji: '\u{2B1C}',  label: 'Square', bg: 'bg-green-50',  border: 'border-green-400',  ring: 'ring-green-400' },
  { id: 'star',   emoji: '\u{2B50}',  label: 'Star',   bg: 'bg-yellow-50', border: 'border-yellow-400', ring: 'ring-yellow-400' },
  { id: 'heart',  emoji: '\u{2764}\u{FE0F}', label: 'Heart',  bg: 'bg-red-50',    border: 'border-red-400',    ring: 'ring-red-400' },
]

const SYMBOL_SIZES = [
  { px: 80, acuity: '20/200', level: 0 },
  { px: 64, acuity: '20/100', level: 1 },
  { px: 48, acuity: '20/70',  level: 2 },
  { px: 36, acuity: '20/50',  level: 3 },
  { px: 28, acuity: '20/40',  level: 4 },
  { px: 20, acuity: '20/30',  level: 5 },
  { px: 16, acuity: '20/20',  level: 6 },
]

function shuffleSymbols() {
  const syms = [...VISION_SYMBOLS]
  for (let i = syms.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[syms[i], syms[j]] = [syms[j], syms[i]]
  }
  return syms
}

export function VisionScreening({
  step,
  setStep,
  onComplete,
  instructions,
  childName,
  childAge,
  orgConfig,
}: ScreeningProps) {
  // Input mode selection
  const [inputMode, setInputMode] = useState<InputMode>('select')

  // Camera state
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<{
    present: boolean
    symmetry: number
    leftIntensity: number
    rightIntensity: number
  } | null>(null)
  const [photoscreenResult, setPhotoscreenResult] = useState<PhotoscreenResult | null>(null)
  const [photoscreenRunning, setPhotoscreenRunning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Welch Allyn state
  const [waImportResult, setWaImportResult] = useState<WelchAllynImportResult | null>(null)
  const [waSelectedScreening, setWaSelectedScreening] = useState<WelchAllynScreening | null>(null)
  const [waMapping, setWaMapping] = useState<WelchAllynToSkidsMapping | null>(null)
  const [waError, setWaError] = useState<string | null>(null)
  const [waLoading, setWaLoading] = useState(false)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Symbol test state
  const [symbolSizeIdx, setSymbolSizeIdx] = useState(0)
  const [symbolTarget, setSymbolTarget] = useState(() => VISION_SYMBOLS[Math.floor(Math.random() * VISION_SYMBOLS.length)])
  const [symbolOptions, setSymbolOptions] = useState(() => shuffleSymbols())
  const [symbolSelected, setSymbolSelected] = useState<string | null>(null)
  const [symbolCorrectCount, setSymbolCorrectCount] = useState(0)
  const [symbolWrongCount, setSymbolWrongCount] = useState(0)
  const [symbolResults, setSymbolResults] = useState<Array<{ acuity: string; correct: boolean }>>([])
  const [symbolAcuity, setSymbolAcuity] = useState<string | null>(null)

  // Annotation state (shared across modes)
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [notes, setNotes] = useState('')

  const chips = getAnnotationConfig(MODULE_TYPE)

  // ============================================
  // CAMERA HANDLERS
  // ============================================

  const startCamera = async () => {
    try {
      const stream = await getUserMediaWithFallback('user', { width: 640, height: 480, exact: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      toast.error('Camera access denied')
    }
  }

  const captureAndAnalyze = () => {
    if (!videoRef.current || !canvasRef.current) return

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    const result = analyzeRedReflex(imageData)
    setAnalysisResult(result)

    const imageDataUrl = canvasRef.current.toDataURL('image/jpeg')
    setCapturedImage(imageDataUrl)

    const stream = videoRef.current.srcObject as MediaStream
    stream?.getTracks().forEach((track) => track.stop())

    // Run photoscreening classifier in background
    setPhotoscreenRunning(true)
    import('@/lib/ai/photoscreening').then(({ runPhotoscreening }) => {
      runPhotoscreening(imageData).then(psResult => {
        setPhotoscreenResult(psResult)
        setPhotoscreenRunning(false)
        // Auto-select chips suggested by photoscreening AI
        if (psResult.findings.length > 0) {
          const psChipIds = psResult.findings.map(f => f.chipId)
          setSelectedChips(prev => [...new Set([...prev, ...psChipIds])])
        }
      }).catch(() => setPhotoscreenRunning(false))
    }).catch(() => setPhotoscreenRunning(false))

    // Move to annotation step instead of completing immediately
    setStep(2)
  }

  // Camera mode complete handler — called from annotation chips
  const handleCameraComplete = () => {
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins: [], aiSuggestedChips: photoscreenResult?.findings.map(f => f.chipId) || [], notes,
    }
    const riskCategory =
      analysisResult && analysisResult.symmetry > 0.85 ? 'no_risk'
        : analysisResult && analysisResult.symmetry > 0.7 ? 'possible_risk' : 'high_risk'

    onComplete({
      moduleType: MODULE_TYPE,
      annotationData,
      redReflexPresent: analysisResult?.present,
      redReflexSymmetry: analysisResult?.symmetry,
      leftIntensity: analysisResult?.leftIntensity,
      rightIntensity: analysisResult?.rightIntensity,
      confidence: 0.85 + (analysisResult?.symmetry || 0) * 0.1,
      riskCategory,
      qualityFlags: analysisResult?.present ? ['good_visibility'] : ['poor_visibility'],
      photoscreening: photoscreenResult || undefined,
    })
  }

  // ============================================
  // SYMBOL TEST HANDLERS
  // ============================================

  const handleSymbolSelect = (symbolId: string) => {
    if (symbolSelected) return // already selected this round
    setSymbolSelected(symbolId)
    const currentSize = SYMBOL_SIZES[symbolSizeIdx]
    const isCorrect = symbolId === symbolTarget.id

    setSymbolResults(prev => [...prev, { acuity: currentSize.acuity, correct: isCorrect }])

    if (isCorrect) {
      setSymbolCorrectCount(prev => prev + 1)
      setSymbolWrongCount(0) // reset consecutive wrongs

      // Brief feedback then advance
      setTimeout(() => {
        if (symbolSizeIdx < SYMBOL_SIZES.length - 1) {
          // Next smaller size
          setSymbolSizeIdx(prev => prev + 1)
          const nextTarget = VISION_SYMBOLS[Math.floor(Math.random() * VISION_SYMBOLS.length)]
          setSymbolTarget(nextTarget)
          setSymbolOptions(shuffleSymbols())
          setSymbolSelected(null)
        } else {
          // Passed all sizes — excellent acuity
          setSymbolAcuity('20/20')
          setStep(2)
        }
      }, 600)
    } else {
      const newWrongCount = symbolWrongCount + 1
      setSymbolWrongCount(newWrongCount)

      if (newWrongCount >= 2) {
        // Failed at this size — record acuity as the PREVIOUS passing level
        const prevLevel = symbolSizeIdx > 0 ? SYMBOL_SIZES[symbolSizeIdx - 1] : SYMBOL_SIZES[0]
        setSymbolAcuity(prevLevel.acuity)

        // Auto-select appropriate chips based on acuity
        if (symbolSizeIdx <= 2) {
          // 20/200, 20/100, 20/70 — significant vision issue
          setSelectedChips(prev => [...new Set([...prev, 'vs3'])]) // Reduced visual acuity
        } else if (symbolSizeIdx <= 4) {
          // 20/50, 20/40 — mild issue
          setSelectedChips(prev => [...new Set([...prev, 'vs2'])]) // Mild issue
        }

        setTimeout(() => setStep(2), 600)
      } else {
        // One wrong — retry same size with new target
        setTimeout(() => {
          const nextTarget = VISION_SYMBOLS[Math.floor(Math.random() * VISION_SYMBOLS.length)]
          setSymbolTarget(nextTarget)
          setSymbolOptions(shuffleSymbols())
          setSymbolSelected(null)
        }, 600)
      }
    }
  }

  const handleSymbolComplete = () => {
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins: [],
      aiSuggestedChips: [],
      notes,
    }
    const acuityLevel = SYMBOL_SIZES.findIndex(s => s.acuity === symbolAcuity)
    const riskCategory =
      acuityLevel <= 1 ? 'high_risk'
        : acuityLevel <= 3 ? 'possible_risk' : 'no_risk'

    onComplete({
      moduleType: MODULE_TYPE,
      annotationData,
      source: 'symbol_matching',
      symbolAcuity,
      symbolResults,
      symbolCorrectCount,
      riskCategory,
      confidence: 0.8,
      qualityFlags: symbolResults.length >= 3 ? ['sufficient_trials'] : ['few_trials'],
    })
  }

  useEffect(() => {
    if (step === 1 && inputMode === 'camera') startCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inputMode])

  // ============================================
  // WELCH ALLYN HANDLERS
  // ============================================

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-uploaded
    e.target.value = ''
    setWaError(null)
    setWaLoading(true)

    try {
      const result = await parseWelchAllynZip(file)
      if (result.screenings.length === 0) {
        setWaError('No screening results found in the ZIP file')
        setWaLoading(false)
        return
      }
      setWaImportResult(result)
      toast.success(`Imported ${result.totalCount} screenings (${result.passedCount} passed, ${result.failedCount} refer)`)
    } catch (err) {
      setWaError(`Failed to parse ZIP: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setWaLoading(false)
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-uploaded
    e.target.value = ''
    setWaError(null)
    setWaLoading(true)

    try {
      const text = await file.text()
      const screenings = parseWelchAllynCSV(text)
      if (screenings.length === 0) {
        setWaError('No screening results found in the CSV file')
        setWaLoading(false)
        return
      }
      setWaImportResult({
        screenings,
        totalCount: screenings.length,
        passedCount: screenings.filter(s => s.passed).length,
        failedCount: screenings.filter(s => !s.passed).length,
        deviceSerial: screenings[0]?.deviceSerial || '',
        exportDate: screenings[0]?.timestamp?.split(' ')[0] || '',
        hasPdfs: false,
        criteria: [],
      })
      toast.success(`Imported ${screenings.length} screenings from CSV`)
    } catch (err) {
      setWaError(`Failed to parse CSV: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setWaLoading(false)
  }

  const handleSelectWaChild = (screening: WelchAllynScreening) => {
    setWaSelectedScreening(screening)
    const mapping = mapWelchAllynToSkids(screening)
    setWaMapping(mapping)
    // Auto-select suggested chips
    setSelectedChips(prev => [...new Set([...prev, ...mapping.suggestedChips])])
    // Auto-set severity based on device findings
    const newSeverities: Record<string, Severity> = { ...chipSeverities }
    for (const detail of mapping.conditionDetails) {
      if (detail.severity === 'severe') newSeverities[detail.chipId] = 'severe'
      else if (detail.severity === 'moderate') newSeverities[detail.chipId] = 'moderate'
      else newSeverities[detail.chipId] = 'mild'
    }
    setChipSeverities(newSeverities)
    // Auto-populate notes
    setNotes(mapping.summaryText)
    setStep(2) // Jump to findings
  }

  // ============================================
  // WELCH ALLYN COMPLETE HANDLER
  // ============================================

  const handleWaComplete = () => {
    const annotationData: AnnotationData = {
      selectedChips,
      chipSeverities,
      pins: [],
      aiSuggestedChips: waMapping?.suggestedChips || [],
      notes,
    }

    const waData = waSelectedScreening ? {
      welchAllynRecordId: waSelectedScreening.recordId,
      welchAllynDeviceSerial: waSelectedScreening.deviceSerial,
      welchAllynTimestamp: waSelectedScreening.timestamp,
      welchAllynPassed: waSelectedScreening.passed,
      welchAllynResultText: waSelectedScreening.resultText,
      welchAllynConditions: waSelectedScreening.conditions.map(c => ({
        type: c.type, eye: c.eye, label: c.label, severity: c.severity, value: c.value,
      })),
      welchAllynRefraction: waMapping?.refractionData,
      welchAllynPrescription: waMapping?.prescription,
    } : {}

    onComplete({
      moduleType: MODULE_TYPE,
      annotationData,
      riskCategory: waMapping?.riskCategory || 'no_risk',
      source: 'welchallyn_spot',
      ...waData,
    })
  }

  // ============================================
  // STEP 0: Mode Selection
  // ============================================
  if (step === 0) {
    if (inputMode === 'select') {
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Icons.Info className="w-4 h-4" />
              <AlertTitle>Vision Screening for {childName}</AlertTitle>
              <AlertDescription>
                <p className="text-sm mt-1">Choose your screening method:</p>
              </AlertDescription>
            </Alert>

            {/* Option 1: Phone Camera */}
            <button
              className="w-full text-left border-2 border-blue-200 hover:border-blue-400 rounded-xl p-4 transition-all hover:bg-blue-50"
              onClick={() => setInputMode('camera')}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Icons.Camera className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Phone Camera</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Red reflex detection + photoscreening AI.
                    Quick screening using phone camera with real-time analysis.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 2: Welch Allyn Spot Vision Screener */}
            <button
              className="w-full text-left border-2 border-indigo-200 hover:border-indigo-400 rounded-xl p-4 transition-all hover:bg-indigo-50"
              onClick={() => setInputMode('welchallyn')}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Icons.Eye className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">Welch Allyn Spot Vision Screener</p>
                    <Badge className="bg-indigo-100 text-indigo-700 text-[10px]">Device Import</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Import ZIP or CSV export from Welch Allyn Spot device.
                    Full refraction data, auto-referral, and PDF reports.
                  </p>
                </div>
              </div>
            </button>

            {/* Option 3: Symbol Matching (Visual Acuity) */}
            <button
              className="w-full text-left border-2 border-emerald-200 hover:border-emerald-400 rounded-xl p-4 transition-all hover:bg-emerald-50"
              onClick={() => setInputMode('symbols')}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">{'\u{2B50}'}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">Symbol Matching</p>
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Visual Acuity</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Child-friendly shape matching game. Tests visual acuity
                    from 20/200 to 20/20 using LEA-style symbols.
                  </p>
                </div>
              </div>
            </button>

            {/* Tips */}
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

    // Sub-view: Camera instructions
    if (inputMode === 'camera') {
      return (
        <Card>
          <CardHeader className="pb-2"><CardTitle>Vision Screening</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Icons.Info className="w-4 h-4" />
              <AlertTitle>Instructions</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  {instructions.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
              </AlertDescription>
            </Alert>

            <Card className="bg-gray-50">
              <CardContent className="py-3">
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  {instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setInputMode('select')} className="flex-1">
                <Icons.ArrowLeft className="w-4 h-4 mr-1" />Back
              </Button>
              <Button className="flex-1" onClick={() => setStep(1)}>
                Start Camera
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    // Sub-view: Symbol Matching Instructions
    if (inputMode === 'symbols') {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{'\u{2B50}'}</span>
              Symbol Matching Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Icons.Info className="w-4 h-4" />
              <AlertDescription className="text-sm">
                {childName} will see a shape and pick the matching one from 4 options.
                Shapes get smaller each round to test visual acuity.
              </AlertDescription>
            </Alert>

            {/* Preview symbols */}
            <div className="grid grid-cols-4 gap-2">
              {VISION_SYMBOLS.map(sym => (
                <div key={sym.id} className={`${sym.bg} ${sym.border} border-2 rounded-xl p-3 text-center`}>
                  <div className="text-3xl">{sym.emoji}</div>
                  <p className="text-[10px] font-medium mt-1">{sym.label}</p>
                </div>
              ))}
            </div>

            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="py-3 space-y-1">
                <p className="text-xs font-medium text-emerald-800">Instructions:</p>
                <ul className="text-xs text-emerald-700 space-y-0.5 list-disc list-inside">
                  <li>Hold phone at arm&apos;s length from {childName}</li>
                  <li>Cover one eye at a time (test each eye separately)</li>
                  <li>Ask: &quot;Which picture matches the big one?&quot;</li>
                  <li>Shapes get smaller — stop when {childName} can&apos;t match</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setInputMode('select')} className="flex-1">
                <Icons.ArrowLeft className="w-4 h-4 mr-1" />Back
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setStep(1)}>
                Start Test
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    // Sub-view: Welch Allyn Import
    if (inputMode === 'welchallyn') {
      return (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Icons.Eye className="w-5 h-5 text-indigo-600" />
                Welch Allyn Import
              </CardTitle>
              <Badge className="bg-indigo-100 text-indigo-700">Spot Vision</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error display */}
            {waError && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{waError}</AlertDescription>
              </Alert>
            )}

            {/* Loading state */}
            {waLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-indigo-600">
                <Icons.Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Parsing Welch Allyn export...</span>
              </div>
            )}

            {/* Upload section — show when no import yet */}
            {!waImportResult && !waLoading && (
              <>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-indigo-800 mb-1">How to export from device:</p>
                  <ol className="text-xs text-indigo-700 space-y-0.5 list-decimal list-inside">
                    <li>Connect Welch Allyn Spot to computer via USB</li>
                    <li>Export data &mdash; device creates a ZIP file</li>
                    <li>Upload the ZIP file below (or the CSV from db/ folder)</li>
                  </ol>
                </div>

                {/* ZIP upload */}
                <div>
                  <input
                    ref={zipInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleZipUpload}
                    className="hidden"
                  />
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => zipInputRef.current?.click()}
                  >
                    <Icons.Upload className="w-4 h-4 mr-2" />
                    Upload ZIP Export (Recommended)
                  </Button>
                  <p className="text-[10px] text-slate-400 text-center mt-1">
                    Includes screening data, PDFs, and referral criteria
                  </p>
                </div>

                {/* CSV fallback */}
                <div>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <Icons.FileText className="w-4 h-4 mr-2" />
                    Upload CSV Only (SpotResults.csv)
                  </Button>
                </div>
              </>
            )}

            {/* Results list — show after import */}
            {waImportResult && !waLoading && (
              <>
                {/* Summary bar */}
                <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-indigo-800">
                      {waImportResult.totalCount} Children Screened
                    </p>
                    <p className="text-[10px] text-indigo-600">
                      Device {waImportResult.deviceSerial} &middot; {waImportResult.exportDate}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge className="bg-green-100 text-green-700 text-[10px]">
                      {waImportResult.passedCount} Passed
                    </Badge>
                    <Badge className="bg-red-100 text-red-700 text-[10px]">
                      {waImportResult.failedCount} Refer
                    </Badge>
                  </div>
                </div>

                {/* Instruction */}
                <p className="text-xs text-slate-500">
                  Select <strong>{childName}</strong>&apos;s screening result below:
                </p>

                {/* Children list */}
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {waImportResult.screenings.map((screening) => {
                    const childFirst = childName.split(' ')[0]?.toLowerCase() || ''
                    const isNameMatch = (
                      childFirst.length > 2 && (
                        screening.firstName.toLowerCase().includes(childFirst) ||
                        childFirst.includes(screening.firstName.toLowerCase())
                      )
                    )
                    return (
                      <button
                        key={screening.id}
                        className={`w-full text-left rounded-lg border-2 p-3 transition-all ${
                          isNameMatch
                            ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                            : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                        }`}
                        onClick={() => handleSelectWaChild(screening)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isNameMatch && (
                              <Badge className="bg-indigo-500 text-white text-[9px]">Match</Badge>
                            )}
                            <span className="text-sm font-medium text-slate-800">
                              {screening.fullName}
                            </span>
                          </div>
                          <Badge className={`text-[10px] ${
                            screening.passed
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {screening.passed ? 'Passed' : 'Refer'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-slate-500">
                            {screening.gender === 'F' ? '\u2640' : '\u2642'} {ageMonthsToYears(screening.ageInMonths)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            DOB: {screening.dateOfBirth}
                          </span>
                          {!screening.passed && (
                            <span className="text-[10px] text-red-500 font-medium">
                              {screening.resultText}
                            </span>
                          )}
                        </div>
                        {/* Quick refraction preview */}
                        <div className="flex gap-4 mt-1.5">
                          <div className="text-[10px] text-slate-500">
                            <span className="font-medium">OD:</span>{' '}
                            SE {screening.od.sphericalEquivalent > 0 ? '+' : ''}{screening.od.sphericalEquivalent.toFixed(2)}
                            {!screening.od.sePass && <span className="text-red-500 ml-0.5">\u2717</span>}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            <span className="font-medium">OS:</span>{' '}
                            SE {screening.os.sphericalEquivalent > 0 ? '+' : ''}{screening.os.sphericalEquivalent.toFixed(2)}
                            {!screening.os.sePass && <span className="text-red-500 ml-0.5">\u2717</span>}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Re-upload button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setWaImportResult(null)
                    setWaSelectedScreening(null)
                    setWaMapping(null)
                  }}
                >
                  <Icons.RefreshCw className="w-3 h-3 mr-1" />
                  Upload Different File
                </Button>
              </>
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
  // STEP 1: Symbol Matching Test (symbols mode)
  // ============================================
  if (step === 1 && inputMode === 'symbols') {
    const currentSize = SYMBOL_SIZES[symbolSizeIdx]
    const totalRounds = SYMBOL_SIZES.length
    const completedRounds = symbolResults.length

    return (
      <div className="space-y-4">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Symbol Matching</h3>
          <Badge variant="outline" className="text-xs">
            Level {symbolSizeIdx + 1} of {totalRounds} &middot; {currentSize.acuity}
          </Badge>
        </div>

        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(completedRounds / totalRounds) * 100}%` }}
          />
        </div>

        {/* Target symbol — large, centered */}
        <Card className="border-2 border-emerald-300 bg-emerald-50">
          <CardContent className="py-6 text-center">
            <p className="text-xs text-gray-500 mb-2 font-medium">Find this shape:</p>
            <div
              className="inline-block select-none transition-all duration-300"
              style={{ fontSize: `${currentSize.px}px`, lineHeight: 1 }}
            >
              {symbolTarget.emoji}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Size: {currentSize.acuity}</p>
          </CardContent>
        </Card>

        {/* 2x2 choice grid */}
        <div className="grid grid-cols-2 gap-3">
          {symbolOptions.map(sym => {
            const isSelected = symbolSelected === sym.id
            const isCorrect = isSelected && sym.id === symbolTarget.id
            const isWrong = isSelected && sym.id !== symbolTarget.id

            return (
              <button
                key={sym.id}
                onClick={() => handleSymbolSelect(sym.id)}
                disabled={!!symbolSelected}
                className={`
                  rounded-2xl border-3 p-5 transition-all duration-150
                  active:scale-95 disabled:opacity-60
                  ${sym.bg} ${sym.border}
                  ${isCorrect ? `ring-4 ring-green-500 bg-green-100` : ''}
                  ${isWrong ? `ring-4 ring-red-400 bg-red-50` : ''}
                  ${!isSelected ? 'hover:scale-[1.02] shadow-md hover:shadow-lg' : ''}
                `}
                style={{ borderWidth: '3px' }}
              >
                <div className="text-5xl mb-2 select-none">{sym.emoji}</div>
                <p className="text-sm font-bold select-none">{sym.label}</p>
                {isCorrect && <p className="text-xs text-green-600 font-bold mt-1">Correct!</p>}
                {isWrong && <p className="text-xs text-red-500 font-bold mt-1">Try again</p>}
              </button>
            )
          })}
        </div>

        {/* Results so far */}
        {symbolResults.length > 0 && (
          <div className="flex items-center gap-1 justify-center">
            {symbolResults.map((r, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  r.correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                }`}
              >
                {r.correct ? '\u{2713}' : '\u{2717}'}
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => { setStep(0); setInputMode('symbols') }}>
          Cancel Test
        </Button>
      </div>
    )
  }

  // ============================================
  // STEP 1: Camera Capture (camera mode)
  // ============================================
  if (step === 1) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Position {childName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden">
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-40 border-2 border-white rounded-full opacity-50" />
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm bg-black/30 py-1">
                  Position {childName}&apos;s face in the circle
                </div>
              </>
            ) : (
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-cover"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {!capturedImage && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStep(0); setInputMode('camera') }} className="flex-1">
                Back
              </Button>
              <Button className="flex-1" onClick={captureAndAnalyze}>
                <Icons.Camera className="w-4 h-4 mr-2" />
                Capture &amp; Analyze
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ============================================
  // STEP 2: Results + Annotation (Camera or Welch Allyn)
  // ============================================
  return (
    <div className="space-y-4">
      {/* Symbol Matching Results */}
      {inputMode === 'symbols' && symbolAcuity && (
        <Card className="border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-lg">{'\u{2B50}'}</span>
              Symbol Matching Results &mdash; {childName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`text-center py-3 rounded-lg font-semibold text-sm ${
              SYMBOL_SIZES.findIndex(s => s.acuity === symbolAcuity) >= 5
                ? 'bg-green-100 text-green-800'
                : SYMBOL_SIZES.findIndex(s => s.acuity === symbolAcuity) >= 3
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}>
              Visual Acuity: {symbolAcuity}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg border bg-green-50 border-green-200">
                <p className="text-[10px] font-bold text-slate-600">Correct</p>
                <p className="text-lg font-semibold text-green-700">{symbolCorrectCount}</p>
              </div>
              <div className="p-2.5 rounded-lg border bg-slate-50 border-slate-200">
                <p className="text-[10px] font-bold text-slate-600">Total Rounds</p>
                <p className="text-lg font-semibold text-slate-700">{symbolResults.length}</p>
              </div>
            </div>

            {/* Round-by-round results */}
            <div className="flex flex-wrap gap-1">
              {symbolResults.map((r, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className={`text-[10px] ${r.correct ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                >
                  {r.acuity} {r.correct ? '\u{2713}' : '\u{2717}'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Camera Results (when in camera mode) */}
      {capturedImage && !waSelectedScreening && inputMode !== 'symbols' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icons.Camera className="w-4 h-4 text-blue-600" />
              Capture Results &mdash; {childName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden">
              <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2.5 rounded-lg border ${analysisResult?.present ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[10px] font-bold text-slate-600">Red Reflex</p>
                <p className="text-sm font-semibold">{analysisResult?.present ? 'Detected' : 'Not Detected'}</p>
              </div>
              <div className={`p-2.5 rounded-lg border ${
                (analysisResult?.symmetry || 0) > 0.85 ? 'bg-green-50 border-green-200' :
                (analysisResult?.symmetry || 0) > 0.7 ? 'bg-yellow-50 border-yellow-200' :
                'bg-red-50 border-red-200'
              }`}>
                <p className="text-[10px] font-bold text-slate-600">Symmetry</p>
                <p className="text-sm font-semibold">{((analysisResult?.symmetry || 0) * 100).toFixed(0)}%</p>
              </div>
            </div>

            {/* Photoscreening AI */}
            {photoscreenRunning && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-violet-600">
                <Icons.Loader2 className="w-3 h-3 animate-spin" />
                Running photoscreening AI...
              </div>
            )}
            {photoscreenResult && (
              <div className="p-3 rounded-lg bg-violet-50 border border-violet-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icons.Brain className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-xs font-medium text-violet-700">Photoscreening AI</span>
                  <span className="text-[10px] text-violet-400 ml-auto">{photoscreenResult.inferenceTimeMs}ms</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={`text-xs ${
                    photoscreenResult.overallRisk === 'pass' ? 'bg-green-50 text-green-700 border-green-200' :
                    photoscreenResult.overallRisk === 'refer' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                  }`}>
                    {photoscreenResult.overallRisk === 'pass' ? 'PASS' :
                     photoscreenResult.overallRisk === 'refer' ? 'REFER' : 'INCONCLUSIVE'}
                  </Badge>
                  {photoscreenResult.findings.length === 0 && (
                    <span className="text-xs text-gray-500">No findings detected</span>
                  )}
                </div>
                {photoscreenResult.findings.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {photoscreenResult.findings.map(f => (
                      <Badge key={f.chipId} variant="outline" className="text-[10px] bg-white">
                        {f.label} ({Math.round(f.confidence * 100)}%)
                      </Badge>
                    ))}
                  </div>
                )}
                {photoscreenResult.crescentAnalysis && (
                  <p className="text-[10px] text-violet-500 mt-1">
                    Crescent asymmetry: {photoscreenResult.crescentAnalysis.asymmetry}&deg;
                    {photoscreenResult.crescentAnalysis.estimatedAnisometropia && ' \u2014 anisometropia risk'}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Welch Allyn Device Results */}
      {waSelectedScreening && waMapping && (
        <Card className="border-indigo-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icons.Eye className="w-4 h-4 text-indigo-600" />
              Welch Allyn Spot &mdash; {waSelectedScreening.fullName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Pass/Fail badge */}
            <div className={`text-center py-2 rounded-lg font-semibold text-sm ${
              waSelectedScreening.passed
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {waSelectedScreening.passed ? '\u2713 PASSED \u2014 All Measurements In Range' : '\u2717 REFER \u2014 Complete Eye Exam Recommended'}
            </div>

            {/* Refraction data */}
            <div className="grid grid-cols-2 gap-2">
              {/* OD */}
              <div className={`rounded-lg p-2.5 border ${
                waSelectedScreening.od.sePass && waSelectedScreening.od.dcPass
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-[10px] font-bold text-slate-600 mb-1">OD (Right Eye)</p>
                <p className="text-sm font-mono font-semibold text-slate-800">
                  {waMapping.prescription.od}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  SE: {waSelectedScreening.od.sphericalEquivalent > 0 ? '+' : ''}{waSelectedScreening.od.sphericalEquivalent.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500">
                  Pupil: {waSelectedScreening.od.pupilSize.toFixed(1)} mm
                </p>
              </div>
              {/* OS */}
              <div className={`rounded-lg p-2.5 border ${
                waSelectedScreening.os.sePass && waSelectedScreening.os.dcPass
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className="text-[10px] font-bold text-slate-600 mb-1">OS (Left Eye)</p>
                <p className="text-sm font-mono font-semibold text-slate-800">
                  {waMapping.prescription.os}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  SE: {waSelectedScreening.os.sphericalEquivalent > 0 ? '+' : ''}{waSelectedScreening.os.sphericalEquivalent.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500">
                  Pupil: {waSelectedScreening.os.pupilSize.toFixed(1)} mm
                </p>
              </div>
            </div>

            {/* IPD */}
            <p className="text-[10px] text-center text-slate-400">
              Inter-pupillary distance: {waSelectedScreening.interpupilDistance.toFixed(1)} mm
            </p>

            {/* Conditions */}
            {waMapping.conditionDetails.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-slate-600">Detected Conditions:</p>
                {waMapping.conditionDetails.map((d, i) => (
                  <div key={i} className={`text-xs p-2 rounded-lg border ${
                    d.severity === 'severe'
                      ? 'bg-red-50 border-red-200'
                      : d.severity === 'moderate'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">
                        {d.condition} ({d.eye})
                      </span>
                      <div className="flex items-center gap-1">
                        {d.value !== undefined && (
                          <Badge variant="outline" className="text-[10px]">
                            {d.value > 0 ? '+' : ''}{d.value.toFixed(2)}D
                          </Badge>
                        )}
                        <Badge className={`text-[10px] ${
                          d.severity === 'severe' ? 'bg-red-200 text-red-800'
                            : d.severity === 'moderate' ? 'bg-amber-200 text-amber-800'
                              : 'bg-yellow-200 text-yellow-800'
                        }`}>
                          {d.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Risk summary */}
            <div className={`text-xs font-medium p-2 rounded-lg text-center ${
              waMapping.riskCategory === 'high_risk'
                ? 'bg-red-100 text-red-700'
                : waMapping.riskCategory === 'possible_risk'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
            }`}>
              Risk Assessment: {
                waMapping.riskCategory === 'high_risk' ? 'High Risk \u2014 Refer for Complete Eye Exam'
                  : waMapping.riskCategory === 'possible_risk' ? 'Possible Risk \u2014 Follow Up Recommended'
                    : 'Normal \u2014 All Measurements In Range'
              }
            </div>

            {/* PDF link (if available) */}
            {waSelectedScreening.pdfBlob && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  if (waSelectedScreening?.pdfBlob) {
                    const url = URL.createObjectURL(waSelectedScreening.pdfBlob)
                    window.open(url, '_blank')
                  }
                }}
              >
                <Icons.FileText className="w-3 h-3 mr-1" />
                View Welch Allyn PDF Report
              </Button>
            )}

            {/* Metadata */}
            <p className="text-[10px] text-slate-400 text-center">
              Device: {waSelectedScreening.deviceSerial} &middot;
              SW {waSelectedScreening.swVersion} &middot;
              Screened: {waSelectedScreening.timestamp}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Annotation chips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Vision Findings &mdash; {childName}</CardTitle>
          {waMapping && waMapping.suggestedChips.length > 0 && (
            <p className="text-[10px] text-indigo-600 mt-1">
              Welch Allyn auto-selected: {waMapping.suggestedChipLabels.join(', ')}
            </p>
          )}
          {!waMapping && photoscreenResult && photoscreenResult.findings.length > 0 && (
            <p className="text-[10px] text-violet-600 mt-1">
              AI auto-selected: {photoscreenResult.findings.map(f => f.label).join(', ')}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <AnnotationChips
            chips={chips}
            selectedChips={selectedChips}
            onToggleChip={(id) => setSelectedChips(prev =>
              prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
            )}
            chipSeverities={chipSeverities}
            onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
            aiSuggestedChips={waMapping?.suggestedChips || photoscreenResult?.findings.map(f => f.chipId) || []}
            notes={notes}
            onNotesChange={setNotes}
            onComplete={waSelectedScreening ? handleWaComplete : inputMode === 'symbols' ? handleSymbolComplete : handleCameraComplete}
            onBack={() => {
              if (waSelectedScreening) {
                setStep(0)
                setInputMode('select')
              } else if (inputMode === 'symbols') {
                // Reset symbol test
                setSymbolSizeIdx(0)
                setSymbolResults([])
                setSymbolCorrectCount(0)
                setSymbolWrongCount(0)
                setSymbolAcuity(null)
                setSymbolSelected(null)
                setStep(1)
              } else {
                // Go back to camera capture
                setCapturedImage(null)
                setAnalysisResult(null)
                setPhotoscreenResult(null)
                setStep(1)
                setInputMode('camera')
              }
            }}
            imageDataUrl={capturedImage || undefined}
            moduleType="vision" moduleName="Vision Screening"
            childAge={childAge} orgConfig={orgConfig}
            onAiSuggestChips={(chipIds) => {
              setSelectedChips(prev => [...new Set([...prev, ...chipIds])])
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
