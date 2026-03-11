// Module screen — shows module info, capture UI, AI analysis, and observation saving
// Handles photo/video/audio/value/form capture types with real camera & audio

import React, { useState, useRef, useEffect, useMemo } from 'react'
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
import { getChipsForModule, getModuleGuidance } from '../lib/annotations'
import { useSyncEngine } from '../lib/sync-engine'
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
  }
  BatchSummary: {
    campaignCode: string; childId: string; childName: string; completedModules: string
  }
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
    batchMode, batchIndex = 0, batchTotal = 0, batchQueue } = route.params
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
          })
        } else {
          // All done — show summary
          const completedStr = batchModules.join(',')
          navigation.replace('BatchSummary', {
            campaignCode: campaignCode || '',
            childId: childId || '',
            childName: childName || '',
            completedModules: completedStr,
          })
        }
        return
      }

      Alert.alert(
        savedOffline ? 'Saved Offline' : 'Observation Saved',
        savedOffline
          ? `${moduleConfig.name} observation queued — will sync when online.`
          : `${moduleConfig.name} observation has been recorded.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      )
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
      return (
        <View style={styles.captureSection}>
          <Text style={styles.captureSectionTitle}>Enter Value</Text>
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

    // ── Photo / Video capture ───────────────────

    if (moduleConfig.captureType === 'photo' || moduleConfig.captureType === 'video') {
      const isPhoto = moduleConfig.captureType === 'photo'
      return (
        <View style={styles.captureSection}>
          <Text style={styles.captureSectionTitle}>
            {CAPTURE_TYPE_LABELS[moduleConfig.captureType]}
          </Text>

          {!capturedUri ? (
            <TouchableOpacity
              style={[styles.startCaptureButton, { backgroundColor: bgColor }]}
              onPress={isPhoto ? handlePhotoCapture : handleVideoCapture}
              activeOpacity={0.8}
            >
              <Text style={styles.startCaptureEmoji}>
                {isPhoto ? '\u{1F4F7}' : '\u{1F3AC}'}
              </Text>
              <Text style={styles.startCaptureText}>
                {isPhoto ? 'Take Photo' : 'Record Video'}
              </Text>
              <Text style={styles.startCaptureHint}>
                {moduleConfig.cameraFacing === 'user' ? 'Front camera' : 'Rear camera'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.capturePreview}>
              {isPhoto ? (
                <Image
                  source={{ uri: capturedUri }}
                  style={styles.capturedImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.cameraPlaceholder, { borderColor: bgColor }]}>
                  <Text style={styles.cameraPlaceholderEmoji}>{'\u{1F3AC}'}</Text>
                  <Text style={styles.cameraPlaceholderText}>Video recorded</Text>
                  <Text style={styles.cameraPlaceholderHint}>
                    {capturedUri.split('/').pop()?.slice(0, 30)}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={styles.captureActionButton} onPress={handleRetake}>
                <Text style={styles.captureActionText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )
    }

    // ── Audio capture ───────────────────────────

    if (moduleConfig.captureType === 'audio') {
      return (
        <View style={styles.captureSection}>
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
              : 'AI: Visual analysis coming soon'}
          </Text>
        </View>

        {/* What to Look For Guidance */}
        {guidance && (
          <View style={styles.guidanceSection}>
            <Text style={styles.guidanceSectionTitle}>What to Look For</Text>
            <Text style={styles.guidanceInstruction}>{guidance.instruction}</Text>
            {guidance.lookFor.map((item, i) => (
              <View key={i} style={styles.guidanceItem}>
                <Text style={styles.guidanceBullet}>{'\u2022'}</Text>
                <Text style={styles.guidanceText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

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
                })
              } else {
                const completedStr = batchModules.slice(0, batchIndex).join(',')
                navigation.replace('BatchSummary', {
                  campaignCode: campaignCode || '',
                  childId: childId || '',
                  childName: childName || '',
                  completedModules: completedStr,
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
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: fontSize.sm,
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
  // Guidance section
  guidanceSection: {
    backgroundColor: '#eff6ff',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: spacing.md,
  },
  guidanceSectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#1e40af',
    marginBottom: spacing.sm,
  },
  guidanceInstruction: {
    fontSize: fontSize.sm,
    color: '#1e3a5f',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  guidanceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: spacing.xs,
  },
  guidanceBullet: {
    fontSize: fontSize.sm,
    color: '#2563eb',
    marginRight: spacing.sm,
    lineHeight: 20,
  },
  guidanceText: {
    fontSize: fontSize.sm,
    color: '#1e3a5f',
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
