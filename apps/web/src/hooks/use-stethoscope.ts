
import { useState, useRef, useCallback, useEffect } from 'react'

export interface StethoscopeDevice {
  deviceId: string
  label: string
}

export interface StethoscopeState {
  isRecording: boolean
  duration: number
  audioLevel: number
  frequencyData: Uint8Array | null
}

export function useStethoscope() {
  const [devices, setDevices] = useState<StethoscopeDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [state, setState] = useState<StethoscopeState>({
    isRecording: false,
    duration: 0,
    audioLevel: 0,
    frequencyData: null,
  })

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const animFrameRef = useRef<number>(0)

  // Enumerate audio input devices
  const enumerateDevices = useCallback(async () => {
    try {
      // Request permission first
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      tempStream.getTracks().forEach(t => t.stop())

      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = allDevices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
        }))
      setDevices(audioInputs)

      // Try to restore preferred device
      const preferredId = localStorage.getItem('skids_preferred_stethoscope')
      if (preferredId && audioInputs.find(d => d.deviceId === preferredId)) {
        setSelectedDeviceId(preferredId)
      } else if (audioInputs.length > 0) {
        setSelectedDeviceId(audioInputs[0].deviceId)
      }

      return audioInputs
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err)
      return []
    }
  }, [])

  // Select a specific device
  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId)
    localStorage.setItem('skids_preferred_stethoscope', deviceId)
  }, [])

  // Start recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!selectedDeviceId) return false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: selectedDeviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
        }
      })

      streamRef.current = stream

      // Setup audio context + analyser for visualization
      const ctx = new AudioContext({ sampleRate: 44100 })
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      audioContextRef.current = ctx
      analyserRef.current = analyser

      // Setup media recorder
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start(100) // collect in 100ms chunks

      // Timer for duration
      let seconds = 0
      timerRef.current = setInterval(() => {
        seconds++
        setState(prev => ({ ...prev, duration: seconds }))
      }, 1000)

      // Animation loop for audio levels & frequency data
      const updateVisualization = () => {
        if (!analyserRef.current) return
        const bufferLength = analyserRef.current.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        analyserRef.current.getByteFrequencyData(dataArray)

        // RMS level
        let sum = 0
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i] * dataArray[i]
        const rms = Math.sqrt(sum / bufferLength) / 255

        setState(prev => ({
          ...prev,
          audioLevel: rms,
          frequencyData: dataArray,
        }))

        animFrameRef.current = requestAnimationFrame(updateVisualization)
      }
      updateVisualization()

      setState(prev => ({ ...prev, isRecording: true, duration: 0 }))
      return true
    } catch (err) {
      console.error('Failed to start recording:', err)
      return false
    }
  }, [selectedDeviceId])

  // Stop recording and return audio blob
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)

      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        chunksRef.current = []

        // Cleanup
        streamRef.current?.getTracks().forEach(t => t.stop())
        audioContextRef.current?.close()
        streamRef.current = null
        audioContextRef.current = null
        analyserRef.current = null
        mediaRecorderRef.current = null

        setState({ isRecording: false, duration: 0, audioLevel: 0, frequencyData: null })
        resolve(blob)
      }

      recorder.stop()
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioContextRef.current?.close()
    }
  }, [])

  return {
    devices,
    selectedDeviceId,
    state,
    enumerateDevices,
    selectDevice,
    startRecording,
    stopRecording,
    analyser: analyserRef.current,
  }
}
