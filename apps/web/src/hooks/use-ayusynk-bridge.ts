
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  stethBridge,
  type StethDevice,
  type StethReport,
  type StethFilter,
  type BridgeEvent,
} from '@/lib/stethoscope-bridge'
import type { AyuSynkDiagnosisReport, AyuSynkReportData, HeartLocation } from '@/lib/ayusynk/types'

/**
 * React hook wrapping the AyuSynk WebSocket bridge.
 *
 * When the SKIDS PWA runs inside the Bridge APK (TWA), this hook
 * provides real-time BLE stethoscope control:
 *   scan → connect → record → AI report
 *
 * When running in a normal browser, `bridgeAvailable` is false
 * and all methods are safe no-ops.
 */

export interface BridgeState {
  /** True if the WebSocket bridge is reachable (running inside the APK) */
  bridgeAvailable: boolean
  /** True if a BLE stethoscope is connected */
  deviceConnected: boolean
  /** Name of the connected device */
  deviceName: string | null
  /** BLE devices found during scan */
  foundDevices: StethDevice[]
  /** Currently scanning for devices */
  isScanning: boolean
  /** Currently recording audio */
  isRecording: boolean
  /** Recording location (e.g., "aortic") */
  recordingLocation: string | null
  /** Audio samples from stethoscope (for waveform visualization) */
  audioSamples: number[]
  /** Filtered audio samples (after HEART/LUNG filter) */
  filteredSamples: number[]
  /** Current audio filter */
  currentFilter: StethFilter
  /** Latest AI diagnosis report */
  lastReport: StethReport | null
  /** Last error message */
  lastError: string | null
  /** True while waiting for AI report */
  isGeneratingReport: boolean
}

const INITIAL_STATE: BridgeState = {
  bridgeAvailable: false,
  deviceConnected: false,
  deviceName: null,
  foundDevices: [],
  isScanning: false,
  isRecording: false,
  recordingLocation: null,
  audioSamples: [],
  filteredSamples: [],
  currentFilter: 'HEART',
  lastReport: null,
  lastError: null,
  isGeneratingReport: false,
}

export function useAyuSynkBridge() {
  const [state, setState] = useState<BridgeState>(INITIAL_STATE)
  const reportWaitingRef = useRef(false)

  // Connect to bridge on mount, disconnect on unmount
  useEffect(() => {
    const unsub = stethBridge.on((event: BridgeEvent) => {
      switch (event.type) {
        case 'bridgeConnected':
          setState(prev => ({ ...prev, bridgeAvailable: true, lastError: null }))
          break

        case 'bridgeDisconnected':
          setState(prev => ({
            ...prev,
            bridgeAvailable: false,
            deviceConnected: false,
            deviceName: null,
            isRecording: false,
            isScanning: false,
          }))
          break

        case 'status':
          setState(prev => ({
            ...prev,
            deviceConnected: event.data.connected,
            deviceName: event.data.deviceName,
          }))
          break

        case 'device':
          setState(prev => {
            // Deduplicate by address
            const exists = prev.foundDevices.some(d => d.address === event.data.address)
            if (exists) return prev
            return { ...prev, foundDevices: [...prev.foundDevices, event.data] }
          })
          break

        case 'audio':
          setState(prev => ({ ...prev, audioSamples: event.data.samples }))
          break

        case 'filteredAudio':
          setState(prev => ({ ...prev, filteredSamples: event.data.samples }))
          break

        case 'recording':
          setState(prev => ({
            ...prev,
            isRecording: event.data.state === 'started',
            recordingLocation: event.data.state === 'started' ? (event.data.location || null) : null,
          }))
          break

        case 'report':
          reportWaitingRef.current = false
          setState(prev => ({
            ...prev,
            lastReport: event.data,
            isGeneratingReport: false,
          }))
          break

        case 'error':
          reportWaitingRef.current = false
          setState(prev => ({
            ...prev,
            lastError: event.data.message,
            isGeneratingReport: false,
          }))
          break
      }
    })

    stethBridge.connect()

    return () => {
      unsub()
      stethBridge.disconnect()
    }
  }, [])

  // ── Commands ──────────────────────────────────────────────────────

  const scan = useCallback(() => {
    setState(prev => ({ ...prev, foundDevices: [], isScanning: true, lastError: null }))
    stethBridge.scan()
    // Auto-stop scanning indicator after 10s
    setTimeout(() => setState(prev => ({ ...prev, isScanning: false })), 10000)
  }, [])

  const connectDevice = useCallback((address: string) => {
    setState(prev => ({ ...prev, lastError: null }))
    stethBridge.connectDevice(address)
  }, [])

  const disconnectDevice = useCallback(() => {
    stethBridge.disconnectDevice()
    setState(prev => ({
      ...prev,
      deviceConnected: false,
      deviceName: null,
      isRecording: false,
    }))
  }, [])

  const startRecording = useCallback((location: string) => {
    setState(prev => ({ ...prev, lastError: null }))
    stethBridge.startRecording(location)
  }, [])

  const stopRecording = useCallback(() => {
    stethBridge.stopRecording()
  }, [])

  const changeFilter = useCallback((filter: StethFilter) => {
    stethBridge.changeFilter(filter)
    setState(prev => ({ ...prev, currentFilter: filter }))
  }, [])

  const generateReport = useCallback(() => {
    reportWaitingRef.current = true
    setState(prev => ({ ...prev, isGeneratingReport: true, lastError: null }))
    stethBridge.generateReport()
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, lastError: null }))
  }, [])

  // ── Report Conversion ─────────────────────────────────────────────

  /** Convert a StethReport from the bridge into an AyuSynkDiagnosisReport for SKIDS */
  const toSkidsReport = useCallback((report: StethReport, location?: string): AyuSynkDiagnosisReport => {
    const reportData: AyuSynkReportData = {
      positionName: location || 'Unknown',
      reportUrl: '',
      conditionDetected: report.condition,
      conditionConfidence: parseFloat(report.confidence) || 0,
    }

    return {
      id: `bridge-${Date.now()}`,
      importedAt: new Date().toISOString(),
      source: 'manual', // Closest existing source type
      reports: [reportData],
      notes: `BPM: ${report.bpm} | Condition: ${report.condition} (${Math.round(parseFloat(report.confidence) * 100)}% confidence)`,
    }
  }, [])

  return {
    state,
    scan,
    connectDevice,
    disconnectDevice,
    startRecording,
    stopRecording,
    changeFilter,
    generateReport,
    clearError,
    toSkidsReport,
  }
}
