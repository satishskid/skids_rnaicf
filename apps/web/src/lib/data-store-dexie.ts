/**
 * DexieDataStore — Dexie/IndexedDB implementation of the DataStore interface.
 *
 * Wraps the existing Dexie database with sync-state–aware operations.
 * saveObservation() automatically creates a syncState record with status 'pending'.
 */

import type { Child, ExamSession, Observation } from '@skids/shared'
import {
  db,
  type SyncStateRecord,
  type SyncMetaRecord,
  type MediaSyncStatus,
} from './db-utils'
import type { DataStore, ExportData } from './data-store'

// ── Helpers ─────────────────────────────────────────

async function safePut(tableName: 'children' | 'sessions' | 'observations', data: unknown): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db[tableName] as any).put(data)
    return true
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22)
    ) {
      return false
    }
    throw err
  }
}

// ── DexieDataStore ──────────────────────────────────

class DexieDataStore implements DataStore {
  // ── Children ──

  async getChild(id: string): Promise<Child | undefined> {
    return db.children.get(id)
  }

  async getAllChildren(): Promise<Child[]> {
    return db.children.toArray()
  }

  async saveChild(child: Child): Promise<boolean> {
    return safePut('children', child)
  }

  async deleteChild(id: string): Promise<void> {
    await db.children.delete(id)
  }

  // ── Sessions ──

  async getSession(id: string): Promise<ExamSession | undefined> {
    return db.sessions.get(id)
  }

  async getAllSessions(): Promise<ExamSession[]> {
    return db.sessions.toArray()
  }

  async saveSession(session: ExamSession): Promise<boolean> {
    return safePut('sessions', session)
  }

  // ── Observations ──

  async getObservation(id: string): Promise<Observation | undefined> {
    return db.observations.get(id)
  }

  async getAllObservations(): Promise<Observation[]> {
    return db.observations.toArray()
  }

  async saveObservation(obs: Observation): Promise<boolean> {
    const ok = await safePut('observations', obs)
    if (!ok) return false

    // Auto-create syncState if not exists
    const existing = await db.syncState.get(obs.id)
    if (!existing) {
      await db.syncState.put({
        id: obs.id,
        entityType: 'observation',
        status: 'pending',
        syncedAt: null,
        attempts: 0,
        lastAttemptAt: null,
        lastError: null,
        mediaStatus: this.hasMedia(obs) ? 'pending' : 'not_applicable',
        mediaUrl: obs.mediaUrl || null,
        mediaError: null,
      })
    }
    return true
  }

  async deleteObservation(id: string): Promise<void> {
    await db.observations.delete(id)
    await db.syncState.delete(id).catch(() => {})
  }

  // ── Sync State ──

  async getSyncState(obsId: string): Promise<SyncStateRecord | undefined> {
    return db.syncState.get(obsId)
  }

  async getAllSyncStates(): Promise<SyncStateRecord[]> {
    return db.syncState.toArray()
  }

  async getUnsyncedObservations(): Promise<Observation[]> {
    const unsyncedStates = await db.syncState
      .where('status')
      .anyOf('pending', 'failed', 'syncing')
      .toArray()

    if (unsyncedStates.length === 0) return []

    const ids = unsyncedStates.map(s => s.id)
    const observations = await db.observations.bulkGet(ids)
    return observations.filter((o): o is Observation => o !== undefined)
  }

  async getPendingSyncStates(): Promise<SyncStateRecord[]> {
    return db.syncState
      .where('status')
      .anyOf('pending', 'failed')
      .toArray()
  }

  async getFailedSyncStates(): Promise<SyncStateRecord[]> {
    return db.syncState
      .where('status')
      .equals('failed')
      .toArray()
  }

  async setSyncState(record: SyncStateRecord): Promise<void> {
    await db.syncState.put(record)
  }

  async markSynced(obsId: string, timestamp: string): Promise<void> {
    const existing = await db.syncState.get(obsId)
    if (existing) {
      await db.syncState.put({
        ...existing,
        status: 'synced',
        syncedAt: timestamp,
        lastError: null,
      })
    } else {
      await db.syncState.put({
        id: obsId,
        entityType: 'observation',
        status: 'synced',
        syncedAt: timestamp,
        attempts: 1,
        lastAttemptAt: timestamp,
        lastError: null,
        mediaStatus: 'not_applicable',
        mediaUrl: null,
        mediaError: null,
      })
    }
  }

  async markSyncFailed(obsId: string, error: string, permanent = false): Promise<void> {
    const existing = await db.syncState.get(obsId)
    const now = new Date().toISOString()
    if (existing) {
      await db.syncState.put({
        ...existing,
        status: permanent ? 'permanent_failure' : 'failed',
        lastError: error,
        lastAttemptAt: now,
        attempts: existing.attempts + 1,
      })
    } else {
      await db.syncState.put({
        id: obsId,
        entityType: 'observation',
        status: permanent ? 'permanent_failure' : 'failed',
        syncedAt: null,
        attempts: 1,
        lastAttemptAt: now,
        lastError: error,
        mediaStatus: 'not_applicable',
        mediaUrl: null,
        mediaError: null,
      })
    }
  }

  async markSyncing(obsId: string): Promise<void> {
    const existing = await db.syncState.get(obsId)
    if (existing) {
      await db.syncState.put({
        ...existing,
        status: 'syncing',
        lastAttemptAt: new Date().toISOString(),
      })
    }
  }

  async markMediaStatus(obsId: string, status: MediaSyncStatus, urlOrError?: string): Promise<void> {
    const existing = await db.syncState.get(obsId)
    if (existing) {
      const update: Partial<SyncStateRecord> = { mediaStatus: status }
      if (status === 'uploaded' && urlOrError) {
        update.mediaUrl = urlOrError
        update.mediaError = null
      } else if (status === 'failed' && urlOrError) {
        update.mediaError = urlOrError
      }
      await db.syncState.put({ ...existing, ...update })
    }
  }

  // ── Sync Meta ──

  async getSyncMeta(key: string): Promise<SyncMetaRecord | undefined> {
    return db.syncMeta.get(key)
  }

  async updateSyncMeta(key: string, update: Partial<SyncMetaRecord>): Promise<void> {
    const existing = await db.syncMeta.get(key)
    if (existing) {
      await db.syncMeta.put({ ...existing, ...update })
    } else {
      await db.syncMeta.put({
        key,
        lastSyncAt: null,
        lastSuccessfulSyncAt: null,
        lastSyncResult: null,
        pendingCount: 0,
        failedCount: 0,
        ...update,
      })
    }
  }

  // ── Bulk ──

  async bulkSaveChildren(children: Child[]): Promise<{ saved: number; failed: number }> {
    let saved = 0
    let failed = 0
    for (const child of children) {
      const ok = await this.saveChild(child)
      if (ok) saved++
      else failed++
    }
    return { saved, failed }
  }

  // ── Export ──

  async exportAllData(): Promise<ExportData> {
    const children = await this.getAllChildren()
    const sessions = await this.getAllSessions()
    const observations = await this.getAllObservations()

    let settings: { schoolName: string; nurseName: string; academicYear: string } = {
      schoolName: '',
      nurseName: '',
      academicYear: new Date().getFullYear().toString(),
    }
    try {
      const saved = typeof localStorage !== 'undefined'
        ? localStorage.getItem('zpediscreen_settings')
        : null
      if (saved) {
        const parsed = JSON.parse(saved)
        settings = {
          schoolName: parsed.schoolName || '',
          nurseName: parsed.nurseName || '',
          academicYear: parsed.academicYear || settings.academicYear,
        }
      }
    } catch { /* use defaults */ }

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
      region: typeof localStorage !== 'undefined'
        ? (localStorage.getItem('pediatric_app_region') || 'IN')
        : 'IN',
      settings,
      children,
      sessions,
      observations,
      summary: {
        totalChildren: children.length,
        totalSessions: sessions.length,
        totalObservations: observations.length,
        moduleBreakdown,
        riskBreakdown,
      },
    }
  }

  // ── Private helpers ──

  private hasMedia(obs: Observation): boolean {
    return !!(
      obs.annotationData?.evidenceImage ||
      (obs.annotationData?.evidenceVideoFrames && obs.annotationData.evidenceVideoFrames.length > 0) ||
      (obs.annotationData?.captures && obs.annotationData.captures.length > 0)
    )
  }
}

// ── Factory ─────────────────────────────────────────

let _instance: DexieDataStore | null = null

/**
 * Get the singleton DataStore instance.
 * Currently returns DexieDataStore. Swap to TursoDataStore later.
 */
export function createDataStore(): DataStore {
  if (!_instance) {
    _instance = new DexieDataStore()
  }
  return _instance
}
