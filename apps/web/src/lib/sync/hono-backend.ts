/**
 * Hono Backend — ISyncBackend implementation for V3 Cloudflare Workers API.
 *
 * Replaces firebase-backend.ts. Syncs observations to the Hono API
 * which stores them in Turso (libSQL/SQLite).
 */

import { authFetch } from '@/lib/api'
import type { ISyncBackend, SyncPushPayload, SyncPushResult, SyncPullResult } from './types'

export class HonoBackend implements ISyncBackend {
  name = 'hono'

  async push(payload: SyncPushPayload): Promise<SyncPushResult> {
    try {
      const res = await authFetch(`/api/observations/sync`, {
        method: 'POST',
        body: JSON.stringify({
          campaignCode: payload.eventCode,
          deviceId: payload.deviceId,
          nurseName: payload.nurseName,
          observations: payload.observations,
          syncedAt: payload.syncedAt,
          gpsCoordinates: payload.gpsCoordinates,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          success: false,
          syncedIds: [],
          failedIds: payload.observations.map(o => o.id),
          error: `HTTP ${res.status}: ${text}`,
        }
      }

      const data = await res.json() as { synced?: number; syncedIds?: string[] }
      return {
        success: true,
        syncedIds: data.syncedIds || payload.observations.map(o => o.id),
        failedIds: [],
      }
    } catch (err) {
      return {
        success: false,
        syncedIds: [],
        failedIds: payload.observations.map(o => o.id),
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  async pull(eventCode: string): Promise<SyncPullResult> {
    try {
      const res = await authFetch(`/api/observations?campaign=${eventCode}`)
      if (!res.ok) {
        return { success: false, observations: [], children: [], error: `HTTP ${res.status}` }
      }
      const data = await res.json() as { observations?: unknown[]; children?: unknown[] }
      return {
        success: true,
        observations: (data.observations || []) as SyncPullResult['observations'],
        children: (data.children || []) as SyncPullResult['children'],
      }
    } catch (err) {
      return {
        success: false,
        observations: [],
        children: [],
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  async uploadMedia(file: Blob, key: string): Promise<string> {
    // Get presigned URL from worker
    const res = await authFetch('/api/r2/presign', {
      method: 'POST',
      body: JSON.stringify({ key, contentType: file.type, size: file.size }),
    })

    if (!res.ok) throw new Error(`Presign failed: ${res.status}`)
    const { uploadUrl, publicUrl } = await res.json() as { uploadUrl: string; publicUrl: string }

    // Direct upload to R2
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })

    if (!uploadRes.ok) throw new Error(`R2 upload failed: ${uploadRes.status}`)
    return publicUrl
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await authFetch('/api/health')
      return res.ok
    } catch {
      return false
    }
  }
}
