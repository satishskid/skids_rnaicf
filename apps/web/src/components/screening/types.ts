import { ModuleAnnotationConfig, AnnotationChipConfig, AnnotationData } from '@skids/shared'
import type { OrgConfig } from '@/lib/org-config'

export interface ScreeningProps {
  step: number
  setStep: (step: number) => void
  onComplete: (results: Record<string, unknown>) => void
  isCapturing: boolean
  setIsCapturing: (capturing: boolean) => void
  progress: number
  setProgress: (progress: number) => void
  instructions: { title: string; steps: string[]; tips: string[]; conditions: string[]; dataCollected: string[] }
  childName: string
  /** Child's age for AI context (e.g., "4 years 3 months") */
  childAge?: string
  /** Org config for AI model settings */
  orgConfig?: OrgConfig | null
  /** Pre-populated annotation data for editing an existing observation */
  initialAnnotation?: AnnotationData
  /** ID of existing observation being edited (for upsert) */
  editingObservationId?: string
  /** Campaign code (for AyuSynk deep link referenceId) */
  campaignCode?: string
  /** Child ID (for AyuSynk deep link referenceId) */
  childId?: string
  /** Child's date of birth (ISO string, for AyuSynk age calculation) */
  childDob?: string
  /** Child's gender ('male' | 'female') */
  childGender?: string
}

export const MODULE_INSTRUCTIONS: Record<string, { title: string; steps: string[]; tips: string[]; conditions: string[]; dataCollected: string[] }> = {
  // === GROUP 1: Existing modules (enhanced with conditions) ===
  vision: {
    title: 'Vision Screening',
    steps: ['Hold phone 30-40 cm from face', 'Ask child to look at camera', 'Capture photo', 'Annotate findings'],
    tips: ['Remove glasses', 'Ensure eyes fully open', 'Keep phone steady', 'Good lighting required'],
    conditions: ['Squint/strabismus', 'Nystagmus', 'Photophobia', 'Abnormal red reflex', 'Pupil asymmetry'],
    dataCollected: ['Eye photograph', 'Red reflex measurement', 'Eye alignment score', 'Nurse annotations']
  },
  vitals: {
    title: 'Heart Rate Check',
    steps: ['Have child sit still', 'Hold phone 30 cm from face', 'Keep still for 30 seconds', 'Review results'],
    tips: ['Child should not talk', 'Good lighting improves accuracy', 'Stay relaxed'],
    conditions: ['Tachycardia', 'Bradycardia', 'Irregular rhythm'],
    dataCollected: ['Facial video (processed locally)', 'Heart rate (BPM)', 'Signal quality score']
  },
  respiratory: {
    title: 'Cough Analysis',
    steps: ['Sit in quiet room', 'Hold phone 50 cm away', 'Record cough/breathing', 'Annotate findings'],
    tips: ['Wait for natural coughs', 'Keep room quiet', 'Note other symptoms'],
    conditions: ['Wheeze', 'Stridor', 'Tachypnea', 'Retractions', 'Grunting', 'Nasal flaring'],
    dataCollected: ['Cough audio', 'Cough classification', 'Nurse annotations']
  },
  skin: {
    title: 'Skin Examination',
    steps: ['Select body area', 'Hold phone 20-30 cm from skin', 'Capture photo', 'Mark lesion locations', 'Annotate findings'],
    tips: ['Include size reference', 'Even lighting, avoid flash', 'Photograph front and back'],
    conditions: ['Eczema', 'Scabies', 'Impetigo', 'Fungal infection', 'Urticaria', 'Birthmark', 'Bruise/contusion', 'Rash', 'Wound'],
    dataCollected: ['Skin photo', 'Location pins', 'Condition annotations', 'Wound measurement']
  },
  ear: {
    title: 'Ear Examination',
    steps: ['Select left or right ear', 'Position phone near ear canal', 'Capture image', 'Annotate findings'],
    tips: ['Be gentle', 'Child should sit still', 'Good lighting essential'],
    conditions: ['Wax impaction', 'Discharge (serous/mucopurulent/bloody)', 'TM perforation', 'Foreign body', 'Otitis externa', 'Otitis media'],
    dataCollected: ['Ear photograph', 'Visibility score', 'Color analysis', 'Nurse annotations']
  },
  motor: {
    title: 'Motor Assessment',
    steps: ['Find open space', 'Ask child to walk/balance', 'Record movement', 'Annotate findings'],
    tips: ['Stay nearby for safety', 'Let child try naturally', 'Do not help during tasks'],
    conditions: ['Limp', 'Asymmetry', 'Joint swelling', 'Limited ROM', 'Tremor', 'Hypotonia', 'Hypertonia'],
    dataCollected: ['Movement video', 'Balance score', 'Gait analysis', 'Nurse annotations']
  },
  neurodevelopment: {
    title: 'Developmental Screening',
    steps: ['Sit with child in quiet area', 'Show phone screen', 'Observe natural responses', 'Annotate observations'],
    tips: ['Do not force participation', 'Let child explore naturally', 'Minimize distractions'],
    conditions: ['Speech delay', 'Social withdrawal', 'Hyperactivity', 'Attention deficit', 'Poor eye contact', 'Repetitive behaviors'],
    dataCollected: ['Response video', 'Gaze patterns', 'Engagement metrics', 'Nurse annotations']
  },

  // === GROUP 2: New camera+annotate modules ===
  general_appearance: {
    title: 'General Appearance',
    steps: ['Face the child', 'Capture a full-face photo', 'Assess general condition', 'Annotate findings'],
    tips: ['Natural lighting preferred', 'Child should be calm', 'Observe alertness and demeanor'],
    conditions: ['Well-nourished', 'Malnourished', 'Pallor', 'Icterus/jaundice', 'Cyanosis', 'Facial edema', 'Pedal edema', 'Dehydration signs', 'Poor hygiene', 'Syndromic features', 'Lethargy'],
    dataCollected: ['Face photograph', 'Nutritional assessment', 'Pallor/icterus/cyanosis analysis', 'Nurse annotations']
  },
  hair: {
    title: 'Hair & Scalp',
    steps: ['Part the hair in sections', 'Photograph the scalp', 'Look for nits, patches, scaling', 'Annotate findings'],
    tips: ['Check behind ears and nape', 'Good lighting to see nits', 'Use back camera'],
    conditions: ['Pediculosis (lice/nits)', 'Dandruff/seborrheic dermatitis', 'Alopecia areata', 'Tinea capitis (ringworm)', 'Folliculitis', 'Dry/brittle hair', 'Premature graying', 'Cradle cap', 'Psoriasis patches', 'Head lice eggs'],
    dataCollected: ['Scalp photograph', 'Condition annotations', 'AI color analysis']
  },
  eyes_external: {
    title: 'Eyes External Examination',
    steps: ['Face the child', 'Ask to look straight ahead', 'Capture close-up of both eyes', 'Annotate findings'],
    tips: ['Check in natural light', 'Look at eyelids, conjunctiva, pupils', 'Compare both eyes'],
    conditions: ['Strabismus/squint (eso/exo)', 'Ptosis', 'Conjunctival injection (redness)', 'Conjunctival pallor (anemia)', 'Subconjunctival hemorrhage', 'Stye/chalazion', 'Blepharitis', 'Epiphora (tearing)', 'Periorbital edema', 'Proptosis', 'Nystagmus', 'Anisocoria (pupil asymmetry)', 'Corneal opacity'],
    dataCollected: ['Eye photograph', 'Redness detection', 'Pallor analysis', 'Symmetry check', 'Nurse annotations']
  },
  nose: {
    title: 'Nose Examination',
    steps: ['Tilt child head slightly back', 'Illuminate with phone light', 'Capture photo of nostrils', 'Annotate findings'],
    tips: ['Be gentle', 'Check both nostrils', 'Note any discharge color'],
    conditions: ['Deviated septum', 'Nasal discharge (clear)', 'Nasal discharge (mucopurulent)', 'Nasal discharge (bloody)', 'Turbinate hypertrophy', 'Nasal polyps', 'Vestibulitis', 'Crusting', 'Epistaxis signs', 'Allergic crease', 'Allergic shiners', 'Nasal flaring'],
    dataCollected: ['Nose photograph', 'Discharge classification', 'Symmetry analysis', 'Nurse annotations']
  },
  dental: {
    title: 'Dental Screening',
    steps: ['Ask child to open mouth wide', 'Record video of teeth and gums', 'Include all quadrants', 'AI extracts best frames', 'Annotate on key frames'],
    tips: ['Say "Open wide and say aah"', 'Use phone flashlight', 'Record upper, lower, left, right'],
    conditions: ['Dental caries', 'Missing teeth', 'Filled teeth', 'Malocclusion (Class I/II/III)', 'Gingivitis', 'Plaque/calculus', 'Coated tongue', 'Geographic tongue', 'Oral ulcers (aphthous)', 'Candidiasis', 'Enamel hypoplasia', 'Fluorosis', 'Crowding', 'Spacing', 'Crossbite', 'Open bite', 'High arched palate', 'Cleft lip/palate scar'],
    dataCollected: ['Dental video', 'AI key frames', 'DMFT annotations', 'Color analysis', 'Nurse annotations']
  },
  throat: {
    title: 'Throat Examination',
    steps: ['Ask child to say "Aah"', 'Record video of throat', 'AI extracts best frame', 'Annotate findings on image'],
    tips: ['Use phone flashlight', 'Gentle tongue depression if needed', 'Quick capture - child comfort first'],
    conditions: ['Tonsillar hypertrophy (Grade 1-4)', 'Pharyngeal erythema', 'Tonsillar exudate', 'Cobblestoning', 'Uvula deviation', 'Postnasal drip', 'Peritonsillar abscess signs', 'Elongated uvula'],
    dataCollected: ['Throat video', 'AI key frames', 'Redness scoring', 'Nurse annotations']
  },
  neck: {
    title: 'Neck & Thyroid',
    steps: ['Ask child to swallow water', 'Record video from front', 'Palpate for lymph nodes', 'Annotate findings'],
    tips: ['Watch for thyroid movement on swallowing', 'Check all lymph node chains', 'Note size and tenderness'],
    conditions: ['Goiter (Grade 0-3)', 'Cervical lymphadenopathy (anterior)', 'Cervical lymphadenopathy (posterior)', 'Submandibular lymphadenopathy', 'Submental lymphadenopathy', 'Torticollis', 'Webbed neck', 'Thyroglossal cyst', 'Branchial cyst'],
    dataCollected: ['Neck video', 'AI key frame on swallow', 'Lymph node annotations', 'Nurse annotations']
  },
  nails: {
    title: 'Nail Examination',
    steps: ['Ask child to show both hands', 'Photograph fingernails', 'Check nail bed color', 'Annotate findings'],
    tips: ['Check for Schamroth window test', 'Compare nail color bilaterally', 'Press nail for capillary refill'],
    conditions: ['Clubbing', 'Koilonychia (spooning)', 'Pallor (anemia)', 'Cyanosis (blue)', 'Splinter hemorrhages', 'Onychomycosis (fungal)', 'Pitting (psoriasis)', "Beau's lines", 'Leukonychia', 'Paronychia', 'Bitten nails', 'Ridging', "Terry's nails"],
    dataCollected: ['Nail photograph', 'Color analysis', 'Clubbing assessment', 'Nurse annotations']
  },
  posture: {
    title: 'Posture & Spine',
    steps: ['Ask child to stand straight (back to camera)', 'Photograph standing posture', 'Ask to bend forward (Adams test)', 'Photograph forward bend', 'Annotate findings'],
    tips: ['Child should be in light clothing', 'Check from behind and side', 'Note shoulder/hip level'],
    conditions: ['Scoliosis', 'Kyphosis', 'Lordosis', 'Uneven shoulders', 'Pelvic tilt', 'Head tilt', 'Winged scapula', 'Pes planus (flat feet)', 'Pes cavus (high arch)', 'Genu valgum (knock knees)', 'Genu varum (bow legs)', 'Leg length discrepancy'],
    dataCollected: ['Posture photographs', 'Shoulder symmetry', 'Spine alignment', 'Nurse annotations']
  },
  abdomen: {
    title: 'Abdomen Examination',
    steps: ['Child lies supine', 'Photograph the abdomen', 'Mark tender areas on image', 'Annotate findings'],
    tips: ['Warm hands before palpation', 'Ask about pain location', 'Note any visible swelling'],
    conditions: ['Distension', 'Visible veins (caput medusae)', 'Umbilical hernia', 'Inguinal hernia', 'Tenderness - RUQ', 'Tenderness - LUQ', 'Tenderness - RLQ', 'Tenderness - LLQ', 'Hepatomegaly', 'Splenomegaly', 'Ascites', 'Surgical scars', 'Striae'],
    dataCollected: ['Abdomen photograph', 'Quadrant pain map', 'Hernia annotation', 'Nurse annotations']
  },
  lymph: {
    title: 'Lymph Node Examination',
    steps: ['Palpate cervical nodes', 'Palpate axillary nodes', 'Palpate inguinal nodes', 'Record findings for each group'],
    tips: ['Use gentle circular motion', 'Compare both sides', 'Note size, consistency, tenderness, mobility'],
    conditions: ['Cervical lymphadenopathy', 'Axillary lymphadenopathy', 'Inguinal lymphadenopathy', 'Epitrochlear lymphadenopathy', 'Matted nodes', 'Fixed nodes', 'Tender nodes', 'Hard nodes'],
    dataCollected: ['Node location map', 'Size estimates', 'Consistency notes', 'Nurse annotations']
  },

  // === GROUP 3: Measurement modules ===
  height: {
    title: 'Height Measurement',
    steps: ['Measure height with stadiometer', 'Enter value in cm', 'Photograph the reading', 'Review WHO Z-score'],
    tips: ['Shoes off, standing straight', 'Heels against wall', 'Look straight ahead'],
    conditions: ['Tall (>+2 SD)', 'Normal (-2 to +2 SD)', 'Stunted (<-2 SD)', 'Severely stunted (<-3 SD)'],
    dataCollected: ['Height (cm)', 'Evidence photo', 'WHO Z-score', 'Height-for-age classification']
  },
  weight: {
    title: 'Weight Measurement',
    steps: ['Weigh child on calibrated scale', 'Enter value in kg', 'Photograph the reading', 'Review WHO Z-score'],
    tips: ['Light clothing, no shoes', 'Digital scale preferred', 'Record to nearest 0.1 kg'],
    conditions: ['Overweight (>+2 SD)', 'Normal (-2 to +2 SD)', 'Underweight (<-2 SD)', 'Severely underweight (<-3 SD)'],
    dataCollected: ['Weight (kg)', 'Evidence photo', 'WHO Z-score', 'Weight-for-age classification', 'BMI (if height available)']
  },
  spo2: {
    title: 'Oxygen Saturation',
    steps: ['Place pulse oximeter on finger', 'Wait for stable reading', 'Enter SpO2 value', 'Photograph the display'],
    tips: ['Warm hands for better reading', 'Keep child still', 'Wait for stable waveform'],
    conditions: ['Normal (>= 95%)', 'Mild hypoxia (90-94%)', 'Moderate hypoxia (85-89%)', 'Severe hypoxia (<85%)'],
    dataCollected: ['SpO2 (%)', 'Evidence photo', 'Clinical classification']
  },
  hemoglobin: {
    title: 'Hemoglobin Level',
    steps: ['Measure Hb with portable device', 'Enter value in g/dL', 'Photograph the reading', 'Review WHO anemia classification'],
    tips: ['Finger prick - be gentle', 'Clean site with alcohol swab', 'Use calibrated device'],
    conditions: ['Normal', 'Mild anemia', 'Moderate anemia', 'Severe anemia'],
    dataCollected: ['Hemoglobin (g/dL)', 'Evidence photo', 'WHO anemia classification']
  },
  bp: {
    title: 'Blood Pressure',
    steps: ['Seat child comfortably for 5 minutes', 'Apply appropriately sized cuff to right arm', 'Measure systolic and diastolic', 'Enter both values', 'Photograph the reading'],
    tips: ['Use age-appropriate cuff size', 'Arm at heart level', 'Child should be relaxed and quiet', 'Take 3 readings, use the average'],
    conditions: ['Normal', 'Elevated', 'Stage 1 Hypertension', 'Stage 2 Hypertension'],
    dataCollected: ['Systolic (mmHg)', 'Diastolic (mmHg)', 'Evidence photo', 'Pediatric BP classification']
  },

  // === GROUP 5: Immunization ===
  immunization: {
    title: 'Immunization Record',
    steps: ['Ask parent/guardian about vaccination history', 'Review vaccination card if available', 'Mark each dose as Given / Not Given / Unknown', 'Photograph vaccination card as evidence'],
    tips: ['Request physical vaccination card', 'Cross-check with parent recall', 'Note any reported adverse events', 'Record evidence type (oral or card)'],
    conditions: ['Up to date', 'Partially immunized', 'Not immunized', 'Immunization delayed', 'AEFI reported', 'Contraindication noted'],
    dataCollected: ['Dose status per vaccine', 'Vaccination card photo', 'Classification', 'Nurse annotations']
  },

  // === GROUP 4: Hearing ===
  hearing: {
    title: 'Hearing Screening',
    steps: ['Connect earphones/headphones', 'Ensure quiet environment', 'Child taps button when they hear a tone', 'Test both ears at 500, 1000, 2000, 4000 Hz', 'Review Pure-Tone Average'],
    tips: ['Use quality earphones for accuracy', 'Quiet room is essential', 'Explain to child: "Press when you hear a beep"', 'Test each ear separately'],
    conditions: ['Normal hearing (PTA <= 20 dB)', 'Slight loss (21-25 dB)', 'Mild loss (26-40 dB)', 'Moderate loss (41-55 dB)', 'Moderately severe (56-70 dB)', 'Severe loss (71-90 dB)', 'Profound loss (>90 dB)'],
    dataCollected: ['Thresholds at 500, 1000, 2000, 4000 Hz per ear', 'Pure-tone average', 'WHO hearing classification', 'Audiogram data']
  },

  // === GROUP 6: Stethoscope Auscultation ===
  cardiac: {
    title: 'Cardiac Auscultation',
    steps: ['Connect USB stethoscope', 'Place on aortic area (2nd R ICS)', 'Record 10 seconds', 'Move to pulmonic, tricuspid, mitral areas', 'Annotate findings'],
    tips: ['Quiet room essential', 'Child should be sitting upright', 'Use bell for low-pitched sounds', 'Use diaphragm for high-pitched sounds'],
    conditions: ['Normal S1/S2', 'Systolic murmur', 'Diastolic murmur', 'Gallop (S3/S4)', 'Split S2', 'Arrhythmia', 'Pericardial rub'],
    dataCollected: ['Audio recordings at 4 cardiac points', 'Frequency analysis', 'Classification per point', 'Nurse annotations']
  },
  pulmonary: {
    title: 'Pulmonary Auscultation',
    steps: ['Connect USB stethoscope', 'Start with posterior lung fields', 'Record 10 seconds per point', 'Compare left vs right sides', 'Check anterior fields', 'Annotate findings'],
    tips: ['Ask child to breathe deeply through mouth', 'Compare symmetric lung fields', 'Note any asymmetry', 'Listen for full inspiratory and expiratory cycle'],
    conditions: ['Normal vesicular', 'Wheeze', 'Rhonchi', 'Fine crackles', 'Coarse crackles', 'Stridor', 'Diminished breath sounds', 'Pleural rub'],
    dataCollected: ['Audio recordings at 6 lung points', 'Frequency analysis', 'Classification per point', 'Nurse annotations']
  },

  // === GROUP 7: Nutrition / Feeding India ===
  muac: {
    title: 'MUAC Measurement',
    steps: ['Expose left upper arm', 'Find midpoint between shoulder and elbow', 'Wrap MUAC tape snugly (not tight)', 'Read measurement in millimeters', 'Photograph the tape reading'],
    tips: ['Use left arm by WHO convention', 'Tape should be flat, not twisted', 'Read where arrow points', 'For children 6-59 months primarily'],
    conditions: ['SAM - Red (<115mm)', 'MAM - Yellow (115-125mm)', 'Normal - Green (>125mm)', 'Bilateral Pitting Edema'],
    dataCollected: ['MUAC (mm)', 'WHO band color', 'Evidence photo', 'Classification']
  },
  nutrition_intake: {
    title: 'Nutrition Intake',
    steps: ['Record school nutrition (meal type, frequency)', 'Select school food items consumed', 'Record home nutrition (meals per day, diet type)', 'Select home food items consumed', 'Note any dietary risk factors'],
    tips: ['Ask about typical day, not best day', 'Include snacks and beverages', 'Note if child skips breakfast', 'Check for junk food / packaged food consumption'],
    conditions: ['Adequate diet', 'Moderate risk', 'High risk - poor diversity', 'No school meal', 'Skips breakfast'],
    dataCollected: ['School meal type & frequency', 'School food chips', 'Home meals/day & diet type', 'Home food chips', 'Risk flags']
  },
  intervention: {
    title: 'Intervention Tracking',
    steps: ['Review current interventions for child', 'Select active supplementation/fortification', 'Record deworming and feeding program status', 'Note clinical referrals if any', 'Set status and frequency for each'],
    tips: ['Ask about IFA tablets, Vitamin A', 'Check if child receives mid-day meal', 'Note last deworming date', 'Record any NRC/OTP referral'],
    conditions: ['Active intervention', 'Completed', 'Not started', 'Discontinued'],
    dataCollected: ['Intervention list with status', 'Start dates & frequency', 'Category (supplementation/fortification/deworming/feeding/clinical)', 'Notes']
  }
}

// === COMPREHENSIVE ANNOTATION CHIP CONFIGS ===
// These define the clinical conditions a nurse can annotate per module

export const MODULE_ANNOTATION_CONFIGS: Record<string, ModuleAnnotationConfig> = {
  vision: {
    moduleType: 'vision',
    chips: [
      { id: 'v1', label: 'Squint/Strabismus', category: 'Alignment', severity: true, icdCode: 'H50' },
      { id: 'v2', label: 'Nystagmus', category: 'Movement', severity: true, icdCode: 'H55' },
      { id: 'v3', label: 'Photophobia', category: 'Sensitivity', icdCode: 'H53.1' },
      { id: 'v4', label: 'Abnormal Red Reflex', category: 'Reflex', severity: true, icdCode: 'H44.9' },
      { id: 'v5', label: 'Pupil Asymmetry', category: 'Pupil', icdCode: 'H57.0' },
      { id: 'v6', label: 'Ptosis', category: 'Eyelid', severity: true, icdCode: 'H02.4' },
      { id: 'v7', label: 'Myopia', category: 'Refractive', severity: true, icdCode: 'H52.1' },
      { id: 'v8', label: 'Hyperopia/Astigmatism', category: 'Refractive', severity: true, icdCode: 'H52.0' },
      { id: 'v9', label: 'Amblyopia', category: 'Visual Acuity', severity: true, icdCode: 'H53.0' },
    ]
  },
  vitals: {
    moduleType: 'vitals',
    chips: [
      { id: 'vt1', label: 'Tachycardia', category: 'Heart Rate', icdCode: 'R00.0' },
      { id: 'vt2', label: 'Bradycardia', category: 'Heart Rate', icdCode: 'R00.1' },
      { id: 'vt3', label: 'Irregular Rhythm', category: 'Rhythm', icdCode: 'R00.8' },
    ]
  },
  respiratory: {
    moduleType: 'respiratory',
    chips: [
      { id: 'r1', label: 'Wheeze', category: 'Sounds', severity: true, icdCode: 'R06.2' },
      { id: 'r2', label: 'Stridor', category: 'Sounds', severity: true, icdCode: 'R06.1' },
      { id: 'r3', label: 'Tachypnea', category: 'Rate', icdCode: 'R06.0' },
      { id: 'r4', label: 'Retractions', category: 'Effort', severity: true, icdCode: 'R06.89' },
      { id: 'r5', label: 'Grunting', category: 'Sounds', icdCode: 'R06.89' },
      { id: 'r6', label: 'Nasal Flaring', category: 'Effort', icdCode: 'R06.89' },
      { id: 'r7', label: 'Dyspnea', category: 'Effort', severity: true, icdCode: 'R06.0' },
      { id: 'r8', label: 'Dry Cough', category: 'Cough', severity: true, icdCode: 'R05.1' },
      { id: 'r9', label: 'Wet/Productive Cough', category: 'Cough', severity: true, icdCode: 'R05.0' },
      { id: 'r10', label: 'Croupy/Whooping Cough', category: 'Cough', severity: true, icdCode: 'A37' },
    ]
  },
  skin: {
    moduleType: 'skin',
    chips: [
      { id: 's1', label: 'Eczema', category: 'Inflammatory', severity: true, locationPin: true, icdCode: 'L30.9' },
      { id: 's2', label: 'Scabies', category: 'Infectious', locationPin: true, icdCode: 'B86' },
      { id: 's3', label: 'Impetigo', category: 'Infectious', severity: true, locationPin: true, icdCode: 'L01' },
      { id: 's4', label: 'Fungal Infection', category: 'Infectious', locationPin: true, icdCode: 'B36.9' },
      { id: 's5', label: 'Urticaria', category: 'Allergic', severity: true, locationPin: true, icdCode: 'L50' },
      { id: 's6', label: 'Birthmark', category: 'Congenital', locationPin: true, icdCode: 'Q82.5' },
      { id: 's7', label: 'Bruise/Contusion', category: 'Trauma', locationPin: true, icdCode: 'T14.0' },
      { id: 's8', label: 'Wound/Laceration', category: 'Trauma', severity: true, locationPin: true, icdCode: 'T14.1' },
      { id: 's9', label: 'Pigmentation Change', category: 'Other', locationPin: true, icdCode: 'L81' },
      { id: 's10', label: 'Blisters/Vesicles', category: 'Inflammatory', severity: true, locationPin: true, icdCode: 'L13.9' },
      { id: 's11', label: 'Vitiligo', category: 'Pigmentation', locationPin: true, icdCode: 'L80' },
      { id: 's12', label: 'Acne Vulgaris', category: 'Inflammatory', severity: true, locationPin: true, icdCode: 'L70.0' },
      { id: 's13', label: 'Tinea Corporis', category: 'Infectious', locationPin: true, icdCode: 'B35.4' },
      { id: 's14', label: 'Psoriasis', category: 'Inflammatory', severity: true, locationPin: true, icdCode: 'L40' },
      { id: 's15', label: 'Ichthyosis', category: 'Congenital', severity: true, locationPin: true, icdCode: 'Q80' },
      { id: 's16', label: 'Mixed Skin Infection', category: 'Infectious', severity: true, locationPin: true, icdCode: 'L08.9' },
      { id: 's17', label: 'Maculopapular Rash', category: 'Inflammatory', severity: true, locationPin: true, icdCode: 'R21' },
      { id: 's18', label: 'Petechiae/Purpura', category: 'Vascular', severity: true, locationPin: true, icdCode: 'D69.2' },
    ]
  },
  ear: {
    moduleType: 'ear',
    chips: [
      { id: 'e1', label: 'Wax Impaction', category: 'Canal', severity: true, icdCode: 'H61.2' },
      { id: 'e2', label: 'Serous Discharge', category: 'Discharge', icdCode: 'H92.1' },
      { id: 'e3', label: 'Mucopurulent Discharge', category: 'Discharge', icdCode: 'H92.1' },
      { id: 'e4', label: 'Bloody Discharge', category: 'Discharge', icdCode: 'H92.2' },
      { id: 'e5', label: 'TM Perforation', category: 'Membrane', severity: true, icdCode: 'H72' },
      { id: 'e6', label: 'Foreign Body', category: 'Canal', icdCode: 'T16' },
      { id: 'e7', label: 'Otitis Externa', category: 'Infection', severity: true, icdCode: 'H60' },
      { id: 'e8', label: 'Otitis Media', category: 'Infection', severity: true, icdCode: 'H66' },
    ]
  },
  motor: {
    moduleType: 'motor',
    chips: [
      { id: 'm1', label: 'Limp', category: 'Gait', severity: true, icdCode: 'R26.0' },
      { id: 'm2', label: 'Asymmetry', category: 'Symmetry', locationPin: true, icdCode: 'R29.8' },
      { id: 'm3', label: 'Joint Swelling', category: 'Joint', severity: true, locationPin: true, icdCode: 'M25.4' },
      { id: 'm4', label: 'Limited ROM', category: 'Joint', locationPin: true, icdCode: 'M25.6' },
      { id: 'm5', label: 'Tremor', category: 'Movement', severity: true, icdCode: 'R25.1' },
      { id: 'm6', label: 'Hypotonia', category: 'Tone', icdCode: 'P94.2' },
      { id: 'm7', label: 'Hypertonia', category: 'Tone', icdCode: 'R25.8' },
      { id: 'm8', label: 'Gross Motor Delay', category: 'Delay', severity: true, icdCode: 'F82' },
      { id: 'm9', label: 'Fine Motor Delay', category: 'Delay', severity: true, icdCode: 'F82' },
      { id: 'm10', label: 'Cerebral Palsy Signs', category: 'Disability', severity: true, icdCode: 'G80' },
      { id: 'm11', label: 'Polydactyly', category: 'Congenital', icdCode: 'Q69' },
    ]
  },
  neurodevelopment: {
    moduleType: 'neurodevelopment',
    chips: [
      { id: 'n1', label: 'Speech Delay', category: 'Language', severity: true, icdCode: 'F80' },
      { id: 'n2', label: 'Social Withdrawal', category: 'Social', severity: true, icdCode: 'F84.0' },
      { id: 'n3', label: 'Hyperactivity', category: 'Behavior', severity: true, icdCode: 'F90' },
      { id: 'n4', label: 'Attention Deficit', category: 'Cognition', severity: true, icdCode: 'F90.0' },
      { id: 'n5', label: 'Poor Eye Contact', category: 'Social', icdCode: 'F84.0' },
      { id: 'n6', label: 'Repetitive Behaviors', category: 'Behavior', icdCode: 'F84.0' },
      { id: 'n7', label: 'Cognitive Delay', category: 'Cognition', severity: true, icdCode: 'F79' },
      { id: 'n8', label: 'Adaptive Behavior Delay', category: 'Adaptive', severity: true, icdCode: 'F70' },
      { id: 'n9', label: 'ASD (Autism Spectrum)', category: 'Social', severity: true, icdCode: 'F84.0' },
      { id: 'n10', label: 'Intellectual Disability', category: 'Cognition', severity: true, icdCode: 'F79' },
      { id: 'n11', label: 'Anxiety Disorder', category: 'Mental Health', severity: true, icdCode: 'F41.9' },
      { id: 'n12', label: 'Depression', category: 'Mental Health', severity: true, icdCode: 'F32.9' },
      { id: 'n13', label: 'ODD (Oppositional Defiant)', category: 'Behavior', severity: true, icdCode: 'F91.3' },
      { id: 'n14', label: 'Conduct Disorder', category: 'Behavior', severity: true, icdCode: 'F91.9' },
      { id: 'n15', label: 'Adjustment Disorder', category: 'Mental Health', severity: true, icdCode: 'F43.2' },
      { id: 'n16', label: 'Emotional Disturbance', category: 'Mental Health', severity: true, icdCode: 'F93.9' },
      { id: 'n17', label: 'Dyslexia', category: 'Learning', severity: true, icdCode: 'F81.0' },
      { id: 'n18', label: 'Dyscalculia', category: 'Learning', severity: true, icdCode: 'F81.2' },
      { id: 'n19', label: 'Dysgraphia', category: 'Learning', severity: true, icdCode: 'F81.8' },
      { id: 'n20', label: 'Digital Dependency', category: 'Behavior', severity: true, icdCode: 'F63.0' },
    ]
  },
  general_appearance: {
    moduleType: 'general_appearance',
    chips: [
      { id: 'ga1', label: 'Well-nourished', category: 'Nutrition' },
      { id: 'ga2', label: 'Malnourished', category: 'Nutrition', severity: true, icdCode: 'E46' },
      { id: 'ga3', label: 'Pallor', category: 'Color', severity: true, icdCode: 'R23.1' },
      { id: 'ga4', label: 'Icterus/Jaundice', category: 'Color', severity: true, icdCode: 'R17' },
      { id: 'ga5', label: 'Cyanosis', category: 'Color', severity: true, icdCode: 'R23.0' },
      { id: 'ga6', label: 'Facial Edema', category: 'Edema', severity: true, icdCode: 'R60.0' },
      { id: 'ga7', label: 'Pedal Edema', category: 'Edema', severity: true, icdCode: 'R60.0' },
      { id: 'ga8', label: 'Dehydration', category: 'Hydration', severity: true, icdCode: 'E86' },
      { id: 'ga9', label: 'Poor Hygiene', category: 'General' },
      { id: 'ga10', label: 'Syndromic Features', category: 'General', icdCode: 'Q87' },
      { id: 'ga11', label: 'Lethargy', category: 'Alertness', severity: true, icdCode: 'R53' },
      { id: 'ga12', label: 'Down Syndrome Features', category: 'Congenital', icdCode: 'Q90' },
      { id: 'ga13', label: 'Hydrocephalus Signs', category: 'Congenital', severity: true, icdCode: 'Q03' },
      { id: 'ga14', label: 'SAM (Severe Acute Malnutrition)', category: 'Nutrition', severity: true, icdCode: 'E43' },
      { id: 'ga15', label: 'MAM (Moderate Acute Malnutrition)', category: 'Nutrition', severity: true, icdCode: 'E44' },
      { id: 'ga16', label: 'Micronutrient Deficiency Signs', category: 'Deficiency', severity: true, icdCode: 'E61.9' },
    ]
  },
  hair: {
    moduleType: 'hair',
    chips: [
      { id: 'h1', label: 'Pediculosis (lice/nits)', category: 'Infectious', severity: true, locationPin: true, icdCode: 'B85.0' },
      { id: 'h2', label: 'Dandruff/Seborrheic Dermatitis', category: 'Inflammatory', severity: true, icdCode: 'L21' },
      { id: 'h3', label: 'Alopecia Areata', category: 'Hair Loss', locationPin: true, icdCode: 'L63' },
      { id: 'h4', label: 'Tinea Capitis (ringworm)', category: 'Infectious', locationPin: true, icdCode: 'B35.0' },
      { id: 'h5', label: 'Folliculitis', category: 'Infectious', locationPin: true, icdCode: 'L73.9' },
      { id: 'h6', label: 'Dry/Brittle Hair', category: 'Texture', icdCode: 'L67.8' },
      { id: 'h7', label: 'Premature Graying', category: 'Color', icdCode: 'L67.1' },
      { id: 'h8', label: 'Cradle Cap', category: 'Inflammatory', icdCode: 'L21.0' },
      { id: 'h9', label: 'Psoriasis Patches', category: 'Inflammatory', locationPin: true, icdCode: 'L40' },
      { id: 'h10', label: 'Head Lice Eggs', category: 'Infectious', locationPin: true, icdCode: 'B85.0' },
    ]
  },
  eyes_external: {
    moduleType: 'eyes_external',
    chips: [
      { id: 'ee1', label: 'Esotropia (inward squint)', category: 'Alignment', severity: true, icdCode: 'H50.0' },
      { id: 'ee2', label: 'Exotropia (outward squint)', category: 'Alignment', severity: true, icdCode: 'H50.1' },
      { id: 'ee3', label: 'Ptosis', category: 'Eyelid', severity: true, icdCode: 'H02.4' },
      { id: 'ee4', label: 'Conjunctival Injection (redness)', category: 'Conjunctiva', severity: true, locationPin: true, icdCode: 'H10' },
      { id: 'ee5', label: 'Conjunctival Pallor (anemia)', category: 'Conjunctiva', severity: true, icdCode: 'D64.9' },
      { id: 'ee6', label: 'Subconjunctival Hemorrhage', category: 'Conjunctiva', locationPin: true, icdCode: 'H11.3' },
      { id: 'ee7', label: 'Stye/Chalazion', category: 'Eyelid', locationPin: true, icdCode: 'H00' },
      { id: 'ee8', label: 'Blepharitis', category: 'Eyelid', severity: true, icdCode: 'H01.0' },
      { id: 'ee9', label: 'Epiphora (tearing)', category: 'Lacrimal', icdCode: 'H04.2' },
      { id: 'ee10', label: 'Periorbital Edema', category: 'Periorbital', severity: true, icdCode: 'H05.2' },
      { id: 'ee11', label: 'Proptosis', category: 'Orbit', icdCode: 'H05.2' },
      { id: 'ee12', label: 'Nystagmus', category: 'Movement', severity: true, icdCode: 'H55' },
      { id: 'ee13', label: 'Anisocoria', category: 'Pupil', icdCode: 'H57.0' },
      { id: 'ee14', label: 'Corneal Opacity', category: 'Cornea', locationPin: true, icdCode: 'H17' },
      { id: 'ee15', label: 'Keratitis', category: 'Cornea', severity: true, icdCode: 'H16' },
      { id: 'ee16', label: 'Iris Coloboma', category: 'Congenital', icdCode: 'Q13.0' },
      { id: 'ee17', label: 'Anisometropia', category: 'Refractive', severity: true, icdCode: 'H52.3' },
    ]
  },
  nose: {
    moduleType: 'nose',
    chips: [
      { id: 'no1', label: 'Deviated Septum', category: 'Structure', severity: true, icdCode: 'J34.2' },
      { id: 'no2', label: 'Clear Discharge', category: 'Discharge', icdCode: 'J30' },
      { id: 'no3', label: 'Mucopurulent Discharge', category: 'Discharge', icdCode: 'J32' },
      { id: 'no4', label: 'Bloody Discharge', category: 'Discharge', icdCode: 'R04.0' },
      { id: 'no5', label: 'Turbinate Hypertrophy', category: 'Structure', severity: true, icdCode: 'J34.3' },
      { id: 'no6', label: 'Nasal Polyps', category: 'Structure', locationPin: true, icdCode: 'J33' },
      { id: 'no7', label: 'Vestibulitis', category: 'Infection', severity: true, icdCode: 'J34.8' },
      { id: 'no8', label: 'Crusting', category: 'Surface', icdCode: 'J34.8' },
      { id: 'no9', label: 'Epistaxis Signs', category: 'Bleeding', icdCode: 'R04.0' },
      { id: 'no10', label: 'Allergic Crease', category: 'Allergy', icdCode: 'J30.4' },
      { id: 'no11', label: 'Allergic Shiners', category: 'Allergy', icdCode: 'J30.4' },
      { id: 'no12', label: 'Nasal Flaring', category: 'Respiratory', icdCode: 'R06.89' },
    ]
  },
  dental: {
    moduleType: 'dental',
    chips: [
      { id: 'd1', label: 'Dental Caries', category: 'Teeth', severity: true, locationPin: true, icdCode: 'K02' },
      { id: 'd2', label: 'Missing Teeth', category: 'Teeth', locationPin: true, icdCode: 'K08.1' },
      { id: 'd3', label: 'Filled Teeth', category: 'Teeth', locationPin: true },
      { id: 'd4', label: 'Malocclusion', category: 'Occlusion', severity: true, icdCode: 'K07.4' },
      { id: 'd5', label: 'Gingivitis', category: 'Gums', severity: true, icdCode: 'K05.1' },
      { id: 'd6', label: 'Plaque/Calculus', category: 'Hygiene', severity: true, icdCode: 'K03.6' },
      { id: 'd7', label: 'Coated Tongue', category: 'Tongue', icdCode: 'K14.3' },
      { id: 'd8', label: 'Geographic Tongue', category: 'Tongue', icdCode: 'K14.1' },
      { id: 'd9', label: 'Oral Ulcers (aphthous)', category: 'Mucosa', severity: true, locationPin: true, icdCode: 'K12.0' },
      { id: 'd10', label: 'Candidiasis', category: 'Infection', locationPin: true, icdCode: 'B37.0' },
      { id: 'd11', label: 'Enamel Hypoplasia', category: 'Teeth', locationPin: true, icdCode: 'K00.4' },
      { id: 'd12', label: 'Fluorosis', category: 'Teeth', severity: true, icdCode: 'K00.3' },
      { id: 'd13', label: 'Crowding', category: 'Alignment', icdCode: 'K07.3' },
      { id: 'd14', label: 'Spacing', category: 'Alignment', icdCode: 'K07.3' },
      { id: 'd15', label: 'Crossbite', category: 'Occlusion', icdCode: 'K07.2' },
      { id: 'd16', label: 'Open Bite', category: 'Occlusion', icdCode: 'K07.2' },
      { id: 'd17', label: 'High Arched Palate', category: 'Palate', icdCode: 'Q38.5' },
      { id: 'd18', label: 'Cleft Lip/Palate Scar', category: 'Palate', icdCode: 'Q37' },
      { id: 'd19', label: 'Jaw Deformity', category: 'Structure', severity: true, icdCode: 'M26.9' },
      { id: 'd20', label: 'Thumb Sucking/Tongue Thrusting', category: 'Habits', icdCode: 'F98.8' },
      { id: 'd21', label: 'Ankyloglossia/Tongue Tie', category: 'Tongue', icdCode: 'Q38.1' },
    ]
  },
  throat: {
    moduleType: 'throat',
    chips: [
      { id: 't1', label: 'Tonsillar Hypertrophy Grade 1', category: 'Tonsils', icdCode: 'J35.1' },
      { id: 't2', label: 'Tonsillar Hypertrophy Grade 2', category: 'Tonsils', icdCode: 'J35.1' },
      { id: 't3', label: 'Tonsillar Hypertrophy Grade 3', category: 'Tonsils', icdCode: 'J35.1' },
      { id: 't4', label: 'Tonsillar Hypertrophy Grade 4', category: 'Tonsils', icdCode: 'J35.1' },
      { id: 't5', label: 'Pharyngeal Erythema', category: 'Pharynx', severity: true, icdCode: 'J02.9' },
      { id: 't6', label: 'Tonsillar Exudate', category: 'Tonsils', icdCode: 'J03' },
      { id: 't7', label: 'Cobblestoning', category: 'Pharynx', icdCode: 'J31.2' },
      { id: 't8', label: 'Uvula Deviation', category: 'Uvula', icdCode: 'Q38.5' },
      { id: 't9', label: 'Postnasal Drip', category: 'Pharynx', icdCode: 'R09.8' },
      { id: 't10', label: 'Peritonsillar Abscess Signs', category: 'Tonsils', icdCode: 'J36' },
      { id: 't11', label: 'Elongated Uvula', category: 'Uvula', icdCode: 'Q38.5' },
      { id: 't12', label: 'Stomatitis', category: 'Mucosa', severity: true, icdCode: 'K12' },
      { id: 't13', label: 'Glossitis', category: 'Tongue', severity: true, icdCode: 'K14.0' },
      { id: 't14', label: 'White Patches/Leukoplakia', category: 'Mucosa', locationPin: true, icdCode: 'K13.2' },
      { id: 't15', label: 'Throat Congestion', category: 'Pharynx', severity: true, icdCode: 'J31.2' },
    ]
  },
  neck: {
    moduleType: 'neck',
    chips: [
      { id: 'nk1', label: 'Goiter Grade 0 (normal)', category: 'Thyroid' },
      { id: 'nk2', label: 'Goiter Grade 1', category: 'Thyroid', icdCode: 'E04' },
      { id: 'nk3', label: 'Goiter Grade 2', category: 'Thyroid', icdCode: 'E04' },
      { id: 'nk4', label: 'Goiter Grade 3', category: 'Thyroid', icdCode: 'E04' },
      { id: 'nk5', label: 'Anterior Cervical Lymphadenopathy', category: 'Lymph', severity: true, locationPin: true, icdCode: 'R59' },
      { id: 'nk6', label: 'Posterior Cervical Lymphadenopathy', category: 'Lymph', severity: true, locationPin: true, icdCode: 'R59' },
      { id: 'nk7', label: 'Submandibular Lymphadenopathy', category: 'Lymph', severity: true, locationPin: true, icdCode: 'R59' },
      { id: 'nk8', label: 'Submental Lymphadenopathy', category: 'Lymph', severity: true, locationPin: true, icdCode: 'R59' },
      { id: 'nk9', label: 'Torticollis', category: 'Muscle', icdCode: 'M43.6' },
      { id: 'nk10', label: 'Webbed Neck', category: 'Structure', icdCode: 'Q18.3' },
      { id: 'nk11', label: 'Thyroglossal Cyst', category: 'Cyst', locationPin: true, icdCode: 'Q89.2' },
      { id: 'nk12', label: 'Branchial Cyst', category: 'Cyst', locationPin: true, icdCode: 'Q18.0' },
    ]
  },
  nails: {
    moduleType: 'nails',
    chips: [
      { id: 'na1', label: 'Clubbing', category: 'Shape', severity: true, icdCode: 'R68.3' },
      { id: 'na2', label: 'Koilonychia (spooning)', category: 'Shape', icdCode: 'L60.3' },
      { id: 'na3', label: 'Pallor (anemia)', category: 'Color', severity: true, icdCode: 'D64.9' },
      { id: 'na4', label: 'Cyanosis (blue)', category: 'Color', severity: true, icdCode: 'R23.0' },
      { id: 'na5', label: 'Splinter Hemorrhages', category: 'Vascular', locationPin: true, icdCode: 'L60.8' },
      { id: 'na6', label: 'Onychomycosis (fungal)', category: 'Infection', locationPin: true, icdCode: 'B35.1' },
      { id: 'na7', label: 'Pitting (psoriasis)', category: 'Surface', icdCode: 'L40' },
      { id: 'na8', label: "Beau's Lines", category: 'Surface', icdCode: 'L60.4' },
      { id: 'na9', label: 'Leukonychia', category: 'Color', icdCode: 'L60.8' },
      { id: 'na10', label: 'Paronychia', category: 'Infection', severity: true, locationPin: true, icdCode: 'L03.0' },
      { id: 'na11', label: 'Bitten Nails', category: 'Habit', icdCode: 'F98.8' },
      { id: 'na12', label: 'Ridging', category: 'Surface', icdCode: 'L60.8' },
      { id: 'na13', label: "Terry's Nails", category: 'Color', icdCode: 'L60.8' },
    ]
  },
  posture: {
    moduleType: 'posture',
    chips: [
      { id: 'p1', label: 'Scoliosis', category: 'Spine', severity: true, icdCode: 'M41' },
      { id: 'p2', label: 'Kyphosis', category: 'Spine', severity: true, icdCode: 'M40.0' },
      { id: 'p3', label: 'Lordosis', category: 'Spine', severity: true, icdCode: 'M40.5' },
      { id: 'p4', label: 'Uneven Shoulders', category: 'Upper Body', icdCode: 'M43.8' },
      { id: 'p5', label: 'Pelvic Tilt', category: 'Lower Body', icdCode: 'M43.8' },
      { id: 'p6', label: 'Head Tilt', category: 'Upper Body', icdCode: 'M43.6' },
      { id: 'p7', label: 'Winged Scapula', category: 'Upper Body', icdCode: 'M89.8' },
      { id: 'p8', label: 'Pes Planus (flat feet)', category: 'Feet', severity: true, icdCode: 'M21.4' },
      { id: 'p9', label: 'Pes Cavus (high arch)', category: 'Feet', severity: true, icdCode: 'Q66.7' },
      { id: 'p10', label: 'Genu Valgum (knock knees)', category: 'Knees', severity: true, icdCode: 'M21.0' },
      { id: 'p11', label: 'Genu Varum (bow legs)', category: 'Knees', severity: true, icdCode: 'M21.1' },
      { id: 'p12', label: 'Leg Length Discrepancy', category: 'Lower Body', icdCode: 'M21.7' },
      { id: 'p13', label: 'Clubfoot/Talipes', category: 'Congenital', severity: true, icdCode: 'Q66.0' },
      { id: 'p14', label: 'Spina Bifida Signs', category: 'Congenital', severity: true, icdCode: 'Q05' },
      { id: 'p15', label: 'Neural Tube Defect Signs', category: 'Congenital', severity: true, icdCode: 'Q00' },
    ]
  },
  abdomen: {
    moduleType: 'abdomen',
    chips: [
      { id: 'ab1', label: 'Distension', category: 'General', severity: true, icdCode: 'R14' },
      { id: 'ab2', label: 'Visible Veins (caput medusae)', category: 'Vascular', icdCode: 'I86.8' },
      { id: 'ab3', label: 'Umbilical Hernia', category: 'Hernia', severity: true, locationPin: true, icdCode: 'K42' },
      { id: 'ab4', label: 'Inguinal Hernia', category: 'Hernia', severity: true, locationPin: true, icdCode: 'K40' },
      { id: 'ab5', label: 'Tenderness - RUQ', category: 'Tenderness', severity: true, locationPin: true, icdCode: 'R10.1' },
      { id: 'ab6', label: 'Tenderness - LUQ', category: 'Tenderness', severity: true, locationPin: true, icdCode: 'R10.1' },
      { id: 'ab7', label: 'Tenderness - RLQ', category: 'Tenderness', severity: true, locationPin: true, icdCode: 'R10.3' },
      { id: 'ab8', label: 'Tenderness - LLQ', category: 'Tenderness', severity: true, locationPin: true, icdCode: 'R10.3' },
      { id: 'ab9', label: 'Hepatomegaly', category: 'Organ', severity: true, icdCode: 'R16.0' },
      { id: 'ab10', label: 'Splenomegaly', category: 'Organ', severity: true, icdCode: 'R16.1' },
      { id: 'ab11', label: 'Ascites', category: 'Fluid', severity: true, icdCode: 'R18' },
      { id: 'ab12', label: 'Surgical Scars', category: 'Other', locationPin: true },
      { id: 'ab13', label: 'Striae', category: 'Other', locationPin: true, icdCode: 'L90.6' },
      { id: 'ab14', label: 'Acid Reflux/GERD', category: 'GI', severity: true, icdCode: 'K21' },
      { id: 'ab15', label: 'Constipation', category: 'GI', severity: true, icdCode: 'K59.0' },
    ]
  },
  lymph: {
    moduleType: 'lymph',
    chips: [
      { id: 'ly1', label: 'Cervical Lymphadenopathy', category: 'Cervical', severity: true, icdCode: 'R59.0' },
      { id: 'ly2', label: 'Axillary Lymphadenopathy', category: 'Axillary', severity: true, icdCode: 'R59.0' },
      { id: 'ly3', label: 'Inguinal Lymphadenopathy', category: 'Inguinal', severity: true, icdCode: 'R59.0' },
      { id: 'ly4', label: 'Epitrochlear Lymphadenopathy', category: 'Upper Limb', severity: true, icdCode: 'R59.0' },
      { id: 'ly5', label: 'Matted Nodes', category: 'Quality', icdCode: 'R59.1' },
      { id: 'ly6', label: 'Fixed Nodes', category: 'Quality', icdCode: 'R59.1' },
      { id: 'ly7', label: 'Tender Nodes', category: 'Quality', icdCode: 'R59.0' },
      { id: 'ly8', label: 'Hard Nodes', category: 'Quality', icdCode: 'R59.1' },
    ]
  },
  immunization: {
    moduleType: 'immunization',
    chips: [
      { id: 'imm1', label: 'Up to Date', category: 'Status' },
      { id: 'imm2', label: 'Partially Immunized', category: 'Status', severity: true, icdCode: 'Z28.3' },
      { id: 'imm3', label: 'Not Immunized', category: 'Status', severity: true, icdCode: 'Z28.9' },
      { id: 'imm4', label: 'Immunization Delayed', category: 'Schedule', severity: true, icdCode: 'Z28.8' },
      { id: 'imm5', label: 'Contraindication Noted', category: 'Clinical', icdCode: 'Z28.0' },
      { id: 'imm6', label: 'AEFI Reported', category: 'Clinical', severity: true, icdCode: 'T50.B95' },
    ]
  },
  cardiac: {
    moduleType: 'cardiac',
    chips: [
      { id: 'ca1', label: 'Normal S1/S2', category: 'Normal' },
      { id: 'ca2', label: 'Systolic Murmur', category: 'Murmur', severity: true, icdCode: 'R01.1' },
      { id: 'ca3', label: 'Diastolic Murmur', category: 'Murmur', severity: true, icdCode: 'R01.1' },
      { id: 'ca4', label: 'Gallop (S3/S4)', category: 'Extra Sounds', severity: true, icdCode: 'R01.2' },
      { id: 'ca5', label: 'Split S2', category: 'Extra Sounds', icdCode: 'R01.2' },
      { id: 'ca6', label: 'Arrhythmia', category: 'Rhythm', severity: true, icdCode: 'I49.9' },
      { id: 'ca7', label: 'Pericardial Rub', category: 'Extra Sounds', severity: true, icdCode: 'I31.9' },
    ]
  },
  pulmonary: {
    moduleType: 'pulmonary',
    chips: [
      { id: 'pu1', label: 'Normal Vesicular', category: 'Normal' },
      { id: 'pu2', label: 'Wheeze', category: 'Adventitious', severity: true, icdCode: 'R06.2' },
      { id: 'pu3', label: 'Rhonchi', category: 'Adventitious', severity: true, icdCode: 'R09.89' },
      { id: 'pu4', label: 'Fine Crackles', category: 'Adventitious', severity: true, icdCode: 'R09.89' },
      { id: 'pu5', label: 'Coarse Crackles', category: 'Adventitious', severity: true, icdCode: 'R09.89' },
      { id: 'pu6', label: 'Stridor', category: 'Adventitious', severity: true, icdCode: 'R06.1' },
      { id: 'pu7', label: 'Diminished Breath Sounds', category: 'Intensity', severity: true, icdCode: 'R09.89' },
      { id: 'pu8', label: 'Pleural Rub', category: 'Adventitious', severity: true, icdCode: 'R09.89' },
    ]
  },
  hearing: {
    moduleType: 'hearing',
    chips: [
      { id: 'hr1', label: 'Normal Hearing', category: 'Classification' },
      { id: 'hr2', label: 'Slight Loss', category: 'Classification', severity: true, icdCode: 'H91.9' },
      { id: 'hr3', label: 'Mild Loss', category: 'Classification', severity: true, icdCode: 'H90' },
      { id: 'hr4', label: 'Moderate Loss', category: 'Classification', severity: true, icdCode: 'H90' },
      { id: 'hr5', label: 'Severe Loss', category: 'Classification', severity: true, icdCode: 'H90' },
      { id: 'hr6', label: 'Conductive Pattern', category: 'Pattern', icdCode: 'H90.0' },
      { id: 'hr7', label: 'Sensorineural Pattern', category: 'Pattern', icdCode: 'H90.3' },
      { id: 'hr8', label: 'Asymmetric Loss', category: 'Pattern', icdCode: 'H90.8' },
      { id: 'hr9', label: 'High-Frequency Loss', category: 'Pattern', icdCode: 'H91.8' },
      { id: 'hr10', label: 'Low-Frequency Loss', category: 'Pattern', icdCode: 'H91.8' },
    ]
  },
  muac: {
    moduleType: 'muac',
    chips: [
      { id: 'muac1', label: 'SAM (Red <115mm)', category: 'Classification', severity: true, icdCode: 'E43' },
      { id: 'muac2', label: 'MAM (Yellow 115-125mm)', category: 'Classification', severity: true, icdCode: 'E44' },
      { id: 'muac3', label: 'Normal (Green >125mm)', category: 'Classification', icdCode: 'Z00.1' },
      { id: 'muac4', label: 'Bilateral Pitting Edema', category: 'Clinical', severity: true, icdCode: 'E43' },
    ]
  },
}

// Helper: get annotation config for a module, merging custom chips from settings
export function getAnnotationConfig(moduleType: string, customChips?: AnnotationChipConfig[], hiddenChipIds?: string[]): AnnotationChipConfig[] {
  const config = MODULE_ANNOTATION_CONFIGS[moduleType]
  if (!config) return customChips || []

  let chips = [...config.chips]

  // Remove hidden chips
  if (hiddenChipIds && hiddenChipIds.length > 0) {
    chips = chips.filter(c => !hiddenChipIds.includes(c.id))
  }

  // Add custom chips
  if (customChips && customChips.length > 0) {
    chips = [...chips, ...customChips]
  }

  return chips
}
