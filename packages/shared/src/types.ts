// Core types for SKIDS Screen Pediatric Health Screening System
// Migrated from V2 (zpediscreen/src/lib/types.ts) — zero business logic changes

export type ModuleType =
  | 'vision'
  | 'neurodevelopment'
  | 'vitals'
  | 'skin'
  | 'ear'
  | 'respiratory'
  | 'motor'
  | 'dental'
  | 'throat'
  | 'nose'
  | 'eyes_external'
  | 'neck'
  | 'hair'
  | 'nails'
  | 'posture'
  | 'abdomen'
  | 'lymph'
  | 'general_appearance'
  | 'height'
  | 'weight'
  | 'spo2'
  | 'hemoglobin'
  | 'hearing'
  | 'bp'
  | 'immunization'
  | 'cardiac'
  | 'pulmonary'
  | 'muac'
  | 'nutrition_intake'
  | 'intervention';

export type RiskCategory = 'no_risk' | 'possible_risk' | 'high_risk';
export type QualityFlag = 'adequate' | 'inadequate' | 'pending_review';
export type ExamContext = 'home' | 'school' | 'clinic';
export type ExamStatus = 'pending' | 'in_progress' | 'completed' | 'reviewed';
export type Severity = 'normal' | 'mild' | 'moderate' | 'severe';

// Canonical child screening status union.
// Union of historical members from both types.ts and campaign-progress.ts
// (campaign-progress.ts re-exports this type instead of redeclaring it).
export type ChildScreeningStatus =
  | 'to_screen'
  | 'absent'
  | 'in_progress'
  | 'screened'
  | 'synced'
  | 'under_review'
  | 'complete'
  | 'retake'
  | 'referred';

export interface AbsentRecord {
  date: string;
  reason: string;
  markedBy: string;
}

export interface RetakeRequest {
  observationId: string;
  moduleType: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

export interface Child {
  id: string;
  name: string;
  dob: string;
  gender: 'male' | 'female';
  // Optional — may be absent on rows materialized from DB partial selects.
  location?: string;
  photoUrl?: string;
  admissionNumber?: string;
  class?: string;
  section?: string;
  academicYear?: string;
  schoolName?: string;
  // DB-row companion (export / FHIR / campaign-progress routes).
  campaignCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExamSession {
  id: string;
  childId: string;
  timestamp: string;
  context: ExamContext;
  modules: ModuleType[];
  status: ExamStatus;
  notes?: string;
}

// Annotation types — structured evidence capture
export interface AnnotationPin {
  id: string;
  x: number;
  y: number;
  label: string;
  severity?: Severity;
  chipId?: string;
}

export interface AnnotationChipConfig {
  id: string;
  label: string;
  category: string;
  severity?: boolean;
  locationPin?: boolean;
  icdCode?: string;
}

export interface ModuleAnnotationConfig {
  moduleType: ModuleType;
  chips: AnnotationChipConfig[];
}

export interface CaptureItem {
  id: string;
  imageDataUrl: string;
  label?: string;
  timestamp: string;
  aiAnalysis?: Record<string, unknown>;
}

export interface AnnotationData {
  selectedChips: string[];
  chipSeverities: Record<string, Severity>;
  pins: AnnotationPin[];
  aiSuggestedChips: string[];
  notes: string;
  evidenceImage?: string;
  evidenceVideoFrames?: string[];
  captures?: CaptureItem[];
}

export interface AIAnnotation {
  id: string;
  modelId: string;
  features: Record<string, unknown>;
  summaryText: string;
  confidence: number;
  qualityFlags: string[];
  riskCategory: RiskCategory;
}

export interface ClinicianReview {
  id: string;
  clinicianId: string;
  clinicianName: string;
  timestamp: string;
  notes: string;
  decision: 'approve' | 'refer' | 'follow_up' | 'discharge' | 'retake';
  qualityRating?: 'good' | 'fair' | 'poor';
  qualityNotes?: string;
  retakeReason?: string;
}

export interface Observation {
  id: string;
  sessionId: string;
  moduleType: ModuleType;
  bodyRegion?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video' | 'audio';
  captureMetadata: Record<string, unknown>;
  aiAnnotations: AIAnnotation[];
  annotationData?: AnnotationData;
  clinicianReview?: ClinicianReview;
  timestamp: string;
  // DB-row companions. Present when Observation is materialized from Turso
  // rows (export, FHIR adapter) rather than the mobile in-memory capture.
  // Optional so the domain-shaped usage stays valid.
  childId?: string;
  campaignCode?: string;
  createdAt?: string;
}

// Module-specific result types
export interface VisionResult {
  redReflexPresent: boolean;
  redReflexSymmetry: number;
  eyeAlignmentScore: number;
  pupilResponse: 'normal' | 'abnormal' | 'inconclusive';
  riskCategory: RiskCategory;
  confidence: number;
  qualityScore: number;
}

export interface NeuroResult {
  gazeScore: number;
  socialEngagement: number;
  nameResponseTime: number;
  stimulusPreference: 'social' | 'geometric' | 'neutral';
  developmentalMarkers: string[];
  riskCategory: RiskCategory;
  confidence: number;
}

export interface VitalsResult {
  heartRate: number;
  heartRateConfidence: number;
  respiratoryRate: number;
  respiratoryConfidence: number;
  oxygenSaturation?: number;
  qualityScore: number;
  motionArtifact: boolean;
}

export interface SkinResult {
  woundDetected: boolean;
  woundArea?: number;
  woundLocation?: string;
  tissueTypes?: string[];
  healingStage?: 'improving' | 'stable' | 'worsening';
  riskCategory: RiskCategory;
  segmentationConfidence: number;
}

export interface EarResult {
  tmVisibility: number;
  tmColor: 'normal' | 'red' | 'yellow' | 'white';
  fluidLevel?: 'none' | 'mild' | 'moderate' | 'severe';
  perforation: boolean;
  qualityFlag: QualityFlag;
  riskCategory: RiskCategory;
}

export interface RespiratoryResult {
  coughType: 'dry' | 'wet' | 'barking' | 'whooping' | 'none';
  coughFrequency: 'rare' | 'occasional' | 'frequent' | 'continuous';
  wheezePresent: boolean;
  abnormalSounds: string[];
  conditionLikelihood: Record<string, number>;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
}

export interface MotorResult {
  balanceScore: number;
  gaitSymmetry: number;
  rangeOfMotion: Record<string, number>;
  ageNormComparison: Record<string, 'above' | 'normal' | 'below'>;
  concerns: string[];
  riskCategory: RiskCategory;
}

export interface ClinicalColorResult {
  regionScores: {
    redness: number;
    pallor: number;
    cyanosis: number;
    darkSpots: number;
    whitePatches: number;
    yellowIcteric: number;
  };
  suggestedChips: string[];
  confidence: number;
}

export interface AnthropometryResult {
  value: number;
  unit: string;
  zScore: number;
  percentile: number;
  classification: string;
  referenceTable: string;
}

// User & Auth types (V3: Better Auth roles)
export type UserRole = 'patient' | 'nurse' | 'doctor' | 'admin';

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
}

// Age groups for module recommendations
export type AgeGroup = 'infant' | 'toddler' | 'preschool' | 'school' | 'adolescent';

export function getAgeGroup(ageInMonths: number): AgeGroup {
  if (ageInMonths < 12) return 'infant';
  if (ageInMonths < 36) return 'toddler';
  if (ageInMonths < 60) return 'preschool';
  if (ageInMonths < 144) return 'school';
  return 'adolescent';
}

export function calculateAgeInMonths(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  const months = (today.getFullYear() - birthDate.getFullYear()) * 12;
  return months + (today.getMonth() - birthDate.getMonth());
}

export function formatAge(dob: string): string {
  const months = calculateAgeInMonths(dob);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} years`;
  return `${years}y ${remainingMonths}m`;
}

// Location
export type LocationLevel = 'country' | 'state' | 'district' | 'city' | 'school'

export interface CampaignLocation {
  country?: string
  countryCode?: string
  state?: string
  district?: string
  city?: string
  pincode?: string
  address?: string
  coordinates?: { lat: number; lng: number }
}

export function normaliseCampaignLocation(campaign: Partial<Campaign> & Record<string, unknown>): CampaignLocation {
  const loc = (campaign.location && typeof campaign.location === 'object')
    ? campaign.location as CampaignLocation
    : {} as CampaignLocation

  return {
    country: loc.country || (campaign.country as string) || undefined,
    countryCode: loc.countryCode || (campaign.countryCode as string) || undefined,
    state: loc.state || (campaign.state as string) || undefined,
    district: loc.district || (campaign.district as string) || undefined,
    city: loc.city || (campaign.city as string) || undefined,
    pincode: loc.pincode || (campaign.pincode as string) || undefined,
    address: loc.address || (campaign.address as string) || undefined,
    coordinates: loc.coordinates || (campaign.coordinates as { lat: number; lng: number }) || undefined,
  }
}

export function getLocationLabel(loc: CampaignLocation, level: LocationLevel): string {
  switch (level) {
    case 'country': return loc.country || loc.countryCode || 'Unknown'
    case 'state': return loc.state || 'Unknown'
    case 'district': return loc.district || 'Unknown'
    case 'city': return loc.city || 'Unknown'
    case 'school': return ''
  }
}

// Campaign
export interface Campaign {
  code: string
  name: string
  orgCode: string
  schoolName: string
  academicYear: string
  campaignType: string
  status: 'active' | 'completed' | 'archived' | 'paused'
  enabledModules: string[]
  customModules?: CustomModuleDefinition[]
  totalChildren: number
  createdBy: string
  createdAt: string
  completedAt?: string
  location: CampaignLocation
  city?: string
  state?: string
  address?: string
  pincode?: string
  coordinates?: { lat: number; lng: number }
}

// Module group (also defined in modules.ts, duplicated here to avoid circular imports)
export type ModuleGroup = 'vitals' | 'head_to_toe';

// Custom module definition
export interface CustomModuleDefinition {
  id: string;
  name: string;
  description: string;
  group: ModuleGroup;
  captureType: 'value' | 'form' | 'photo' | 'video';
  icon: string;
  color: string;
  valueConfig?: {
    label: string;
    unit: string;
    min: number;
    max: number;
    step?: number;
    fields?: { label: string; unit: string; min: number; max: number; step?: number }[];
  };
  formFields?: { label: string; type: 'text' | 'number' | 'select'; options?: string[]; required?: boolean }[];
  annotationChips?: AnnotationChipConfig[];
  instructions: { title: string; steps: string[] };
  createdAt: string;
}

// Region configuration
export interface RegionConfig {
  code: string;
  name: string;
  flag: string;
  currency: string;
  emergencyNumber: string;
}

export const REGIONS: RegionConfig[] = [
  { code: 'IN', name: 'India', flag: '\u{1F1EE}\u{1F1F3}', currency: 'INR', emergencyNumber: '102' },
  { code: 'AE', name: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', currency: 'AED', emergencyNumber: '998' },
  { code: 'SA', name: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}', currency: 'SAR', emergencyNumber: '997' },
  { code: 'QA', name: 'Qatar', flag: '\u{1F1F6}\u{1F1E6}', currency: 'QAR', emergencyNumber: '999' },
  { code: 'KW', name: 'Kuwait', flag: '\u{1F1F0}\u{1F1FC}', currency: 'KWD', emergencyNumber: '112' },
  { code: 'BH', name: 'Bahrain', flag: '\u{1F1E7}\u{1F1ED}', currency: 'BHD', emergencyNumber: '999' },
  { code: 'OM', name: 'Oman', flag: '\u{1F1F4}\u{1F1F2}', currency: 'OMR', emergencyNumber: '9999' }
];

// Vaccine schedule
export interface VaccineEntry {
  id: string;
  name: string;
  doses: number;
  ageLabels: string[];
}

export const DEFAULT_IMMUNIZATION_SCHEDULE: VaccineEntry[] = [
  { id: 'bcg', name: 'BCG', doses: 1, ageLabels: ['Birth'] },
  { id: 'hepb', name: 'Hepatitis B', doses: 4, ageLabels: ['Birth', '6 weeks', '10 weeks', '14 weeks'] },
  { id: 'opv', name: 'OPV (Oral Polio)', doses: 5, ageLabels: ['Birth', '6 weeks', '10 weeks', '14 weeks', '16-18 months'] },
  { id: 'ipv', name: 'IPV (Inj. Polio)', doses: 2, ageLabels: ['6 weeks', '14 weeks'] },
  { id: 'dtp', name: 'DTP / DTaP', doses: 5, ageLabels: ['6 weeks', '10 weeks', '14 weeks', '16-18 months', '4-6 years'] },
  { id: 'hib', name: 'Hib', doses: 4, ageLabels: ['6 weeks', '10 weeks', '14 weeks', '16-18 months'] },
  { id: 'pcv', name: 'PCV (Pneumococcal)', doses: 3, ageLabels: ['6 weeks', '14 weeks', '9 months'] },
  { id: 'rotavirus', name: 'Rotavirus', doses: 3, ageLabels: ['6 weeks', '10 weeks', '14 weeks'] },
  { id: 'mmr', name: 'MMR', doses: 2, ageLabels: ['9-12 months', '16-18 months'] },
  { id: 'varicella', name: 'Varicella', doses: 2, ageLabels: ['12-15 months', '4-6 years'] },
  { id: 'hepa', name: 'Hepatitis A', doses: 1, ageLabels: ['12 months'] },
  { id: 'typhoid', name: 'Typhoid (TCV)', doses: 1, ageLabels: ['9-12 months'] },
  { id: 'tdap', name: 'Td / Tdap', doses: 1, ageLabels: ['10-12 years'] },
  { id: 'hpv', name: 'HPV', doses: 2, ageLabels: ['9-14 years', '9-14 years + 6mo'] },
];

// Enriched export types
export interface EnrichedExportPayload {
  campaignCode: string;
  exportedAt: string;
  exportedBy: string;
  approvalStatus: 'fully_approved' | 'partially_approved';
  children: EnrichedChildExport[];
  cohortPrevalence?: unknown;
}

export interface EnrichedChildExport {
  child: Child;
  fourDReport: unknown;
  observations: Array<Observation & { clinicianReview?: ClinicianReview }>;
  reviewSummary: {
    total: number;
    approved: number;
    referred: number;
    followUp: number;
    pending: number;
  };
}
