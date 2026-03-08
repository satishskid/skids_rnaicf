// Better Auth client for React Native (Expo)
// Uses expo-secure-store for secure token storage on device

import { createAuthClient } from 'better-auth/react'
import { organizationClient } from 'better-auth/plugins'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl || 'https://skids-api.satish-9f4.workers.dev'

// Secure storage adapter for Better Auth
const secureStorage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // Silently fail on storage errors
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch {
      // Silently fail
    }
  },
}

export const authClient = createAuthClient({
  baseURL: baseUrl,
  plugins: [
    organizationClient(),
  ],
  // @ts-expect-error — Better Auth Expo adapter types
  storage: secureStorage,
})

// Convenience hooks
export const useSession = authClient.useSession
export const signIn = authClient.signIn
export const signUp = authClient.signUp
export const signOut = authClient.signOut
