// MChatForm — M-CHAT-R/F autism screening questionnaire
// Shows 20 yes/no questions, runs scoreMChat on submit

import React, { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme'
import { MCHAT_ITEMS, scoreMChat, type MChatAnswer } from '../lib/ai/index'
import type { AIResult } from '../lib/ai-engine'

interface Props {
  onResult: (aiResult: AIResult) => void
  childAge?: number
  accentColor?: string
}

export function MChatForm({ onResult, childAge, accentColor = '#7c3aed' }: Props) {
  const [answers, setAnswers] = useState<Record<number, boolean | null>>(
    Object.fromEntries(MCHAT_ITEMS.map(item => [item.id, null]))
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const currentItem = MCHAT_ITEMS[currentIndex]
  const answeredCount = Object.values(answers).filter(v => v !== null).length
  const allAnswered = answeredCount === MCHAT_ITEMS.length

  const setAnswer = (itemId: number, response: boolean) => {
    setAnswers(prev => ({ ...prev, [itemId]: response }))
    // Auto-advance to next unanswered
    if (currentIndex < MCHAT_ITEMS.length - 1) {
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300)
    }
  }

  const handleSubmit = () => {
    if (!allAnswered) return

    const mchatAnswers: MChatAnswer[] = MCHAT_ITEMS.map(item => ({
      itemId: item.id,
      response: answers[item.id]!,
    }))

    const result = scoreMChat(mchatAnswers)

    const riskMap: Record<string, string> = {
      low: 'Low Risk',
      medium: 'Medium Risk',
      high: 'High Risk',
    }

    const chips: string[] = []
    if (result.risk === 'high') {
      chips.push('asd_high_risk', 'developmental_concern')
    } else if (result.risk === 'medium') {
      chips.push('asd_medium_risk', 'developmental_concern')
    }
    // Add domain-specific chips
    for (const [domain, scores] of Object.entries(result.domainScores)) {
      if (scores.failed > scores.total / 2) {
        chips.push(`mchat_${domain}_concern`)
      }
    }

    const aiResult: AIResult = {
      classification: riskMap[result.risk] || 'Unknown',
      confidence: 0.9,
      summary: `[M-CHAT-R] Score: ${result.totalScore}/20 (${result.risk} risk). ` +
        `Critical items failed: ${result.criticalFailedItems.length}. ` +
        `${result.recommendation}`,
      suggestedChips: chips,
    }

    setSubmitted(true)
    onResult(aiResult)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>M-CHAT-R/F Screening</Text>
      <Text style={styles.subtitle}>
        Answer each question about your child's behavior ({answeredCount}/{MCHAT_ITEMS.length})
      </Text>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, {
          width: `${Math.round((answeredCount / MCHAT_ITEMS.length) * 100)}%`,
          backgroundColor: accentColor,
        }]} />
      </View>

      {/* Current question */}
      {!submitted && (
        <View style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionNumber}>
              Q{currentItem.id}/{MCHAT_ITEMS.length}
            </Text>
            {currentItem.critical && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalText}>Critical</Text>
              </View>
            )}
            <Text style={[styles.domainBadge, { backgroundColor: accentColor + '20', color: accentColor }]}>
              {currentItem.domain}
            </Text>
          </View>

          <Text style={styles.questionText}>{currentItem.text}</Text>

          <View style={styles.answerRow}>
            <TouchableOpacity
              style={[
                styles.answerButton,
                answers[currentItem.id] === true && styles.answerSelected,
                answers[currentItem.id] === true && { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
              ]}
              onPress={() => setAnswer(currentItem.id, true)}
            >
              <Text style={[
                styles.answerText,
                answers[currentItem.id] === true && { color: '#15803d' },
              ]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.answerButton,
                answers[currentItem.id] === false && styles.answerSelected,
                answers[currentItem.id] === false && { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
              ]}
              onPress={() => setAnswer(currentItem.id, false)}
            >
              <Text style={[
                styles.answerText,
                answers[currentItem.id] === false && { color: '#dc2626' },
              ]}>No</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation dots */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navButton, currentIndex === 0 && styles.navDisabled]}
              onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <Text style={styles.navText}>Previous</Text>
            </TouchableOpacity>
            <Text style={styles.navCounter}>{currentIndex + 1} / {MCHAT_ITEMS.length}</Text>
            <TouchableOpacity
              style={[styles.navButton, currentIndex === MCHAT_ITEMS.length - 1 && styles.navDisabled]}
              onPress={() => setCurrentIndex(prev => Math.min(MCHAT_ITEMS.length - 1, prev + 1))}
              disabled={currentIndex === MCHAT_ITEMS.length - 1}
            >
              <Text style={styles.navText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Submit */}
      {allAnswered && !submitted && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: accentColor }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>Score M-CHAT</Text>
        </TouchableOpacity>
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
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  questionNumber: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
  },
  criticalBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  criticalText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: '#dc2626',
  },
  domainBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    fontSize: 11,
    fontWeight: fontWeight.medium,
    overflow: 'hidden',
  },
  questionText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
    lineHeight: 22,
  },
  answerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  answerButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  answerSelected: {
    borderWidth: 2,
  },
  answerText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  navButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  navDisabled: {
    opacity: 0.3,
  },
  navText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  navCounter: {
    fontSize: fontSize.sm,
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
})
