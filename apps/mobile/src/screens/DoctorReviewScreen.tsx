// Doctor review screen — review an observation, add decision + findings
// Decisions: approve, refer, follow_up, discharge, retake

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow, getColorHex } from '../theme'
import { useAuth } from '../lib/AuthContext'
import { apiCall } from '../lib/api'
import { getModuleName, getModuleConfig } from '../lib/modules'
import { buildClinicalPrompt, queryLLM, DEFAULT_LLM_CONFIG } from '../lib/ai/llm-gateway'
import type { Observation } from '../lib/types'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

type ParamList = {
  DoctorReview: { observation: Observation }
}

interface Props {
  navigation: NativeStackNavigationProp<ParamList, 'DoctorReview'>
  route: RouteProp<ParamList, 'DoctorReview'>
}

type Decision = 'approve' | 'refer' | 'follow_up' | 'discharge' | 'retake'
type QualityRating = 'good' | 'fair' | 'poor'

const DECISIONS: { value: Decision; label: string; color: string; icon: string }[] = [
  { value: 'approve', label: 'Approve', color: '#16a34a', icon: '\u{2705}' },
  { value: 'refer', label: 'Refer', color: '#dc2626', icon: '\u{1F3E5}' },
  { value: 'follow_up', label: 'Follow Up', color: '#2563eb', icon: '\u{1F4CB}' },
  { value: 'discharge', label: 'Discharge', color: '#64748b', icon: '\u{1F44D}' },
  { value: 'retake', label: 'Retake', color: '#d97706', icon: '\u{1F504}' },
]

const QUALITY_OPTIONS: { value: QualityRating; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
]

export function DoctorReviewScreen({ navigation, route }: Props) {
  const { observation } = route.params
  const { user, token } = useAuth()

  const [decision, setDecision] = useState<Decision | null>(null)
  const [qualityRating, setQualityRating] = useState<QualityRating | null>(null)
  const [notes, setNotes] = useState('')
  const [retakeReason, setRetakeReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const config = getModuleConfig(observation.moduleType)
  const bgColor = config ? getColorHex(config.color) : '#6b7280'

  const handleAskAi = useCallback(async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      // Extract data from captureMetadata which may contain extra fields
      const meta = observation.captureMetadata || {}
      const obsForPrompt = [{
        moduleType: observation.moduleType,
        moduleName: getModuleName(observation.moduleType),
        riskCategory: (meta.riskCategory as string) || 'unknown',
        summaryText: (meta.summaryText as string) || observation.notes || 'No summary available',
        nurseChips: (meta.selectedChips as string[]) || [],
        chipSeverities: {} as Record<string, string>,
        aiFindings: [],
        notes: observation.notes || '',
      }]
      const childName = (meta.childName as string) || 'Unknown'
      const messages = buildClinicalPrompt(childName, 'unknown', obsForPrompt)
      const responses = await queryLLM(DEFAULT_LLM_CONFIG, messages)
      const best = responses.find(r => !r.error) || responses[0]
      if (best.error) {
        setAiError(best.error)
      } else {
        setAiSummary(best.text)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setAiLoading(false)
    }
  }, [observation])

  const handleSubmitReview = async () => {
    if (!decision) {
      Alert.alert('Required', 'Please select a review decision.')
      return
    }

    if (decision === 'retake' && !retakeReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for retake.')
      return
    }

    setSaving(true)
    try {
      await apiCall('/api/reviews', {
        method: 'POST',
        token: token || undefined,
        body: JSON.stringify({
          observationId: observation.id,
          decision,
          qualityRating: qualityRating || undefined,
          notes: notes.trim() || undefined,
          retakeReason: decision === 'retake' ? retakeReason.trim() : undefined,
          clinicianId: user?.id,
          clinicianName: user?.name,
          timestamp: new Date().toISOString(),
        }),
      })

      Alert.alert(
        'Review Submitted',
        `${getModuleName(observation.moduleType)} observation has been ${decision === 'approve' ? 'approved' : decision === 'refer' ? 'referred' : decision}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit review'
      Alert.alert('Error', message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Observation Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.moduleIcon, { backgroundColor: bgColor }]}>
              <Text style={styles.moduleIconText}>
                {getModuleName(observation.moduleType).charAt(0)}
              </Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.moduleName}>
                {getModuleName(observation.moduleType)}
              </Text>
              <Text style={styles.moduleDesc}>
                {config?.description || observation.moduleType}
              </Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>
                {new Date(observation.timestamp).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Capture Type</Text>
              <Text style={styles.metaValue}>
                {config?.captureType || 'N/A'}
              </Text>
            </View>
            {observation.campaignCode && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Campaign</Text>
                <Text style={styles.metaValue}>{observation.campaignCode}</Text>
              </View>
            )}
          </View>

          {observation.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Nurse Notes</Text>
              <Text style={styles.notesText}>{observation.notes}</Text>
            </View>
          )}
        </View>

        {/* Ask AI */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.aiButton}
            onPress={handleAskAi}
            disabled={aiLoading}
            activeOpacity={0.7}
          >
            {aiLoading ? (
              <ActivityIndicator color="#7c3aed" size="small" />
            ) : (
              <Text style={styles.aiButtonIcon}>{'\u{1F9E0}'}</Text>
            )}
            <Text style={styles.aiButtonText}>
              {aiLoading ? 'Analyzing...' : aiSummary ? 'Re-analyze with AI' : 'Ask AI for Clinical Summary'}
            </Text>
          </TouchableOpacity>

          {aiSummary && (
            <View style={styles.aiResult}>
              <Text style={styles.aiResultTitle}>AI Clinical Summary</Text>
              <Text style={styles.aiResultText}>{aiSummary}</Text>
            </View>
          )}

          {aiError && (
            <View style={styles.aiError}>
              <Text style={styles.aiErrorText}>{aiError}</Text>
              <Text style={styles.aiErrorHint}>
                Ensure Ollama is running or configure cloud AI in settings.
              </Text>
            </View>
          )}
        </View>

        {/* Decision Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Review Decision *</Text>
          <View style={styles.decisionGrid}>
            {DECISIONS.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[
                  styles.decisionButton,
                  decision === d.value && {
                    borderColor: d.color,
                    borderWidth: 2,
                    backgroundColor: d.color + '10',
                  },
                ]}
                onPress={() => setDecision(d.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.decisionIcon}>{d.icon}</Text>
                <Text
                  style={[
                    styles.decisionLabel,
                    decision === d.value && { color: d.color, fontWeight: fontWeight.bold },
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Retake Reason (if retake selected) */}
        {decision === 'retake' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Retake Reason *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Why does this need to be retaken?"
              placeholderTextColor={colors.textMuted}
              value={retakeReason}
              onChangeText={setRetakeReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Quality Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quality Rating</Text>
          <View style={styles.qualityRow}>
            {QUALITY_OPTIONS.map((q) => (
              <TouchableOpacity
                key={q.value}
                style={[
                  styles.qualityButton,
                  qualityRating === q.value && styles.qualityButtonActive,
                ]}
                onPress={() => setQualityRating(q.value)}
              >
                <Text
                  style={[
                    styles.qualityText,
                    qualityRating === q.value && styles.qualityTextActive,
                  ]}
                >
                  {q.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Review Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Review Notes</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Add clinical notes, findings, or recommendations..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            !decision && styles.submitButtonDisabled,
            saving && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitReview}
          disabled={!decision || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Review</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  // Info card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  moduleIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  moduleIconText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  infoContent: {
    flex: 1,
  },
  moduleName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  moduleDesc: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaItem: {
    flex: 1,
    minWidth: '30%',
  },
  metaLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  notesBox: {
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 22,
  },
  // Sections
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  // Decision grid
  decisionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  decisionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    minWidth: '30%',
    flex: 1,
    ...shadow.sm,
  },
  decisionIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  decisionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  // Quality
  qualityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  qualityButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  qualityButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  qualityText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  qualityTextActive: {
    color: colors.primary,
  },
  // Text input
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
    minHeight: 100,
    lineHeight: 22,
  },
  // Submit
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    marginTop: spacing.sm,
    ...shadow.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  // AI styles
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  aiButtonIcon: {
    fontSize: 20,
  },
  aiButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: '#7c3aed',
  },
  aiResult: {
    marginTop: spacing.sm,
    backgroundColor: '#faf5ff',
    borderWidth: 2,
    borderColor: '#c4b5fd',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  aiResultTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#6d28d9',
    marginBottom: spacing.xs,
  },
  aiResultText: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  aiError: {
    marginTop: spacing.sm,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  aiErrorText: {
    fontSize: fontSize.sm,
    color: '#b45309',
  },
  aiErrorHint: {
    fontSize: fontSize.xs,
    color: '#d97706',
    marginTop: 4,
  },
})
