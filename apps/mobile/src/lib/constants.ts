// App constants
import Constants from 'expo-constants'

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || 'https://skids-api.satish-9f4.workers.dev'

export const APP_VERSION = Constants.expoConfig?.version || '3.3.0'
