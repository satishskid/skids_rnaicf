// AI LLM Gateway — multi-provider routing

/**
 * LLM Gateway — Multi-provider AI routing for doctor review.
 *
 * Modes (admin-configurable):
 *   - local_only:  Ollama on localhost (LFM2.5-VL-1.6B, ~800 MB)
 *   - local_first: Try Ollama, fall back to cloud
 *   - cloud_first: Try cloud, fall back to Ollama
 *   - dual:        Run both, show side-by-side
 *
 * Cloud routing via Cloudflare AI Gateway:
 *   - Gemini Flash (default, fast + cheap)
 *   - Claude 3.5 Sonnet (high quality)
 *   - GPT-4o (alternative)
 *   - Groq (fastest)
 *
 * PHI stays local by default — only anonymized observation summaries
 * (chip IDs, severity scores, risk categories) are sent to cloud.
 * Evidence images are NEVER sent to cloud unless explicitly enabled.
 */

export type AIMode = 'local_only' | 'local_first' | 'cloud_first' | 'dual'
export type CloudProvider = 'gemini' | 'claude' | 'gpt4o' | 'groq'

export interface LLMConfig {
  mode: AIMode
  ollamaUrl: string          // default: http://localhost:11434
  ollamaModel: string        // default: lfm2.5-vl-1.6b
  cloudGatewayUrl: string    // Cloudflare AI Gateway URL
  cloudProvider: CloudProvider
  cloudApiKey: string        // encrypted/stored in settings
  sendImagesToCloud: boolean  // default: false (PHI protection)
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  mode: 'local_only',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'lfm2.5-vl:1.6b',
  cloudGatewayUrl: typeof window !== 'undefined'
    ? (import.meta.env.VITE_CLOUDFLARE_AI_GATEWAY_URL || '')
    : '',
  cloudProvider: 'gemini',
  cloudApiKey: '',
  sendImagesToCloud: false,
}

// Model recommendation metadata type
export interface ModelRecommendation {
  model: string
  label: string
  size: string
  vision: boolean
  medical: boolean
  for: string
  badge: string
  category: 'medical' | 'general' | 'reasoning' | 'nurse'
}

// Local model recommendations by use case
// Includes LFM2 (Liquid AI), MedGemma (Google medical), Qwen3.5 (Alibaba edge)
export const LOCAL_MODEL_RECOMMENDATIONS: Record<string, ModelRecommendation> = {
  // ── Medical Models ──
  medgemma_4b: {
    model: 'medgemma:4b',
    label: 'MedGemma 1.5 4B',
    size: '~3.5GB',
    vision: true,
    medical: true,
    for: 'Doctor laptop (16GB RAM) — medical-trained',
    badge: 'Medical',
    category: 'medical',
  },

  // ── General Models ──
  lfm2_vl_1_6b: {
    model: 'lfm2.5-vl:1.6b',
    label: 'LFM2.5-VL-1.6B',
    size: '~800MB',
    vision: true,
    medical: false,
    for: 'Phone/Tablet (6-8GB RAM) — lightweight vision',
    badge: 'Vision',
    category: 'general',
  },
  lfm2_8b: {
    model: 'sam860/LFM2:8b',
    label: 'LFM2-8B-A1B (MoE)',
    size: '~5.9GB',
    vision: false,
    medical: false,
    for: 'Laptop (8-16GB RAM, no GPU)',
    badge: 'General',
    category: 'general',
  },
  qwen3_5_4b: {
    model: 'qwen3.5:4b',
    label: 'Qwen3.5-4B',
    size: '~3GB',
    vision: true,
    medical: false,
    for: 'Doctor laptop (8GB RAM) — edge agent',
    badge: 'Edge',
    category: 'general',
  },

  // ── Reasoning Models ──
  qwen3_5_9b: {
    model: 'qwen3.5:9b',
    label: 'Qwen3.5-9B',
    size: '~6GB',
    vision: true,
    medical: false,
    for: 'Doctor laptop (16GB RAM) — strong reasoning',
    badge: 'Reasoning',
    category: 'reasoning',
  },
  qwen3_vl_8b: {
    model: 'qwen3-vl:8b',
    label: 'Qwen3-VL-8B Thinking',
    size: '~5.5GB',
    vision: true,
    medical: false,
    for: 'Doctor laptop (16GB RAM) — step-by-step reasoning',
    badge: 'Thinking',
    category: 'reasoning',
  },
  lfm2_24b: {
    model: 'lfm2:24b',
    label: 'LFM2-24B-A2B (MoE)',
    size: '~14GB',
    vision: false,
    medical: false,
    for: 'Laptop (16-32GB RAM, GPU)',
    badge: 'Heavy',
    category: 'reasoning',
  },

  // ── Nurse-only (lightweight) ──
  lfm2_vl_450m: {
    model: 'hf.co/LiquidAI/LFM2-VL-450M-GGUF',
    label: 'LFM2-VL-450M',
    size: '~300MB',
    vision: true,
    medical: false,
    for: 'Android phone (3-4GB RAM)',
    badge: 'Tiny',
    category: 'nurse',
  },
}

// Backward-compatible alias
export const LFM2_MODEL_RECOMMENDATIONS = LOCAL_MODEL_RECOMMENDATIONS

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[] // base64 images (for vision models)
}

export interface LLMResponse {
  text: string
  provider: 'ollama' | CloudProvider
  model: string
  tokensUsed?: number
  latencyMs: number
  error?: string
}

/**
 * Build a clinical review prompt from observation data.
 * This constructs the context the LLM needs to provide a clinical opinion.
 */
export function buildClinicalPrompt(
  childName: string,
  childAge: string,
  observations: Array<{
    moduleType: string
    moduleName: string
    riskCategory: string
    summaryText: string
    nurseChips: string[]
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
      const chipDetails = obs.nurseChips.map(c => {
        const sev = obs.chipSeverities[c]
        return sev && sev !== 'normal' ? `${c} (${sev})` : c
      })
      detail += `Nurse findings: ${chipDetails.join(', ')}\n`
    }
    if (obs.aiFindings && obs.aiFindings.length > 0) {
      detail += `AI detected: ${obs.aiFindings.map(f => `${f.label} (${Math.round(f.confidence * 100)}%)`).join(', ')}\n`
    }
    if (obs.notes) detail += `Notes: ${obs.notes}\n`
    return detail
  }).join('\n')

  const userPrompt = `Review the following screening observations for ${childName} (${childAge}):

${obsDetails}

Please provide:
1. Key concerns (if any) requiring doctor attention
2. Cross-module patterns (findings that relate across modules)
3. Suggested follow-up or additional assessments
4. Any nurse-AI disagreements that need resolution`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

// ============================================
// OLLAMA LOCAL LLM
// ============================================

async function callOllama(
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const startTime = performance.now()

  try {
    const ollamaMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.images && m.images.length > 0 ? {
        images: m.images.map(img => img.replace(/^data:image\/\w+;base64,/, '')),
      } : {}),
    }))

    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: ollamaMessages,
        stream: false,
        options: { temperature: 0.3, num_predict: 1024 },
      }),
    })

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    return {
      text: data.message?.content || '',
      provider: 'ollama',
      model: config.ollamaModel,
      tokensUsed: data.eval_count,
      latencyMs: Math.round(performance.now() - startTime),
    }
  } catch (err) {
    return {
      text: '',
      provider: 'ollama',
      model: config.ollamaModel,
      latencyMs: Math.round(performance.now() - startTime),
      error: err instanceof Error ? err.message : 'Ollama connection failed',
    }
  }
}

// ============================================
// CLOUDFLARE AI GATEWAY
// ============================================

async function callCloudGateway(
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<LLMResponse> {
  const startTime = performance.now()

  if (!config.cloudGatewayUrl || !config.cloudApiKey) {
    return {
      text: '',
      provider: config.cloudProvider,
      model: config.cloudProvider,
      latencyMs: 0,
      error: 'Cloud AI not configured — set gateway URL and API key in settings.',
    }
  }

  // Strip images from cloud requests unless explicitly allowed
  const cloudMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
    ...(config.sendImagesToCloud && m.images ? { images: m.images } : {}),
  }))

  try {
    const res = await fetch(config.cloudGatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.cloudApiKey}`,
        'X-Provider': config.cloudProvider,
      },
      body: JSON.stringify({
        model: getCloudModelId(config.cloudProvider),
        messages: cloudMessages,
        max_tokens: 1024,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      throw new Error(`Cloud gateway error: ${res.status}`)
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ||
                 data.content?.[0]?.text ||
                 data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return {
      text,
      provider: config.cloudProvider,
      model: getCloudModelId(config.cloudProvider),
      tokensUsed: data.usage?.total_tokens,
      latencyMs: Math.round(performance.now() - startTime),
    }
  } catch (err) {
    return {
      text: '',
      provider: config.cloudProvider,
      model: getCloudModelId(config.cloudProvider),
      latencyMs: Math.round(performance.now() - startTime),
      error: err instanceof Error ? err.message : 'Cloud AI request failed',
    }
  }
}

function getCloudModelId(provider: CloudProvider): string {
  switch (provider) {
    case 'gemini': return 'gemini-2.0-flash'
    case 'claude': return 'claude-sonnet-4-20250514'
    case 'gpt4o': return 'gpt-4o'
    case 'groq': return 'llama-3.3-70b-versatile'
  }
}

// ============================================
// UNIFIED GATEWAY
// ============================================

/**
 * Send messages to LLM(s) based on configured mode.
 * Returns one or two responses depending on mode.
 */
export async function queryLLM(
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<LLMResponse[]> {
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
      const [local, cloud] = await Promise.all([
        callOllama(config, messages),
        callCloudGateway(config, messages),
      ])
      return [local, cloud]
    }
  }
}

/**
 * Check if Ollama is reachable and the configured model is available.
 */
export async function checkOllamaStatus(
  url: string = DEFAULT_LLM_CONFIG.ollamaUrl,
  model: string = DEFAULT_LLM_CONFIG.ollamaModel
): Promise<{ available: boolean; models: string[]; error?: string }> {
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const models = (data.models || []).map((m: { name: string }) => m.name)
    return {
      available: models.some((m: string) => m.startsWith(model.split(':')[0])),
      models,
    }
  } catch (err) {
    return {
      available: false,
      models: [],
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

// ============================================
// VISION ANALYSIS PROMPT BUILDER
// ============================================

export interface VisionAnalysisResult {
  riskLevel: 'normal' | 'low' | 'moderate' | 'high'
  findings: Array<{
    label: string
    chipId?: string
    confidence: number
    reasoning: string
  }>
  urgentFlags: string[]
  summary: string
}

/**
 * Build a multimodal vision prompt for analyzing a clinical screening photo.
 * The caller should add the base64 image to the returned user message's `images` array.
 */
export function buildVisionPrompt(
  moduleType: string,
  moduleName: string,
  childAge?: string,
  nurseChips?: string[],
  chipSeverities?: Record<string, string>,
  availableChipIds?: string[],
): LLMMessage[] {
  const systemPrompt = `You are a pediatric screening AI assistant analyzing clinical images from school health screenings.

Your task: Analyze the provided ${moduleName} screening image and identify clinically relevant findings.

IMPORTANT RULES:
- You are a screening aid, NOT a diagnostic tool
- Flag potential concerns for the reviewing doctor
- Be specific about what you observe in the image
- Rate confidence honestly (0-1 scale)
- If image quality is poor, say so
- Never fabricate findings — only report what you can see

Respond ONLY with valid JSON in this exact format:
{
  "riskLevel": "normal" | "low" | "moderate" | "high",
  "findings": [
    {
      "label": "Human-readable finding name",
      "chipId": "matching_chip_id_if_known",
      "confidence": 0.0-1.0,
      "reasoning": "Brief description of visual evidence"
    }
  ],
  "urgentFlags": ["list of urgent concerns if any"],
  "summary": "1-2 sentence overall assessment"
}`

  let userContent = `Analyze this ${moduleName} screening image.`

  if (childAge) {
    userContent += ` Patient age: ${childAge}.`
  }

  if (nurseChips && nurseChips.length > 0) {
    const chipDetails = nurseChips.map(c => {
      const sev = chipSeverities?.[c]
      return sev && sev !== 'normal' ? `${c} (${sev})` : c
    })
    userContent += `\n\nNurse has already selected these findings: ${chipDetails.join(', ')}.`
    userContent += `\nPlease confirm or suggest corrections to the nurse's assessment.`
  } else {
    userContent += `\nNo findings selected by the nurse yet. Identify any abnormalities you observe.`
  }

  if (availableChipIds && availableChipIds.length > 0) {
    userContent += `\n\nAvailable finding IDs for this module (use these for chipId when matching): ${availableChipIds.join(', ')}`
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ]
}

/**
 * Parse a vision analysis response from the LLM.
 * Handles various response formats gracefully.
 */
export function parseVisionAnalysis(responseText: string): VisionAnalysisResult | null {
  try {
    // Try to extract JSON from the response (LLMs sometimes wrap in markdown code blocks)
    let jsonStr = responseText.trim()

    // Strip markdown code fences
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    const parsed = JSON.parse(jsonStr)

    // Validate structure
    return {
      riskLevel: ['normal', 'low', 'moderate', 'high'].includes(parsed.riskLevel) ? parsed.riskLevel : 'normal',
      findings: Array.isArray(parsed.findings)
        ? parsed.findings.map((f: Record<string, unknown>) => ({
            label: String(f.label || 'Unknown'),
            chipId: f.chipId ? String(f.chipId) : undefined,
            confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.5,
            reasoning: String(f.reasoning || ''),
          }))
        : [],
      urgentFlags: Array.isArray(parsed.urgentFlags) ? parsed.urgentFlags.map(String) : [],
      summary: String(parsed.summary || 'Analysis complete'),
    }
  } catch {
    // If JSON parsing fails, try to extract key information from natural language
    const hasUrgent = /urgent|immediate|severe|emergency/i.test(responseText)
    return {
      riskLevel: hasUrgent ? 'high' : 'normal',
      findings: [],
      urgentFlags: hasUrgent ? ['AI response contained urgency markers but could not be parsed'] : [],
      summary: responseText.slice(0, 200) || 'Could not parse AI response',
    }
  }
}
