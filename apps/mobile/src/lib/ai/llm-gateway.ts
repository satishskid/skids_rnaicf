/**
 * LLM Gateway — Multi-provider AI routing for doctor review.
 *
 * Modes (configurable):
 *   - local_only:  Ollama on local network (LFM2.5-VL-1.6B, MedGemma)
 *   - local_first: Try Ollama, fall back to cloud
 *   - cloud_first: Try cloud, fall back to Ollama
 *   - dual:        Run both, show side-by-side comparison
 *
 * Cloud via Cloudflare AI Gateway: Gemini Flash, Claude Sonnet, GPT-4o, Groq
 *
 * PHI stays local — only anonymized summaries sent to cloud.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

export type AIMode = 'local_only' | 'local_first' | 'cloud_first' | 'dual'
export type CloudProvider = 'gemini' | 'claude' | 'gpt4o' | 'groq'

export interface LLMConfig {
  mode: AIMode
  ollamaUrl: string
  ollamaModel: string
  cloudGatewayUrl: string
  cloudProvider: CloudProvider
  cloudApiKey: string
  sendImagesToCloud: boolean
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  mode: 'local_first',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'lfm2.5-vl:1.6b',
  cloudGatewayUrl: 'https://skids-api.satish-9f4.workers.dev/api/ai',
  cloudProvider: 'gemini',
  cloudApiKey: '', // Not needed — worker handles API key server-side
  sendImagesToCloud: true,
}

const LLM_CONFIG_KEY = '@skids/llm-config'

export async function loadLLMConfig(): Promise<LLMConfig> {
  try {
    const raw = await AsyncStorage.getItem(LLM_CONFIG_KEY)
    if (raw) return { ...DEFAULT_LLM_CONFIG, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_LLM_CONFIG
}

export async function saveLLMConfig(config: Partial<LLMConfig>): Promise<void> {
  const current = await loadLLMConfig()
  await AsyncStorage.setItem(LLM_CONFIG_KEY, JSON.stringify({ ...current, ...config }))
}

// Local model recommendations (Ollama)
export interface ModelRecommendation {
  model: string; label: string; size: string; vision: boolean; medical: boolean
  for: string; badge: string; category: 'medical' | 'general' | 'reasoning' | 'nurse'
}

export const LOCAL_MODEL_RECOMMENDATIONS: Record<string, ModelRecommendation> = {
  medgemma_4b: { model: 'medgemma:4b', label: 'MedGemma 1.5 4B', size: '~3.5GB', vision: true, medical: true, for: 'Doctor laptop (16GB RAM)', badge: 'Medical', category: 'medical' },
  lfm2_vl_1_6b: { model: 'lfm2.5-vl:1.6b', label: 'LFM2.5-VL-1.6B', size: '~800MB', vision: true, medical: false, for: 'Phone/Tablet (6-8GB RAM)', badge: 'Vision', category: 'general' },
  lfm2_8b: { model: 'sam860/LFM2:8b', label: 'LFM2-8B-A1B (MoE)', size: '~5.9GB', vision: false, medical: false, for: 'Laptop (8-16GB RAM)', badge: 'General', category: 'general' },
  qwen3_5_4b: { model: 'qwen3.5:4b', label: 'Qwen3.5-4B', size: '~3GB', vision: true, medical: false, for: 'Doctor laptop (8GB RAM)', badge: 'Edge', category: 'general' },
  qwen3_5_9b: { model: 'qwen3.5:9b', label: 'Qwen3.5-9B', size: '~6GB', vision: true, medical: false, for: 'Doctor laptop (16GB RAM)', badge: 'Reasoning', category: 'reasoning' },
  qwen3_vl_8b: { model: 'qwen3-vl:8b', label: 'Qwen3-VL-8B Thinking', size: '~5.5GB', vision: true, medical: false, for: 'Doctor laptop (16GB RAM)', badge: 'Thinking', category: 'reasoning' },
  lfm2_24b: { model: 'lfm2:24b', label: 'LFM2-24B-A2B (MoE)', size: '~14GB', vision: false, medical: false, for: 'Laptop (16-32GB RAM, GPU)', badge: 'Heavy', category: 'reasoning' },
  lfm2_vl_450m: { model: 'hf.co/LiquidAI/LFM2-VL-450M-GGUF', label: 'LFM2-VL-450M', size: '~300MB', vision: true, medical: false, for: 'Android phone (3-4GB RAM)', badge: 'Tiny', category: 'nurse' },
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[] // base64
}

export interface LLMResponse {
  text: string
  provider: 'ollama' | CloudProvider
  model: string
  tokensUsed?: number
  latencyMs: number
  error?: string
}

// ── Clinical review prompt builder ──

export function buildClinicalPrompt(
  childName: string,
  childAge: string,
  observations: Array<{
    moduleType: string; moduleName: string; riskCategory: string
    summaryText: string; nurseChips: string[]
    chipSeverities: Record<string, string>
    aiFindings?: Array<{ label: string; confidence: number }>
    notes?: string
  }>
): LLMMessage[] {
  const systemPrompt = `You are a pediatric screening review assistant helping doctors review nurse-collected screening observations for school children.

You provide clinical context, flag potential concerns, suggest additional assessments, and help with differential diagnosis. You do NOT make diagnoses — you support the reviewing doctor's clinical judgment.

Be concise. Use bullet points. Highlight anything that needs urgent attention.`

  const obsDetails = observations.map(obs => {
    let detail = `**${obs.moduleName}** (${obs.riskCategory.replace('_', ' ')})\n`
    detail += `Summary: ${obs.summaryText}\n`
    if (obs.nurseChips.length > 0) {
      const chips = obs.nurseChips.map(c => {
        const sev = obs.chipSeverities[c]
        return sev && sev !== 'normal' ? `${c} (${sev})` : c
      })
      detail += `Nurse findings: ${chips.join(', ')}\n`
    }
    if (obs.aiFindings && obs.aiFindings.length > 0) {
      detail += `AI detected: ${obs.aiFindings.map(f => `${f.label} (${Math.round(f.confidence * 100)}%)`).join(', ')}\n`
    }
    if (obs.notes) detail += `Notes: ${obs.notes}\n`
    return detail
  }).join('\n')

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Review the following screening observations for ${childName} (${childAge}):\n\n${obsDetails}\n\nPlease provide:\n1. Key concerns requiring doctor attention\n2. Cross-module patterns\n3. Suggested follow-up or additional assessments\n4. Any nurse-AI disagreements that need resolution` },
  ]
}

// ── Vision analysis prompt builder ──

export interface VisionAnalysisResult {
  riskLevel: 'normal' | 'low' | 'moderate' | 'high'
  findings: Array<{ label: string; chipId?: string; confidence: number; reasoning: string; region?: { x: number; y: number; w: number; h: number } }>
  urgentFlags: string[]
  summary: string
}

/**
 * Modules where cloud LLM vision analysis is AVAILABLE (for doctor review).
 *
 * At nurse level, ALL modules use on-device analysis first (local AI / pixel).
 * Cloud LLM is only invoked during doctor review or when explicitly requested.
 * This ensures offline-first operation in field conditions.
 */
export const LLM_AVAILABLE_MODULES = new Set([
  'dental', 'oral',
  'ear', 'ent', 'otoscopy',
  'skin', 'derma', 'wound',
  'throat', 'mouth',
  'nose',
  'eyes_external',
  'hair',
  'nails',
  'general_appearance',
  'neck', 'abdomen',
  'vision',
])

/** @deprecated Use on-device analysis at nurse level. Cloud LLM only for doctor review. */
export function isLLMPrimaryModule(_moduleType: string): boolean {
  return false // All modules now use on-device-first at nurse level
}

/** Check if a module supports cloud LLM enhancement (for doctor review screen). */
export function isLLMAvailableModule(moduleType: string): boolean {
  const mod = moduleType.toLowerCase()
  return LLM_AVAILABLE_MODULES.has(mod) || Array.from(LLM_AVAILABLE_MODULES).some(m => mod.includes(m))
}

// ── Per-module clinical context for structured LLM prompts ──

interface ModuleClinicalContext {
  anatomy: string
  clinicalFocus: string[]
  chipTable: string // formatted chip ID → label table for LLM
  captureGuidance: string
  urgentConditions: string[]
}

const MODULE_CLINICAL_CONTEXTS: Record<string, ModuleClinicalContext> = {
  dental: {
    anatomy: 'oral cavity — teeth, gums, palate, tongue, buccal mucosa',
    clinicalFocus: [
      'Dental caries (dark spots, cavities, enamel breakdown)',
      'Gingival inflammation (red, swollen, bleeding gums)',
      'Missing or supernumerary teeth',
      'Malocclusion (crowding, spacing, crossbite)',
      'Oral mucosal lesions (ulcers, white patches, candidiasis)',
      'Enamel defects (hypoplasia, fluorosis, discoloration)',
    ],
    chipTable: `d1=Healthy teeth/gums, d2=Dental caries (K02), d3=Missing teeth (K08.1), d4=Malocclusion (K07), d5=Gingivitis (K05.1), d6=Gum bleeding (K06.8), d7=Oral ulcers (K12.1), d8=Thrush/oral candidiasis (B37.0), d9=Delayed eruption (K00.6), d10=Enamel hypoplasia (K00.4), d11=Supernumerary teeth (K00.1), d12=Dental fluorosis (K00.3), d13=Bruxism signs (F45.8), d14=Periodontal disease (K05), d15=Abscess (K12.2), d16=Lip abnormality (K13.0), d17=Cleft lip/palate (Q35-Q37), d18=High arched palate (Q38.5), d19=Tongue tie (Q38.1), d20=Geographic tongue (K14.1), d21=Ankyloglossia (Q38.1)`,
    captureGuidance: 'Intraoral photo with flashlight illumination, upper and lower teeth visible',
    urgentConditions: ['Abscess with swelling', 'Uncontrolled bleeding', 'Suspected malignancy'],
  },
  ear: {
    anatomy: 'external ear canal, tympanic membrane (TM), pinna',
    clinicalFocus: [
      'Tympanic membrane color — pearl gray (normal) vs. erythematous, bulging, retracted',
      'Middle ear effusion — air-fluid level, amber discoloration',
      'Perforation — size, location, discharge',
      'Cerumen impaction — partial vs. complete obstruction',
      'External ear canal — otitis externa signs, foreign body',
      'Laterality — always specify LEFT or RIGHT ear',
    ],
    chipTable: `e1_l=Left TM normal, e2_l=Left TM erythematous (H66.9), e3_l=Left TM bulging (H66.0), e4_l=Left TM retracted (H73.0), e5_l=Left effusion/fluid (H65.9), e6_l=Left perforation (H72), e7_l=Left wax impaction (H61.2), e8_l=Left otitis externa (H60), e9_l=Left foreign body (T16), e10_l=Left discharge (H92.1), e1_r=Right TM normal, e2_r=Right TM erythematous (H66.9), e3_r=Right TM bulging (H66.0), e4_r=Right TM retracted (H73.0), e5_r=Right effusion/fluid (H65.9), e6_r=Right perforation (H72), e7_r=Right wax impaction (H61.2), e8_r=Right otitis externa (H60), e9_r=Right foreign body (T16), e10_r=Right discharge (H92.1)`,
    captureGuidance: 'Otoscope view of tympanic membrane, or external ear photo',
    urgentConditions: ['Active bleeding', 'Suspected cholesteatoma', 'Mastoid tenderness'],
  },
  skin: {
    anatomy: 'exposed skin surfaces — face, arms, legs, trunk, scalp margins',
    clinicalFocus: [
      'Rash morphology — macular, papular, vesicular, pustular, scaly',
      'Distribution pattern — localized vs. generalized, dermatomal',
      'Infection signs — fungal (ring-shaped), bacterial (honey-crusted), parasitic (burrows)',
      'Chronic conditions — eczema (flexural), psoriasis (plaques with silvery scale)',
      'Pigmentation changes — vitiligo (depigmented), hyperpigmentation',
      'Wound assessment — granulation, slough, necrotic tissue',
    ],
    chipTable: `s1=Normal skin, s2=Rash/eruption (R21), s3=Fungal infection (B36.9), s4=Scabies (B86), s5=Impetigo (L01), s6=Eczema (L30.9), s7=Psoriasis (L40), s8=Vitiligo (L80), s9=Hyperpigmentation (L81.4), s10=Wound/laceration (T14.1), s11=Burn (T30), s12=Scar/keloid (L91), s13=Birthmark/nevus (D22), s14=Warts (B07), s15=Molluscum (B08.1), s16=Pediculosis (B85)`,
    captureGuidance: 'Close-up photo of lesion with ruler/coin for scale, good lighting',
    urgentConditions: ['Petechiae/purpura (meningococcemia)', 'Extensive burns', 'Signs of abuse'],
  },
  throat: {
    anatomy: 'oropharynx — tonsils, posterior pharyngeal wall, uvula, soft palate',
    clinicalFocus: [
      'Tonsillar size (Grade 0-4) and symmetry',
      'Exudate — white/yellow patches on tonsils (strep, mono)',
      'Pharyngeal erythema — posterior wall redness',
      'Uvula position — midline vs. deviated',
      'Peritonsillar fullness — asymmetric swelling (abscess risk)',
      'Post-nasal drip — cobblestoning of posterior pharynx',
    ],
    chipTable: `th1=Throat normal, th2=Tonsillar enlargement (J35.1), th3=Tonsillar exudate (J03.9), th4=Pharyngitis (J02.9), th5=Uvula deviation, th6=Post-nasal drip (J31.1), th7=Cobblestoning, th8=Peritonsillar swelling (J36)`,
    captureGuidance: 'Photo of open throat with tongue depressor and flashlight',
    urgentConditions: ['Peritonsillar abscess', 'Epiglottitis signs', 'Kissing tonsils (airway)'],
  },
  nose: {
    anatomy: 'nasal passages — septum, turbinates, vestibule, mucosa',
    clinicalFocus: [
      'Discharge — clear (allergic), purulent (infection), bloody',
      'Septal position — midline vs. deviated',
      'Turbinate size — normal vs. hypertrophied, pale/boggy (allergic)',
      'Polyps — smooth, glistening masses',
      'Allergic stigmata — allergic salute, Dennie-Morgan lines',
    ],
    chipTable: `no1=Nose normal, no2=Nasal discharge (R09.8), no3=Deviated septum (J34.2), no4=Turbinate hypertrophy (J34.3), no5=Nasal polyp (J33), no6=Epistaxis signs (R04.0), no7=Allergic salute (J30.9)`,
    captureGuidance: 'Photo from front showing nostrils, one per side if discharge',
    urgentConditions: ['Uncontrolled epistaxis', 'Suspected foreign body', 'Septal hematoma'],
  },
  eyes_external: {
    anatomy: 'external eye — eyelids, conjunctiva, sclera, cornea, periorbital area',
    clinicalFocus: [
      'Conjunctival color — pallor (anemia), injection (infection/allergy)',
      'Discharge — watery vs. purulent',
      'Lid position — ptosis, ectropion, lid swelling',
      'Corneal clarity — opacity, foreign body',
      'Scleral color — icterus (jaundice), injection',
      'Periorbital findings — edema, discoloration',
    ],
    chipTable: `ee1=Eyes normal, ee2=Conjunctival pallor (H10.4), ee3=Conjunctivitis (H10.9), ee4=Jaundice/icterus (R17), ee5=Ptosis (H02.4), ee6=Stye/chalazion (H00), ee7=Discharge (H10.0), ee8=Corneal opacity (H17), ee9=Periorbital edema (H05.2)`,
    captureGuidance: 'Close-up photo of both eyes open, then each eye individually',
    urgentConditions: ['Chemical exposure', 'Penetrating injury', 'Sudden vision loss'],
  },
  hair: {
    anatomy: 'scalp and hair — hair shafts, scalp skin, follicles',
    clinicalFocus: [
      'Infestations — pediculosis (lice, nits on hair shafts)',
      'Alopecia — patchy (alopecia areata) vs. diffuse (nutritional)',
      'Scalp conditions — dandruff, seborrheic dermatitis, tinea capitis',
      'Hair quality — brittle, dry, flag sign (kwashiorkor)',
    ],
    chipTable: `h1=Hair normal, h2=Pediculosis/lice (B85.0), h3=Dandruff (L21.0), h4=Alopecia (L63), h5=Tinea capitis (B35.0), h6=Seborrheic dermatitis (L21), h7=Hair pulling/trichotillomania (F63.3)`,
    captureGuidance: 'Photo of scalp with hair parted, close-up of any patches',
    urgentConditions: ['Kerion (severe tinea capitis)', 'Signs of neglect/abuse'],
  },
  nails: {
    anatomy: 'fingernails and toenails — nail bed, nail plate, cuticle, periungual tissue',
    clinicalFocus: [
      'Nail bed color — pallor (anemia), cyanosis (hypoxia)',
      'Shape — clubbing (cardiopulmonary), koilonychia/spoon nails (iron deficiency)',
      'Surface — pitting (psoriasis), ridging, Beau lines',
      'Infections — fungal (onychomycosis), paronychia',
    ],
    chipTable: `na1=Nails normal, na2=Koilonychia/spoon nails (L60.3), na3=Nail bed pallor (anemia), na4=Cyanosis, na5=Clubbing (R68.3), na6=Fungal infection (B35.1), na7=Bitten nails, na8=Brittle/ridged nails (L60.3)`,
    captureGuidance: 'Photo of both hands showing nail beds clearly',
    urgentConditions: ['Acute paronychia with abscess', 'Splinter hemorrhages (endocarditis)'],
  },
  general_appearance: {
    anatomy: 'overall nutritional and developmental status — body habitus, skin color, activity level',
    clinicalFocus: [
      'Nutritional status — well-nourished vs. wasting, stunting, obesity',
      'Skin color — pallor (anemia), jaundice (liver), cyanosis (cardiac/pulmonary)',
      'Activity level — alert and interactive vs. lethargic',
      'Edema — pedal, facial, generalized',
      'Dysmorphic features — congenital syndromes',
    ],
    chipTable: `ga1=Well-nourished, ga2=Malnourished (E46), ga3=Pallor/anemia (D64.9), ga4=Jaundice (R17), ga5=Cyanosis (R23.0), ga6=Edema (R60), ga7=Obesity (E66), ga8=Stunting (E45), ga9=Wasting (E41), ga10=Dysmorphic features (Q87), ga11=Lethargy (R53), ga12=Dehydration (E86)`,
    captureGuidance: 'Full-body photo from front, face and body proportions visible',
    urgentConditions: ['Severe dehydration', 'Respiratory distress', 'Altered consciousness'],
  },
}

// Aliases — some modules have multiple names
MODULE_CLINICAL_CONTEXTS['oral'] = MODULE_CLINICAL_CONTEXTS['dental']
MODULE_CLINICAL_CONTEXTS['ent'] = MODULE_CLINICAL_CONTEXTS['ear']
MODULE_CLINICAL_CONTEXTS['otoscopy'] = MODULE_CLINICAL_CONTEXTS['ear']
MODULE_CLINICAL_CONTEXTS['derma'] = MODULE_CLINICAL_CONTEXTS['skin']
MODULE_CLINICAL_CONTEXTS['wound'] = MODULE_CLINICAL_CONTEXTS['skin']
MODULE_CLINICAL_CONTEXTS['mouth'] = MODULE_CLINICAL_CONTEXTS['throat']
MODULE_CLINICAL_CONTEXTS['neck'] = MODULE_CLINICAL_CONTEXTS['general_appearance']
MODULE_CLINICAL_CONTEXTS['abdomen'] = MODULE_CLINICAL_CONTEXTS['general_appearance']

/**
 * Build a structured, module-specific vision prompt for LLM-primary analysis.
 *
 * Unlike the generic `buildVisionPrompt`, this provides:
 * - Exact chip IDs with labels and ICD codes so the LLM outputs valid chip references
 * - Clinical focus areas specific to the anatomy being examined
 * - Expected structured JSON output with optional bounding box regions
 * - Urgent condition flags that should trigger immediate alerts
 */
export function buildStructuredVisionPrompt(
  moduleType: string,
  moduleName: string,
  childAge?: string,
  nurseChips?: string[],
  chipSeverities?: Record<string, string>,
): LLMMessage[] {
  const mod = moduleType.toLowerCase()
  const ctx = MODULE_CLINICAL_CONTEXTS[mod]

  // Fallback to generic prompt if no clinical context exists
  if (!ctx) {
    return buildVisionPrompt(moduleType, moduleName, childAge, nurseChips, chipSeverities)
  }

  const systemPrompt = `You are a pediatric clinical screening AI analyzing a ${moduleName} image from a school health screening program in India.

ANATOMY: ${ctx.anatomy}

CLINICAL FOCUS — examine the image for:
${ctx.clinicalFocus.map((f, i) => `${i + 1}. ${f}`).join('\n')}

VALID FINDINGS — you MUST use these exact chip IDs in your response:
${ctx.chipTable}

RULES:
1. You are a SCREENING AID — flag findings for doctor review, never diagnose
2. Use ONLY the chip IDs listed above. Do not invent new IDs
3. If the image is normal, return the "normal" chip (first in the list) with high confidence
4. Rate confidence honestly: 0.3-0.5 = possible, 0.5-0.7 = likely, 0.7-0.9 = confident, 0.9+ = very clear
5. If image quality is poor (blur, dark, wrong anatomy), say so in summary and lower confidence
6. For each finding, describe WHERE in the image you see it (region as approximate % coordinates)
7. URGENT conditions requiring immediate referral: ${ctx.urgentConditions.join(', ')}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "riskLevel": "normal" | "low" | "moderate" | "high",
  "findings": [
    {
      "label": "human-readable finding description",
      "chipId": "exact chip ID from the list above",
      "confidence": 0.0-1.0,
      "severity": "normal" | "mild" | "moderate" | "severe",
      "reasoning": "what you see in the image that supports this finding",
      "region": { "x": 0.0-1.0, "y": 0.0-1.0, "w": 0.0-1.0, "h": 0.0-1.0 }
    }
  ],
  "urgentFlags": [],
  "summary": "1-2 sentence clinical summary"
}`

  let userContent = `Analyze this ${moduleName} screening image from a pediatric school health camp.`
  if (childAge) userContent += ` Child age: ${childAge}.`
  userContent += `\nCapture method: ${ctx.captureGuidance}`

  if (nurseChips?.length) {
    const chips = nurseChips.map(c => {
      const sev = chipSeverities?.[c]
      return sev && sev !== 'normal' ? `${c} (${sev})` : c
    })
    userContent += `\n\nNurse has pre-selected these findings: ${chips.join(', ')}`
    userContent += `\nPlease CONFIRM or CORRECT the nurse's assessment based on the image.`
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]
}

// Keep the generic prompt for non-clinical modules (vision/photoscreening uses its own pipeline)
export function buildVisionPrompt(
  moduleType: string, moduleName: string,
  childAge?: string, nurseChips?: string[],
  chipSeverities?: Record<string, string>, availableChipIds?: string[]
): LLMMessage[] {
  const systemPrompt = `You are a pediatric screening AI assistant analyzing clinical images from school health screenings.

Analyze the provided ${moduleName} screening image and identify clinically relevant findings.

RULES:
- You are a screening aid, NOT a diagnostic tool
- Flag potential concerns for the reviewing doctor
- Rate confidence honestly (0-1)
- If image quality is poor, say so

Respond ONLY with valid JSON:
{
  "riskLevel": "normal" | "low" | "moderate" | "high",
  "findings": [{ "label": "...", "chipId": "...", "confidence": 0.0-1.0, "reasoning": "..." }],
  "urgentFlags": ["..."],
  "summary": "..."
}`

  let content = `Analyze this ${moduleName} screening image.`
  if (childAge) content += ` Patient age: ${childAge}.`
  if (nurseChips?.length) {
    const chips = nurseChips.map(c => chipSeverities?.[c] && chipSeverities[c] !== 'normal' ? `${c} (${chipSeverities[c]})` : c)
    content += `\n\nNurse findings: ${chips.join(', ')}. Confirm or suggest corrections.`
  }
  if (availableChipIds?.length) {
    content += `\n\nAvailable chip IDs: ${availableChipIds.join(', ')}`
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ]
}

export function parseVisionAnalysis(responseText: string): VisionAnalysisResult | null {
  try {
    let jsonStr = responseText.trim()
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) jsonStr = match[1].trim()

    const parsed = JSON.parse(jsonStr)
    return {
      riskLevel: ['normal', 'low', 'moderate', 'high'].includes(parsed.riskLevel) ? parsed.riskLevel : 'normal',
      findings: Array.isArray(parsed.findings) ? parsed.findings.map((f: Record<string, unknown>) => ({
        label: String(f.label || 'Unknown'),
        chipId: f.chipId ? String(f.chipId) : undefined,
        confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.5,
        reasoning: String(f.reasoning || ''),
      })) : [],
      urgentFlags: Array.isArray(parsed.urgentFlags) ? parsed.urgentFlags.map(String) : [],
      summary: String(parsed.summary || 'Analysis complete'),
    }
  } catch {
    const hasUrgent = /urgent|immediate|severe|emergency/i.test(responseText)
    return {
      riskLevel: hasUrgent ? 'high' : 'normal',
      findings: [],
      urgentFlags: hasUrgent ? ['Urgency markers detected but response unparseable'] : [],
      summary: responseText.slice(0, 200) || 'Could not parse AI response',
    }
  }
}

// ── Ollama local LLM ──

async function callOllama(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const startTime = performance.now()
  try {
    const ollamaMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.images?.length ? { images: m.images.map(img => img.replace(/^data:image\/\w+;base64,/, '')) } : {}),
    }))

    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.ollamaModel, messages: ollamaMessages, stream: false, options: { temperature: 0.3, num_predict: 1024 } }),
    })

    if (!res.ok) throw new Error(`Ollama: ${res.status} ${res.statusText}`)
    const data = await res.json()
    return { text: data.message?.content || '', provider: 'ollama', model: config.ollamaModel, tokensUsed: data.eval_count, latencyMs: Math.round(performance.now() - startTime) }
  } catch (err) {
    return { text: '', provider: 'ollama', model: config.ollamaModel, latencyMs: Math.round(performance.now() - startTime), error: err instanceof Error ? err.message : 'Ollama connection failed' }
  }
}

// ── Cloud AI Gateway ──

function getCloudModelId(provider: CloudProvider): string {
  switch (provider) {
    case 'gemini': return 'gemini-2.0-flash'
    case 'claude': return 'claude-sonnet-4-20250514'
    case 'gpt4o': return 'gpt-4o'
    case 'groq': return 'llama-3.3-70b-versatile'
  }
}

async function callCloudGateway(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const startTime = performance.now()
  if (!config.cloudGatewayUrl) {
    return { text: '', provider: config.cloudProvider, model: config.cloudProvider, latencyMs: 0, error: 'Cloud AI not configured.' }
  }

  // Check if any message has images — use /vision endpoint
  const hasImages = config.sendImagesToCloud && messages.some(m => m.images?.length)

  if (hasImages) {
    // Use the worker's /vision endpoint which handles Gemini API key server-side
    const userMessage = messages.find(m => m.role === 'user')
    const imageBase64 = userMessage?.images?.[0] || ''

    // Extract module info from the system prompt
    const systemMessage = messages.find(m => m.role === 'system')
    const moduleMatch = systemMessage?.content?.match(/provided (.*?) screening/)
    const moduleName = moduleMatch?.[1] || 'clinical'

    try {
      const res = await fetch(`${config.cloudGatewayUrl}/vision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.cloudApiKey ? { Authorization: `Bearer ${config.cloudApiKey}` } : {}),
        },
        body: JSON.stringify({
          image: imageBase64,
          moduleType: moduleName.toLowerCase().replace(/\s+/g, '_'),
          moduleName,
        }),
      })

      if (!res.ok) throw new Error(`Cloud vision: ${res.status}`)
      const data = await res.json() as { result?: Record<string, unknown>; error?: string; latencyMs?: number; tokensUsed?: number }

      if (data.result) {
        return {
          text: JSON.stringify(data.result),
          provider: 'gemini' as const,
          model: 'gemini-2.0-flash',
          tokensUsed: data.tokensUsed as number | undefined,
          latencyMs: Math.round(performance.now() - startTime),
        }
      }

      return { text: '', provider: 'gemini' as const, model: 'gemini-2.0-flash', latencyMs: Math.round(performance.now() - startTime), error: data.error || 'Empty response' }
    } catch (err) {
      return { text: '', provider: 'gemini' as const, model: 'gemini-2.0-flash', latencyMs: Math.round(performance.now() - startTime), error: err instanceof Error ? err.message : 'Cloud vision failed' }
    }
  }

  // Standard text-only cloud request (for doctor AI summary etc.)
  const cloudMessages = messages.map(m => ({
    role: m.role, content: m.content,
  }))

  try {
    const res = await fetch(`${config.cloudGatewayUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.cloudApiKey ? { Authorization: `Bearer ${config.cloudApiKey}` } : {}),
        'X-Provider': config.cloudProvider,
      },
      body: JSON.stringify({ model: getCloudModelId(config.cloudProvider), messages: cloudMessages, max_tokens: 1024, temperature: 0.3 }),
    })

    if (!res.ok) throw new Error(`Cloud gateway: ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || data.content?.[0]?.text || data.candidates?.[0]?.content?.parts?.[0]?.text || data.result ? JSON.stringify(data.result) : ''

    return { text, provider: config.cloudProvider, model: getCloudModelId(config.cloudProvider), tokensUsed: data.usage?.total_tokens, latencyMs: Math.round(performance.now() - startTime) }
  } catch (err) {
    return { text: '', provider: config.cloudProvider, model: getCloudModelId(config.cloudProvider), latencyMs: Math.round(performance.now() - startTime), error: err instanceof Error ? err.message : 'Cloud request failed' }
  }
}

// ── Unified gateway ──

export async function queryLLM(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse[]> {
  switch (config.mode) {
    case 'local_only':
      return [await callOllama(config, messages)]
    case 'local_first': {
      const local = await callOllama(config, messages)
      if (!local.error) return [local]
      return [local, await callCloudGateway(config, messages)]
    }
    case 'cloud_first': {
      const cloud = await callCloudGateway(config, messages)
      if (!cloud.error) return [cloud]
      return [cloud, await callOllama(config, messages)]
    }
    case 'dual': {
      const [local, cloud] = await Promise.all([callOllama(config, messages), callCloudGateway(config, messages)])
      return [local, cloud]
    }
  }
}

/** Check if Ollama is reachable and model is available. */
export async function checkOllamaStatus(
  url: string = DEFAULT_LLM_CONFIG.ollamaUrl,
  model: string = DEFAULT_LLM_CONFIG.ollamaModel
): Promise<{ available: boolean; models: string[]; error?: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${url}/api/tags`, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const models = (data.models || []).map((m: { name: string }) => m.name)
    return { available: models.some((m: string) => m.startsWith(model.split(':')[0])), models }
  } catch (err) {
    return { available: false, models: [], error: err instanceof Error ? err.message : 'Connection failed' }
  }
}
