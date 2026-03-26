/**
 * Dexie.js-based IndexedDB utilities for local data persistence.
 *
 * Exports the same API surface as the original raw-IndexedDB implementation
 * so that consumers (page.tsx, campaign-dashboard.tsx) need zero changes.
 *
 * v11 adds syncState + syncMeta tables for bulletproof sync tracking.
 */

import Dexie, { type Table } from 'dexie'
import { Child, ExamSession, Observation, AppSettings, DEFAULT_SETTINGS } from '@skids/shared'

// ── Sync state types ────────────────────────────────

export type SyncStatusValue = 'pending' | 'syncing' | 'synced' | 'failed' | 'permanent_failure'
export type MediaSyncStatus = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'not_applicable'

export interface SyncStateRecord {
  id: string                    // matches observation.id
  entityType: 'observation' | 'child' | 'session'
  status: SyncStatusValue
  syncedAt: string | null
  attempts: number
  lastAttemptAt: string | null
  lastError: string | null
  mediaStatus: MediaSyncStatus
  mediaUrl: string | null
  mediaError: string | null
}

export interface SyncMetaRecord {
  key: string                   // 'global' or campaignCode
  lastSyncAt: string | null
  lastSuccessfulSyncAt: string | null
  lastSyncResult: 'success' | 'partial' | 'failed' | null
  pendingCount: number
  failedCount: number
}

// ── Dexie database definition ───────────────────────

interface ExportRecord {
  id: string
  data: string
  timestamp: string
}

class PediatricHealthDB extends Dexie {
  children!: Table<Child, string>
  sessions!: Table<ExamSession, string>
  observations!: Table<Observation, string>
  exports!: Table<ExportRecord, string>
  syncState!: Table<SyncStateRecord, string>
  syncMeta!: Table<SyncMetaRecord, string>

  constructor() {
    super('PediatricHealthDB')

    // Version 10 — must match or exceed the existing IDB version on deployed devices
    this.version(10).stores({
      children: 'id',
      sessions: 'id',
      observations: 'id',
      exports: 'id',
    })

    // Version 11 — adds sync tracking tables
    this.version(11).stores({
      children: 'id',
      sessions: 'id',
      observations: 'id',
      exports: 'id',
      syncState: 'id, status, entityType',
      syncMeta: 'key',
    }).upgrade(async (tx) => {
      // Migrate existing localStorage sync state to IndexedDB
      try {
        const raw = typeof localStorage !== 'undefined'
          ? localStorage.getItem('zpediscreen_settings')
          : null
        if (raw) {
          const settings = JSON.parse(raw)
          const synced: Record<string, string> = settings.syncedObservations || {}
          const records: SyncStateRecord[] = Object.entries(synced).map(
            ([obsId, timestamp]) => ({
              id: obsId,
              entityType: 'observation' as const,
              status: 'synced' as const,
              syncedAt: timestamp,
              attempts: 1,
              lastAttemptAt: timestamp,
              lastError: null,
              mediaStatus: 'not_applicable' as const,
              mediaUrl: null,
              mediaError: null,
            })
          )
          if (records.length > 0) {
            await tx.table('syncState').bulkPut(records)
          }
        }
      } catch {
        // Migration is best-effort — new tables are additive
      }
    })
  }
}

const db = new PediatricHealthDB()

// Export db instance for direct access by DataStore and SyncEngine
export { db }

// ── Store name → Dexie table mapping ────────────────

type StoreName = 'children' | 'sessions' | 'observations' | 'exports'

interface StoreTypeMap {
  children: Child
  sessions: ExamSession
  observations: Observation
  exports: ExportRecord
}

function table<T extends StoreName>(store: T): Table<StoreTypeMap[T], string> {
  return db[store] as Table<StoreTypeMap[T], string>
}

// ── Public API (same signatures as before) ──────────

export async function dbGet<T extends StoreName>(
  store: T,
  id: string,
): Promise<StoreTypeMap[T] | undefined> {
  return table(store).get(id)
}

export async function dbGetAll<T extends StoreName>(
  store: T,
): Promise<StoreTypeMap[T][]> {
  return table(store).toArray()
}

export class StorageQuotaError extends Error {
  constructor() {
    super('Storage quota exceeded. Please sync and free up space.')
    this.name = 'StorageQuotaError'
  }
}

export async function dbPut<T extends StoreName>(
  store: T,
  data: StoreTypeMap[T],
): Promise<void> {
  try {
    await table(store).put(data)
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22)
    ) {
      throw new StorageQuotaError()
    }
    throw err
  }
}

/**
 * Safe wrapper around dbPut that catches StorageQuotaError.
 * Returns true if successful, false if storage is full.
 */
export async function dbPutSafe<T extends StoreName>(
  store: T,
  data: StoreTypeMap[T],
): Promise<boolean> {
  try {
    await dbPut(store, data)
    return true
  } catch (err) {
    if (err instanceof StorageQuotaError) {
      return false
    }
    throw err
  }
}

export async function dbDelete<T extends StoreName>(
  store: T,
  id: string,
): Promise<void> {
  await table(store).delete(id)
}

// ── Data export (unchanged logic) ───────────────────

interface ExportData {
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

export async function exportAllData(): Promise<ExportData> {
  const children = await dbGetAll('children')
  const sessions = await dbGetAll('sessions')
  const observations = await dbGetAll('observations')

  // Load settings from localStorage
  let settings: AppSettings = DEFAULT_SETTINGS
  try {
    const saved = localStorage.getItem('zpediscreen_settings')
    if (saved) settings = JSON.parse(saved)
  } catch { /* use defaults */ }

  // Build summary statistics
  const moduleBreakdown: Record<string, number> = {}
  const riskBreakdown = { no_risk: 0, possible_risk: 0, high_risk: 0 }

  for (const obs of observations) {
    moduleBreakdown[obs.moduleType] = (moduleBreakdown[obs.moduleType] || 0) + 1
    const risk = obs.aiAnnotations?.[0]?.riskCategory
    if (risk && risk in riskBreakdown) {
      riskBreakdown[risk as keyof typeof riskBreakdown]++
    }
  }

  return {
    exportId: `export-${Date.now()}`,
    exportedAt: new Date().toISOString(),
    appVersion: '2.0.0',
    region: localStorage.getItem('pediatric_app_region') || 'IN',
    settings: {
      schoolName: settings.schoolName,
      nurseName: settings.nurseName,
      academicYear: settings.academicYear,
    },
    children,
    sessions,
    observations,
    summary: {
      totalChildren: children.length,
      totalSessions: sessions.length,
      totalObservations: observations.length,
      moduleBreakdown,
      riskBreakdown,
    }
  }
}

export async function exportToFile(): Promise<void> {
  const data = await exportAllData()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  const schoolSlug = data.settings.schoolName ? `-${data.settings.schoolName.replace(/\s+/g, '_').toLowerCase()}` : ''
  a.download = `skidsscreen${schoolSlug}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  await dbPut('exports', {
    id: data.exportId,
    data: JSON.stringify(data),
    timestamp: data.exportedAt
  })
}

export async function exportToServer(serverUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const data = await exportAllData()

    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (response.ok) {
      return { success: true, message: `Exported ${data.summary.totalObservations} observations to server` }
    } else {
      return { success: false, message: `Server error: ${response.status}` }
    }
  } catch (error) {
    return { success: false, message: `Export failed: ${error}` }
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}
