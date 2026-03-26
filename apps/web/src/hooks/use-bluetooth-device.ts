
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  BLE_SERVICES,
  BLE_CHARACTERISTICS,
  BLE_SERVICE_LABELS,
  parseBLEReading,
  type BLEServiceType,
  type BLEReading,
} from '@/lib/ble'

// ============================================
// HOOK OPTIONS & RETURN TYPE
// ============================================

export interface UseBluetoothDeviceOptions {
  /** Which BLE service to connect to */
  serviceType: BLEServiceType
  /** Auto-disconnect after reading (battery-efficient mode). Default: true */
  autoDisconnect?: boolean
}

export interface UseBluetoothDeviceReturn {
  /** Web Bluetooth API available AND not on iOS */
  isSupported: boolean
  /** Running on iOS (no Web Bluetooth at all) */
  isIOS: boolean
  /** Currently attempting to connect */
  isConnecting: boolean
  /** GATT server connected */
  isConnected: boolean
  /** Paired device name (from last requestDevice call) */
  deviceName: string | null
  /** Most recent parsed reading */
  lastReading: BLEReading | null
  /** Human-readable error message */
  error: string | null
  /** Human label for the service (e.g., "Pulse Oximeter") */
  serviceLabel: string
  /** Open browser BLE device picker. Must be called from user gesture (button click). */
  requestDevice: () => Promise<boolean>
  /** Connect → read single value → disconnect. Battery-efficient. */
  readOnce: () => Promise<BLEReading | null>
  /** Disconnect from device */
  disconnect: () => void
}

// ============================================
// PLATFORM DETECTION
// ============================================

function detectIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function detectIsSupported(): boolean {
  if (typeof navigator === 'undefined') return false
  if (detectIsIOS()) return false
  return 'bluetooth' in navigator
}

// ============================================
// LOCALSTORAGE KEY
// ============================================

function storageKey(serviceType: BLEServiceType): string {
  return `skids_ble_${serviceType.toLowerCase()}`
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useBluetoothDevice(
  options: UseBluetoothDeviceOptions
): UseBluetoothDeviceReturn {
  const { serviceType, autoDisconnect = true } = options

  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [deviceName, setDeviceName] = useState<string | null>(() => {
    if (typeof localStorage === 'undefined') return null
    try {
      const stored = localStorage.getItem(storageKey(serviceType))
      return stored ? JSON.parse(stored).name : null
    } catch {
      return null
    }
  })
  const [lastReading, setLastReading] = useState<BLEReading | null>(null)
  const [error, setError] = useState<string | null>(null)

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null)

  const isIOS = detectIsIOS()
  const isSupported = detectIsSupported()

  // ── Disconnection handler ──────────────────
  const handleDisconnect = useCallback(() => {
    setIsConnected(false)
    serverRef.current = null
  }, [])

  // ── Cleanup ────────────────────────────────
  const disconnect = useCallback(() => {
    try {
      if (serverRef.current?.connected) {
        serverRef.current.disconnect()
      }
    } catch {
      // ignore disconnect errors
    }
    deviceRef.current?.removeEventListener('gattserverdisconnected', handleDisconnect)
    deviceRef.current = null
    serverRef.current = null
    setIsConnected(false)
    setError(null)
  }, [handleDisconnect])

  // ── Request device (opens browser picker) ──
  const requestDevice = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Web Bluetooth is not supported on this device')
      return false
    }

    setIsConnecting(true)
    setError(null)

    try {
      const serviceUUID = BLE_SERVICES[serviceType]
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [serviceUUID] }],
        optionalServices: [serviceUUID],
      })

      // Cleanup previous device if any
      if (deviceRef.current) {
        deviceRef.current.removeEventListener('gattserverdisconnected', handleDisconnect)
      }

      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', handleDisconnect)

      const name = device.name || 'Unknown Device'
      setDeviceName(name)

      // Persist device name for UI display
      try {
        localStorage.setItem(
          storageKey(serviceType),
          JSON.stringify({ name, pairedAt: new Date().toISOString() })
        )
      } catch {
        // localStorage may be unavailable
      }

      setIsConnecting(false)
      return true
    } catch (err) {
      setIsConnecting(false)

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotFoundError':
            // User cancelled the picker — not an error
            setError(null)
            return false
          case 'SecurityError':
            setError('Bluetooth requires a user action (tap a button)')
            return false
          case 'NotSupportedError':
            setError('Bluetooth is not available on this device')
            return false
          default:
            setError(`Bluetooth error: ${err.message}`)
            return false
        }
      }

      setError('Failed to find device. Make sure it is powered on and nearby.')
      return false
    }
  }, [isSupported, serviceType, handleDisconnect])

  // ── Connect to GATT server ─────────────────
  const connectGATT = useCallback(async (): Promise<BluetoothRemoteGATTServer | null> => {
    const device = deviceRef.current
    if (!device) {
      setError('No device paired. Tap "Pair Device" first.')
      return null
    }

    try {
      setIsConnecting(true)
      const server = await device.gatt!.connect()
      serverRef.current = server
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
      return server
    } catch (err) {
      setIsConnecting(false)
      setIsConnected(false)
      serverRef.current = null

      if (err instanceof DOMException && err.name === 'NetworkError') {
        setError('Device out of range or powered off. Move closer and try again.')
      } else {
        setError('Failed to connect. Ensure the device is powered on.')
      }
      return null
    }
  }, [])

  // ── Read single value ──────────────────────
  const readOnce = useCallback(async (): Promise<BLEReading | null> => {
    setError(null)

    // Ensure we have a device — if not, prompt picker
    if (!deviceRef.current) {
      const paired = await requestDevice()
      if (!paired) return null
    }

    // Connect to GATT
    const server = await connectGATT()
    if (!server) return null

    try {
      const serviceUUID = BLE_SERVICES[serviceType]
      const characteristicUUID = BLE_CHARACTERISTICS[serviceType]

      const service = await server.getPrimaryService(serviceUUID)
      const characteristic = await service.getCharacteristic(characteristicUUID)

      // Try reading the current value
      const dataView = await characteristic.readValue()
      const parsed = parseBLEReading(serviceType, dataView)

      const reading: BLEReading = {
        ...parsed,
        timestamp: new Date().toISOString(),
        deviceName: deviceName || 'Unknown Device',
        serviceType,
      }

      setLastReading(reading)

      // Auto-disconnect for battery efficiency
      if (autoDisconnect) {
        try {
          server.disconnect()
        } catch {
          // ignore
        }
        setIsConnected(false)
        serverRef.current = null
      }

      return reading
    } catch (err) {
      // Some devices don't support readValue() — try notifications instead
      try {
        const serviceUUID = BLE_SERVICES[serviceType]
        const characteristicUUID = BLE_CHARACTERISTICS[serviceType]
        const service = await server.getPrimaryService(serviceUUID)
        const characteristic = await service.getCharacteristic(characteristicUUID)

        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            characteristic.stopNotifications().catch(() => {})
            if (autoDisconnect) {
              server.disconnect()
              setIsConnected(false)
              serverRef.current = null
            }
            setError('No reading received. Place the device on the patient and try again.')
            resolve(null)
          }, 15000) // 15s timeout

          characteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
            clearTimeout(timeout)
            const target = event.target as BluetoothRemoteGATTCharacteristic
            const dataView = target.value!
            const parsed = parseBLEReading(serviceType, dataView)

            const reading: BLEReading = {
              ...parsed,
              timestamp: new Date().toISOString(),
              deviceName: deviceName || 'Unknown Device',
              serviceType,
            }

            setLastReading(reading)
            characteristic.stopNotifications().catch(() => {})

            if (autoDisconnect) {
              server.disconnect()
              setIsConnected(false)
              serverRef.current = null
            }

            resolve(reading)
          }, { once: true })

          characteristic.startNotifications().catch((notifyErr) => {
            clearTimeout(timeout)
            setError('Device does not support reading. Check device compatibility.')
            if (autoDisconnect) {
              server.disconnect()
              setIsConnected(false)
              serverRef.current = null
            }
            resolve(null)
          })
        })
      } catch {
        setError('Failed to read from device. Try disconnecting and reconnecting.')

        if (autoDisconnect) {
          try { server.disconnect() } catch { /* ignore */ }
          setIsConnected(false)
          serverRef.current = null
        }
        return null
      }
    }
  }, [serviceType, deviceName, autoDisconnect, requestDevice, connectGATT])

  // ── Cleanup on unmount ─────────────────────
  useEffect(() => {
    return () => {
      try {
        if (serverRef.current?.connected) {
          serverRef.current.disconnect()
        }
      } catch {
        // ignore cleanup errors
      }
      deviceRef.current?.removeEventListener('gattserverdisconnected', handleDisconnect)
    }
  }, [handleDisconnect])

  return {
    isSupported,
    isIOS,
    isConnecting,
    isConnected,
    deviceName,
    lastReading,
    error,
    serviceLabel: BLE_SERVICE_LABELS[serviceType],
    requestDevice,
    readOnce,
    disconnect,
  }
}
