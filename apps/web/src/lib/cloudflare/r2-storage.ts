/**
 * R2 Storage Client — uploads evidence images to Cloudflare R2 via Worker API.
 *
 * Uses POST /api/r2/upload (direct R2 binding, no S3 API keys needed).
 * Images are base64-encoded in the request body and stored in R2 with
 * the path: {campaignCode}/{childId}/{observationId}/{filename}
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://skids-api.satish-9f4.workers.dev'

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token')
}

function dataUrlToBase64(dataUrl: string): { base64: string; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { contentType: match[1], base64: match[2] }
  }
  // If no data URL prefix, assume JPEG
  return { contentType: 'image/jpeg', base64: dataUrl }
}

async function uploadToR2(key: string, base64Data: string, contentType: string): Promise<string> {
  const token = getAuthToken()
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${API_BASE}/api/r2/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ key, contentType, data: base64Data }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error || `R2 upload failed: ${res.status}`)
  }

  const result = await res.json() as { key: string }
  // Return the R2 file URL via our download endpoint
  return `${API_BASE}/api/r2/file/${result.key}`
}

/**
 * Upload a single evidence image to R2.
 * @param campaignCode - Campaign identifier
 * @param childId - Child identifier
 * @param observationId - Observation identifier
 * @param dataUrl - Base64 data URL (data:image/jpeg;base64,...)
 * @param filename - Filename for storage (e.g., "evidence.jpg")
 * @returns R2 download URL
 */
export async function uploadEvidenceImage(
  campaignCode: string,
  childId: string,
  observationId: string,
  dataUrl: string,
  filename: string,
): Promise<string> {
  const { base64, contentType } = dataUrlToBase64(dataUrl)
  const key = `${campaignCode}/${childId}/${observationId}/${filename}`
  return uploadToR2(key, base64, contentType)
}

/**
 * Upload video key frames to R2.
 * @param campaignCode - Campaign identifier
 * @param childId - Child identifier
 * @param observationId - Observation identifier
 * @param frames - Array of base64 data URLs
 * @param maxFrames - Maximum frames to upload (default 3)
 * @returns Array of R2 download URLs
 */
export async function uploadVideoFrames(
  campaignCode: string,
  childId: string,
  observationId: string,
  frames: string[],
  maxFrames = 3,
): Promise<string[]> {
  const selected = frames.slice(0, maxFrames)
  const urls: string[] = []

  for (let i = 0; i < selected.length; i++) {
    try {
      const { base64, contentType } = dataUrlToBase64(selected[i])
      const key = `${campaignCode}/${childId}/${observationId}/frame-${i}.jpg`
      const url = await uploadToR2(key, base64, contentType)
      urls.push(url)
    } catch (err) {
      console.warn(`[R2] Frame ${i} upload failed:`, err)
    }
  }

  return urls
}
