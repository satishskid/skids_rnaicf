/**
 * AyuSynk Deep Link Launcher — Triggers AyuShare app from PWA.
 *
 * Usage in screening UI:
 *   import { launchAyuShare, buildAyuShareDeepLink } from '@/lib/ayusynk/deeplink'
 *
 *   // Launch for a specific child during cardiac screening
 *   launchAyuShare({
 *     campaignCode: 'DEMO',
 *     childId: 'child123',
 *     childAge: 6,
 *     childGender: 'M',
 *   })
 *
 * Flow:
 *   1. Constructs deep link URL with patient metadata + our referenceId
 *   2. Opens AyuShare app on the Android tablet
 *   3. Nurse records sounds → saves → browser returns to foreground
 *   4. AyuShare server pushes report to our webhook (POST /api/ayusync/report)
 *   5. Report stored in Firestore with referenceId for matching
 *
 * Deep link format:
 *   app://www.ayudevicestech.com/launchApp?clientId=...&mode=0&deviceType=AyuSynk&...
 */

// ── Constants ──────────────────────────────────────────────────────

const AYUSHARE_DEEPLINK_BASE = 'app://www.ayudevicestech.com/launchApp'
const AYUSYNC_CLIENT_ID = 'ySdydiuSkydkuSSA'

// ── Types ──────────────────────────────────────────────────────────

export interface AyuShareLaunchOptions {
  /** Campaign code (used in reference_id) */
  campaignCode: string
  /** Child ID (used in reference_id) */
  childId: string
  /** Child's age in years */
  childAge?: number
  /** Child's gender: M, F, or O */
  childGender?: 'M' | 'F' | 'O'
  /** Email to bypass AyuShare login */
  emailId?: string
  /** Mode: 0 = record & share, 1 = live streaming */
  mode?: 0 | 1
  /** Doctor emails to auto-share recording with */
  shareDataWith?: string[]
}

// ── Functions ──────────────────────────────────────────────────────

/**
 * Build the AyuShare deep link URL with all parameters.
 * Does NOT open the URL — use launchAyuShare() for that.
 */
export function buildAyuShareDeepLink(options: AyuShareLaunchOptions): string {
  const {
    campaignCode,
    childId,
    childAge,
    childGender,
    emailId,
    mode = 0,
    shareDataWith,
  } = options

  // Build reference_id: "campaignCode_childId" — returned in webhook
  const referenceId = `${campaignCode}_${childId}`

  const params = new URLSearchParams({
    clientId: AYUSYNC_CLIENT_ID,
    mode: String(mode),
    deviceType: 'AyuSynk',
    referenceId,
    hidePatientSupportTab: 'true',
    hideSideMenuOption: 'true',
    getResultInJson: 'true',
  })

  // Optional patient info (helps AyuSynk AI analysis)
  if (childAge !== undefined && childAge > 0) {
    params.set('age', String(Math.round(childAge)))
  }
  if (childGender) {
    params.set('gender', childGender)
  }
  if (emailId) {
    params.set('emailId', emailId)
  }
  if (shareDataWith && shareDataWith.length > 0) {
    params.set('shareDataWith', shareDataWith.join(','))
  }

  return `${AYUSHARE_DEEPLINK_BASE}?${params.toString()}`
}

/**
 * Launch AyuShare app via deep link.
 *
 * On Android tablets with AyuShare installed:
 *   - Opens AyuShare app in foreground
 *   - Browser goes to background
 *   - After recording, browser returns to foreground
 *
 * On devices without AyuShare:
 *   - Nothing happens (deep link fails silently)
 *   - We detect this via timeout and show install prompt
 *
 * Returns the referenceId used (for matching the webhook report later).
 */
export function launchAyuShare(options: AyuShareLaunchOptions): {
  referenceId: string
  deepLinkUrl: string
  launched: boolean
} {
  const deepLinkUrl = buildAyuShareDeepLink(options)
  const referenceId = `${options.campaignCode}_${options.childId}`

  if (typeof window === 'undefined') {
    return { referenceId, deepLinkUrl, launched: false }
  }

  // Store launch timestamp for tracking pending reports
  try {
    const pending = JSON.parse(localStorage.getItem('ayusync_pending') || '[]')
    pending.push({
      referenceId,
      campaignCode: options.campaignCode,
      childId: options.childId,
      launchedAt: new Date().toISOString(),
    })
    // Keep only last 20 pending entries
    if (pending.length > 20) pending.splice(0, pending.length - 20)
    localStorage.setItem('ayusync_pending', JSON.stringify(pending))
  } catch {
    // localStorage might not be available
  }

  // Open deep link
  window.location.href = deepLinkUrl

  return { referenceId, deepLinkUrl, launched: true }
}

/**
 * Get the Google Play Store URL for AyuShare app.
 * Used when deep link fails (app not installed).
 */
export function getAyuSharePlayStoreUrl(): string {
  return 'https://play.google.com/store/apps/details?id=com.ayudevices.ayushare2'
}

/**
 * Check if there are pending AyuSynk reports (launched but not yet received).
 */
export function getPendingAyuSyncReports(): Array<{
  referenceId: string
  campaignCode: string
  childId: string
  launchedAt: string
}> {
  try {
    return JSON.parse(localStorage.getItem('ayusync_pending') || '[]')
  } catch {
    return []
  }
}

/**
 * Remove a pending report (after it's been received via webhook).
 */
export function clearPendingAyuSyncReport(referenceId: string): void {
  try {
    const pending = JSON.parse(localStorage.getItem('ayusync_pending') || '[]')
    const filtered = pending.filter((p: { referenceId: string }) => p.referenceId !== referenceId)
    localStorage.setItem('ayusync_pending', JSON.stringify(filtered))
  } catch {
    // ignore
  }
}
