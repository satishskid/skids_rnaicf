// BehavioralForm — Behavioral observation checklist for autism screening
// Shows BEHAVIORAL_TASKS filtered by age, nurse records observations

import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme'
import {
  BEHAVIORAL_TASKS, getBehavioralTasksForAge, generateBehavioralAssessment,
  type BehavioralTask,
} from '../lib/ai/index'
import type { AIResult } from '../lib/ai-engine'

interface Props {
  onResult: (aiResult: AIResult) => void
  childAge?: number // age in months
  accentColor?: string
}

type ObservedLevel = 'not_observed' | 'absent' | 'emerging' | 'present'

const OBS_OPTIONS: { level: ObservedLevel; label: string; score: number; color: string }[] = [
  { level: 'not_observed', label: 'N/A', score: -1, color: '#94a3b8' },
  { level: 'absent', label: 'Absent', score: 0, color: '#ef4444' },
  { level: 'emerging', label: 'Emerging', score: 0.5, color: '#f59e0b' },
  { level: 'present', label: 'Present', score: 1, color: '#22c55e' },
]

export function BehavioralForm({ onResult, childAge, accentColor = '#a855f7' }: Props) {
  const tasks = childAge ? getBehavioralTasksForAge(childAge) : BEHAVIORAL_TASKS
  const [observations, setObservations] = useState<Record<string, ObservedLevel>>(
    Object.fromEntries(tasks.map(t => [t.id, 'not_observed']))
  )
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>(
    Object.fromEntries(tasks.map(t => [t.id, '']))
  )
  const [submitted, setSubmitted] = useState(false)

  const observedCount = Object.values(observations).filter(o => o !== 'not_observed').length

  const setObs = (taskId: string, level: ObservedLevel) => {
    setObservations(prev => ({ ...prev, [taskId]: level }))
  }

  const handleSubmit = () => {
    // Build BehavioralTaskScore[] from nurse observations
    const taskScores = tasks
      .filter(t => observations[t.id] !== 'not_observed')
      .map(t => {
        const scoreVal = OBS_OPTIONS.find(o => o.level === observations[t.id])?.score ?? 0
        return {
          taskId: t.id,
          score: scoreVal,
          concern: scoreVal < 0.5,
          details: taskNotes[t.id]?.trim() || `Observed: ${observations[t.id]}`,
          confidence: 0.8,
        }
      })

    if (taskScores.length === 0) return

    const result = generateBehavioralAssessment(taskScores, childAge || 36)

    const chips: string[] = []
    if (result.compositeScore < 0.3) {
      chips.push('behavioral_concern', 'asd_risk')
    } else if (result.compositeScore < 0.6) {
      chips.push('behavioral_concern')
    }
    if (result.socialCommunicationScore < 0.4) {
      chips.push('social_interaction_concern')
    }
    if (result.restrictedBehaviorScore < 0.4) {
      chips.push('restricted_behavior_concern')
    }

    const classification = result.combinedRisk === 'low' ? 'Age Appropriate'
      : result.combinedRisk === 'medium' ? 'Mild Concern'
      : 'Behavioral Concern'

    const aiResult: AIResult = {
      classification,
      confidence: 0.85,
      summary: `[Behavioral] Composite: ${Math.round(result.compositeScore * 100)}%. ` +
        `Social/Communication: ${Math.round(result.socialCommunicationScore * 100)}%. ` +
        `Restricted behaviors: ${Math.round(result.restrictedBehaviorScore * 100)}%. ` +
        `${taskScores.length} behaviors observed. ` +
        (result.recommendations.length > 0 ? result.recommendations[0] : ''),
      suggestedChips: chips,
    }

    setSubmitted(true)
    onResult(aiResult)
  }

  if (tasks.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Behavioral Assessment</Text>
        <Text style={styles.subtitle}>No age-appropriate behavioral tasks available.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Behavioral Assessment</Text>
      <Text style={styles.subtitle}>
        Observe each behavior and rate ({observedCount}/{tasks.length} observed)
      </Text>

      {tasks.map(task => (
        <View key={task.id} style={[styles.taskCard, submitted && styles.taskCardDisabled]}>
          <Text style={styles.taskName}>{task.name}</Text>
          <Text style={styles.taskDescription}>{task.description}</Text>

          {task.instructions && task.instructions.length > 0 && (
            <Text style={styles.instructions}>{task.instructions[0]}</Text>
          )}

          {/* Observation level buttons */}
          <View style={styles.obsRow}>
            {OBS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.level}
                style={[
                  styles.obsButton,
                  observations[task.id] === opt.level && {
                    backgroundColor: opt.color + '20',
                    borderColor: opt.color,
                  },
                ]}
                onPress={() => setObs(task.id, opt.level)}
                disabled={submitted}
              >
                <Text style={[
                  styles.obsText,
                  observations[task.id] === opt.level && { color: opt.color, fontWeight: fontWeight.bold },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional note for this task */}
          {observations[task.id] !== 'not_observed' && !submitted && (
            <TextInput
              style={styles.noteInput}
              placeholder="Brief note (optional)"
              placeholderTextColor={colors.textMuted}
              value={taskNotes[task.id]}
              onChangeText={v => setTaskNotes(prev => ({ ...prev, [task.id]: v }))}
            />
          )}
        </View>
      ))}

      {observedCount > 0 && !submitted && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: accentColor }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>Analyze Behavior</Text>
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
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  taskCardDisabled: {
    opacity: 0.7,
  },
  taskName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  taskDescription: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  instructions: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  obsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  obsButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  obsText: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.text,
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
