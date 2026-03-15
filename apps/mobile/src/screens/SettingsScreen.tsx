// Settings screen — AI config, device settings, data sync, about
// Card-based layout matching ProfileScreen style

import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  Linking,
  PermissionsAndroid,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import { useAuth } from '../lib/AuthContext'
import {
  loadLLMConfig,
  saveLLMConfig,
  DEFAULT_LLM_CONFIG,
  checkOllamaStatus,
} from '../lib/ai/llm-gateway'
import type { LLMConfig, AIMode, CloudProvider } from '../lib/ai/llm-gateway'
import { getPendingCount, syncNow } from '../lib/sync-engine'

const AI_MODES: { value: AIMode; label: string }[] = [
  { value: 'local_first', label: 'Local First' },
  { value: 'cloud_first', label: 'Cloud First' },
  { value: 'local_only', label: 'Local Only' },
  { value: 'dual', label: 'Dual' },
]

const CLOUD_PROVIDERS: { value: CloudProvider; label: string }[] = [
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'gpt4o', label: 'GPT-4o' },
  { value: 'groq', label: 'Groq' },
]

export function SettingsScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const token = user?.token || null

  // AI Config state
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG)
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Device state
  const [btStatus, setBtStatus] = useState<'checking' | 'ready' | 'warning'>('checking')
  const [ayuShareInstalled, setAyuShareInstalled] = useState(false)

  // Sync state
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)

  // Load config on mount
  useEffect(() => {
    const init = async () => {
      try {
        const loaded = await loadLLMConfig()
        setConfig(loaded)
      } catch {
        // keep defaults
      } finally {
        setConfigLoading(false)
      }
    }
    init()
  }, [])

  // Check device statuses
  useEffect(() => {
    const checkDevices = async () => {
      // Bluetooth
      try {
        if (Platform.OS === 'android') {
          const apiLevel = Platform.Version
          if (typeof apiLevel === 'number' && apiLevel >= 31) {
            const granted = await PermissionsAndroid.check(
              'android.permission.BLUETOOTH_CONNECT' as any
            )
            setBtStatus(granted ? 'ready' : 'warning')
          } else {
            setBtStatus('ready')
          }
        } else {
          setBtStatus('warning')
        }
      } catch {
        setBtStatus('warning')
      }

      // AyuShare app
      try {
        const scheme = Platform.OS === 'android' ? 'com.ayusync.ayushare' : 'ayushare://'
        const canOpen = await Linking.canOpenURL(scheme)
        setAyuShareInstalled(canOpen)
      } catch {
        setAyuShareInstalled(false)
      }

      // Pending sync count
      try {
        const count = await getPendingCount()
        setPendingCount(count)
      } catch {
        // ignore
      }
    }
    checkDevices()
  }, [])

  const saveConfig = useCallback(async (partial: Partial<LLMConfig>) => {
    setSaving(true)
    try {
      const updated = { ...config, ...partial }
      await saveLLMConfig(partial)
      setConfig(updated)
    } catch {
      Alert.alert('Error', 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [config])

  const handleSync = async () => {
    if (!token) {
      Alert.alert('Not Authenticated', 'Please log in to sync data.')
      return
    }
    setSyncing(true)
    try {
      const result = await syncNow(token)
      const count = await getPendingCount()
      setPendingCount(count)
      Alert.alert(
        'Sync Complete',
        `Synced: ${result.synced}, Failed: ${result.failed}${result.errors.length > 0 ? '\n' + result.errors[0] : ''}`
      )
    } catch (e: any) {
      Alert.alert('Sync Error', e.message || 'Unknown error')
    } finally {
      setSyncing(false)
    }
  }

  const handleClearCache = async () => {
    Alert.alert('Clear Cache', 'Clear AI model cache and temporary data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearingCache(true)
          try {
            await AsyncStorage.removeItem('@skids/ai-cache')
            Alert.alert('Done', 'Cache cleared successfully.')
          } catch {
            Alert.alert('Error', 'Failed to clear cache.')
          } finally {
            setClearingCache(false)
          }
        },
      },
    ])
  }

  const openBtSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openURL('android.settings.BLUETOOTH_SETTINGS').catch(() => {})
    }
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
          <Text style={styles.headerSubtitle}>Settings</Text>
        </View>
        {saving && <ActivityIndicator color="#fff" size="small" />}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
      >
        {/* ── Section 1: AI Configuration ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Configuration</Text>
          <View style={styles.infoCard}>
            {/* AI Mode */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>AI Mode</Text>
            </View>
            <View style={styles.chipRow}>
              {AI_MODES.map(m => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.chip, config.mode === m.value && styles.chipActive]}
                  onPress={() => saveConfig({ mode: m.value })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      config.mode === m.value && styles.chipTextActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Cloud Provider */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Cloud Provider</Text>
            </View>
            <View style={styles.chipRow}>
              {CLOUD_PROVIDERS.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.chip,
                    config.cloudProvider === p.value && styles.chipActive,
                  ]}
                  onPress={() => saveConfig({ cloudProvider: p.value })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      config.cloudProvider === p.value && styles.chipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Cloud API Key */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Cloud API Key</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={config.cloudApiKey}
                onChangeText={text => setConfig(prev => ({ ...prev, cloudApiKey: text }))}
                onBlur={() => saveConfig({ cloudApiKey: config.cloudApiKey })}
                placeholder="Not needed (server-side)"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.divider} />

            {/* Send Images to Cloud */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Send Images to Cloud</Text>
              <Switch
                value={config.sendImagesToCloud}
                onValueChange={val => saveConfig({ sendImagesToCloud: val })}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={config.sendImagesToCloud ? colors.primary : '#f4f3f4'}
              />
            </View>

            <View style={styles.divider} />

            {/* Local Model */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Local Model</Text>
              <Text style={[styles.infoValue, styles.monoText]}>
                {config.ollamaModel}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Section 2: Device Configuration ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Configuration</Text>
          <View style={styles.infoCard}>
            {/* External Camera */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>External Camera</Text>
              <Text style={styles.infoValue}>Via system camera app</Text>
            </View>

            <View style={styles.divider} />

            {/* AyuSync Stethoscope */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>AyuSync Stethoscope</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: ayuShareInstalled ? '#16a34a' : '#d97706' },
                  ]}
                />
                <Text style={[styles.infoValue, { flex: 0 }]}>
                  {ayuShareInstalled ? 'Installed' : 'Not installed'}
                </Text>
              </View>
            </View>
            {!ayuShareInstalled && (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() =>
                  Linking.openURL(
                    'https://play.google.com/store/apps/details?id=com.ayusync.ayushare'
                  ).catch(() => {})
                }
              >
                <Text style={styles.linkText}>Install AyuShare from Play Store</Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider} />

            {/* Bluetooth Devices */}
            <TouchableOpacity style={styles.infoRow} onPress={openBtSettings}>
              <Text style={styles.infoLabel}>Bluetooth Devices</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        btStatus === 'ready'
                          ? '#16a34a'
                          : btStatus === 'checking'
                            ? '#9ca3af'
                            : '#d97706',
                    },
                  ]}
                />
                <Text style={[styles.infoValue, { flex: 0 }]}>
                  {btStatus === 'ready'
                    ? 'Ready'
                    : btStatus === 'checking'
                      ? 'Checking...'
                      : 'Open Settings'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section 3: Data & Sync ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Sync</Text>
          <View style={styles.infoCard}>
            {/* Pending Sync */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pending Sync</Text>
              <Text style={styles.infoValue}>
                {pendingCount === 0 ? 'All synced' : `${pendingCount} pending`}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Force Sync */}
            <TouchableOpacity
              style={styles.infoRow}
              onPress={handleSync}
              disabled={syncing}
            >
              <Text style={[styles.infoLabel, { color: colors.primary }]}>
                {syncing ? 'Syncing...' : 'Force Sync Now'}
              </Text>
              {syncing && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Clear Cache */}
            <TouchableOpacity
              style={styles.infoRow}
              onPress={handleClearCache}
              disabled={clearingCache}
            >
              <Text style={[styles.infoLabel, { color: '#dc2626' }]}>
                {clearingCache ? 'Clearing...' : 'Clear AI Cache'}
              </Text>
              {clearingCache && (
                <ActivityIndicator size="small" color="#dc2626" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section 4: About ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Name</Text>
              <Text style={styles.infoValue}>SKIDS Screen</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>3.0.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>
                {Platform.OS === 'android'
                  ? `Android (API ${Platform.Version})`
                  : `iOS`}
              </Text>
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

        {/* Footer */}
        <Text style={styles.footer}>SKIDS Pediatric Health Screening System</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  // Chip selector
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: '#eff6ff',
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  // Input
  inputRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.base,
    color: colors.text,
    backgroundColor: '#f9fafb',
    fontFamily: 'monospace',
  },
  // Link row
  linkRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
  },
  linkText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    textDecorationLine: 'underline',
  },
  footer: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.xs,
    paddingBottom: spacing.md,
  },
})
