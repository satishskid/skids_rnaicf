// Campaign types, templates, and utilities
// Migrated from V2 campaign-types.ts

import type { ModuleType } from './types'
import { MODULE_CONFIGS } from './modules'

export type CampaignType = 'school_health_4d' | 'feeding_india' | 'custom'

export interface CampaignTemplate {
  type: CampaignType
  name: string
  description: string
  icon: string
  defaultModules: ModuleType[]
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    type: 'school_health_4d',
    name: 'School Health (4D)',
    description: 'Comprehensive 4D screening with all modules',
    icon: 'Building',
    defaultModules: MODULE_CONFIGS.map(m => m.type),
  },
  {
    type: 'feeding_india',
    name: 'Feeding India',
    description: 'Nutrition: MUAC, anthropometry, hemoglobin, diet, interventions',
    icon: 'Apple',
    defaultModules: [
      'height', 'weight', 'muac', 'hemoglobin',
      'general_appearance', 'abdomen', 'hair', 'nails', 'skin',
      'nutrition_intake', 'intervention',
    ],
  },
  {
    type: 'custom',
    name: 'Custom',
    description: 'Manually select screening modules',
    icon: 'Settings',
    defaultModules: [],
  },
]

// Sync payload types
export interface SyncPayload {
  campaignCode: string
  deviceId: string
  nurseName: string
  observations: SyncObservation[]
  syncedAt: string
}

export interface SyncObservation {
  id: string
  sessionId: string
  childId: string
  moduleType: string
  bodyRegion: string
  timestamp: string
  riskCategory: string
  summaryText: string
  confidence: number
  features: Record<string, unknown>
}

export interface CampaignStatus {
  campaignCode: string
  campaignName: string
  totalChildren: number
  totalExpectedObservations: number
  syncedDevices: SyncDeviceStatus[]
  childProgress: ChildSyncProgress[]
}

export interface SyncDeviceStatus {
  deviceId: string
  nurseName: string
  lastSyncAt: string
  observationCount: number
}

export interface ChildSyncProgress {
  childId: string
  childName: string
  completedModules: string[]
  totalModules: number
  isComplete: boolean
}

export interface CampaignSummary {
  code: string
  name: string
  schoolName: string
  campaignType?: CampaignType
  status: 'active' | 'completed' | 'archived'
  childrenCount: number
  totalChildren?: number
  enabledModules?: string[]
  completionPercent: number
  observationCount: number
  lastSyncAt?: string
  createdAt: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  coordinates?: { lat: number; lng: number }
}

/** Generate a 6-character alphanumeric code (no confusing chars) */
export function generateCampaignCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
