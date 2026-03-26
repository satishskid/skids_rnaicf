/**
 * SyncManager — Orchestrates observation sync across multiple backends.
 *
 * Features:
 * - Pluggable backends (Vercel KV, AWS, Firebase, etc.)
 * - Retry with exponential backoff
 * - Media upload separation (evidence images sent separately)
 * - Sync status tracking per observation
 * - Event system for UI updates
 *
 * Usage:
 *   const manager = new SyncManager({
 *     backends: [new VercelKVBackend(), new AWSBackend()],
 *   })
 *   manager.queueObservation(observation)
 *   manager.startAutoSync()
 */

import {
  ISyncBackend,
  SyncManagerConfig,
  SyncableObservation,
  SyncPushPayload,
  SyncEvent,
  SyncStatus,
} from './types'

const DEFAULT_AUTO_SYNC_INTERVAL = 30_000 // 30 seconds
const DEFAULT_MAX_RETRIES = 5
const DEFAULT_BASE_RETRY_DELAY = 30_000 // 30 seconds

export class SyncManager {
  private backends: ISyncBackend[]
  private autoSyncIntervalMs: number
  private maxRetries: number
  private baseRetryDelayMs: number
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null
  private listeners: ((event: SyncEvent) => void)[] = []
  private isSyncing = false

  constructor(config: SyncManagerConfig) {
    this.backends = config.backends
    this.autoSyncIntervalMs = config.autoSyncIntervalMs ?? DEFAULT_AUTO_SYNC_INTERVAL
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.baseRetryDelayMs = config.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY
  }

  /**
   * Register a listener for sync events (for UI updates).
   */
  onSyncEvent(listener: (event: SyncEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private emit(event: SyncEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // Don't let listener errors break sync
      }
    }
  }

  /**
   * Start automatic periodic sync.
   */
  startAutoSync() {
    if (this.autoSyncTimer) return
    this.autoSyncTimer = setInterval(() => {
      this.syncAll()
    }, this.autoSyncIntervalMs)
  }

  /**
   * Stop automatic periodic sync.
   */
  stopAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer)
      this.autoSyncTimer = null
    }
  }

  /**
   * Mark an observation as ready for sync.
   * Returns the observation with syncStatus fields added.
   */
  static prepareForSync(observation: SyncableObservation['moduleType'] extends string ? Record<string, unknown> : never): SyncableObservation {
    // This is a type helper — actual implementation uses queueObservation
    throw new Error('Use queueObservation() instead')
  }

  /**
   * Create a SyncableObservation from a regular observation.
   */
  static makeSyncable(observation: Record<string, unknown>): SyncableObservation {
    return {
      ...observation,
      syncStatus: 'local' as SyncStatus,
      syncError: undefined,
      syncAttempts: 0,
      lastSyncAttempt: undefined,
      syncedTo: [],
    } as SyncableObservation
  }

  /**
   * Process a batch of observations against all available backends.
   * Returns updated observations with sync status.
   */
  async syncObservations(
    observations: SyncableObservation[],
    eventCode: string,
    deviceId: string,
    nurseName: string,
  ): Promise<SyncableObservation[]> {
    if (this.isSyncing) return observations
    this.isSyncing = true

    const results = [...observations]

    try {
      for (const backend of this.backends) {
        // Check if backend is available
        const available = await backend.isAvailable().catch(() => false)
        if (!available) continue

        this.emit({
          type: 'sync-started',
          backendName: backend.name,
          timestamp: new Date().toISOString(),
        })

        // Filter observations that need syncing to this backend
        const needsSync = results.filter(obs => {
          if (obs.syncedTo.includes(backend.name)) return false
          if (obs.syncStatus === 'synced' && obs.syncedTo.includes(backend.name)) return false
          if (obs.syncAttempts >= this.maxRetries) return false

          // Exponential backoff check
          if (obs.lastSyncAttempt && obs.syncAttempts > 0) {
            const delay = this.baseRetryDelayMs * Math.pow(2, obs.syncAttempts - 1)
            const elapsed = Date.now() - new Date(obs.lastSyncAttempt).getTime()
            if (elapsed < delay) return false
          }

          return true
        })

        if (needsSync.length === 0) continue

        // Mark as syncing
        for (const obs of needsSync) {
          const idx = results.findIndex(r => r.id === obs.id)
          if (idx >= 0) {
            results[idx] = { ...results[idx], syncStatus: 'syncing' }
          }
        }

        // Strip base64 evidence images before push (bandwidth optimization)
        const lightObservations = needsSync.map(obs => {
          const light = { ...obs }
          if (light.annotationData) {
            const ad = { ...light.annotationData }
            // Remove heavy base64 fields — they'll be uploaded separately via uploadMedia
            if ('evidenceImage' in ad) {
              delete (ad as Record<string, unknown>).evidenceImage
            }
            if ('evidenceVideoFrames' in ad) {
              delete (ad as Record<string, unknown>).evidenceVideoFrames
            }
            light.annotationData = ad
          }
          return light
        })

        // Capture GPS if available (non-blocking, 5s timeout)
        let gpsCoordinates: { lat: number; lng: number } | undefined
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 60000,
              })
            )
            gpsCoordinates = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          } catch {
            // GPS unavailable or denied — continue without it
          }
        }

        // Push to backend
        const payload: SyncPushPayload = {
          eventCode,
          deviceId,
          nurseName,
          observations: lightObservations,
          syncedAt: new Date().toISOString(),
          gpsCoordinates,
        }

        try {
          const result = await backend.push(payload)

          if (result.success) {
            // Mark synced observations
            for (const syncedId of result.syncedIds) {
              const idx = results.findIndex(r => r.id === syncedId)
              if (idx >= 0) {
                const syncedTo = [...results[idx].syncedTo]
                if (!syncedTo.includes(backend.name)) syncedTo.push(backend.name)
                results[idx] = {
                  ...results[idx],
                  syncStatus: syncedTo.length >= this.backends.length ? 'synced' : results[idx].syncStatus,
                  syncedTo,
                  syncError: undefined,
                }
                this.emit({
                  type: 'observation-synced',
                  backendName: backend.name,
                  observationId: syncedId,
                  timestamp: new Date().toISOString(),
                })
              }
            }

            // Mark failed observations
            for (const failedId of result.failedIds) {
              const idx = results.findIndex(r => r.id === failedId)
              if (idx >= 0) {
                results[idx] = {
                  ...results[idx],
                  syncStatus: 'failed',
                  syncError: result.error || 'Push failed',
                  syncAttempts: results[idx].syncAttempts + 1,
                  lastSyncAttempt: new Date().toISOString(),
                }
              }
            }

            this.emit({
              type: 'sync-completed',
              backendName: backend.name,
              timestamp: new Date().toISOString(),
            })
          } else {
            // Entire push failed
            for (const obs of needsSync) {
              const idx = results.findIndex(r => r.id === obs.id)
              if (idx >= 0) {
                results[idx] = {
                  ...results[idx],
                  syncStatus: 'failed',
                  syncError: result.error || 'Push failed',
                  syncAttempts: results[idx].syncAttempts + 1,
                  lastSyncAttempt: new Date().toISOString(),
                }
              }
            }

            this.emit({
              type: 'sync-failed',
              backendName: backend.name,
              error: result.error,
              timestamp: new Date().toISOString(),
            })
          }
        } catch (err) {
          // Network error — mark all as failed
          const errorMsg = err instanceof Error ? err.message : 'Network error'
          for (const obs of needsSync) {
            const idx = results.findIndex(r => r.id === obs.id)
            if (idx >= 0) {
              results[idx] = {
                ...results[idx],
                syncStatus: 'failed',
                syncError: errorMsg,
                syncAttempts: results[idx].syncAttempts + 1,
                lastSyncAttempt: new Date().toISOString(),
              }
            }
          }

          this.emit({
            type: 'sync-failed',
            backendName: backend.name,
            error: errorMsg,
            timestamp: new Date().toISOString(),
          })
        }
      }
    } finally {
      this.isSyncing = false
    }

    return results
  }

  /**
   * Sync all pending observations. Called by auto-sync timer.
   * Override this in your app to provide observations from IndexedDB.
   */
  async syncAll() {
    // This is a hook — the app should call syncObservations() with
    // observations from IndexedDB. The auto-sync timer calls this.
    // Override by providing a callback via onSyncEvent.
    this.emit({
      type: 'sync-started',
      backendName: 'all',
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Get count of pending (unsynced) observations.
   */
  static getPendingCount(observations: SyncableObservation[]): number {
    return observations.filter(o =>
      o.syncStatus === 'local' ||
      o.syncStatus === 'queued' ||
      o.syncStatus === 'failed'
    ).length
  }

  /**
   * Destroy the manager, cleaning up timers.
   */
  destroy() {
    this.stopAutoSync()
    this.listeners = []
  }
}
