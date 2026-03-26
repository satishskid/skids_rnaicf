/**
 * Vercel KV (Upstash Redis) Sync Backend
 *
 * Wraps the existing /api/campaigns/[code]/sync endpoint
 * into the ISyncBackend interface for the pluggable sync system.
 *
 * This is the default backend that ships with SKIDS Screen.
 * It stores observations in Redis with a 90-day TTL.
 */

import { ISyncBackend, SyncPushPayload, SyncPushResult, SyncPullResult } from './types'

export class VercelKVBackend implements ISyncBackend {
  name = 'vercel-kv'

  async push(payload: SyncPushPayload): Promise<SyncPushResult> {
    try {
      const response = await fetch(`/api/campaigns/${payload.eventCode}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: payload.deviceId,
          nurseName: payload.nurseName,
          nursePin: '', // PIN no longer required in new architecture
          observations: payload.observations.map(obs => ({
            id: obs.id,
            sessionId: obs.sessionId,
            childId: obs.captureMetadata?.childId,
            moduleType: obs.moduleType,
            bodyRegion: obs.bodyRegion,
            timestamp: obs.timestamp,
            riskCategory: obs.aiAnnotations?.[0]?.riskCategory || 'no_risk',
            summaryText: obs.aiAnnotations?.[0]?.summaryText || '',
            confidence: obs.aiAnnotations?.[0]?.confidence || 0,
            features: obs.aiAnnotations?.[0]?.features || {},
            // NOTE: annotationData is sent WITHOUT evidenceImage (stripped by SyncManager)
            annotationData: obs.annotationData,
          })),
          syncedAt: payload.syncedAt,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        return {
          success: false,
          syncedIds: [],
          failedIds: payload.observations.map(o => o.id),
          error: `HTTP ${response.status}: ${errorText}`,
        }
      }

      // All observations synced successfully
      return {
        success: true,
        syncedIds: payload.observations.map(o => o.id),
        failedIds: [],
      }
    } catch (err) {
      return {
        success: false,
        syncedIds: [],
        failedIds: payload.observations.map(o => o.id),
        error: err instanceof Error ? err.message : 'Network error',
      }
    }
  }

  async pull(eventCode: string): Promise<SyncPullResult> {
    try {
      const response = await fetch(`/api/campaigns/${eventCode}`)

      if (!response.ok) {
        return {
          success: false,
          observations: [],
          children: [],
          error: `HTTP ${response.status}`,
        }
      }

      const data = await response.json()

      return {
        success: true,
        observations: data.observations || [],
        children: data.children || [],
      }
    } catch (err) {
      return {
        success: false,
        observations: [],
        children: [],
        error: err instanceof Error ? err.message : 'Network error',
      }
    }
  }

  async uploadMedia(_file: Blob, _key: string): Promise<string> {
    // Vercel KV doesn't support binary storage.
    // Evidence images are included as base64 in annotationData for this backend.
    // The SyncManager strips them for bandwidth, but they're still in IndexedDB.
    return `indexeddb://${_key}`
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/api', { method: 'GET' })
      return response.ok
    } catch {
      return false
    }
  }
}
