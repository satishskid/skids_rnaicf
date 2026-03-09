// Sync status bar — shows pending sync count, online/offline indicator
// Displays at bottom of campaign detail screen

import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme'

interface SyncStatusBarProps {
  pendingCount: number
  isSyncing: boolean
  isOnline: boolean
  lastSyncAt: string | null
  onSyncPress: () => void
}

export function SyncStatusBar({
  pendingCount,
  isSyncing,
  isOnline,
  lastSyncAt,
  onSyncPress,
}: SyncStatusBarProps) {
  const hasPending = pendingCount > 0

  return (
    <View style={styles.container}>
      {/* Online/Offline indicator */}
      <View style={styles.statusSection}>
        <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
      </View>

      {/* Pending count */}
      <View style={styles.centerSection}>
        {hasPending ? (
          <Text style={styles.pendingText}>
            {pendingCount} pending
          </Text>
        ) : (
          <Text style={styles.syncedText}>All synced</Text>
        )}
        {lastSyncAt && (
          <Text style={styles.lastSyncText}>
            Last: {new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Sync button */}
      <TouchableOpacity
        style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
        onPress={onSyncPress}
        disabled={isSyncing || !hasPending}
        activeOpacity={0.7}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.syncButtonText, !hasPending && styles.syncButtonTextDisabled]}>
            Sync
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: colors.success,
  },
  dotOffline: {
    backgroundColor: colors.danger,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  centerSection: {
    alignItems: 'center',
  },
  pendingText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.warning,
  },
  syncedText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
  lastSyncText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  syncButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  syncButtonTextDisabled: {
    color: colors.textMuted,
  },
})
