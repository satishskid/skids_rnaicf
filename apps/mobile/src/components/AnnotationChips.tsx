// Annotation chips — nurse selects clinical findings per screening module
// Each chip represents a clinical observation with optional severity grading

import React, { useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme'

interface ChipDef {
  id: string
  label: string
  category: string
  hasSeverity?: boolean
  icdCode?: string
}

interface AnnotationChipsProps {
  chips: ChipDef[]
  selectedChips: string[]
  chipSeverities: Record<string, string>
  onToggleChip: (chipId: string) => void
  onSetSeverity: (chipId: string, severity: string) => void
  aiSuggestedChips?: string[]
}

const SEVERITY_OPTIONS = [
  { value: 'normal', label: 'Normal', color: '#16a34a' },
  { value: 'mild', label: 'Mild', color: '#eab308' },
  { value: 'moderate', label: 'Moderate', color: '#ea580c' },
  { value: 'severe', label: 'Severe', color: '#dc2626' },
]

export function AnnotationChips({
  chips,
  selectedChips,
  chipSeverities,
  onToggleChip,
  onSetSeverity,
  aiSuggestedChips = [],
}: AnnotationChipsProps) {
  const selectedSet = useMemo(() => new Set(selectedChips), [selectedChips])
  const aiSet = useMemo(() => new Set(aiSuggestedChips), [aiSuggestedChips])

  const grouped = useMemo(() => {
    const groups: Record<string, ChipDef[]> = {}
    for (const chip of chips) {
      const cat = chip.category || 'General'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(chip)
    }
    return Object.entries(groups)
  }, [chips])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clinical Findings</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{selectedChips.length} selected</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} nestedScrollEnabled>
        {grouped.map(([category, categoryChips]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryLabel}>{category}</Text>
            <View style={styles.chipsRow}>
              {categoryChips.map((chip) => {
                const isSelected = selectedSet.has(chip.id)
                const isAiSuggested = aiSet.has(chip.id)
                return (
                  <View key={chip.id} style={styles.chipWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        isSelected && styles.chipSelected,
                        isAiSuggested && !isSelected && styles.chipAiSuggested,
                      ]}
                      onPress={() => onToggleChip(chip.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                        numberOfLines={2}
                      >
                        {chip.label}
                      </Text>
                      {isAiSuggested && (
                        <Text style={styles.aiIndicator}>AI</Text>
                      )}
                    </TouchableOpacity>

                    {isSelected && chip.hasSeverity && (
                      <View style={styles.severityRow}>
                        {SEVERITY_OPTIONS.map((sev) => {
                          const active = chipSeverities[chip.id] === sev.value
                          return (
                            <TouchableOpacity
                              key={sev.value}
                              style={[
                                styles.severityBtn,
                                { borderColor: sev.color },
                                active && { backgroundColor: sev.color },
                              ]}
                              onPress={() => onSetSeverity(chip.id, sev.value)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.severityText,
                                  { color: active ? colors.white : sev.color },
                                ]}
                              >
                                {sev.label}
                              </Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  scrollArea: {
    maxHeight: 400,
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipWrapper: {
    marginBottom: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipAiSuggested: {
    borderColor: '#d97706',
    backgroundColor: '#fffbeb',
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
  aiIndicator: {
    fontSize: fontSize.xs - 1,
    fontWeight: fontWeight.bold,
    color: '#d97706',
    marginLeft: spacing.xs,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
  },
  severityBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
  },
  severityText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
})
