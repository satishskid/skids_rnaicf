// MotorTaskForm — Age-appropriate motor assessment checklist
// Shows MOTOR_TASKS filtered by age, nurse scores each task, runs generateMotorAssessment

import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme'
import {
  MOTOR_TASKS, getMotorTasksForAge, generateMotorAssessment,
  type MotorTask, type MotorTaskScore,
} from '../lib/ai/index'
import type { AIResult } from '../lib/ai-engine'

interface Props {
  onResult: (aiResult: AIResult) => void
  childAge?: number // age in months
  accentColor?: string
}

type ScoreLevel = 'not_attempted' | 'unable' | 'partial' | 'complete'

const SCORE_OPTIONS: { level: ScoreLevel; label: string; value: number; color: string }[] = [
  { level: 'not_attempted', label: 'N/A', value: -1, color: '#94a3b8' },
  { level: 'unable', label: 'Unable', value: 0, color: '#ef4444' },
  { level: 'partial', label: 'Partial', value: 0.5, color: '#f59e0b' },
  { level: 'complete', label: 'Complete', value: 1, color: '#22c55e' },
]

export function MotorTaskForm({ onResult, childAge, accentColor = '#22c55e' }: Props) {
  const tasks = childAge ? getMotorTasksForAge(childAge) : MOTOR_TASKS
  const [scores, setScores] = useState<Record<string, ScoreLevel>>(
    Object.fromEntries(tasks.map(t => [t.id, 'not_attempted']))
  )
  const [submitted, setSubmitted] = useState(false)

  const scoredCount = Object.values(scores).filter(s => s !== 'not_attempted').length

  const setTaskScore = (taskId: string, level: ScoreLevel) => {
    setScores(prev => ({ ...prev, [taskId]: level }))
  }

  const handleSubmit = () => {
    // Build TaskScore array for scored tasks
    const taskScores: MotorTaskScore[] = tasks
      .filter(t => scores[t.id] !== 'not_attempted')
      .map(t => {
        const scoreVal = SCORE_OPTIONS.find(o => o.level === scores[t.id])?.value ?? 0
        return {
          taskId: t.id,
          symmetry: scoreVal,
          stability: scoreVal,
          smoothness: scoreVal,
          rhythm: scoreVal,
          completion: scoreVal,
          overall: scoreVal,
          confidence: 0.8,
          details: `Nurse scored: ${scores[t.id]}`,
        }
      })

    if (taskScores.length === 0) return

    const result = generateMotorAssessment(taskScores, childAge || 48)

    const chips: string[] = []
    if (result.riskCategory === 'significant_delay') {
      chips.push('motor_delay', 'gross_motor_concern')
    } else if (result.riskCategory === 'moderate_delay') {
      chips.push('motor_delay')
    } else if (result.riskCategory === 'mild_delay') {
      chips.push('motor_concern')
    }

    const classificationMap: Record<string, string> = {
      age_appropriate: 'Normal',
      mild_delay: 'Mild Concern',
      moderate_delay: 'Motor Delay',
      significant_delay: 'Significant Motor Delay',
    }
    const classification = classificationMap[result.riskCategory] || 'Normal'

    const aiResult: AIResult = {
      classification,
      confidence: 0.85,
      summary: `[Motor] Composite: ${Math.round(result.compositeScore * 100)}%. ` +
        `Risk: ${result.riskCategory.replace(/_/g, ' ')}. ` +
        `${taskScores.length} tasks scored. ` +
        (result.findings.length > 0 ? result.findings[0] : '') +
        (result.recommendations.length > 0 ? ` ${result.recommendations[0]}` : ''),
      suggestedChips: chips,
    }

    setSubmitted(true)
    onResult(aiResult)
  }

  if (tasks.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Motor Assessment</Text>
        <Text style={styles.subtitle}>
          No age-appropriate motor tasks available for this child's age.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Motor Assessment</Text>
      <Text style={styles.subtitle}>
        Score each task based on the child's performance ({scoredCount}/{tasks.length} scored)
      </Text>

      {tasks.map(task => (
        <View key={task.id} style={[styles.taskCard, submitted && styles.taskCardDisabled]}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskName}>{task.name}</Text>
            <Text style={styles.taskDuration}>{task.durationSeconds}s</Text>
          </View>
          <Text style={styles.taskDescription}>{task.description}</Text>

          {/* Instructions */}
          {task.instructions.length > 0 && (
            <Text style={styles.taskInstructions}>
              {task.instructions[0]}
            </Text>
          )}

          {/* Score buttons */}
          <View style={styles.scoreRow}>
            {SCORE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.level}
                style={[
                  styles.scoreButton,
                  scores[task.id] === opt.level && {
                    backgroundColor: opt.color + '20',
                    borderColor: opt.color,
                  },
                ]}
                onPress={() => setTaskScore(task.id, opt.level)}
                disabled={submitted}
              >
                <Text style={[
                  styles.scoreText,
                  scores[task.id] === opt.level && { color: opt.color, fontWeight: fontWeight.bold },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {scoredCount > 0 && !submitted && (
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: accentColor }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitText}>Analyze Motor Skills</Text>
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
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  taskDuration: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  taskDescription: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  taskInstructions: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  scoreRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  scoreButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
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
