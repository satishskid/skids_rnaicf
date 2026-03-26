/**
 * Organization configuration — replaces Firebase-based OrgConfig.
 * In V3, this comes from the Hono API (Turso) instead of Firestore.
 */

export interface OrgConfig {
  version: number
  enabledModules?: string[]
  customChips?: Record<string, unknown[]>
  hiddenChips?: Record<string, string[]>
  immunizationSchedule?: unknown[]
  aiModels?: {
    entClassifier?: { url: string; version: string; sizeBytes?: number }
    photoscreening?: { url: string; version: string; sizeBytes?: number }
    mobileSamEncoder?: { url: string; version: string; sizeBytes?: number }
    mobileSamDecoder?: { url: string; version: string; sizeBytes?: number }
  }
  llmConfig?: {
    mode?: 'local_only' | 'local_first' | 'cloud_first' | 'dual'
    ollamaUrl?: string
    ollamaModel?: string
    cloudProvider?: string
    cloudGatewayUrl?: string
    cloudApiKey?: string
    sendImagesToCloud?: boolean
  }
  stimulusVideoUrls?: {
    social?: string
    geometric?: string
    attention?: string
  }
  updatedAt?: string
  updatedBy?: string
}

/** Fetch org config from V3 API */
export async function getOrgConfig(_orgCode: string): Promise<OrgConfig | null> {
  // TODO: Wire to GET /api/org-config?code=orgCode
  return null
}
