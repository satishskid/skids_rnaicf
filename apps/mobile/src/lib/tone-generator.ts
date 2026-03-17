/**
 * Pure-tone generator for hearing screening on React Native.
 *
 * Generates calibrated sine-wave WAV files in memory,
 * writes them to a temp file via expo-file-system,
 * and plays through expo-av with stereo panning (left/right ear).
 *
 * Reference: ISO 8253-1 pure-tone air conduction audiometry.
 * Calibration note: smartphone speakers/headphones are NOT clinical
 * audiometers — results are screening-grade only.
 */

import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import type { Ear } from './ai/audiometry'

// ── Constants ──

const SAMPLE_RATE = 44100
const BITS_PER_SAMPLE = 16
const NUM_CHANNELS = 2 // stereo for ear selection
const FADE_MS = 20 // fade in/out to avoid clicks

/**
 * Reference gain calibration.
 * 0 dB HL maps to this linear gain. Tuned for typical smartphone + headphones.
 * In clinical audiometry this would be calibrated per-transducer.
 */
const REFERENCE_GAIN = 0.0005

/** Convert dB HL to linear gain. */
function dbToLinear(dbHL: number): number {
  return REFERENCE_GAIN * Math.pow(10, dbHL / 20)
}

// ── WAV Generation ──

/** Write a 16-bit little-endian value to a Uint8Array at offset. */
function writeUint16LE(arr: Uint8Array, offset: number, value: number) {
  arr[offset] = value & 0xff
  arr[offset + 1] = (value >> 8) & 0xff
}

/** Write a 32-bit little-endian value to a Uint8Array at offset. */
function writeUint32LE(arr: Uint8Array, offset: number, value: number) {
  arr[offset] = value & 0xff
  arr[offset + 1] = (value >> 8) & 0xff
  arr[offset + 2] = (value >> 16) & 0xff
  arr[offset + 3] = (value >> 24) & 0xff
}

/**
 * Generate a stereo WAV buffer containing a pure tone in one ear.
 *
 * @param frequency - Tone frequency in Hz
 * @param dbHL - Hearing level in dB HL
 * @param ear - Which ear to deliver the tone to
 * @param durationMs - Tone duration in milliseconds
 * @returns Uint8Array containing complete WAV file
 */
function generateToneWAV(
  frequency: number,
  dbHL: number,
  ear: Ear,
  durationMs: number
): Uint8Array {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000)
  const gain = dbToLinear(dbHL)
  const fadeSamples = Math.floor((SAMPLE_RATE * FADE_MS) / 1000)

  // PCM data: 2 channels × 2 bytes per sample
  const dataSize = numSamples * NUM_CHANNELS * (BITS_PER_SAMPLE / 8)
  const headerSize = 44
  const wav = new Uint8Array(headerSize + dataSize)

  // RIFF header
  wav[0] = 0x52; wav[1] = 0x49; wav[2] = 0x46; wav[3] = 0x46 // "RIFF"
  writeUint32LE(wav, 4, 36 + dataSize) // file size - 8
  wav[8] = 0x57; wav[9] = 0x41; wav[10] = 0x56; wav[11] = 0x45 // "WAVE"

  // fmt chunk
  wav[12] = 0x66; wav[13] = 0x6d; wav[14] = 0x74; wav[15] = 0x20 // "fmt "
  writeUint32LE(wav, 16, 16) // chunk size
  writeUint16LE(wav, 20, 1) // PCM format
  writeUint16LE(wav, 22, NUM_CHANNELS)
  writeUint32LE(wav, 24, SAMPLE_RATE)
  writeUint32LE(wav, 28, SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8)) // byte rate
  writeUint16LE(wav, 32, NUM_CHANNELS * (BITS_PER_SAMPLE / 8)) // block align
  writeUint16LE(wav, 34, BITS_PER_SAMPLE)

  // data chunk
  wav[36] = 0x64; wav[37] = 0x61; wav[38] = 0x74; wav[39] = 0x61 // "data"
  writeUint32LE(wav, 40, dataSize)

  // Generate stereo PCM samples
  const leftActive = ear === 'left'
  const rightActive = ear === 'right'

  for (let i = 0; i < numSamples; i++) {
    // Sine wave
    const t = i / SAMPLE_RATE
    let amplitude = Math.sin(2 * Math.PI * frequency * t) * gain

    // Fade in/out to avoid clicks
    if (i < fadeSamples) {
      amplitude *= i / fadeSamples
    } else if (i > numSamples - fadeSamples) {
      amplitude *= (numSamples - i) / fadeSamples
    }

    // Clamp to [-1, 1] and convert to 16-bit int
    const clampedL = leftActive ? Math.max(-1, Math.min(1, amplitude)) : 0
    const clampedR = rightActive ? Math.max(-1, Math.min(1, amplitude)) : 0
    const sampleL = Math.round(clampedL * 32767)
    const sampleR = Math.round(clampedR * 32767)

    const offset = headerSize + i * 4
    writeUint16LE(wav, offset, sampleL & 0xffff)
    writeUint16LE(wav, offset + 2, sampleR & 0xffff)
  }

  return wav
}

/** Convert Uint8Array to base64 string. */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  // Use btoa if available (Hermes supports it), otherwise manual
  if (typeof btoa === 'function') {
    return btoa(binary)
  }
  // Fallback: chunk-based encoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i)
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0
    result += chars[a >> 2]
    result += chars[((a & 3) << 4) | (b >> 4)]
    result += i + 1 < binary.length ? chars[((b & 15) << 2) | (c >> 6)] : '='
    result += i + 2 < binary.length ? chars[c & 63] : '='
  }
  return result
}

// ── Public API ──

let _toneCounter = 0
let _currentSound: Audio.Sound | null = null

/**
 * Play a pure tone through headphones to a specific ear.
 *
 * @returns Promise that resolves when the tone finishes playing,
 *          plus a stop() function for early termination.
 */
export function playTone(
  frequency: number,
  dbHL: number,
  ear: Ear,
  durationMs: number = 1000
): { promise: Promise<void>; stop: () => void } {
  let stopped = false
  let sound: Audio.Sound | null = null

  const promise = (async () => {
    try {
      // Stop any currently playing tone
      if (_currentSound) {
        try { await _currentSound.stopAsync(); await _currentSound.unloadAsync() } catch {}
        _currentSound = null
      }

      // Generate WAV
      const wav = generateToneWAV(frequency, dbHL, ear, durationMs)
      const base64 = uint8ToBase64(wav)

      // Write to temp file
      const filename = `tone_${++_toneCounter}.wav`
      const filePath = `${FileSystem.cacheDirectory}${filename}`
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      })

      if (stopped) return

      // Configure audio session for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      })

      // Load and play
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: filePath },
        { shouldPlay: true, volume: 1.0 }
      )
      sound = s
      _currentSound = s

      if (stopped) {
        await s.stopAsync()
        await s.unloadAsync()
        return
      }

      // Wait for playback to finish
      await new Promise<void>((resolve) => {
        s.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            resolve()
          }
        })
      })

      // Cleanup
      await s.unloadAsync()
      if (_currentSound === s) _currentSound = null

      // Delete temp file
      try { await FileSystem.deleteAsync(filePath, { idempotent: true }) } catch {}
    } catch (err) {
      console.warn('[ToneGenerator] Playback error:', err)
    }
  })()

  return {
    promise,
    stop: () => {
      stopped = true
      if (sound) {
        sound.stopAsync().then(() => sound?.unloadAsync()).catch(() => {})
      }
    },
  }
}

/**
 * Play a brief demo tone (louder, longer) so the child can hear what to expect.
 */
export function playDemoTone(frequency: number, ear: Ear): { promise: Promise<void>; stop: () => void } {
  return playTone(frequency, 50, ear, 1500) // 50 dB, 1.5s — clearly audible
}

/** Stop any currently playing tone. */
export async function stopAllTones(): Promise<void> {
  if (_currentSound) {
    try {
      await _currentSound.stopAsync()
      await _currentSound.unloadAsync()
    } catch {}
    _currentSound = null
  }
}
