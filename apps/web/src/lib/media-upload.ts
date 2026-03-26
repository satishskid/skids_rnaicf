

/**
 * Media Upload Orchestrator — connects observation evidence images to R2 storage.
 *
 * Flow:
 *   1. Nurse captures photo → base64 in observation
 *   2. Observation saved to IndexedDB (immediate, offline-safe)
 *   3. This module uploads base64 to R2 in background (non-blocking)
 *   4. On success: updates observation.mediaUrl in IndexedDB
 *   5. On sync: mediaUrl sent to server, base64 stripped
 *
 * Graceful degradation: if R2 is unavailable (offline, no creds),
 * images stay in IndexedDB as base64. No data loss.
 */

import type { Observation } from '@skids/shared'

interface MediaUploadResult {
  observationId: string
  mediaUrl?: string
  mediaUrls?: string[]
  error?: string
}

/**
 * Upload evidence images from an observation to R2.
 * Returns the R2 URLs on success, or error on failure.
 * Non-throwing — always returns a result object.
 */
export async function uploadObservationMedia(
  observation: Observation,
  campaignCode: string,
  childId: string,
): Promise<MediaUploadResult> {
  const result: MediaUploadResult = { observationId: observation.id }

  try {
    // Collect all base64 images from the observation
    const evidenceImage =
      observation.annotationData?.evidenceImage ||
      (observation.aiAnnotations[0]?.features?.evidenceImage as string | undefined)

    const videoFrames =
      observation.annotationData?.evidenceVideoFrames ||
      (observation.aiAnnotations[0]?.features?.evidenceVideoFrames as string[] | undefined)

    // Nothing to upload
    if (!evidenceImage && (!videoFrames || videoFrames.length === 0)) {
      return result
    }

    // Dynamic import to avoid loading R2 code until needed
    const { uploadEvidenceImage, uploadVideoFrames } = await import('@/lib/cloudflare/r2-storage')

    // Upload main evidence image
    if (evidenceImage && typeof evidenceImage === 'string' && evidenceImage.startsWith('data:')) {
      try {
        const url = await uploadEvidenceImage(
          campaignCode, childId, observation.id,
          evidenceImage, 'evidence.jpg'
        )
        result.mediaUrl = url
      } catch (err) {
        console.warn(`[MediaUpload] Evidence image upload failed for ${observation.id}:`, err)
        result.error = err instanceof Error ? err.message : 'Upload failed'
      }
    }

    // Upload video frames
    if (videoFrames && videoFrames.length > 0) {
      try {
        const urls = await uploadVideoFrames(
          campaignCode, childId, observation.id,
          videoFrames, 3 // max 3 key frames
        )
        if (urls.length > 0) {
          result.mediaUrls = urls
        }
      } catch (err) {
        console.warn(`[MediaUpload] Video frames upload failed for ${observation.id}:`, err)
      }
    }

    return result
  } catch (err) {
    console.warn(`[MediaUpload] Upload failed for ${observation.id}:`, err)
    return { ...result, error: err instanceof Error ? err.message : 'Upload failed' }
  }
}

/**
 * Strip base64 evidence images from an observation for lightweight sync.
 * Replaces base64 with mediaUrl reference if available.
 */
export function stripBase64FromObservation(obs: Observation): Observation {
  const cleaned = { ...obs }

  // Strip from annotationData
  if (cleaned.annotationData) {
    const { evidenceImage, evidenceVideoFrames, ...rest } = cleaned.annotationData
    // Only strip if we have mediaUrl (image is safely in R2)
    if (cleaned.mediaUrl || !evidenceImage) {
      cleaned.annotationData = rest as typeof cleaned.annotationData
    }
  }

  // Strip from features (aiAnnotations[0].features)
  if (cleaned.aiAnnotations?.[0]?.features) {
    const features = { ...cleaned.aiAnnotations[0].features }
    if (cleaned.mediaUrl || !features.evidenceImage) {
      delete features.evidenceImage
      delete features.evidenceVideoFrames
    }
    cleaned.aiAnnotations = [{ ...cleaned.aiAnnotations[0], features }]
  }

  return cleaned
}
