// API client for mobile — uses Hono RPC type-safe client
import { createApiClient } from '@skids/api-client'
import Constants from 'expo-constants'

const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl || 'https://skids-api.satish-9f4.workers.dev'

export const api = createApiClient(baseUrl)
