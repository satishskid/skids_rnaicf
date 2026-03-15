/**
 * fhir-adapter.ts
 *
 * FHIR R4 resource adapters for interoperability.
 * Converts SKIDS internal types to FHIR R4 resources.
 * No FHIR server needed — produces JSON bundles for export.
 */

import type { Child, Observation } from './types'

// ─── FHIR R4 Types (simplified, compatible with @types/fhir) ───

interface FhirResource {
  resourceType: string
  id?: string
  meta?: { lastUpdated?: string; profile?: string[] }
}

interface FhirPatient extends FhirResource {
  resourceType: 'Patient'
  identifier?: { system: string; value: string }[]
  name?: { family?: string; given?: string[]; text?: string }[]
  birthDate?: string
  gender?: 'male' | 'female' | 'other' | 'unknown'
  address?: { text?: string; city?: string; state?: string; country?: string }[]
}

interface FhirObservation extends FhirResource {
  resourceType: 'Observation'
  status: 'preliminary' | 'final' | 'amended' | 'corrected'
  category?: { coding: { system: string; code: string; display: string }[] }[]
  code: { coding: { system: string; code: string; display?: string }[]; text?: string }
  subject?: { reference: string; display?: string }
  effectiveDateTime?: string
  interpretation?: { coding: { system: string; code: string; display: string }[] }[]
  note?: { text: string }[]
}

interface FhirConsent extends FhirResource {
  resourceType: 'Consent'
  status: 'draft' | 'active' | 'inactive'
  scope: { coding: { system: string; code: string }[] }
  category: { coding: { system: string; code: string }[] }[]
  patient?: { reference: string }
  dateTime?: string
  performer?: { reference?: string; display?: string }[]
  provision?: { type: 'deny' | 'permit' }
}

interface FhirResearchStudy extends FhirResource {
  resourceType: 'ResearchStudy'
  status: string
  title?: string
  description?: string
  principalInvestigator?: { display: string }
  category?: { text: string }[]
  identifier?: { system: string; value: string }[]
}

interface FhirBundle {
  resourceType: 'Bundle'
  type: 'collection' | 'document' | 'transaction'
  timestamp: string
  total?: number
  entry: { resource: FhirResource; fullUrl?: string }[]
}

// ─── Adapters ───────────────────────────────────────────────

/**
 * Convert a SKIDS Child to a FHIR R4 Patient resource.
 */
export function childToFhirPatient(child: Child): FhirPatient {
  const nameParts = (child.name || '').trim().split(/\s+/)
  const given = nameParts.slice(0, -1)
  const family = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined

  return {
    resourceType: 'Patient',
    id: child.id,
    meta: { lastUpdated: new Date().toISOString() },
    identifier: [
      { system: 'urn:skids:child-id', value: child.id },
      ...(child.admissionNumber ? [{ system: 'urn:skids:admission-number', value: child.admissionNumber }] : []),
    ],
    name: [{
      text: child.name,
      given: given.length > 0 ? given : [child.name],
      family,
    }],
    birthDate: child.dob || undefined,
    gender: child.gender === 'male' ? 'male' : child.gender === 'female' ? 'female' : 'unknown',
    address: child.location ? [{ text: child.location }] : undefined,
  }
}

/**
 * Convert a SKIDS Observation to a FHIR R4 Observation resource.
 */
export function observationToFhirObservation(obs: Observation, childName?: string): FhirObservation {
  const moduleType = obs.moduleType || 'unknown'

  // Map risk level to FHIR interpretation
  const riskLevel = obs.aiAnnotations?.[0]?.riskCategory
  let interpretationCode = 'N' // Normal
  let interpretationDisplay = 'Normal'
  if (riskLevel === 'possible_risk') {
    interpretationCode = 'A'
    interpretationDisplay = 'Abnormal'
  } else if (riskLevel === 'high_risk') {
    interpretationCode = 'HH'
    interpretationDisplay = 'Critically high'
  }

  const chips = obs.annotationData?.chips as string[] | undefined

  return {
    resourceType: 'Observation',
    id: obs.id,
    meta: { lastUpdated: obs.createdAt || new Date().toISOString() },
    status: 'final',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'exam',
        display: 'Exam',
      }],
    }],
    code: {
      coding: [{
        system: 'urn:skids:module-type',
        code: moduleType,
        display: moduleType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      }],
      text: `SKIDS Screening: ${moduleType}`,
    },
    subject: {
      reference: `Patient/${obs.childId}`,
      display: childName,
    },
    effectiveDateTime: obs.createdAt || new Date().toISOString(),
    interpretation: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
        code: interpretationCode,
        display: interpretationDisplay,
      }],
    }],
    note: chips?.length ? [{ text: `Findings: ${chips.join(', ')}` }] : undefined,
  }
}

/**
 * Convert a consent record to a FHIR R4 Consent resource.
 */
export function consentToFhirConsent(consent: {
  id: string
  childId?: string
  guardianName: string
  consented: number
  consentDate?: string
  withdrawnAt?: string
}): FhirConsent {
  const isActive = consent.consented === 1 && !consent.withdrawnAt

  return {
    resourceType: 'Consent',
    id: consent.id,
    status: isActive ? 'active' : 'inactive',
    scope: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/consentscope',
        code: 'research',
      }],
    },
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
        code: 'research',
      }],
    }],
    patient: consent.childId ? { reference: `Patient/${consent.childId}` } : undefined,
    dateTime: consent.consentDate || new Date().toISOString(),
    performer: [{ display: consent.guardianName }],
    provision: { type: isActive ? 'permit' : 'deny' },
  }
}

/**
 * Convert a study to a FHIR R4 ResearchStudy resource.
 */
export function studyToFhirResearchStudy(study: {
  id: string
  title: string
  shortCode: string
  description?: string
  studyType: string
  status: string
  piName?: string
  irbNumber?: string
}): FhirResearchStudy {
  // Map SKIDS status to FHIR status
  const statusMap: Record<string, string> = {
    planning: 'in-review',
    recruiting: 'active',
    active: 'active',
    paused: 'temporarily-closed-to-accrual',
    completed: 'completed',
    archived: 'withdrawn',
  }

  return {
    resourceType: 'ResearchStudy',
    id: study.id,
    status: statusMap[study.status] || 'active',
    title: study.title,
    description: study.description || undefined,
    principalInvestigator: study.piName ? { display: study.piName } : undefined,
    category: [{ text: study.studyType }],
    identifier: [
      { system: 'urn:skids:study-code', value: study.shortCode },
      ...(study.irbNumber ? [{ system: 'urn:skids:irb-number', value: study.irbNumber }] : []),
    ],
  }
}

/**
 * Create a FHIR Bundle from multiple resources.
 */
export function createFhirBundle(
  resources: FhirResource[],
  type: 'collection' | 'transaction' = 'collection',
): FhirBundle {
  return {
    resourceType: 'Bundle',
    type,
    timestamp: new Date().toISOString(),
    total: resources.length,
    entry: resources.map(resource => ({
      resource,
      fullUrl: `urn:skids:${resource.resourceType}/${resource.id}`,
    })),
  }
}

/**
 * Build a complete FHIR bundle for a campaign.
 * Includes all patients (children) and their observations.
 */
export function buildCampaignFhirBundle(
  children: Child[],
  observations: Observation[],
): FhirBundle {
  const childMap = new Map(children.map(c => [c.id, c]))
  const resources: FhirResource[] = []

  // Add patients
  for (const child of children) {
    resources.push(childToFhirPatient(child))
  }

  // Add observations
  for (const obs of observations) {
    const child = childMap.get(obs.childId)
    resources.push(observationToFhirObservation(obs, child?.name))
  }

  return createFhirBundle(resources)
}
