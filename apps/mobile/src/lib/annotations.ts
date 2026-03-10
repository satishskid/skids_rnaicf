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
}

// ── Per-module chip definitions ─────────────────────────────

const VISION_CHIPS: ChipDef[] = [
  { id: 'v1', label: 'Red reflex normal', category: 'reflex' },
  { id: 'v2', label: 'Red reflex abnormal', category: 'reflex', hasSeverity: true, icdCode: 'H21.0' },
  { id: 'v3', label: 'Red reflex absent', category: 'reflex', hasSeverity: true, icdCode: 'H21.0' },
  { id: 'v4', label: 'White reflex (leukocoria)', category: 'reflex', hasSeverity: true, icdCode: 'H44.8' },
  { id: 'v5', label: 'Asymmetric reflex', category: 'reflex', hasSeverity: true, icdCode: 'H50.9' },
  { id: 'v6', label: 'Eye alignment normal', category: 'alignment' },
  { id: 'v7', label: 'Strabismus', category: 'alignment', hasSeverity: true, icdCode: 'H50.9' },
  { id: 'v8', label: 'Nystagmus', category: 'alignment', hasSeverity: true, icdCode: 'H55' },
  { id: 'v9', label: 'Reduced visual acuity', category: 'acuity', hasSeverity: true, icdCode: 'H54' },
  { id: 'v10', label: 'Pupil asymmetry', category: 'pupil', hasSeverity: true, icdCode: 'H57.0' },
]

const DENTAL_CHIPS: ChipDef[] = [
  { id: 'd1', label: 'Healthy teeth/gums', category: 'general' },
  { id: 'd2', label: 'Dental caries', category: 'teeth', hasSeverity: true, icdCode: 'K02' },
  { id: 'd3', label: 'Missing teeth', category: 'teeth', icdCode: 'K08.1' },
  { id: 'd4', label: 'Malocclusion', category: 'teeth', hasSeverity: true, icdCode: 'K07' },
  { id: 'd5', label: 'Gingivitis', category: 'gums', hasSeverity: true, icdCode: 'K05.1' },
  { id: 'd6', label: 'Gum bleeding', category: 'gums', hasSeverity: true, icdCode: 'K06.8' },
  { id: 'd7', label: 'Oral ulcers', category: 'oral', hasSeverity: true, locationPin: true, icdCode: 'K12.1' },
  { id: 'd8', label: 'Thrush (oral candidiasis)', category: 'oral', hasSeverity: true, icdCode: 'B37.0' },
  { id: 'd9', label: 'Delayed eruption', category: 'teeth', icdCode: 'K00.6' },
  { id: 'd10', label: 'Enamel hypoplasia', category: 'teeth', hasSeverity: true, icdCode: 'K00.4' },
  { id: 'd11', label: 'Supernumerary teeth', category: 'teeth', icdCode: 'K00.1' },
  { id: 'd12', label: 'Dental fluorosis', category: 'teeth', hasSeverity: true, icdCode: 'K00.3' },
  { id: 'd13', label: 'Bruxism signs', category: 'teeth', icdCode: 'F45.8' },
  { id: 'd14', label: 'Periodontal disease', category: 'gums', hasSeverity: true, icdCode: 'K05' },
  { id: 'd15', label: 'Abscess', category: 'oral', hasSeverity: true, locationPin: true, icdCode: 'K04.7' },
  { id: 'd16', label: 'Crowding', category: 'teeth', hasSeverity: true, icdCode: 'K07.3' },
  { id: 'd17', label: 'High arched palate', category: 'palate', icdCode: 'Q38.5' },
  { id: 'd18', label: 'Cleft lip/palate', category: 'palate', hasSeverity: true, icdCode: 'Q37' },
  { id: 'd19', label: 'Tongue tie', category: 'oral', icdCode: 'Q38.1' },
  { id: 'd20', label: 'Geographic tongue', category: 'oral', icdCode: 'K14.1' },
  { id: 'd21', label: 'Ankyloglossia', category: 'oral', icdCode: 'Q38.1' },
]

const SKIN_CHIPS: ChipDef[] = [
  { id: 's1', label: 'Normal skin', category: 'general' },
  { id: 's2', label: 'Rash/eruption', category: 'lesion', hasSeverity: true, locationPin: true, icdCode: 'R21' },
  { id: 's3', label: 'Fungal infection', category: 'infection', hasSeverity: true, locationPin: true, icdCode: 'B36.9' },
  { id: 's4', label: 'Scabies', category: 'infection', hasSeverity: true, locationPin: true, icdCode: 'B86' },
  { id: 's5', label: 'Impetigo', category: 'infection', hasSeverity: true, locationPin: true, icdCode: 'L01' },
  { id: 's6', label: 'Eczema', category: 'condition', hasSeverity: true, locationPin: true, icdCode: 'L30.9' },
  { id: 's7', label: 'Psoriasis', category: 'condition', hasSeverity: true, locationPin: true, icdCode: 'L40' },
  { id: 's8', label: 'Vitiligo', category: 'pigment', hasSeverity: true, locationPin: true, icdCode: 'L80' },
  { id: 's9', label: 'Hyperpigmentation', category: 'pigment', locationPin: true, icdCode: 'L81.4' },
  { id: 's10', label: 'Wound/laceration', category: 'wound', hasSeverity: true, locationPin: true, icdCode: 'T14.1' },
  { id: 's11', label: 'Burn', category: 'wound', hasSeverity: true, locationPin: true, icdCode: 'T30' },
  { id: 's12', label: 'Birthmark/nevus', category: 'pigment', locationPin: true, icdCode: 'Q82.5' },
  { id: 's13', label: 'Warts', category: 'growth', locationPin: true, icdCode: 'B07' },
  { id: 's14', label: 'Keloid/scar', category: 'wound', locationPin: true, icdCode: 'L91.0' },
  { id: 's15', label: 'Ichthyosis', category: 'condition', hasSeverity: true, icdCode: 'Q80' },
  { id: 's16', label: 'Pediculosis', category: 'infection', hasSeverity: true, icdCode: 'B85' },
]

const EAR_CHIPS: ChipDef[] = [
  { id: 'e1', label: 'TM normal', category: 'tympanic' },
  { id: 'e2', label: 'TM erythematous', category: 'tympanic', hasSeverity: true, icdCode: 'H66.9' },
  { id: 'e3', label: 'TM bulging', category: 'tympanic', hasSeverity: true, icdCode: 'H66.0' },
  { id: 'e4', label: 'TM retracted', category: 'tympanic', hasSeverity: true, icdCode: 'H73.0' },
  { id: 'e5', label: 'Effusion/fluid', category: 'middle_ear', hasSeverity: true, icdCode: 'H65.9' },
  { id: 'e6', label: 'Perforation', category: 'tympanic', hasSeverity: true, icdCode: 'H72' },
  { id: 'e7', label: 'Wax impaction', category: 'canal', hasSeverity: true, icdCode: 'H61.2' },
  { id: 'e8', label: 'Otitis externa', category: 'canal', hasSeverity: true, icdCode: 'H60' },
  { id: 'e9', label: 'Foreign body', category: 'canal', hasSeverity: true, icdCode: 'T16' },
  { id: 'e10', label: 'Discharge', category: 'canal', hasSeverity: true, icdCode: 'H92.1' },
]

const HEARING_CHIPS: ChipDef[] = [
  { id: 'hr1', label: 'Hearing normal', category: 'general' },
  { id: 'hr2', label: 'Hearing normal (bilateral)', category: 'general' },
  { id: 'hr3', label: 'Mild hearing loss', category: 'loss', hasSeverity: true, icdCode: 'H90.5' },
  { id: 'hr4', label: 'Moderate hearing loss', category: 'loss', hasSeverity: true, icdCode: 'H90.5' },
  { id: 'hr5', label: 'Severe hearing loss', category: 'loss', hasSeverity: true, icdCode: 'H90.3' },
  { id: 'hr6', label: 'Unilateral loss (left)', category: 'loss', hasSeverity: true, icdCode: 'H90.1' },
  { id: 'hr7', label: 'Unilateral loss (right)', category: 'loss', hasSeverity: true, icdCode: 'H90.0' },
]

const EYES_EXTERNAL_CHIPS: ChipDef[] = [
  { id: 'ee1', label: 'Eyes normal', category: 'general' },
  { id: 'ee2', label: 'Conjunctival pallor', category: 'conjunctiva', hasSeverity: true, icdCode: 'H10.4' },
  { id: 'ee3', label: 'Conjunctivitis', category: 'conjunctiva', hasSeverity: true, icdCode: 'H10.9' },
  { id: 'ee4', label: 'Jaundice/icterus', category: 'sclera', hasSeverity: true, icdCode: 'R17' },
  { id: 'ee5', label: 'Conjunctival pallor (anemia)', category: 'conjunctiva', hasSeverity: true, icdCode: 'D64.9' },
  { id: 'ee6', label: 'Ptosis', category: 'eyelid', hasSeverity: true, icdCode: 'H02.4' },
  { id: 'ee7', label: 'Squint/strabismus', category: 'alignment', hasSeverity: true, icdCode: 'H50.9' },
  { id: 'ee8', label: 'Eye discharge', category: 'infection', hasSeverity: true, icdCode: 'H10.0' },
  { id: 'ee9', label: 'Periorbital edema', category: 'eyelid', hasSeverity: true, icdCode: 'H05.2' },
  { id: 'ee10', label: 'Stye/chalazion', category: 'eyelid', hasSeverity: true, locationPin: true, icdCode: 'H00' },
  { id: 'ee11', label: 'Watering (epiphora)', category: 'tear', icdCode: 'H04.2' },
  { id: 'ee12', label: 'Proptosis', category: 'orbital', hasSeverity: true, icdCode: 'H05.2' },
  { id: 'ee13', label: 'Subconjunctival hemorrhage', category: 'conjunctiva', icdCode: 'H11.3' },
  { id: 'ee14', label: 'Photophobia', category: 'symptom', hasSeverity: true, icdCode: 'H53.1' },
  { id: 'ee15', label: 'Corneal opacity', category: 'cornea', hasSeverity: true, icdCode: 'H17' },
  { id: 'ee16', label: 'Iris coloboma', category: 'iris', icdCode: 'Q13.0' },
]

const GENERAL_APPEARANCE_CHIPS: ChipDef[] = [
  { id: 'ga1', label: 'Well-nourished', category: 'nutrition' },
  { id: 'ga2', label: 'Malnourished', category: 'nutrition', hasSeverity: true, icdCode: 'E46' },
  { id: 'ga3', label: 'Pallor', category: 'color', hasSeverity: true, icdCode: 'R23.1' },
  { id: 'ga4', label: 'Cyanosis', category: 'color', hasSeverity: true, icdCode: 'R23.0' },
  { id: 'ga5', label: 'Jaundice', category: 'color', hasSeverity: true, icdCode: 'R17' },
  { id: 'ga6', label: 'Dehydrated', category: 'hydration', hasSeverity: true, icdCode: 'E86' },
  { id: 'ga7', label: 'Edema', category: 'hydration', hasSeverity: true, locationPin: true, icdCode: 'R60' },
  { id: 'ga8', label: 'Lethargic', category: 'activity', hasSeverity: true, icdCode: 'R53' },
  { id: 'ga9', label: 'Irritable', category: 'activity', hasSeverity: true },
  { id: 'ga10', label: 'Short stature', category: 'growth', hasSeverity: true, icdCode: 'E34.3' },
  { id: 'ga11', label: 'Obesity', category: 'growth', hasSeverity: true, icdCode: 'E66' },
  { id: 'ga12', label: 'Down syndrome features', category: 'congenital', hasSeverity: true, icdCode: 'Q90' },
  { id: 'ga13', label: 'Hydrocephalus', category: 'congenital', hasSeverity: true, icdCode: 'Q03' },
  { id: 'ga14', label: 'SAM features', category: 'nutrition', hasSeverity: true, icdCode: 'E43' },
  { id: 'ga15', label: 'MAM features', category: 'nutrition', hasSeverity: true, icdCode: 'E44' },
  { id: 'ga16', label: 'Micronutrient deficiency signs', category: 'nutrition', hasSeverity: true, icdCode: 'E61.9' },
]

const HAIR_CHIPS: ChipDef[] = [
  { id: 'h1', label: 'Hair normal', category: 'general' },
  { id: 'h2', label: 'Pediculosis (lice)', category: 'infection', hasSeverity: true, icdCode: 'B85.0' },
  { id: 'h3', label: 'Dandruff/seborrhea', category: 'scalp', hasSeverity: true, icdCode: 'L21' },
  { id: 'h4', label: 'Alopecia/thinning', category: 'loss', hasSeverity: true, locationPin: true, icdCode: 'L63' },
  { id: 'h5', label: 'Tinea capitis', category: 'infection', hasSeverity: true, locationPin: true, icdCode: 'B35.0' },
  { id: 'h6', label: 'Flag sign (malnutrition)', category: 'nutrition', hasSeverity: true, icdCode: 'E46' },
  { id: 'h7', label: 'Sparse/brittle hair', category: 'nutrition', hasSeverity: true, icdCode: 'E46' },
]

const NAILS_CHIPS: ChipDef[] = [
  { id: 'na1', label: 'Nails normal', category: 'general' },
  { id: 'na2', label: 'Koilonychia (spoon nails)', category: 'shape', hasSeverity: true, icdCode: 'L60.3' },
  { id: 'na3', label: 'Nail bed pallor', category: 'color', hasSeverity: true, icdCode: 'D64.9' },
  { id: 'na4', label: 'Clubbing', category: 'shape', hasSeverity: true, icdCode: 'R68.3' },
  { id: 'na5', label: 'Cyanotic nail beds', category: 'color', hasSeverity: true, icdCode: 'R23.0' },
  { id: 'na6', label: 'Fungal infection', category: 'infection', hasSeverity: true, icdCode: 'B35.1' },
  { id: 'na7', label: 'Bitten nails', category: 'habit' },
  { id: 'na8', label: 'Brittle/ridged nails', category: 'nutrition', icdCode: 'L60.3' },
]

const NOSE_CHIPS: ChipDef[] = [
  { id: 'no1', label: 'Nose normal', category: 'general' },
  { id: 'no2', label: 'Nasal discharge', category: 'discharge', hasSeverity: true, icdCode: 'R09.8' },
  { id: 'no3', label: 'Deviated septum', category: 'structure', hasSeverity: true, icdCode: 'J34.2' },
  { id: 'no4', label: 'Turbinate hypertrophy', category: 'structure', hasSeverity: true, icdCode: 'J34.3' },
  { id: 'no5', label: 'Nasal polyp', category: 'structure', hasSeverity: true, icdCode: 'J33' },
  { id: 'no6', label: 'Epistaxis signs', category: 'bleeding', hasSeverity: true, icdCode: 'R04.0' },
  { id: 'no7', label: 'Allergic salute', category: 'allergy', icdCode: 'J30.9' },
]

const THROAT_CHIPS: ChipDef[] = [
  { id: 'th1', label: 'Throat normal', category: 'general' },
  { id: 'th2', label: 'Tonsillar enlargement', category: 'tonsils', hasSeverity: true, icdCode: 'J35.1' },
  { id: 'th3', label: 'Tonsillar exudate', category: 'tonsils', hasSeverity: true, icdCode: 'J03.9' },
  { id: 'th4', label: 'Pharyngitis', category: 'pharynx', hasSeverity: true, icdCode: 'J02.9' },
  { id: 'th5', label: 'Uvula deviation', category: 'palate', icdCode: 'Q38.5' },
  { id: 'th6', label: 'Post-nasal drip', category: 'discharge', icdCode: 'R09.8' },
]

const NECK_CHIPS: ChipDef[] = [
  { id: 'nk1', label: 'Neck normal', category: 'general' },
  { id: 'nk2', label: 'Goiter Grade I', category: 'thyroid', hasSeverity: true, icdCode: 'E04.0' },
  { id: 'nk3', label: 'Goiter Grade II', category: 'thyroid', hasSeverity: true, icdCode: 'E04.0' },
  { id: 'nk4', label: 'Goiter Grade III', category: 'thyroid', hasSeverity: true, icdCode: 'E04.0' },
  { id: 'nk5', label: 'Lymphadenopathy', category: 'lymph', hasSeverity: true, icdCode: 'R59' },
  { id: 'nk6', label: 'Torticollis', category: 'musculoskeletal', hasSeverity: true, icdCode: 'M43.6' },
  { id: 'nk7', label: 'Thyroid nodule', category: 'thyroid', hasSeverity: true, icdCode: 'E04.1' },
  { id: 'nk8', label: 'Cystic hygroma', category: 'congenital', hasSeverity: true, icdCode: 'D18.1' },
  { id: 'nk9', label: 'Branchial cleft cyst', category: 'congenital', hasSeverity: true, icdCode: 'Q18.0' },
  { id: 'nk10', label: 'Webbed neck', category: 'congenital', icdCode: 'Q18.3' },
]

const ABDOMEN_CHIPS: ChipDef[] = [
  { id: 'ab1', label: 'Abdomen normal', category: 'general' },
  { id: 'ab2', label: 'Distension', category: 'inspection', hasSeverity: true, icdCode: 'R14' },
  { id: 'ab3', label: 'Umbilical hernia', category: 'hernia', hasSeverity: true, locationPin: true, icdCode: 'K42' },
  { id: 'ab4', label: 'Inguinal hernia', category: 'hernia', hasSeverity: true, locationPin: true, icdCode: 'K40' },
  { id: 'ab5', label: 'Hepatomegaly', category: 'organ', hasSeverity: true, icdCode: 'R16.0' },
  { id: 'ab6', label: 'Splenomegaly', category: 'organ', hasSeverity: true, icdCode: 'R16.1' },
  { id: 'ab7', label: 'Tenderness', category: 'palpation', hasSeverity: true, locationPin: true, icdCode: 'R10' },
  { id: 'ab8', label: 'Ascites', category: 'fluid', hasSeverity: true, icdCode: 'R18' },
]

const POSTURE_CHIPS: ChipDef[] = [
  { id: 'p1', label: 'Scoliosis', category: 'spine', hasSeverity: true, icdCode: 'M41' },
  { id: 'p2', label: 'Kyphosis', category: 'spine', hasSeverity: true, icdCode: 'M40.2' },
  { id: 'p3', label: 'Lordosis', category: 'spine', hasSeverity: true, icdCode: 'M40.5' },
  { id: 'p4', label: 'Normal posture', category: 'general' },
  { id: 'p5', label: 'Genu valgum (knock knee)', category: 'limb', hasSeverity: true, icdCode: 'M21.0' },
  { id: 'p6', label: 'Genu varum (bow leg)', category: 'limb', hasSeverity: true, icdCode: 'M21.1' },
  { id: 'p7', label: 'Flat feet', category: 'foot', hasSeverity: true, icdCode: 'M21.4' },
  { id: 'p8', label: 'Limb length discrepancy', category: 'limb', hasSeverity: true, icdCode: 'M21.7' },
  { id: 'p9', label: 'Shoulder asymmetry', category: 'trunk', hasSeverity: true },
  { id: 'p10', label: 'Pelvic tilt', category: 'trunk', hasSeverity: true },
  { id: 'p11', label: 'Winging scapula', category: 'trunk', hasSeverity: true, icdCode: 'M89.8' },
  { id: 'p12', label: 'Trendelenburg gait', category: 'gait', hasSeverity: true },
  { id: 'p13', label: 'Clubfoot/talipes', category: 'foot', hasSeverity: true, icdCode: 'Q66.0' },
  { id: 'p14', label: 'Spina bifida', category: 'spine', hasSeverity: true, icdCode: 'Q05' },
  { id: 'p15', label: 'Neural tube defect', category: 'spine', hasSeverity: true, icdCode: 'Q00' },
]

const MOTOR_CHIPS: ChipDef[] = [
  { id: 'm1', label: 'Motor skills normal', category: 'general' },
  { id: 'm2', label: 'Poor balance', category: 'balance', hasSeverity: true },
  { id: 'm3', label: 'Abnormal gait', category: 'gait', hasSeverity: true, icdCode: 'R26' },
  { id: 'm4', label: 'Reduced ROM', category: 'flexibility', hasSeverity: true, locationPin: true },
  { id: 'm5', label: 'Muscle weakness', category: 'strength', hasSeverity: true, icdCode: 'M62.8' },
  { id: 'm6', label: 'Spasticity', category: 'tone', hasSeverity: true, icdCode: 'G80' },
  { id: 'm7', label: 'Hypotonia', category: 'tone', hasSeverity: true, icdCode: 'P94.2' },
  { id: 'm8', label: 'Gross motor delay', category: 'delay', hasSeverity: true, icdCode: 'F82' },
  { id: 'm9', label: 'Fine motor delay', category: 'delay', hasSeverity: true, icdCode: 'F82' },
  { id: 'm10', label: 'Cerebral palsy signs', category: 'neurological', hasSeverity: true, icdCode: 'G80' },
  { id: 'm11', label: 'Polydactyly', category: 'congenital', icdCode: 'Q69' },
]

const LYMPH_CHIPS: ChipDef[] = [
  { id: 'ly1', label: 'Lymph nodes normal', category: 'general' },
  { id: 'ly2', label: 'Cervical lymphadenopathy', category: 'cervical', hasSeverity: true, locationPin: true, icdCode: 'R59.0' },
  { id: 'ly3', label: 'Axillary lymphadenopathy', category: 'axillary', hasSeverity: true, locationPin: true, icdCode: 'R59.0' },
  { id: 'ly4', label: 'Inguinal lymphadenopathy', category: 'inguinal', hasSeverity: true, locationPin: true, icdCode: 'R59.0' },
  { id: 'ly5', label: 'Generalized lymphadenopathy', category: 'generalized', hasSeverity: true, icdCode: 'R59.1' },
]

const NEURODEVELOPMENT_CHIPS: ChipDef[] = [
  { id: 'n1', label: 'Speech/language delay', category: 'development', hasSeverity: true, icdCode: 'F80' },
  { id: 'n2', label: 'Social withdrawal', category: 'behavioral', hasSeverity: true, icdCode: 'F84.0' },
  { id: 'n3', label: 'Hyperactivity', category: 'behavioral', hasSeverity: true, icdCode: 'F90' },
  { id: 'n4', label: 'Inattention', category: 'behavioral', hasSeverity: true, icdCode: 'F90' },
  { id: 'n5', label: 'Repetitive behaviors', category: 'behavioral', hasSeverity: true, icdCode: 'F84.0' },
  { id: 'n6', label: 'Sensory sensitivity', category: 'behavioral', hasSeverity: true, icdCode: 'F84.0' },
  { id: 'n7', label: 'Cognitive delay', category: 'development', hasSeverity: true, icdCode: 'F79' },
  { id: 'n8', label: 'Adaptive behavior delay', category: 'development', hasSeverity: true, icdCode: 'F70' },
  { id: 'n9', label: 'ASD screening positive', category: 'screening', hasSeverity: true, icdCode: 'F84.0' },
  { id: 'n21', label: 'Normal development', category: 'general' },
]

const RESPIRATORY_CHIPS: ChipDef[] = [
  { id: 'r1', label: 'Breath sounds normal', category: 'general' },
  { id: 'r2', label: 'Wheeze', category: 'sounds', hasSeverity: true, icdCode: 'R06.2' },
  { id: 'r3', label: 'Crackles/rales', category: 'sounds', hasSeverity: true, icdCode: 'R09.8' },
  { id: 'r4', label: 'Stridor', category: 'sounds', hasSeverity: true, icdCode: 'R06.1' },
  { id: 'r5', label: 'Dry cough', category: 'cough', hasSeverity: true, icdCode: 'R05' },
  { id: 'r6', label: 'Wet/productive cough', category: 'cough', hasSeverity: true, icdCode: 'R05' },
  { id: 'r7', label: 'Tachypnea', category: 'rate', hasSeverity: true, icdCode: 'R06.0' },
  { id: 'r8', label: 'Chest retraction', category: 'distress', hasSeverity: true, icdCode: 'R06.0' },
]

const VITALS_CHIPS: ChipDef[] = [
  { id: 'vt1', label: 'Vitals normal', category: 'general' },
  { id: 'vt2', label: 'Tachycardia', category: 'heart_rate', hasSeverity: true, icdCode: 'R00.0' },
  { id: 'vt3', label: 'Heart murmur', category: 'heart', hasSeverity: true, icdCode: 'R01.1' },
  { id: 'vt4', label: 'Bradycardia', category: 'heart_rate', hasSeverity: true, icdCode: 'R00.1' },
  { id: 'vt5', label: 'Irregular rhythm', category: 'rhythm', hasSeverity: true, icdCode: 'R00.8' },
]

const IMMUNIZATION_CHIPS: ChipDef[] = [
  { id: 'imm1', label: 'Up to date', category: 'status' },
  { id: 'imm2', label: 'Partially immunized', category: 'status', hasSeverity: true, icdCode: 'Z28.3' },
  { id: 'imm3', label: 'Not immunized', category: 'status', hasSeverity: true, icdCode: 'Z28.9' },
  { id: 'imm4', label: 'Delayed schedule', category: 'status', hasSeverity: true, icdCode: 'Z28.8' },
  { id: 'imm5', label: 'No records available', category: 'status' },
  { id: 'imm6', label: 'AEFI reported', category: 'adverse', hasSeverity: true, icdCode: 'T50.B95' },
]

const CARDIAC_CHIPS: ChipDef[] = [
  { id: 'ca1', label: 'Heart sounds normal', category: 'general' },
  { id: 'ca2', label: 'Systolic murmur', category: 'murmur', hasSeverity: true, icdCode: 'R01.1' },
  { id: 'ca3', label: 'Diastolic murmur', category: 'murmur', hasSeverity: true, icdCode: 'R01.1' },
  { id: 'ca4', label: 'S3 gallop', category: 'extra_sounds', hasSeverity: true },
  { id: 'ca5', label: 'S4 gallop', category: 'extra_sounds', hasSeverity: true },
  { id: 'ca6', label: 'Split S2', category: 'extra_sounds', hasSeverity: true },
  { id: 'ca7', label: 'Innocent murmur', category: 'murmur' },
]

const PULMONARY_CHIPS: ChipDef[] = [
  { id: 'pu1', label: 'Lung sounds normal', category: 'general' },
  { id: 'pu2', label: 'Wheeze bilateral', category: 'adventitious', hasSeverity: true, icdCode: 'R06.2' },
  { id: 'pu3', label: 'Crackles basal', category: 'adventitious', hasSeverity: true },
  { id: 'pu4', label: 'Reduced air entry', category: 'breath_sounds', hasSeverity: true },
  { id: 'pu5', label: 'Bronchial breathing', category: 'breath_sounds', hasSeverity: true },
  { id: 'pu6', label: 'Pleural rub', category: 'adventitious', hasSeverity: true },
]

const MUAC_CHIPS: ChipDef[] = [
  { id: 'muac1', label: 'SAM (<115mm)', category: 'classification', hasSeverity: true, icdCode: 'E43' },
  { id: 'muac2', label: 'MAM (115-125mm)', category: 'classification', hasSeverity: true, icdCode: 'E44' },
  { id: 'muac3', label: 'Normal (>125mm)', category: 'classification' },
  { id: 'muac4', label: 'Bilateral pitting edema', category: 'edema', hasSeverity: true, icdCode: 'E43' },
]

const NUTRITION_INTAKE_CHIPS: ChipDef[] = [
  { id: 'ni1', label: 'Adequate diet', category: 'general' },
  { id: 'ni2', label: 'Inadequate protein', category: 'macro', hasSeverity: true },
  { id: 'ni3', label: 'Inadequate calories', category: 'macro', hasSeverity: true },
  { id: 'ni4', label: 'No fruits/vegetables', category: 'micro', hasSeverity: true },
  { id: 'ni5', label: 'No dairy/calcium', category: 'micro', hasSeverity: true },
  { id: 'ni6', label: 'Iron-poor diet', category: 'micro', hasSeverity: true },
  { id: 'ni7', label: 'Junk food excess', category: 'pattern', hasSeverity: true },
  { id: 'ni8', label: 'Low dietary diversity', category: 'diversity', hasSeverity: true, icdCode: 'E63.1' },
  { id: 'ni9', label: 'Skips meals regularly', category: 'pattern', hasSeverity: true },
  { id: 'ni10', label: 'Food insecurity', category: 'access', hasSeverity: true, icdCode: 'E63.1' },
]

const INTERVENTION_CHIPS: ChipDef[] = [
  { id: 'iv1', label: 'Iron supplementation', category: 'supplement' },
  { id: 'iv2', label: 'Vitamin A supplementation', category: 'supplement' },
  { id: 'iv3', label: 'Zinc supplementation', category: 'supplement' },
  { id: 'iv4', label: 'Deworming done', category: 'deworming' },
  { id: 'iv5', label: 'Mid-day meal (MDM)', category: 'feeding_program' },
  { id: 'iv6', label: 'Take-home ration (THR)', category: 'feeding_program' },
  { id: 'iv7', label: 'Therapeutic food (RUTF)', category: 'therapeutic', hasSeverity: true },
  { id: 'iv8', label: 'ORS/rehydration', category: 'therapeutic' },
  { id: 'iv9', label: 'Referred to NRC', category: 'referral', hasSeverity: true },
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

// ── "What to Look For" guidance per module ──────────────

const MODULE_GUIDANCE: Record<string, { instruction: string; lookFor: string[] }> = {
  height: {
    instruction: 'Stand child straight against wall or stadiometer, feet flat',
    lookFor: ['Accurate heel-to-head measurement', 'Shoes removed', 'Head in Frankfurt plane'],
  },
  weight: {
    instruction: 'Use calibrated scale, minimal clothing, no shoes',
    lookFor: ['Scale zeroed before measurement', 'Child standing still', 'Light clothing only'],
  },
  spo2: {
    instruction: 'Place pulse oximeter on fingertip, wait for stable reading',
    lookFor: ['Warm hands for accurate reading', 'Stable waveform', 'No nail polish'],
  },
  hemoglobin: {
    instruction: 'Use HemoCue or photometric method on capillary blood sample',
    lookFor: ['Clean puncture site', 'Adequate blood drop', 'Device calibrated'],
  },
  bp: {
    instruction: 'Use appropriately sized cuff, child seated and relaxed for 5 min',
    lookFor: ['Correct cuff size', 'Arm at heart level', 'Two readings recommended'],
  },
  muac: {
    instruction: 'Measure mid-point of left upper arm between shoulder and elbow',
    lookFor: ['Arm relaxed at side', 'Tape snug but not tight', 'Read in millimeters'],
  },
  vision: {
    instruction: 'Use phone flash in dim room for red reflex; assess at 30cm distance',
    lookFor: ['Red reflex symmetry', 'White reflex (leukocoria)', 'Eye alignment', 'Pupil size'],
  },
  dental: {
    instruction: 'Open mouth wide, use flashlight to examine teeth, gums, and palate',
    lookFor: ['Dental caries (cavities)', 'Swollen/bleeding gums', 'Missing teeth', 'Malocclusion'],
  },
  skin: {
    instruction: 'Examine exposed skin in good lighting, check all visible areas',
    lookFor: ['Rashes or eruptions', 'Fungal patches', 'Scabies burrows', 'Wounds or scars'],
  },
  ear: {
    instruction: 'Position otoscope to view tympanic membrane; pull pinna up and back',
    lookFor: ['TM color and translucency', 'Bulging or retraction', 'Wax impaction', 'Discharge'],
  },
  hearing: {
    instruction: 'Quiet room, headphones on child, present tones at 1000/2000/4000 Hz',
    lookFor: ['Response at each frequency', 'Bilateral or unilateral loss', 'Consistent responses'],
  },
  eyes_external: {
    instruction: 'Examine eyes in good light, check lids, conjunctiva, and alignment',
    lookFor: ['Conjunctival pallor (anemia)', 'Discharge or redness', 'Ptosis', 'Squint'],
  },
  general_appearance: {
    instruction: 'Observe child overall: nutritional status, activity, skin color',
    lookFor: ['Pallor', 'Cyanosis', 'Jaundice', 'Edema', 'Lethargy', 'Wasting signs'],
  },
  hair: {
    instruction: 'Examine scalp and hair under good light, part hair to check scalp',
    lookFor: ['Lice or nits', 'Dandruff', 'Bald patches', 'Flag sign (malnutrition)'],
  },
  nails: {
    instruction: 'Examine fingernails and toenails for color, shape, and texture',
    lookFor: ['Nail bed pallor', 'Clubbing', 'Spoon nails (koilonychia)', 'Cyanosis'],
  },
  nose: {
    instruction: 'Use flashlight to examine nasal passages, septum, and turbinates',
    lookFor: ['Discharge type/color', 'Septal deviation', 'Polyps', 'Bleeding signs'],
  },
  throat: {
    instruction: 'Use tongue depressor and flashlight, say "aah"',
    lookFor: ['Tonsil size and color', 'Exudate', 'Pharyngeal redness', 'Uvula position'],
  },
  neck: {
    instruction: 'Palpate thyroid while child swallows; check lymph node chains',
    lookFor: ['Thyroid enlargement (goiter)', 'Lymph node swelling', 'Neck masses', 'Torticollis'],
  },
  respiratory: {
    instruction: 'Record breathing sounds with phone near chest; ask child to cough',
    lookFor: ['Wheeze or stridor', 'Cough type (dry/wet)', 'Breathing rate', 'Chest retractions'],
  },
  abdomen: {
    instruction: 'Child supine, knees bent; inspect then palpate all four quadrants',
    lookFor: ['Distension', 'Hernias', 'Organ enlargement', 'Tenderness location'],
  },
  posture: {
    instruction: 'Child standing, observe from behind and side; forward bend test',
    lookFor: ['Spinal curve (scoliosis)', 'Shoulder asymmetry', 'Knee alignment', 'Foot arch'],
  },
  motor: {
    instruction: 'Observe walking, standing on one leg, hopping, fine motor tasks',
    lookFor: ['Balance', 'Gait pattern', 'Muscle tone', 'Fine motor coordination'],
  },
  lymph: {
    instruction: 'Palpate cervical, axillary, and inguinal lymph node chains bilaterally',
    lookFor: ['Enlarged nodes', 'Tender nodes', 'Fixed vs mobile', 'Generalized vs localized'],
  },
  neurodevelopment: {
    instruction: 'Observe behavior, speech, social interaction; age-appropriate tasks',
    lookFor: ['Speech clarity', 'Social engagement', 'Attention span', 'Repetitive behaviors'],
  },
  immunization: {
    instruction: 'Check vaccination card or records against national schedule',
    lookFor: ['Missing vaccines', 'Delayed doses', 'Any adverse reactions reported'],
  },
  cardiac: {
    instruction: 'Auscultate with stethoscope at aortic, pulmonary, tricuspid, mitral areas',
    lookFor: ['Murmurs (systolic/diastolic)', 'Extra heart sounds', 'Rate and rhythm'],
  },
  pulmonary: {
    instruction: 'Auscultate anterior and posterior chest, 6 bilateral points',
    lookFor: ['Wheeze', 'Crackles', 'Reduced air entry', 'Bronchial breathing'],
  },
  vitals: {
    instruction: 'Use front camera, hold face steady in frame for 15-30 seconds',
    lookFor: ['Heart rate via facial blood flow', 'Stable reading', 'Good lighting'],
  },
  nutrition_intake: {
    instruction: 'Ask about meals, snacks, food groups consumed in past 24 hours',
    lookFor: ['Protein sources', 'Fruits/vegetables', 'Dairy intake', 'Meal regularity'],
  },
  intervention: {
    instruction: 'Record any supplements, deworming, or feeding programs the child receives',
    lookFor: ['Iron/vitamin supplements', 'Deworming status', 'Mid-day meal enrollment'],
  },
}

export function getModuleGuidance(moduleType: ModuleType): { instruction: string; lookFor: string[] } | undefined {
  return MODULE_GUIDANCE[moduleType]
}
