// Local copy of MODULE_CONFIGS from @skids/shared
// Avoids Metro workspace resolution issues with @skids/shared

import type { ModuleType, AgeGroup } from './types'

export type ModuleGroup = 'vitals' | 'head_to_toe'

export interface ModuleConfig {
  type: ModuleType
  name: string
  description: string
  icon: string
  duration: string
  captureType: 'photo' | 'video' | 'audio' | 'value' | 'form'
  cameraFacing?: 'user' | 'environment'
  recommendedAge: AgeGroup[]
  color: string
  group: ModuleGroup
}

const ALL_AGES: AgeGroup[] = ['infant', 'toddler', 'preschool', 'school', 'adolescent']
const SCHOOL_UP: AgeGroup[] = ['school', 'adolescent']

export const MODULE_CONFIGS: ModuleConfig[] = [
  // ── VITALS & MEASUREMENTS ──────────────────────
  { type: 'height', name: 'Height', description: 'Height-for-age WHO Z-score', icon: 'Ruler', duration: '1 min', captureType: 'value', recommendedAge: ALL_AGES, color: 'bg-blue-600', group: 'vitals' },
  { type: 'weight', name: 'Weight', description: 'Weight-for-age WHO Z-score', icon: 'Scale', duration: '1 min', captureType: 'value', recommendedAge: ALL_AGES, color: 'bg-green-600', group: 'vitals' },
  { type: 'vitals', name: 'Vitals Check', description: 'Heart rate via rPPG', icon: 'Heart', duration: '1-2 min', captureType: 'video', cameraFacing: 'user', recommendedAge: ALL_AGES, color: 'bg-red-500', group: 'vitals' },
  { type: 'spo2', name: 'SpO2', description: 'Oxygen saturation level', icon: 'Droplet', duration: '1 min', captureType: 'value', recommendedAge: ALL_AGES, color: 'bg-red-600', group: 'vitals' },
  { type: 'hemoglobin', name: 'Hemoglobin', description: 'WHO anemia classification', icon: 'Droplet', duration: '1 min', captureType: 'value', recommendedAge: ALL_AGES, color: 'bg-rose-600', group: 'vitals' },
  { type: 'bp', name: 'Blood Pressure', description: 'Systolic/diastolic with pediatric classification', icon: 'Heart', duration: '2 min', captureType: 'value', recommendedAge: ['school', 'adolescent'], color: 'bg-red-700', group: 'vitals' },
  { type: 'muac', name: 'MUAC', description: 'Mid-Upper Arm Circumference (wasting indicator)', icon: 'Ruler', duration: '1 min', captureType: 'value', recommendedAge: ['infant', 'toddler', 'preschool'], color: 'bg-amber-600', group: 'vitals' },

  // ── HEAD-TO-TOE EXAMINATION ────────────────────
  { type: 'general_appearance', name: 'General Appearance', description: 'Nutritional status, pallor, hydration', icon: 'UserCheck', duration: '1-2 min', captureType: 'photo', cameraFacing: 'user', recommendedAge: ALL_AGES, color: 'bg-slate-500', group: 'head_to_toe' },
  { type: 'hair', name: 'Hair & Scalp', description: 'Pediculosis, dandruff, alopecia, tinea', icon: 'Sparkles', duration: '1-2 min', captureType: 'photo', cameraFacing: 'environment', recommendedAge: ALL_AGES, color: 'bg-amber-600', group: 'head_to_toe' },
  { type: 'eyes_external', name: 'Eyes External', description: 'Strabismus, ptosis, conjunctival pallor/redness', icon: 'EyeExternal', duration: '1-2 min', captureType: 'photo', cameraFacing: 'user', recommendedAge: ALL_AGES, color: 'bg-cyan-500', group: 'head_to_toe' },
  { type: 'vision', name: 'Vision Screening', description: 'Red reflex and eye alignment analysis', icon: 'Eye', duration: '2-3 min', captureType: 'photo', cameraFacing: 'user', recommendedAge: ALL_AGES, color: 'bg-blue-500', group: 'head_to_toe' },
  { type: 'ear', name: 'Ear Screening', description: 'Tympanic membrane examination', icon: 'Ear', duration: '2-3 min', captureType: 'photo', cameraFacing: 'environment', recommendedAge: ['infant', 'toddler', 'preschool', 'school'], color: 'bg-yellow-500', group: 'head_to_toe' },
  { type: 'hearing', name: 'Hearing Screening', description: 'Picture-based audiometry — child taps matching image', icon: 'Headphones', duration: '5-7 min', captureType: 'form', recommendedAge: ['preschool', 'school', 'adolescent'], color: 'bg-indigo-600', group: 'head_to_toe' },
  { type: 'nose', name: 'Nose Examination', description: 'Septum, discharge, turbinates', icon: 'Nose', duration: '1 min', captureType: 'photo', cameraFacing: 'environment', recommendedAge: ALL_AGES, color: 'bg-lime-500', group: 'head_to_toe' },
  { type: 'dental', name: 'Dental Screening', description: 'Caries, malocclusion, gingivitis, oral health', icon: 'Tooth', duration: '2-3 min', captureType: 'video', cameraFacing: 'environment', recommendedAge: ['preschool', 'school', 'adolescent'], color: 'bg-sky-500', group: 'head_to_toe' },
  { type: 'throat', name: 'Throat Examination', description: 'Tonsils, pharynx, uvula', icon: 'Throat', duration: '1-2 min', captureType: 'video', cameraFacing: 'environment', recommendedAge: ALL_AGES, color: 'bg-rose-500', group: 'head_to_toe' },
  { type: 'neck', name: 'Neck & Thyroid', description: 'Goiter, lymphadenopathy, swallowing', icon: 'Neck', duration: '2-3 min', captureType: 'video', cameraFacing: 'environment', recommendedAge: SCHOOL_UP, color: 'bg-indigo-500', group: 'head_to_toe' },
  { type: 'respiratory', name: 'Respiratory Audio', description: 'Cough and breathing analysis', icon: 'Mic', duration: '1-2 min', captureType: 'audio', recommendedAge: ALL_AGES, color: 'bg-teal-500', group: 'head_to_toe' },
  { type: 'abdomen', name: 'Abdomen', description: 'Distension, hernia, tenderness', icon: 'Abdomen', duration: '2-3 min', captureType: 'photo', cameraFacing: 'environment', recommendedAge: ALL_AGES, color: 'bg-violet-500', group: 'head_to_toe' },
  { type: 'skin', name: 'Skin & Wound', description: 'Skin condition and wound monitoring', icon: 'Scan', duration: '2-4 min', captureType: 'photo', cameraFacing: 'environment', recommendedAge: ALL_AGES, color: 'bg-orange-500', group: 'head_to_toe' },
  { type: 'nails', name: 'Nail Examination', description: 'Clubbing, pallor, cyanosis, koilonychia', icon: 'Hand', duration: '1 min', captureType: 'photo', cameraFacing: 'environment', recommendedAge: ALL_AGES, color: 'bg-pink-500', group: 'head_to_toe' },
  { type: 'posture', name: 'Posture & Spine', description: 'Scoliosis, kyphosis, genu valgum/varum', icon: 'Spine', duration: '2-3 min', captureType: 'photo', cameraFacing: 'environment', recommendedAge: SCHOOL_UP, color: 'bg-emerald-600', group: 'head_to_toe' },
  { type: 'motor', name: 'Motor Assessment', description: 'Balance and gait evaluation', icon: 'Activity', duration: '3-5 min', captureType: 'video', cameraFacing: 'environment', recommendedAge: ['toddler', 'preschool', 'school', 'adolescent'], color: 'bg-green-500', group: 'head_to_toe' },
  { type: 'lymph', name: 'Lymph Nodes', description: 'Cervical, axillary, inguinal palpation', icon: 'Lymph', duration: '2-3 min', captureType: 'form', recommendedAge: ALL_AGES, color: 'bg-fuchsia-500', group: 'head_to_toe' },
  { type: 'neurodevelopment', name: 'Neurodevelopment', description: 'Developmental, behavioral, mental health & learning assessment', icon: 'Brain', duration: '5-7 min', captureType: 'video', cameraFacing: 'user', recommendedAge: ALL_AGES, color: 'bg-purple-500', group: 'head_to_toe' },
  { type: 'immunization', name: 'Immunization', description: 'Vaccination status and evidence recording', icon: 'Shield', duration: '3-5 min', captureType: 'form', recommendedAge: ALL_AGES, color: 'bg-emerald-500', group: 'head_to_toe' },
  { type: 'cardiac', name: 'Cardiac Auscultation', description: 'Heart sounds via stethoscope (4 auscultation points)', icon: 'Stethoscope', duration: '3-5 min', captureType: 'audio', recommendedAge: ALL_AGES, color: 'bg-rose-600', group: 'head_to_toe' },
  { type: 'pulmonary', name: 'Pulmonary Auscultation', description: 'Lung sounds via stethoscope (6 auscultation points)', icon: 'Stethoscope', duration: '5-7 min', captureType: 'audio', recommendedAge: ALL_AGES, color: 'bg-teal-600', group: 'head_to_toe' },
  { type: 'nutrition_intake', name: 'Nutrition Intake', description: 'School & home diet capture with regional food chips', icon: 'Apple', duration: '2-3 min', captureType: 'form', recommendedAge: ALL_AGES, color: 'bg-green-600', group: 'head_to_toe' },
  { type: 'intervention', name: 'Interventions', description: 'Track supplementation, fortification, deworming, feeding programs', icon: 'Pill', duration: '2-3 min', captureType: 'form', recommendedAge: ALL_AGES, color: 'bg-indigo-600', group: 'head_to_toe' },
]

export function getModuleConfig(type: ModuleType): ModuleConfig | undefined {
  return MODULE_CONFIGS.find(m => m.type === type)
}

export function getModuleName(type: string): string {
  const config = MODULE_CONFIGS.find(m => m.type === type)
  return config ? config.name : type
}

export function getModulesForAgeGroup(ageGroup: AgeGroup): ModuleConfig[] {
  return MODULE_CONFIGS.filter(m => m.recommendedAge.includes(ageGroup))
}
