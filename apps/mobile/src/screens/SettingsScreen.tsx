// Settings screen — AI config, edge models, device settings, data sync, about
// Card-based layout with role-aware sections (nurse vs doctor)

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
import * as IntentLauncher from 'expo-intent-launcher'
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
import { getAyuSharePlayStoreUrl } from '../lib/ayusync-deeplink'

const CALIBRATION_STORAGE_KEY = 'skids_calibration_timestamp'

const AI_MODES: { value: AIMode; label: string; desc: string }[] = [
  { value: 'local_first', label: 'Local First', desc: 'Try on-device, fallback to cloud' },
  { value: 'cloud_first', label: 'Cloud First', desc: 'Try cloud, fallback to local' },
  { value: 'local_only', label: 'Local Only', desc: 'No cloud — PHI stays on device' },
  { value: 'dual', label: 'Dual', desc: 'Run both, compare results' },
]

const CLOUD_PROVIDERS: { value: CloudProvider; label: string; model: string }[] = [
  { value: 'gemini', label: 'Gemini', model: 'gemini-2.0-flash' },
  { value: 'claude', label: 'Claude', model: 'claude-sonnet-4' },
  { value: 'gpt4o', label: 'GPT-4o', model: 'gpt-4o' },
  { value: 'groq', label: 'Groq', model: 'llama-3.3-70b' },
]

const RECOMMENDED_MODELS = [
  { id: 'lfm2.5-vl:1.6b', label: 'LFM2-VL 1.6B', size: '~800MB', desc: 'Fast, vision-capable' },
  { id: 'medgemma:4b', label: 'MedGemma 4B', size: '~3.5GB', desc: 'Medical-optimized' },
  { id: 'qwen3-vl:8b', label: 'Qwen3-VL 8B', size: '~5.5GB', desc: 'Best reasoning' },
  { id: 'lfm2:8b', label: 'LFM2 8B', size: '~5.9GB', desc: 'General purpose' },
]

export function SettingsScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const token = user?.token || null
  const isDoctor = user?.role === 'doctor' || user?.role === 'admin'

  // AI Config state
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG)
  const [configLoading, setConfigLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Ollama status
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'offline'>('checking')
  const [ollamaModels, setOllamaModels] = useState<string[]>([])

  // Edge model state
  const [edgeModelStatus, setEdgeModelStatus] = useState<'none' | 'cached' | 'checking'>('checking')

  // Device state
  const [btStatus, setBtStatus] = useState<'checking' | 'ready' | 'warning'>('checking')
  const [ayuShareInstalled, setAyuShareInstalled] = useState(false)
  const [lastCalibration, setLastCalibration] = useState<string | null>(null)

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

  // Check Ollama connection
  useEffect(() => {
    const checkOllama = async () => {
      try {
        const status = await checkOllamaStatus(config.ollamaUrl, config.ollamaModel)
        if (status.available) {
          setOllamaStatus('connected')
          if (status.models) setOllamaModels(status.models)
        } else {
          setOllamaStatus('offline')
        }
      } catch {
        setOllamaStatus('offline')
      }
    }
    if (!configLoading) checkOllama()
  }, [configLoading, config.ollamaUrl, config.ollamaModel])

  // Check edge model cache
  useEffect(() => {
    const checkEdge = async () => {
      try {
        const cached = await AsyncStorage.getItem('@skids/edge-model-info')
        setEdgeModelStatus(cached ? 'cached' : 'none')
      } catch {
        setEdgeModelStatus('none')
      }
    }
    checkEdge()
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
        const scheme = 'app://www.ayudevicestech.com/launchApp'
        const canOpen = await Linking.canOpenURL(scheme)
        setAyuShareInstalled(canOpen)
      } catch {
        setAyuShareInstalled(false)
      }

      // Calibration
      try {
        const cal = await AsyncStorage.getItem(CALIBRATION_STORAGE_KEY)
        setLastCalibration(cal)
      } catch { /* ignore */ }

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
            await AsyncStorage.multiRemove([
              '@skids/ai-cache',
              '@skids/edge-model-info',
            ])
            setEdgeModelStatus('none')
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

  const openBtSettings = async () => {
    if (Platform.OS === 'android') {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS
        )
      } catch {
        Alert.alert('Bluetooth', 'Please open Bluetooth settings manually.')
      }
    }
  }

  const handleCalibrate = async () => {
    const now = new Date().toISOString()
    await AsyncStorage.setItem(CALIBRATION_STORAGE_KEY, now)
    setLastCalibration(now)
    Alert.alert('Calibration', 'Device calibration timestamp updated.')
  }

  const getCalibrationLabel = () => {
    if (!lastCalibration) return 'Not calibrated'
    const hoursAgo = (Date.now() - new Date(lastCalibration).getTime()) / (1000 * 60 * 60)
    if (hoursAgo < 1) return `${Math.round(hoursAgo * 60)}m ago`
    if (hoursAgo < 24) return `${Math.round(hoursAgo)}h ago`
    return `${Math.round(hoursAgo / 24)}d ago`
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
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                {AI_MODES.find(m => m.value === config.mode)?.desc || ''}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* PHI Protection */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Send Images to Cloud</Text>
              <Switch
                value={config.sendImagesToCloud}
                onValueChange={val => saveConfig({ sendImagesToCloud: val })}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={config.sendImagesToCloud ? colors.primary : '#f4f3f4'}
              />
            </View>
            {!config.sendImagesToCloud && (
              <View style={styles.hintRow}>
                <Text style={[styles.hintText, { color: '#059669' }]}>
                  PHI protected — images stay on device only
                </Text>
              </View>
            )}

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
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                Model: {CLOUD_PROVIDERS.find(p => p.value === config.cloudProvider)?.model || ''}
              </Text>
            </View>

            {/* Cloud API Key — only for doctors */}
            {isDoctor && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Personal API Key (BYOK)</Text>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    value={config.cloudApiKey}
                    onChangeText={text => setConfig(prev => ({ ...prev, cloudApiKey: text }))}
                    onBlur={() => saveConfig({ cloudApiKey: config.cloudApiKey })}
                    placeholder="Optional — server key used by default"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Section 2: Edge / On-Device AI ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Edge / On-Device AI</Text>
          <View style={styles.infoCard}>
            {/* Ollama Connection */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ollama Server</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        ollamaStatus === 'connected' ? '#16a34a'
                          : ollamaStatus === 'checking' ? '#9ca3af'
                          : '#dc2626',
                    },
                  ]}
                />
                <Text style={[styles.infoValue, { flex: 0 }]}>
                  {ollamaStatus === 'connected'
                    ? 'Connected'
                    : ollamaStatus === 'checking'
                      ? 'Checking...'
                      : 'Offline'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Ollama URL */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ollama URL</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={config.ollamaUrl}
                onChangeText={text => setConfig(prev => ({ ...prev, ollamaUrl: text }))}
                onBlur={() => {
                  saveConfig({ ollamaUrl: config.ollamaUrl })
                  setOllamaStatus('checking')
                }}
                placeholder="http://localhost:11434"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <View style={styles.divider} />

            {/* Active Local Model */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Active Model</Text>
              <Text style={[styles.infoValue, styles.monoText]}>
                {config.ollamaModel}
              </Text>
            </View>

            {ollamaModels.length > 0 && (
              <>
                <View style={styles.hintRow}>
                  <Text style={styles.hintText}>
                    Available: {ollamaModels.join(', ')}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.divider} />

            {/* Recommended Models */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Recommended Models</Text>
            </View>
            {RECOMMENDED_MODELS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.modelRow,
                  config.ollamaModel === m.id && styles.modelRowActive,
                ]}
                onPress={() => saveConfig({ ollamaModel: m.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.modelName,
                    config.ollamaModel === m.id && { color: colors.primary },
                  ]}>
                    {m.label}
                  </Text>
                  <Text style={styles.modelDesc}>{m.desc} ({m.size})</Text>
                </View>
                {config.ollamaModel === m.id && (
                  <Text style={{ color: colors.primary, fontSize: 16 }}>{'\u2713'}</Text>
                )}
              </TouchableOpacity>
            ))}

            <View style={styles.divider} />

            {/* ONNX On-Device Status */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ONNX Edge Models</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        edgeModelStatus === 'cached' ? '#16a34a'
                          : edgeModelStatus === 'checking' ? '#9ca3af'
                          : '#d97706',
                    },
                  ]}
                />
                <Text style={[styles.infoValue, { flex: 0 }]}>
                  {edgeModelStatus === 'cached'
                    ? 'Cached'
                    : edgeModelStatus === 'checking'
                      ? 'Checking...'
                      : 'Not downloaded'}
                </Text>
              </View>
            </View>
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                MobileNet/TFLite models for offline screening (auto-downloaded on first use)
              </Text>
            </View>
          </View>
        </View>

        {/* ── Section 3: Medical Devices ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Devices</Text>
          <View style={styles.infoCard}>
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
                  Linking.openURL(getAyuSharePlayStoreUrl()).catch(() => {})
                }
              >
                <Text style={styles.linkText}>Install AyuShare from Play Store</Text>
              </TouchableOpacity>
            )}
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                Digital stethoscope for cardiac & pulmonary auscultation via AyuDevices AyuSynk
              </Text>
            </View>

            <View style={styles.divider} />

            {/* External Camera */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>External Camera</Text>
              <Text style={styles.infoValue}>Via system camera app</Text>
            </View>
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                USB cameras accessed through system camera; use "System Camera" option in screening
              </Text>
            </View>

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
                      : 'Tap to open settings'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Calibration */}
            <TouchableOpacity style={styles.infoRow} onPress={handleCalibrate}>
              <Text style={styles.infoLabel}>Device Calibration</Text>
              <Text style={[styles.infoValue, { flex: 0, color: lastCalibration ? colors.text : '#d97706' }]}>
                {getCalibrationLabel()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkRow} onPress={handleCalibrate}>
              <Text style={styles.linkText}>Run Calibration Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section 4: Data & Sync ── */}
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

        {/* ── Section 5: About ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App</Text>
              <Text style={styles.infoValue}>SKIDS Screen v3.1.0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}
              </Text>
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
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>3-Tier Pipeline</Text>
              <Text style={styles.infoValue}>Quality Gate + ML + LLM</Text>
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
  // Hint text below rows
  hintRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
  },
  hintText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
  // Chip selector
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
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
  // Model picker
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  modelRowActive: {
    backgroundColor: '#eff6ff',
  },
  modelName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  modelDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
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
