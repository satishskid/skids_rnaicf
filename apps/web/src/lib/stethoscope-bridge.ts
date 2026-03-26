/**
 * Stethoscope Bridge Client — PWA side of the WebSocket bridge.
 *
 * Connects to the native Android bridge at ws://localhost:8765
 * when the app is running inside the SKIDS Bridge APK (TWA).
 *
 * Usage in React:
 *   const steth = useStethoscope()
 *   steth.scan()                        // Find nearby devices
 *   steth.connect("AA:BB:CC:DD:EE:FF")  // Connect to device
 *   steth.startRecording("aortic")      // Record at location
 *   steth.stopRecording()               // Stop recording
 *   steth.generateReport()              // Get AI diagnosis
 *
 * When running in a regular browser (no bridge), all methods are no-ops
 * and `isAvailable` is false.
 */

const BRIDGE_URL = 'ws://localhost:8765'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 5

// ── Types ───────────────────────────────────────────────────────────────

export interface StethDevice {
  name: string
  address: string
}

export interface StethReport {
  bpm: string
  condition: string
  confidence: string
  heartSounds?: Array<{ sound: string; confidence: string }>
  lungSounds?: Array<{ sound: string; confidence: string }>
}

export type StethFilter = 'HEART' | 'LUNG' | 'NO_FILTER'

export type StethRecordingState = 'started' | 'stopped'

export interface StethStatus {
  connected: boolean
  deviceName: string | null
}

export type BridgeEvent =
  | { type: 'status'; data: StethStatus }
  | { type: 'device'; data: StethDevice }
  | { type: 'audio'; data: { samples: number[]; sampleRate: number } }
  | { type: 'filteredAudio'; data: { samples: number[] } }
  | { type: 'recording'; data: { state: StethRecordingState; location?: string } }
  | { type: 'report'; data: StethReport }
  | { type: 'error'; data: { message: string } }
  | { type: 'bridgeConnected' }
  | { type: 'bridgeDisconnected' }

type BridgeListener = (event: BridgeEvent) => void

// ── Bridge Client ───────────────────────────────────────────────────────

class StethoscopeBridge {
  private ws: WebSocket | null = null
  private listeners = new Set<BridgeListener>()
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _isAvailable = false
  private _isConnected = false

  /** True if the WebSocket bridge is reachable (running inside the APK) */
  get isAvailable(): boolean { return this._isAvailable }

  /** True if a stethoscope device is connected via BLE/USB */
  get isDeviceConnected(): boolean { return this._isConnected }

  /** Subscribe to bridge events. Returns unsubscribe function. */
  on(listener: BridgeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Try to connect to the native bridge. Safe to call from browser (will fail silently). */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    if (typeof window === 'undefined') return

    try {
      this.ws = new WebSocket(BRIDGE_URL)

      this.ws.onopen = () => {
        this._isAvailable = true
        this.reconnectAttempts = 0
        this.emit({ type: 'bridgeConnected' })
        // Request initial status
        this.send({ type: 'command', action: 'getStatus' })
      }

      this.ws.onclose = () => {
        this._isAvailable = false
        this._isConnected = false
        this.emit({ type: 'bridgeDisconnected' })
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        // Will trigger onclose — no need to handle here
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          this.handleMessage(msg)
        } catch {
          // Ignore malformed messages
        }
      }
    } catch {
      // WebSocket not available (e.g., SSR)
    }
  }

  /** Disconnect from the bridge */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this._isAvailable = false
    this._isConnected = false
  }

  // ── Stethoscope Commands ──────────────────────────────────────────

  /** Start scanning for BLE stethoscope devices */
  scan(): void {
    this.send({ type: 'command', action: 'scan' })
  }

  /** Connect to a specific device by BLE address */
  connectDevice(address: string): void {
    this.send({ type: 'command', action: 'connect', address })
  }

  /** Disconnect from the current device */
  disconnectDevice(): void {
    this.send({ type: 'command', action: 'disconnect' })
  }

  /** Start recording at a body location (e.g., "aortic", "mitral") */
  startRecording(location: string): void {
    this.send({ type: 'command', action: 'startRecording', location })
  }

  /** Stop recording */
  stopRecording(): void {
    this.send({ type: 'command', action: 'stopRecording' })
  }

  /** Change audio filter (HEART, LUNG, or NO_FILTER) */
  changeFilter(filter: StethFilter): void {
    this.send({ type: 'command', action: 'changeFilter', filter })
  }

  /** Generate AI diagnosis report from recorded audio */
  generateReport(): void {
    this.send({ type: 'command', action: 'generateReport' })
  }

  // ── Internal ──────────────────────────────────────────────────────

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(msg))
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string
    switch (type) {
      case 'status':
        this._isConnected = msg.connected as boolean
        this.emit({ type: 'status', data: msg as unknown as StethStatus })
        break
      case 'device':
        this.emit({ type: 'device', data: msg as unknown as StethDevice })
        break
      case 'audio':
        this.emit({ type: 'audio', data: msg as unknown as { samples: number[]; sampleRate: number } })
        break
      case 'filteredAudio':
        this.emit({ type: 'filteredAudio', data: msg as unknown as { samples: number[] } })
        break
      case 'recording':
        this.emit({ type: 'recording', data: msg as unknown as { state: StethRecordingState; location?: string } })
        break
      case 'report':
        this.emit({ type: 'report', data: msg as unknown as StethReport })
        break
      case 'error':
        this.emit({ type: 'error', data: msg as unknown as { message: string } })
        break
    }
  }

  private emit(event: BridgeEvent): void {
    this.listeners.forEach(fn => fn(event))
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY)
  }
}

// Singleton — one bridge per app
export const stethBridge = new StethoscopeBridge()
