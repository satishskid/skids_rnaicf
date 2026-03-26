

/**
 * Firebase Sync Backend — ISyncBackend implementation using Firestore.
 *
 * Advantages over Vercel KV:
 *   - Real-time sync (onSnapshot listeners)
 *   - Built-in offline persistence (IndexedDB cache)
 *   - No TTL — data persists until explicitly deleted
 *   - Batched writes (up to 500 docs per batch)
 *   - Security rules per-user (via Firebase Auth)
 *
 * Cost for 20K screenings/month (~$9 estimate):
 *   - Firestore: ~50K writes, ~200K reads → ~$1-2
 *   - Firebase Auth: free for anonymous users
 *   - Cloudflare R2: storage for images → ~$1-3
 *   - Cloudflare AI Gateway: pay-per-use → ~$3-5
 */

import { ISyncBackend, SyncPushPayload, SyncPushResult, SyncPullResult } from './types'
import { isFirebaseConfigured } from '@/lib/firebase/config'
import { getCurrentUser } from '@/lib/firebase/auth'
import {
  pushObservations,
  pullObservations,
  getChildren,
  type FirestoreObservation,
} from '@/lib/firebase/firestore'
import type { Observation, Child } from '@skids/shared'

export class FirebaseBackend implements ISyncBackend {
  name = 'firebase'

  async push(payload: SyncPushPayload): Promise<SyncPushResult> {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        syncedIds: [],
        failedIds: payload.observations.map(o => o.id),
        error: 'Firebase not configured',
      }
    }

    // Ensure authenticated
    const user = getCurrentUser()
    if (!user) {
      return {
        success: false,
        syncedIds: [],
        failedIds: payload.observations.map(o => o.id),
        error: 'Firebase auth failed',
      }
    }

    // Map observations to Firestore format
    const firestoreObs: FirestoreObservation[] = payload.observations.map(obs => ({
      id: obs.id,
      sessionId: obs.sessionId,
      childId: obs.captureMetadata?.childId || '',
      moduleType: obs.moduleType,
      bodyRegion: obs.bodyRegion,
      timestamp: obs.timestamp,
      riskCategory: obs.aiAnnotations?.[0]?.riskCategory || 'no_risk',
      summaryText: obs.aiAnnotations?.[0]?.summaryText || '',
      confidence: obs.aiAnnotations?.[0]?.confidence || 0,
      features: obs.aiAnnotations?.[0]?.features || {},
      annotationData: obs.annotationData ? {
        selectedChips: obs.annotationData.selectedChips,
        chipSeverities: obs.annotationData.chipSeverities,
        notes: obs.annotationData.notes,
      } : undefined,
      _deviceId: payload.deviceId,
      _nurseName: payload.nurseName,
      _syncedAt: payload.syncedAt,
      ...(payload.gpsCoordinates ? {
        _gpsLat: payload.gpsCoordinates.lat,
        _gpsLng: payload.gpsCoordinates.lng,
      } : {}),
    } as FirestoreObservation))

    const result = await pushObservations(payload.eventCode, firestoreObs)

    return {
      success: result.failedIds.length === 0,
      syncedIds: result.syncedIds,
      failedIds: result.failedIds,
      error: result.failedIds.length > 0 ? `${result.failedIds.length} observations failed to sync` : undefined,
    }
  }

  async pull(eventCode: string): Promise<SyncPullResult> {
    if (!isFirebaseConfigured()) {
      return { success: false, observations: [], children: [], error: 'Firebase not configured' }
    }

    const user = getCurrentUser()
    if (!user) {
      return { success: false, observations: [], children: [], error: 'Firebase auth failed' }
    }

    try {
      const [firestoreObs, firestoreChildren] = await Promise.all([
        pullObservations(eventCode),
        getChildren(eventCode),
      ])

      // Map back to app Observation format
      const observations: Observation[] = firestoreObs.map(fo => ({
        id: fo.id,
        sessionId: fo.sessionId,
        moduleType: fo.moduleType as Observation['moduleType'],
        bodyRegion: fo.bodyRegion,
        timestamp: fo.timestamp,
        captureMetadata: { childId: fo.childId } as Observation['captureMetadata'],
        aiAnnotations: [{
          id: `ai-${fo.id}`,
          modelId: 'firebase-sync',
          timestamp: fo.timestamp,
          riskCategory: fo.riskCategory as 'no_risk' | 'possible_risk' | 'high_risk',
          summaryText: fo.summaryText,
          confidence: fo.confidence,
          features: fo.features,
          annotations: [],
        }],
        annotationData: fo.annotationData ? {
          selectedChips: fo.annotationData.selectedChips || [],
          chipSeverities: (fo.annotationData.chipSeverities || {}) as Record<string, 'normal' | 'mild' | 'moderate' | 'severe'>,
          pins: [],
          aiSuggestedChips: [],
          notes: fo.annotationData.notes || '',
        } : undefined,
      }))

      const children: Child[] = firestoreChildren.map(fc => ({
        id: fc.id,
        name: fc.name,
        dob: fc.dob || '',
        gender: (fc.gender || 'male') as 'male' | 'female',
        location: '',
        createdAt: '',
        updatedAt: '',
      }))

      return { success: true, observations, children }
    } catch (err) {
      return {
        success: false,
        observations: [],
        children: [],
        error: err instanceof Error ? err.message : 'Pull failed',
      }
    }
  }

  async uploadMedia(file: Blob, key: string): Promise<string> {
    // Media uploads go to Cloudflare R2 (not Firebase Storage)
    // Firebase is only used for metadata sync
    try {
      const { uploadToR2 } = await import('@/lib/cloudflare/r2-storage')
      return await uploadToR2(file, key)
    } catch (err) {
      throw new Error(`R2 upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!isFirebaseConfigured()) return false
    try {
      const user = getCurrentUser()
      return !!user
    } catch {
      return false
    }
  }
}
