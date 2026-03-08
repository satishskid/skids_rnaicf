// Home screen — nurse's main view
import React from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native'
import { MODULE_CONFIGS } from '@skids/shared'

export function HomeScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>
          <Text style={styles.brandBold}>SKIDS</Text>
          <Text style={styles.brandLight}> screen</Text>
        </Text>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>v3.0</Text>
        </View>
      </View>

      {/* Campaign info */}
      <View style={styles.campaignBar}>
        <Text style={styles.campaignLabel}>No campaign joined</Text>
        <TouchableOpacity style={styles.joinBtn}>
          <Text style={styles.joinBtnText}>Join Campaign</Text>
        </TouchableOpacity>
      </View>

      {/* Module grid */}
      <Text style={styles.sectionTitle}>Screening Modules ({MODULE_CONFIGS.length})</Text>
      <FlatList
        data={MODULE_CONFIGS}
        numColumns={3}
        keyExtractor={(item) => item.type}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.moduleCard}>
            <View style={[styles.moduleIcon, { backgroundColor: getColor(item.color) }]}>
              <Text style={styles.moduleIconText}>{item.name.charAt(0)}</Text>
            </View>
            <Text style={styles.moduleName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.moduleDuration}>{item.duration}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.grid}
      />
    </View>
  )
}

// Convert Tailwind class to hex (simplified)
function getColor(twClass: string): string {
  const map: Record<string, string> = {
    'bg-blue-600': '#2563eb', 'bg-green-600': '#16a34a', 'bg-red-500': '#ef4444',
    'bg-red-600': '#dc2626', 'bg-rose-600': '#e11d48', 'bg-red-700': '#b91c1c',
    'bg-amber-600': '#d97706', 'bg-slate-500': '#64748b', 'bg-cyan-500': '#06b6d4',
    'bg-blue-500': '#3b82f6', 'bg-yellow-500': '#eab308', 'bg-indigo-600': '#4f46e5',
    'bg-lime-500': '#84cc16', 'bg-sky-500': '#0ea5e9', 'bg-rose-500': '#f43f5e',
    'bg-indigo-500': '#6366f1', 'bg-teal-500': '#14b8a6', 'bg-violet-500': '#8b5cf6',
    'bg-orange-500': '#f97316', 'bg-pink-500': '#ec4899', 'bg-emerald-600': '#059669',
    'bg-green-500': '#22c55e', 'bg-fuchsia-500': '#d946ef', 'bg-purple-500': '#a855f7',
    'bg-emerald-500': '#10b981', 'bg-teal-600': '#0d9488',
  }
  return map[twClass] || '#6b7280'
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 14,
    paddingTop: 48,
  },
  brand: { fontSize: 22 },
  brandBold: { fontWeight: '900', color: '#fff' },
  brandLight: { fontWeight: '300', color: 'rgba(255,255,255,0.7)' },
  versionBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 12,
  },
  versionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  campaignBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  campaignLabel: { color: '#64748b', fontSize: 14 },
  joinBtn: {
    backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8,
  },
  joinBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#1e293b',
    marginHorizontal: 16, marginTop: 20, marginBottom: 8,
  },
  grid: { paddingHorizontal: 8 },
  moduleCard: {
    flex: 1, backgroundColor: '#fff', margin: 4, padding: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  moduleIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  moduleIconText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  moduleName: { fontSize: 11, fontWeight: '600', color: '#1e293b', textAlign: 'center' },
  moduleDuration: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
})
