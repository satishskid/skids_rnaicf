// 4D Report: Defects, Delay, Disability, Deficiency + Behavioral + Immunization + Learning
// Migrated from V2 — zero business logic changes

import type { Observation, RiskCategory, Severity, Child, ModuleType } from './types'

export type FourDCategory =
  | 'defects'
  | 'delay'
  | 'disability'
  | 'deficiency'
  | 'behavioral'
  | 'immunization'
  | 'learning'

export interface FourDCondition {
  id: string
  name: string
  category: FourDCategory
  icdCode?: string
  description?: string
  chipIds: string[]
  sourceModules: ModuleType[]
}

export type ConditionStatus = 'present' | 'absent' | 'not_screened'

export interface FourDConditionResult {
  condition: FourDCondition
  status: ConditionStatus
  severity?: Severity
  sourceModule?: ModuleType
  notes?: string
}

export interface FourDReport {
  childId: string
  childName: string
  childAge: string
  screenerName: string
  generatedAt: string
  categories: Record<FourDCategory, FourDConditionResult[]>
  summary: Record<FourDCategory, { present: number; absent: number; notScreened: number }>
  overallRisk: RiskCategory
}

// Master condition list — 52 conditions mapped to chip IDs across all modules
// Each condition includes a clinical description for 4D reports
export const FOUR_D_CONDITIONS: FourDCondition[] = [
  // === DEFECTS ===
  { id: 'def1', name: 'Cleft Lip/Palate', category: 'defects', icdCode: 'Q37', description: 'Congenital orofacial cleft affecting the lip, palate, or both. May impair feeding, speech, and dental development.', chipIds: ['d18'], sourceModules: ['dental'] },
  { id: 'def2', name: 'Down Syndrome', category: 'defects', icdCode: 'Q90', description: 'Chromosomal disorder (trisomy 21) with characteristic facial features, hypotonia, and variable intellectual disability.', chipIds: ['ga12'], sourceModules: ['general_appearance'] },
  { id: 'def3', name: 'Hydrocephalus', category: 'defects', icdCode: 'Q03', description: 'Abnormal accumulation of cerebrospinal fluid within the brain ventricles, causing increased head circumference.', chipIds: ['ga13'], sourceModules: ['general_appearance'] },
  { id: 'def4', name: 'Congenital Heart (suspected)', category: 'defects', icdCode: 'Q24.9', description: 'Suspected structural heart abnormality based on murmur, cyanosis, or abnormal vitals requiring cardiology evaluation.', chipIds: ['vt3'], sourceModules: ['vitals'] },
  { id: 'def5', name: 'Clubfoot/Talipes', category: 'defects', icdCode: 'Q66.0', description: 'Congenital foot deformity with inward rotation and plantar flexion. Early treatment with serial casting is effective.', chipIds: ['p13'], sourceModules: ['posture'] },
  { id: 'def6', name: 'Spina Bifida', category: 'defects', icdCode: 'Q05', description: 'Neural tube defect with incomplete closure of the vertebral column. Severity ranges from occulta to myelomeningocele.', chipIds: ['p14'], sourceModules: ['posture'] },
  { id: 'def7', name: 'Neural Tube Defect', category: 'defects', icdCode: 'Q00', description: 'Failure of neural tube closure during embryonic development affecting brain or spinal cord formation.', chipIds: ['p15'], sourceModules: ['posture'] },
  { id: 'def8', name: 'Polydactyly', category: 'defects', icdCode: 'Q69', description: 'Presence of extra fingers or toes. May be isolated or associated with other congenital syndromes.', chipIds: ['m11'], sourceModules: ['motor'] },
  { id: 'def9', name: 'Iris Coloboma', category: 'defects', icdCode: 'Q13.0', description: 'Gap or notch in the iris from incomplete embryonic fissure closure. May affect vision if retina involved.', chipIds: ['ee16'], sourceModules: ['eyes_external'] },
  { id: 'def10', name: 'High Arched Palate', category: 'defects', icdCode: 'Q38.5', description: 'Unusually narrow, high palatal vault that may affect feeding, speech, and dental alignment.', chipIds: ['d17'], sourceModules: ['dental'] },
  { id: 'def11', name: 'Webbed Neck', category: 'defects', icdCode: 'Q18.3', description: 'Lateral neck skin folds (pterygium colli) often associated with Turner syndrome or Noonan syndrome.', chipIds: ['nk10'], sourceModules: ['neck'] },
  { id: 'def12', name: 'Ankyloglossia/Tongue Tie', category: 'defects', icdCode: 'Q38.1', description: 'Short or tight lingual frenulum restricting tongue mobility. May affect feeding and speech articulation.', chipIds: ['d21'], sourceModules: ['dental'] },

  // === DELAY ===
  { id: 'del1', name: 'Speech/Language Delay', category: 'delay', icdCode: 'F80', description: 'Failure to meet age-appropriate milestones in expressive or receptive language development.', chipIds: ['n1'], sourceModules: ['neurodevelopment'] },
  { id: 'del2', name: 'Gross Motor Delay', category: 'delay', icdCode: 'F82', description: 'Delayed achievement of large-muscle milestones such as sitting, standing, walking, or running.', chipIds: ['m8'], sourceModules: ['motor'] },
  { id: 'del3', name: 'Fine Motor Delay', category: 'delay', icdCode: 'F82', description: 'Delayed development of small-muscle coordination for tasks like grasping, drawing, or buttoning.', chipIds: ['m9'], sourceModules: ['motor'] },
  { id: 'del4', name: 'Cognitive Delay', category: 'delay', icdCode: 'F79', description: 'Below-expected intellectual functioning for age, affecting reasoning, problem-solving, and learning.', chipIds: ['n7'], sourceModules: ['neurodevelopment'] },
  { id: 'del5', name: 'Adaptive Behavior Delay', category: 'delay', icdCode: 'F70', description: 'Difficulty with age-appropriate daily living skills including self-care, communication, and socialization.', chipIds: ['n8'], sourceModules: ['neurodevelopment'] },
  { id: 'del6', name: 'Social Withdrawal', category: 'delay', icdCode: 'F84.0', description: 'Marked reduction in social interaction and engagement with peers beyond typical shyness.', chipIds: ['n2'], sourceModules: ['neurodevelopment'] },

  // === DISABILITY ===
  { id: 'dis1', name: 'Cerebral Palsy', category: 'disability', icdCode: 'G80', description: 'Non-progressive motor disorder from early brain injury affecting movement, posture, and coordination.', chipIds: ['m10'], sourceModules: ['motor'] },
  { id: 'dis2', name: 'Intellectual Disability', category: 'disability', icdCode: 'F79', description: 'Significant limitations in intellectual functioning and adaptive behavior originating before age 18.', chipIds: ['n10'], sourceModules: ['neurodevelopment'] },
  { id: 'dis3', name: 'Autism Spectrum Disorder', category: 'disability', icdCode: 'F84.0', description: 'Neurodevelopmental condition with persistent deficits in social communication and restricted/repetitive behaviors.', chipIds: ['n9', 'n5', 'n6'], sourceModules: ['neurodevelopment'] },
  { id: 'dis4', name: 'Hearing Loss', category: 'disability', icdCode: 'H90', description: 'Partial or complete inability to hear in one or both ears. May be conductive, sensorineural, or mixed.', chipIds: ['hr3', 'hr4', 'hr5'], sourceModules: ['hearing'] },
  { id: 'dis5', name: 'Vision Impairment', category: 'disability', icdCode: 'H54', description: 'Reduced visual acuity or visual field not correctable to normal with standard lenses.', chipIds: ['v7', 'v8', 'v9'], sourceModules: ['vision'] },
  { id: 'dis6', name: 'Scoliosis', category: 'disability', icdCode: 'M41', description: 'Lateral curvature of the spine exceeding 10 degrees. May progress during growth spurts and require monitoring.', chipIds: ['p1'], sourceModules: ['posture'] },

  // === DEFICIENCY ===
  { id: 'defc1', name: 'Severe Acute Malnutrition (SAM)', category: 'deficiency', icdCode: 'E43', description: 'Life-threatening condition with severe wasting (weight-for-height z-score < -3) requiring urgent nutritional rehabilitation.', chipIds: ['ga14'], sourceModules: ['general_appearance'] },
  { id: 'defc2', name: 'Moderate Acute Malnutrition (MAM)', category: 'deficiency', icdCode: 'E44', description: 'Moderate wasting (weight-for-height z-score between -3 and -2) requiring supplementary feeding and monitoring.', chipIds: ['ga15'], sourceModules: ['general_appearance'] },
  { id: 'defc3', name: 'Anemia (clinical)', category: 'deficiency', icdCode: 'D64.9', description: 'Clinical signs of low hemoglobin including pallor of conjunctivae, nail beds, and palms.', chipIds: ['ga3', 'na3', 'ee5'], sourceModules: ['general_appearance', 'nails', 'eyes_external'] },
  { id: 'defc4', name: 'Micronutrient Deficiency', category: 'deficiency', icdCode: 'E61.9', description: 'Deficiency in essential vitamins or minerals manifesting through clinical signs like skin changes or fatigue.', chipIds: ['ga16'], sourceModules: ['general_appearance'] },
  { id: 'defc5', name: 'Goiter (Iodine Deficiency)', category: 'deficiency', icdCode: 'E04', description: 'Thyroid gland enlargement due to iodine deficiency. Graded by visibility and palpation (Grade 1-3).', chipIds: ['nk2', 'nk3', 'nk4'], sourceModules: ['neck'] },
  { id: 'defc6', name: 'Dental Fluorosis', category: 'deficiency', icdCode: 'K00.3', description: 'Enamel defects from excessive fluoride ingestion during tooth development. White spots to brown pitting.', chipIds: ['d12'], sourceModules: ['dental'] },
  { id: 'defc7', name: 'Ichthyosis (Vitamin A)', category: 'deficiency', icdCode: 'Q80', description: 'Dry, rough, scaly skin resembling fish scales, often indicating vitamin A or essential fatty acid deficiency.', chipIds: ['s15'], sourceModules: ['skin'] },
  { id: 'defc8', name: 'Koilonychia (Iron Deficiency)', category: 'deficiency', icdCode: 'L60.3', description: 'Spoon-shaped nails (concave surface) strongly associated with iron deficiency anemia.', chipIds: ['na2'], sourceModules: ['nails'] },
  { id: 'defc9', name: 'SAM by MUAC (<115mm)', category: 'deficiency', icdCode: 'E43', description: 'Mid-upper arm circumference below 115mm indicating severe acute malnutrition requiring immediate treatment.', chipIds: ['muac1'], sourceModules: ['muac'] },
  { id: 'defc10', name: 'MAM by MUAC (115-125mm)', category: 'deficiency', icdCode: 'E44', description: 'Mid-upper arm circumference 115-125mm indicating moderate acute malnutrition requiring supplementary feeding.', chipIds: ['muac2'], sourceModules: ['muac'] },
  { id: 'defc11', name: 'Bilateral Pitting Edema', category: 'deficiency', icdCode: 'E43', description: 'Swelling in both feet/legs that retains a pit when pressed, indicating kwashiorkor or severe malnutrition.', chipIds: ['muac4'], sourceModules: ['muac'] },
  { id: 'defc12', name: 'Poor Dietary Diversity', category: 'deficiency', icdCode: 'E63.1', description: 'Inadequate variety in food groups consumed, increasing risk of multiple micronutrient deficiencies.', chipIds: ['ni_in_h8', 'ni_in_h9', 'ni_in_h10', 'ni_ae_h5', 'ni_ae_h6', 'ni_df_h6', 'ni_df_h7'], sourceModules: ['nutrition_intake'] },

  // === BEHAVIORAL ===
  { id: 'beh1', name: 'ADHD/Hyperactivity', category: 'behavioral', icdCode: 'F90', description: 'Persistent pattern of inattention and/or hyperactivity-impulsivity interfering with functioning or development.', chipIds: ['n3', 'n4'], sourceModules: ['neurodevelopment'] },
  { id: 'beh2', name: 'Anxiety Disorder', category: 'behavioral', icdCode: 'F41.9', description: 'Excessive worry or fear disproportionate to the situation, causing significant distress or functional impairment.', chipIds: ['n11'], sourceModules: ['neurodevelopment'] },
  { id: 'beh3', name: 'Depression', category: 'behavioral', icdCode: 'F32.9', description: 'Persistent sadness, loss of interest, and associated symptoms affecting daily functioning for 2+ weeks.', chipIds: ['n12'], sourceModules: ['neurodevelopment'] },
  { id: 'beh4', name: 'Oppositional Defiant Disorder', category: 'behavioral', icdCode: 'F91.3', description: 'Recurrent pattern of angry, irritable mood with argumentative, defiant, or vindictive behavior toward authority.', chipIds: ['n13'], sourceModules: ['neurodevelopment'] },
  { id: 'beh5', name: 'Conduct Disorder', category: 'behavioral', icdCode: 'F91.9', description: 'Repetitive pattern of behavior violating others\u0027 rights or age-appropriate social norms and rules.', chipIds: ['n14'], sourceModules: ['neurodevelopment'] },
  { id: 'beh6', name: 'Adjustment Disorder', category: 'behavioral', icdCode: 'F43.2', description: 'Emotional or behavioral symptoms in response to an identifiable stressor, beyond normal expected reaction.', chipIds: ['n15'], sourceModules: ['neurodevelopment'] },
  { id: 'beh7', name: 'Emotional Disturbance', category: 'behavioral', icdCode: 'F93.9', description: 'Emotional difficulties including anxiety, mood instability, or social difficulties impacting school performance.', chipIds: ['n16'], sourceModules: ['neurodevelopment'] },
  { id: 'beh8', name: 'Digital Dependency', category: 'behavioral', icdCode: 'F63.0', description: 'Excessive screen time or device use causing impairment in academic, social, or physical functioning.', chipIds: ['n20'], sourceModules: ['neurodevelopment'] },

  // === IMMUNIZATION ===
  { id: 'imz1', name: 'Up to Date', category: 'immunization', description: 'All age-appropriate vaccinations received per national immunization schedule.', chipIds: ['imm1'], sourceModules: ['immunization'] },
  { id: 'imz2', name: 'Partially Immunized', category: 'immunization', icdCode: 'Z28.3', description: 'Some vaccinations received but schedule is incomplete. Catch-up immunization recommended.', chipIds: ['imm2'], sourceModules: ['immunization'] },
  { id: 'imz3', name: 'Not Immunized', category: 'immunization', icdCode: 'Z28.9', description: 'No vaccinations received. Urgent initiation of catch-up immunization schedule required.', chipIds: ['imm3'], sourceModules: ['immunization'] },
  { id: 'imz4', name: 'Immunization Delayed', category: 'immunization', icdCode: 'Z28.8', description: 'Vaccinations started but significantly behind schedule. Requires catch-up plan per guidelines.', chipIds: ['imm4'], sourceModules: ['immunization'] },
  { id: 'imz5', name: 'AEFI Reported', category: 'immunization', icdCode: 'T50.B95', description: 'Adverse event following immunization reported. Document details and report per pharmacovigilance protocol.', chipIds: ['imm6'], sourceModules: ['immunization'] },

  // === LEARNING ===
  { id: 'lrn1', name: 'Dyslexia', category: 'learning', icdCode: 'F81.0', description: 'Specific learning disorder affecting reading accuracy, fluency, and comprehension despite adequate instruction.', chipIds: ['n17'], sourceModules: ['neurodevelopment'] },
  { id: 'lrn2', name: 'Dyscalculia', category: 'learning', icdCode: 'F81.2', description: 'Specific learning disorder affecting number sense, math fact recall, and arithmetic reasoning.', chipIds: ['n18'], sourceModules: ['neurodevelopment'] },
  { id: 'lrn3', name: 'Dysgraphia', category: 'learning', icdCode: 'F81.8', description: 'Specific learning disorder affecting written expression, handwriting legibility, and spelling.', chipIds: ['n19'], sourceModules: ['neurodevelopment'] },
]

export const FOUR_D_CATEGORY_LABELS: Record<FourDCategory, string> = {
  defects: 'Defects (Congenital/Structural)',
  delay: 'Developmental Delay',
  disability: 'Disability',
  deficiency: 'Nutritional Deficiency',
  behavioral: 'Behavioral / Mental Health',
  immunization: 'Immunization Status',
  learning: 'Learning Disabilities',
}

export const FOUR_D_CATEGORY_COLORS: Record<FourDCategory, { bg: string; text: string; badge: string }> = {
  defects: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
  delay: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  disability: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  deficiency: { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
  behavioral: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  immunization: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  learning: { bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800' },
}

const CATEGORY_ORDER: FourDCategory[] = ['defects', 'delay', 'disability', 'deficiency', 'behavioral', 'immunization', 'learning']

export function computeFourDReport(
  child: Child,
  observations: Observation[],
  screenerName: string
): FourDReport {
  const selectedChipsByModule: Record<string, Set<string>> = {}
  const chipSeveritiesMap: Record<string, Severity> = {}
  const screenedModules = new Set<ModuleType>()

  for (const obs of observations) {
    screenedModules.add(obs.moduleType)
    const chips = obs.annotationData?.selectedChips || []
    const severities = obs.annotationData?.chipSeverities || {}

    if (!selectedChipsByModule[obs.moduleType]) {
      selectedChipsByModule[obs.moduleType] = new Set()
    }
    chips.forEach(c => {
      selectedChipsByModule[obs.moduleType].add(c)
      if (severities[c]) chipSeveritiesMap[c] = severities[c]
    })
  }

  const allSelectedChips = new Set<string>()
  Object.values(selectedChipsByModule).forEach(s => s.forEach(c => allSelectedChips.add(c)))

  const results: Record<FourDCategory, FourDConditionResult[]> = {
    defects: [], delay: [], disability: [], deficiency: [],
    behavioral: [], immunization: [], learning: [],
  }

  for (const condition of FOUR_D_CONDITIONS) {
    const sourceScreened = condition.sourceModules.some(m => screenedModules.has(m))

    if (!sourceScreened) {
      results[condition.category].push({ condition, status: 'not_screened' })
      continue
    }

    const matchedChip = condition.chipIds.find(cid => allSelectedChips.has(cid))

    if (matchedChip) {
      results[condition.category].push({
        condition,
        status: 'present',
        severity: chipSeveritiesMap[matchedChip] || undefined,
        sourceModule: condition.sourceModules.find(m => selectedChipsByModule[m]?.has(matchedChip)),
      })
    } else {
      results[condition.category].push({
        condition,
        status: 'absent',
        sourceModule: condition.sourceModules.find(m => screenedModules.has(m)),
      })
    }
  }

  const summary = {} as Record<FourDCategory, { present: number; absent: number; notScreened: number }>
  for (const cat of CATEGORY_ORDER) {
    const conditions = results[cat]
    summary[cat] = {
      present: conditions.filter(c => c.status === 'present').length,
      absent: conditions.filter(c => c.status === 'absent').length,
      notScreened: conditions.filter(c => c.status === 'not_screened').length,
    }
  }

  const totalPresent = Object.values(summary).reduce((s, v) => s + v.present, 0)
  let overallRisk: RiskCategory = 'no_risk'
  if (totalPresent >= 3) overallRisk = 'high_risk'
  else if (totalPresent >= 1) overallRisk = 'possible_risk'

  const dob = new Date(child.dob)
  const now = new Date()
  const ageYears = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  const ageMonths = Math.floor((now.getTime() - dob.getTime()) / (30.44 * 24 * 60 * 60 * 1000)) % 12
  const ageStr = ageYears > 0 ? `${ageYears}y ${ageMonths}m` : `${ageMonths}m`

  return {
    childId: child.id,
    childName: child.name,
    childAge: ageStr,
    screenerName,
    generatedAt: new Date().toISOString(),
    categories: results,
    summary,
    overallRisk,
  }
}
