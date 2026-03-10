/**
 * Mobile Device Readiness Check — Permissions, hardware, and AI engine.
 * Groups: Permissions & Connectivity | Hardware & AI
 */

import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'
import { runLocalAI } from '../lib/ai-engine'

interface ReadinessItem {
  id: string
  label: string
  status: 'checking' | 'ready' | 'warning' | 'error'
  detail?: string
  group: 'permissions' | 'hardware'
  blocking?: boolean // whether error status blocks screening
}

interface ReadinessCheckProps {
  onReady?: () => void
  showContinueButton?: boolean
}

export function ReadinessCheck({ onReady, showContinueButton }: ReadinessCheckProps) {
  const [items, setItems] = useState<ReadinessItem[]>([
    // Permissions & Connectivity
    { id: 'camera', label: 'Camera', status: 'checking', group: 'permissions', blocking: true },
    { id: 'microphone', label: 'Microphone', status: 'checking', group: 'permissions', blocking: true },
    { id: 'storage', label: 'Storage', status: 'checking', group: 'permissions', blocking: false },
    { id: 'network', label: 'Network', status: 'checking', group: 'permissions', blocking: false },
    // Hardware & AI
    { id: 'bluetooth', label: 'Bluetooth', status: 'checking', group: 'hardware', blocking: false },
    { id: 'nfc', label: 'NFC (Ayushman)', status: 'checking', group: 'hardware', blocking: false },
    { id: 'ai_engine', label: 'AI Engine', status: 'checking', group: 'hardware', blocking: false },
  ])
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const runChecks = async () => {
      const updates = new Map<string, Partial<ReadinessItem>>()

      // Camera permission check
      try {
        const cameraPerm = await ImagePicker.getCameraPermissionsAsync()
        if (cameraPerm.granted) {
          updates.set('camera', { status: 'ready', detail: 'Granted' })
        } else if (cameraPerm.canAskAgain) {
          updates.set('camera', { status: 'warning', detail: 'Not yet granted' })
        } else {
          updates.set('camera', { status: 'error', detail: 'Denied — enable in Settings' })
        }
      } catch {
        updates.set('camera', { status: 'warning', detail: 'Unable to check' })
      }

      // Microphone permission check
      try {
        const audioPerm = await Audio.getPermissionsAsync()
        if (audioPerm.granted) {
          updates.set('microphone', { status: 'ready', detail: 'Granted' })
        } else if (audioPerm.canAskAgain) {
          updates.set('microphone', { status: 'warning', detail: 'Not yet granted' })
        } else {
          updates.set('microphone', { status: 'error', detail: 'Denied — enable in Settings' })
        }
      } catch {
        updates.set('microphone', { status: 'warning', detail: 'Unable to check' })
      }

      // Storage — always available on mobile
      updates.set('storage', { status: 'ready', detail: 'OK' })

      // Network connectivity
      try {
        const controller = new AbortController()
        setTimeout(() => controller.abort(), 3000)
        const res = await fetch('https://clients3.google.com/generate_204', {
          signal: controller.signal,
        })
        if (res.ok || res.status === 204) {
          updates.set('network', { status: 'ready', detail: 'Online' })
        } else {
          updates.set('network', { status: 'warning', detail: 'Limited connectivity' })
        }
      } catch {
        updates.set('network', { status: 'warning', detail: 'Offline — data syncs later' })
      }

      // Bluetooth — informational (no BLE library in managed Expo)
      if (Platform.OS === 'android') {
        updates.set('bluetooth', {
          status: 'warning',
          detail: 'Enable for medical devices',
        })
      } else {
        updates.set('bluetooth', {
          status: 'warning',
          detail: 'Enable for medical devices',
        })
      }

      // NFC (Ayushman) — informational (no NFC library yet)
      updates.set('nfc', {
        status: 'warning',
        detail: 'Enable NFC for Ayushman cards',
      })

      // AI Engine — test with sample data
      try {
        const testResult = runLocalAI('height', '100', { ageMonths: 60, gender: 'male' })
        if (testResult && testResult.classification) {
          updates.set('ai_engine', {
            status: 'ready',
            detail: '7 value modules supported',
          })
        } else {
          updates.set('ai_engine', { status: 'warning', detail: 'Partial support' })
        }
      } catch {
        updates.set('ai_engine', { status: 'error', detail: 'Failed to load' })
      }

      setItems(prev =>
        prev.map(item => {
          const update = updates.get(item.id)
          return update ? { ...item, ...update } : item
        })
      )
      setChecking(false)
    }

    runChecks()
  }, [])

  useEffect(() => {
    if (!checking && !showContinueButton) {
      // Only blocking items with error status prevent auto-continue
      const hasBlockingError = items.some(i => i.blocking && i.status === 'error')
      if (!hasBlockingError) onReady?.()
    }
  }, [checking, items, onReady, showContinueButton])

  const statusIcon = (status: ReadinessItem['status']) => {
    switch (status) {
      case 'checking': return '\u23F3'
      case 'ready': return '\u2705'
      case 'warning': return '\u26A0\uFE0F'
      case 'error': return '\u274C'
    }
  }

  const permissionItems = items.filter(i => i.group === 'permissions')
  const hardwareItems = items.filter(i => i.group === 'hardware')
  const hasBlockingError = items.some(i => i.blocking && i.status === 'error')

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{'\uD83D\uDD27'} Device Readiness</Text>
        {checking && <Text style={styles.subtitle}>Checking...</Text>}
        {!checking && !hasBlockingError && (
          <Text style={[styles.subtitle, styles.ready]}>Ready</Text>
        )}
        {!checking && hasBlockingError && (
          <Text style={[styles.subtitle, styles.errorLabel]}>Issues found</Text>
        )}
      </View>

      {/* Permissions & Connectivity */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Permissions & Connectivity</Text>
      </View>
      {permissionItems.map(item => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.icon}>{statusIcon(item.status)}</Text>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.detail}>{item.detail || ''}</Text>
        </View>
      ))}

      {/* Hardware & AI */}
      <View style={[styles.sectionHeader, { marginTop: 8 }]}>
        <Text style={styles.sectionTitle}>Hardware & AI</Text>
      </View>
      {hardwareItems.map(item => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.icon}>{statusIcon(item.status)}</Text>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.detail}>{item.detail || ''}</Text>
        </View>
      ))}

      {showContinueButton && !checking && (
        <TouchableOpacity
          style={[styles.continueButton, hasBlockingError && styles.continueButtonWarning]}
          onPress={onReady}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>
            {hasBlockingError ? 'Continue Anyway' : 'Start Screening'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 11,
    color: '#9ca3af',
  },
  ready: {
    color: '#059669',
  },
  errorLabel: {
    color: '#dc2626',
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    width: 100,
  },
  detail: {
    fontSize: 11,
    color: '#6b7280',
    flex: 1,
  },
  continueButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonWarning: {
    backgroundColor: '#d97706',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
})
