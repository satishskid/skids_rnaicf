// @skids/api-client — Type-safe Hono RPC client
// Used by BOTH mobile app (React Native) and web dashboard (Vite)

import { hc } from 'hono/client'
import type { AppType } from '../../apps/worker/src/index'

export type { AppType }

const DEFAULT_BASE_URL = 'https://skids-api.satish-9f4.workers.dev'

/**
 * Create a type-safe API client.
 *
 * Usage:
 *   const api = createApiClient()
 *   const res = await api.api.campaigns.$get()
 *   const data = await res.json()
 */
export function createApiClient(baseUrl?: string) {
  return hc<AppType>(baseUrl || DEFAULT_BASE_URL)
}

/**
 * Pre-configured client instance for convenience.
 * Override base URL by calling createApiClient() directly.
 */
export const api = createApiClient()
