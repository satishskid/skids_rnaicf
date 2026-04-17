// Phase 07 — Evidence chunk manifest.
//
// One module, one export: collectChunks(). Downstream tooling (the
// Vectorize index build script and any future eval harness) imports only
// this function and gets the full corpus as a flat array of chunks.
//
// Round 1 sources (structured TS, no PDFs):
//   - condition-descriptions.ts     (52 4D condition narratives)
//   - ai/mchat-scoring.ts           (20 M-CHAT-R items + domain context)
//   - parent-education.ts           (module intros + condition parent info)
//
// Each chunk is self-contained (no cross-chunk references) and keeps its
// category, module_type, age band, and language on the row so Vectorize
// metadata filters work without fetching the body.

import {
  CONDITION_DESCRIPTIONS,
  MCHAT_ITEMS,
  MODULE_EDUCATION,
  CONDITION_PARENT_INFO,
} from '@skids/shared'

export type EvidenceCategory =
  | 'condition'
  | 'mchat'
  | 'module-education'
  | 'parent-education'

export interface EvidenceChunk {
  /** Stable, URL-safe id. MUST be deterministic across rebuilds. */
  id: string
  /** The searchable text that gets embedded. */
  text: string
  /** Top-level filter for the doctor inbox side panel. */
  category: EvidenceCategory
  /** Screening module this chunk is most relevant to, when known. */
  module_type?: string
  /** Age band the chunk applies to, in months. null = all ages. */
  age_band_months?: { min: number; max: number } | null
  /** Language. Default 'en'. */
  lang?: string
  /** Short title shown above the body in the UI. */
  title?: string
  /** Back-reference to the upstream source file for debugging + tests. */
  source: string
}

export function collectChunks(): EvidenceChunk[] {
  return [
    ...collectConditionDescriptions(),
    ...collectMChatItems(),
    ...collectModuleEducation(),
    ...collectParentEducation(),
  ]
}

function collectConditionDescriptions(): EvidenceChunk[] {
  return Object.entries(CONDITION_DESCRIPTIONS).map(([conditionId, text]) => ({
    id: `cond-${conditionId}`,
    text: `${conditionId}: ${text}`,
    category: 'condition' as const,
    title: `Condition ${conditionId}`,
    source: 'packages/shared/src/condition-descriptions.ts',
    lang: 'en',
  }))
}

function collectMChatItems(): EvidenceChunk[] {
  return MCHAT_ITEMS.map((item) => ({
    id: `mchat-${item.id}`,
    text: `M-CHAT item ${item.id} (${item.domain}${item.critical ? ', critical' : ''}): ${item.text}. Pass if ${item.yesIsPass ? 'yes' : 'no'}.`,
    category: 'mchat' as const,
    module_type: 'mchat',
    title: `M-CHAT Item ${item.id} — ${item.domain}`,
    age_band_months: { min: 16, max: 30 },
    source: 'packages/shared/src/ai/mchat-scoring.ts',
    lang: 'en',
  }))
}

function collectModuleEducation(): EvidenceChunk[] {
  return Object.entries(MODULE_EDUCATION).flatMap(([moduleType, edu]) => {
    if (!edu) return []
    return [{
      id: `modedu-${moduleType}`,
      text: `${moduleType} — ${edu.method}. ${edu.intro} Healthy message: ${edu.healthyMessage}`,
      category: 'module-education' as const,
      module_type: moduleType,
      title: `${moduleType} module`,
      source: 'packages/shared/src/parent-education.ts',
      lang: 'en',
    }]
  })
}

function collectParentEducation(): EvidenceChunk[] {
  return Object.entries(CONDITION_PARENT_INFO).map(([conditionId, info]) => ({
    id: `parent-${conditionId}`,
    text: `${conditionId}. ${info.description} Prevalence: ${info.prevalence} Intervention: ${info.intervention}`,
    category: 'parent-education' as const,
    title: `Parent guidance — ${conditionId}`,
    source: 'packages/shared/src/parent-education.ts',
    lang: 'en',
  }))
}
