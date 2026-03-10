// Screening screen — grid of screening modules with child selector
// Grouped by category with colored cards matching each module's color

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  SectionList,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { MODULE_CONFIGS } from '../lib/modules'
import type { ModuleConfig } from '../lib/modules'
import type { ModuleType, Child } from '../lib/types'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow, getColorHex } from '../theme'
import { useAuth } from '../lib/AuthContext'
import { apiCall } from '../lib/api'
import { useSyncEngine } from '../lib/sync-engine'
import { SyncStatusBar } from '../components/SyncStatusBar'
import { ReadinessCheck } from '../components/ReadinessCheck'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

type RootStackParamList = {
  ScreeningTab: undefined
  Screening: { campaignCode?: string }
  Module: {
    moduleType: ModuleType; campaignCode?: string; childId?: string
    childDob?: string; childGender?: 'male' | 'female'; childName?: string
    batchMode?: boolean; batchIndex?: number; batchTotal?: number; batchQueue?: string
  }
  QuickVitals: {
    childId: string; childDob: string; childGender: 'male' | 'female'
    childName: string; campaignCode: string
  }
  BatchSummary: {
    campaignCode: string; childId: string; childName: string; completedModules: string
  }
}

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList>
  route?: RouteProp<RootStackParamList>
}

// Map module icons to emoji for display
const ICON_EMOJI_MAP: Record<string, string> = {
  Ruler: '\u{1F4CF}',
  Scale: '\u{2696}\u{FE0F}',
  Heart: '\u{2764}\u{FE0F}',
  Droplet: '\u{1FA78}',
  UserCheck: '\u{1F9D1}\u{200D}\u{2695}\u{FE0F}',
  Sparkles: '\u{2728}',
  EyeExternal: '\u{1F441}',
  Eye: '\u{1F440}',
  Ear: '\u{1F442}',
  Headphones: '\u{1F3A7}',
  Nose: '\u{1F443}',
  Tooth: '\u{1F9B7}',
  Throat: '\u{1F444}',
  Neck: '\u{1F9E3}',
  Mic: '\u{1F3A4}',
  Abdomen: '\u{1F9CD}',
  Scan: '\u{1F50D}',
  Hand: '\u{270B}',
  Spine: '\u{1F9B4}',
  Activity: '\u{1F3C3}',
  Lymph: '\u{1F52C}',
  Brain: '\u{1F9E0}',
  Shield: '\u{1F6E1}',
  Stethoscope: '\u{1FA7A}',
  Apple: '\u{1F34E}',
  Pill: '\u{1F48A}',
}

function getIconEmoji(iconName: string): string {
  return ICON_EMOJI_MAP[iconName] || '\u{1F3E5}'
}

// Group label mapping
const GROUP_LABELS: Record<string, string> = {
  vitals: 'Vitals & Measurements',
  head_to_toe: 'Head-to-Toe Examination',
}

interface SectionData {
  title: string
  data: ModuleConfig[][]
}

export function ScreeningScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { token } = useAuth()

  // Get campaignCode from route params (passed from CampaignDetail)
  const campaignCode = (route?.params as Record<string, unknown> | undefined)?.campaignCode as string | undefined

  // Sync engine
  const { pendingCount, isSyncing, lastSyncAt, syncNow } = useSyncEngine(token)
  const [isOnline, setIsOnline] = useState(true)

  // Check network status periodically
  useEffect(() => {
    const check = async () => {
      try {
        const controller = new AbortController()
        setTimeout(() => controller.abort(), 3000)
        await fetch('https://clients3.google.com/generate_204', { signal: controller.signal })
        setIsOnline(true)
      } catch { setIsOnline(false) }
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Readiness check state (for batch screening)
  const [showReadiness, setShowReadiness] = useState(false)

  // Child selector state
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)
  const [loadingChildren, setLoadingChildren] = useState(false)

  // Module completion tracking
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set())

  // Child search filter
  const [childSearch, setChildSearch] = useState('')
  const filteredChildren = useMemo(() => {
    if (!childSearch.trim()) return children
    const q = childSearch.toLowerCase()
    return children.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.admissionNumber && c.admissionNumber.toLowerCase().includes(q)) ||
      (c.class && c.class.toLowerCase().includes(q))
    )
  }, [children, childSearch])

  // Re-fetch completed modules when screen gains focus (e.g. returning from ModuleScreen)
  useFocusEffect(
    useCallback(() => {
      if (!selectedChild || !token || !campaignCode) return
      apiCall<{ observations?: Array<{ moduleType: string }>; data?: Array<{ moduleType: string }> }>(
        `/api/observations?campaign=${campaignCode}&childId=${selectedChild.id}`,
        { token }
      )
        .then(res => {
          const obs = res.observations || res.data || (Array.isArray(res) ? res as Array<{ moduleType: string }> : [])
          setCompletedModules(new Set(obs.map(o => o.moduleType)))
        })
        .catch(() => {})
    }, [selectedChild, campaignCode, token])
  )

  // Clear completed modules when child changes
  useEffect(() => {
    if (!selectedChild) setCompletedModules(new Set())
  }, [selectedChild])

  // Fetch children for the campaign
  useEffect(() => {
    if (!campaignCode || !token) return
    setLoadingChildren(true)
    apiCall<{ children?: Child[]; data?: Child[] }>(
      `/api/campaigns/${campaignCode}/children`,
      { token }
    )
      .then(data => {
        const list = data.children || data.data || (Array.isArray(data) ? (data as unknown as Child[]) : [])
        setChildren(list)
      })
      .catch(() => setChildren([]))
      .finally(() => setLoadingChildren(false))
  }, [campaignCode, token])

  // Group modules by category and chunk into rows of 3 for grid layout
  const sections = useMemo<SectionData[]>(() => {
    const groups: Record<string, ModuleConfig[]> = {}

    MODULE_CONFIGS.forEach((mod) => {
      const group = mod.group || 'other'
      if (!groups[group]) groups[group] = []
      groups[group].push(mod)
    })

    return Object.entries(groups).map(([key, modules]) => {
      // Chunk into rows of 3
      const rows: ModuleConfig[][] = []
      for (let i = 0; i < modules.length; i += 3) {
        rows.push(modules.slice(i, i + 3))
      }
      return {
        title: GROUP_LABELS[key] || key,
        data: rows,
      }
    })
  }, [])

  // ── Child Selector ─────────────────────────────

  const renderChildSelector = () => {
    if (!campaignCode) return null

    if (loadingChildren) {
      return (
        <View style={styles.childSelectorBar}>
          <ActivityIndicator size="small" color={colors.white} />
          <Text style={styles.childSelectorHint}>Loading children...</Text>
        </View>
      )
    }

    if (children.length === 0) {
      return (
        <View style={styles.childSelectorBar}>
          <Text style={styles.childSelectorHint}>No children registered in this campaign</Text>
        </View>
      )
    }

    return (
      <View style={styles.childSelectorContainer}>
        <Text style={styles.childSelectorLabel}>
          {selectedChild ? `Screening: ${selectedChild.name}` : 'Select a child to screen'}
        </Text>
        {/* Search box */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, class, or admission #..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={childSearch}
            onChangeText={setChildSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {childSearch.length > 0 && (
            <TouchableOpacity onPress={() => setChildSearch('')} style={styles.searchClear}>
              <Text style={styles.searchClearText}>{'\u2715'}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.searchCount}>
            {filteredChildren.length}/{children.length}
          </Text>
        </View>
        <FlatList
          horizontal
          data={filteredChildren}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childChipList}
          renderItem={({ item }) => {
            const isSelected = selectedChild?.id === item.id
            return (
              <TouchableOpacity
                style={[styles.childChip, isSelected && styles.childChipSelected]}
                onPress={() => setSelectedChild(isSelected ? null : item)}
                activeOpacity={0.7}
              >
                <View style={[styles.chipAvatar, isSelected && styles.chipAvatarSelected]}>
                  <Text style={[styles.chipAvatarText, isSelected && styles.chipAvatarTextSelected]}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={[styles.chipName, isSelected && styles.chipNameSelected]}
                  numberOfLines={1}
                >
                  {item.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            )
          }}
        />
      </View>
    )
  }

  // ── Module Cards ───────────────────────────────

  const renderModuleCard = (mod: ModuleConfig) => {
    const bgColor = getColorHex(mod.color)
    const isCompleted = completedModules.has(mod.type)
    return (
      <TouchableOpacity
        key={mod.type}
        style={[styles.moduleCard, isCompleted && styles.moduleCardCompleted]}
        onPress={() => navigation.navigate('Module', {
          moduleType: mod.type,
          campaignCode,
          childId: selectedChild?.id,
          childDob: selectedChild?.dob,
          childGender: selectedChild?.gender,
          childName: selectedChild?.name,
        })}
        activeOpacity={0.75}
      >
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedCheckmark}>{'\u2705'}</Text>
          </View>
        )}
        <View style={[styles.moduleIconContainer, { backgroundColor: bgColor }]}>
          <Text style={styles.moduleEmoji}>{getIconEmoji(mod.icon)}</Text>
        </View>
        <Text style={styles.moduleName} numberOfLines={2}>
          {mod.name}
        </Text>
        <Text style={styles.moduleDescription} numberOfLines={2}>
          {mod.description}
        </Text>
        <View style={styles.moduleMeta}>
          <View style={[styles.captureTypeBadge, { backgroundColor: bgColor + '20' }]}>
            <Text style={[styles.captureTypeText, { color: bgColor }]}>
              {mod.captureType}
            </Text>
          </View>
          <Text style={styles.moduleDuration}>{mod.duration}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const renderRow = ({ item }: { item: ModuleConfig[] }) => {
    return (
      <View style={styles.row}>
        {item.map(renderModuleCard)}
        {/* Fill remaining space if row has fewer than 3 items */}
        {item.length < 3 &&
          Array.from({ length: 3 - item.length }).map((_, i) => (
            <View key={`spacer-${i}`} style={styles.moduleCardSpacer} />
          ))}
      </View>
    )
  }

  // ── Batch Screening ─────────────────────────────
  const batchQueueRef = useRef<ModuleType[]>([])

  const handleStartBatchScreening = () => {
    if (!selectedChild) return
    const remaining = MODULE_CONFIGS
      .filter(m => !completedModules.has(m.type))
      .map(m => m.type)
    if (remaining.length === 0) {
      Alert.alert('All Done', 'All modules are already completed for this child.')
      return
    }
    batchQueueRef.current = remaining
    setShowReadiness(true)
  }

  const handleReadinessComplete = () => {
    setShowReadiness(false)
    const queue = batchQueueRef.current
    if (!selectedChild || queue.length === 0) return
    navigation.navigate('Module', {
      moduleType: queue[0],
      campaignCode,
      childId: selectedChild.id,
      childDob: selectedChild.dob,
      childGender: selectedChild.gender,
      childName: selectedChild.name,
      batchMode: true,
      batchIndex: 0,
      batchTotal: queue.length,
      batchQueue: queue.join(','),
    })
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
          <Text style={styles.headerSubtitle}>Screening Modules</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{MODULE_CONFIGS.length} modules</Text>
        </View>
      </View>

      {/* Sync Status */}
      <SyncStatusBar
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        isOnline={isOnline}
        lastSyncAt={lastSyncAt}
        onSyncPress={syncNow}
      />

      {/* Child Selector */}
      {renderChildSelector()}

      {/* Progress Header */}
      {selectedChild && completedModules.size > 0 && (
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>
            {completedModules.size}/{MODULE_CONFIGS.length} modules completed
          </Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, {
              width: `${Math.round((completedModules.size / MODULE_CONFIGS.length) * 100)}%`
            }]} />
          </View>
        </View>
      )}

      {/* Quick Vitals + Full Screening buttons */}
      {selectedChild && (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.quickVitalsButton}
            onPress={() => {
              if (!selectedChild || !campaignCode) return
              navigation.navigate('QuickVitals', {
                childId: selectedChild.id,
                childDob: selectedChild.dob,
                childGender: selectedChild.gender,
                childName: selectedChild.name,
                campaignCode,
              })
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.quickVitalsEmoji}>{'\u26A1'}</Text>
            <View>
              <Text style={styles.quickVitalsText}>Quick Vitals</Text>
              <Text style={styles.quickVitalsHint}>All measurements in one screen</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.batchButton}
            onPress={handleStartBatchScreening}
            activeOpacity={0.8}
          >
            <Text style={styles.batchButtonText}>
              Full Screening ({MODULE_CONFIGS.length - completedModules.size} left)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `row-${index}`}
        renderItem={renderRow}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.title === 'Vitals & Measurements' && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI-powered</Text>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        stickySectionHeadersEnabled={false}
      />

      {/* Readiness Check Modal */}
      <Modal visible={showReadiness} transparent animationType="slide">
        <View style={styles.readinessOverlay}>
          <View style={styles.readinessModal}>
            <ReadinessCheck showContinueButton onReady={handleReadinessComplete} />
            <TouchableOpacity
              style={styles.readinessDismiss}
              onPress={() => setShowReadiness(false)}
            >
              <Text style={styles.readinessDismissText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  // Child selector
  childSelectorContainer: {
    backgroundColor: '#1e40af',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  childSelectorBar: {
    backgroundColor: '#1e40af',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  childSelectorLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: fontSize.sm,
    color: colors.white,
  },
  searchClear: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  searchClearText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
  },
  searchCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    minWidth: 40,
    textAlign: 'right',
  },
  childSelectorHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  childChipList: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  childChip: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    minWidth: 64,
  },
  childChipSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    borderColor: colors.white,
  },
  chipAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  chipAvatarSelected: {
    backgroundColor: colors.white,
  },
  chipAvatarText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  chipAvatarTextSelected: {
    color: '#1e40af',
  },
  chipName: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: fontWeight.medium,
    maxWidth: 60,
    textAlign: 'center',
  },
  chipNameSelected: {
    color: colors.white,
    fontWeight: fontWeight.bold,
  },
  // Module grid
  listContent: {
    paddingHorizontal: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  aiBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  aiBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#166534',
  },
  row: {
    flexDirection: 'row',
  },
  moduleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    margin: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 160,
    ...shadow.sm,
  },
  moduleCardSpacer: {
    flex: 1,
    margin: spacing.xs,
  },
  moduleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  moduleEmoji: {
    fontSize: 22,
  },
  moduleName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  moduleDescription: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
  moduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  captureTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  captureTypeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
  },
  moduleDuration: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  // Completion tracking
  moduleCardCompleted: {
    borderColor: '#16a34a',
    borderWidth: 2,
  },
  completedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 1,
  },
  completedCheckmark: {
    fontSize: 16,
  },
  // Progress header
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eff6ff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
  },
  progressText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  progressBarTrack: {
    width: 100,
    height: 6,
    backgroundColor: '#dbeafe',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  // Readiness modal
  readinessOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  readinessModal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadow.lg,
  },
  readinessDismiss: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  readinessDismissText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  // Action buttons row
  actionButtonsRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  quickVitalsButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.md,
  },
  quickVitalsEmoji: {
    fontSize: 22,
  },
  quickVitalsText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  quickVitalsHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.xs,
    marginTop: 1,
  },
  batchButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  batchButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
})
