// Local annotation chip definitions for mobile — mirrors packages/shared/src/annotations.ts
// Maps module types to clinical finding chips with severity and ICD codes

import type { ModuleType } from './types'

export interface ChipDef {
  id: string
  label: string
  category: string
  hasSeverity?: boolean
  icdCode?: string
  locationPin?: boolean
  nurseLevel?: boolean  // identifiable at nurse level (vs. requiring doctor)
}

// ── Per-module chip definitions ─────────────────────────────

const VISION_CHIPS: ChipDef[] = [
  { id: 'v1', label: 'Red reflex normal', category: 'reflex', nurseLevel: true },
  { id: 'v2', label: 'Red reflex abnormal', category: 'reflex', hasSeverity: true, icdCode: 'H21.0', nurseLevel: true },
  { id: 'v3', label: 'Red reflex absent', category: 'reflex', hasSeverity: true, icdCode: 'H21.0', nurseLevel: true },
  { id: 'v4', label: 'White reflex (leukocoria)', category: 'reflex', hasSeverity: true, icdCode: 'H44.8', nurseLevel: true },
  { id: 'v5', label: 'Asymmetric reflex', category: 'reflex', hasSeverity: true, icdCode: 'H50.9', nurseLevel: true },
  { id: 'v6', label: 'Eye alignment normal', category: 'alignment', nurseLevel: true },
  { id: 'v7', label: 'Strabismus', category: 'alignment', hasSeverity: true, icdCode: 'H50.9', nurseLevel: true },
  { id: 'v8', label: 'Nystagmus', category: 'alignment', hasSeverity: true, icdCode: 'H55' },
  { id: 'v9', label: 'Reduced visual acuity', category: 'acuity', hasSeverity: true, icdCode: 'H54', nurseLevel: true },
  { id: 'v10', label: 'Pupil asymmetry', category: 'pupil', hasSeverity: true, icdCode: 'H57.0' },
]

const DENTAL_CHIPS: ChipDef[] = [
  { id: 'd1', label: 'Healthy teeth/gums', category: 'general', nurseLevel: true },
  { id: 'd2', label: 'Dental caries', category: 'teeth', hasSeverity: true, icdCode: 'K02', nurseLevel: true },
  { id: 'd3', label: 'Missing teeth', category: 'teeth', icdCode: 'K08.1', nurseLevel: true },
  { id: 'd4', label: 'Malocclusion', category: 'teeth', hasSeverity: true, icdCode: 'K07', nurseLevel: true },
  { id: 'd5', label: 'Gingivitis', category: 'gums', hasSeverity: true, icdCode: 'K05.1', nurseLevel: true },
  { id: 'd6', label: 'Gum bleeding', category: 'gums', hasSeverity: true, icdCode: 'K06.8', nurseLevel: true },
  { id: 'd7', label: 'Oral ulcers', category: 'oral', hasSeverity: true, locationPin: true, icdCode: 'K12.1', nurseLevel: true },
  { id: 'd8', label: 'Thrush (oral candidiasis)', category: 'oral', hasSeverity: true, icdCode: 'B37.0', nurseLevel: true },
  { id: 'd9', label: 'Delayed eruption', category: 'teeth', icdCode: 'K00.6' },
  { id: 'd10', label: 'Enamel hypoplasia', category: 'teeth', hasSeverity: true, icdCode: 'K00.4' },
  { id: 'd11', label: 'Supernumerary teeth', category: 'teeth', icdCode: 'K00.1' },
  { id: 'd12', label: 'Dental fluorosis', category: 'teeth', hasSeverity: true, icdCode: 'K00.3' },
  { id: 'd13', label: 'Bruxism signs', category: 'teeth', icdCode: 'F45.8' },
  { id: 'd14', label: 'Periodontal disease', category: 'gums', hasSeverity: true, icdCode: 'K05' },
  { id: 'd15', label: 'Abscess', category: 'oral', hasSeverity: true, locationPin: true, icdCode: 'K04.7', nurseLevel: true },
  { id: 'd16', label: 'Crowding', category: 'teeth', hasSeverity: true, icdCode: 'K07.3', nurseLevel: true },
  { id: 'd17', label: 'High arched palate', category: 'palate', icdCode: 'Q38.5' },
  { id: 'd18', label: 'Cleft lip/palate', category: 'palate', hasSeverity: true, icdCode: 'Q37', nurseLevel: true },
  { id: 'd19', label: 'Tongue tie', category: 'oral', icdCode: 'Q38.1' },
  { id: 'd20', label: 'Geographic tongue', category: 'oral', icdCode: 'K14.1' },
  { id: 'd21', label: 'Ankyloglossia', category: 'oral', icdCode: 'Q38.1' },
]

const SKIN_CHIPS: ChipDef[] = [
  { id: 's1', label: 'Normal skin', category: 'general', nurseLevel: true },
  { id: 's2', label: 'Rash/eruption', category: 'lesion', hasSeverity: true, locationPin: true, icdCode: 'R21', nurseLevel: true },
  { id: 's3', label: 'Fungal infection', category: 'infection', hasSeverity: true, locationPin: true, icdCode: 'B36.9', nurseLevel: true },
  { id: 's4', label: 'Scabies', category: 'infection', hasSeverity: true, locationPin: true, icdCode: 'B86', nurseLevel: true },
  { id: 's5', label: 'Impetigo', category: 'infection', hasSeverity: true, locationPin: true, icdCode: 'L01', nurseLevel: true },
  { id: 's6', label: 'Eczema', category: 'condition', hasSeverity: true, locationPin: true, icdCode: 'L30.9', nurseLevel: true },
  { id: 's7', label: 'Psoriasis', category: 'condition', hasSeverity: true, locationPin: true, icdCode: 'L40' },
  { id: 's8', label: 'Vitiligo', category: 'pigment', hasSeverity: true, locationPin: true, icdCode: 'L80', nurseLevel: true },
  { id: 's9', label: 'Hyperpigmentation', category: 'pigment', locationPin: true, icdCode: 'L81.4' },
  { id: 's10', label: 'Wound/laceration', category: 'wound', hasSeverity: true, locationPin: true, icdCode: 'T14.1', nurseLevel: true },
  { id: 's11', label: 'Burn', category: 'wound', hasSeverity: true, locationPin: true, icdCode: 'T30', nurseLevel: true },
  { id: 's12', label: 'Birthmark/nevus', category: 'pigment', locationPin: true, icdCode: 'Q82.5', nurseLevel: true },
  { id: 's13', label: 'Warts', category: 'growth', locationPin: true, icdCode: 'B07', nurseLevel: true },
  { id: 's14', label: 'Keloid/scar', category: 'wound', locationPin: true, icdCode: 'L91.0', nurseLevel: true },
  { id: 's15', label: 'Ichthyosis', category: 'condition', hasSeverity: true, icdCode: 'Q80' },
  { id: 's16', label: 'Pediculosis', category: 'infection', hasSeverity: true, icdCode: 'B85', nurseLevel: true },
]

const EAR_CHIPS: ChipDef[] = [
  // Left ear
  { id: 'e1_l', label: 'Left TM normal', category: 'left_ear', nurseLevel: true },
  { id: 'e2_l', label: 'Left TM erythematous', category: 'left_ear', hasSeverity: true, icdCode: 'H66.9' },
  { id: 'e3_l', label: 'Left TM bulging', category: 'left_ear', hasSeverity: true, icdCode: 'H66.0' },
  { id: 'e4_l', label: 'Left TM retracted', category: 'left_ear', hasSeverity: true, icdCode: 'H73.0' },
  { id: 'e5_l', label: 'Left effusion/fluid', category: 'left_ear', hasSeverity: true, icdCode: 'H65.9' },
  { id: 'e6_l', label: 'Left perforation', category: 'left_ear', hasSeverity: true, icdCode: 'H72' },
  { id: 'e7_l', label: 'Left wax impaction', category: 'left_ear', hasSeverity: true, icdCode: 'H61.2', nurseLevel: true },
  { id: 'e8_l', label: 'Left otitis externa', category: 'left_ear', hasSeverity: true, icdCode: 'H60' },
  { id: 'e9_l', label: 'Left foreign body', category: 'left_ear', hasSeverity: true, icdCode: 'T16', nurseLevel: true },
  { id: 'e10_l', label: 'Left discharge', category: 'left_ear', hasSeverity: true, icdCode: 'H92.1', nurseLevel: true },
  // Right ear
  { id: 'e1_r', label: 'Right TM normal', category: 'right_ear', nurseLevel: true },
  { id: 'e2_r', label: 'Right TM erythematous', category: 'right_ear', hasSeverity: true, icdCode: 'H66.9' },
  { id: 'e3_r', label: 'Right TM bulging', category: 'right_ear', hasSeverity: true, icdCode: 'H66.0' },
  { id: 'e4_r', label: 'Right TM retracted', category: 'right_ear', hasSeverity: true, icdCode: 'H73.0' },
  { id: 'e5_r', label: 'Right effusion/fluid', category: 'right_ear', hasSeverity: true, icdCode: 'H65.9' },
  { id: 'e6_r', label: 'Right perforation', category: 'right_ear', hasSeverity: true, icdCode: 'H72' },
  { id: 'e7_r', label: 'Right wax impaction', category: 'right_ear', hasSeverity: true, icdCode: 'H61.2', nurseLevel: true },
  { id: 'e8_r', label: 'Right otitis externa', category: 'right_ear', hasSeverity: true, icdCode: 'H60' },
  { id: 'e9_r', label: 'Right foreign body', category: 'right_ear', hasSeverity: true, icdCode: 'T16', nurseLevel: true },
  { id: 'e10_r', label: 'Right discharge', category: 'right_ear', hasSeverity: true, icdCode: 'H92.1', nurseLevel: true },
]

const HEARING_CHIPS: ChipDef[] = [
  { id: 'hr1', label: 'Hearing normal', category: 'general', nurseLevel: true },
  { id: 'hr2', label: 'Hearing normal (bilateral)', category: 'general', nurseLevel: true },
  { id: 'hr3', label: 'Mild hearing loss', category: 'loss', hasSeverity: true, icdCode: 'H90.5', nurseLevel: true },
  { id: 'hr4', label: 'Moderate hearing loss', category: 'loss', hasSeverity: true, icdCode: 'H90.5', nurseLevel: true },
  { id: 'hr5', label: 'Severe hearing loss', category: 'loss', hasSeverity: true, icdCode: 'H90.3', nurseLevel: true },
  { id: 'hr6', label: 'Unilateral loss (left)', category: 'loss', hasSeverity: true, icdCode: 'H90.1', nurseLevel: true },
  { id: 'hr7', label: 'Unilateral loss (right)', category: 'loss', hasSeverity: true, icdCode: 'H90.0', nurseLevel: true },
]

const EYES_EXTERNAL_CHIPS: ChipDef[] = [
  { id: 'ee1', label: 'Eyes normal', category: 'general', nurseLevel: true },
  { id: 'ee2', label: 'Conjunctival pallor', category: 'conjunctiva', hasSeverity: true, icdCode: 'H10.4', nurseLevel: true },
  { id: 'ee3', label: 'Conjunctivitis', category: 'conjunctiva', hasSeverity: true, icdCode: 'H10.9', nurseLevel: true },
  { id: 'ee4', label: 'Jaundice/icterus', category: 'sclera', hasSeverity: true, icdCode: 'R17', nurseLevel: true },
  { id: 'ee5', label: 'Conjunctival pallor (anemia)', category: 'conjunctiva', hasSeverity: true, icdCode: 'D64.9', nurseLevel: true },
  { id: 'ee6', label: 'Ptosis', category: 'eyelid', hasSeverity: true, icdCode: 'H02.4', nurseLevel: true },
  { id: 'ee7', label: 'Squint/strabismus', category: 'alignment', hasSeverity: true, icdCode: 'H50.9', nurseLevel: true },
  { id: 'ee8', label: 'Eye discharge', category: 'infection', hasSeverity: true, icdCode: 'H10.0', nurseLevel: true },
  { id: 'ee9', label: 'Periorbital edema', category: 'eyelid', hasSeverity: true, icdCode: 'H05.2', nurseLevel: true },
  { id: 'ee10', label: 'Stye/chalazion', category: 'eyelid', hasSeverity: true, locationPin: true, icdCode: 'H00', nurseLevel: true },
  { id: 'ee11', label: 'Watering (epiphora)', category: 'tear', icdCode: 'H04.2', nurseLevel: true },
  { id: 'ee12', label: 'Proptosis', category: 'orbital', hasSeverity: true, icdCode: 'H05.2' },
  { id: 'ee13', label: 'Subconjunctival hemorrhage', category: 'conjunctiva', icdCode: 'H11.3', nurseLevel: true },
  { id: 'ee14', label: 'Photophobia', category: 'symptom', hasSeverity: true, icdCode: 'H53.1' },
  { id: 'ee15', label: 'Corneal opacity', category: 'cornea', hasSeverity: true, icdCode: 'H17' },
  { id: 'ee16', label: 'Iris coloboma', category: 'iris', icdCode: 'Q13.0' },
]

const GENERAL_APPEARANCE_CHIPS: ChipDef[] = [
  { id: 'ga1', label: 'Well-nourished', category: 'nutrition', nurseLevel: true },
  { id: 'ga2', label: 'Malnourished', category: 'nutrition', hasSeverity: true, icdCode: 'E46', nurseLevel: true },
  { id: 'ga3', label: 'Pallor', category: 'color', hasSeverity: true, icdCode: 'R23.1', nurseLevel: true },
  { id: 'ga4', label: 'Cyanosis', category: 'color', hasSeverity: true, icdCode: 'R23.0', nurseLevel: true },
  { id: 'ga5', label: 'Jaundice', category: 'color', hasSeverity: true, icdCode: 'R17', nurseLevel: true },
  { id: 'ga6', label: 'Dehydrated', category: 'hydration', hasSeverity: true, icdCode: 'E86', nurseLevel: true },
  { id: 'ga7', label: 'Edema', category: 'hydration', hasSeverity: true, locationPin: true, icdCode: 'R60', nurseLevel: true },
  { id: 'ga8', label: 'Lethargic', category: 'activity', hasSeverity: true, icdCode: 'R53', nurseLevel: true },
  { id: 'ga9', label: 'Irritable', category: 'activity', hasSeverity: true, nurseLevel: true },
  { id: 'ga10', label: 'Short stature', category: 'growth', hasSeverity: true, icdCode: 'E34.3', nurseLevel: true },
  { id: 'ga11', label: 'Obesity', category: 'growth', hasSeverity: true, icdCode: 'E66', nurseLevel: true },
  { id: 'ga12', label: 'Down syndrome features', category: 'congenital', hasSeverity: true, icdCode: 'Q90' },
  { id: 'ga13', label: 'Hydrocephalus', category: 'congenital', hasSeverity: true, icdCode: 'Q03' },
  { id: 'ga14', label: 'SAM features', category: 'nutrition', hasSeverity: true, icdCode: 'E43', nurseLevel: true },
  { id: 'ga15', label: 'MAM features', category: 'nutrition', hasSeverity: true, icdCode: 'E44', nurseLevel: true },
  { id: 'ga16', label: 'Micronutrient deficiency signs', category: 'nutrition', hasSeverity: true, icdCode: 'E61.9' },
]

const HAIR_CHIPS: ChipDef[] = [
  { id: 'h1', label: 'Hair normal', category: 'general', nurseLevel: true },
  { id: 'h2', label: 'Pediculosis (lice)', category: 'infection', hasSeverity: true, icdCode: 'B85.0', nurseLevel: true },
  { id: 'h3', label: 'Dandruff/seborrhea', category: 'scalp', hasSeverity: true, icdCode: 'L21', nurseLevel: true },
  { id: 'h4', label: 'Alopecia/thinning', category: 'loss', hasSeverity: true, locationPin: true, icdCode: 'L63', nurseLevel: true },
  { id: 'h5', label: 'Tinea capitis', category: 'infection', hasSeverity: true, locationPin: true, icdCode: 'B35.0', nurseLevel: true },
  { id: 'h6', label: 'Flag sign (malnutrition)', category: 'nutrition', hasSeverity: true, icdCode: 'E46', nurseLevel: true },
  { id: 'h7', label: 'Sparse/brittle hair', category: 'nutrition', hasSeverity: true, icdCode: 'E46', nurseLevel: true },
]

const NAILS_CHIPS: ChipDef[] = [
  { id: 'na1', label: 'Nails normal', category: 'general', nurseLevel: true },
  { id: 'na2', label: 'Koilonychia (spoon nails)', category: 'shape', hasSeverity: true, icdCode: 'L60.3', nurseLevel: true },
  { id: 'na3', label: 'Nail bed pallor', category: 'color', hasSeverity: true, icdCode: 'D64.9', nurseLevel: true },
  { id: 'na4', label: 'Clubbing', category: 'shape', hasSeverity: true, icdCode: 'R68.3' },
  { id: 'na5', label: 'Cyanotic nail beds', category: 'color', hasSeverity: true, icdCode: 'R23.0', nurseLevel: true },
  { id: 'na6', label: 'Fungal infection', category: 'infection', hasSeverity: true, icdCode: 'B35.1', nurseLevel: true },
  { id: 'na7', label: 'Bitten nails', category: 'habit', nurseLevel: true },
  { id: 'na8', label: 'Brittle/ridged nails', category: 'nutrition', icdCode: 'L60.3', nurseLevel: true },
]

const NOSE_CHIPS: ChipDef[] = [
  { id: 'no1', label: 'Nose normal', category: 'general', nurseLevel: true },
  { id: 'no2', label: 'Nasal discharge', category: 'discharge', hasSeverity: true, icdCode: 'R09.8', nurseLevel: true },
  { id: 'no3', label: 'Deviated septum', category: 'structure', hasSeverity: true, icdCode: 'J34.2' },
  { id: 'no4', label: 'Turbinate hypertrophy', category: 'structure', hasSeverity: true, icdCode: 'J34.3' },
  { id: 'no5', label: 'Nasal polyp', category: 'structure', hasSeverity: true, icdCode: 'J33' },
  { id: 'no6', label: 'Epistaxis signs', category: 'bleeding', hasSeverity: true, icdCode: 'R04.0', nurseLevel: true },
  { id: 'no7', label: 'Allergic salute', category: 'allergy', icdCode: 'J30.9', nurseLevel: true },
]

const THROAT_CHIPS: ChipDef[] = [
  { id: 'th1', label: 'Throat normal', category: 'general', nurseLevel: true },
  { id: 'th2', label: 'Tonsillar enlargement', category: 'tonsils', hasSeverity: true, icdCode: 'J35.1', nurseLevel: true },
  { id: 'th3', label: 'Tonsillar exudate', category: 'tonsils', hasSeverity: true, icdCode: 'J03.9', nurseLevel: true },
  { id: 'th4', label: 'Pharyngitis', category: 'pharynx', hasSeverity: true, icdCode: 'J02.9', nurseLevel: true },
  { id: 'th5', label: 'Uvula deviation', category: 'palate', icdCode: 'Q38.5' },
  { id: 'th6', label: 'Post-nasal drip', category: 'discharge', icdCode: 'R09.8', nurseLevel: true },
]

const NECK_CHIPS: ChipDef[] = [
  { id: 'nk1', label: 'Neck normal', category: 'general', nurseLevel: true },
  { id: 'nk2', label: 'Goiter Grade I', category: 'thyroid', hasSeverity: true, icdCode: 'E04.0', nurseLevel: true },
  { id: 'nk3', label: 'Goiter Grade II', category: 'thyroid', hasSeverity: true, icdCode: 'E04.0', nurseLevel: true },
  { id: 'nk4', label: 'Goiter Grade III', category: 'thyroid', hasSeverity: true, icdCode: 'E04.0', nurseLevel: true },
  { id: 'nk5', label: 'Lymphadenopathy', category: 'lymph', hasSeverity: true, icdCode: 'R59', nurseLevel: true },
  { id: 'nk6', label: 'Torticollis', category: 'musculoskeletal', hasSeverity: true, icdCode: 'M43.6', nurseLevel: true },
  { id: 'nk7', label: 'Thyroid nodule', category: 'thyroid', hasSeverity: true, icdCode: 'E04.1' },
  { id: 'nk8', label: 'Cystic hygroma', category: 'congenital', hasSeverity: true, icdCode: 'D18.1' },
  { id: 'nk9', label: 'Branchial cleft cyst', category: 'congenital', hasSeverity: true, icdCode: 'Q18.0' },
  { id: 'nk10', label: 'Webbed neck', category: 'congenital', icdCode: 'Q18.3' },
]

const ABDOMEN_CHIPS: ChipDef[] = [
  { id: 'ab1', label: 'Abdomen normal', category: 'general', nurseLevel: true },
  { id: 'ab2', label: 'Distension', category: 'inspection', hasSeverity: true, icdCode: 'R14', nurseLevel: true },
  { id: 'ab3', label: 'Umbilical hernia', category: 'hernia', hasSeverity: true, locationPin: true, icdCode: 'K42', nurseLevel: true },
  { id: 'ab4', label: 'Inguinal hernia', category: 'hernia', hasSeverity: true, locationPin: true, icdCode: 'K40', nurseLevel: true },
  { id: 'ab5', label: 'Hepatomegaly', category: 'organ', hasSeverity: true, icdCode: 'R16.0' },
  { id: 'ab6', label: 'Splenomegaly', category: 'organ', hasSeverity: true, icdCode: 'R16.1' },
  { id: 'ab7', label: 'Tenderness', category: 'palpation', hasSeverity: true, locationPin: true, icdCode: 'R10', nurseLevel: true },
  { id: 'ab8', label: 'Ascites', category: 'fluid', hasSeverity: true, icdCode: 'R18' },
]

const POSTURE_CHIPS: ChipDef[] = [
  { id: 'p1', label: 'Scoliosis', category: 'spine', hasSeverity: true, icdCode: 'M41', nurseLevel: true },
  { id: 'p2', label: 'Kyphosis', category: 'spine', hasSeverity: true, icdCode: 'M40.2', nurseLevel: true },
  { id: 'p3', label: 'Lordosis', category: 'spine', hasSeverity: true, icdCode: 'M40.5' },
  { id: 'p4', label: 'Normal posture', category: 'general', nurseLevel: true },
  { id: 'p5', label: 'Genu valgum (knock knee)', category: 'limb', hasSeverity: true, icdCode: 'M21.0', nurseLevel: true },
  { id: 'p6', label: 'Genu varum (bow leg)', category: 'limb', hasSeverity: true, icdCode: 'M21.1', nurseLevel: true },
  { id: 'p7', label: 'Flat feet', category: 'foot', hasSeverity: true, icdCode: 'M21.4', nurseLevel: true },
  { id: 'p8', label: 'Limb length discrepancy', category: 'limb', hasSeverity: true, icdCode: 'M21.7', nurseLevel: true },
  { id: 'p9', label: 'Shoulder asymmetry', category: 'trunk', hasSeverity: true, nurseLevel: true },
  { id: 'p10', label: 'Pelvic tilt', category: 'trunk', hasSeverity: true },
  { id: 'p11', label: 'Winging scapula', category: 'trunk', hasSeverity: true, icdCode: 'M89.8' },
  { id: 'p12', label: 'Trendelenburg gait', category: 'gait', hasSeverity: true },
  { id: 'p13', label: 'Clubfoot/talipes', category: 'foot', hasSeverity: true, icdCode: 'Q66.0', nurseLevel: true },
  { id: 'p14', label: 'Spina bifida', category: 'spine', hasSeverity: true, icdCode: 'Q05' },
  { id: 'p15', label: 'Neural tube defect', category: 'spine', hasSeverity: true, icdCode: 'Q00' },
]

const MOTOR_CHIPS: ChipDef[] = [
  { id: 'm1', label: 'Motor skills normal', category: 'general', nurseLevel: true },
  { id: 'm2', label: 'Poor balance', category: 'balance', hasSeverity: true, nurseLevel: true },
  { id: 'm3', label: 'Abnormal gait', category: 'gait', hasSeverity: true, icdCode: 'R26', nurseLevel: true },
  { id: 'm4', label: 'Reduced ROM', category: 'flexibility', hasSeverity: true, locationPin: true },
  { id: 'm5', label: 'Muscle weakness', category: 'strength', hasSeverity: true, icdCode: 'M62.8' },
  { id: 'm6', label: 'Spasticity', category: 'tone', hasSeverity: true, icdCode: 'G80' },
  { id: 'm7', label: 'Hypotonia', category: 'tone', hasSeverity: true, icdCode: 'P94.2' },
  { id: 'm8', label: 'Gross motor delay', category: 'delay', hasSeverity: true, icdCode: 'F82', nurseLevel: true },
  { id: 'm9', label: 'Fine motor delay', category: 'delay', hasSeverity: true, icdCode: 'F82', nurseLevel: true },
  { id: 'm10', label: 'Cerebral palsy signs', category: 'neurological', hasSeverity: true, icdCode: 'G80' },
  { id: 'm11', label: 'Polydactyly', category: 'congenital', icdCode: 'Q69', nurseLevel: true },
]

const LYMPH_CHIPS: ChipDef[] = [
  { id: 'ly1', label: 'Lymph nodes normal', category: 'general', nurseLevel: true },
  { id: 'ly2', label: 'Cervical lymphadenopathy', category: 'cervical', hasSeverity: true, locationPin: true, icdCode: 'R59.0', nurseLevel: true },
  { id: 'ly3', label: 'Axillary lymphadenopathy', category: 'axillary', hasSeverity: true, locationPin: true, icdCode: 'R59.0', nurseLevel: true },
  { id: 'ly4', label: 'Inguinal lymphadenopathy', category: 'inguinal', hasSeverity: true, locationPin: true, icdCode: 'R59.0', nurseLevel: true },
  { id: 'ly5', label: 'Generalized lymphadenopathy', category: 'generalized', hasSeverity: true, icdCode: 'R59.1' },
]

const NEURODEVELOPMENT_CHIPS: ChipDef[] = [
  { id: 'n1', label: 'Speech/language delay', category: 'development', hasSeverity: true, icdCode: 'F80', nurseLevel: true },
  { id: 'n2', label: 'Social withdrawal', category: 'behavioral', hasSeverity: true, icdCode: 'F84.0', nurseLevel: true },
  { id: 'n3', label: 'Hyperactivity', category: 'behavioral', hasSeverity: true, icdCode: 'F90', nurseLevel: true },
  { id: 'n4', label: 'Inattention', category: 'behavioral', hasSeverity: true, icdCode: 'F90', nurseLevel: true },
  { id: 'n5', label: 'Repetitive behaviors', category: 'behavioral', hasSeverity: true, icdCode: 'F84.0', nurseLevel: true },
  { id: 'n6', label: 'Sensory sensitivity', category: 'behavioral', hasSeverity: true, icdCode: 'F84.0' },
  { id: 'n7', label: 'Cognitive delay', category: 'development', hasSeverity: true, icdCode: 'F79' },
  { id: 'n8', label: 'Adaptive behavior delay', category: 'development', hasSeverity: true, icdCode: 'F70' },
  { id: 'n9', label: 'ASD screening positive', category: 'screening', hasSeverity: true, icdCode: 'F84.0' },
  { id: 'n10', label: 'Intellectual disability', category: 'development', hasSeverity: true, icdCode: 'F79' },
  { id: 'n11', label: 'Anxiety disorder', category: 'behavioral', hasSeverity: true, icdCode: 'F41.9' },
  { id: 'n12', label: 'Depression', category: 'behavioral', hasSeverity: true, icdCode: 'F32.9' },
  { id: 'n13', label: 'Oppositional defiant', category: 'behavioral', hasSeverity: true, icdCode: 'F91.3' },
  { id: 'n14', label: 'Conduct disorder', category: 'behavioral', hasSeverity: true, icdCode: 'F91.9' },
  { id: 'n15', label: 'Adjustment disorder', category: 'behavioral', hasSeverity: true, icdCode: 'F43.2' },
  { id: 'n16', label: 'Emotional disturbance', category: 'behavioral', hasSeverity: true, icdCode: 'F93.9' },
  { id: 'n17', label: 'Dyslexia', category: 'learning', hasSeverity: true, icdCode: 'F81.0' },
  { id: 'n18', label: 'Dyscalculia', category: 'learning', hasSeverity: true, icdCode: 'F81.2' },
  { id: 'n19', label: 'Dysgraphia', category: 'learning', hasSeverity: true, icdCode: 'F81.8' },
  { id: 'n20', label: 'Digital dependency', category: 'behavioral', hasSeverity: true, icdCode: 'F63.0', nurseLevel: true },
  { id: 'n21', label: 'Normal development', category: 'general', nurseLevel: true },
]

const RESPIRATORY_CHIPS: ChipDef[] = [
  { id: 'r1', label: 'Breath sounds normal', category: 'general', nurseLevel: true },
  { id: 'r2', label: 'Wheeze', category: 'sounds', hasSeverity: true, icdCode: 'R06.2', nurseLevel: true },
  { id: 'r3', label: 'Crackles/rales', category: 'sounds', hasSeverity: true, icdCode: 'R09.8' },
  { id: 'r4', label: 'Stridor', category: 'sounds', hasSeverity: true, icdCode: 'R06.1', nurseLevel: true },
  { id: 'r5', label: 'Dry cough', category: 'cough', hasSeverity: true, icdCode: 'R05', nurseLevel: true },
  { id: 'r6', label: 'Wet/productive cough', category: 'cough', hasSeverity: true, icdCode: 'R05', nurseLevel: true },
  { id: 'r7', label: 'Tachypnea', category: 'rate', hasSeverity: true, icdCode: 'R06.0', nurseLevel: true },
  { id: 'r8', label: 'Chest retraction', category: 'distress', hasSeverity: true, icdCode: 'R06.0', nurseLevel: true },
]

const VITALS_CHIPS: ChipDef[] = [
  { id: 'vt1', label: 'Vitals normal', category: 'general', nurseLevel: true },
  { id: 'vt2', label: 'Tachycardia', category: 'heart_rate', hasSeverity: true, icdCode: 'R00.0', nurseLevel: true },
  { id: 'vt3', label: 'Heart murmur', category: 'heart', hasSeverity: true, icdCode: 'R01.1' },
  { id: 'vt4', label: 'Bradycardia', category: 'heart_rate', hasSeverity: true, icdCode: 'R00.1', nurseLevel: true },
  { id: 'vt5', label: 'Irregular rhythm', category: 'rhythm', hasSeverity: true, icdCode: 'R00.8' },
]

const IMMUNIZATION_CHIPS: ChipDef[] = [
  { id: 'imm1', label: 'Up to date', category: 'status', nurseLevel: true },
  { id: 'imm2', label: 'Partially immunized', category: 'status', hasSeverity: true, icdCode: 'Z28.3', nurseLevel: true },
  { id: 'imm3', label: 'Not immunized', category: 'status', hasSeverity: true, icdCode: 'Z28.9', nurseLevel: true },
  { id: 'imm4', label: 'Delayed schedule', category: 'status', hasSeverity: true, icdCode: 'Z28.8', nurseLevel: true },
  { id: 'imm5', label: 'No records available', category: 'status', nurseLevel: true },
  { id: 'imm6', label: 'AEFI reported', category: 'adverse', hasSeverity: true, icdCode: 'T50.B95', nurseLevel: true },
]

const CARDIAC_CHIPS: ChipDef[] = [
  { id: 'ca1', label: 'Heart sounds normal', category: 'general', nurseLevel: true },
  { id: 'ca2', label: 'Systolic murmur', category: 'murmur', hasSeverity: true, icdCode: 'R01.1' },
  { id: 'ca3', label: 'Diastolic murmur', category: 'murmur', hasSeverity: true, icdCode: 'R01.1' },
  { id: 'ca4', label: 'S3 gallop', category: 'extra_sounds', hasSeverity: true },
  { id: 'ca5', label: 'S4 gallop', category: 'extra_sounds', hasSeverity: true },
  { id: 'ca6', label: 'Split S2', category: 'extra_sounds', hasSeverity: true },
  { id: 'ca7', label: 'Innocent murmur', category: 'murmur' },
]

const PULMONARY_CHIPS: ChipDef[] = [
  { id: 'pu1', label: 'Lung sounds normal', category: 'general', nurseLevel: true },
  { id: 'pu2', label: 'Wheeze bilateral', category: 'adventitious', hasSeverity: true, icdCode: 'R06.2' },
  { id: 'pu3', label: 'Crackles basal', category: 'adventitious', hasSeverity: true },
  { id: 'pu4', label: 'Reduced air entry', category: 'breath_sounds', hasSeverity: true },
  { id: 'pu5', label: 'Bronchial breathing', category: 'breath_sounds', hasSeverity: true },
  { id: 'pu6', label: 'Pleural rub', category: 'adventitious', hasSeverity: true },
]

const MUAC_CHIPS: ChipDef[] = [
  { id: 'muac1', label: 'SAM (<115mm)', category: 'classification', hasSeverity: true, icdCode: 'E43', nurseLevel: true },
  { id: 'muac2', label: 'MAM (115-125mm)', category: 'classification', hasSeverity: true, icdCode: 'E44', nurseLevel: true },
  { id: 'muac3', label: 'Normal (>125mm)', category: 'classification', nurseLevel: true },
  { id: 'muac4', label: 'Bilateral pitting edema', category: 'edema', hasSeverity: true, icdCode: 'E43', nurseLevel: true },
]

const NUTRITION_INTAKE_CHIPS: ChipDef[] = [
  { id: 'ni1', label: 'Adequate diet', category: 'general', nurseLevel: true },
  { id: 'ni2', label: 'Inadequate protein', category: 'macro', hasSeverity: true, nurseLevel: true },
  { id: 'ni3', label: 'Inadequate calories', category: 'macro', hasSeverity: true, nurseLevel: true },
  { id: 'ni4', label: 'No fruits/vegetables', category: 'micro', hasSeverity: true, nurseLevel: true },
  { id: 'ni5', label: 'No dairy/calcium', category: 'micro', hasSeverity: true, nurseLevel: true },
  { id: 'ni6', label: 'Iron-poor diet', category: 'micro', hasSeverity: true, nurseLevel: true },
  { id: 'ni7', label: 'Junk food excess', category: 'pattern', hasSeverity: true, nurseLevel: true },
  { id: 'ni8', label: 'Low dietary diversity', category: 'diversity', hasSeverity: true, icdCode: 'E63.1', nurseLevel: true },
  { id: 'ni9', label: 'Skips meals regularly', category: 'pattern', hasSeverity: true, nurseLevel: true },
  { id: 'ni10', label: 'Food insecurity', category: 'access', hasSeverity: true, icdCode: 'E63.1', nurseLevel: true },
]

const INTERVENTION_CHIPS: ChipDef[] = [
  { id: 'iv1', label: 'Iron supplementation', category: 'supplement', nurseLevel: true },
  { id: 'iv2', label: 'Vitamin A supplementation', category: 'supplement', nurseLevel: true },
  { id: 'iv3', label: 'Zinc supplementation', category: 'supplement', nurseLevel: true },
  { id: 'iv4', label: 'Deworming done', category: 'deworming', nurseLevel: true },
  { id: 'iv5', label: 'Mid-day meal (MDM)', category: 'feeding_program', nurseLevel: true },
  { id: 'iv6', label: 'Take-home ration (THR)', category: 'feeding_program', nurseLevel: true },
  { id: 'iv7', label: 'Therapeutic food (RUTF)', category: 'therapeutic', hasSeverity: true, nurseLevel: true },
  { id: 'iv8', label: 'ORS/rehydration', category: 'therapeutic', nurseLevel: true },
  { id: 'iv9', label: 'Referred to NRC', category: 'referral', hasSeverity: true, nurseLevel: true },
]

// ── Master config map ─────────────────────────────

const MODULE_CHIP_MAP: Record<string, ChipDef[]> = {
  vision: VISION_CHIPS,
  dental: DENTAL_CHIPS,
  skin: SKIN_CHIPS,
  ear: EAR_CHIPS,
  hearing: HEARING_CHIPS,
  eyes_external: EYES_EXTERNAL_CHIPS,
  general_appearance: GENERAL_APPEARANCE_CHIPS,
  hair: HAIR_CHIPS,
  nails: NAILS_CHIPS,
  nose: NOSE_CHIPS,
  throat: THROAT_CHIPS,
  neck: NECK_CHIPS,
  abdomen: ABDOMEN_CHIPS,
  posture: POSTURE_CHIPS,
  motor: MOTOR_CHIPS,
  lymph: LYMPH_CHIPS,
  neurodevelopment: NEURODEVELOPMENT_CHIPS,
  respiratory: RESPIRATORY_CHIPS,
  vitals: VITALS_CHIPS,
  immunization: IMMUNIZATION_CHIPS,
  cardiac: CARDIAC_CHIPS,
  pulmonary: PULMONARY_CHIPS,
  muac: MUAC_CHIPS,
  nutrition_intake: NUTRITION_INTAKE_CHIPS,
  intervention: INTERVENTION_CHIPS,
}

export function getChipsForModule(moduleType: ModuleType): ChipDef[] {
  return MODULE_CHIP_MAP[moduleType] ?? []
}

export function getChipById(chipId: string): ChipDef | undefined {
  for (const chips of Object.values(MODULE_CHIP_MAP)) {
    const chip = chips.find(c => c.id === chipId)
    if (chip) return chip
  }
  return undefined
}

// ── Rich module guidance for nurse on-screen help ──────────────

export interface ModuleGuidance {
  instruction: string
  lookFor: string[]
  environment?: string[]
  equipment?: string[]
  positioning?: string
  captureMethod?: string
  duration?: string
  tips?: string[]
}

const MODULE_GUIDANCE: Record<string, ModuleGuidance> = {
  height: {
    instruction: 'Stand child straight against wall or stadiometer, feet flat',
    lookFor: ['Accurate heel-to-head measurement', 'Shoes removed', 'Head in Frankfurt plane'],
    equipment: ['Stadiometer or height board', 'Flat surface against wall'],
    positioning: 'Child standing straight, heels together, back against board',
    duration: '1 minute',
    tips: ['Ensure child looks straight ahead', 'Press hair down gently for accurate reading'],
  },
  weight: {
    instruction: 'Use calibrated scale, minimal clothing, no shoes',
    lookFor: ['Scale zeroed before measurement', 'Child standing still', 'Light clothing only'],
    equipment: ['Digital weighing scale (calibrated)'],
    positioning: 'Child standing still on center of scale',
    duration: '1 minute',
    tips: ['Zero the scale before each measurement', 'Remove heavy clothing and shoes', 'Record to nearest 0.1 kg'],
  },
  spo2: {
    instruction: 'Place pulse oximeter on fingertip, wait for stable reading',
    lookFor: ['Warm hands for accurate reading', 'Stable waveform', 'No nail polish'],
    equipment: ['Pulse oximeter (fingertip type)'],
    positioning: 'Child seated, hand resting on table, finger relaxed',
    duration: '30 seconds',
    tips: ['Warm cold fingers before measuring', 'Remove nail polish if present', 'Wait for stable reading with good waveform'],
  },
  hemoglobin: {
    instruction: 'Use HemoCue or photometric method on capillary blood sample',
    lookFor: ['Clean puncture site', 'Adequate blood drop', 'Device calibrated'],
    equipment: ['HemoCue device', 'Lancet', 'Alcohol swab', 'Microcuvette'],
    positioning: 'Child seated, hand resting palm-up on table',
    duration: '2-3 minutes',
    tips: ['Clean finger with alcohol, let dry', 'Use ring finger or middle finger', 'Wipe first drop, use second drop'],
  },
  bp: {
    instruction: 'Use appropriately sized cuff, child seated and relaxed for 5 min',
    lookFor: ['Correct cuff size', 'Arm at heart level', 'Two readings recommended'],
    equipment: ['Digital BP monitor', 'Appropriate cuff size for child'],
    positioning: 'Child seated quietly for 5 min, arm supported at heart level',
    duration: '5-7 minutes',
    tips: ['Cuff bladder should cover 80% of arm circumference', 'Take 2 readings, 1 min apart', 'Use right arm consistently'],
  },
  muac: {
    instruction: 'Measure mid-point of left upper arm between shoulder and elbow',
    lookFor: ['Arm relaxed at side', 'Tape snug but not tight', 'Read in millimeters'],
    equipment: ['MUAC tape (color-coded)'],
    positioning: 'Child standing, left arm relaxed at side',
    duration: '1 minute',
    tips: ['Find midpoint between shoulder tip and elbow', 'Tape should be snug but not compressing skin', 'Read through the window/mark'],
  },
  vision: {
    instruction: 'Use phone flash in dim room for red reflex; assess at 30cm distance',
    lookFor: ['Red reflex symmetry', 'White reflex (leukocoria)', 'Eye alignment', 'Pupil size'],
    environment: ['Dim lighting for red reflex test'],
    equipment: ['Phone flashlight or direct ophthalmoscope'],
    positioning: 'Child at 30cm from camera, looking straight at lens',
    captureMethod: 'Take photo with flash on in dim room to capture red reflex',
    duration: '1-2 minutes',
    tips: ['Turn off room lights for better red reflex', 'Both eyes should show equal red-orange reflex', 'White reflex is an emergency finding'],
  },
  dental: {
    instruction: 'Open mouth wide, use flashlight to examine teeth, gums, and palate',
    lookFor: ['Dental caries (cavities)', 'Swollen/bleeding gums', 'Missing teeth', 'Malocclusion'],
    equipment: ['Flashlight/torch', 'Tongue depressor (optional)'],
    positioning: 'Child seated, mouth open wide, head tilted back slightly',
    captureMethod: 'Take photo of upper and lower teeth with good lighting',
    duration: '2-3 minutes',
    tips: ['Check all 4 quadrants systematically', 'Look for dark spots or holes in teeth', 'Check gum color — red/swollen = gingivitis'],
  },
  skin: {
    instruction: 'Examine exposed skin in good lighting, check all visible areas',
    lookFor: ['Rashes or eruptions', 'Fungal patches', 'Scabies burrows', 'Wounds or scars'],
    environment: ['Good natural or artificial lighting'],
    positioning: 'Child standing, expose arms, legs, trunk as appropriate',
    captureMethod: 'Take close-up photo of any lesion with a ruler/coin for scale',
    duration: '2-3 minutes',
    tips: ['Check hands, feet, scalp, behind ears', 'Scabies: look between fingers, wrists, waistline', 'Note location, size, and distribution of lesions'],
  },
  ear: {
    instruction: 'Position otoscope to view tympanic membrane; pull pinna up and back',
    lookFor: ['TM color and translucency', 'Bulging or retraction', 'Wax impaction', 'Discharge'],
    equipment: ['Otoscope with ear specula', 'Flashlight (if no otoscope)'],
    positioning: 'Child seated, head tilted away from exam ear',
    captureMethod: 'Take photo through otoscope if available, or external ear photo',
    duration: '2-3 minutes per ear',
    tips: ['For children >3y: pull pinna up and back', 'For children <3y: pull pinna down and back', 'Check both ears — compare sides'],
  },
  hearing: {
    instruction: 'Quiet room, headphones on child, present tones at 1000/2000/4000 Hz',
    lookFor: ['Response at each frequency', 'Bilateral or unilateral loss', 'Consistent responses'],
    environment: ['Quiet room, minimal background noise', 'No fans, AC, or loud equipment nearby'],
    equipment: ['Headphones (over-ear preferred)', 'Audiometer or screening app'],
    positioning: 'Child seated comfortably, headphones properly fitted',
    captureMethod: 'Record test results as pass/refer for each ear',
    duration: '3-5 minutes',
    tips: ['Test in the quietest room available', 'Demonstrate task with loud tone first', 'Re-test if child seems distracted or inconsistent'],
  },
  eyes_external: {
    instruction: 'Examine eyes in good light, check lids, conjunctiva, and alignment',
    lookFor: ['Conjunctival pallor (anemia)', 'Discharge or redness', 'Ptosis', 'Squint'],
    environment: ['Good natural lighting preferred'],
    positioning: 'Child seated, face towards light source',
    captureMethod: 'Take close-up photo of both eyes open, then each eye individually',
    duration: '1-2 minutes',
    tips: ['Pull down lower lid gently to check conjunctival pallor', 'Cover test: cover one eye, watch other for movement (squint)', 'Check both eyes are same size and level'],
  },
  general_appearance: {
    instruction: 'Observe child overall: nutritional status, activity, skin color',
    lookFor: ['Pallor', 'Cyanosis', 'Jaundice', 'Edema', 'Lethargy', 'Wasting signs'],
    positioning: 'Child standing or sitting naturally, observe without touching',
    captureMethod: 'Take full-body photo from front, showing face and body proportions',
    duration: '1-2 minutes',
    tips: ['First impression matters — note energy level, mood, build', 'Check palms, nail beds, conjunctiva for pallor', 'Note any obvious malformation or dysmorphism'],
  },
  hair: {
    instruction: 'Examine scalp and hair under good light, part hair to check scalp',
    lookFor: ['Lice or nits', 'Dandruff', 'Bald patches', 'Flag sign (malnutrition)'],
    environment: ['Good lighting, preferably natural light'],
    equipment: ['Fine-tooth comb (for lice check)', 'Gloves'],
    positioning: 'Child seated, head bent forward',
    captureMethod: 'Take photo of scalp areas of concern, close-up of any patches',
    duration: '1-2 minutes',
    tips: ['Part hair in multiple areas to check scalp', 'Nits are white/yellow eggs attached to hair shaft near scalp', 'Flag sign = alternating light/dark bands in hair (malnutrition)'],
  },
  nails: {
    instruction: 'Examine fingernails and toenails for color, shape, and texture',
    lookFor: ['Nail bed pallor', 'Clubbing', 'Spoon nails (koilonychia)', 'Cyanosis'],
    positioning: 'Child seated, hands placed flat on table',
    captureMethod: 'Take photo of both hands showing nail beds',
    duration: '1 minute',
    tips: ['Press nail bed — should return to pink within 2 seconds (capillary refill)', 'Spoon nails (concave) suggest iron deficiency', 'Clubbing: check profile angle of nail-finger junction'],
  },
  nose: {
    instruction: 'Use flashlight to examine nasal passages, septum, and turbinates',
    lookFor: ['Discharge type/color', 'Septal deviation', 'Polyps', 'Bleeding signs'],
    equipment: ['Flashlight/torch'],
    positioning: 'Child seated, head tilted slightly back',
    captureMethod: 'Take photo from front showing nostrils, one per side if discharge present',
    duration: '1 minute',
    tips: ['Tilt head back gently to see inside', 'Clear discharge = allergic; yellow/green = infection', 'Check for allergic salute crease across nose bridge'],
  },
  throat: {
    instruction: 'Use tongue depressor and flashlight, say "aah"',
    lookFor: ['Tonsil size and color', 'Exudate', 'Pharyngeal redness', 'Uvula position'],
    equipment: ['Tongue depressor', 'Flashlight/torch'],
    positioning: 'Child seated, mouth open wide, say "aah"',
    captureMethod: 'Take photo of open throat with flashlight illumination',
    duration: '1 minute',
    tips: ['Press tongue depressor on middle of tongue, not tip', 'Grade tonsils: 1+ (visible), 2+ (past pillars), 3+ (near midline), 4+ (touching)', 'White patches on tonsils = possible infection'],
  },
  neck: {
    instruction: 'Palpate thyroid while child swallows; check lymph node chains',
    lookFor: ['Thyroid enlargement (goiter)', 'Lymph node swelling', 'Neck masses', 'Torticollis'],
    equipment: ['Cup of water (for swallowing during thyroid palpation)'],
    positioning: 'Child seated, neck slightly extended, facing forward',
    captureMethod: 'Take photo from front showing neck, note any visible swelling',
    duration: '2 minutes',
    tips: ['Ask child to swallow water while you feel the thyroid', 'Palpate lymph nodes: submental, submandibular, anterior/posterior cervical', 'Note size, consistency, tenderness of any enlarged nodes'],
  },
  respiratory: {
    instruction: 'Record breathing sounds with phone near chest; ask child to cough',
    lookFor: ['Wheeze or stridor', 'Cough type (dry/wet)', 'Breathing rate', 'Chest retractions'],
    environment: ['Quiet room for clear audio capture'],
    positioning: 'Child seated upright, breathing normally then deeply',
    captureMethod: 'Hold phone 5-10cm from chest, record 15s of breathing at front and back',
    duration: '2-3 minutes',
    tips: ['Count respiratory rate for full 60 seconds', 'Ask child to cough — note if productive', 'Look for chest wall movement: symmetry, retractions, use of accessory muscles'],
  },
  abdomen: {
    instruction: 'Child supine, knees bent; inspect then palpate all four quadrants',
    lookFor: ['Distension', 'Hernias', 'Organ enlargement', 'Tenderness location'],
    positioning: 'Child lying flat on back, knees slightly bent, relaxed',
    captureMethod: 'Take photo showing abdomen from above if any visible finding',
    duration: '2-3 minutes',
    tips: ['Warm your hands before palpation', 'Start palpation in the quadrant farthest from any pain', 'Ask child to point to where it hurts before you start', 'Check for umbilical hernia: ask child to cough'],
  },
  posture: {
    instruction: 'Child standing, observe from behind and side; forward bend test',
    lookFor: ['Spinal curve (scoliosis)', 'Shoulder asymmetry', 'Knee alignment', 'Foot arch'],
    environment: ['Open space with clear floor'],
    positioning: 'Child standing barefoot, arms at sides, viewed from behind',
    captureMethod: 'Take photos: back view standing, side view, forward bend (Adam test)',
    duration: '2-3 minutes',
    tips: ['Forward bend test: child bends forward, arms hanging — look for rib hump', 'Check shoulder heights, waistline creases, hip levels', 'Have child walk towards and away from you to observe gait'],
  },
  motor: {
    instruction: 'Observe walking, standing on one leg, hopping, fine motor tasks',
    lookFor: ['Balance', 'Gait pattern', 'Muscle tone', 'Fine motor coordination'],
    environment: ['Open space, at least 3m clear for walking'],
    positioning: 'Child in open area, 2-3m from camera',
    captureMethod: 'Record 15-second video: child walks 5 steps, turns, stands on one leg, hops',
    duration: '3-5 minutes',
    tips: ['Gross motor: walk, hop, stand on one leg, throw/catch ball', 'Fine motor: stack blocks, draw circle/cross, button/unbutton', 'Compare performance to age expectations', 'Note if child favors one side'],
  },
  lymph: {
    instruction: 'Palpate cervical, axillary, and inguinal lymph node chains bilaterally',
    lookFor: ['Enlarged nodes', 'Tender nodes', 'Fixed vs mobile', 'Generalized vs localized'],
    positioning: 'Child seated for cervical/axillary, standing for inguinal',
    duration: '2-3 minutes',
    tips: ['Use flat finger pads, gentle circular motion', 'Normal nodes: <1cm, soft, mobile, non-tender', 'Note: size, number, consistency, tenderness, fixed/mobile'],
  },
  neurodevelopment: {
    instruction: 'Observe behavior, speech, social interaction; age-appropriate tasks',
    lookFor: ['Speech clarity', 'Social engagement', 'Attention span', 'Repetitive behaviors'],
    environment: ['Quiet room with minimal distractions', 'Age-appropriate toys/materials if available'],
    positioning: 'Child seated at table or on floor, comfortable and calm',
    captureMethod: 'Observe and note age-appropriate behaviors: speech, social interaction, play skills, attention span',
    duration: '5-10 minutes',
    tips: ['Compare to age milestones: speech, social, cognitive, motor', 'Note eye contact quality and social reciprocity', 'Ask parent about concerns, school performance', 'Use M-CHAT checklist for toddlers if available'],
  },
  immunization: {
    instruction: 'Check vaccination card or records against national schedule',
    lookFor: ['Missing vaccines', 'Delayed doses', 'Any adverse reactions reported'],
    equipment: ['National immunization schedule chart', 'Child vaccination card/booklet'],
    positioning: 'Review documents with parent present',
    captureMethod: 'Take photo of vaccination card if available',
    duration: '2-3 minutes',
    tips: ['Cross-check each vaccine against age-appropriate schedule', 'Note any missed boosters', 'Ask parent about any reactions to previous vaccines'],
  },
  cardiac: {
    instruction: 'Auscultate with stethoscope at aortic, pulmonary, tricuspid, mitral areas',
    lookFor: ['Murmurs (systolic/diastolic)', 'Extra heart sounds', 'Rate and rhythm'],
    environment: ['Quiet room for clear auscultation'],
    equipment: ['AyuSync digital stethoscope — pair via Bluetooth first', 'If no AyuSync: standard stethoscope'],
    positioning: 'Child seated upright, chest exposed, breathing normally',
    captureMethod: 'Place AyuSync on chest at each point, app will auto-capture heart sounds',
    duration: '3-5 minutes',
    tips: ['Auscultate at 4 points: right upper (aortic), left upper (pulmonary), left lower (tricuspid), apex (mitral)', 'Listen with both bell and diaphragm', 'Note rate, rhythm, any extra sounds or murmurs'],
  },
  pulmonary: {
    instruction: 'Auscultate anterior and posterior chest, 6 bilateral points',
    lookFor: ['Wheeze', 'Crackles', 'Reduced air entry', 'Bronchial breathing'],
    environment: ['Quiet room for clear auscultation'],
    equipment: ['AyuSync digital stethoscope — pair via Bluetooth first', 'If no AyuSync: standard stethoscope'],
    positioning: 'Child seated upright, chest/back exposed, breathing deeply',
    captureMethod: 'Place AyuSync on chest/back at each point, app will auto-capture lung sounds',
    duration: '3-5 minutes',
    tips: ['Listen at 6 points: upper, mid, lower — both sides', 'Compare left to right at same level', 'Ask child to take deep breaths through open mouth', 'Reduced air entry on one side = possible consolidation/effusion'],
  },
  vitals: {
    instruction: 'Use front camera, hold face steady in frame for 15-30 seconds',
    lookFor: ['Heart rate via facial blood flow', 'Stable reading', 'Good lighting'],
    environment: ['Well-lit room, natural light preferred'],
    positioning: 'Child seated still, face towards camera, forehead visible',
    captureMethod: 'Use front camera, keep face steady in frame for 15-30 seconds',
    duration: '30 seconds',
    tips: ['Ensure good lighting on face', 'Child must remain very still', 'Avoid direct sunlight glare on face'],
  },
  nutrition_intake: {
    instruction: 'Ask about meals, snacks, food groups consumed in past 24 hours',
    lookFor: ['Protein sources', 'Fruits/vegetables', 'Dairy intake', 'Meal regularity'],
    positioning: 'Interview parent/child at table',
    captureMethod: 'Use form to record 24-hour dietary recall',
    duration: '3-5 minutes',
    tips: ['Use 24-hour recall method: what did the child eat yesterday?', 'Probe for snacks between meals', 'Ask about breakfast, lunch, dinner + 2 snack times', 'Note any food restrictions or allergies'],
  },
  intervention: {
    instruction: 'Record any supplements, deworming, or feeding programs the child receives',
    lookFor: ['Iron/vitamin supplements', 'Deworming status', 'Mid-day meal enrollment'],
    positioning: 'Interview parent at table',
    captureMethod: 'Use form to record current interventions',
    duration: '2-3 minutes',
    tips: ['Check for IFA (Iron Folic Acid) supplementation', 'Ask about last deworming date', 'Note any feeding program enrollment: MDM, ICDS, etc.'],
  },
}

export function getModuleGuidance(moduleType: ModuleType): ModuleGuidance | undefined {
  return MODULE_GUIDANCE[moduleType]
}
