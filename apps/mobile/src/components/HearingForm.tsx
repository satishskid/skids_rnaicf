// HearingForm — Pure-tone audiometry threshold entry form
// Collects thresholds at 500, 1000, 2000, 4000 Hz for left and right ear
// Runs generateAudiometryResult + suggestHearingChips on submit

import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme'
import {
  generateAudiometryResult, suggestHearingChips,
  TEST_FREQUENCIES,
  type AudiometryThreshold, type Ear, type TestFrequency,
} from '../lib/ai/index'
import type { AIResult } from '../lib/ai-engine'

interface Props {
  onResult: (aiResult: AIResult) => void
  childAge?: number
  accentColor?: string
}

const EARS: Ear[] = ['left', 'right']
const FREQ_LABELS: Record<number, string> = {
  500: '500 Hz',
  1000: '1 kHz',
  2000: '2 kHz',
  4000: '4 kHz',
}

export function HearingForm({ onResult, childAge, accentColor = '#4f46e5' }: Props) {
  // State: { left: { 500: '', 1000: '', ... }, right: { ... } }
  const [thresholds, setThresholds] = useState<Record<Ear, Record<number, string>>>({
    left: Object.fromEntries(TEST_FREQUENCIES.map(f => [f, ''])),
    right: Object.fromEntries(TEST_FREQUENCIES.map(f => [f, ''])),
  })
  const [submitted, setSubmitted] = useState(false)

  const updateThreshold = (ear: Ear, freq: number, value: string) => {
    setThresholds(prev => ({
      ...prev,
      [ear]: { ...prev[ear], [freq]: value },
    }))
  }

  const allFilled = EARS.every(ear =>
    TEST_FREQUENCIES.every(freq => thresholds[ear][freq].trim() !== '')
  )

  const handleSubmit = () => {
    if (!allFilled) return

    const audiometryThresholds: AudiometryThreshold[] = []
    for (const ear of EARS) {
      for (const freq of TEST_FREQUENCIES) {
        audiometryThresholds.push({
          frequency: freq as TestFrequency,
          ear,
          thresholddB: parseFloat(thresholds[ear][freq]) || 0,
        })
      }
    }

    const result = generateAudiometryResult(audiometryThresholds)
    const chips = suggestHearingChips(result)

    const aiResult: AIResult = {
      classification: result.overallClassification,
      confidence: 0.95,
      summary: `[Audiometry] PTA L: ${result.ptaLeft} dB, R: ${result.ptaRight} dB. ` +
        `L: ${result.classificationLeft}, R: ${result.classificationRight}. ` +
        `Pattern: ${result.frequencyPattern}`,
      suggestedChips: chips,
      zScore: undefined,
      percentile: undefined,
    }

    setSubmitted(true)
    onResult(aiResult)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pure-Tone Audiometry</Text>
      <Text style={styles.subtitle}>
        Enter hearing thresholds in dB HL for each frequency
      </Text>

      {EARS.map(ear => (
        <View key={ear} style={styles.earSection}>
          <View style={[styles.earHeader, { backgroundColor: ear === 'left' ? '#3b82f620' : '#ef444420' }]}>
            <Text style={[styles.earLabel, { color: ear === 'left' ? '#3b82f6' : '#ef4444' }]}>
              {ear === 'left' ? '\u{1F442} Left Ear' : 'Right Ear \u{1F442}'}
            </Text>
          </View>
          <View style={styles.freqRow}>
            {TEST_FREQUENCIES.map(freq => (
              <View key={freq} style={styles.freqInput}>
                <Text style={styles.freqLabel}>{FREQ_LABELS[freq]}</Text>
                <TextInput
                  style={[
                    styles.input,
                    submitted && styles.inputDisabled,
                  ]}
                  placeholder="dB"
                  placeholderTextColor={colors.textMuted}
                  value={thresholds[ear][freq]}
                  onChangeText={v => updateThreshold(ear, freq, v)}
                  keyboardType="numeric"
                  editable={!submitted}
                  maxLength={3}
                />
              </View>
            ))}
          </View>
        </View>
      ))}

      {!submitted && (
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: allFilled ? accentColor : colors.textMuted },
          ]}
          onPress={handleSubmit}
          disabled={!allFilled}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>Analyze Hearing</Text>
        </TouchableOpacity>
      )}

      {!allFilled && !submitted && (
        <Text style={styles.hint}>
          Enter all {TEST_FREQUENCIES.length * 2} thresholds to run analysis
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  earSection: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  earHeader: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  earLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  freqRow: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  freqInput: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  freqLabel: {
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
    width: '100%',
    backgroundColor: colors.background,
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: colors.textMuted,
  },
  submitButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
})
