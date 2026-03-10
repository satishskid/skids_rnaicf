// AI Result Card — shows classification, Z-score visualization, percentile, confidence
// Used in ModuleScreen after local AI analysis of value-type modules

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import type { AIResult } from '../lib/ai-engine'
import type { ModuleType } from '../lib/types'

interface AIResultCardProps {
  result: AIResult
  moduleType: ModuleType
  childAge?: string
}

function getResultColor(classification?: string): { border: string; bg: string; text: string } {
  if (!classification) return { border: colors.border, bg: '#f8fafc', text: colors.text }
  if (classification === 'Normal') return { border: '#16a34a', bg: '#dcfce7', text: '#166534' }
  if (classification.includes('Severe')) return { border: '#dc2626', bg: '#fef2f2', text: '#991b1b' }
  return { border: '#d97706', bg: '#fffbeb', text: '#92400e' }
}

function zScoreToPercent(z: number | undefined): number {
  if (z === undefined) return 50
  return Math.max(2, Math.min(98, ((z + 3) / 6) * 100))
}

export function AIResultCard({ result, moduleType, childAge }: AIResultCardProps) {
  const color = getResultColor(result.classification)
  const hasZScore = result.zScore !== undefined
  const isNormal = result.classification === 'Normal'

  // Pulse animation for non-Normal results
  const pulseAnim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!isNormal) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      )
      pulse.start()
      return () => pulse.stop()
    }
    pulseAnim.setValue(1)
  }, [isNormal])

  return (
    <Animated.View style={[
      styles.card,
      { borderColor: color.border },
      !isNormal && { transform: [{ scale: pulseAnim }], borderWidth: 3 },
    ]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: color.bg }]}>
          <Text style={[styles.badgeText, { color: color.text }]}>AI Analysis</Text>
        </View>
        <Text style={styles.confidence}>
          {Math.round(result.confidence * 100)}% confidence
        </Text>
      </View>

      {/* Classification */}
      <Text style={styles.classification}>{result.classification}</Text>
      <Text style={styles.summary}>{result.summary}</Text>

      {/* Z-Score visualization */}
      {hasZScore && (
        <View style={styles.zScoreSection}>
          <Text style={styles.zScoreLabel}>Growth Z-Score</Text>
          <View style={styles.zScoreBar}>
            <View style={[styles.zScoreZone, styles.zScoreRed, { flex: 1 }]} />
            <View style={[styles.zScoreZone, styles.zScoreYellow, { flex: 1 }]} />
            <View style={[styles.zScoreZone, styles.zScoreGreen, { flex: 4 }]} />
            <View style={[styles.zScoreZone, styles.zScoreYellow, { flex: 1 }]} />
            <View style={[styles.zScoreZone, styles.zScoreRed, { flex: 1 }]} />
          </View>
          <View style={[styles.zScoreMarker, { left: `${zScoreToPercent(result.zScore)}%` }]}>
            <View style={[styles.zScoreMarkerDot, { backgroundColor: color.border }]} />
          </View>
          <View style={styles.zScoreLabels}>
            <Text style={styles.zScoreTick}>-3</Text>
            <Text style={styles.zScoreTick}>-2</Text>
            <Text style={[styles.zScoreTick, { flex: 4, textAlign: 'center' }]}>0</Text>
            <Text style={styles.zScoreTick}>+2</Text>
            <Text style={styles.zScoreTick}>+3</Text>
          </View>
        </View>
      )}

      {/* Metrics */}
      {(result.zScore !== undefined || result.percentile !== undefined) && (
        <View style={styles.metrics}>
          {result.zScore !== undefined && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Z-Score</Text>
              <Text style={[styles.metricValue, { color: color.border }]}>{result.zScore}</Text>
            </View>
          )}
          {result.percentile !== undefined && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Percentile</Text>
              <Text style={[styles.metricValue, { color: color.border }]}>{result.percentile}%</Text>
            </View>
          )}
          {childAge && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Age</Text>
              <Text style={styles.metricValue}>{childAge}</Text>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confidence: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  classification: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 4,
  },
  summary: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  // Z-Score bar
  zScoreSection: {
    marginBottom: spacing.sm,
    position: 'relative',
  },
  zScoreLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  zScoreBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  zScoreZone: {
    height: 12,
  },
  zScoreRed: {
    backgroundColor: '#fecaca',
  },
  zScoreYellow: {
    backgroundColor: '#fef3c7',
  },
  zScoreGreen: {
    backgroundColor: '#bbf7d0',
  },
  zScoreMarker: {
    position: 'absolute',
    top: 18, // below label
    marginLeft: -8,
  },
  zScoreMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.white,
    ...shadow.md,
  },
  zScoreLabels: {
    flexDirection: 'row',
    marginTop: 12,
  },
  zScoreTick: {
    flex: 1,
    fontSize: fontSize.xs - 1,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Metrics
  metrics: {
    flexDirection: 'row',
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
})
