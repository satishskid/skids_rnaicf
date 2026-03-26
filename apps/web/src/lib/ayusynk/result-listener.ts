
/**
 * AyuSynk Result Listener — Detects when stethoscope reports arrive.
 *
 * After launching AyuShare via deep link, the report arrives asynchronously
 * via webhook (POST /api/ayusync/report) and is stored in Firestore.
 *
 * This module provides two strategies to detect arrival:
 *   A. Firestore onSnapshot (real-time, preferred)
 *   B. HTTP polling (fallback when Firestore client unavailable)
 *
 * Usage:
 *   const stop = listenForAyuSynkResult('DEMO', 'child123', (report) => {
 *     console.log('Report arrived:', report)
 *   })
 *   // Later: stop() to clean up
 */

import { clearPendingAyuSyncReport } from './deeplink'
import { getFirestoreDb } from '@/lib/firebase/config'
import { authFetch } from '@/lib/firebase/auth-fetch'

// ── Types ───────────────────────────────────────────

export interface AyuSynkWebhookReport {
  referenceId: string
  campaignCode: string
  childId: string
  reportData?: Record<string, unknown>
  receivedAt?: unknown // Firestore Timestamp
  processed?: boolean
  [key: string]: unknown
}

// ── Strategy A: Firestore onSnapshot ────────────────

async function listenViaFirestore(
  campaignCode: string,
  childId: string,
  onResult: (report: AyuSynkWebhookReport) => void,
  timeoutMs: number,
): Promise<() => void> {
  const db = getFirestoreDb()
  if (!db) {
    // Fall back to polling
    return pollForResult(campaignCode, childId, onResult, 8000, timeoutMs)
  }

  // Dynamic import to avoid bundling Firestore in non-Firebase builds
  const { collection, query, where, orderBy, onSnapshot, limit } = await import('firebase/firestore')

  const q = query(
    collection(db, 'campaigns', campaignCode, 'ayusync-reports'),
    where('childId', '==', childId),
    orderBy('receivedAt', 'desc'),
    limit(5)
  )

  let found = false

  const unsub = onSnapshot(q, (snap) => {
    if (found) return

    for (const change of snap.docChanges()) {
      if (change.type === 'added') {
        const data = change.doc.data() as AyuSynkWebhookReport
        if (!data.processed) {
          found = true
          onResult(data)
          // Clear from pending
          const refId = `${campaignCode}_${childId}`
          clearPendingAyuSyncReport(refId)
          unsub()
          break
        }
      }
    }
  }, (error) => {
    console.warn('[AyuSynk] Firestore listener error, falling back to polling:', error)
    unsub()
    // Fall back to polling on error
    pollForResult(campaignCode, childId, onResult, 8000, timeoutMs)
  })

  // Auto-timeout
  const timeout = setTimeout(() => {
    if (!found) {
      unsub()
    }
  }, timeoutMs)

  return () => {
    clearTimeout(timeout)
    unsub()
  }
}

// ── Strategy B: HTTP Polling ────────────────────────

function pollForResult(
  campaignCode: string,
  childId: string,
  onResult: (report: AyuSynkWebhookReport) => void,
  intervalMs: number,
  timeoutMs: number,
): () => void {
  let cancelled = false
  const startTime = Date.now()

  const poll = async () => {
    if (cancelled) return
    if (Date.now() - startTime > timeoutMs) {
      cancelled = true
      return
    }

    try {
      const res = await authFetch(
        `/api/ayusync/report?campaign=${encodeURIComponent(campaignCode)}&child=${encodeURIComponent(childId)}`
      )

      if (res.ok) {
        const data = await res.json()
        if (data.reports && data.reports.length > 0) {
          // Find the most recent unprocessed report
          const unprocessed = data.reports.find(
            (r: AyuSynkWebhookReport) => !r.processed
          )
          if (unprocessed) {
            cancelled = true
            onResult(unprocessed)
            // Clear from pending
            const refId = `${campaignCode}_${childId}`
            clearPendingAyuSyncReport(refId)
            return
          }
        }
      }
    } catch {
      // Network error — keep polling
    }

    if (!cancelled) {
      setTimeout(poll, intervalMs)
    }
  }

  // Start polling after a short initial delay
  setTimeout(poll, 3000)

  return () => {
    cancelled = true
  }
}

// ── Public API ──────────────────────────────────────

/**
 * Listen for an AyuSynk result for a specific child.
 * Uses Firestore real-time listener (preferred) or HTTP polling (fallback).
 *
 * @param campaignCode - The campaign code
 * @param childId - The child ID
 * @param onResult - Callback when result arrives
 * @param options - Optional timeout (default: 5 minutes)
 * @returns Cleanup function to stop listening
 */
export function listenForAyuSynkResult(
  campaignCode: string,
  childId: string,
  onResult: (report: AyuSynkWebhookReport) => void,
  options?: { timeoutMs?: number }
): () => void {
  const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000 // 5 minutes default

  let cleanup: (() => void) | null = null

  // Start listening (async, but return cleanup immediately)
  listenViaFirestore(campaignCode, childId, onResult, timeoutMs)
    .then(fn => {
      cleanup = fn
    })
    .catch(() => {
      // If Firestore fails entirely, fall back to polling
      cleanup = pollForResult(campaignCode, childId, onResult, 8000, timeoutMs)
    })

  // Return a cleanup function that works even if async setup hasn't finished
  return () => {
    if (cleanup) cleanup()
  }
}
