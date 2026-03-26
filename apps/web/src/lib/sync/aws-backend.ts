/**
 * AWS Sync Backend — STUB FOR YOUR DEV TEAM
 *
 * ============================================================
 * HOW TO IMPLEMENT:
 * ============================================================
 *
 * 1. Set your AWS configuration below (Cognito, API Gateway, S3)
 * 2. Implement each method following the TODO comments
 * 3. The SyncManager will automatically use this backend
 *    alongside the Vercel KV backend
 *
 * WHAT YOU NEED:
 * - AWS Cognito User Pool ID + App Client ID
 * - API Gateway base URL (for push/pull endpoints)
 * - S3 presigned URL endpoint (for evidence image uploads)
 *
 * DATA FORMAT:
 * - Observations follow the SyncableObservation type (see types.ts)
 * - Evidence images are Blobs (JPEG, ~100-500KB each)
 * - Each observation has a stable ID for deduplication
 *
 * AUTHENTICATION:
 * - Call isAvailable() to check if the nurse has a valid Cognito token
 * - Add the JWT as a Bearer token to all API Gateway requests
 * - Tokens should be stored in localStorage after Cognito login
 * ============================================================
 */

import { ISyncBackend, SyncPushPayload, SyncPushResult, SyncPullResult } from './types'

// ============================================
// CONFIGURATION — FILL IN YOUR AWS DETAILS
// ============================================

const AWS_CONFIG = {
  // API Gateway base URL (e.g., 'https://abc123.execute-api.ap-south-1.amazonaws.com/prod')
  apiBaseUrl: process.env.NEXT_PUBLIC_AWS_API_URL || '',

  // Cognito User Pool details
  cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
  cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',

  // S3 presigned URL endpoint
  s3PresignedEndpoint: process.env.NEXT_PUBLIC_AWS_S3_PRESIGN_URL || '',
}

// ============================================
// HELPER: Get Cognito JWT from localStorage
// ============================================

function getCognitoToken(): string | null {
  // TODO: Implement based on your Cognito setup
  // If using amazon-cognito-identity-js:
  //   const session = cognitoUser.getSignInUserSession()
  //   return session?.getIdToken().getJwtToken() || null
  //
  // If using @aws-amplify/auth:
  //   const session = await Auth.currentSession()
  //   return session.getIdToken().getJwtToken()
  //
  // Simple approach — store token in localStorage after login:
  try {
    return localStorage.getItem('skids_cognito_token')
  } catch {
    return null
  }
}

// ============================================
// AWS BACKEND IMPLEMENTATION
// ============================================

export class AWSBackend implements ISyncBackend {
  name = 'aws'

  async push(payload: SyncPushPayload): Promise<SyncPushResult> {
    const token = getCognitoToken()
    if (!token) {
      return {
        success: false,
        syncedIds: [],
        failedIds: payload.observations.map(o => o.id),
        error: 'Not authenticated — Cognito token missing',
      }
    }

    // TODO: Implement API Gateway call
    //
    // Example:
    // const response = await fetch(`${AWS_CONFIG.apiBaseUrl}/observations`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${token}`,
    //   },
    //   body: JSON.stringify({
    //     eventCode: payload.eventCode,
    //     deviceId: payload.deviceId,
    //     nurseName: payload.nurseName,
    //     observations: payload.observations.map(obs => ({
    //       observationId: obs.id,
    //       childId: obs.captureMetadata?.childId,
    //       moduleType: obs.moduleType,
    //       bodyRegion: obs.bodyRegion,
    //       timestamp: obs.timestamp,
    //       riskCategory: obs.aiAnnotations?.[0]?.riskCategory,
    //       summaryText: obs.aiAnnotations?.[0]?.summaryText,
    //       confidence: obs.aiAnnotations?.[0]?.confidence,
    //       findings: obs.annotationData?.selectedChips || [],
    //       severities: obs.annotationData?.chipSeverities || {},
    //       notes: obs.annotationData?.notes || '',
    //       mediaKey: obs.annotationData?.mediaKey, // Set after uploadMedia()
    //     })),
    //     syncedAt: payload.syncedAt,
    //   }),
    // })
    //
    // if (!response.ok) {
    //   return { success: false, syncedIds: [], failedIds: ..., error: ... }
    // }
    //
    // const result = await response.json()
    // return { success: true, syncedIds: result.syncedIds, failedIds: result.failedIds }

    console.log('[AWSBackend] push() not implemented — stub returning failure', {
      eventCode: payload.eventCode,
      observationCount: payload.observations.length,
    })

    return {
      success: false,
      syncedIds: [],
      failedIds: payload.observations.map(o => o.id),
      error: 'AWS backend not yet implemented — see aws-backend.ts',
    }
  }

  async pull(eventCode: string): Promise<SyncPullResult> {
    const token = getCognitoToken()
    if (!token) {
      return {
        success: false,
        observations: [],
        children: [],
        error: 'Not authenticated — Cognito token missing',
      }
    }

    // TODO: Implement API Gateway call
    //
    // Example:
    // const response = await fetch(
    //   `${AWS_CONFIG.apiBaseUrl}/events/${eventCode}/results`,
    //   {
    //     headers: { 'Authorization': `Bearer ${token}` },
    //   }
    // )
    //
    // if (!response.ok) {
    //   return { success: false, observations: [], children: [], error: ... }
    // }
    //
    // const data = await response.json()
    // return {
    //   success: true,
    //   observations: data.observations,
    //   children: data.children,
    // }

    console.log('[AWSBackend] pull() not implemented — stub', { eventCode })

    return {
      success: false,
      observations: [],
      children: [],
      error: 'AWS backend not yet implemented — see aws-backend.ts',
    }
  }

  async uploadMedia(file: Blob, key: string): Promise<string> {
    const token = getCognitoToken()
    if (!token) throw new Error('Not authenticated')

    // TODO: Implement S3 presigned URL upload
    //
    // Step 1: Get presigned URL from your Lambda
    // const presignResponse = await fetch(
    //   `${AWS_CONFIG.s3PresignedEndpoint}`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${token}`,
    //     },
    //     body: JSON.stringify({
    //       key: key,              // e.g., 'EVENT123/child456/dental/obs789.jpg'
    //       contentType: file.type, // e.g., 'image/jpeg'
    //     }),
    //   }
    // )
    // const { uploadUrl, publicUrl } = await presignResponse.json()
    //
    // Step 2: Upload file directly to S3
    // await fetch(uploadUrl, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': file.type },
    //   body: file,
    // })
    //
    // Step 3: Return the S3 key or public URL
    // return publicUrl  // e.g., 'https://bucket.s3.amazonaws.com/EVENT123/child456/dental/obs789.jpg'

    console.log('[AWSBackend] uploadMedia() not implemented — stub', { key, size: file.size })
    throw new Error('AWS media upload not yet implemented — see aws-backend.ts')
  }

  async isAvailable(): Promise<boolean> {
    // Check if:
    // 1. AWS config is set
    // 2. Cognito token exists and is not expired
    // 3. Network is reachable

    if (!AWS_CONFIG.apiBaseUrl) return false

    const token = getCognitoToken()
    if (!token) return false

    // TODO: Optionally verify token is not expired
    // const payload = JSON.parse(atob(token.split('.')[1]))
    // if (payload.exp * 1000 < Date.now()) return false

    // TODO: Optionally ping API Gateway health endpoint
    // try {
    //   const response = await fetch(`${AWS_CONFIG.apiBaseUrl}/health`, {
    //     headers: { 'Authorization': `Bearer ${token}` },
    //   })
    //   return response.ok
    // } catch {
    //   return false
    // }

    return false // Return false until implemented
  }
}
