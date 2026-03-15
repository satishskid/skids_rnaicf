// Campaign detail — shows campaign info, stats, registered children
// Entry point for registering new children and starting screenings

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TextInput,
  Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import { useAuth } from '../lib/AuthContext'
import { apiCall } from '../lib/api'
import { ReadinessCheck } from '../components/ReadinessCheck'
import { CameraView, useCameraPermissions } from 'expo-camera'
import type { Campaign, Child } from '../lib/types'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

type RootStackParamList = {
  CampaignDetail: { campaign: Campaign }
  RegisterChild: { campaignCode: string }
  Screening: { campaignCode: string }
  ObservationList: { campaignCode: string; campaignName: string }
}

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CampaignDetail'>
  route: RouteProp<RootStackParamList, 'CampaignDetail'>
}

interface CampaignStats {
  childrenCount: number
  observationsCount: number
  reviewsCount: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#dcfce7', text: '#166534' },
  completed: { bg: '#dbeafe', text: '#1e40af' },
  archived: { bg: '#f1f5f9', text: '#475569' },
  paused: { bg: '#fef3c7', text: '#92400e' },
}

export function CampaignDetailScreen({ navigation, route }: Props) {
  const { campaign } = route.params
  const { token } = useAuth()
  const insets = useSafeAreaInsets()

  const [stats, setStats] = useState<CampaignStats>({
    childrenCount: campaign.totalChildren || 0,
    observationsCount: 0,
    reviewsCount: 0,
  })
  const [children, setChildren] = useState<Child[]>([])
  const [childModuleMap, setChildModuleMap] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [childSearch, setChildSearch] = useState('')
  const [showDeviceReadiness, setShowDeviceReadiness] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  const totalModules = campaign.enabledModules?.length || 27

  // Filter children by search query
  const filteredChildren = useMemo(() => {
    if (!childSearch.trim()) return children
    const q = childSearch.toLowerCase()
    return children.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.admissionNumber && c.admissionNumber.toLowerCase().includes(q)) ||
      (c.class && c.class.toLowerCase().includes(q))
    )
  }, [children, childSearch])

  const fetchCampaignData = useCallback(async () => {
    try {
      // Fetch children for this campaign
      const childData = await apiCall<{ children?: Child[]; data?: Child[] }>(
        `/api/campaigns/${campaign.code}/children`,
        { token: token || undefined }
      ).catch(() => ({ children: [] as Child[] } as { children?: Child[]; data?: Child[] }))

      const childList =
        childData.children || childData.data || (Array.isArray(childData) ? childData : [])
      setChildren(childList as Child[])

      // Fetch campaign stats
      const statsData = await apiCall<{
        observations?: number
        reviews?: number
        children?: number
      }>(
        `/api/campaigns/${campaign.code}/stats`,
        { token: token || undefined }
      ).catch(() => ({ children: 0, observations: 0, reviews: 0 }))

      // Fetch observations for progress tracking
      const obsData = await apiCall<{ observations: Array<{ childId?: string; moduleType: string }> }>(
        `/api/observations?campaign=${campaign.code}`,
        { token: token || undefined }
      ).catch(() => ({ observations: [] as Array<{ childId?: string; moduleType: string }> }))

      const moduleMap: Record<string, Set<string>> = {}
      for (const obs of obsData.observations) {
        if (!obs.childId) continue
        if (!moduleMap[obs.childId]) moduleMap[obs.childId] = new Set()
        moduleMap[obs.childId].add(obs.moduleType)
      }
      setChildModuleMap(moduleMap)

      setStats({
        childrenCount: statsData.children || (childList as Child[]).length || campaign.totalChildren || 0,
        observationsCount: statsData.observations || obsData.observations.length || 0,
        reviewsCount: statsData.reviews || 0,
      })
    } catch {
      // Keep defaults
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [campaign.code, campaign.totalChildren, token])

  useEffect(() => {
    fetchCampaignData()
  }, [fetchCampaignData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchCampaignData()
  }, [fetchCampaignData])

  const statusStyle = STATUS_COLORS[campaign.status] || STATUS_COLORS.active

  const getLocationText = (): string => {
    if (campaign.location && typeof campaign.location === 'object') {
      const loc = campaign.location
      const parts = [loc.city, loc.state, loc.country].filter(Boolean)
      if (parts.length > 0) return parts.join(', ')
    }
    if (campaign.city) return campaign.city
    return campaign.schoolName || 'Not specified'
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        {/* Campaign Info Header */}
        <View style={styles.infoHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.campaignName}>{campaign.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Code</Text>
              <Text style={styles.metaValue}>{campaign.code}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>School</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {campaign.schoolName || 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Location</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {getLocationText()}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Year</Text>
              <Text style={styles.metaValue}>{campaign.academicYear || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>
              {stats.childrenCount}
            </Text>
            <Text style={styles.statLabel}>Children{'\n'}Registered</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.secondary }]}>
              {stats.observationsCount}
            </Text>
            <Text style={styles.statLabel}>Observations{'\n'}Done</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: colors.success }]}>
              {stats.reviewsCount}
            </Text>
            <Text style={styles.statLabel}>Reviews{'\n'}Completed</Text>
          </View>
        </View>

        {/* Screening Progress */}
        {children.length > 0 && (
          <View style={styles.progressSummary}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Screening Progress</Text>
              <Text style={styles.progressPercent}>
                {children.length > 0
                  ? Math.round(
                      (Object.keys(childModuleMap).filter(
                        (cid) => (childModuleMap[cid]?.size || 0) >= totalModules
                      ).length / children.length) * 100
                    )
                  : 0}% complete
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${
                      children.length > 0
                        ? Math.round(
                            (Object.keys(childModuleMap).filter(
                              (cid) => (childModuleMap[cid]?.size || 0) >= totalModules
                            ).length / children.length) * 100
                          )
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressSubtext}>
              {Object.keys(childModuleMap).filter(
                (cid) => (childModuleMap[cid]?.size || 0) >= totalModules
              ).length} of {children.length} children fully screened
            </Text>
          </View>
        )}

        {/* Search Children + QR Scanner — always visible, BEFORE actions */}
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={[styles.searchBar, { flex: 1 }]}>
              <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Find child by name, class, or admission #"
                placeholderTextColor={colors.textMuted}
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
            </View>
            <TouchableOpacity
              style={styles.qrButton}
              onPress={async () => {
                if (!cameraPermission?.granted) {
                  const result = await requestCameraPermission()
                  if (!result.granted) return
                }
                setShowQRScanner(true)
              }}
            >
              <Text style={styles.qrButtonText}>{'\u{1F4F7}'} QR</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.searchResultCount}>
            {childSearch
              ? `${filteredChildren.length} of ${children.length} children`
              : `${children.length} children registered`}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate('RegisterChild', { campaignCode: campaign.code })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>{'+'}</Text>
            <Text style={styles.actionText}>Register Child</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() =>
              navigation.navigate('Screening', { campaignCode: campaign.code })
            }
            activeOpacity={0.8}
          >
            <Text style={[styles.actionIcon, { color: colors.white }]}>{'\u{25B6}'}</Text>
            <Text style={[styles.actionText, { color: colors.white }]}>
              Start Screening
            </Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Actions Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.secondary }]}
            onPress={() =>
              navigation.navigate('ObservationList', {
                campaignCode: campaign.code,
                campaignName: campaign.name,
              })
            }
            activeOpacity={0.8}
          >
            <Text style={[styles.actionIcon, { color: colors.secondary }]}>{'\u{1F4CB}'}</Text>
            <Text style={[styles.actionText, { color: colors.secondary }]}>
              Screening Results
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { borderColor: '#7c3aed' }]}
            onPress={() => setShowDeviceReadiness(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionIcon, { color: '#7c3aed' }]}>{'\u{2699}\u{FE0F}'}</Text>
            <Text style={[styles.actionText, { color: '#7c3aed' }]}>
              Device Check
            </Text>
          </TouchableOpacity>
        </View>

        {/* Children List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {childSearch ? `Search Results (${filteredChildren.length})` : `Registered Children (${children.length})`}
          </Text>

          {loading ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : children.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>
                No children registered yet. Tap "Register Child" to add the first one.
              </Text>
            </View>
          ) : filteredChildren.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>
                No children match "{childSearch}". Try a different search.
              </Text>
            </View>
          ) : (
            filteredChildren.slice(0, 50).map((child) => {
              const completedModules = childModuleMap[child.id]?.size || 0
              const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0
              const progressColor = progressPct >= 100 ? colors.success : progressPct > 0 ? colors.primary : colors.textMuted
              const statusLabel = progressPct >= 100 ? 'Complete' : progressPct > 0 ? 'In Progress' : 'Not Started'
              const statusBg = progressPct >= 100 ? '#dcfce7' : progressPct > 0 ? '#dbeafe' : '#f1f5f9'
              const statusTextColor = progressPct >= 100 ? '#166534' : progressPct > 0 ? '#1e40af' : '#475569'

              return (
                <TouchableOpacity
                  key={child.id}
                  style={styles.childCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('Screening', {
                      campaignCode: campaign.code,
                      childId: child.id,
                      childName: child.name,
                    } as any)
                  }
                >
                  <View style={styles.childRow}>
                    <View style={styles.childAvatar}>
                      <Text style={styles.childAvatarText}>
                        {child.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.childInfo}>
                      <View style={styles.childNameRow}>
                        <Text style={styles.childName}>{child.name}</Text>
                        <View style={[styles.childStatusBadge, { backgroundColor: statusBg }]}>
                          <Text style={[styles.childStatusText, { color: statusTextColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.childMeta}>
                        {child.gender === 'male' ? 'M' : 'F'}
                        {child.dob ? ` | DOB: ${child.dob}` : ''}
                        {child.class ? ` | Class ${child.class}` : ''}
                        {' | '}{completedModules}/{totalModules} screened
                      </Text>
                    </View>
                    <Text style={{ fontSize: 16, color: colors.textMuted, marginLeft: 4 }}>{'\u{25B6}'}</Text>
                  </View>
                  <View style={styles.childProgressTrack}>
                    <View
                      style={[
                        styles.childProgressFill,
                        { width: `${progressPct}%`, backgroundColor: progressColor },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              )
            })
          )}
        </View>
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal visible={showQRScanner} transparent animationType="slide">
        <View style={styles.readinessOverlay}>
          <View style={[styles.readinessModal, { height: 500 }]}>
            <Text style={styles.readinessTitle}>{'\u{1F4F7}'} Scan Child QR Code</Text>
            <Text style={styles.readinessSubtitle}>Point camera at the child's QR code to find them</Text>
            {cameraPermission?.granted ? (
              <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', marginVertical: 12 }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr', 'code128', 'code39', 'ean13'],
                  }}
                  onBarcodeScanned={({ data }) => {
                    setShowQRScanner(false)
                    // Try to match scanned data to a child (by ID, admission number, or name)
                    const scannedLower = data.toLowerCase()
                    const match = children.find(c =>
                      c.id === data ||
                      c.admissionNumber === data ||
                      c.name.toLowerCase() === scannedLower
                    )
                    if (match) {
                      setChildSearch(match.name)
                    } else {
                      // Try partial match
                      setChildSearch(data)
                    }
                  }}
                />
              </View>
            ) : (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>
                Camera permission required for QR scanning
              </Text>
            )}
            <TouchableOpacity
              style={styles.readinessDismiss}
              onPress={() => setShowQRScanner(false)}
            >
              <Text style={styles.readinessDismissText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Device Readiness Modal */}
      <Modal visible={showDeviceReadiness} transparent animationType="slide">
        <View style={styles.readinessOverlay}>
          <View style={styles.readinessModal}>
            <Text style={styles.readinessTitle}>Device & System Check</Text>
            <Text style={styles.readinessSubtitle}>
              Verify connected devices, AI engine, and calibration status
            </Text>
            <ReadinessCheck showContinueButton onReady={() => setShowDeviceReadiness(false)} />
            <TouchableOpacity
              style={styles.readinessDismiss}
              onPress={() => setShowDeviceReadiness(false)}
            >
              <Text style={styles.readinessDismissText}>Close</Text>
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
  infoHeader: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  campaignName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    ...shadow.sm,
  },
  statNumber: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    gap: spacing.sm,
    ...shadow.sm,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionIcon: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  actionText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  loadingSection: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptySection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  childCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  childAvatarText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  childNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  childStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  childStatusText: {
    fontSize: fontSize.xs - 1,
    fontWeight: fontWeight.bold,
  },
  childMeta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  childProgressTrack: {
    height: 3,
    backgroundColor: colors.borderLight,
  },
  childProgressFill: {
    height: 3,
  },
  progressSummary: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    ...shadow.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  progressPercent: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  // Search bar + QR
  searchSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    ...shadow.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    paddingVertical: 10,
  },
  searchClear: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchClearText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  searchResultCount: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  // Device Readiness Modal
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
    maxHeight: '80%',
    ...shadow.lg,
  },
  readinessTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  readinessSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
})
