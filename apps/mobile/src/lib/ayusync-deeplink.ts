/**
 * AyuSynk Deep Link Launcher — Triggers AyuShare stethoscope app from SKIDS mobile.
 *
 * Flow:
 *   1. Constructs deep link URL with patient metadata + referenceId
 *   2. Opens AyuShare app via Linking.openURL()
 *   3. Nurse records heart/lung sounds → saves → returns to SKIDS
 *   4. AyuShare server pushes report to our webhook (POST /api/ayusync/report)
 *   5. Mobile polls GET /api/ayusync/report?campaign=X&child=Y for result
 *
 * Deep link: app://www.ayudevicestech.com/launchApp?clientId=...&mode=0&deviceType=AyuSynk&...
 */

import { Linking } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const AYUSHARE_DEEPLINK_BASE = 'app://www.ayudevicestech.com/launchApp'
const AYUSYNC_CLIENT_ID = 'ySdydiuSkydkuSSA'
const PENDING_KEY = '@skids/ayusync-pending'

export interface AyuShareLaunchOptions {
  campaignCode: string
  childId: string
  childAge?: number
  childGender?: 'M' | 'F' | 'O'
  emailId?: string
  /** 0 = record & share, 1 = live streaming */
  mode?: 0 | 1
  shareDataWith?: string[]
}

export function buildAyuShareDeepLink(options: AyuShareLaunchOptions): string {
  const {
    campaignCode, childId, childAge, childGender,
    emailId, mode = 0, shareDataWith,
  } = options

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

  if (childAge !== undefined && childAge > 0) {
    params.set('age', String(Math.round(childAge)))
  }
  if (childGender) params.set('gender', childGender)
  if (emailId) params.set('emailId', emailId)
  if (shareDataWith && shareDataWith.length > 0) {
    params.set('shareDataWith', shareDataWith.join(','))
  }

  return `${AYUSHARE_DEEPLINK_BASE}?${params.toString()}`
}

/**
 * Launch AyuShare app via deep link on Android.
 * Returns referenceId for matching the webhook report later.
 */
export async function launchAyuShare(options: AyuShareLaunchOptions): Promise<{
  referenceId: string
  deepLinkUrl: string
  launched: boolean
}> {
  const deepLinkUrl = buildAyuShareDeepLink(options)
  const referenceId = `${options.campaignCode}_${options.childId}`

  // Track pending launch
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY)
    const pending = raw ? JSON.parse(raw) : []
    pending.push({
      referenceId,
      campaignCode: options.campaignCode,
      childId: options.childId,
      launchedAt: new Date().toISOString(),
    })
    // Keep only last 20 entries
    if (pending.length > 20) pending.splice(0, pending.length - 20)
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch { /* ignore */ }

  // Open deep link
  const canOpen = await Linking.canOpenURL(deepLinkUrl)
  if (canOpen) {
    await Linking.openURL(deepLinkUrl)
    return { referenceId, deepLinkUrl, launched: true }
  }

  return { referenceId, deepLinkUrl, launched: false }
}

export function getAyuSharePlayStoreUrl(): string {
  return 'https://play.google.com/store/apps/details?id=com.ayudevices.ayushare2'
}

export async function getPendingAyuSyncReports(): Promise<Array<{
  referenceId: string
  campaignCode: string
  childId: string
  launchedAt: string
}>> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function clearPendingAyuSyncReport(referenceId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY)
    const pending = raw ? JSON.parse(raw) : []
    const filtered = pending.filter((p: { referenceId: string }) => p.referenceId !== referenceId)
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(filtered))
  } catch { /* ignore */ }
}
