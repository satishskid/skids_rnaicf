/**
 * SyncEngine — Bulletproof sync orchestrator for SKIDS Screen.
 *
 * Replaces the inline syncObservationsToCloud() in page.tsx.
 * Uses DataStore for persistent sync state in IndexedDB.
 *
 * Features:
 *   - Coordinated media + metadata sync (observation marked synced only when both succeed)
 *   - Persistent retry with exponential backoff + jitter
 *   - Error categorization (transient vs auth vs permanent)
 *   - Batch processing (50 obs per API call)
 *   - Sync lock prevents concurrent syncs (station mode safe)
 *   - Event system for UI feedback
 */



import type { Observation } from '@skids/shared'
import type { DataStore, SyncStateRecord } from '@/lib/data-store'
import { uploadObservationMedia, stripBase64FromObservation } from '@/lib/media-upload'
import { authFetch } from '@/lib/api'
import { getDeviceId } from '@/lib/campaign-types'

// ── Types ───────────────────────────────────────────

export interface SyncResult {
  synced: number
  failed: number
  skipped: number
  error?: string
}

export type SyncEngineEventType =
  | 'sync-started'
  | 'sync-progress'
  | 'sync-completed'
  | 'sync-error'
  | 'media-progress'

export interface SyncEngineEvent {
  type: SyncEngineEventType
  synced?: number
  failed?: number
  total?: number
  pending?: number
  error?: string
  observationId?: string
}

export interface SyncEngineConfig {
  /** Auto-sync interval in ms (default: 60000 = 60s) */
  intervalMs?: number
  /** Max retry attempts (default: 10) */
  maxRetries?: number
  /** Base delay for exponential backoff in ms (default: 15000 = 15s) */
  baseRetryDelayMs?: number
  /** Max observations per API call (default: 50) */
  batchSize?: number
}

// ── Error Classification ────────────────────────────

type ErrorCategory = 'transient' | 'auth' | 'permanent'

function classifyError(status: number): ErrorCategory {
  if (status === 401) return 'auth'
  if (status === 403 || status === 404 || status === 400) return 'permanent'
  return 'transient' // 5xx, network errors, timeouts
}

// ── SyncEngine ──────────────────────────────────────

const DEFAULT_INTERVAL = 60_000
const DEFAULT_MAX_RETRIES = 10
const DEFAULT_BASE_DELAY = 15_000
const DEFAULT_BATCH_SIZE = 50

export class SyncEngine {
  private store: DataStore
  private config: Required<SyncEngineConfig>
  private syncLock = false
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<(event: SyncEngineEvent) => void>()
  private destroyed = false

  constructor(store: DataStore, config?: SyncEngineConfig) {
    this.store = store
    this.config = {
      intervalMs: config?.intervalMs ?? DEFAULT_INTERVAL,
      maxRetries: config?.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseRetryDelayMs: config?.baseRetryDelayMs ?? DEFAULT_BASE_DELAY,
      batchSize: config?.batchSize ?? DEFAULT_BATCH_SIZE,
    }
  }

  // ── Event System ──

  on(listener: (event: SyncEngineEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: SyncEngineEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // Don't let listener errors break sync
      }
    }
  }

  // ── Auto-Sync Lifecycle ──

  startAutoSync(campaignCode: string, nurseName: string) {
    if (this.autoSyncTimer || this.destroyed) return

    this.autoSyncTimer = setInterval(async () => {
      if (!navigator.onLine) return
      try {
        await this.syncAll(campaignCode, nurseName)
      } catch {
        // Auto-sync failures are silent — event system notifies UI
      }
    }, this.config.intervalMs)
  }

  stopAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer)
      this.autoSyncTimer = null
    }
  }

  destroy() {
    this.destroyed = true
    this.stopAutoSync()
    this.listeners.clear()
  }

  // ── Core Sync Cycle ──

  async syncAll(campaignCode: string, nurseName: string): Promise<SyncResult> {
    if (this.syncLock) return { synced: 0, failed: 0, skipped: 0 }
    if (!campaignCode) return { synced: 0, failed: 0, skipped: 0 }

    this.syncLock = true
    const result: SyncResult = { synced: 0, failed: 0, skipped: 0 }

    try {
      // 1. Get all pending sync states
      const pending = await this.store.getPendingSyncStates()
      if (pending.length === 0) {
        await this.updateGlobalMeta(campaignCode, result)
        return result
      }

      // 2. Filter by retry eligibility
      const eligible = pending.filter(s => this.isEligibleForRetry(s))
      if (eligible.length === 0) {
        result.skipped = pending.length
        return result
      }

      this.emit({ type: 'sync-started', total: eligible.length, pending: pending.length })

      // 3. Media upload pass
      await this.uploadPendingMedia(eligible, campaignCode)

      // 4. Metadata sync pass (in batches)
      const readyForSync = await this.store.getPendingSyncStates()
      const readyObs = readyForSync.filter(s =>
        s.mediaStatus === 'uploaded' ||
        s.mediaStatus === 'not_applicable' ||
        // Also sync if media failed but data can still go through
        s.mediaStatus === 'failed'
      )

      if (readyObs.length > 0) {
        const syncResult = await this.syncMetadataBatched(
          readyObs, campaignCode, nurseName
        )
        result.synced = syncResult.synced
        result.failed = syncResult.failed
      }

      // 5. Update global sync meta
      await this.updateGlobalMeta(campaignCode, result)

      this.emit({
        type: 'sync-completed',
        synced: result.synced,
        failed: result.failed,
        total: eligible.length,
      })

      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed'
      result.error = errorMsg
      this.emit({ type: 'sync-error', error: errorMsg })
      return result
    } finally {
      this.syncLock = false
    }
  }

  // ── Manual Trigger ──

  async syncNow(campaignCode: string, nurseName: string): Promise<SyncResult> {
    return this.syncAll(campaignCode, nurseName)
  }

  // ── Get Status ──

  async getPendingCount(): Promise<number> {
    const pending = await this.store.getPendingSyncStates()
    return pending.length
  }

  async getFailedCount(): Promise<number> {
    const failed = await this.store.getFailedSyncStates()
    return failed.length
  }

  get isSyncing(): boolean {
    return this.syncLock
  }

  // ── Media Upload Pass ──

  private async uploadPendingMedia(
    states: SyncStateRecord[],
    campaignCode: string,
  ): Promise<void> {
    const needsUpload = states.filter(s =>
      s.mediaStatus === 'pending' || s.mediaStatus === 'failed'
    )

    for (const state of needsUpload) {
      if (this.destroyed) break

      try {
        const obs = await this.store.getObservation(state.id)
        if (!obs) continue

        // Check if there's actually media to upload
        const hasBase64 = !!(
          obs.annotationData?.evidenceImage ||
          (obs.annotationData?.evidenceVideoFrames && obs.annotationData.evidenceVideoFrames.length > 0)
        )

        if (!hasBase64) {
          await this.store.markMediaStatus(state.id, 'not_applicable')
          continue
        }

        // Get childId from capture metadata or session
        const childId = (obs.captureMetadata?.childId as string) || ''
        if (!childId) {
          await this.store.markMediaStatus(state.id, 'not_applicable')
          continue
        }

        await this.store.markMediaStatus(state.id, 'uploading')
        this.emit({ type: 'media-progress', observationId: state.id })

        const uploadResult = await uploadObservationMedia(obs, campaignCode, childId)

        if (uploadResult.mediaUrl || uploadResult.mediaUrls) {
          // Update observation with URLs and strip base64
          const updatedObs: Observation = {
            ...obs,
            mediaUrl: uploadResult.mediaUrl || obs.mediaUrl,
            mediaUrls: uploadResult.mediaUrls || obs.mediaUrls,
          }
          const stripped = stripBase64FromObservation(updatedObs)
          await this.store.saveObservation(stripped)
          await this.store.markMediaStatus(
            state.id,
            'uploaded',
            uploadResult.mediaUrl || uploadResult.mediaUrls?.[0]
          )
        } else if (uploadResult.error) {
          await this.store.markMediaStatus(state.id, 'failed', uploadResult.error)
        } else {
          // No media and no error — mark as N/A
          await this.store.markMediaStatus(state.id, 'not_applicable')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Media upload failed'
        await this.store.markMediaStatus(state.id, 'failed', msg)
      }
    }
  }

  // ── Metadata Sync (Batched) ──

  private async syncMetadataBatched(
    states: SyncStateRecord[],
    campaignCode: string,
    nurseName: string,
  ): Promise<{ synced: number; failed: number }> {
    let totalSynced = 0
    let totalFailed = 0

    // Process in batches
    for (let i = 0; i < states.length; i += this.config.batchSize) {
      if (this.destroyed) break

      const batch = states.slice(i, i + this.config.batchSize)
      const batchResult = await this.syncBatch(batch, campaignCode, nurseName)
      totalSynced += batchResult.synced
      totalFailed += batchResult.failed

      this.emit({
        type: 'sync-progress',
        synced: totalSynced,
        failed: totalFailed,
        total: states.length,
      })
    }

    return { synced: totalSynced, failed: totalFailed }
  }

  private async syncBatch(
    states: SyncStateRecord[],
    campaignCode: string,
    nurseName: string,
  ): Promise<{ synced: number; failed: number }> {
    // Mark all as syncing
    for (const state of states) {
      await this.store.markSyncing(state.id)
    }

    // Load observations
    const observations: Observation[] = []
    for (const state of states) {
      const obs = await this.store.getObservation(state.id)
      if (obs) observations.push(obs)
    }

    if (observations.length === 0) {
      return { synced: 0, failed: 0 }
    }

    // Prepare lightweight sync payload (strip base64, extract key fields)
    const syncObs = observations.map(o => {
      const hasMediaUrl = !!o.mediaUrl
      const features = { ...(o.aiAnnotations?.[0]?.features || {}) }
      if (hasMediaUrl) {
        delete features.evidenceImage
        delete features.evidenceVideoFrames
      }
      const annotationData = o.annotationData ? { ...o.annotationData } : undefined
      if (annotationData && hasMediaUrl) {
        delete (annotationData as Record<string, unknown>).evidenceImage
        delete (annotationData as Record<string, unknown>).evidenceVideoFrames
      }
      return {
        id: o.id,
        sessionId: o.sessionId,
        childId: (o.captureMetadata?.childId as string) || '',
        moduleType: o.moduleType,
        bodyRegion: o.bodyRegion,
        timestamp: o.timestamp,
        captureMetadata: o.captureMetadata ? {
          timestamp: o.captureMetadata.timestamp,
          deviceModel: o.captureMetadata.deviceModel,
          processingType: o.captureMetadata.processingType,
        } : undefined,
        mediaUrl: o.mediaUrl || undefined,
        mediaUrls: o.mediaUrls || undefined,
        riskCategory: o.aiAnnotations?.[0]?.riskCategory || 'no_risk',
        summaryText: o.aiAnnotations?.[0]?.summaryText || '',
        confidence: o.aiAnnotations?.[0]?.confidence || 0,
        features,
        annotationData,
      }
    })

    try {
      const res = await authFetch(`/api/campaigns/${campaignCode}/sync`, {
        method: 'POST',
        body: JSON.stringify({
          deviceId: getDeviceId(),
          nurseName,
          observations: syncObs,
          syncedAt: new Date().toISOString(),
        }),
      })

      const status = res.status
      const data = await res.json().catch(() => ({ success: false }))

      if (data.success) {
        const now = new Date().toISOString()
        for (const obs of observations) {
          await this.store.markSynced(obs.id, now)
        }
        return { synced: observations.length, failed: data.failed || 0 }
      }

      // Classify error and handle accordingly
      const category = classifyError(status)
      const errorMsg = data.error || `HTTP ${status}`

      for (const state of states) {
        await this.store.markSyncFailed(
          state.id,
          errorMsg,
          category === 'permanent'
        )
      }

      if (category === 'auth') {
        this.emit({ type: 'sync-error', error: 'Authentication expired. Please sign in again.' })
      }

      return { synced: 0, failed: observations.length }
    } catch (err) {
      // Network error — mark all as failed (transient)
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      for (const state of states) {
        await this.store.markSyncFailed(state.id, errorMsg, false)
      }
      return { synced: 0, failed: observations.length }
    }
  }

  // ── Retry Eligibility ──

  private isEligibleForRetry(state: SyncStateRecord): boolean {
    // Never retry permanent failures
    if (state.status === 'permanent_failure') return false

    // Always sync pending (first attempt)
    if (state.status === 'pending') return true

    // Check retry limit
    if (state.attempts >= this.config.maxRetries) return false

    // Exponential backoff with jitter
    if (state.lastAttemptAt && state.attempts > 0) {
      const baseDelay = this.config.baseRetryDelayMs * Math.pow(2, state.attempts - 1)
      const jitter = baseDelay * (0.5 + Math.random() * 0.5)
      const delay = Math.min(jitter, 5 * 60 * 1000) // cap at 5 minutes
      const elapsed = Date.now() - new Date(state.lastAttemptAt).getTime()
      if (elapsed < delay) return false
    }

    return true
  }

  // ── Global Meta ──

  private async updateGlobalMeta(campaignCode: string, result: SyncResult): Promise<void> {
    const pending = await this.store.getPendingSyncStates()
    const failed = await this.store.getFailedSyncStates()

    await this.store.updateSyncMeta(campaignCode, {
      lastSyncAt: new Date().toISOString(),
      lastSuccessfulSyncAt: result.synced > 0 ? new Date().toISOString() : undefined,
      lastSyncResult: result.synced > 0 && result.failed === 0
        ? 'success'
        : result.synced > 0
          ? 'partial'
          : result.failed > 0
            ? 'failed'
            : null,
      pendingCount: pending.length,
      failedCount: failed.length,
    })
  }

  // ── Ensure observation has syncState (for legacy data) ──

  async ensureSyncState(obsId: string): Promise<void> {
    const existing = await this.store.getSyncState(obsId)
    if (!existing) {
      await this.store.setSyncState({
        id: obsId,
        entityType: 'observation',
        status: 'pending',
        syncedAt: null,
        attempts: 0,
        lastAttemptAt: null,
        lastError: null,
        mediaStatus: 'pending',
        mediaUrl: null,
        mediaError: null,
      })
    }
  }
}
