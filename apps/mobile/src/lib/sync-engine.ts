// Offline sync engine for SKIDS Screen V3 mobile app
// Queues observations locally when offline and syncs when connectivity returns

import { useState, useEffect, useRef, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { apiCall } from './api'

// ── Types ──────────────────────────────────────────

export interface QueuedObservation {
  id: string
  observation: Record<string, unknown>
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  retryCount: number
  addedAt: string
  lastAttempt?: string
  error?: string
}

export interface SyncResult {
  synced: number
  failed: number
  errors: string[]
}

// ── Constants ──────────────────────────────────────

const STORAGE_KEY = '@skids/sync-queue'
const MAX_RETRIES = 3
const POLL_INTERVAL = 10_000
const AUTO_SYNC_INTERVAL = 60_000

// ── Storage helpers ────────────────────────────────

async function loadQueue(): Promise<QueuedObservation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as QueuedObservation[]
  } catch {
    return []
  }
}

async function saveQueue(queue: QueuedObservation[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

function generateId(): string {
  return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function getRetryDelay(retryCount: number): number {
  return Math.min(30_000, 1000 * Math.pow(2, retryCount))
}

// ── Network check ──────────────────────────────────

async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch()
    return state.isConnected === true && state.isInternetReachable !== false
  } catch {
    return true
  }
}

// ── Queue operations ───────────────────────────────

export async function addToSyncQueue(
  observation: Record<string, unknown>
): Promise<string> {
  const id = generateId()
  const entry: QueuedObservation = {
    id,
    observation,
    status: 'pending',
    retryCount: 0,
    addedAt: new Date().toISOString(),
  }

  const queue = await loadQueue()
  queue.push(entry)
  await saveQueue(queue)
  return id
}

export async function getSyncQueue(): Promise<QueuedObservation[]> {
  return loadQueue()
}

export async function getPendingCount(): Promise<number> {
  const queue = await loadQueue()
  return queue.filter(
    (item) => item.status === 'pending' || item.status === 'failed'
  ).length
}

// ── Sync single item ───────────────────────────────

export async function syncSingle(
  id: string,
  token: string
): Promise<boolean> {
  const queue = await loadQueue()
  const index = queue.findIndex((item) => item.id === id)
  if (index === -1) return false

  const item = queue[index]
  if (item.status === 'synced') return true
  if (item.retryCount >= MAX_RETRIES) return false

  const online = await isOnline()
  if (!online) return false

  queue[index] = { ...item, status: 'syncing', lastAttempt: new Date().toISOString() }
  await saveQueue(queue)

  try {
    await apiCall('/api/observations', {
      method: 'POST',
      token,
      body: JSON.stringify(item.observation),
    })

    const updated = await loadQueue()
    const idx = updated.findIndex((q) => q.id === id)
    if (idx !== -1) {
      updated[idx] = { ...updated[idx], status: 'synced', error: undefined }
      await saveQueue(updated)
    }
    return true
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    const updated = await loadQueue()
    const idx = updated.findIndex((q) => q.id === id)
    if (idx !== -1) {
      const newRetryCount = updated[idx].retryCount + 1
      updated[idx] = {
        ...updated[idx],
        status: newRetryCount >= MAX_RETRIES ? 'failed' : 'pending',
        retryCount: newRetryCount,
        error: errorMsg,
      }
      await saveQueue(updated)
    }
    return false
  }
}

// ── Batch sync ─────────────────────────────────────

export async function syncNow(token: string): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, errors: [] }

  const online = await isOnline()
  if (!online) {
    result.errors.push('No network connection')
    return result
  }

  const queue = await loadQueue()
  const syncable = queue.filter(
    (item) =>
      item.status === 'pending' ||
      (item.status === 'failed' && item.retryCount < MAX_RETRIES)
  )

  if (syncable.length === 0) return result

  const now = Date.now()
  const ready = syncable.filter((item) => {
    if (!item.lastAttempt || item.retryCount === 0) return true
    const delay = getRetryDelay(item.retryCount)
    const elapsed = now - new Date(item.lastAttempt).getTime()
    return elapsed >= delay
  })

  if (ready.length === 0) return result

  // Mark as syncing
  const updated = await loadQueue()
  const readyIds = new Set(ready.map((r) => r.id))
  for (const item of updated) {
    if (readyIds.has(item.id)) {
      item.status = 'syncing'
      item.lastAttempt = new Date().toISOString()
    }
  }
  await saveQueue(updated)

  // Attempt batch sync
  const observations = ready.map((item) => item.observation)

  try {
    const response = await apiCall<{
      synced: number
      total: number
      errors?: string[]
      message: string
    }>('/api/observations/sync', {
      method: 'POST',
      token,
      body: JSON.stringify({ observations }),
    })

    result.synced = response.synced
    result.failed = (response.total || ready.length) - response.synced
    if (response.errors) result.errors.push(...response.errors)

    // Update queue status
    const final = await loadQueue()
    for (const item of final) {
      if (readyIds.has(item.id)) {
        if (result.failed === 0) {
          item.status = 'synced'
          item.error = undefined
        } else {
          item.status = 'synced'
          item.error = undefined
        }
      }
    }
    await saveQueue(final)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Batch sync failed'
    result.errors.push(errorMsg)

    // Fallback: sync individually
    for (const item of ready) {
      const success = await syncSingle(item.id, token)
      if (success) result.synced++
      else result.failed++
    }
  }

  return result
}

// ── Queue cleanup ──────────────────────────────────

export async function clearSynced(): Promise<number> {
  const queue = await loadQueue()
  const remaining = queue.filter((item) => item.status !== 'synced')
  const removed = queue.length - remaining.length
  await saveQueue(remaining)
  return removed
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

// ── React hook ─────────────────────────────────────

export function useSyncEngine(token: string | null) {
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  const tokenRef = useRef(token)
  tokenRef.current = token

  const refreshCount = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  const triggerSync = useCallback(async () => {
    const currentToken = tokenRef.current
    if (!currentToken || isSyncing) return

    setIsSyncing(true)
    try {
      await syncNow(currentToken)
      setLastSyncAt(new Date().toISOString())
      await clearSynced()
    } finally {
      setIsSyncing(false)
      await refreshCount()
    }
  }, [isSyncing, refreshCount])

  const addObservation = useCallback(
    async (obs: Record<string, unknown>): Promise<string> => {
      const id = await addToSyncQueue(obs)
      await refreshCount()
      return id
    },
    [refreshCount]
  )

  // Poll pending count
  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refreshCount])

  // Auto-sync when pending items exist
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentToken = tokenRef.current
      if (!currentToken) return

      const count = await getPendingCount()
      if (count === 0) return

      const online = await isOnline()
      if (!online) return

      setIsSyncing(true)
      try {
        await syncNow(currentToken)
        setLastSyncAt(new Date().toISOString())
        await clearSynced()
      } finally {
        setIsSyncing(false)
        await refreshCount()
      }
    }, AUTO_SYNC_INTERVAL)

    return () => clearInterval(interval)
  }, [refreshCount])

  return {
    pendingCount,
    isSyncing,
    lastSyncAt,
    syncNow: triggerSync,
    addObservation,
  }
}
