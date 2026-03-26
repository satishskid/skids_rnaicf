// client-side hook

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseCameraOptions {
  facingModeHint: 'user' | 'environment'
  width?: number
  height?: number
  autoStart?: boolean  // default true
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  stream: MediaStream | null
  isReady: boolean
  error: string | null
  startCamera: () => Promise<void>
  stopCamera: () => void
  capturePhoto: () => string | null
  availableCameras: MediaDeviceInfo[]
  switchCamera: (deviceId: string) => Promise<void>
  newCameraDetected: MediaDeviceInfo | null
  dismissNewCamera: () => void
}

/**
 * Shared camera hook with USB camera detection + switching support.
 * Reads preferredCameraId from zpediscreen_settings in localStorage.
 * Falls back to facingMode hint if no preferred camera.
 * Listens for devicechange events to detect USB camera plug/unplug.
 */
export function useCamera({
  facingModeHint,
  width,
  height,
  autoStart = true,
}: UseCameraOptions): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [newCameraDetected, setNewCameraDetected] = useState<MediaDeviceInfo | null>(null)
  const previousCameraIdsRef = useRef<Set<string>>(new Set())

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStream(null)
    setIsReady(false)
  }, [])

  const getPreferredCameraId = useCallback((): string | null => {
    try {
      const savedSettings = localStorage.getItem('zpediscreen_settings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        return settings.preferredCameraId || null
      }
    } catch { /* ignore */ }
    return null
  }, [])

  const buildConstraints = useCallback((deviceId?: string): MediaStreamConstraints => {
    const videoConstraints: MediaTrackConstraints = {}

    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId }
    } else {
      videoConstraints.facingMode = facingModeHint
    }

    if (width) videoConstraints.width = { ideal: width }
    if (height) videoConstraints.height = { ideal: height }

    return { video: videoConstraints, audio: false }
  }, [facingModeHint, width, height])

  const startCamera = useCallback(async () => {
    // Stop any existing stream first
    stopCamera()
    setError(null)

    const preferredId = getPreferredCameraId()

    // Try preferred camera first, then fallback
    const attempts: MediaStreamConstraints[] = []
    if (preferredId) {
      attempts.push(buildConstraints(preferredId))
    }
    attempts.push(buildConstraints())  // fallback to facingMode
    // Last resort: any camera
    attempts.push({ video: true, audio: false })

    for (const constraints of attempts) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = newStream
        setStream(newStream)

        if (videoRef.current) {
          videoRef.current.srcObject = newStream
          await new Promise<void>((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => resolve()
            } else {
              resolve()
            }
          })
        }

        setIsReady(true)
        return  // success
      } catch {
        // Try next attempt
        continue
      }
    }

    // All attempts failed
    setError('Camera access failed. Please check permissions and try again.')
  }, [stopCamera, getPreferredCameraId, buildConstraints])

  const switchCamera = useCallback(async (deviceId: string) => {
    // Save as preferred camera
    try {
      const savedSettings = localStorage.getItem('zpediscreen_settings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        settings.preferredCameraId = deviceId
        localStorage.setItem('zpediscreen_settings', JSON.stringify(settings))
      }
    } catch { /* ignore */ }

    // Restart camera with new device
    stopCamera()
    setError(null)

    try {
      const newStream = await navigator.mediaDevices.getUserMedia(
        buildConstraints(deviceId)
      )
      streamRef.current = newStream
      setStream(newStream)

      if (videoRef.current) {
        videoRef.current.srcObject = newStream
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve()
          } else {
            resolve()
          }
        })
      }

      setIsReady(true)
      setNewCameraDetected(null)
    } catch {
      setError('Failed to switch camera. Please try again.')
    }
  }, [stopCamera, buildConstraints])

  const dismissNewCamera = useCallback(() => {
    setNewCameraDetected(null)
  }, [])

  const capturePhoto = useCallback((): string | null => {
    if (!videoRef.current) return null
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(videoRef.current, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.8)
  }, [])

  // Enumerate cameras and detect new devices
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoCameras = devices.filter(d => d.kind === 'videoinput')
      setAvailableCameras(videoCameras)

      // Check for newly connected cameras
      const currentIds = new Set(videoCameras.map(d => d.deviceId))
      const prevIds = previousCameraIdsRef.current

      if (prevIds.size > 0) {
        // Find new cameras that weren't there before
        for (const camera of videoCameras) {
          if (!prevIds.has(camera.deviceId) && camera.deviceId) {
            setNewCameraDetected(camera)
            break // Only notify about the first new camera
          }
        }
      }

      previousCameraIdsRef.current = currentIds
    } catch {
      // Camera enumeration failed — permissions not granted yet
    }
  }, [])

  // Listen for device changes (USB camera plug/unplug)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return

    const handleDeviceChange = () => {
      enumerateCameras()
    }

    // Initial enumeration
    enumerateCameras()

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [enumerateCameras])

  // Auto-start camera on mount
  useEffect(() => {
    if (autoStart) {
      startCamera()
    }
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    videoRef,
    stream,
    isReady,
    error,
    startCamera,
    stopCamera,
    capturePhoto,
    availableCameras,
    switchCamera,
    newCameraDetected,
    dismissNewCamera,
  }
}
