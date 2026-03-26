/**
 * DataStore — Abstract interface for local data persistence.
 *
 * All app code reads/writes through this interface. The default
 * implementation uses Dexie (IndexedDB). A future Turso implementation
 * can be swapped in by changing the factory import.
 */

import type { Child, ExamSession, Observation } from '@skids/shared'
import type { SyncStateRecord, SyncMetaRecord, SyncStatusValue, MediaSyncStatus } from '@/lib/db-utils'

// ── DataStore Interface ─────────────────────────────

export interface DataStore {
  // ── Children ──
  getChild(id: string): Promise<Child | undefined>
  getAllChildren(): Promise<Child[]>
  saveChild(child: Child): Promise<boolean>
  deleteChild(id: string): Promise<void>

  // ── Sessions ──
  getSession(id: string): Promise<ExamSession | undefined>
  getAllSessions(): Promise<ExamSession[]>
  saveSession(session: ExamSession): Promise<boolean>

  // ── Observations ──
  getObservation(id: string): Promise<Observation | undefined>
  getAllObservations(): Promise<Observation[]>
  saveObservation(obs: Observation): Promise<boolean>
  deleteObservation(id: string): Promise<void>

  // ── Sync State ──
  getSyncState(obsId: string): Promise<SyncStateRecord | undefined>
  getAllSyncStates(): Promise<SyncStateRecord[]>
  getUnsyncedObservations(): Promise<Observation[]>
  getPendingSyncStates(): Promise<SyncStateRecord[]>
  getFailedSyncStates(): Promise<SyncStateRecord[]>
  setSyncState(record: SyncStateRecord): Promise<void>
  markSynced(obsId: string, timestamp: string): Promise<void>
  markSyncFailed(obsId: string, error: string, permanent?: boolean): Promise<void>
  markSyncing(obsId: string): Promise<void>
  markMediaStatus(obsId: string, status: MediaSyncStatus, urlOrError?: string): Promise<void>

  // ── Sync Meta ──
  getSyncMeta(key: string): Promise<SyncMetaRecord | undefined>
  updateSyncMeta(key: string, update: Partial<SyncMetaRecord>): Promise<void>

  // ── Bulk ──
  bulkSaveChildren(children: Child[]): Promise<{ saved: number; failed: number }>

  // ── Export ──
  exportAllData(): Promise<ExportData>
}

// ── Export Data type ─────────────────────────────────

export interface ExportData {
  exportId: string
  exportedAt: string
  appVersion: string
  region: string
  settings: {
    schoolName: string
    nurseName: string
    academicYear: string
  }
  children: Child[]
  sessions: ExamSession[]
  observations: Observation[]
  summary: {
    totalChildren: number
    totalSessions: number
    totalObservations: number
    moduleBreakdown: Record<string, number>
    riskBreakdown: { no_risk: number; possible_risk: number; high_risk: number }
  }
}

// ── Re-exports for convenience ──────────────────────

export type { SyncStateRecord, SyncMetaRecord, SyncStatusValue, MediaSyncStatus }
