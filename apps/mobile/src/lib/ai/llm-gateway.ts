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
  mode: 'local_only',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'lfm2.5-vl:1.6b',
  cloudGatewayUrl: '',
  cloudProvider: 'gemini',
  cloudApiKey: '',
  sendImagesToCloud: false,
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
  findings: Array<{ label: string; chipId?: string; confidence: number; reasoning: string }>
  urgentFlags: string[]
  summary: string
}

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
  if (!config.cloudGatewayUrl || !config.cloudApiKey) {
    return { text: '', provider: config.cloudProvider, model: config.cloudProvider, latencyMs: 0, error: 'Cloud AI not configured.' }
  }

  const cloudMessages = messages.map(m => ({
    role: m.role, content: m.content,
    ...(config.sendImagesToCloud && m.images ? { images: m.images } : {}),
  }))

  try {
    const res = await fetch(config.cloudGatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.cloudApiKey}`, 'X-Provider': config.cloudProvider },
      body: JSON.stringify({ model: getCloudModelId(config.cloudProvider), messages: cloudMessages, max_tokens: 1024, temperature: 0.3 }),
    })

    if (!res.ok) throw new Error(`Cloud gateway: ${res.status}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || data.content?.[0]?.text || data.candidates?.[0]?.content?.parts?.[0]?.text || ''

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
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const models = (data.models || []).map((m: { name: string }) => m.name)
    return { available: models.some((m: string) => m.startsWith(model.split(':')[0])), models }
  } catch (err) {
    return { available: false, models: [], error: err instanceof Error ? err.message : 'Connection failed' }
  }
}
