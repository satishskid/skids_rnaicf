/**
 * PictureHearingTest — Gamified picture-based hearing screening for children.
 *
 * Based on WIPI-type closed-set picture-pointing tests and mHealth
 * teleaudiometry research. The child sees a 2×2 grid of large colorful
 * images. A calibrated pure tone plays in one ear. The child taps the
 * picture matching the sound's frequency band. Correct/incorrect responses
 * drive a Modified Hughson-Westlake staircase to find the hearing threshold.
 *
 * Key design:
 * - No text for the child — images and audio only
 * - Auto-scored — nurse does NOT annotate findings
 * - Frequency bands map to recognizable characters (low→cow, mid→bell, high→bird)
 * - Demo/practice round before real test
 * - Progress bar + star rewards for engagement
 *
 * References:
 * - WIPI Picture Identification Test (Ross & Lerman, 1970)
 * - WHO mHealth hearing screening guidelines
 * - ASHA school screening protocols
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
} from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import { playTone, playDemoTone, stopAllTones } from '../lib/tone-generator'
import type { Ear, TestFrequency } from '../lib/ai/audiometry'

// ── Frequency → Character Mapping ──
// Each frequency band maps to a recognizable character with a distinct emoji.
// Foils are drawn from other frequency bands to test perception, not memory.

interface SoundCharacter {
  id: string
  emoji: string
  label: string       // for accessibility / operator view only
  bgColor: string
  borderColor: string
  /** Representative frequency for this character */
  frequency: TestFrequency
  /** Frequency band: low (250-500), mid (1000-2000), high (4000-8000) */
  band: 'low' | 'mid' | 'high'
}

const CHARACTERS: SoundCharacter[] = [
  // Low frequency band (250-500 Hz) — deep, rumbling sounds
  { id: 'cow',    emoji: '🐄', label: 'Cow',    bgColor: '#fef3c7', borderColor: '#f59e0b', frequency: 250,  band: 'low' },
  { id: 'drum',   emoji: '🥁', label: 'Drum',   bgColor: '#fed7aa', borderColor: '#ea580c', frequency: 500,  band: 'low' },
  // Mid frequency band (1000-2000 Hz) — speech range
  { id: 'bell',   emoji: '🔔', label: 'Bell',   bgColor: '#dbeafe', borderColor: '#3b82f6', frequency: 1000, band: 'mid' },
  { id: 'dog',    emoji: '🐕', label: 'Dog',    bgColor: '#e0e7ff', borderColor: '#6366f1', frequency: 2000, band: 'mid' },
  // High frequency band (4000-8000 Hz) — high-pitched sounds
  { id: 'bird',   emoji: '🐦', label: 'Bird',   bgColor: '#d1fae5', borderColor: '#10b981', frequency: 4000, band: 'high' },
  { id: 'bee',    emoji: '🐝', label: 'Bee',    bgColor: '#fef9c3', borderColor: '#ca8a04', frequency: 8000, band: 'high' },
]

/** Map each test frequency to its target character. */
const FREQ_TO_CHARACTER: Record<number, SoundCharacter> = {}
for (const c of CHARACTERS) {
  FREQ_TO_CHARACTER[c.frequency] = c
}

/** Silence/nothing card — shown when child thinks they heard nothing. */
const NOTHING_CARD: SoundCharacter = {
  id: 'nothing', emoji: '🤫', label: 'Nothing',
  bgColor: '#f1f5f9', borderColor: '#94a3b8',
  frequency: 0 as TestFrequency, band: 'low',
}

// ── Test Configuration ──

/** Frequencies to test, in clinical order (1000 Hz first for familiarization). */
const TEST_ORDER: TestFrequency[] = [1000, 500, 250, 2000, 4000, 8000]

/** Starting dB HL level. */
const START_DB = 40

/** Modified Hughson-Westlake parameters. */
const DB_DOWN = 10  // decrease when heard
const DB_UP = 5     // increase when not heard
const MIN_DB = 0
const MAX_DB = 90
const THRESHOLD_CONFIRMATIONS = 2 // heard 2× at same level = threshold

/** Response window after tone ends (ms). */
const RESPONSE_TIMEOUT_MS = 4000

// ── Helper: pick foils ──

/** Pick 2 foils from different frequency bands + the nothing card = 4 total cards. */
function pickFoils(target: SoundCharacter): SoundCharacter[] {
  const otherBands = CHARACTERS.filter(c => c.band !== target.band)
  // Pick one from each other band
  const bands = ['low', 'mid', 'high'].filter(b => b !== target.band) as ('low' | 'mid' | 'high')[]
  const foils: SoundCharacter[] = []
  for (const band of bands) {
    const candidates = otherBands.filter(c => c.band === band)
    foils.push(candidates[Math.floor(Math.random() * candidates.length)])
  }
  return foils
}

/** Shuffle array in place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Types ──

export interface HearingThresholdResult {
  frequency: TestFrequency
  ear: Ear
  thresholddB: number
}

export interface PictureHearingResult {
  thresholds: HearingThresholdResult[]
  /** Per-trial log for review. */
  trials: TrialRecord[]
}

interface TrialRecord {
  frequency: TestFrequency
  ear: Ear
  dbHL: number
  targetId: string
  selectedId: string | null // null = timeout
  correct: boolean
  responseTimeMs: number | null
}

type Phase = 'demo' | 'testing' | 'done'
type ToneState = 'idle' | 'playing' | 'waiting'

// ── Props ──

interface Props {
  childName: string
  onComplete: (result: PictureHearingResult) => void
  onCancel: () => void
  accentColor?: string
}

// ── Component ──

export function PictureHearingTest({ childName, onComplete, onCancel, accentColor = '#4f46e5' }: Props) {
  // Phase management
  const [phase, setPhase] = useState<Phase>('demo')
  const [demoStep, setDemoStep] = useState(0) // 0=intro, 1=practice1, 2=practice2, 3=ready

  // Test state
  const [currentEar, setCurrentEar] = useState<Ear>('left')
  const [currentFreqIdx, setCurrentFreqIdx] = useState(0)
  const [currentDB, setCurrentDB] = useState(START_DB)
  const [toneState, setToneState] = useState<ToneState>('idle')
  const [heardCountAtLevel, setHeardCountAtLevel] = useState(0)

  // Cards for current trial
  const [cards, setCards] = useState<SoundCharacter[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackCorrect, setFeedbackCorrect] = useState(false)

  // Results
  const [thresholds, setThresholds] = useState<HearingThresholdResult[]>([])
  const [trials, setTrials] = useState<TrialRecord[]>([])

  // Stars earned (engagement)
  const [stars, setStars] = useState(0)

  // Refs
  const toneRef = useRef<{ stop: () => void } | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toneStartRef = useRef<number>(0)
  const tappedRef = useRef(false)

  // Animation
  const starScale = useRef(new Animated.Value(0)).current

  const currentFreq = TEST_ORDER[currentFreqIdx]
  const totalTests = TEST_ORDER.length * 2
  const currentTestNum = (currentEar === 'left' ? 0 : TEST_ORDER.length) + currentFreqIdx + 1
  const progress = (currentTestNum - 1) / totalTests

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllTones()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // ── Star animation ──
  const animateStar = useCallback(() => {
    starScale.setValue(0)
    Animated.spring(starScale, {
      toValue: 1,
      friction: 3,
      tension: 200,
      useNativeDriver: true,
    }).start()
  }, [starScale])

  // ── Prepare cards for a frequency ──
  const prepareCards = useCallback((freq: TestFrequency) => {
    const target = FREQ_TO_CHARACTER[freq]
    if (!target) return
    const foils = pickFoils(target)
    // 4 cards: target + 2 foils + nothing
    setCards(shuffle([target, ...foils, NOTHING_CARD]))
    setSelectedCardId(null)
    setShowFeedback(false)
  }, [])

  // ── Record threshold and advance ──
  const advanceToNext = useCallback((thresholdDB: number) => {
    const newThreshold: HearingThresholdResult = {
      frequency: currentFreq,
      ear: currentEar,
      thresholddB: thresholdDB,
    }
    const updated = [...thresholds, newThreshold]
    setThresholds(updated)
    setHeardCountAtLevel(0)
    setCurrentDB(START_DB)

    if (currentFreqIdx < TEST_ORDER.length - 1) {
      setCurrentFreqIdx(currentFreqIdx + 1)
    } else if (currentEar === 'left') {
      setCurrentEar('right')
      setCurrentFreqIdx(0)
    } else {
      // All done
      setPhase('done')
      onComplete({ thresholds: updated, trials })
      return
    }
    setToneState('idle')
  }, [currentFreq, currentEar, currentFreqIdx, thresholds, trials, onComplete])

  // ── Play tone for current trial ──
  const playCurrentTone = useCallback(() => {
    const freq = TEST_ORDER[currentFreqIdx]
    prepareCards(freq)
    setToneState('playing')
    tappedRef.current = false
    toneStartRef.current = Date.now()

    const tone = playTone(freq, currentDB, currentEar, 1000)
    toneRef.current = tone

    tone.promise.then(() => {
      if (tappedRef.current) return
      setToneState('waiting')

      // Timeout: no response = not heard
      timeoutRef.current = setTimeout(() => {
        if (tappedRef.current) return

        // Record trial
        setTrials(prev => [...prev, {
          frequency: freq, ear: currentEar, dbHL: currentDB,
          targetId: FREQ_TO_CHARACTER[freq]?.id ?? '',
          selectedId: null, correct: false, responseTimeMs: null,
        }])

        if (currentDB >= MAX_DB) {
          advanceToNext(MAX_DB + 5) // profound
        } else {
          setCurrentDB(prev => Math.min(prev + DB_UP, MAX_DB))
          setHeardCountAtLevel(0)
          setToneState('idle')
          setSelectedCardId(null)
          setShowFeedback(false)
        }
      }, RESPONSE_TIMEOUT_MS)
    })
  }, [currentFreqIdx, currentDB, currentEar, prepareCards, advanceToNext])

  // ── Handle card tap ──
  const handleCardTap = useCallback((card: SoundCharacter) => {
    if (toneState !== 'playing' && toneState !== 'waiting') return
    if (tappedRef.current) return

    tappedRef.current = true
    setSelectedCardId(card.id)
    toneRef.current?.stop()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const responseTime = Date.now() - toneStartRef.current
    const target = FREQ_TO_CHARACTER[TEST_ORDER[currentFreqIdx]]
    const isCorrect = card.id === target?.id
    const isNothing = card.id === 'nothing'

    // Show brief feedback
    setFeedbackCorrect(isCorrect)
    setShowFeedback(true)
    if (isCorrect) {
      setStars(s => s + 1)
      animateStar()
    }

    // Record trial
    setTrials(prev => [...prev, {
      frequency: TEST_ORDER[currentFreqIdx], ear: currentEar, dbHL: currentDB,
      targetId: target?.id ?? '', selectedId: card.id,
      correct: isCorrect, responseTimeMs: responseTime,
    }])

    // Staircase logic after brief delay for feedback
    setTimeout(() => {
      if (isNothing || !isCorrect) {
        // Not heard / wrong answer → increase dB
        if (currentDB >= MAX_DB) {
          advanceToNext(MAX_DB + 5)
        } else {
          setCurrentDB(prev => Math.min(prev + DB_UP, MAX_DB))
          setHeardCountAtLevel(0)
          setToneState('idle')
          setSelectedCardId(null)
          setShowFeedback(false)
        }
      } else {
        // Correct! → heard at this level
        const newCount = heardCountAtLevel + 1
        if (newCount >= THRESHOLD_CONFIRMATIONS) {
          // Threshold found
          advanceToNext(currentDB)
        } else {
          setHeardCountAtLevel(newCount)
          setCurrentDB(prev => Math.max(prev - DB_DOWN, MIN_DB))
          setToneState('idle')
          setSelectedCardId(null)
          setShowFeedback(false)
        }
      }
    }, 800) // 800ms feedback display
  }, [toneState, currentFreqIdx, currentEar, currentDB, heardCountAtLevel, animateStar, advanceToNext])

  // ── Demo handlers ──
  const handleDemoPlay = useCallback((freq: TestFrequency, ear: Ear) => {
    prepareCards(freq)
    const tone = playDemoTone(freq, ear)
    toneRef.current = tone
    setToneState('playing')
    tone.promise.then(() => setToneState('idle'))
  }, [prepareCards])

  const handleDemoCardTap = useCallback((card: SoundCharacter, targetId: string) => {
    setSelectedCardId(card.id)
    const isCorrect = card.id === targetId
    setFeedbackCorrect(isCorrect)
    setShowFeedback(true)
    if (isCorrect) {
      setStars(s => s + 1)
      animateStar()
    }
    toneRef.current?.stop()
    setTimeout(() => {
      setSelectedCardId(null)
      setShowFeedback(false)
      if (isCorrect) setDemoStep(prev => prev + 1)
    }, 1000)
  }, [animateStar])

  // ── RENDER ──

  // Demo phase
  if (phase === 'demo') {
    return (
      <View style={styles.container}>
        {/* Header with stars */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🎧 Sound Game</Text>
          <View style={styles.starRow}>
            {stars > 0 && (
              <Animated.Text style={[styles.starText, { transform: [{ scale: starScale }] }]}>
                ⭐ {stars}
              </Animated.Text>
            )}
          </View>
        </View>

        {demoStep === 0 && (
          <View style={styles.demoContainer}>
            <Text style={styles.demoTitle}>Let's Play!</Text>
            <Text style={styles.demoText}>
              {childName} will hear sounds through the headphones.{'\n\n'}
              When a sound plays, tap the picture that matches!
            </Text>

            {/* Show all characters */}
            <View style={styles.characterShowcase}>
              {CHARACTERS.map(c => (
                <View key={c.id} style={[styles.showcaseCard, { backgroundColor: c.bgColor, borderColor: c.borderColor }]}>
                  <Text style={styles.showcaseEmoji}>{c.emoji}</Text>
                  <Text style={styles.showcaseLabel}>{c.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.demoHint}>
              Each picture has its own sound!{'\n'}
              🐄 Cow = deep sound • 🔔 Bell = medium • 🐦 Bird = high
            </Text>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: accentColor }]}
              onPress={() => setDemoStep(1)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Let's Practice! →</Text>
            </TouchableOpacity>
          </View>
        )}

        {demoStep === 1 && (
          <View style={styles.demoContainer}>
            <Text style={styles.demoTitle}>Practice Round 1</Text>
            <Text style={styles.demoText}>
              Tap the play button, then tap the matching picture!
            </Text>

            {toneState === 'idle' ? (
              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: accentColor }]}
                onPress={() => handleDemoPlay(1000, 'left')}
                activeOpacity={0.8}
              >
                <Text style={styles.playButtonEmoji}>▶️</Text>
                <Text style={styles.playButtonText}>Play Sound</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <View style={styles.listeningIndicator}>
                  <Text style={styles.listeningDot}>🔊</Text>
                  <Text style={styles.listeningText}>Listen...</Text>
                </View>
                <View style={styles.cardGrid}>
                  {cards.map(card => (
                    <TouchableOpacity
                      key={card.id}
                      style={[
                        styles.pictureCard,
                        { backgroundColor: card.bgColor, borderColor: card.borderColor },
                        selectedCardId === card.id && styles.cardSelected,
                        showFeedback && selectedCardId === card.id && (feedbackCorrect ? styles.cardCorrect : styles.cardWrong),
                      ]}
                      onPress={() => handleDemoCardTap(card, 'bell')}
                      disabled={!!selectedCardId}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardEmoji}>{card.emoji}</Text>
                      {showFeedback && selectedCardId === card.id && (
                        <View style={[styles.feedbackBadge, feedbackCorrect ? styles.feedbackCorrectBg : styles.feedbackWrongBg]}>
                          <Text style={styles.feedbackText}>{feedbackCorrect ? '⭐' : '✗'}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {demoStep === 2 && (
          <View style={styles.demoContainer}>
            <Text style={styles.demoTitle}>Practice Round 2</Text>
            <Text style={styles.demoText}>
              Now try a different sound!
            </Text>

            {toneState === 'idle' ? (
              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: accentColor }]}
                onPress={() => handleDemoPlay(4000, 'right')}
                activeOpacity={0.8}
              >
                <Text style={styles.playButtonEmoji}>▶️</Text>
                <Text style={styles.playButtonText}>Play Sound</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <View style={styles.listeningIndicator}>
                  <Text style={styles.listeningDot}>🔊</Text>
                  <Text style={styles.listeningText}>Listen...</Text>
                </View>
                <View style={styles.cardGrid}>
                  {cards.map(card => (
                    <TouchableOpacity
                      key={card.id}
                      style={[
                        styles.pictureCard,
                        { backgroundColor: card.bgColor, borderColor: card.borderColor },
                        selectedCardId === card.id && styles.cardSelected,
                        showFeedback && selectedCardId === card.id && (feedbackCorrect ? styles.cardCorrect : styles.cardWrong),
                      ]}
                      onPress={() => handleDemoCardTap(card, 'bird')}
                      disabled={!!selectedCardId}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cardEmoji}>{card.emoji}</Text>
                      {showFeedback && selectedCardId === card.id && (
                        <View style={[styles.feedbackBadge, feedbackCorrect ? styles.feedbackCorrectBg : styles.feedbackWrongBg]}>
                          <Text style={styles.feedbackText}>{feedbackCorrect ? '⭐' : '✗'}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {demoStep >= 3 && (
          <View style={styles.demoContainer}>
            <Text style={styles.demoTitle}>Great Job! 🎉</Text>
            <Text style={styles.demoText}>
              {childName} is ready for the real test!{'\n\n'}
              We'll test both ears, starting with the left ear.
            </Text>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#16a34a' }]}
              onPress={() => { setPhase('testing'); setToneState('idle') }}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Start Test 🎧</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Testing phase
  if (phase === 'testing') {
    return (
      <View style={styles.container}>
        {/* Header: progress + stars + ear indicator */}
        <View style={styles.header}>
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>{currentTestNum}/{totalTests}</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
            </View>
          </View>
          <View style={styles.starRow}>
            {stars > 0 && (
              <Animated.Text style={[styles.starText, { transform: [{ scale: starScale }] }]}>
                ⭐ {stars}
              </Animated.Text>
            )}
          </View>
        </View>

        {/* Ear indicator */}
        <View style={[styles.earBanner, { backgroundColor: currentEar === 'left' ? '#dbeafe' : '#fee2e2' }]}>
          <Text style={[styles.earEmoji]}>{currentEar === 'left' ? '👈' : '👉'}</Text>
          <Text style={[styles.earText, { color: currentEar === 'left' ? '#1d4ed8' : '#dc2626' }]}>
            {currentEar === 'left' ? 'Left' : 'Right'} Ear
          </Text>
        </View>

        {/* Play button (idle) or card grid (playing/waiting) */}
        {toneState === 'idle' && (
          <View style={styles.playSection}>
            <TouchableOpacity
              style={[styles.bigPlayButton, { backgroundColor: accentColor }]}
              onPress={playCurrentTone}
              activeOpacity={0.8}
            >
              <Text style={styles.bigPlayEmoji}>▶️</Text>
              <Text style={styles.bigPlayText}>Play Sound</Text>
            </TouchableOpacity>
          </View>
        )}

        {(toneState === 'playing' || toneState === 'waiting') && (
          <View style={styles.testArea}>
            {/* Listening indicator */}
            <View style={styles.listeningIndicator}>
              <Text style={styles.listeningDot}>
                {toneState === 'playing' ? '🔊' : '👂'}
              </Text>
              <Text style={styles.listeningText}>
                {toneState === 'playing' ? 'Listen...' : 'What did you hear?'}
              </Text>
            </View>

            {/* 2×2 Card grid */}
            <View style={styles.cardGrid}>
              {cards.map(card => (
                <TouchableOpacity
                  key={card.id}
                  style={[
                    styles.pictureCard,
                    { backgroundColor: card.bgColor, borderColor: card.borderColor },
                    selectedCardId === card.id && styles.cardSelected,
                    showFeedback && selectedCardId === card.id && (feedbackCorrect ? styles.cardCorrect : styles.cardWrong),
                  ]}
                  onPress={() => handleCardTap(card)}
                  disabled={!!selectedCardId}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cardEmoji}>{card.emoji}</Text>
                  {showFeedback && selectedCardId === card.id && (
                    <View style={[styles.feedbackBadge, feedbackCorrect ? styles.feedbackCorrectBg : styles.feedbackWrongBg]}>
                      <Text style={styles.feedbackText}>{feedbackCorrect ? '⭐' : '✗'}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Smiley meter */}
        <View style={styles.smileyMeter}>
          {[...Array(5)].map((_, i) => (
            <Text key={i} style={[styles.smileyDot, { opacity: i < Math.min(stars, 5) ? 1 : 0.2 }]}>
              {i < Math.min(stars, 5) ? '😊' : '⚪'}
            </Text>
          ))}
        </View>

        <TouchableOpacity style={styles.cancelLink} onPress={onCancel}>
          <Text style={styles.cancelText}>Stop Test</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Done — shouldn't render here (onComplete is called), but safety fallback
  return (
    <View style={styles.container}>
      <Text style={styles.demoTitle}>Test Complete! 🎉</Text>
      <Text style={styles.demoText}>⭐ {stars} stars earned!</Text>
    </View>
  )
}

// ── Styles ──

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_SIZE = Math.min((SCREEN_WIDTH - spacing.lg * 3) / 2, 160)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#f59e0b',
  },
  progressSection: {
    flex: 1,
    marginRight: spacing.md,
    gap: 4,
  },
  progressLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  earBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  earEmoji: {
    fontSize: 28,
  },
  earText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  // Play button
  playSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigPlayButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.lg,
  },
  bigPlayEmoji: {
    fontSize: 48,
  },
  bigPlayText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#fff',
    marginTop: spacing.xs,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    alignSelf: 'center',
    ...shadow.md,
  },
  playButtonEmoji: {
    fontSize: 24,
  },
  playButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },
  // Test area
  testArea: {
    flex: 1,
    gap: spacing.md,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  listeningDot: {
    fontSize: 24,
  },
  listeningText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  // Card grid
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  pictureCard: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: borderRadius.xl,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.md,
  },
  cardEmoji: {
    fontSize: 56,
  },
  cardSelected: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  cardCorrect: {
    borderColor: '#16a34a',
    borderWidth: 4,
  },
  cardWrong: {
    borderColor: '#dc2626',
    borderWidth: 4,
    opacity: 0.6,
  },
  feedbackBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackCorrectBg: {
    backgroundColor: '#16a34a',
  },
  feedbackWrongBg: {
    backgroundColor: '#dc2626',
  },
  feedbackText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: fontWeight.bold,
  },
  // Smiley meter
  smileyMeter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  smileyDot: {
    fontSize: 20,
  },
  // Demo
  demoContainer: {
    flex: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  demoTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  demoText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  demoHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  characterShowcase: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  showcaseCard: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showcaseEmoji: {
    fontSize: 32,
  },
  showcaseLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: 2,
  },
  actionButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: spacing.md,
    ...shadow.md,
  },
  actionButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },
  cancelLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
})
