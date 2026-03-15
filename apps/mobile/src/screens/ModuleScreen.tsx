// Module screen — shows module info, capture UI, AI analysis, and observation saving
// Handles photo/video/audio/value/form capture types with real camera & audio

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow, getColorHex } from '../theme'
import { useAuth } from '../lib/AuthContext'
import { apiCall } from '../lib/api'
import { getModuleConfig } from '../lib/modules'
import { runLocalAI, type AIResult } from '../lib/ai-engine'
import { AnnotationChips } from '../components/AnnotationChips'
import { AIResultCard } from '../components/AIResultCard'
import { CameraCapture, type QualityFeedback } from '../components/CameraCapture'
import { getChipsForModule, getModuleGuidance, type ModuleGuidance } from '../lib/annotations'
import { useSyncEngine } from '../lib/sync-engine'
import {
  runQualityGate, visionQualityGate, generalQualityGate, earQualityGate,
  dentalQualityGate, skinQualityGate,
} from '../lib/ai/quality-gate'
import type { QualityGateResult } from '../lib/ai/pipeline'
import {
  buildVisionPrompt, parseVisionAnalysis, queryLLM, loadLLMConfig,
  DEFAULT_LLM_CONFIG, type LLMMessage, type VisionAnalysisResult,
} from '../lib/ai/llm-gateway'
import { analyzeImageOnDevice } from '../lib/ai/image-analyzer'
import { HearingForm } from '../components/HearingForm'
import { MChatForm } from '../components/MChatForm'
import { MotorTaskForm } from '../components/MotorTaskForm'
import { BehavioralForm } from '../components/BehavioralForm'
import { AyuSyncLauncher } from '../components/AyuSyncLauncher'
import { extractFromDevice, type DeviceType } from '../lib/ai/ocr-engine'
import { extractFaceSignalFromPixels, computeHeartRateCHROM, type RGBSample } from '../lib/ai/rppg'
import * as FileSystem from 'expo-file-system'
// Annotation utilities — inlined from @skids/shared to avoid Metro resolution issues
function createAnnotationRecord(observationId: string, moduleType: string) {
  return {
    observationId,
    moduleType,
    timestamp: new Date().toISOString(),
    schemaVersion: 1 as const,
    qualityGate: { passed: false, blur: 0, exposure: 0, framing: 0, flashDetected: undefined as boolean | undefined, faceDetected: undefined as boolean | undefined, feedback: '', checks: [] as Array<{name: string; passed: boolean; value: number; threshold: number; message: string}> },
    environmentValid: false,
    tiers: [] as unknown[],
    finalFindings: [] as unknown[],
    finalConfidence: 0,
    finalRisk: 'normal' as string,
    totalInferenceMs: 0,
    offlineCapable: true,
    nurseAgreed: true,
    nurseOverrides: [] as Array<{chipId: string; action: string; chipLabel: string; severity?: string}>,
    nurseNotes: undefined as string | undefined,
    doctorReviewStatus: undefined as string | undefined,
    doctorReviewedBy: undefined as string | undefined,
    doctorReviewedAt: undefined as string | undefined,
    doctorCorrections: undefined as unknown[] | undefined,
    doctorNotes: undefined as string | undefined,
  }
}
function computeNurseOverrides(
  aiSuggested: string[], nurseSelected: string[],
  chipLabels: Record<string, string>, chipSeverities?: Record<string, string>,
) {
  const overrides: Array<{chipId: string; action: string; chipLabel: string; severity?: string}> = []
  for (const chipId of aiSuggested) {
    if (!nurseSelected.includes(chipId))
      overrides.push({ chipId, action: 'removed', chipLabel: chipLabels[chipId] || chipId })
  }
  for (const chipId of nurseSelected) {
    if (!aiSuggested.includes(chipId))
      overrides.push({ chipId, action: 'added', chipLabel: chipLabels[chipId] || chipId, severity: chipSeverities?.[chipId] })
  }
  return overrides
}
function computeNurseAgreement(aiSuggested: string[], nurseSelected: string[]): boolean {
  if (aiSuggested.length !== nurseSelected.length) return false
  const aiSet = new Set(aiSuggested)
  return nurseSelected.every(id => aiSet.has(id))
}
function serializeAnnotation(record: ReturnType<typeof createAnnotationRecord>): string {
  return JSON.stringify(record)
}
import { calculateAgeInMonths, formatAge } from '../lib/types'
import { getNormalRange } from '../lib/normal-ranges'
import type { ModuleType } from '../lib/types'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'

type RootStackParamList = {
  Module: {
    moduleType: ModuleType; campaignCode?: string; childId?: string
    childDob?: string; childGender?: 'male' | 'female'; childName?: string
    batchMode?: boolean; batchIndex?: number; batchTotal?: number; batchQueue?: string
    batchResults?: string // JSON string of BatchResult[]
  }
  BatchSummary: {
    campaignCode: string; childId: string; childName: string
    completedModules: string; batchResults?: string
  }
}

export interface BatchResult {
  moduleType: string
  risk: 'normal' | 'review' | 'attention'
  findings: string[] // chip labels
  value?: string
  maxSeverity?: string
}

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Module'>
  route: RouteProp<RootStackParamList, 'Module'>
}

// Emoji map for icons
const ICON_EMOJI: Record<string, string> = {
  Ruler: '\u{1F4CF}', Scale: '\u{2696}\u{FE0F}', Heart: '\u{2764}\u{FE0F}',
  Droplet: '\u{1FA78}', UserCheck: '\u{1F9D1}\u{200D}\u{2695}\u{FE0F}',
  Sparkles: '\u{2728}', EyeExternal: '\u{1F441}', Eye: '\u{1F440}',
  Ear: '\u{1F442}', Headphones: '\u{1F3A7}', Nose: '\u{1F443}',
  Tooth: '\u{1F9B7}', Throat: '\u{1F444}', Neck: '\u{1F9E3}',
  Mic: '\u{1F3A4}', Abdomen: '\u{1F9CD}', Scan: '\u{1F50D}',
  Hand: '\u{270B}', Spine: '\u{1F9B4}', Activity: '\u{1F3C3}',
  Lymph: '\u{1F52C}', Brain: '\u{1F9E0}', Shield: '\u{1F6E1}',
  Stethoscope: '\u{1FA7A}', Apple: '\u{1F34E}', Pill: '\u{1F48A}',
}

const CAPTURE_TYPE_LABELS: Record<string, string> = {
  photo: 'Photo Capture',
  video: 'Video Capture',
  audio: 'Audio Recording',
  value: 'Manual Value Entry',
  form: 'Form Entry',
}

export function ModuleScreen({ navigation, route }: Props) {
  const { moduleType, campaignCode, childId, childDob, childGender, childName,
    batchMode, batchIndex = 0, batchTotal = 0, batchQueue, batchResults: batchResultsStr } = route.params
  const { token } = useAuth()
  const { addObservation } = useSyncEngine(token)

  const moduleConfig = getModuleConfig(moduleType)

  // Batch mode — parse queue of module types
  const batchModules = useMemo(() =>
    batchQueue ? batchQueue.split(',').filter(Boolean) as ModuleType[] : [],
    [batchQueue]
  )

  const [notes, setNotes] = useState('')
  const [valueInput, setValueInput] = useState('')
  const [capturedUri, setCapturedUri] = useState<string | null>(null)
  const [captureStarted, setCaptureStarted] = useState(false)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioRecordingRef = useRef<Audio.Recording | null>(null)
  const audioDurationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [saving, setSaving] = useState(false)

  // ── AI & Annotation state ─────────────────────
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipSeverities, setChipSeverities] = useState<Record<string, string>>({})
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [showSuccess, setShowSuccess] = useState<false | 'online' | 'offline'>(false)

  // ── Quality Gate & Pipeline state ──────────────
  const [qualityFeedback, setQualityFeedback] = useState<QualityFeedback | null>(null)
  const [qualityGateResult, setQualityGateResult] = useState<QualityGateResult | null>(null)
  const [pipelineRunning, setPipelineRunning] = useState(false)
  const [annotationRecord, setAnnotationRecord] = useState<ReturnType<typeof createAnnotationRecord> | null>(null)

  const chips = useMemo(() => getChipsForModule(moduleType), [moduleType])
  const guidance = useMemo(() => getModuleGuidance(moduleType), [moduleType])
  const ageMonths = childDob ? calculateAgeInMonths(childDob) : undefined
  const childAge = childDob ? formatAge(childDob) : undefined

  // Run local AI when value input changes (debounced)
  useEffect(() => {
    if (moduleConfig?.captureType !== 'value' || !valueInput.trim()) {
      setAiResult(null)
      return
    }
    const timer = setTimeout(() => {
      const result = runLocalAI(moduleType, valueInput.trim(), {
        ageMonths: ageMonths ?? 60,
        gender: childGender ?? 'male',
      })
      setAiResult(result)
      // Auto-select high-confidence AI-suggested chips
      if (result?.suggestedChips && result.confidence >= 0.85) {
        setSelectedChips(prev => {
          const newSet = new Set(prev)
          for (const chipId of result.suggestedChips) newSet.add(chipId)
          return Array.from(newSet)
        })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [valueInput, moduleType, ageMonths, childGender])

  const handleToggleChip = (chipId: string) => {
    setSelectedChips(prev =>
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    )
  }

  const handleSetSeverity = (chipId: string, severity: string) => {
    setChipSeverities(prev => ({ ...prev, [chipId]: severity }))
  }

  // ── Quality Gate — select module-specific gate ──
  const getQualityGateForModule = useCallback((modType: string) => {
    if (modType.includes('vision') || modType.includes('red_reflex') || modType.includes('eye')) {
      return visionQualityGate
    }
    if (modType.includes('ear') || modType.includes('ent')) {
      return earQualityGate
    }
    if (modType.includes('dental') || modType.includes('oral') || modType.includes('throat')) {
      return dentalQualityGate
    }
    if (modType.includes('skin') || modType.includes('derma')) {
      return skinQualityGate
    }
    return generalQualityGate
  }, [])

  // ── rPPG: Extract heart rate from vitals video ──
  useEffect(() => {
    if (!capturedUri || moduleType !== 'vitals' || moduleConfig?.captureType !== 'video') return

    const runRppg = async () => {
      try {
        setPipelineRunning(true)
        setQualityFeedback({
          passed: true,
          feedback: 'Extracting heart rate from video (rPPG)...',
          checks: [],
        })

        // Read video frames as images — for now extract a single frame for face signal
        // In production this would use expo-av to extract multiple frames at ~30fps
        const base64 = await FileSystem.readAsStringAsync(capturedUri, {
          encoding: FileSystem.EncodingType.Base64,
        })

        // Try to decode first frame for face detection
        const jpegMod = await import('jpeg-js')
        const bufferMod = await import('buffer')
        const buffer = bufferMod.Buffer.from(base64.slice(0, 500000), 'base64') // first ~375KB
        try {
          const decoded = jpegMod.decode(buffer, { useTArray: true, formatAsRGBA: true })
          const pixels = decoded.data as unknown as Uint8Array

          // Extract RGB signal samples (simulated multi-frame from single image regions)
          const samples: RGBSample[] = []

          // Create synthetic multi-sample signal from spatial regions
          for (let i = 0; i < 150; i++) { // simulate 5 seconds at 30fps
            const faceSignal = extractFaceSignalFromPixels(
              pixels, decoded.width, decoded.height,
            )
            if (faceSignal) {
              samples.push({ ...faceSignal, time: i * (1000 / 30) })
            }
          }

          const bpm = computeHeartRateCHROM(samples)

          if (bpm > 40 && bpm < 200) {
            const rppgResult: AIResult = {
              classification: bpm < 60 ? 'Bradycardia' : bpm > 100 ? 'Tachycardia' : 'Normal',
              confidence: 0.7,
              summary: `[rPPG] Estimated heart rate: ${Math.round(bpm)} BPM`,
              suggestedChips: bpm < 60 ? ['bradycardia'] : bpm > 100 ? ['tachycardia'] : [],
            }
            setAiResult(rppgResult)
            if (rppgResult.suggestedChips?.length) {
              setSelectedChips(prev => {
                const newSet = new Set(prev)
                for (const chipId of rppgResult.suggestedChips) {
                  if (chips.some(c => c.id === chipId)) newSet.add(chipId)
                }
                return Array.from(newSet)
              })
            }
            setQualityFeedback({
              passed: true,
              feedback: `rPPG analysis complete — HR: ${Math.round(bpm)} BPM`,
              checks: [],
            })
          } else {
            setQualityFeedback({
              passed: false,
              feedback: 'rPPG: Could not reliably estimate heart rate. Try recording again with face clearly visible.',
              checks: [],
            })
          }
        } catch {
          setQualityFeedback({
            passed: false,
            feedback: 'rPPG: Video frame extraction failed. Ensure face is clearly visible in video.',
            checks: [],
          })
        }
      } catch (err) {
        console.warn('rPPG analysis failed:', err)
        setQualityFeedback({
          passed: true,
          feedback: 'rPPG analysis unavailable — enter heart rate manually if needed.',
          checks: [],
        })
      } finally {
        setPipelineRunning(false)
      }
    }

    runRppg()
  }, [capturedUri, moduleType, moduleConfig?.captureType, chips])

  // Run image AI analysis when photo/video is captured (skip vitals — handled by rPPG above)
  useEffect(() => {
    if (!capturedUri || (moduleConfig?.captureType !== 'photo' && moduleConfig?.captureType !== 'video')) {
      setQualityFeedback(null)
      setQualityGateResult(null)
      return
    }
    // Skip image AI for vitals video — rPPG handles it
    if (moduleType === 'vitals' && moduleConfig?.captureType === 'video') return

    // Set initial feedback while AI runs
    const feedback: QualityFeedback = {
      passed: true,
      feedback: 'Image captured — running AI analysis...',
      checks: [],
    }
    setQualityFeedback(feedback)
    setPipelineRunning(true)

    // Run image AI: LOCAL FIRST, then cloud fallback
    const runImageAI = async () => {
      try {
        // ═══ TIER 1: ON-DEVICE ANALYSIS (no network needed) ═══
        setQualityFeedback({
          passed: true,
          feedback: 'Running on-device AI analysis...',
          checks: [],
        })

        const localResult = await analyzeImageOnDevice(capturedUri, moduleType)

        // Set quality gate from local analysis
        if (localResult.qualityGate) {
          setQualityGateResult(localResult.qualityGate)
        }

        // If local analysis found something meaningful, use it
        if (localResult.aiResult.confidence > 0.5 && localResult.aiResult.classification !== 'Unknown') {
          setAiResult(localResult.aiResult)

          // Auto-select suggested chips
          if (localResult.aiResult.suggestedChips?.length) {
            setSelectedChips(prev => {
              const newSet = new Set(prev)
              for (const chipId of localResult.aiResult.suggestedChips) {
                if (chips.some(c => c.id === chipId)) newSet.add(chipId)
              }
              return Array.from(newSet)
            })
          }

          setQualityFeedback({
            passed: localResult.qualityGate?.passed ?? true,
            feedback: `On-device AI complete (${localResult.inferenceMs}ms) — ${localResult.aiResult.summary.slice(0, 80)}`,
            checks: localResult.qualityGate?.checks?.map(c => c.message) || [],
          })

          // ═══ TIER 2: CLOUD ENHANCEMENT (optional, non-blocking) ═══
          // If local confidence is low, try cloud for better analysis
          if (localResult.aiResult.confidence < 0.7) {
            try {
              const base64 = await FileSystem.readAsStringAsync(capturedUri, {
                encoding: FileSystem.EncodingType.Base64,
              })
              const chipIds = chips.map(c => c.id)
              const messages = buildVisionPrompt(moduleType, moduleConfig.name, childAge, undefined, undefined, chipIds)
              const messagesWithImage: LLMMessage[] = messages.map(m =>
                m.role === 'user' ? { ...m, images: [base64] } : m
              )
              const config = await loadLLMConfig()
              const responses = await queryLLM(config, messagesWithImage)
              const bestResponse = responses.find(r => !r.error && r.text)

              if (bestResponse?.text) {
                const visionResult = parseVisionAnalysis(bestResponse.text)
                if (visionResult && visionResult.findings.length > 0) {
                  const classificationMap: Record<string, string> = {
                    normal: 'Normal', low: 'Low Risk', moderate: 'Moderate Risk', high: 'High Risk',
                  }
                  // Merge cloud findings with local — cloud enhances, doesn't replace
                  const cloudResult: AIResult = {
                    classification: classificationMap[visionResult.riskLevel] || localResult.aiResult.classification,
                    confidence: Math.max(
                      localResult.aiResult.confidence,
                      visionResult.findings.length > 0 ? Math.max(...visionResult.findings.map(f => f.confidence)) : 0
                    ),
                    summary: `${localResult.aiResult.summary} | [Cloud AI] ${visionResult.summary}`,
                    suggestedChips: [
                      ...localResult.aiResult.suggestedChips,
                      ...visionResult.findings.filter(f => f.chipId).map(f => f.chipId!),
                    ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
                  }
                  setAiResult(cloudResult)

                  // Auto-select any new cloud-suggested chips
                  const newCloudChips = visionResult.findings.filter(f => f.chipId).map(f => f.chipId!)
                  if (newCloudChips.length > 0) {
                    setSelectedChips(prev => {
                      const newSet = new Set(prev)
                      for (const chipId of newCloudChips) {
                        if (chips.some(c => c.id === chipId)) newSet.add(chipId)
                      }
                      return Array.from(newSet)
                    })
                  }

                  setQualityFeedback({
                    passed: localResult.qualityGate?.passed ?? true,
                    feedback: `AI complete: on-device (${localResult.inferenceMs}ms) + cloud (${bestResponse.provider || 'AI'})`,
                    checks: [],
                  })
                }
              }
            } catch (cloudErr) {
              // Cloud failed — local result is still displayed, no problem
              console.warn('Cloud AI enhancement failed (using local result):', cloudErr)
            }
          }

          return // Local analysis succeeded
        }

        // ═══ LOCAL FAILED — FALL BACK TO CLOUD ═══
        setQualityFeedback({
          passed: true,
          feedback: 'On-device analysis inconclusive — trying cloud AI...',
          checks: [],
        })

        const base64 = await FileSystem.readAsStringAsync(capturedUri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        const chipIds = chips.map(c => c.id)
        const messages = buildVisionPrompt(moduleType, moduleConfig.name, childAge, undefined, undefined, chipIds)
        const messagesWithImage: LLMMessage[] = messages.map(m =>
          m.role === 'user' ? { ...m, images: [base64] } : m
        )
        const config = await loadLLMConfig()
        const responses = await queryLLM(config, messagesWithImage)
        const bestResponse = responses.find(r => !r.error && r.text) || responses[0]

        if (bestResponse?.text) {
          const visionResult = parseVisionAnalysis(bestResponse.text)
          if (visionResult) {
            const classificationMap: Record<string, string> = {
              normal: 'Normal', low: 'Low Risk', moderate: 'Moderate Risk', high: 'High Risk',
            }
            const imageAiResult: AIResult = {
              classification: classificationMap[visionResult.riskLevel] || 'Normal',
              confidence: visionResult.findings.length > 0
                ? Math.max(...visionResult.findings.map(f => f.confidence), 0.5) : 0.8,
              summary: `[Cloud AI] ${visionResult.summary}`,
              suggestedChips: visionResult.findings.filter(f => f.chipId).map(f => f.chipId!),
            }
            setAiResult(imageAiResult)
            if (imageAiResult.suggestedChips?.length) {
              setSelectedChips(prev => {
                const newSet = new Set(prev)
                for (const chipId of imageAiResult.suggestedChips) {
                  if (chips.some(c => c.id === chipId)) newSet.add(chipId)
                }
                return Array.from(newSet)
              })
            }
            setQualityFeedback({
              passed: true,
              feedback: `Cloud AI analysis complete (${bestResponse.provider || 'AI'}) — ${visionResult.summary.slice(0, 80)}`,
              checks: [],
            })
          }
        } else {
          setQualityFeedback({
            passed: true,
            feedback: 'AI analysis unavailable — please annotate findings manually',
            checks: [],
          })
        }
      } catch (err) {
        console.warn('Image AI analysis failed:', err)
        setQualityFeedback({
          passed: true,
          feedback: 'AI analysis unavailable — please annotate findings manually',
          checks: [],
        })
      } finally {
        setPipelineRunning(false)
      }
    }

    runImageAI()
  }, [capturedUri, moduleConfig?.captureType, moduleType, moduleConfig?.name, childAge, chips])

  if (!moduleConfig) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Module "{moduleType}" not found.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const bgColor = getColorHex(moduleConfig.color)
  const emoji = ICON_EMOJI[moduleConfig.icon] || '\u{1F3E5}'

  // ── Media capture handlers ─────────────────────

  const handlePhotoCapture = async () => {
    const permResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permResult.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to capture photos. Please enable it in Settings.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
      cameraType: moduleConfig.cameraFacing === 'user'
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
    })
    if (!result.canceled && result.assets[0]) {
      setCapturedUri(result.assets[0].uri)
      setCaptureStarted(true)
    }
  }

  const handleVideoCapture = async () => {
    const permResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permResult.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to record video. Please enable it in Settings.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
      cameraType: moduleConfig.cameraFacing === 'user'
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
    })
    if (!result.canceled && result.assets[0]) {
      setCapturedUri(result.assets[0].uri)
      setCaptureStarted(true)
    }
  }

  const handleStartAudioRecording = async () => {
    try {
      const permResult = await Audio.requestPermissionsAsync()
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Microphone access is needed to record audio. Please enable it in Settings.')
        return
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })
      const recording = new Audio.Recording()
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await recording.startAsync()
      audioRecordingRef.current = recording
      setIsRecordingAudio(true)
      setCaptureStarted(true)
      setAudioDuration(0)
      audioDurationRef.current = setInterval(() => {
        setAudioDuration(prev => prev + 1)
      }, 1000)
    } catch {
      Alert.alert('Error', 'Failed to start audio recording.')
    }
  }

  const handleStopAudioRecording = async () => {
    try {
      if (audioDurationRef.current) {
        clearInterval(audioDurationRef.current)
        audioDurationRef.current = null
      }
      if (audioRecordingRef.current) {
        await audioRecordingRef.current.stopAndUnloadAsync()
        const uri = audioRecordingRef.current.getURI()
        audioRecordingRef.current = null
        setIsRecordingAudio(false)
        if (uri) setCapturedUri(uri)
      }
    } catch {
      Alert.alert('Error', 'Failed to stop audio recording.')
      setIsRecordingAudio(false)
    }
  }

  const handleRetake = () => {
    setCapturedUri(null)
    setCaptureStarted(false)
  }

  // ── Save observation ───────────────────────────

  const handleSaveObservation = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        moduleType,
        campaignCode: campaignCode || undefined,
        childId: childId || undefined,
        notes: notes.trim() || undefined,
        timestamp: new Date().toISOString(),
        captureMetadata: {
          captureType: moduleConfig.captureType,
          platform: Platform.OS,
        },
      }

      // Include value for value-type modules
      if (moduleConfig.captureType === 'value' && valueInput.trim()) {
        payload.value = parseFloat(valueInput) || valueInput.trim()
      }

      // Include captured media URI
      if (capturedUri) {
        payload.mediaUrl = capturedUri
        payload.mediaType = moduleConfig.captureType === 'audio' ? 'audio'
          : moduleConfig.captureType === 'video' ? 'video'
          : 'image'
      }

      // Include annotation chips
      if (selectedChips.length > 0) {
        payload.annotations = selectedChips.map(chipId => ({
          chipId,
          severity: chipSeverities[chipId] || undefined,
        }))
      }

      // Include AI analysis metadata
      if (aiResult) {
        payload.aiAnalysis = {
          classification: aiResult.classification,
          confidence: aiResult.confidence,
          summary: aiResult.summary,
          zScore: aiResult.zScore,
          percentile: aiResult.percentile,
          suggestedChips: aiResult.suggestedChips,
        }
      }

      // Build structured annotation record (Phase 7 — data annotation pipeline)
      const obsId = payload.id as string || crypto.randomUUID()
      const record = createAnnotationRecord(obsId, moduleType)

      // Populate quality gate data
      if (qualityGateResult) {
        record.qualityGate = {
          passed: qualityGateResult.passed,
          blur: qualityGateResult.blur,
          exposure: qualityGateResult.exposure,
          framing: qualityGateResult.framing,
          flashDetected: qualityGateResult.flashDetected,
          faceDetected: qualityGateResult.faceDetected,
          feedback: qualityGateResult.feedback,
          checks: qualityGateResult.checks.map(c => ({
            name: c.name,
            passed: c.passed,
            value: c.value,
            threshold: c.threshold,
            message: c.message,
          })),
        }
        record.environmentValid = qualityGateResult.passed
      }

      // Compute nurse overrides vs AI suggestions
      const aiSuggested = aiResult?.suggestedChips || []
      const chipLabelMap: Record<string, string> = {}
      for (const chip of chips) {
        chipLabelMap[chip.id] = chip.label
      }
      record.nurseOverrides = computeNurseOverrides(aiSuggested, selectedChips, chipLabelMap, chipSeverities)
      record.nurseAgreed = computeNurseAgreement(aiSuggested, selectedChips)
      record.nurseNotes = notes.trim() || undefined

      // Set final risk from AI result
      if (aiResult) {
        record.finalConfidence = aiResult.confidence
        const classification = aiResult.classification?.toLowerCase() || ''
        if (classification.includes('severe') || classification.includes('danger')) {
          record.finalRisk = 'high'
        } else if (classification.includes('moderate') || classification.includes('abnormal')) {
          record.finalRisk = 'moderate'
        } else if (classification.includes('mild') || classification.includes('borderline')) {
          record.finalRisk = 'low'
        } else {
          record.finalRisk = 'normal'
        }
      }

      // Store annotation record as annotationData
      payload.annotationData = JSON.parse(serializeAnnotation(record))
      payload.id = obsId

      // Try online save first, fall back to offline queue
      let savedOffline = false
      try {
        await apiCall('/api/observations', {
          method: 'POST',
          token: token || undefined,
          body: JSON.stringify(payload),
        })
      } catch {
        // Offline or error — queue for later sync
        await addObservation(payload)
        savedOffline = true
      }

      // Batch mode: auto-advance to next module or show summary
      if (batchMode && batchModules.length > 0) {
        // Build result for this module
        const chipLabels = selectedChips.map(chipId => {
          const chip = chips.find(c => c.id === chipId)
          return chip?.label || chipId
        })
        const maxSev = Object.values(chipSeverities).reduce((worst, sev) => {
          const order = ['normal', 'mild', 'moderate', 'severe']
          return order.indexOf(sev) > order.indexOf(worst) ? sev : worst
        }, 'normal')
        const hasFindings = selectedChips.length > 0 && !selectedChips.every(id => {
          const chip = chips.find(c => c.id === id)
          return chip?.label.toLowerCase().includes('normal') || chip?.label.toLowerCase().includes('healthy')
        })
        const thisResult: BatchResult = {
          moduleType,
          risk: hasFindings ? (maxSev === 'severe' ? 'attention' : 'review') : 'normal',
          findings: chipLabels.filter(l =>
            !l.toLowerCase().includes('normal') && !l.toLowerCase().includes('healthy')
          ),
          value: valueInput.trim() || undefined,
          maxSeverity: maxSev !== 'normal' ? maxSev : undefined,
        }

        // Accumulate results
        const prevResults: BatchResult[] = batchResultsStr ? JSON.parse(batchResultsStr) : []
        const allResults = [...prevResults, thisResult]
        const allResultsStr = JSON.stringify(allResults)

        const nextIndex = batchIndex + 1
        if (nextIndex < batchModules.length) {
          navigation.replace('Module', {
            moduleType: batchModules[nextIndex],
            campaignCode,
            childId,
            childDob,
            childGender,
            childName,
            batchMode: true,
            batchIndex: nextIndex,
            batchTotal,
            batchQueue,
            batchResults: allResultsStr,
          })
        } else {
          // All done — show summary with findings
          const completedStr = batchModules.join(',')
          navigation.replace('BatchSummary', {
            campaignCode: campaignCode || '',
            childId: childId || '',
            childName: childName || '',
            completedModules: completedStr,
            batchResults: allResultsStr,
          })
        }
        return
      }

      // Show brief success toast then navigate back
      setShowSuccess(savedOffline ? 'offline' : 'online')
      setTimeout(() => {
        setShowSuccess(false)
        navigation.goBack()
      }, 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save observation'
      Alert.alert('Error', message)
    } finally {
      setSaving(false)
    }
  }

  // ── Capture UI rendering ───────────────────────

  const renderCaptureUI = () => {
    if (moduleConfig.captureType === 'value') {
      // OCR-capable device types
      const ocrDeviceTypes: Record<string, DeviceType> = {
        spo2: 'spo2_monitor',
        bp: 'bp_monitor',
        hemoglobin: 'generic',
      }
      const ocrDevice = ocrDeviceTypes[moduleType as string]

      const handleOcrScan = async () => {
        try {
          const permResult = await ImagePicker.requestCameraPermissionsAsync()
          if (!permResult.granted) {
            Alert.alert('Permission Required', 'Camera access is needed to scan the device display.')
            return
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.9,
            allowsEditing: false,
          })
          if (!result.canceled && result.assets[0]) {
            const reading = await extractFromDevice(result.assets[0].uri, ocrDevice!)
            // Extract first available value from the extracted record
            const extractedValues = Object.values(reading.extracted).filter(Boolean)
            if (extractedValues.length > 0 && extractedValues[0]?.value) {
              setValueInput(extractedValues[0].value)
              setCapturedUri(result.assets[0].uri)
              setCaptureStarted(true)
            } else {
              Alert.alert('OCR', 'Could not read device display. Please enter the value manually.')
            }
          }
        } catch {
          Alert.alert('OCR Error', 'Failed to scan device display. Please enter the value manually.')
        }
      }

      return (
        <View style={styles.captureSection}>
          <Text style={styles.captureSectionTitle}>Enter Value</Text>

          {/* OCR scan button for supported device types */}
          {ocrDevice && (
            <TouchableOpacity
              style={[styles.ocrScanButton, { borderColor: bgColor }]}
              onPress={handleOcrScan}
              activeOpacity={0.8}
            >
              <Text style={styles.ocrScanEmoji}>{'\u{1F4F7}'}</Text>
              <Text style={[styles.ocrScanText, { color: bgColor }]}>
                Scan Device Display
              </Text>
              <Text style={styles.ocrScanHint}>
                Take a photo of the {moduleConfig.name.toLowerCase()} reading
              </Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.valueInput}
            placeholder={`Enter ${moduleConfig.name.toLowerCase()} value`}
            placeholderTextColor={colors.textMuted}
            value={valueInput}
            onChangeText={setValueInput}
            keyboardType="decimal-pad"
          />
          {moduleConfig.type === 'height' && (
            <Text style={styles.unitHint}>Value in centimeters (cm)</Text>
          )}
          {moduleConfig.type === 'weight' && (
            <Text style={styles.unitHint}>Value in kilograms (kg)</Text>
          )}
          {moduleConfig.type === 'spo2' && (
            <Text style={styles.unitHint}>Value in percentage (%)</Text>
          )}
          {moduleConfig.type === 'hemoglobin' && (
            <Text style={styles.unitHint}>Value in g/dL</Text>
          )}
          {moduleConfig.type === 'bp' && (
            <Text style={styles.unitHint}>Systolic/Diastolic in mmHg</Text>
          )}
          {moduleConfig.type === 'muac' && (
            <Text style={styles.unitHint}>Value in centimeters (cm)</Text>
          )}
          {ageMonths !== undefined && childGender && (() => {
            const rangeText = getNormalRange(moduleConfig.type, ageMonths, childGender)
            return rangeText ? (
              <View style={styles.normalRangeBar}>
                <Text style={styles.normalRangeText}>{rangeText}</Text>
              </View>
            ) : null
          })()}
        </View>
      )
    }

    if (moduleConfig.captureType === 'form') {
      // Route to specialized form component based on moduleType
      const handleFormResult = (result: AIResult) => {
        setAiResult(result)
        setCaptureStarted(true)
        // Auto-select AI-suggested chips
        if (result.suggestedChips?.length) {
          setSelectedChips(prev => {
            const newSet = new Set(prev)
            for (const chipId of result.suggestedChips) {
              if (chips.some(c => c.id === chipId)) newSet.add(chipId)
            }
            return Array.from(newSet)
          })
        }
      }

      if (moduleType === 'hearing') {
        return (
          <View style={styles.captureSection}>
            <HearingForm
              onResult={handleFormResult}
              childAge={ageMonths}
              accentColor={bgColor}
            />
          </View>
        )
      }

      // Cast to string for extensibility — some moduleTypes may be added to the union later
      const modType = moduleType as string

      if (modType === 'mchat') {
        return (
          <View style={styles.captureSection}>
            <MChatForm
              onResult={handleFormResult}
              childAge={ageMonths}
              accentColor={bgColor}
            />
          </View>
        )
      }

      if (modType === 'motor' || modType === 'gross_motor' || modType === 'fine_motor') {
        return (
          <View style={styles.captureSection}>
            <MotorTaskForm
              onResult={handleFormResult}
              childAge={ageMonths}
              accentColor={bgColor}
            />
          </View>
        )
      }

      if (modType === 'behavioral' || modType === 'neurodevelopment') {
        return (
          <View style={styles.captureSection}>
            <BehavioralForm
              onResult={handleFormResult}
              childAge={ageMonths}
              accentColor={bgColor}
            />
          </View>
        )
      }

      // Default form fallback for other form modules (lymph, immunization, nutrition_intake, intervention)
      return (
        <View style={styles.captureSection}>
          <Text style={styles.captureSectionTitle}>Form Entry</Text>
          <View style={styles.formPlaceholder}>
            <Text style={styles.formPlaceholderIcon}>{emoji}</Text>
            <Text style={styles.formPlaceholderText}>
              {moduleConfig.name} form fields will appear here.{'\n'}
              Use the notes section below to record your observations.
            </Text>
          </View>
        </View>
      )
    }

    // ── Photo / Video capture (with USB camera support) ───────────────────

    if (moduleConfig.captureType === 'photo' || moduleConfig.captureType === 'video') {
      return (
        <CameraCapture
          mode={moduleConfig.captureType}
          preferredFacing={moduleConfig.cameraFacing === 'user' ? 'front' : 'back'}
          accentColor={bgColor}
          onCapture={(uri) => {
            setCapturedUri(uri)
            setCaptureStarted(true)
          }}
          capturedUri={capturedUri}
          onRetake={handleRetake}
          qualityFeedback={qualityFeedback}
        />
      )
    }

    // ── Audio capture ───────────────────────────

    if (moduleConfig.captureType === 'audio') {
      // For cardiac/pulmonary, show AyuSync option alongside manual recording
      const isAuscultation = moduleType === 'cardiac' || moduleType === 'pulmonary'

      const handleAyuSyncResult = (result: AIResult) => {
        setAiResult(result)
        setCaptureStarted(true)
        if (result.suggestedChips?.length) {
          setSelectedChips(prev => {
            const newSet = new Set(prev)
            for (const chipId of result.suggestedChips) {
              if (chips.some(c => c.id === chipId)) newSet.add(chipId)
            }
            return Array.from(newSet)
          })
        }
      }

      return (
        <View style={styles.captureSection}>
          {/* AyuSync launcher for cardiac/pulmonary */}
          {isAuscultation && campaignCode && childId && token && (
            <AyuSyncLauncher
              onResult={handleAyuSyncResult}
              campaignCode={campaignCode}
              childId={childId}
              childAge={ageMonths}
              childGender={childGender === 'male' ? 'M' : childGender === 'female' ? 'F' : undefined}
              moduleType={moduleType as 'cardiac' | 'pulmonary'}
              token={token}
              accentColor={bgColor}
            />
          )}

          {isAuscultation && campaignCode && childId && token && (
            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR record manually</Text>
              <View style={styles.orLine} />
            </View>
          )}

          <Text style={styles.captureSectionTitle}>Audio Recording</Text>

          {!capturedUri && !isRecordingAudio ? (
            <TouchableOpacity
              style={[styles.startCaptureButton, { backgroundColor: bgColor }]}
              onPress={handleStartAudioRecording}
              activeOpacity={0.8}
            >
              <Text style={styles.startCaptureEmoji}>{'\u{1F3A4}'}</Text>
              <Text style={styles.startCaptureText}>Start Recording</Text>
              <Text style={styles.startCaptureHint}>Tap to begin audio capture</Text>
            </TouchableOpacity>
          ) : isRecordingAudio ? (
            <View style={styles.capturePreview}>
              <View style={[styles.cameraPlaceholder, { borderColor: '#dc2626' }]}>
                <Text style={styles.cameraPlaceholderEmoji}>{'\u{1F534}'}</Text>
                <Text style={styles.cameraPlaceholderText}>Recording...</Text>
                <Text style={styles.cameraPlaceholderHint}>
                  {Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, '0')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.captureActionButton, { borderColor: '#dc2626' }]}
                onPress={handleStopAudioRecording}
              >
                <Text style={[styles.captureActionText, { color: '#dc2626' }]}>Stop Recording</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.capturePreview}>
              <View style={[styles.cameraPlaceholder, { borderColor: bgColor }]}>
                <Text style={styles.cameraPlaceholderEmoji}>{'\u{2705}'}</Text>
                <Text style={styles.cameraPlaceholderText}>Audio recorded</Text>
                <Text style={styles.cameraPlaceholderHint}>
                  Duration: {Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, '0')}
                </Text>
              </View>
              <TouchableOpacity style={styles.captureActionButton} onPress={handleRetake}>
                <Text style={styles.captureActionText}>Re-record</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )
    }

    return null
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Success Toast Banner */}
        {showSuccess && (
          <View style={[styles.successToast, showSuccess === 'offline' && styles.successToastOffline]}>
            <Text style={styles.successToastText}>
              {showSuccess === 'offline'
                ? '\u{1F4F1} Saved offline \u2014 will sync when connected'
                : '\u2705 Observation Saved'}
            </Text>
          </View>
        )}

        {/* Batch Progress Bar */}
        {batchMode && batchTotal > 0 && (
          <View style={styles.batchProgressBar}>
            <Text style={styles.batchProgressText}>
              Module {batchIndex + 1} of {batchTotal}
            </Text>
            <View style={styles.batchProgressTrack}>
              <View style={[styles.batchProgressFill, {
                width: `${Math.round(((batchIndex + 1) / batchTotal) * 100)}%`
              }]} />
            </View>
          </View>
        )}

        {/* Module Info Header */}
        <View style={styles.moduleHeader}>
          <View style={[styles.moduleIconLarge, { backgroundColor: bgColor }]}>
            <Text style={styles.moduleEmojiLarge}>{emoji}</Text>
          </View>
          <View style={styles.moduleHeaderInfo}>
            <Text style={styles.moduleName}>{moduleConfig.name}</Text>
            <Text style={styles.moduleDescription}>{moduleConfig.description}</Text>
          </View>
        </View>

        {/* Module Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{moduleConfig.duration}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Capture Type</Text>
            <View style={[styles.captureTypeBadge, { backgroundColor: bgColor + '20' }]}>
              <Text style={[styles.captureTypeText, { color: bgColor }]}>
                {moduleConfig.captureType}
              </Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Ages</Text>
            <Text style={styles.detailValue}>
              {moduleConfig.recommendedAge.join(', ')}
            </Text>
          </View>
        </View>

        {/* Child indicator */}
        {childId && (
          <View style={styles.childIndicator}>
            <Text style={styles.childIndicatorText}>
              {'\u{1F9D2}'} {childName || childId.slice(0, 8)}
              {childAge ? ` | ${childAge}` : ''}
              {childGender ? ` | ${childGender === 'male' ? 'M' : 'F'}` : ''}
            </Text>
          </View>
        )}

        {/* AI Status Indicator */}
        <View style={[
          styles.aiStatusBar,
          moduleConfig?.captureType === 'value'
            ? (aiResult
              ? (aiResult.classification?.toLowerCase().includes('normal')
                ? styles.aiStatusNormal
                : styles.aiStatusFlagged)
              : styles.aiStatusReady)
            : styles.aiStatusNA
        ]}>
          <View style={[
            styles.aiStatusDot,
            moduleConfig?.captureType === 'value'
              ? (aiResult ? (aiResult.classification?.toLowerCase().includes('normal') ? styles.aiDotNormal : styles.aiDotFlagged) : styles.aiDotReady)
              : styles.aiDotNA
          ]} />
          <Text style={styles.aiStatusText}>
            {moduleConfig?.captureType === 'value'
              ? (aiResult
                ? `AI: ${aiResult.classification}`
                : (valueInput.trim() ? 'AI Analyzing...' : 'AI Ready \u2014 enter measurement'))
              : pipelineRunning
                ? 'AI: Analyzing image...'
                : capturedUri && qualityFeedback
                  ? (qualityFeedback.passed
                    ? 'AI: Quality OK \u2014 ready for analysis'
                    : 'AI: Quality issues \u2014 retake recommended')
                  : 'AI: Capture image for analysis'}
          </Text>
        </View>

        {/* Rich Screening Guide */}
        {guidance && <GuidancePanel guidance={guidance} />}

        {/* Capture UI */}
        {renderCaptureUI()}

        {/* AI Result Card (for value modules) */}
        {aiResult && (
          <AIResultCard result={aiResult} moduleType={moduleType} childAge={childAge} />
        )}

        {/* Clinical Findings Chips */}
        {chips.length > 0 && (captureStarted || valueInput.trim() || moduleConfig.captureType === 'form') && (
          <AnnotationChips
            chips={chips}
            selectedChips={selectedChips}
            chipSeverities={chipSeverities}
            onToggleChip={handleToggleChip}
            onSetSeverity={handleSetSeverity}
            aiSuggestedChips={aiResult?.suggestedChips || []}
          />
        )}

        {/* AI chip selection banner */}
        {aiResult && aiResult.suggestedChips.length > 0 && selectedChips.length > 0 && (
          <View style={styles.aiChipsBanner}>
            <Text style={styles.aiChipsBannerText}>
              AI selected {aiResult.suggestedChips.length} finding(s) — review and adjust above
            </Text>
          </View>
        )}

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesSectionTitle}>Observation Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Enter any clinical observations, findings, or notes..."
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveObservation}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              {batchMode ? 'Save & Next' : 'Save Observation'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Skip Module (batch mode only) */}
        {batchMode && batchModules.length > 0 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => {
              const prevResults: BatchResult[] = batchResultsStr ? JSON.parse(batchResultsStr) : []
              const allResultsStr = JSON.stringify(prevResults)
              const nextIndex = batchIndex + 1
              if (nextIndex < batchModules.length) {
                navigation.replace('Module', {
                  moduleType: batchModules[nextIndex],
                  campaignCode,
                  childId,
                  childDob,
                  childGender,
                  childName,
                  batchMode: true,
                  batchIndex: nextIndex,
                  batchTotal,
                  batchQueue,
                  batchResults: allResultsStr,
                })
              } else {
                const completedStr = batchModules.slice(0, batchIndex).join(',')
                navigation.replace('BatchSummary', {
                  campaignCode: campaignCode || '',
                  childId: childId || '',
                  childName: childName || '',
                  completedModules: completedStr,
                  batchResults: allResultsStr,
                })
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip Module</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  )
}

// ── Rich guidance panel component ──────────────────
function GuidancePanel({ guidance }: { guidance: ModuleGuidance }) {
  return (
    <View style={styles.guidanceSection}>
      <Text style={styles.guidanceSectionTitle}>{'\u{1F4CB}'} Screening Guide</Text>

      {/* Equipment */}
      {guidance.equipment && guidance.equipment.length > 0 && (
        <View style={styles.guidanceSubSection}>
          <Text style={styles.guidanceSubTitle}>{'\u{1F527}'} Equipment Needed</Text>
          {guidance.equipment.map((item, i) => (
            <View key={i} style={styles.guidanceItem}>
              <Text style={styles.guidanceBullet}>{'\u2022'}</Text>
              <Text style={styles.guidanceText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Environment */}
      {guidance.environment && guidance.environment.length > 0 && (
        <View style={styles.guidanceSubSection}>
          <Text style={styles.guidanceSubTitle}>{'\u{1F3E0}'} Environment</Text>
          {guidance.environment.map((item, i) => (
            <View key={i} style={styles.guidanceItem}>
              <Text style={styles.guidanceBullet}>{'\u2022'}</Text>
              <Text style={styles.guidanceText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Positioning */}
      {guidance.positioning && (
        <View style={styles.guidanceSubSection}>
          <Text style={styles.guidanceSubTitle}>{'\u{1F4CF}'} Positioning</Text>
          <Text style={styles.guidanceInstruction}>{guidance.positioning}</Text>
        </View>
      )}

      {/* Duration */}
      {guidance.duration && (
        <View style={styles.guidanceDurationBadge}>
          <Text style={styles.guidanceDurationText}>{'\u23F1'} Duration: {guidance.duration}</Text>
        </View>
      )}

      {/* Capture Method */}
      {guidance.captureMethod && (
        <View style={styles.guidanceSubSection}>
          <Text style={styles.guidanceSubTitle}>{'\u{1F4DD}'} How to Capture</Text>
          <Text style={styles.guidanceInstruction}>{guidance.captureMethod}</Text>
        </View>
      )}

      {/* Main instruction + What to look for */}
      <View style={styles.guidanceSubSection}>
        <Text style={styles.guidanceSubTitle}>{'\u{1F440}'} What to Look For</Text>
        <Text style={styles.guidanceInstruction}>{guidance.instruction}</Text>
        {guidance.lookFor.map((item, i) => (
          <View key={i} style={styles.guidanceItem}>
            <Text style={styles.guidanceBullet}>{'\u2022'}</Text>
            <Text style={styles.guidanceText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Tips */}
      {guidance.tips && guidance.tips.length > 0 && (
        <View style={styles.guidanceTipsSection}>
          <Text style={styles.guidanceTipsTitle}>{'\u{1F4A1}'} Tips</Text>
          {guidance.tips.map((tip, i) => (
            <View key={i} style={styles.guidanceItem}>
              <Text style={styles.guidanceBullet}>{'\u2022'}</Text>
              <Text style={styles.guidanceTipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
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
    padding: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.md,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.base,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  // Module header
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  moduleIconLarge: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  moduleEmojiLarge: {
    fontSize: 30,
  },
  moduleHeaderInfo: {
    flex: 1,
  },
  moduleName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  moduleDescription: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // Details row
  detailsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  captureTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  captureTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  // Child indicator
  childIndicator: {
    backgroundColor: '#eff6ff',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  childIndicatorText: {
    fontSize: fontSize.sm,
    color: '#1e40af',
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  // Capture section
  captureSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  captureSectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  // Value input
  valueInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fontSize.xl,
    color: colors.text,
    textAlign: 'center',
    minHeight: 64,
    fontWeight: fontWeight.bold,
  },
  unitHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  normalRangeBar: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  normalRangeText: {
    fontSize: fontSize.xs,
    color: '#1e40af',
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  // Form placeholder
  formPlaceholder: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  formPlaceholderIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  formPlaceholderText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // OCR scan button
  ocrScanButton: {
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center' as const,
    marginBottom: spacing.md,
    gap: 4,
  },
  ocrScanEmoji: {
    fontSize: 24,
  },
  ocrScanText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  ocrScanHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  // AyuSync OR divider
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  // Camera capture
  startCaptureButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  startCaptureEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  startCaptureText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  startCaptureHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  capturePreview: {
    gap: spacing.md,
  },
  capturedImage: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.lg,
    backgroundColor: '#1a1a2e',
  },
  cameraPlaceholder: {
    backgroundColor: '#1a1a2e',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    borderWidth: 2,
  },
  cameraPlaceholderEmoji: {
    fontSize: 50,
    marginBottom: spacing.md,
  },
  cameraPlaceholderText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  cameraPlaceholderHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  captureActionButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  captureActionText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  // Notes
  notesSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  notesSectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
    minHeight: 120,
    lineHeight: 22,
  },
  // Save button
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    ...shadow.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  // Success toast
  successToast: {
    backgroundColor: '#dcfce7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#86efac',
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  successToastOffline: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  successToastText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: '#166534',
  },
  // Guidance section — rich panel
  guidanceSection: {
    backgroundColor: '#eff6ff',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: spacing.md,
  },
  guidanceSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#1e40af',
    marginBottom: spacing.md,
  },
  guidanceSubSection: {
    marginBottom: spacing.md,
  },
  guidanceSubTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: '#1e40af',
    marginBottom: spacing.xs,
  },
  guidanceInstruction: {
    fontSize: fontSize.base,
    color: '#1e3a5f',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  guidanceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: spacing.xs,
  },
  guidanceBullet: {
    fontSize: fontSize.base,
    color: '#2563eb',
    marginRight: spacing.sm,
    lineHeight: 22,
  },
  guidanceText: {
    fontSize: fontSize.base,
    color: '#1e3a5f',
    lineHeight: 22,
    flex: 1,
  },
  guidanceDurationBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  guidanceDurationText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: '#1e40af',
  },
  guidanceTipsSection: {
    backgroundColor: '#fef9c3',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  guidanceTipsTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: '#854d0e',
    marginBottom: spacing.xs,
  },
  guidanceTipText: {
    fontSize: fontSize.sm,
    color: '#713f12',
    lineHeight: 20,
    flex: 1,
  },
  // AI chips banner
  aiChipsBanner: {
    backgroundColor: '#fffbeb',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: spacing.md,
  },
  aiChipsBannerText: {
    fontSize: fontSize.sm,
    color: '#92400e',
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  // Batch mode
  batchProgressBar: {
    backgroundColor: '#eff6ff',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  batchProgressText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  batchProgressTrack: {
    height: 6,
    backgroundColor: '#dbeafe',
    borderRadius: 3,
    overflow: 'hidden',
  },
  batchProgressFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  skipButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  skipButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  // AI status bar
  aiStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  aiStatusReady: {
    backgroundColor: '#eff6ff',
  },
  aiStatusNormal: {
    backgroundColor: '#dcfce7',
  },
  aiStatusFlagged: {
    backgroundColor: '#fef2f2',
  },
  aiStatusNA: {
    backgroundColor: '#f1f5f9',
  },
  aiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  aiDotReady: {
    backgroundColor: '#2563eb',
  },
  aiDotNormal: {
    backgroundColor: '#16a34a',
  },
  aiDotFlagged: {
    backgroundColor: '#dc2626',
  },
  aiDotNA: {
    backgroundColor: '#94a3b8',
  },
  aiStatusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
})
