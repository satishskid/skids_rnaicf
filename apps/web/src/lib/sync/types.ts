/**
 * Pluggable Sync Architecture — Type Definitions
 *
 * This module defines the interfaces for SKIDS Screen's sync system.
 * The architecture supports multiple backends (Vercel KV, AWS, Firebase, etc.)
 * through the ISyncBackend interface.
 *
 * Your AWS dev team: implement ISyncBackend in aws-backend.ts
 */

import { Observation, Child } from '@skids/shared'

// ============================================
// SYNC BACKEND INTERFACE
// ============================================

/**
 * Pluggable sync backend interface.
 * Implement this to connect SKIDS Screen to any cloud backend.
 */
export interface ISyncBackend {
  /** Unique name for this backend (e.g., 'vercel-kv', 'aws', 'firebase') */
  name: string

  /**
   * Push observations to the cloud.
   * Called by SyncManager when observations are queued for sync.
   * Should handle deduplication server-side (observations have stable IDs).
   */
  push(payload: SyncPushPayload): Promise<SyncPushResult>

  /**
   * Pull observations for a screening event from the cloud.
   * Used to download data from other nurses' devices.
   */
  pull(eventCode: string): Promise<SyncPullResult>

  /**
   * Upload a media file (evidence image, video frame).
   * Returns a URL or key that can be stored in the observation.
   * Called separately from push() to handle large files efficiently.
   */
  uploadMedia(file: Blob, key: string): Promise<string>

  /**
   * Check if this backend is available (network + auth).
   * SyncManager calls this before attempting push/pull.
   */
  isAvailable(): Promise<boolean>
}

// ============================================
// SYNC PAYLOADS
// ============================================

export interface SyncPushPayload {
  eventCode: string
  deviceId: string
  nurseName: string
  observations: SyncableObservation[]
  syncedAt: string
  gpsCoordinates?: { lat: number; lng: number }
}

export interface SyncPushResult {
  success: boolean
  syncedIds: string[]
  failedIds: string[]
  error?: string
}

export interface SyncPullResult {
  success: boolean
  observations: Observation[]
  children: Child[]
  error?: string
}

// ============================================
// SYNCABLE OBSERVATION
// ============================================

/**
 * Extends Observation with sync tracking fields.
 * These fields are stored in IndexedDB alongside the observation data.
 */
export interface SyncableObservation extends Observation {
  /** Current sync status */
  syncStatus: SyncStatus
  /** Error message if sync failed */
  syncError?: string
  /** Number of sync attempts (for exponential backoff) */
  syncAttempts: number
  /** Timestamp of last sync attempt */
  lastSyncAttempt?: string
  /** Which backends have confirmed receipt */
  syncedTo: string[]
}

export type SyncStatus = 'local' | 'queued' | 'syncing' | 'synced' | 'failed' | 'permanent_failure'

// ============================================
// SYNC MANAGER CONFIG
// ============================================

export interface SyncManagerConfig {
  /** Registered backends to sync with */
  backends: ISyncBackend[]
  /** Auto-sync interval in milliseconds (default: 30000 = 30s) */
  autoSyncIntervalMs?: number
  /** Maximum retry attempts before marking as failed (default: 5) */
  maxRetries?: number
  /** Base delay for exponential backoff in ms (default: 30000 = 30s) */
  baseRetryDelayMs?: number
}

// ============================================
// SYNC EVENTS (for UI updates)
// ============================================

export type SyncEventType =
  | 'sync-started'
  | 'sync-completed'
  | 'sync-failed'
  | 'observation-synced'
  | 'observation-failed'

export interface SyncEvent {
  type: SyncEventType
  backendName: string
  observationId?: string
  error?: string
  timestamp: string
}

// ============================================
// RE-EXPORTS from new sync architecture
// ============================================

// SyncEngine types are in sync-engine.ts
// DataStore types are in data-store.ts
// SyncState/SyncMeta records are in db-utils.ts
export type { SyncStateRecord, SyncMetaRecord, SyncStatusValue, MediaSyncStatus } from '@/lib/db-utils'
export type { SyncResult, SyncEngineEvent, SyncEngineEventType } from './sync-engine'
