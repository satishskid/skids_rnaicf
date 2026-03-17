/**
 * HearingForm — Operator wrapper for picture-based hearing screening.
 *
 * Flow:
 * 1. Pre-test: Nurse enters contextual info (complaints, concerns)
 * 2. Test: PictureHearingTest runs the gamified child-facing test
 * 3. Post-test: Auto-generated results displayed, nurse can add notes
 *
 * The nurse does NOT annotate audiometric findings — those are auto-scored.
 * She only provides contextual information (child/teacher/parent complaints).
 */

import React, { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import {
  generateAudiometryResult, suggestHearingChips, classifyHearingLoss, getHearingColor,
  type AudiometryThreshold, type TestFrequency, type Ear,
} from '../lib/ai/index'
import type { AIResult } from '../lib/ai-engine'
import { PictureHearingTest, type PictureHearingResult } from './PictureHearingTest'

// ── Types ──

interface Props {
  onResult: (aiResult: AIResult) => void
  childAge?: number
  childName?: string
  accentColor?: string
}

interface ContextualInfo {
  childComplaint: boolean
  teacherConcern: boolean
  parentConcern: boolean
  historyOfEarInfection: boolean
  usesHearingAid: boolean
  notes: string
}

type Phase = 'context' | 'testing' | 'results'

// ── Component ──

export function HearingForm({ onResult, childAge, childName = 'the child', accentColor = '#4f46e5' }: Props) {
  const [phase, setPhase] = useState<Phase>('context')
  const [contextInfo, setContextInfo] = useState<ContextualInfo>({
    childComplaint: false,
    teacherConcern: false,
    parentConcern: false,
    historyOfEarInfection: false,
    usesHearingAid: false,
    notes: '',
  })
  const [testResult, setTestResult] = useState<PictureHearingResult | null>(null)
  const [audiometryResult, setAudiometryResult] = useState<ReturnType<typeof generateAudiometryResult> | null>(null)

  // Toggle a boolean context field
  const toggleField = (field: keyof ContextualInfo) => {
    if (typeof contextInfo[field] === 'boolean') {
      setContextInfo(prev => ({ ...prev, [field]: !prev[field] }))
    }
  }

  // Handle test completion
  const handleTestComplete = useCallback((result: PictureHearingResult) => {
    setTestResult(result)

    // Convert picture test thresholds to audiometry format
    const thresholds: AudiometryThreshold[] = result.thresholds.map(t => ({
      frequency: t.frequency as TestFrequency,
      ear: t.ear as Ear,
      thresholddB: t.thresholddB,
    }))

    // Run full audiometry analysis
    const audioResult = generateAudiometryResult(thresholds, childAge ? childAge * 12 : undefined)
    setAudiometryResult(audioResult)

    // Build contextual summary
    const concerns: string[] = []
    if (contextInfo.childComplaint) concerns.push('child reports hearing difficulty')
    if (contextInfo.teacherConcern) concerns.push('teacher concern')
    if (contextInfo.parentConcern) concerns.push('parent/caregiver concern')
    if (contextInfo.historyOfEarInfection) concerns.push('history of ear infections')
    if (contextInfo.usesHearingAid) concerns.push('uses hearing aid')

    const contextSuffix = concerns.length > 0
      ? ` Context: ${concerns.join(', ')}.`
      : ''

    const chips = suggestHearingChips(audioResult)

    const aiResult: AIResult = {
      classification: audioResult.overallClassification,
      confidence: 0.90,
      summary: `[Picture Audiometry] PTA L: ${audioResult.ptaLeft} dB, R: ${audioResult.ptaRight} dB. ` +
        `L: ${audioResult.classificationLeft}, R: ${audioResult.classificationRight}. ` +
        `Pattern: ${audioResult.frequencyPattern}. ` +
        `Speech PTA: L ${audioResult.speechPTALeft} R ${audioResult.speechPTARight} dB. ` +
        `${audioResult.asymmetry ? `Asymmetry: ${audioResult.asymmetryDB} dB. ` : ''}` +
        `Handicap: ${audioResult.hearingHandicap}%.` +
        contextSuffix +
        (contextInfo.notes ? ` Notes: ${contextInfo.notes}` : ''),
      suggestedChips: chips,
      zScore: undefined,
      percentile: undefined,
    }

    setPhase('results')
    onResult(aiResult)
  }, [contextInfo, childAge, onResult])

  // ── Phase 1: Contextual Information ──
  if (phase === 'context') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🎧 Hearing Screening</Text>
        <Text style={styles.subtitle}>Picture-based audiometry for {childName}</Text>

        {/* Contextual checkboxes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contextual Information</Text>
          <Text style={styles.sectionHint}>
            Check any concerns reported before the test
          </Text>

          {[
            { key: 'childComplaint' as const, emoji: '👧', label: 'Child complains of hearing difficulty' },
            { key: 'teacherConcern' as const, emoji: '👩‍🏫', label: 'Teacher reports hearing concern' },
            { key: 'parentConcern' as const, emoji: '👩‍👦', label: 'Parent/caregiver reports concern' },
            { key: 'historyOfEarInfection' as const, emoji: '🦠', label: 'History of ear infections' },
            { key: 'usesHearingAid' as const, emoji: '🦻', label: 'Currently uses hearing aid' },
          ].map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.checkRow, contextInfo[item.key] && styles.checkRowActive]}
              onPress={() => toggleField(item.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.checkEmoji}>{item.emoji}</Text>
              <Text style={[styles.checkLabel, contextInfo[item.key] && styles.checkLabelActive]}>
                {item.label}
              </Text>
              <View style={[styles.checkbox, contextInfo[item.key] && styles.checkboxActive]}>
                {contextInfo[item.key] && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Additional notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="e.g., child had cold last week, ear discharge noted..."
            placeholderTextColor={colors.textMuted}
            value={contextInfo.notes}
            onChangeText={text => setContextInfo(prev => ({ ...prev, notes: text }))}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Equipment check */}
        <View style={[styles.section, styles.equipmentCheck]}>
          <Text style={styles.equipmentTitle}>⚠️ Before Starting</Text>
          <Text style={styles.equipmentItem}>• Connect headphones (over-ear preferred)</Text>
          <Text style={styles.equipmentItem}>• Find a quiet room — no fans, AC, or loud sounds</Text>
          <Text style={styles.equipmentItem}>• Set device volume to maximum</Text>
          <Text style={styles.equipmentItem}>• Seat {childName} comfortably facing the screen</Text>
        </View>

        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: accentColor }]}
          onPress={() => setPhase('testing')}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Start Sound Game →</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Phase 2: Picture-based Test ──
  if (phase === 'testing') {
    return (
      <PictureHearingTest
        childName={childName}
        onComplete={handleTestComplete}
        onCancel={() => setPhase('context')}
        accentColor={accentColor}
      />
    )
  }

  // ── Phase 3: Auto-generated Results ──
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Results — Auto-Generated</Text>

      {audiometryResult && (
        <>
          {/* Overall classification */}
          <View style={[styles.overallCard, { borderColor: getHearingColor(audiometryResult.ptaBetter) }]}>
            <Text style={styles.overallLabel}>Overall</Text>
            <Text style={[styles.overallClassification, { color: getHearingColor(audiometryResult.ptaBetter) }]}>
              {audiometryResult.overallClassification}
            </Text>
            {audiometryResult.ptaBetter > 30 && (
              <Text style={styles.whoWarning}>⚠️ WHO: Disabling hearing loss in children (&gt;30 dB)</Text>
            )}
          </View>

          {/* Per-ear results */}
          <View style={styles.earResults}>
            {(['left', 'right'] as Ear[]).map(ear => {
              const pta = ear === 'left' ? audiometryResult.ptaLeft : audiometryResult.ptaRight
              const classification = ear === 'left' ? audiometryResult.classificationLeft : audiometryResult.classificationRight
              const speechPTA = ear === 'left' ? audiometryResult.speechPTALeft : audiometryResult.speechPTARight
              return (
                <View key={ear} style={[styles.earCard, { borderColor: getHearingColor(pta) }]}>
                  <Text style={styles.earCardEmoji}>{ear === 'left' ? '👈' : '👉'}</Text>
                  <Text style={styles.earCardTitle}>{ear === 'left' ? 'Left' : 'Right'} Ear</Text>
                  <Text style={[styles.earCardPTA, { color: getHearingColor(pta) }]}>{pta} dB</Text>
                  <Text style={styles.earCardClass}>{classification}</Text>
                  <Text style={styles.earCardSpeech}>Speech: {speechPTA} dB</Text>
                </View>
              )
            })}
          </View>

          {/* Key findings */}
          <View style={styles.findingsSection}>
            <Text style={styles.findingsTitle}>Key Findings</Text>
            <View style={styles.findingRow}>
              <Text style={styles.findingLabel}>Pattern</Text>
              <Text style={styles.findingValue}>{audiometryResult.frequencyPattern}</Text>
            </View>
            <View style={styles.findingRow}>
              <Text style={styles.findingLabel}>Asymmetry</Text>
              <Text style={styles.findingValue}>
                {audiometryResult.asymmetry ? `Yes (${audiometryResult.asymmetryDB} dB)` : 'No'}
              </Text>
            </View>
            <View style={styles.findingRow}>
              <Text style={styles.findingLabel}>Handicap</Text>
              <Text style={styles.findingValue}>{audiometryResult.hearingHandicap}%</Text>
            </View>
            {testResult && (
              <View style={styles.findingRow}>
                <Text style={styles.findingLabel}>Trials</Text>
                <Text style={styles.findingValue}>
                  {testResult.trials.length} ({testResult.trials.filter(t => t.correct).length} correct)
                </Text>
              </View>
            )}
          </View>

          {/* Contextual info summary */}
          {(contextInfo.childComplaint || contextInfo.teacherConcern || contextInfo.parentConcern || contextInfo.historyOfEarInfection || contextInfo.usesHearingAid || contextInfo.notes) && (
            <View style={styles.contextSummary}>
              <Text style={styles.contextTitle}>Reported Concerns</Text>
              {contextInfo.childComplaint && <Text style={styles.contextItem}>• Child complains of hearing difficulty</Text>}
              {contextInfo.teacherConcern && <Text style={styles.contextItem}>• Teacher reported concern</Text>}
              {contextInfo.parentConcern && <Text style={styles.contextItem}>• Parent/caregiver reported concern</Text>}
              {contextInfo.historyOfEarInfection && <Text style={styles.contextItem}>• History of ear infections</Text>}
              {contextInfo.usesHearingAid && <Text style={styles.contextItem}>• Uses hearing aid</Text>}
              {contextInfo.notes ? <Text style={styles.contextItem}>📝 {contextInfo.notes}</Text> : null}
            </View>
          )}

          {/* Frequency breakdown table */}
          <View style={styles.thresholdTable}>
            <Text style={styles.findingsTitle}>Threshold Details (dB HL)</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.2 }]}>Freq</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>Left</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>Right</Text>
            </View>
            {[250, 500, 1000, 2000, 4000, 8000].map(freq => {
              const left = audiometryResult.thresholds.find(t => t.ear === 'left' && t.frequency === freq)
              const right = audiometryResult.thresholds.find(t => t.ear === 'right' && t.frequency === freq)
              return (
                <View key={freq} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.2, fontWeight: fontWeight.medium }]}>
                    {freq >= 1000 ? `${freq / 1000}k` : freq} Hz
                  </Text>
                  <Text style={[styles.tableCell, { color: getHearingColor(left?.thresholddB ?? 0) }]}>
                    {left ? `${left.thresholddB}` : '-'}
                  </Text>
                  <Text style={[styles.tableCell, { color: getHearingColor(right?.thresholddB ?? 0) }]}>
                    {right ? `${right.thresholddB}` : '-'}
                  </Text>
                </View>
              )
            })}
          </View>
        </>
      )}
    </View>
  )
}

// ── Styles ──

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
    marginTop: -spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  sectionHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: -4,
  },
  // Contextual checkboxes
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  checkRowActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#eef2ff',
  },
  checkEmoji: {
    fontSize: 20,
  },
  checkLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  checkLabelActive: {
    fontWeight: fontWeight.semibold,
    color: '#4338ca',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
  },
  checkmark: {
    fontSize: 14,
    color: '#fff',
    fontWeight: fontWeight.bold,
  },
  // Notes
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 70,
  },
  // Equipment
  equipmentCheck: {
    backgroundColor: '#fffbeb',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  equipmentTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#92400e',
  },
  equipmentItem: {
    fontSize: fontSize.xs,
    color: '#78350f',
    lineHeight: 18,
  },
  // Start button
  startButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadow.md,
  },
  startButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#fff',
  },
  // Results
  overallCard: {
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  overallLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  overallClassification: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  whoWarning: {
    fontSize: fontSize.xs,
    color: '#dc2626',
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xs,
  },
  earResults: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  earCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  earCardEmoji: {
    fontSize: 20,
  },
  earCardTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  earCardPTA: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  earCardClass: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  earCardSpeech: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Findings
  findingsSection: {
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  findingsTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  findingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  findingLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  findingValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  // Context summary
  contextSummary: {
    backgroundColor: '#fef3c7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: 4,
  },
  contextTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#92400e',
  },
  contextItem: {
    fontSize: fontSize.xs,
    color: '#78350f',
  },
  // Threshold table
  thresholdTable: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
  },
  tableHeaderText: {
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  tableCell: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlign: 'center',
  },
})
