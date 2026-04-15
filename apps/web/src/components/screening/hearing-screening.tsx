
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ScreeningProps } from './types'
import { getAnnotationConfig } from './types'
import { AnnotationChips } from './annotation-chips'
import {
  playTone, generateAudiometryResult, classifyHearingLoss, getHearingColor,
  suggestHearingChips, TEST_FREQUENCIES,
} from '@/lib/ai/audiometry'
import type { AudiometryThreshold, AudiometryResult, Ear } from '@/lib/ai/audiometry'
import { AnnotationData, Severity } from '@skids/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'

const MODULE_TYPE = 'hearing'

type TestPhase = 'idle' | 'playing' | 'waiting' | 'response_recorded'

// ── Forced-choice image cards ──────────────────────────────────────────
// Children tap the image representing what they heard (or "Nothing").
// Any sound pick = heard, silence pick = not heard. Positions shuffle
// each round to prevent positional bias.
const SOUND_CARDS: { id: string; emoji: string; label: string; bg: string; border: string; ring: string }[] = [
  { id: 'bell',    emoji: '\u{1F514}', label: 'Bell',    bg: 'bg-yellow-50',  border: 'border-yellow-400', ring: 'ring-yellow-400' },
  { id: 'drum',    emoji: '\u{1F941}', label: 'Drum',    bg: 'bg-orange-50',  border: 'border-orange-400', ring: 'ring-orange-400' },
  { id: 'bird',    emoji: '\u{1F426}', label: 'Bird',    bg: 'bg-sky-50',     border: 'border-sky-400',    ring: 'ring-sky-400' },
  { id: 'silence', emoji: '\u{1F92B}', label: 'Nothing', bg: 'bg-gray-50',    border: 'border-gray-300',   ring: 'ring-gray-400' },
]

function shuffleCards() {
  const cards = [...SOUND_CARDS]
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export function HearingScreening({
  step, setStep, onComplete, instructions, childName,
}: ScreeningProps) {
  // Test state
  const [thresholds, setThresholds] = useState<AudiometryThreshold[]>([])
  const [currentEar, setCurrentEar] = useState<Ear>('left')
  const [currentFreqIdx, setCurrentFreqIdx] = useState(0)
  const [currentDB, setCurrentDB] = useState(40)
  const [phase, setPhase] = useState<TestPhase>('idle')
  const [heardCount, setHeardCount] = useState(0)
  const [notHeardCount, setNotHeardCount] = useState(0)
  const [testComplete, setTestComplete] = useState(false)
  const [result, setResult] = useState<AudiometryResult | null>(null)
  const [tapped, setTapped] = useState(false)
  const tappedRef = useRef(false) // ref mirror for async callbacks

  // Image card state
  const [shuffledCards, setShuffledCards] = useState(() => shuffleCards())
  const [selectedCard, setSelectedCard] = useState<string | null>(null)

  // Annotation state
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, Severity>>({})
  const [aiSuggestedChips, setAiSuggestedChips] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  const chips = getAnnotationConfig(MODULE_TYPE)
  const toneRef = useRef<{ stop: () => void } | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalTests = TEST_FREQUENCIES.length * 2
  const currentTestNum = (currentEar === 'left' ? 0 : TEST_FREQUENCIES.length) + currentFreqIdx + 1

  const currentFreq = TEST_FREQUENCIES[currentFreqIdx]

  // Advance to next frequency/ear or complete
  const advanceTest = useCallback((thresholdDB: number) => {
    const newThreshold: AudiometryThreshold = {
      frequency: currentFreq as AudiometryThreshold['frequency'],
      ear: currentEar,
      thresholddB: thresholdDB,
    }
    const updated = [...thresholds, newThreshold]
    setThresholds(updated)

    // Reset counters
    setHeardCount(0)
    setNotHeardCount(0)
    setCurrentDB(40)

    // Move to next
    if (currentFreqIdx < TEST_FREQUENCIES.length - 1) {
      setCurrentFreqIdx(currentFreqIdx + 1)
    } else if (currentEar === 'left') {
      // Switch to right ear
      setCurrentEar('right')
      setCurrentFreqIdx(0)
    } else {
      // All done
      const res = generateAudiometryResult(updated)
      setResult(res)
      const suggested = suggestHearingChips(res)
      setAiSuggestedChips(suggested)
      setSelectedChips(suggested)
      setTestComplete(true)
      setStep(2)
    }
    setPhase('idle')
    setSelectedCard(null)
  }, [currentFreq, currentEar, currentFreqIdx, thresholds, setStep])

  // Play a tone and show shuffled image cards
  const playCurrentTone = useCallback(() => {
    setPhase('playing')
    setTapped(false)
    tappedRef.current = false
    setSelectedCard(null)
    setShuffledCards(shuffleCards()) // Fresh shuffle each round

    const tone = playTone(currentFreq, currentDB, currentEar, 1000)
    toneRef.current = tone

    tone.promise.then(() => {
      // If already tapped during playback, skip the waiting phase
      if (tappedRef.current) return

      // After tone ends, wait for card selection (4s for children to process)
      setPhase('waiting')
      timeoutRef.current = setTimeout(() => {
        if (!tappedRef.current) {
          // No response — count as not heard
          const newNotHeard = notHeardCount + 1
          setNotHeardCount(newNotHeard)

          if (currentDB >= 90) {
            // Max level reached, record as threshold
            advanceTest(95) // Profound
          } else {
            setCurrentDB(prev => Math.min(prev + 5, 95))
            setPhase('idle')
            setSelectedCard(null)
          }
        }
      }, 4000)
    })
  }, [currentFreq, currentDB, currentEar, notHeardCount, advanceTest])

  // Child taps an image card
  const handleCardSelect = useCallback((cardId: string) => {
    if (phase !== 'playing' && phase !== 'waiting') return

    setSelectedCard(cardId)
    setTapped(true)
    tappedRef.current = true
    toneRef.current?.stop()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (cardId === 'silence') {
      // Child actively chose "Nothing" — count as not heard
      const newNotHeard = notHeardCount + 1
      setNotHeardCount(newNotHeard)

      if (currentDB >= 90) {
        advanceTest(95)
      } else {
        setCurrentDB(prev => Math.min(prev + 5, 95))
        setPhase('idle')
        setSelectedCard(null)
      }
    } else {
      // Child tapped a sound image — count as heard
      const newHeardCount = heardCount + 1
      setHeardCount(newHeardCount)

      if (newHeardCount >= 2) {
        // Heard 2 times at this level — threshold found
        advanceTest(currentDB)
      } else {
        // Heard once — decrease dB and try again
        setCurrentDB(prev => Math.max(prev - 10, 0))
        setPhase('idle')
        setSelectedCard(null)
      }
    }
  }, [phase, heardCount, notHeardCount, currentDB, advanceTest])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      toneRef.current?.stop()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleToggleChip = (chipId: string) => {
    setSelectedChips(prev =>
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    )
  }

  const handleComplete = () => {
    const annotationData: AnnotationData = {
      selectedChips, chipSeverities, pins: [], aiSuggestedChips, notes,
    }
    onComplete({
      moduleType: MODULE_TYPE,
      audiometryResult: result,
      annotationData,
      riskCategory: result && result.ptaBetter > 30 ? 'high_risk' : result && result.ptaBetter > 20 ? 'possible_risk' : 'no_risk',
    })
  }

  // Step 0: Instructions
  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle>{instructions.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert><Icons.Info className="w-4 h-4" /><AlertTitle>Instructions for {childName}</AlertTitle>
            <AlertDescription><ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              {instructions.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol></AlertDescription></Alert>
          <Card className="bg-indigo-50 border-indigo-200"><CardContent className="py-3 space-y-2">
            <p className="text-xs font-medium text-indigo-800">Before starting:</p>
            <ul className="text-xs text-indigo-700 space-y-1 list-disc list-inside">
              <li>Connect earphones/headphones</li>
              <li>Find a quiet room</li>
              <li>Explain to {childName}: &quot;You will hear a sound. Tap the picture of what you heard!&quot;</li>
            </ul>
          </CardContent></Card>

          {/* Preview the image cards so the child knows what to expect */}
          <Card className="bg-white border-dashed border-2 border-indigo-200"><CardContent className="py-3 space-y-2">
            <p className="text-xs font-medium text-indigo-800 text-center">The child will see these pictures:</p>
            <div className="grid grid-cols-4 gap-2">
              {SOUND_CARDS.map(card => (
                <div key={card.id} className={`${card.bg} ${card.border} border-2 rounded-xl p-2 text-center`}>
                  <div className="text-2xl">{card.emoji}</div>
                  <p className="text-[10px] font-medium mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 text-center">
              If they hear a sound, they tap Bell, Drum, or Bird. If not, they tap Nothing.
            </p>
          </CardContent></Card>

          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => setStep(1)}>
            Start Sound Game
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Step 1: Interactive audiometry with image cards
  if (step === 1 && !testComplete) {
    return (
      <div className="space-y-4">
        {/* Progress */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Sound Game</h3>
          <Badge variant="outline" className="text-xs">
            {currentTestNum} of {totalTests}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${((currentTestNum - 1) / totalTests) * 100}%` }}
          />
        </div>

        {/* Ear indicator */}
        <Card className={currentEar === 'left' ? 'border-blue-400 bg-blue-50' : 'border-red-400 bg-red-50'}>
          <CardContent className="py-3 text-center">
            <div className="text-3xl mb-1">{currentEar === 'left' ? '\u{1F448}' : '\u{1F449}'}</div>
            <p className="text-base font-bold capitalize">{currentEar} Ear</p>
            <p className="text-xs text-gray-500">{currentFreq} Hz &middot; {currentDB} dB</p>
          </CardContent>
        </Card>

        {/* Play button (idle) OR Image cards (playing/waiting) */}
        {phase === 'idle' && (
          <Button
            onClick={playCurrentTone}
            className="w-full h-16 text-lg bg-indigo-600 hover:bg-indigo-700"
          >
            <Icons.Play className="w-5 h-5 mr-2" />
            Play Tone
          </Button>
        )}

        {(phase === 'playing' || phase === 'waiting') && (
          <div className="space-y-3">
            {/* Status indicator */}
            <div className="text-center py-2">
              {phase === 'playing' && (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
                  <span className="text-sm text-indigo-700 font-medium">Listen...</span>
                </div>
              )}
              {phase === 'waiting' && (
                <p className="text-sm font-medium text-gray-700">What did {childName} hear?</p>
              )}
            </div>

            {/* 2x2 Image card grid */}
            <div className="grid grid-cols-2 gap-3">
              {shuffledCards.map(card => {
                const isSelected = selectedCard === card.id
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardSelect(card.id)}
                    disabled={!!selectedCard}
                    className={`
                      relative rounded-2xl border-3 p-4 transition-all duration-150
                      active:scale-95 disabled:opacity-60
                      ${card.bg} ${card.border}
                      ${isSelected ? `ring-4 ${card.ring} scale-95` : 'hover:scale-[1.02] shadow-md hover:shadow-lg'}
                    `}
                    style={{ borderWidth: '3px' }}
                  >
                    <div className="text-5xl mb-2 select-none">{card.emoji}</div>
                    <p className="text-sm font-bold select-none">{card.label}</p>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Icons.Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setStep(0)}>Cancel Test</Button>
      </div>
    )
  }

  // Step 2: Results + Annotation
  return (
    <div className="space-y-4">
      {result && (
        <Card>
          <CardHeader className="pb-2"><CardTitle>Audiometry Results</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Results table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-xs text-gray-500">Frequency</th>
                    {TEST_FREQUENCIES.map(f => (
                      <th key={f} className="text-center py-2 text-xs text-gray-500">{f} Hz</th>
                    ))}
                    <th className="text-center py-2 text-xs font-bold text-gray-700">PTA</th>
                  </tr>
                </thead>
                <tbody>
                  {(['left', 'right'] as Ear[]).map(ear => {
                    const pta = ear === 'left' ? result.ptaLeft : result.ptaRight
                    return (
                      <tr key={ear} className="border-b">
                        <td className="py-2 font-medium capitalize">
                          {ear === 'left' ? '\u{1F448}' : '\u{1F449}'} {ear}
                        </td>
                        {TEST_FREQUENCIES.map(f => {
                          const t = result.thresholds.find(th => th.ear === ear && th.frequency === f)
                          return (
                            <td key={f} className="text-center py-2">
                              {t ? `${t.thresholddB}` : '-'}
                            </td>
                          )
                        })}
                        <td className="text-center py-2">
                          <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${getHearingColor(pta)}`}>
                            {pta} dB
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Classification summary */}
            <div className="grid grid-cols-2 gap-3">
              {(['left', 'right'] as Ear[]).map(ear => {
                const pta = ear === 'left' ? result.ptaLeft : result.ptaRight
                const classification = ear === 'left' ? result.classificationLeft : result.classificationRight
                return (
                  <div key={ear} className={`p-3 rounded-lg border-2 ${getHearingColor(pta)}`}>
                    <p className="text-xs font-medium capitalize mb-1">{ear} Ear</p>
                    <p className="text-sm font-bold">{classification}</p>
                    <p className="text-xs">PTA: {pta} dB HL</p>
                  </div>
                )
              })}
            </div>

            <div className={`p-3 rounded-lg border-2 text-center ${getHearingColor(result.ptaBetter)}`}>
              <p className="text-xs font-medium">Overall Classification</p>
              <p className="text-lg font-bold">{result.overallClassification}</p>
              {result.ptaBetter > 30 && (
                <p className="text-xs mt-1 font-medium">WHO: Disabling hearing loss in children (&gt;30 dB)</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <AnnotationChips chips={chips} selectedChips={selectedChips}
            onToggleChip={handleToggleChip} chipSeverities={chipSeverities}
            onSetSeverity={(id, sev) => setChipSeverities(prev => ({ ...prev, [id]: sev }))}
            aiSuggestedChips={aiSuggestedChips} notes={notes} onNotesChange={setNotes}
            onComplete={handleComplete}
            onBack={() => { setTestComplete(false); setStep(1) }} />
        </CardContent>
      </Card>
    </div>
  )
}

export default HearingScreening
