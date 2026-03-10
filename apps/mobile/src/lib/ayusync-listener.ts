/**
 * AyuSynk Result Listener — Polls backend for stethoscope reports after deep link launch.
 *
 * After launching AyuShare via deep link, the report arrives asynchronously
 * via webhook (POST /api/ayusync/report) to our worker, stored in Turso.
 *
 * This module polls GET /api/ayusync/report?campaign=X&child=Y until
 * an unprocessed report appears.
 */

import { API_BASE } from './api'
import { clearPendingAyuSyncReport } from './ayusync-deeplink'

export interface AyuSynkScreeningResult {
  confidence_score: number
  condition: string
  description: string
  condition_detected: string // "true" or "false"
  type?: string // Murmur type
}

export interface AyuSynkReport {
  heart_bpm: string
  location: string // "heart" | "lungs"
  position: string // "aortic" | "pulmonic" | "tricuspid" | "mitral"
  report_url: string
  screening_results: AyuSynkScreeningResult[]
}

export interface AyuSynkWebhookReport {
  id: string
  referenceId: string
  campaignCode: string
  childId: string
  status: string
  reports: AyuSynkReport[]
  processed: boolean
  receivedAt: string
}

/**
 * Poll for AyuSynk result for a specific child.
 *
 * @returns Cleanup function to stop polling
 */
export function listenForAyuSynkResult(
  campaignCode: string,
  childId: string,
  token: string,
  onResult: (report: AyuSynkWebhookReport) => void,
  options?: { intervalMs?: number; timeoutMs?: number }
): () => void {
  const intervalMs = options?.intervalMs ?? 8000
  const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000 // 5 min
  let cancelled = false
  const startTime = Date.now()

  const poll = async () => {
    if (cancelled) return
    if (Date.now() - startTime > timeoutMs) {
      cancelled = true
      return
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/ayusync/report?campaign=${encodeURIComponent(campaignCode)}&child=${encodeURIComponent(childId)}`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      )

      if (res.ok) {
        const data = await res.json() as { reports?: AyuSynkWebhookReport[] }
        if (data.reports && data.reports.length > 0) {
          const unprocessed = data.reports.find(r => !r.processed)
          if (unprocessed) {
            cancelled = true
            onResult(unprocessed)
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

  // Start polling after initial delay (give AyuShare time to process)
  setTimeout(poll, 3000)

  return () => { cancelled = true }
}
