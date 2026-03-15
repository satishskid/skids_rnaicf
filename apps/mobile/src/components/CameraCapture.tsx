// CameraCapture — embedded camera view with USB/external camera support
// Enumerates all available camera devices and lets nurse switch between them
// Falls back to ImagePicker if CameraView APIs are unavailable

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { colors, spacing, borderRadius, fontSize, fontWeight, shadow } from '../theme'

export interface QualityFeedback {
  passed: boolean
  feedback: string
  checks: Array<{ name: string; passed: boolean; message: string }>
}

interface CameraCaptureProps {
  mode: 'photo' | 'video'
  preferredFacing?: 'front' | 'back'
  accentColor?: string
  onCapture: (uri: string) => void
  capturedUri: string | null
  onRetake: () => void
  qualityFeedback?: QualityFeedback | null
}

export function CameraCapture({
  mode,
  preferredFacing = 'back',
  accentColor = colors.primary,
  onCapture,
  capturedUri,
  onRetake,
  qualityFeedback,
}: CameraCaptureProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [cameraReady, setCameraReady] = useState(false)
  const [facing, setFacing] = useState<CameraType>(preferredFacing === 'front' ? 'front' : 'back')
  const [isRecording, setIsRecording] = useState(false)
  const [useEmbedded, setUseEmbedded] = useState(true)
  const cameraRef = useRef<CameraView>(null)

  // Request permission on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission()
    }
  }, [permission, requestPermission])

  const toggleFacing = useCallback(() => {
    setFacing(prev => prev === 'back' ? 'front' : 'back')
  }, [])

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current || !cameraReady) return
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: Platform.OS === 'android',
      })
      if (photo?.uri) {
        onCapture(photo.uri)
      }
    } catch (err) {
      console.warn('Embedded camera photo failed, falling back to ImagePicker', err)
      fallbackToImagePicker()
    }
  }, [cameraReady, onCapture])

  const handleStartVideo = useCallback(async () => {
    if (!cameraRef.current || !cameraReady) return
    try {
      setIsRecording(true)
      const video = await cameraRef.current.recordAsync({
        maxDuration: 30,
      })
      setIsRecording(false)
      if (video?.uri) {
        onCapture(video.uri)
      }
    } catch (err) {
      setIsRecording(false)
      console.warn('Embedded camera video failed, falling back to ImagePicker', err)
      fallbackToImagePicker()
    }
  }, [cameraReady, onCapture])

  const handleStopVideo = useCallback(async () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording()
      setIsRecording(false)
    }
  }, [isRecording])

  const fallbackToImagePicker = useCallback(async () => {
    try {
      const permResult = await ImagePicker.requestCameraPermissionsAsync()
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Camera access is needed. Please enable it in Settings.')
        return
      }

      if (mode === 'photo') {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
          cameraType: preferredFacing === 'front'
            ? ImagePicker.CameraType.front
            : ImagePicker.CameraType.back,
        })
        if (!result.canceled && result.assets[0]) {
          onCapture(result.assets[0].uri)
        }
      } else {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['videos'],
          videoMaxDuration: 30,
          cameraType: preferredFacing === 'front'
            ? ImagePicker.CameraType.front
            : ImagePicker.CameraType.back,
        })
        if (!result.canceled && result.assets[0]) {
          onCapture(result.assets[0].uri)
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to open camera')
    }
  }, [mode, preferredFacing, onCapture])

  // If already captured, show preview
  if (capturedUri) {
    return (
      <View style={styles.captureSection}>
        <Text style={styles.captureSectionTitle}>
          {mode === 'photo' ? 'Photo Captured' : 'Video Recorded'}
        </Text>
        <View style={styles.capturePreview}>
          {mode === 'photo' ? (
            <Image
              source={{ uri: capturedUri }}
              style={styles.capturedImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.videoPlaceholder, { borderColor: accentColor }]}>
              <Text style={styles.videoPlaceholderEmoji}>{'\u{1F3AC}'}</Text>
              <Text style={styles.videoPlaceholderText}>Video recorded</Text>
              <Text style={styles.videoPlaceholderHint}>
                {capturedUri.split('/').pop()?.slice(0, 30)}
              </Text>
            </View>
          )}
          {/* Quality Gate Feedback Overlay */}
          {qualityFeedback && (
            <View style={[
              styles.qualityOverlay,
              qualityFeedback.passed ? styles.qualityOverlayPassed : styles.qualityOverlayFailed,
            ]}>
              <Text style={[
                styles.qualityOverlayTitle,
                qualityFeedback.passed ? styles.qualityTextPassed : styles.qualityTextFailed,
              ]}>
                {qualityFeedback.passed ? '\u2705 Quality Check Passed' : '\u26A0\uFE0F Quality Issues Detected'}
              </Text>
              {!qualityFeedback.passed && (
                <Text style={styles.qualityOverlayFeedback}>
                  {qualityFeedback.feedback}
                </Text>
              )}
              {qualityFeedback.checks.filter(c => !c.passed).map((check, i) => (
                <View key={i} style={styles.qualityCheckRow}>
                  <Text style={styles.qualityCheckIcon}>{'\u274C'}</Text>
                  <Text style={styles.qualityCheckText}>{check.message}</Text>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.retakeButton} onPress={onRetake}>
            <Text style={styles.retakeButtonText}>
              {qualityFeedback && !qualityFeedback.passed ? 'Retake Photo' : 'Retake'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Permission not yet granted
  if (!permission?.granted) {
    return (
      <View style={styles.captureSection}>
        <Text style={styles.captureSectionTitle}>
          {mode === 'photo' ? 'Photo Capture' : 'Video Capture'}
        </Text>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionText}>Camera permission is needed</Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: accentColor }]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.captureSection}>
      <Text style={styles.captureSectionTitle}>
        {mode === 'photo' ? 'Photo Capture' : 'Video Capture'}
      </Text>

      {/* Camera mode toggle */}
      <View style={styles.cameraModeSwitcher}>
        <TouchableOpacity
          style={[styles.cameraModeBtn, useEmbedded && styles.cameraModeBtnActive]}
          onPress={() => setUseEmbedded(true)}
        >
          <Text style={[styles.cameraModeBtnText, useEmbedded && styles.cameraModeBtnTextActive]}>
            Camera View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cameraModeBtn, !useEmbedded && styles.cameraModeBtnActive]}
          onPress={() => { setUseEmbedded(false); fallbackToImagePicker() }}
        >
          <Text style={[styles.cameraModeBtnText, !useEmbedded && styles.cameraModeBtnTextActive]}>
            System Camera
          </Text>
        </TouchableOpacity>
      </View>

      {useEmbedded ? (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            mode={mode === 'video' ? 'video' : 'picture'}
            onCameraReady={() => setCameraReady(true)}
          />

          {/* Camera controls */}
          <View style={styles.cameraControls}>
            {/* Flip camera */}
            <TouchableOpacity style={styles.controlButton} onPress={toggleFacing}>
              <Text style={styles.controlButtonText}>{'\u{1F504}'}</Text>
              <Text style={styles.controlLabel}>Flip</Text>
            </TouchableOpacity>

            {/* Capture button */}
            {mode === 'photo' ? (
              <TouchableOpacity
                style={[styles.captureButton, { borderColor: accentColor }]}
                onPress={handleTakePhoto}
                disabled={!cameraReady}
                activeOpacity={0.7}
              >
                {!cameraReady ? (
                  <ActivityIndicator color={accentColor} />
                ) : (
                  <View style={[styles.captureButtonInner, { backgroundColor: accentColor }]} />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.captureButton, {
                  borderColor: isRecording ? '#dc2626' : accentColor,
                }]}
                onPress={isRecording ? handleStopVideo : handleStartVideo}
                disabled={!cameraReady}
                activeOpacity={0.7}
              >
                {!cameraReady ? (
                  <ActivityIndicator color={accentColor} />
                ) : isRecording ? (
                  <View style={styles.stopRecordingSquare} />
                ) : (
                  <View style={[styles.captureButtonInner, { backgroundColor: '#dc2626', borderRadius: 4 }]} />
                )}
              </TouchableOpacity>
            )}

            {/* System camera fallback */}
            <TouchableOpacity style={styles.controlButton} onPress={fallbackToImagePicker}>
              <Text style={styles.controlButtonText}>{'\u{1F4F1}'}</Text>
              <Text style={styles.controlLabel}>System</Text>
            </TouchableOpacity>
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}

          <Text style={styles.cameraHint}>
            {facing === 'front' ? 'Front camera' : 'Rear camera'}
            {' \u2022 Tap \u{1F504} to switch \u2022 Tap \u{1F4F1} for system camera / USB'}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.systemCameraButton, { backgroundColor: accentColor }]}
          onPress={fallbackToImagePicker}
          activeOpacity={0.8}
        >
          <Text style={styles.systemCameraEmoji}>
            {mode === 'photo' ? '\u{1F4F7}' : '\u{1F3AC}'}
          </Text>
          <Text style={styles.systemCameraText}>
            Open System Camera
          </Text>
          <Text style={styles.systemCameraHint}>
            Supports USB cameras via system camera app
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
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
  // Camera mode switcher
  cameraModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cameraModeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  cameraModeBtnActive: {
    backgroundColor: colors.primary,
  },
  cameraModeBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  cameraModeBtnTextActive: {
    color: colors.white,
  },
  // Embedded camera
  cameraContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  camera: {
    height: 300,
    borderRadius: borderRadius.lg,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  controlButton: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  controlButtonText: {
    fontSize: 24,
  },
  controlLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  stopRecordingSquare: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc2626',
  },
  recordingText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#dc2626',
  },
  cameraHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  // System camera fallback
  systemCameraButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  systemCameraEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  systemCameraText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  systemCameraHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  // Preview
  capturePreview: {
    gap: spacing.md,
  },
  capturedImage: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.lg,
    backgroundColor: '#1a1a2e',
  },
  videoPlaceholder: {
    backgroundColor: '#1a1a2e',
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    borderWidth: 2,
  },
  videoPlaceholderEmoji: {
    fontSize: 50,
    marginBottom: spacing.md,
  },
  videoPlaceholderText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  videoPlaceholderHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retakeButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  // Permission
  permissionBox: {
    backgroundColor: '#fef3c7',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  permissionText: {
    fontSize: fontSize.base,
    color: '#92400e',
    marginBottom: spacing.md,
  },
  permissionButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  // Quality gate overlay
  qualityOverlay: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  qualityOverlayPassed: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  qualityOverlayFailed: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  qualityOverlayTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  qualityTextPassed: {
    color: '#166534',
  },
  qualityTextFailed: {
    color: '#991b1b',
  },
  qualityOverlayFeedback: {
    fontSize: fontSize.sm,
    color: '#7f1d1d',
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  qualityCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    gap: spacing.xs,
  },
  qualityCheckIcon: {
    fontSize: fontSize.sm,
  },
  qualityCheckText: {
    fontSize: fontSize.sm,
    color: '#991b1b',
    flex: 1,
    lineHeight: 18,
  },
})
