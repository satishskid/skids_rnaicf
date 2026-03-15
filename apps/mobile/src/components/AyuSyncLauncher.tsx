// AyuSyncLauncher — Launch AyuShare stethoscope and listen for results
// For cardiac and pulmonary auscultation modules

import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme'
import { launchAyuShare, type AyuShareLaunchOptions } from '../lib/ayusync-deeplink'
import { listenForAyuSynkResult, type AyuSynkWebhookReport } from '../lib/ayusync-listener'
import type { AIResult } from '../lib/ai-engine'

interface Props {
  onResult: (aiResult: AIResult) => void
  campaignCode: string
  childId: string
  childAge?: number
  childGender?: 'M' | 'F' | 'O'
  moduleType: 'cardiac' | 'pulmonary'
  token: string
  accentColor?: string
}

export function AyuSyncLauncher({
  onResult, campaignCode, childId, childAge, childGender,
  moduleType, token, accentColor = '#e11d48',
}: Props) {
  const [status, setStatus] = useState<'idle' | 'launching' | 'waiting' | 'received' | 'error'>('idle')
  const [report, setReport] = useState<AyuSynkWebhookReport | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [])

  const handleLaunch = async () => {
    try {
      setStatus('launching')

      const options: AyuShareLaunchOptions = {
        campaignCode,
        childId,
        childAge,
        childGender,
        mode: 0, // record & share
      }

      await launchAyuShare(options)
      setStatus('waiting')

      // Start polling for result
      cleanupRef.current = listenForAyuSynkResult(
        campaignCode,
        childId,
        token,
        (webhookReport) => {
          setReport(webhookReport)
          setStatus('received')

          // Parse AyuSync report into AIResult
          const chips: string[] = []
          let summary = `[AyuSync ${moduleType}] `

          if (webhookReport.reports && webhookReport.reports.length > 0) {
            // Parse all AyuSynk reports — each has heart_bpm, location, screening_results[]
            for (const ayuReport of webhookReport.reports) {
              // Heart rate from any report
              if (ayuReport.heart_bpm) {
                const bpm = parseInt(ayuReport.heart_bpm, 10)
                if (!isNaN(bpm)) summary += `HR: ${bpm} bpm. `
              }

              // Parse screening_results for detected conditions
              if (ayuReport.screening_results) {
                for (const sr of ayuReport.screening_results) {
                  if (sr.condition_detected === 'true') {
                    const condition = sr.condition.toLowerCase()
                    summary += `${sr.condition} detected (${Math.round(sr.confidence_score * 100)}%). `

                    // Map conditions to chips
                    if (condition.includes('murmur')) chips.push('heart_murmur')
                    else if (condition.includes('arrhythmia') || condition.includes('irregular')) chips.push('arrhythmia')
                    else if (condition.includes('wheeze')) chips.push('wheeze')
                    else if (condition.includes('crackle')) chips.push('crackles')
                    else if (condition.includes('diminish')) chips.push('diminished_breath_sounds')
                    else if (condition.includes('stridor')) chips.push('stridor')
                    else chips.push(`auscultation_${condition.replace(/\s+/g, '_')}`)
                  }
                }
              }
            }

            // If no conditions detected, report normal
            if (chips.length === 0) {
              summary += moduleType === 'cardiac' ? 'Heart sounds normal. ' : 'Lung sounds clear. '
            }
          } else {
            summary += 'Report received but no detailed findings available.'
          }

          const hasFindings = chips.length > 0
          const aiResult: AIResult = {
            classification: hasFindings ? 'Review Needed' : 'Normal',
            confidence: 0.9,
            summary,
            suggestedChips: chips,
          }

          onResult(aiResult)
        },
        { intervalMs: 5000, timeoutMs: 300000 }, // poll every 5s, timeout at 5min
      )
    } catch (err) {
      setStatus('error')
      Alert.alert(
        'AyuSync Error',
        'Could not launch AyuShare app. Make sure it is installed on this device.',
      )
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {moduleType === 'cardiac' ? 'Cardiac' : 'Pulmonary'} Auscultation
      </Text>
      <Text style={styles.subtitle}>
        Use AyuSync digital stethoscope for {moduleType === 'cardiac' ? 'heart' : 'lung'} sound recording
      </Text>

      {status === 'idle' && (
        <TouchableOpacity
          style={[styles.launchButton, { backgroundColor: accentColor }]}
          onPress={handleLaunch}
          activeOpacity={0.8}
        >
          <Text style={styles.launchEmoji}>{'\u{1FA7A}'}</Text>
          <Text style={styles.launchText}>Use AyuSync Stethoscope</Text>
          <Text style={styles.launchHint}>Opens AyuShare app for recording</Text>
        </TouchableOpacity>
      )}

      {status === 'launching' && (
        <View style={styles.statusCard}>
          <ActivityIndicator color={accentColor} />
          <Text style={styles.statusText}>Launching AyuShare...</Text>
        </View>
      )}

      {status === 'waiting' && (
        <View style={styles.statusCard}>
          <ActivityIndicator color={accentColor} />
          <Text style={styles.statusText}>
            Waiting for AyuSync recording...
          </Text>
          <Text style={styles.statusHint}>
            Record {moduleType === 'cardiac' ? 'heart sounds at 4 auscultation points' : 'lung sounds at 6 auscultation points'} in AyuShare, then return here.
          </Text>
        </View>
      )}

      {status === 'received' && (
        <View style={[styles.statusCard, { borderColor: '#22c55e' }]}>
          <Text style={styles.receivedEmoji}>{'\u2705'}</Text>
          <Text style={styles.statusText}>AyuSync report received!</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            Failed to connect to AyuShare. Please ensure the app is installed.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: accentColor }]}
            onPress={() => setStatus('idle')}
          >
            <Text style={[styles.retryText, { color: accentColor }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
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
  launchButton: {
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  launchEmoji: {
    fontSize: 40,
  },
  launchText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  launchHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSize.sm,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  statusHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  receivedEmoji: {
    fontSize: 32,
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: '#dc2626',
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
  },
  retryText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
})
