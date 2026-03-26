'use client'

/**
 * Camera utilities for USB camera support across screening modules.
 * Provides a getUserMedia wrapper that respects the nurse's preferred camera
 * (e.g., USB otoscope/dermatoscope) with graceful fallback.
 *
 * Fallback chain (Android-USB-friendly):
 *   1. preferredCameraId + ideal resolution
 *   2. preferredCameraId + no resolution (USB cameras may not support requested size)
 *   3. facingMode hint + ideal resolution
 *   4. any camera + ideal resolution
 *   5. any camera, no constraints (last resort)
 */

function getPreferredCameraId(): string | null {
  try {
    const savedSettings = localStorage.getItem('zpediscreen_settings')
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      return settings.preferredCameraId || null
    }
  } catch {
    // localStorage may be unavailable
  }
  return null
}

/**
 * Get a camera stream respecting the user's preferred camera from settings.
 * Falls back gracefully through multiple attempts to maximize USB camera
 * compatibility on Android devices.
 *
 * @param facingMode - 'user' (front) or 'environment' (rear) as fallback hint
 * @param resolution - Optional resolution constraints (always treated as ideal, never exact)
 * @returns MediaStream from the best available camera
 */
export async function getUserMediaWithFallback(
  facingMode: 'user' | 'environment',
  resolution?: { width: number; height: number; exact?: boolean }
): Promise<MediaStream> {
  const preferredId = getPreferredCameraId()

  // Always use ideal constraints — exact constraints block USB cameras on Android
  const idealResolution: MediaTrackConstraints = resolution
    ? { width: { ideal: resolution.width }, height: { ideal: resolution.height } }
    : {}

  // Attempt 1: Preferred camera (USB otoscope, dermatoscope, etc.) + resolution
  if (preferredId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: preferredId }, ...idealResolution },
        audio: false,
      })
    } catch {
      // Preferred device may not support requested resolution — try without
    }

    // Attempt 2: Preferred camera without resolution constraints
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: preferredId } },
        audio: false,
      })
    } catch {
      // Preferred device unavailable — fall through
    }
  }

  // Attempt 3: facingMode hint + ideal resolution (built-in front/rear camera)
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode, ...idealResolution },
      audio: false,
    })
  } catch {
    // facingMode failed — fall through
  }

  // Attempt 4: Any camera with ideal resolution
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: idealResolution,
      audio: false,
    })
  } catch {
    // Resolution hint failed — fall through to last resort
  }

  // Attempt 5: Any available camera (last resort)
  return await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
}
