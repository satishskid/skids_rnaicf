// Batch Summary Screen — shown when batch screening is complete
// Displays child info, module count, and findings summary

import React from 'react'
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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

type RootStackParamList = {
  BatchSummary: {
    campaignCode: string
    childId: string
    childName: string
    completedModules: string // comma-separated moduleTypes
  }
}

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BatchSummary'>
  route: RouteProp<RootStackParamList, 'BatchSummary'>
}

export function BatchSummaryScreen({ navigation, route }: Props) {
  const { childName, completedModules: modulesStr } = route.params
  const moduleTypes = modulesStr.split(',').filter(Boolean) as ModuleType[]

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <Text style={styles.successEmoji}>{'\u2705'}</Text>
          <Text style={styles.successTitle}>Screening Complete</Text>
          <Text style={styles.successSubtitle}>
            {childName}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{moduleTypes.length}</Text>
            <Text style={styles.statLabel}>Modules{'\n'}Completed</Text>
          </View>
        </View>

        {/* Module List */}
        <View style={styles.moduleList}>
          <Text style={styles.moduleListTitle}>Completed Modules</Text>
          {moduleTypes.map((mt, i) => {
            const config = getModuleConfig(mt)
            return (
              <View key={i} style={styles.moduleRow}>
                <Text style={styles.moduleRowCheck}>{'\u2705'}</Text>
                <Text style={styles.moduleRowName}>{config?.name || mt}</Text>
                <Text style={styles.moduleRowType}>{config?.captureType || ''}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* Done Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.popToTop()}
          activeOpacity={0.8}
        >
          <Text style={styles.doneButtonText}>Done</Text>
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
    paddingVertical: spacing.xl,
  },
  successEmoji: {
    fontSize: 56,
    marginBottom: spacing.md,
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
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 140,
    ...shadow.sm,
  },
  statNumber: {
    fontSize: 36,
    fontWeight: fontWeight.black,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  // Module list
  moduleList: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  moduleListTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moduleRowCheck: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  moduleRowName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  moduleRowType: {
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
