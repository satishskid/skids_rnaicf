/**
 * Module-Specific Clinical Prompts for LFM2.5-VL-1.6B
 *
 * Same model, different prompts → module-specific AI output
 * Each prompt tells the model exactly what clinical signs to look for
 */

export const MODULE_AI_PROMPTS: Record<string, { label: string; prompt: string; device: string; mediapipeTasks: string[] }> = {
  dental: {
    label: 'Dental Analysis',
    device: 'phone',
    mediapipeTasks: ['face'],
    prompt: `You are a pediatric dental screening AI assistant. Examine this image of a child's teeth and oral cavity.

Look for and report on:
- Dental caries (cavities) — location, severity (early/moderate/severe)
- Plaque or calculus buildup
- Gingivitis or gum inflammation (redness, swelling)
- Missing or broken teeth
- Malocclusion (bite alignment issues)
- Oral hygiene status (good/fair/poor)

Report findings concisely. If no abnormalities, state "Normal dental examination."`
  },

  skin: {
    label: 'Skin Analysis',
    device: 'phone',
    mediapipeTasks: ['pose'],
    prompt: `You are a pediatric dermatology screening AI assistant. Examine this image of a child's skin.

Look for and report on:
- Rashes — type (macular, papular, vesicular), distribution
- Skin infections — scabies, impetigo, fungal (tinea)
- Eczema or atopic dermatitis
- Discoloration — pallor, jaundice, cyanosis, hyperpigmentation
- Lesions — size, shape, color, borders
- Bruises or wounds — pattern, healing stage
- Nutritional skin signs — dry/flaky skin, hair changes

Report findings concisely with location. If no abnormalities, state "Normal skin examination."`
  },

  motor: {
    label: 'Motor Assessment',
    device: 'tablet',
    mediapipeTasks: ['pose', 'hand'],
    prompt: `You are a pediatric motor development screening AI assistant. Observe this image/video of a child's motor activity.

Assess and report on:
- Gross motor — gait pattern, balance, coordination, symmetry
- Posture — spinal alignment, head control, trunk stability
- Muscle tone — hypertonia (stiffness) or hypotonia (floppiness)
- Movement quality — smooth vs jerky, involuntary movements
- Age-appropriate milestones — walking, running, jumping, climbing
- Limb symmetry — equal use of both sides

Report observations concisely. If age-appropriate, state "Motor development appears age-appropriate."`
  },

  neuro: {
    label: 'Neurodevelopment / ASD Screening',
    device: 'tablet',
    mediapipeTasks: ['face', 'pose', 'hand'],
    prompt: `You are a pediatric neurodevelopment screening AI assistant. Observe this image/video of a child's behavior.

Assess and report on:
- Eye contact — frequency, duration, social gaze
- Social engagement — response to others, shared attention
- Repetitive behaviors — hand flapping, spinning, lining up objects
- Communication cues — pointing, gesturing, facial expressions
- Response to name — attention shifting, awareness
- Play behavior — functional vs repetitive, imaginative play
- Sensory responses — covering ears, avoiding textures

Report observations objectively. Note: this is a screening observation, not a diagnosis.`
  },

  throat: {
    label: 'Throat Examination',
    device: 'phone',
    mediapipeTasks: ['face'],
    prompt: `You are a pediatric ENT screening AI assistant. Examine this image of a child's throat/oropharynx.

Look for and report on:
- Tonsils — size (grade 1-4), symmetry, surface (smooth vs cryptic)
- Tonsillar erythema (redness) or exudates (white patches)
- Pharyngeal wall — erythema, cobblestoning, posterior drip
- Uvula — midline or deviated
- Palate — intact, high-arched, cleft
- Overall assessment — normal, mild, moderate, or severe findings

Report findings concisely. If no abnormalities, state "Normal throat examination."`
  },

  general_appearance: {
    label: 'General Appearance',
    device: 'phone',
    mediapipeTasks: ['face', 'pose'],
    prompt: `You are a pediatric general health screening AI assistant. Assess this child's overall appearance.

Look for and report on:
- Nutritional status — well-nourished, malnourished, wasting, edema
- Growth — proportionate, short stature, macrocephaly
- Pallor — lips, conjunctiva, nail beds (suggests anemia)
- Jaundice — sclera, skin yellowing
- Cyanosis — lips, fingers (oxygen status)
- Hygiene — clean, groomed, signs of neglect
- Alertness — active, lethargic, irritable
- Dysmorphic features — facial symmetry, ear position, spacing

Report observations concisely. If child appears healthy, state "Child appears well-nourished and healthy."`
  },

  eyes_external: {
    label: 'Eyes Assessment',
    device: 'phone',
    mediapipeTasks: ['face'],
    prompt: `You are a pediatric ophthalmology screening AI assistant. Examine this image of a child's eyes.

Look for and report on:
- Alignment — strabismus (esotropia/exotropia), symmetry
- Eyelids — ptosis, swelling, discharge, crusting
- Conjunctiva — redness, pallor (anemia sign), discharge
- Cornea — clarity, opacities, Bitot spots (vitamin A deficiency)
- Pupils — size, symmetry, reactivity if visible
- Red reflex — symmetric, absent, white reflex (leukocoria)

Report findings concisely. If no abnormalities, state "Normal eye examination."`
  },

  hair: {
    label: 'Hair & Scalp',
    device: 'phone',
    mediapipeTasks: [],
    prompt: `You are a pediatric dermatology screening AI assistant. Examine this close-up image of a child's hair and scalp.

Look for and report on:
- Hair texture — brittle, sparse, flag sign (alternating light/dark bands suggesting malnutrition)
- Hair loss — alopecia areata (patchy), diffuse thinning, traction alopecia
- Scalp conditions — dandruff, seborrheic dermatitis, cradle cap
- Fungal infections — tinea capitis (ringworm), black dots, broken hairs, kerion
- Pediculosis — lice, nits (eggs on hair shafts)
- Nutritional signs — kwashiorkor (reddish discoloration), zinc deficiency (sparse dry hair)
- Scalp lesions — pustules, crusting, scaling, erythema

Report findings concisely with location. If no abnormalities, state "Normal hair and scalp examination."`
  },

  nose: {
    label: 'Nose Examination',
    device: 'phone',
    mediapipeTasks: ['face'],
    prompt: `You are a pediatric ENT screening AI assistant. Examine this image of a child's nose and nasal area.

Look for and report on:
- External appearance — shape, symmetry, swelling, deformity
- Nasal bridge — broad, depressed (dysmorphic feature), saddle nose
- Nasal discharge — clear (allergic), purulent (infection), bloody (epistaxis)
- Nasal flaring — sign of respiratory distress
- Allergic signs — allergic crease (transverse nasal crease), allergic shiners (dark circles)
- Nasal patency — mouth breathing, visible obstruction
- Vestibule — crusting, excoriation, foreign body visible
- Septum — deviation if visible

Report findings concisely. If no abnormalities, state "Normal nasal examination."`
  },

  nails: {
    label: 'Nail Examination',
    device: 'phone',
    mediapipeTasks: ['hand'],
    prompt: `You are a pediatric screening AI assistant. Examine this close-up image of a child's fingernails or toenails.

Look for and report on:
- Nail color — pallor (anemia), cyanosis (blue), yellow, white (leukonychia)
- Koilonychia — spoon-shaped nails (iron deficiency)
- Clubbing — bulbous fingertips (chronic hypoxia, cardiac/pulmonary disease)
- Nail pitting — small depressions (psoriasis, eczema, alopecia areata)
- Nail plate — ridges, splitting, brittleness, thickening
- Fungal infection — onychomycosis (discoloration, crumbling, subungual debris)
- Paronychia — infection around nail fold (redness, swelling, pus)
- Beau lines — transverse grooves (systemic illness, malnutrition)
- Nail bed — capillary refill if visible, splinter hemorrhages
- Nail biting — onychophagia (behavioral sign)

Report findings concisely. If no abnormalities, state "Normal nail examination."`
  },

  posture: {
    label: 'Posture & Spine',
    device: 'tablet',
    mediapipeTasks: ['pose'],
    prompt: `You are a pediatric orthopedic screening AI assistant. Assess this image/video of a child's posture and spinal alignment.

Look for and report on:
- Scoliosis — lateral curvature, shoulder height asymmetry, waistline asymmetry
- Kyphosis — excessive thoracic rounding (hunchback)
- Lordosis — excessive lumbar curve (swayback)
- Head tilt — torticollis, head position relative to midline
- Shoulder symmetry — level, protraction, scapular winging
- Pelvic tilt — leg length discrepancy, gait asymmetry
- Standing posture — forward head, rounded shoulders, knee alignment
- Gait observation — limping, toe-walking, in-toeing, out-toeing
- Flat feet — pes planus, arch collapse
- Knock knees (valgus) or bow legs (varus) — age-appropriate vs pathological

Report findings concisely. If no abnormalities, state "Normal posture and spinal alignment."`
  },

  abdomen: {
    label: 'Abdomen Examination',
    device: 'phone',
    mediapipeTasks: ['pose'],
    prompt: `You are a pediatric screening AI assistant. Examine this image of a child's abdomen.

Look for and report on:
- Distension — generalized or localized swelling (ascites, organomegaly, obstruction)
- Umbilicus — hernia, discharge, granuloma, hygiene
- Visible masses — organomegaly, lymphadenopathy, hernias (inguinal, umbilical)
- Skin changes — striae, visible veins (caput medusae), rashes, bruising
- Nutritional status — wasting (visible ribs, scaphoid abdomen) vs kwashiorkor (edematous distension)
- Surgical scars — previous procedures
- Visible peristalsis — abnormal intestinal movement patterns
- Symmetry — asymmetric distension suggesting organomegaly or mass

Report findings concisely. If no abnormalities, state "Normal abdominal examination."`
  },

  neck: {
    label: 'Neck & Thyroid',
    device: 'phone',
    mediapipeTasks: ['face', 'pose'],
    prompt: `You are a pediatric screening AI assistant. Examine this image of a child's neck region.

Look for and report on:
- Lymphadenopathy — visible or palpable enlarged lymph nodes, location (anterior, posterior, submandibular)
- Thyroid — visible enlargement (goiter), asymmetry, nodules
- Neck masses — midline (thyroglossal cyst) vs lateral (branchial cleft cyst, cystic hygroma)
- Torticollis — head tilt, sternocleidomastoid tightness
- Neck webbing — Turner syndrome sign, pterygium colli
- Skin changes — rashes, pigmentation, café-au-lait spots
- Range of motion — restricted movement if visible
- Trachea — midline position vs deviation
- Jugular veins — visible distension (raised venous pressure)

Report findings concisely. If no abnormalities, state "Normal neck examination."`
  },

  ear: {
    label: 'Ear Examination',
    device: 'phone',
    mediapipeTasks: ['face'],
    prompt: `You are a pediatric ENT screening AI assistant. Examine this image of a child's ear.

Look for and report on:
- External ear (pinna) — shape, size, position (low-set ears are a dysmorphic marker)
- Pre-auricular tags or pits — congenital anomalies
- Ear canal — discharge (otorrhea), wax impaction, foreign body
- Discharge character — clear (CSF), purulent (infection), bloody (trauma)
- Infection signs — redness, swelling, tenderness of pinna or periauricular area
- Mastoid area — swelling, erythema (mastoiditis)
- Microtia or anotia — congenital malformation, grading
- Skin conditions — eczema, psoriasis, seborrheic dermatitis of ear
- Tympanic membrane — if visible, perforation, retraction, effusion

Report findings concisely. If no abnormalities, state "Normal ear examination."`
  },

  respiratory: {
    label: 'Respiratory Assessment',
    device: 'tablet',
    mediapipeTasks: ['face', 'pose'],
    prompt: `You are a pediatric respiratory screening AI assistant. Observe this image/video of a child's breathing pattern and chest.

Look for and report on:
- Respiratory rate — tachypnea (fast breathing for age), bradypnea
- Breathing effort — nasal flaring, grunting, head bobbing
- Chest retractions — subcostal, intercostal, suprasternal, supraclavicular
- Chest symmetry — asymmetric expansion, barrel chest, pectus excavatum/carinatum
- Use of accessory muscles — sternocleidomastoid, abdominal breathing
- Cyanosis — perioral, central (lips, tongue), peripheral (fingers)
- Cough pattern — dry, wet/productive, barking (croup), whooping
- Stridor — inspiratory noise suggesting upper airway obstruction
- Clubbing — chronic respiratory disease sign (check fingers)
- Oxygen status — color, alertness, comfort level

Report findings concisely. If no abnormalities, state "Normal respiratory examination."`
  },
}

/**
 * Get the clinical prompt for a module type
 * Falls back to a general prompt if module not found
 */
export function getModulePrompt(moduleType: string): string {
  return MODULE_AI_PROMPTS[moduleType]?.prompt || MODULE_AI_PROMPTS.general_appearance.prompt
}

/**
 * Get display label for a module's AI analysis
 */
export function getModuleAILabel(moduleType: string): string {
  return MODULE_AI_PROMPTS[moduleType]?.label || 'AI Analysis'
}

/**
 * Get recommended device for a module
 */
export function getModuleDevice(moduleType: string): string {
  return MODULE_AI_PROMPTS[moduleType]?.device || 'phone'
}

/**
 * Check if a module supports VideoAI analysis
 * All 15 visual screening modules are supported
 */
export function moduleHasVideoAI(moduleType: string): boolean {
  return moduleType in MODULE_AI_PROMPTS
}

/**
 * Get the MediaPipe tasks required for a given module
 * Returns array of task names: 'pose', 'face', 'hand'
 */
export function getMediaPipeTasks(moduleType: string): string[] {
  return MODULE_AI_PROMPTS[moduleType]?.mediapipeTasks || []
}
