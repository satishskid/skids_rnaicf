// Quick Vitals — multi-entry screen for all value modules
// Nurses enter height, weight, SpO2, Hb, BP, MUAC on one form with inline AI

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import { useAuth } from '../lib/AuthContext'
import { apiCall } from '../lib/api'
import { useSyncEngine } from '../lib/sync-engine'
import { runLocalAI } from '../lib/ai-engine'
import type { AIResult } from '../lib/ai-engine'
import { calculateAgeInMonths, formatAge } from '../lib/types'
import { getNormalRange } from '../lib/normal-ranges'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// ── Types ────────────────────────────────────────

type RootStackParamList = {
  QuickVitals: {
    childId: string
    childDob: string
    childGender: 'male' | 'female'
    childName: string
    campaignCode: string
  }
  Module: {
    moduleType: string
    campaignCode?: string
    childId?: string
    childDob?: string
    childGender?: 'male' | 'female'
    childName?: string
  }
}

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'QuickVitals'>
  route: RouteProp<RootStackParamList, 'QuickVitals'>
}

// ── Vitals field config ──────────────────────────

interface VitalField {
  key: string
  moduleType: string
  label: string
  unit: string
  placeholder: string
  keyboardType: 'numeric' | 'default'
  minAge?: number  // months, show only if child >= this age
  maxAge?: number  // months, show only if child < this age
  color: string
  icon: string
}

const ANTHROPOMETRY_FIELDS: VitalField[] = [
  { key: 'height', moduleType: 'height', label: 'Height', unit: 'cm', placeholder: 'e.g. 110', keyboardType: 'numeric', color: '#2563eb', icon: '\u{1F4CF}' },
  { key: 'weight', moduleType: 'weight', label: 'Weight', unit: 'kg', placeholder: 'e.g. 18.5', keyboardType: 'numeric', color: '#16a34a', icon: '\u{2696}\u{FE0F}' },
  { key: 'muac', moduleType: 'muac', label: 'MUAC', unit: 'cm', placeholder: 'e.g. 13.5', keyboardType: 'numeric', maxAge: 60, color: '#d97706', icon: '\u{1F4CF}' },
]

const CLINICAL_FIELDS: VitalField[] = [
  { key: 'spo2', moduleType: 'spo2', label: 'SpO2', unit: '%', placeholder: 'e.g. 98', keyboardType: 'numeric', color: '#dc2626', icon: '\u{1FA78}' },
  { key: 'hemoglobin', moduleType: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', placeholder: 'e.g. 12.5', keyboardType: 'numeric', color: '#e11d48', icon: '\u{1FA78}' },
  { key: 'bp', moduleType: 'bp', label: 'Blood Pressure', unit: 'mmHg', placeholder: 'e.g. 110/70', keyboardType: 'default', minAge: 60, color: '#b91c1c', icon: '\u{2764}\u{FE0F}' },
]

// ── AI badge colors ──────────────────────────────

function getClassificationStyle(classification?: string): { bg: string; text: string; border: string } {
  if (!classification) return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' }
  const cl = classification.toLowerCase()
  if (cl.includes('normal')) return { bg: '#dcfce7', text: '#166534', border: '#16a34a' }
  if (cl.includes('severe') || cl.includes('sam')) return { bg: '#fef2f2', text: '#991b1b', border: '#dc2626' }
  return { bg: '#fffbeb', text: '#92400e', border: '#d97706' }
}

// ── Component ────────────────────────────────────

export function QuickVitalsScreen({ navigation, route }: Props) {
  const { childId, childDob, childGender, childName, campaignCode } = route.params
  const insets = useSafeAreaInsets()
  const { token } = useAuth()
  const { addObservation } = useSyncEngine(token)

  const ageMonths = useMemo(() => calculateAgeInMonths(childDob), [childDob])
  const ageDisplay = useMemo(() => formatAge(childDob), [childDob])

  // Values state: key -> string
  const [values, setValues] = useState<Record<string, string>>({})
  // AI results state: key -> AIResult | null
  const [aiResults, setAiResults] = useState<Record<string, AIResult | null>>({})
  const [isSaving, setIsSaving] = useState(false)

  // Debounce timers
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Filter fields by age
  const anthropometry = useMemo(
    () => ANTHROPOMETRY_FIELDS.filter(f => {
      if (f.minAge !== undefined && ageMonths < f.minAge) return false
      if (f.maxAge !== undefined && ageMonths >= f.maxAge) return false
      return true
    }),
    [ageMonths]
  )

  const clinical = useMemo(
    () => CLINICAL_FIELDS.filter(f => {
      if (f.minAge !== undefined && ageMonths < f.minAge) return false
      if (f.maxAge !== undefined && ageMonths >= f.maxAge) return false
      return true
    }),
    [ageMonths]
  )

  const allFields = useMemo(() => [...anthropometry, ...clinical], [anthropometry, clinical])

  // Run AI on value change with debounce
  const handleValueChange = useCallback((field: VitalField, text: string) => {
    setValues(prev => ({ ...prev, [field.key]: text }))

    // Clear existing timer
    if (timersRef.current[field.key]) {
      clearTimeout(timersRef.current[field.key])
    }

    if (!text.trim()) {
      setAiResults(prev => ({ ...prev, [field.key]: null }))
      return
    }

    timersRef.current[field.key] = setTimeout(() => {
      const result = runLocalAI(field.moduleType as any, text.trim(), {
        ageMonths,
        gender: childGender,
      })
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setAiResults(prev => ({ ...prev, [field.key]: result }))
    }, 400)
  }, [ageMonths, childGender])

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [])

  // Count filled and flagged
  const filledCount = useMemo(
    () => allFields.filter(f => values[f.key]?.trim()).length,
    [allFields, values]
  )

  const flaggedResults = useMemo(
    () => allFields
      .filter(f => {
        const r = aiResults[f.key]
        return r && r.classification && !r.classification.toLowerCase().includes('normal')
      })
      .map(f => ({ field: f, result: aiResults[f.key]! })),
    [allFields, aiResults]
  )

  const normalCount = useMemo(
    () => allFields.filter(f => {
      const r = aiResults[f.key]
      return r && r.classification?.toLowerCase().includes('normal')
    }).length,
    [allFields, aiResults]
  )

  // ── Save all vitals ────────────────────────────

  const handleSaveAll = async () => {
    const filledFields = allFields.filter(f => values[f.key]?.trim())
    if (filledFields.length === 0) {
      Alert.alert('No Data', 'Please enter at least one measurement.')
      return
    }

    setIsSaving(true)
    const timestamp = new Date().toISOString()
    let savedCount = 0

    try {
      for (const field of filledFields) {
        const rawValue = values[field.key].trim()
        const numValue = parseFloat(rawValue)
        const payload: Record<string, unknown> = {
          moduleType: field.moduleType,
          campaignCode,
          childId,
          value: field.moduleType === 'bp' ? rawValue : (isNaN(numValue) ? rawValue : numValue),
          timestamp,
          captureMetadata: {
            captureType: 'value',
            platform: Platform.OS,
            source: 'quick_vitals',
          },
        }

        // Attach AI analysis if available
        const ai = aiResults[field.key]
        if (ai) {
          payload.aiAnalysis = {
            classification: ai.classification,
            confidence: ai.confidence,
            summary: ai.summary,
            zScore: ai.zScore,
            percentile: ai.percentile,
            suggestedChips: ai.suggestedChips,
          }
        }

        try {
          await apiCall('/api/observations', {
            method: 'POST',
            token: token || undefined,
            body: JSON.stringify(payload),
          })
          savedCount++
        } catch {
          // Queue for offline sync
          await addObservation(payload)
          savedCount++
        }
      }

      Alert.alert(
        'Vitals Saved',
        `${savedCount} measurement${savedCount !== 1 ? 's' : ''} saved successfully.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      Alert.alert('Save Error', msg)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Render ────────────────────────────────────

  const renderField = (field: VitalField) => {
    const value = values[field.key] || ''
    const ai = aiResults[field.key]
    const style = getClassificationStyle(ai?.classification)

    return (
      <View key={field.key} style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View style={[styles.fieldIcon, { backgroundColor: field.color + '18' }]}>
            <Text style={styles.fieldIconText}>{field.icon}</Text>
          </View>
          <View style={styles.fieldLabelGroup}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <Text style={styles.fieldUnit}>{field.unit}</Text>
          </View>
          {ai && (
            <View style={[styles.aiBadge, { backgroundColor: style.bg, borderColor: style.border }]}>
              <Text style={[styles.aiBadgeText, { color: style.text }]}>
                {ai.classification}
              </Text>
            </View>
          )}
        </View>

        <TextInput
          style={styles.fieldInput}
          placeholder={field.placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={(text) => handleValueChange(field, text)}
          keyboardType={field.keyboardType}
          editable={!isSaving}
        />

        {/* Normal range hint */}
        {(() => {
          const rangeText = getNormalRange(field.moduleType, ageMonths, childGender)
          return rangeText ? (
            <View style={styles.normalRangeBar}>
              <Text style={styles.normalRangeText}>{rangeText}</Text>
            </View>
          ) : null
        })()}

        {ai && (
          <View style={styles.aiDetail}>
            <Text style={[styles.aiDetailText, { color: style.text }]}>{ai.summary}</Text>
            {ai.zScore !== undefined && (
              <Text style={styles.aiMetric}>Z-Score: {ai.zScore} | Percentile: {ai.percentile}%</Text>
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Child Info */}
        <View style={styles.childBar}>
          <View style={styles.childAvatar}>
            <Text style={styles.childAvatarText}>{childName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.childName}>{childName}</Text>
            <Text style={styles.childMeta}>{ageDisplay} {'\u00B7'} {childGender === 'male' ? 'Boy' : 'Girl'} {'\u00B7'} {ageMonths} months</Text>
          </View>
        </View>

        {/* AI Engine Status */}
        <View style={styles.aiEngineBar}>
          <View style={styles.aiDot} />
          <Text style={styles.aiEngineText}>AI Engine Active {'\u00B7'} WHO Growth Standards</Text>
        </View>

        {/* Anthropometry Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Anthropometry</Text>
          <Text style={styles.sectionHint}>Growth measurements</Text>
        </View>
        {anthropometry.map(renderField)}

        {/* Clinical Vitals Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Clinical Vitals</Text>
          <Text style={styles.sectionHint}>Lab & device readings</Text>
        </View>
        {clinical.map(renderField)}

        {/* AI Summary */}
        {filledCount > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>AI Summary</Text>
            {normalCount > 0 && (
              <View style={styles.summaryRow}>
                <View style={[styles.summaryDot, { backgroundColor: '#16a34a' }]} />
                <Text style={styles.summaryText}>{normalCount} normal finding{normalCount !== 1 ? 's' : ''}</Text>
              </View>
            )}
            {flaggedResults.map(({ field, result }) => (
              <View key={field.key} style={styles.summaryRow}>
                <View style={[styles.summaryDot, { backgroundColor: '#dc2626' }]} />
                <Text style={styles.summaryFlagged}>
                  {field.label}: {result.classification} {result.zScore !== undefined ? `(Z=${result.zScore})` : ''}
                </Text>
              </View>
            ))}
            {filledCount > 0 && flaggedResults.length === 0 && normalCount === 0 && (
              <Text style={styles.summaryPending}>Analyzing...</Text>
            )}
          </View>
        )}

        {/* Detailed Entry Link */}
        <TouchableOpacity
          style={styles.detailedLink}
          onPress={() => {
            const firstModule = allFields[0]
            if (firstModule) {
              navigation.navigate('Module', {
                moduleType: firstModule.moduleType,
                campaignCode,
                childId,
                childDob,
                childGender,
                childName,
              })
            }
          }}
        >
          <Text style={styles.detailedLinkText}>
            Need to add annotations? Use Detailed Entry {'\u2192'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Fixed Save Button */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={[styles.saveButton, (isSaving || filledCount === 0) && styles.saveButtonDisabled]}
          onPress={handleSaveAll}
          disabled={isSaving || filledCount === 0}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              Save All Vitals ({filledCount} measurement{filledCount !== 1 ? 's' : ''})
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Styles ──────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  // Child bar
  childBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvatarText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  childName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  childMeta: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  // AI engine bar
  aiEngineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  aiEngineText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#166534',
  },
  // Sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  // Field card
  fieldCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldIconText: {
    fontSize: 18,
  },
  fieldLabelGroup: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  fieldUnit: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  aiBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  aiBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  fieldInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    minHeight: 48,
  },
  normalRangeBar: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  normalRangeText: {
    fontSize: fontSize.xs,
    color: '#1e40af',
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  aiDetail: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  aiDetailText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  aiMetric: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Summary card
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  summaryTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 6,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: fontSize.sm,
    color: '#166534',
    fontWeight: fontWeight.medium,
  },
  summaryFlagged: {
    fontSize: fontSize.sm,
    color: '#991b1b',
    fontWeight: fontWeight.semibold,
  },
  summaryPending: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  // Detailed entry link
  detailedLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  detailedLinkText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  // Save bar
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    ...shadow.lg,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...shadow.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
})
