// Annotation chip definitions per module — ICD codes, severity options
// Ported from V2 annotation-chips.ts — structured evidence capture

import type { ModuleType, AnnotationChipConfig, ModuleAnnotationConfig } from './types'

// ── Per-module chip definitions ─────────────────────────────

const VISION_CHIPS: AnnotationChipConfig[] = [
  { id: 'v1', label: 'Red reflex normal', category: 'reflex', icdCode: 'Z01.00' },
  { id: 'v2', label: 'Red reflex abnormal', category: 'reflex', severity: true, icdCode: 'H21.0' },
  { id: 'v3', label: 'Red reflex absent', category: 'reflex', severity: true, icdCode: 'H21.0' },
  { id: 'v4', label: 'White reflex (leukocoria)', category: 'reflex', severity: true, icdCode: 'H44.8' },
  { id: 'v5', label: 'Asymmetric reflex', category: 'reflex', severity: true, icdCode: 'H50.9' },
  { id: 'v6', label: 'Eye alignment normal', category: 'alignment' },
  { id: 'v7', label: 'Strabismus', category: 'alignment', severity: true, icdCode: 'H50.9' },
  { id: 'v8', label: 'Nystagmus', category: 'alignment', severity: true, icdCode: 'H55' },
  { id: 'v9', label: 'Reduced visual acuity', category: 'acuity', severity: true, icdCode: 'H54' },
  { id: 'v10', label: 'Pupil asymmetry', category: 'pupil', severity: true, icdCode: 'H57.0' },
]

const DENTAL_CHIPS: AnnotationChipConfig[] = [
  { id: 'd1', label: 'Healthy teeth/gums', category: 'general' },
  { id: 'd2', label: 'Dental caries', category: 'teeth', severity: true, icdCode: 'K02' },
  { id: 'd3', label: 'Missing teeth', category: 'teeth', icdCode: 'K08.1' },
  { id: 'd4', label: 'Malocclusion', category: 'teeth', severity: true, icdCode: 'K07' },
  { id: 'd5', label: 'Gingivitis', category: 'gums', severity: true, icdCode: 'K05.1' },
  { id: 'd6', label: 'Gum bleeding', category: 'gums', severity: true, icdCode: 'K06.8' },
  { id: 'd7', label: 'Oral ulcers', category: 'oral', severity: true, locationPin: true, icdCode: 'K12.1' },
  { id: 'd8', label: 'Thrush (oral candidiasis)', category: 'oral', severity: true, icdCode: 'B37.0' },
  { id: 'd9', label: 'Delayed eruption', category: 'teeth', icdCode: 'K00.6' },
  { id: 'd10', label: 'Enamel hypoplasia', category: 'teeth', severity: true, icdCode: 'K00.4' },
  { id: 'd11', label: 'Supernumerary teeth', category: 'teeth', icdCode: 'K00.1' },
  { id: 'd12', label: 'Dental fluorosis', category: 'teeth', severity: true, icdCode: 'K00.3' },
  { id: 'd13', label: 'Bruxism signs', category: 'teeth', icdCode: 'F45.8' },
  { id: 'd14', label: 'Periodontal disease', category: 'gums', severity: true, icdCode: 'K05' },
  { id: 'd15', label: 'Abscess', category: 'oral', severity: true, locationPin: true, icdCode: 'K04.7' },
  { id: 'd16', label: 'Crowding', category: 'teeth', severity: true, icdCode: 'K07.3' },
  { id: 'd17', label: 'High arched palate', category: 'palate', icdCode: 'Q38.5' },
  { id: 'd18', label: 'Cleft lip/palate', category: 'palate', severity: true, icdCode: 'Q37' },
  { id: 'd19', label: 'Tongue tie', category: 'oral', icdCode: 'Q38.1' },
  { id: 'd20', label: 'Geographic tongue', category: 'oral', icdCode: 'K14.1' },
  { id: 'd21', label: 'Ankyloglossia', category: 'oral', icdCode: 'Q38.1' },
]

const SKIN_CHIPS: AnnotationChipConfig[] = [
  { id: 's1', label: 'Normal skin', category: 'general' },
  { id: 's2', label: 'Rash/eruption', category: 'lesion', severity: true, locationPin: true, icdCode: 'R21' },
  { id: 's3', label: 'Fungal infection', category: 'infection', severity: true, locationPin: true, icdCode: 'B36.9' },
  { id: 's4', label: 'Scabies', category: 'infection', severity: true, locationPin: true, icdCode: 'B86' },
  { id: 's5', label: 'Impetigo', category: 'infection', severity: true, locationPin: true, icdCode: 'L01' },
  { id: 's6', label: 'Eczema', category: 'condition', severity: true, locationPin: true, icdCode: 'L30.9' },
  { id: 's7', label: 'Psoriasis', category: 'condition', severity: true, locationPin: true, icdCode: 'L40' },
  { id: 's8', label: 'Vitiligo', category: 'pigment', severity: true, locationPin: true, icdCode: 'L80' },
  { id: 's9', label: 'Hyperpigmentation', category: 'pigment', locationPin: true, icdCode: 'L81.4' },
  { id: 's10', label: 'Wound/laceration', category: 'wound', severity: true, locationPin: true, icdCode: 'T14.1' },
  { id: 's11', label: 'Burn', category: 'wound', severity: true, locationPin: true, icdCode: 'T30' },
  { id: 's12', label: 'Birthmark/nevus', category: 'pigment', locationPin: true, icdCode: 'Q82.5' },
  { id: 's13', label: 'Warts', category: 'growth', locationPin: true, icdCode: 'B07' },
  { id: 's14', label: 'Keloid/scar', category: 'wound', locationPin: true, icdCode: 'L91.0' },
  { id: 's15', label: 'Ichthyosis', category: 'condition', severity: true, icdCode: 'Q80' },
  { id: 's16', label: 'Pediculosis', category: 'infection', severity: true, icdCode: 'B85' },
]

const EAR_CHIPS: AnnotationChipConfig[] = [
  { id: 'e1', label: 'TM normal', category: 'tympanic' },
  { id: 'e2', label: 'TM erythematous', category: 'tympanic', severity: true, icdCode: 'H66.9' },
  { id: 'e3', label: 'TM bulging', category: 'tympanic', severity: true, icdCode: 'H66.0' },
  { id: 'e4', label: 'TM retracted', category: 'tympanic', severity: true, icdCode: 'H73.0' },
  { id: 'e5', label: 'Effusion/fluid', category: 'middle_ear', severity: true, icdCode: 'H65.9' },
  { id: 'e6', label: 'Perforation', category: 'tympanic', severity: true, icdCode: 'H72' },
  { id: 'e7', label: 'Wax impaction', category: 'canal', severity: true, icdCode: 'H61.2' },
  { id: 'e8', label: 'Otitis externa', category: 'canal', severity: true, icdCode: 'H60' },
  { id: 'e9', label: 'Foreign body', category: 'canal', severity: true, icdCode: 'T16' },
  { id: 'e10', label: 'Discharge', category: 'canal', severity: true, icdCode: 'H92.1' },
]

const HEARING_CHIPS: AnnotationChipConfig[] = [
  { id: 'hr1', label: 'Hearing normal', category: 'general' },
  { id: 'hr2', label: 'Hearing normal (bilateral)', category: 'general' },
  { id: 'hr3', label: 'Mild hearing loss', category: 'loss', severity: true, icdCode: 'H90.5' },
  { id: 'hr4', label: 'Moderate hearing loss', category: 'loss', severity: true, icdCode: 'H90.5' },
  { id: 'hr5', label: 'Severe hearing loss', category: 'loss', severity: true, icdCode: 'H90.3' },
  { id: 'hr6', label: 'Unilateral loss (left)', category: 'loss', severity: true, icdCode: 'H90.1' },
  { id: 'hr7', label: 'Unilateral loss (right)', category: 'loss', severity: true, icdCode: 'H90.0' },
]

const EYES_EXTERNAL_CHIPS: AnnotationChipConfig[] = [
  { id: 'ee1', label: 'Eyes normal', category: 'general' },
  { id: 'ee2', label: 'Conjunctival pallor', category: 'conjunctiva', severity: true, icdCode: 'H10.4' },
  { id: 'ee3', label: 'Conjunctivitis', category: 'conjunctiva', severity: true, icdCode: 'H10.9' },
  { id: 'ee4', label: 'Jaundice/icterus', category: 'sclera', severity: true, icdCode: 'R17' },
  { id: 'ee5', label: 'Conjunctival pallor (anemia)', category: 'conjunctiva', severity: true, icdCode: 'D64.9' },
  { id: 'ee6', label: 'Ptosis', category: 'eyelid', severity: true, icdCode: 'H02.4' },
  { id: 'ee7', label: 'Squint/strabismus', category: 'alignment', severity: true, icdCode: 'H50.9' },
  { id: 'ee8', label: 'Eye discharge', category: 'infection', severity: true, icdCode: 'H10.0' },
  { id: 'ee9', label: 'Periorbital edema', category: 'eyelid', severity: true, icdCode: 'H05.2' },
  { id: 'ee10', label: 'Stye/chalazion', category: 'eyelid', severity: true, locationPin: true, icdCode: 'H00' },
  { id: 'ee11', label: 'Watering (epiphora)', category: 'tear', icdCode: 'H04.2' },
  { id: 'ee12', label: 'Proptosis', category: 'orbital', severity: true, icdCode: 'H05.2' },
  { id: 'ee13', label: 'Subconjunctival hemorrhage', category: 'conjunctiva', icdCode: 'H11.3' },
  { id: 'ee14', label: 'Photophobia', category: 'symptom', severity: true, icdCode: 'H53.1' },
  { id: 'ee15', label: 'Corneal opacity', category: 'cornea', severity: true, icdCode: 'H17' },
  { id: 'ee16', label: 'Iris coloboma', category: 'iris', icdCode: 'Q13.0' },
]

const GENERAL_APPEARANCE_CHIPS: AnnotationChipConfig[] = [
  { id: 'ga1', label: 'Well-nourished', category: 'nutrition' },
  { id: 'ga2', label: 'Malnourished', category: 'nutrition', severity: true, icdCode: 'E46' },
  { id: 'ga3', label: 'Pallor', category: 'color', severity: true, icdCode: 'R23.1' },
  { id: 'ga4', label: 'Cyanosis', category: 'color', severity: true, icdCode: 'R23.0' },
  { id: 'ga5', label: 'Jaundice', category: 'color', severity: true, icdCode: 'R17' },
  { id: 'ga6', label: 'Dehydrated', category: 'hydration', severity: true, icdCode: 'E86' },
  { id: 'ga7', label: 'Edema', category: 'hydration', severity: true, locationPin: true, icdCode: 'R60' },
  { id: 'ga8', label: 'Lethargic', category: 'activity', severity: true, icdCode: 'R53' },
  { id: 'ga9', label: 'Irritable', category: 'activity', severity: true },
  { id: 'ga10', label: 'Short stature', category: 'growth', severity: true, icdCode: 'E34.3' },
  { id: 'ga11', label: 'Obesity', category: 'growth', severity: true, icdCode: 'E66' },
  { id: 'ga12', label: 'Down syndrome features', category: 'congenital', severity: true, icdCode: 'Q90' },
  { id: 'ga13', label: 'Hydrocephalus', category: 'congenital', severity: true, icdCode: 'Q03' },
  { id: 'ga14', label: 'SAM features', category: 'nutrition', severity: true, icdCode: 'E43' },
  { id: 'ga15', label: 'MAM features', category: 'nutrition', severity: true, icdCode: 'E44' },
  { id: 'ga16', label: 'Micronutrient deficiency signs', category: 'nutrition', severity: true, icdCode: 'E61.9' },
]

const HAIR_CHIPS: AnnotationChipConfig[] = [
  { id: 'h1', label: 'Hair normal', category: 'general' },
  { id: 'h2', label: 'Pediculosis (lice)', category: 'infection', severity: true, icdCode: 'B85.0' },
  { id: 'h3', label: 'Dandruff/seborrhea', category: 'scalp', severity: true, icdCode: 'L21' },
  { id: 'h4', label: 'Alopecia/thinning', category: 'loss', severity: true, locationPin: true, icdCode: 'L63' },
  { id: 'h5', label: 'Tinea capitis', category: 'infection', severity: true, locationPin: true, icdCode: 'B35.0' },
  { id: 'h6', label: 'Flag sign (malnutrition)', category: 'nutrition', severity: true, icdCode: 'E46' },
  { id: 'h7', label: 'Sparse/brittle hair', category: 'nutrition', severity: true, icdCode: 'E46' },
]

const NAILS_CHIPS: AnnotationChipConfig[] = [
  { id: 'na1', label: 'Nails normal', category: 'general' },
  { id: 'na2', label: 'Koilonychia (spoon nails)', category: 'shape', severity: true, icdCode: 'L60.3' },
  { id: 'na3', label: 'Nail bed pallor', category: 'color', severity: true, icdCode: 'D64.9' },
  { id: 'na4', label: 'Clubbing', category: 'shape', severity: true, icdCode: 'R68.3' },
  { id: 'na5', label: 'Cyanotic nail beds', category: 'color', severity: true, icdCode: 'R23.0' },
  { id: 'na6', label: 'Fungal infection', category: 'infection', severity: true, icdCode: 'B35.1' },
  { id: 'na7', label: 'Bitten nails', category: 'habit' },
  { id: 'na8', label: 'Brittle/ridged nails', category: 'nutrition', icdCode: 'L60.3' },
]

const NOSE_CHIPS: AnnotationChipConfig[] = [
  { id: 'no1', label: 'Nose normal', category: 'general' },
  { id: 'no2', label: 'Nasal discharge', category: 'discharge', severity: true, icdCode: 'R09.8' },
  { id: 'no3', label: 'Deviated septum', category: 'structure', severity: true, icdCode: 'J34.2' },
  { id: 'no4', label: 'Turbinate hypertrophy', category: 'structure', severity: true, icdCode: 'J34.3' },
  { id: 'no5', label: 'Nasal polyp', category: 'structure', severity: true, icdCode: 'J33' },
  { id: 'no6', label: 'Epistaxis signs', category: 'bleeding', severity: true, icdCode: 'R04.0' },
  { id: 'no7', label: 'Allergic salute', category: 'allergy', icdCode: 'J30.9' },
]

const THROAT_CHIPS: AnnotationChipConfig[] = [
  { id: 'th1', label: 'Throat normal', category: 'general' },
  { id: 'th2', label: 'Tonsillar enlargement', category: 'tonsils', severity: true, icdCode: 'J35.1' },
  { id: 'th3', label: 'Tonsillar exudate', category: 'tonsils', severity: true, icdCode: 'J03.9' },
  { id: 'th4', label: 'Pharyngitis', category: 'pharynx', severity: true, icdCode: 'J02.9' },
  { id: 'th5', label: 'Uvula deviation', category: 'palate', icdCode: 'Q38.5' },
  { id: 'th6', label: 'Post-nasal drip', category: 'discharge', icdCode: 'R09.8' },
]

const NECK_CHIPS: AnnotationChipConfig[] = [
  { id: 'nk1', label: 'Neck normal', category: 'general' },
  { id: 'nk2', label: 'Goiter Grade I', category: 'thyroid', severity: true, icdCode: 'E04.0' },
  { id: 'nk3', label: 'Goiter Grade II', category: 'thyroid', severity: true, icdCode: 'E04.0' },
  { id: 'nk4', label: 'Goiter Grade III', category: 'thyroid', severity: true, icdCode: 'E04.0' },
  { id: 'nk5', label: 'Lymphadenopathy', category: 'lymph', severity: true, icdCode: 'R59' },
  { id: 'nk6', label: 'Torticollis', category: 'musculoskeletal', severity: true, icdCode: 'M43.6' },
  { id: 'nk7', label: 'Thyroid nodule', category: 'thyroid', severity: true, icdCode: 'E04.1' },
  { id: 'nk8', label: 'Cystic hygroma', category: 'congenital', severity: true, icdCode: 'D18.1' },
  { id: 'nk9', label: 'Branchial cleft cyst', category: 'congenital', severity: true, icdCode: 'Q18.0' },
  { id: 'nk10', label: 'Webbed neck', category: 'congenital', icdCode: 'Q18.3' },
]

const ABDOMEN_CHIPS: AnnotationChipConfig[] = [
  { id: 'ab1', label: 'Abdomen normal', category: 'general' },
  { id: 'ab2', label: 'Distension', category: 'inspection', severity: true, icdCode: 'R14' },
  { id: 'ab3', label: 'Umbilical hernia', category: 'hernia', severity: true, locationPin: true, icdCode: 'K42' },
  { id: 'ab4', label: 'Inguinal hernia', category: 'hernia', severity: true, locationPin: true, icdCode: 'K40' },
  { id: 'ab5', label: 'Hepatomegaly', category: 'organ', severity: true, icdCode: 'R16.0' },
  { id: 'ab6', label: 'Splenomegaly', category: 'organ', severity: true, icdCode: 'R16.1' },
  { id: 'ab7', label: 'Tenderness', category: 'palpation', severity: true, locationPin: true, icdCode: 'R10' },
  { id: 'ab8', label: 'Ascites', category: 'fluid', severity: true, icdCode: 'R18' },
]

const POSTURE_CHIPS: AnnotationChipConfig[] = [
  { id: 'p1', label: 'Scoliosis', category: 'spine', severity: true, icdCode: 'M41' },
  { id: 'p2', label: 'Kyphosis', category: 'spine', severity: true, icdCode: 'M40.2' },
  { id: 'p3', label: 'Lordosis', category: 'spine', severity: true, icdCode: 'M40.5' },
  { id: 'p4', label: 'Normal posture', category: 'general' },
  { id: 'p5', label: 'Genu valgum (knock knee)', category: 'limb', severity: true, icdCode: 'M21.0' },
  { id: 'p6', label: 'Genu varum (bow leg)', category: 'limb', severity: true, icdCode: 'M21.1' },
  { id: 'p7', label: 'Flat feet', category: 'foot', severity: true, icdCode: 'M21.4' },
  { id: 'p8', label: 'Limb length discrepancy', category: 'limb', severity: true, icdCode: 'M21.7' },
  { id: 'p9', label: 'Shoulder asymmetry', category: 'trunk', severity: true },
  { id: 'p10', label: 'Pelvic tilt', category: 'trunk', severity: true },
  { id: 'p11', label: 'Winging scapula', category: 'trunk', severity: true, icdCode: 'M89.8' },
  { id: 'p12', label: 'Trendelenburg gait', category: 'gait', severity: true },
  { id: 'p13', label: 'Clubfoot/talipes', category: 'foot', severity: true, icdCode: 'Q66.0' },
  { id: 'p14', label: 'Spina bifida', category: 'spine', severity: true, icdCode: 'Q05' },
  { id: 'p15', label: 'Neural tube defect', category: 'spine', severity: true, icdCode: 'Q00' },
]

const MOTOR_CHIPS: AnnotationChipConfig[] = [
  { id: 'm1', label: 'Motor skills normal', category: 'general' },
  { id: 'm2', label: 'Poor balance', category: 'balance', severity: true },
  { id: 'm3', label: 'Abnormal gait', category: 'gait', severity: true, icdCode: 'R26' },
  { id: 'm4', label: 'Reduced ROM', category: 'flexibility', severity: true, locationPin: true },
  { id: 'm5', label: 'Muscle weakness', category: 'strength', severity: true, icdCode: 'M62.8' },
  { id: 'm6', label: 'Spasticity', category: 'tone', severity: true, icdCode: 'G80' },
  { id: 'm7', label: 'Hypotonia', category: 'tone', severity: true, icdCode: 'P94.2' },
  { id: 'm8', label: 'Gross motor delay', category: 'delay', severity: true, icdCode: 'F82' },
  { id: 'm9', label: 'Fine motor delay', category: 'delay', severity: true, icdCode: 'F82' },
  { id: 'm10', label: 'Cerebral palsy signs', category: 'neurological', severity: true, icdCode: 'G80' },
  { id: 'm11', label: 'Polydactyly', category: 'congenital', icdCode: 'Q69' },
]

const LYMPH_CHIPS: AnnotationChipConfig[] = [
  { id: 'ly1', label: 'Lymph nodes normal', category: 'general' },
  { id: 'ly2', label: 'Cervical lymphadenopathy', category: 'cervical', severity: true, locationPin: true, icdCode: 'R59.0' },
  { id: 'ly3', label: 'Axillary lymphadenopathy', category: 'axillary', severity: true, locationPin: true, icdCode: 'R59.0' },
  { id: 'ly4', label: 'Inguinal lymphadenopathy', category: 'inguinal', severity: true, locationPin: true, icdCode: 'R59.0' },
  { id: 'ly5', label: 'Generalized lymphadenopathy', category: 'generalized', severity: true, icdCode: 'R59.1' },
]

const NEURODEVELOPMENT_CHIPS: AnnotationChipConfig[] = [
  { id: 'n1', label: 'Speech/language delay', category: 'development', severity: true, icdCode: 'F80' },
  { id: 'n2', label: 'Social withdrawal', category: 'behavioral', severity: true, icdCode: 'F84.0' },
  { id: 'n3', label: 'Hyperactivity', category: 'behavioral', severity: true, icdCode: 'F90' },
  { id: 'n4', label: 'Inattention', category: 'behavioral', severity: true, icdCode: 'F90' },
  { id: 'n5', label: 'Repetitive behaviors', category: 'behavioral', severity: true, icdCode: 'F84.0' },
  { id: 'n6', label: 'Sensory sensitivity', category: 'behavioral', severity: true, icdCode: 'F84.0' },
  { id: 'n7', label: 'Cognitive delay', category: 'development', severity: true, icdCode: 'F79' },
  { id: 'n8', label: 'Adaptive behavior delay', category: 'development', severity: true, icdCode: 'F70' },
  { id: 'n9', label: 'ASD screening positive', category: 'screening', severity: true, icdCode: 'F84.0' },
  { id: 'n10', label: 'Intellectual disability', category: 'development', severity: true, icdCode: 'F79' },
  { id: 'n11', label: 'Anxiety', category: 'mental_health', severity: true, icdCode: 'F41.9' },
  { id: 'n12', label: 'Depression', category: 'mental_health', severity: true, icdCode: 'F32.9' },
  { id: 'n13', label: 'Oppositional behavior', category: 'behavioral', severity: true, icdCode: 'F91.3' },
  { id: 'n14', label: 'Conduct disorder', category: 'behavioral', severity: true, icdCode: 'F91.9' },
  { id: 'n15', label: 'Adjustment disorder', category: 'mental_health', severity: true, icdCode: 'F43.2' },
  { id: 'n16', label: 'Emotional disturbance', category: 'mental_health', severity: true, icdCode: 'F93.9' },
  { id: 'n17', label: 'Dyslexia', category: 'learning', severity: true, icdCode: 'F81.0' },
  { id: 'n18', label: 'Dyscalculia', category: 'learning', severity: true, icdCode: 'F81.2' },
  { id: 'n19', label: 'Dysgraphia', category: 'learning', severity: true, icdCode: 'F81.8' },
  { id: 'n20', label: 'Digital dependency', category: 'behavioral', severity: true, icdCode: 'F63.0' },
  { id: 'n21', label: 'Normal development', category: 'general' },
]

const RESPIRATORY_CHIPS: AnnotationChipConfig[] = [
  { id: 'r1', label: 'Breath sounds normal', category: 'general' },
  { id: 'r2', label: 'Wheeze', category: 'sounds', severity: true, icdCode: 'R06.2' },
  { id: 'r3', label: 'Crackles/rales', category: 'sounds', severity: true, icdCode: 'R09.8' },
  { id: 'r4', label: 'Stridor', category: 'sounds', severity: true, icdCode: 'R06.1' },
  { id: 'r5', label: 'Dry cough', category: 'cough', severity: true, icdCode: 'R05' },
  { id: 'r6', label: 'Wet/productive cough', category: 'cough', severity: true, icdCode: 'R05' },
  { id: 'r7', label: 'Tachypnea', category: 'rate', severity: true, icdCode: 'R06.0' },
  { id: 'r8', label: 'Chest retraction', category: 'distress', severity: true, icdCode: 'R06.0' },
]

const VITALS_CHIPS: AnnotationChipConfig[] = [
  { id: 'vt1', label: 'Vitals normal', category: 'general' },
  { id: 'vt2', label: 'Tachycardia', category: 'heart_rate', severity: true, icdCode: 'R00.0' },
  { id: 'vt3', label: 'Heart murmur', category: 'heart', severity: true, icdCode: 'R01.1' },
  { id: 'vt4', label: 'Bradycardia', category: 'heart_rate', severity: true, icdCode: 'R00.1' },
  { id: 'vt5', label: 'Irregular rhythm', category: 'rhythm', severity: true, icdCode: 'R00.8' },
]

const IMMUNIZATION_CHIPS: AnnotationChipConfig[] = [
  { id: 'imm1', label: 'Up to date', category: 'status' },
  { id: 'imm2', label: 'Partially immunized', category: 'status', severity: true, icdCode: 'Z28.3' },
  { id: 'imm3', label: 'Not immunized', category: 'status', severity: true, icdCode: 'Z28.9' },
  { id: 'imm4', label: 'Delayed schedule', category: 'status', severity: true, icdCode: 'Z28.8' },
  { id: 'imm5', label: 'No records available', category: 'status' },
  { id: 'imm6', label: 'AEFI reported', category: 'adverse', severity: true, icdCode: 'T50.B95' },
]

const CARDIAC_CHIPS: AnnotationChipConfig[] = [
  { id: 'ca1', label: 'Heart sounds normal', category: 'general' },
  { id: 'ca2', label: 'Systolic murmur', category: 'murmur', severity: true, icdCode: 'R01.1' },
  { id: 'ca3', label: 'Diastolic murmur', category: 'murmur', severity: true, icdCode: 'R01.1' },
  { id: 'ca4', label: 'S3 gallop', category: 'extra_sounds', severity: true },
  { id: 'ca5', label: 'S4 gallop', category: 'extra_sounds', severity: true },
  { id: 'ca6', label: 'Split S2', category: 'extra_sounds', severity: true },
  { id: 'ca7', label: 'Innocent murmur', category: 'murmur' },
]

const PULMONARY_CHIPS: AnnotationChipConfig[] = [
  { id: 'pu1', label: 'Lung sounds normal', category: 'general' },
  { id: 'pu2', label: 'Wheeze bilateral', category: 'adventitious', severity: true, icdCode: 'R06.2' },
  { id: 'pu3', label: 'Crackles basal', category: 'adventitious', severity: true },
  { id: 'pu4', label: 'Reduced air entry', category: 'breath_sounds', severity: true },
  { id: 'pu5', label: 'Bronchial breathing', category: 'breath_sounds', severity: true },
  { id: 'pu6', label: 'Pleural rub', category: 'adventitious', severity: true },
]

const MUAC_CHIPS: AnnotationChipConfig[] = [
  { id: 'muac1', label: 'SAM (<115mm)', category: 'classification', severity: true, icdCode: 'E43' },
  { id: 'muac2', label: 'MAM (115-125mm)', category: 'classification', severity: true, icdCode: 'E44' },
  { id: 'muac3', label: 'Normal (>125mm)', category: 'classification' },
  { id: 'muac4', label: 'Bilateral pitting edema', category: 'edema', severity: true, icdCode: 'E43' },
]

const NUTRITION_INTAKE_CHIPS: AnnotationChipConfig[] = [
  { id: 'ni1', label: 'Adequate diet', category: 'general' },
  { id: 'ni2', label: 'Inadequate protein', category: 'macro', severity: true },
  { id: 'ni3', label: 'Inadequate calories', category: 'macro', severity: true },
  { id: 'ni4', label: 'No fruits/vegetables', category: 'micro', severity: true },
  { id: 'ni5', label: 'No dairy/calcium', category: 'micro', severity: true },
  { id: 'ni6', label: 'Iron-poor diet', category: 'micro', severity: true },
  { id: 'ni7', label: 'Junk food excess', category: 'pattern', severity: true },
  { id: 'ni_in_h8', label: 'Low dietary diversity (India)', category: 'diversity', severity: true, icdCode: 'E63.1' },
  { id: 'ni_in_h9', label: 'Skips meals regularly', category: 'pattern', severity: true },
  { id: 'ni_in_h10', label: 'Food insecurity', category: 'access', severity: true, icdCode: 'E63.1' },
  { id: 'ni_ae_h5', label: 'Low dietary diversity (UAE)', category: 'diversity', severity: true, icdCode: 'E63.1' },
  { id: 'ni_ae_h6', label: 'Food insecurity (UAE)', category: 'access', severity: true, icdCode: 'E63.1' },
  { id: 'ni_df_h6', label: 'Low dietary diversity (default)', category: 'diversity', severity: true, icdCode: 'E63.1' },
  { id: 'ni_df_h7', label: 'Food insecurity (default)', category: 'access', severity: true, icdCode: 'E63.1' },
]

const INTERVENTION_CHIPS: AnnotationChipConfig[] = [
  { id: 'iv1', label: 'Iron supplementation', category: 'supplement' },
  { id: 'iv2', label: 'Vitamin A supplementation', category: 'supplement' },
  { id: 'iv3', label: 'Zinc supplementation', category: 'supplement' },
  { id: 'iv4', label: 'Deworming done', category: 'deworming' },
  { id: 'iv5', label: 'Mid-day meal (MDM)', category: 'feeding_program' },
  { id: 'iv6', label: 'Take-home ration (THR)', category: 'feeding_program' },
  { id: 'iv7', label: 'Therapeutic food (RUTF)', category: 'therapeutic', severity: true },
  { id: 'iv8', label: 'ORS/rehydration', category: 'therapeutic' },
  { id: 'iv9', label: 'Referred to NRC', category: 'referral', severity: true },
]

// Height/weight/spo2/hemoglobin/bp are value-capture modules — no annotation chips needed
// They auto-classify based on WHO Z-scores, reference tables

// ── Master annotation config map ─────────────────────────────

export const MODULE_ANNOTATION_CONFIGS: ModuleAnnotationConfig[] = [
  { moduleType: 'vision', chips: VISION_CHIPS },
  { moduleType: 'dental', chips: DENTAL_CHIPS },
  { moduleType: 'skin', chips: SKIN_CHIPS },
  { moduleType: 'ear', chips: EAR_CHIPS },
  { moduleType: 'hearing', chips: HEARING_CHIPS },
  { moduleType: 'eyes_external', chips: EYES_EXTERNAL_CHIPS },
  { moduleType: 'general_appearance', chips: GENERAL_APPEARANCE_CHIPS },
  { moduleType: 'hair', chips: HAIR_CHIPS },
  { moduleType: 'nails', chips: NAILS_CHIPS },
  { moduleType: 'nose', chips: NOSE_CHIPS },
  { moduleType: 'throat', chips: THROAT_CHIPS },
  { moduleType: 'neck', chips: NECK_CHIPS },
  { moduleType: 'abdomen', chips: ABDOMEN_CHIPS },
  { moduleType: 'posture', chips: POSTURE_CHIPS },
  { moduleType: 'motor', chips: MOTOR_CHIPS },
  { moduleType: 'lymph', chips: LYMPH_CHIPS },
  { moduleType: 'neurodevelopment', chips: NEURODEVELOPMENT_CHIPS },
  { moduleType: 'respiratory', chips: RESPIRATORY_CHIPS },
  { moduleType: 'vitals', chips: VITALS_CHIPS },
  { moduleType: 'immunization', chips: IMMUNIZATION_CHIPS },
  { moduleType: 'cardiac', chips: CARDIAC_CHIPS },
  { moduleType: 'pulmonary', chips: PULMONARY_CHIPS },
  { moduleType: 'muac', chips: MUAC_CHIPS },
  { moduleType: 'nutrition_intake', chips: NUTRITION_INTAKE_CHIPS },
  { moduleType: 'intervention', chips: INTERVENTION_CHIPS },
]

// ── Helper functions ──────────────────────────────────────────

export function getChipsForModule(moduleType: ModuleType): AnnotationChipConfig[] {
  const config = MODULE_ANNOTATION_CONFIGS.find(c => c.moduleType === moduleType)
  return config?.chips ?? []
}

export function getChipLabel(chipId: string): string {
  for (const config of MODULE_ANNOTATION_CONFIGS) {
    const chip = config.chips.find(c => c.id === chipId)
    if (chip) return chip.label
  }
  return chipId
}

export function getChipById(chipId: string): AnnotationChipConfig | undefined {
  for (const config of MODULE_ANNOTATION_CONFIGS) {
    const chip = config.chips.find(c => c.id === chipId)
    if (chip) return chip
  }
  return undefined
}

export function getChipCategories(moduleType: ModuleType): string[] {
  const chips = getChipsForModule(moduleType)
  return [...new Set(chips.map(c => c.category))]
}

export function getChipsByCategory(moduleType: ModuleType, category: string): AnnotationChipConfig[] {
  return getChipsForModule(moduleType).filter(c => c.category === category)
}
