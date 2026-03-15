// Batch Summary Screen — shown when batch screening is complete
// Displays child info, stats, findings cards with positive highlights

import React, { useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import { getModuleConfig } from '../lib/modules'
import type { ModuleType } from '../lib/types'
import type { BatchResult } from './ModuleScreen'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

type RootStackParamList = {
  BatchSummary: {
    campaignCode: string
    childId: string
    childName: string
    completedModules: string // comma-separated moduleTypes
    batchResults?: string // JSON string of BatchResult[]
  }
}

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BatchSummary'>
  route: RouteProp<RootStackParamList, 'BatchSummary'>
}

// Emoji map for module icons
const MODULE_EMOJI: Record<string, string> = {
  height: '\u{1F4CF}', weight: '\u{2696}\u{FE0F}', vision: '\u{1F441}',
  dental: '\u{1F9B7}', skin: '\u{1F50D}', ear: '\u{1F442}',
  hearing: '\u{1F3A7}', eyes_external: '\u{1F440}', hair: '\u{1F9D1}',
  nails: '\u{270B}', nose: '\u{1F443}', throat: '\u{1F444}',
  neck: '\u{1F9E3}', respiratory: '\u{1FA7A}', abdomen: '\u{1F9CD}',
  posture: '\u{1F9B4}', motor: '\u{1F3C3}', lymph: '\u{1F52C}',
  neurodevelopment: '\u{1F9E0}', immunization: '\u{1F6E1}',
  cardiac: '\u{2764}\u{FE0F}', pulmonary: '\u{1FA7A}',
  spo2: '\u{1FA78}', hemoglobin: '\u{1FA78}', bp: '\u{2764}\u{FE0F}',
  muac: '\u{1F4CF}', vitals: '\u{2764}\u{FE0F}',
  general_appearance: '\u{1F9D1}\u{200D}\u{2695}\u{FE0F}',
  nutrition_intake: '\u{1F34E}', intervention: '\u{1F48A}',
}

export function BatchSummaryScreen({ navigation, route }: Props) {
  const { childName, completedModules: modulesStr, batchResults: batchResultsStr } = route.params
  const moduleTypes = modulesStr.split(',').filter(Boolean) as ModuleType[]
  const batchResults: BatchResult[] = useMemo(() => {
    try {
      return batchResultsStr ? JSON.parse(batchResultsStr) : []
    } catch {
      return []
    }
  }, [batchResultsStr])

  // Compute stats
  const normalResults = batchResults.filter(r => r.risk === 'normal')
  const reviewResults = batchResults.filter(r => r.risk === 'review')
  const attentionResults = batchResults.filter(r => r.risk === 'attention')
  const findingResults = [...attentionResults, ...reviewResults] // attention first
  const hasFindings = findingResults.length > 0

  // Modules without results (skipped or no results data)
  const resultModuleTypes = new Set(batchResults.map(r => r.moduleType))
  const unreportedModules = moduleTypes.filter(mt => !resultModuleTypes.has(mt))

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <Text style={styles.successEmoji}>{'\u2705'}</Text>
          <Text style={styles.successTitle}>Screening Complete</Text>
          <Text style={styles.successSubtitle}>{childName}</Text>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statNormal]}>
            <Text style={[styles.statNumber, { color: '#16a34a' }]}>{normalResults.length}</Text>
            <Text style={styles.statLabel}>Normal</Text>
            <View style={[styles.statDot, { backgroundColor: '#16a34a' }]} />
          </View>
          <View style={[styles.statCard, styles.statReview]}>
            <Text style={[styles.statNumber, { color: '#d97706' }]}>{reviewResults.length}</Text>
            <Text style={styles.statLabel}>Review</Text>
            <View style={[styles.statDot, { backgroundColor: '#d97706' }]} />
          </View>
          <View style={[styles.statCard, styles.statAttention]}>
            <Text style={[styles.statNumber, { color: '#dc2626' }]}>{attentionResults.length}</Text>
            <Text style={styles.statLabel}>Attention</Text>
            <View style={[styles.statDot, { backgroundColor: '#dc2626' }]} />
          </View>
        </View>

        {/* Findings Cards */}
        {hasFindings && (
          <View style={styles.findingsSection}>
            <Text style={styles.findingsSectionTitle}>
              {'\u26A0\uFE0F'} Findings Requiring Attention
            </Text>
            {findingResults.map((result, i) => {
              const config = getModuleConfig(result.moduleType as ModuleType)
              const isAttention = result.risk === 'attention'
              return (
                <View
                  key={i}
                  style={[
                    styles.findingCard,
                    isAttention ? styles.findingCardAttention : styles.findingCardReview,
                  ]}
                >
                  <View style={styles.findingCardHeader}>
                    <View style={styles.findingCardTitle}>
                      <Text style={styles.findingEmoji}>
                        {MODULE_EMOJI[result.moduleType] || '\u{1F3E5}'}
                      </Text>
                      <Text style={styles.findingModuleName}>
                        {config?.name || result.moduleType}
                      </Text>
                    </View>
                    <View style={[
                      styles.riskBadge,
                      isAttention ? styles.riskBadgeAttention : styles.riskBadgeReview,
                    ]}>
                      <Text style={[
                        styles.riskBadgeText,
                        isAttention ? styles.riskBadgeTextAttention : styles.riskBadgeTextReview,
                      ]}>
                        {result.maxSeverity
                          ? result.maxSeverity.charAt(0).toUpperCase() + result.maxSeverity.slice(1)
                          : isAttention ? 'Attention' : 'Review'}
                      </Text>
                    </View>
                  </View>
                  {result.findings.length > 0 && (
                    <Text style={styles.findingChips}>
                      {result.findings.join(', ')}
                    </Text>
                  )}
                  {result.value && (
                    <Text style={styles.findingValue}>Value: {result.value}</Text>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* Normal Results */}
        {normalResults.length > 0 && (
          <View style={styles.normalSection}>
            <Text style={styles.normalSectionTitle}>
              {'\u2705'} Normal Results ({normalResults.length})
            </Text>
            <Text style={styles.normalModulesList}>
              {normalResults.map(r => {
                const config = getModuleConfig(r.moduleType as ModuleType)
                return config?.name || r.moduleType
              }).join(' \u2022 ')}
            </Text>
          </View>
        )}

        {/* Unreported modules (legacy — no batchResults data) */}
        {unreportedModules.length > 0 && batchResults.length > 0 && (
          <View style={styles.normalSection}>
            <Text style={styles.normalSectionTitle}>
              Skipped ({unreportedModules.length})
            </Text>
            <Text style={styles.normalModulesList}>
              {unreportedModules.map(mt => {
                const config = getModuleConfig(mt)
                return config?.name || mt
              }).join(' \u2022 ')}
            </Text>
          </View>
        )}

        {/* Legacy view — no batch results data */}
        {batchResults.length === 0 && (
          <View style={styles.legacyModuleList}>
            <Text style={styles.legacyModuleListTitle}>Completed Modules</Text>
            {moduleTypes.map((mt, i) => {
              const config = getModuleConfig(mt)
              return (
                <View key={i} style={styles.legacyModuleRow}>
                  <Text style={styles.legacyModuleRowCheck}>{'\u2705'}</Text>
                  <Text style={styles.legacyModuleRowName}>{config?.name || mt}</Text>
                  <Text style={styles.legacyModuleRowType}>{config?.captureType || ''}</Text>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Done Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Done \u2014 Next Child</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  // Success header
  successHeader: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  successTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  // Stats bar
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    ...shadow.sm,
  },
  statNormal: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  statReview: {
    borderColor: '#fde68a',
    backgroundColor: '#fefce8',
  },
  statAttention: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: fontWeight.black,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: spacing.xs,
  },
  // Findings section
  findingsSection: {
    marginBottom: spacing.lg,
  },
  findingsSectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  findingCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  findingCardAttention: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  findingCardReview: {
    backgroundColor: '#fefce8',
    borderColor: '#fde68a',
  },
  findingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  findingCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  findingEmoji: {
    fontSize: 20,
  },
  findingModuleName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  riskBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  riskBadgeAttention: {
    backgroundColor: '#fecaca',
  },
  riskBadgeReview: {
    backgroundColor: '#fde68a',
  },
  riskBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  riskBadgeTextAttention: {
    color: '#991b1b',
  },
  riskBadgeTextReview: {
    color: '#92400e',
  },
  findingChips: {
    fontSize: fontSize.sm,
    color: '#374151',
    lineHeight: 20,
  },
  findingValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Normal results section
  normalSection: {
    backgroundColor: '#f0fdf4',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: spacing.md,
  },
  normalSectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: '#166534',
    marginBottom: spacing.sm,
  },
  normalModulesList: {
    fontSize: fontSize.sm,
    color: '#374151',
    lineHeight: 22,
  },
  // Legacy module list (backward compat)
  legacyModuleList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  legacyModuleListTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  legacyModuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legacyModuleRowCheck: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  legacyModuleRowName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  legacyModuleRowType: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // Footer
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  doneButton: {
    backgroundColor: '#16a34a',
    borderRadius: borderRadius.md,
    paddingVertical: 18,
    alignItems: 'center',
    ...shadow.md,
  },
  doneButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
})
