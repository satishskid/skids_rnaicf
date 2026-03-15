// Campaigns screen (Home tab) — list of campaigns the nurse is part of
// Card-based layout with status badges, pull-to-refresh, logged-in user greeting

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'
import { useAuth } from '../lib/AuthContext'
import { apiCall } from '../lib/api'
import type { Campaign } from '../lib/types'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

type RootStackParamList = {
  Campaigns: undefined
  CampaignDetail: { campaign: Campaign }
}

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Campaigns'>
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#dcfce7', text: '#166534' },
  completed: { bg: '#dbeafe', text: '#1e40af' },
  archived: { bg: '#f1f5f9', text: '#475569' },
  paused: { bg: '#fef3c7', text: '#92400e' },
}

export function CampaignsScreen({ navigation }: Props) {
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filter campaigns by search query
  const filteredCampaigns = useMemo(() => {
    if (!searchQuery.trim()) return campaigns
    const q = searchQuery.toLowerCase()
    return campaigns.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.schoolName?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    )
  }, [campaigns, searchQuery])

  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await apiCall<{ campaigns?: Campaign[]; data?: Campaign[] }>(
        '/api/campaigns',
        { token: token || undefined }
      )
      const list = data.campaigns || data.data || (Array.isArray(data) ? data : [])
      setCampaigns(list as Campaign[])
    } catch (err) {
      console.warn('Failed to fetch campaigns:', err)
      setCampaigns([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchCampaigns()
  }, [fetchCampaigns])

  const getStatusStyle = (status: string) =>
    STATUS_COLORS[status] || STATUS_COLORS.active

  const getLocationText = (campaign: Campaign): string => {
    if (campaign.location && typeof campaign.location === 'object') {
      const loc = campaign.location
      const parts = [loc.city, loc.state, loc.country].filter(Boolean)
      if (parts.length > 0) return parts.join(', ')
    }
    if (campaign.city) return campaign.city
    return campaign.schoolName || 'No location'
  }

  const renderCampaignCard = ({ item }: { item: Campaign }) => {
    const statusStyle = getStatusStyle(item.status)
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CampaignDetail', { campaign: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>

          <Text style={styles.cardCode}>Code: {item.code}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardInfoRow}>
            <Text style={styles.cardInfoIcon}>{'📍'}</Text>
            <Text style={styles.cardInfoText} numberOfLines={1}>
              {getLocationText(item)}
            </Text>
          </View>

          <View style={styles.cardInfoRow}>
            <Text style={styles.cardInfoIcon}>{'🏫'}</Text>
            <Text style={styles.cardInfoText} numberOfLines={1}>
              {item.schoolName || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.childCount}>
            <Text style={styles.childCountNumber}>{item.totalChildren || 0}</Text>
            <Text style={styles.childCountLabel}>Children</Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading campaigns...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            <Text style={styles.brandBold}>SKIDS</Text>
            <Text style={styles.brandLight}> screen</Text>
          </Text>
          <Text style={styles.headerSubtitle}>
            {user ? `Welcome, ${user.name.split(' ')[0]}` : 'Your Campaigns'}
          </Text>
        </View>
        <View style={styles.userPill}>
          <View style={styles.userAvatarSmall}>
            <Text style={styles.userAvatarSmallText}>
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.userPillName} numberOfLines={1}>
              {user?.name || 'Unknown'}
            </Text>
            <Text style={styles.userPillRole}>
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ') : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      {campaigns.length > 0 && (
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>{'🔍'}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search campaigns by name, code, school..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && (
            <Text style={styles.searchResultCount}>
              {filteredCampaigns.length} of {campaigns.length} campaigns
            </Text>
          )}
        </View>
      )}

      {/* Campaign List */}
      <FlatList
        data={filteredCampaigns}
        keyExtractor={(item) => item.code}
        renderItem={renderCampaignCard}
        contentContainerStyle={[
          styles.listContent,
          filteredCampaigns.length === 0 && styles.emptyContainer,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'📋'}</Text>
            <Text style={styles.emptyTitle}>No campaigns yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first campaign to start screening children
            </Text>
          </View>
        }
      />

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.textSecondary,
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
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    maxWidth: 160,
  },
  userAvatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarSmallText: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  userPillName: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    maxWidth: 100,
  },
  userPillRole: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: fontWeight.medium,
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    paddingVertical: 10,
  },
  searchClear: {
    padding: spacing.xs,
  },
  searchClearText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  searchResultCount: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardHeader: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  cardCode: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardInfoIcon: {
    fontSize: fontSize.base,
    marginRight: spacing.sm,
    width: 20,
  },
  cardInfoText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: '#fafbfc',
  },
  childCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  childCountNumber: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  childCountLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    fontWeight: fontWeight.bold,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
})
