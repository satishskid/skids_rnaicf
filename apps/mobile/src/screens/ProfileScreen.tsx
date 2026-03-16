// Profile screen — user info, app info, and logout
// Clean card-based layout for the Profile tab

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import { useAuth } from '../lib/AuthContext'
import { checkOllamaStatus, DEFAULT_LLM_CONFIG } from '../lib/ai/llm-gateway'
import { APP_VERSION } from '../lib/constants'

export function ProfileScreen() {
  const { user, logout } = useAuth()
  const insets = useSafeAreaInsets()
  const [aiStatus, setAiStatus] = useState<{ checked: boolean; available: boolean; models: string[]; error?: string }>({ checked: false, available: false, models: [] })
  const [aiChecking, setAiChecking] = useState(false)

  const checkAi = async () => {
    setAiChecking(true)
    try {
      const status = await checkOllamaStatus(DEFAULT_LLM_CONFIG.ollamaUrl, DEFAULT_LLM_CONFIG.ollamaModel)
      setAiStatus({ checked: true, ...status })
    } catch {
      setAiStatus({ checked: true, available: false, models: [], error: 'Connection failed' })
    } finally {
      setAiChecking(false)
    }
  }

  useEffect(() => { checkAi() }, [])

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will need to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    )
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>
            <Text style={styles.brandBold}>SKIDS</Text>
            <Text style={styles.brandLight}> screen</Text>
          </Text>
          <Text style={styles.headerSubtitle}>Profile</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
      >
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {user ? getInitials(user.name) : '?'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'Unknown User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'No email'}</Text>
          {user?.role && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{user?.name || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>
                {user?.role
                  ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                  : 'N/A'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User ID</Text>
              <Text style={[styles.infoValue, styles.monoText]} numberOfLines={1}>
                {user?.id || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Name</Text>
              <Text style={styles.infoValue}>SKIDS Screen</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>{APP_VERSION}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>Android (Expo SDK 54)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>API Server</Text>
              <Text style={[styles.infoValue, styles.monoText]} numberOfLines={1}>
                skids-api.satish-9f4.workers.dev
              </Text>
            </View>
          </View>
        </View>

        {/* AI Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Engine</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mode</Text>
              <Text style={styles.infoValue}>{DEFAULT_LLM_CONFIG.mode.replace('_', ' ')}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Local Model</Text>
              <Text style={[styles.infoValue, styles.monoText]}>{DEFAULT_LLM_CONFIG.ollamaModel}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ollama Status</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {aiChecking ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <View style={[styles.statusDot, { backgroundColor: aiStatus.available ? '#16a34a' : '#d97706' }]} />
                    <Text style={[styles.infoValue, { flex: 0 }]}>
                      {aiStatus.available ? 'Connected' : aiStatus.error || 'Unavailable'}
                    </Text>
                  </>
                )}
              </View>
            </View>
            {aiStatus.checked && aiStatus.models.length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Models</Text>
                  <Text style={[styles.infoValue, styles.monoText]} numberOfLines={2}>
                    {aiStatus.models.slice(0, 3).join(', ')}
                    {aiStatus.models.length > 3 ? ` +${aiStatus.models.length - 3}` : ''}
                  </Text>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <TouchableOpacity style={styles.infoRow} onPress={checkAi} disabled={aiChecking}>
              <Text style={[styles.infoLabel, { color: colors.primary }]}>
                {aiChecking ? 'Checking...' : 'Refresh AI Status'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>
          SKIDS Pediatric Health Screening System
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: fontSize.xl,
  },
  brandBold: {
    fontWeight: fontWeight.black,
    color: colors.white,
  },
  brandLight: {
    fontWeight: fontWeight.normal,
    color: 'rgba(255,255,255,0.7)',
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.md,
  },
  // User card
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  avatarText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  roleBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  roleText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 52,
  },
  infoLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  infoValue: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: fontWeight.semibold,
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Logout
  logoutButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginBottom: spacing.lg,
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  footer: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.xs,
    paddingBottom: spacing.md,
  },
})
