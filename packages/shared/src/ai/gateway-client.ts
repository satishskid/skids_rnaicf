/**
 * Phase 2 — Cloudflare AI Gateway client.
 *
 * One AIGateway instance per request. Builds provider URLs under
 *   https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}/{provider}
 * walks a failover chain on error, and surfaces CF-AIG-* response headers
 * (cache status, cost, request id) so callers can record them.
 *
 * No SDK, no direct provider calls outside this file. No PHI logging —
 * caller is responsible for redaction before passing prompts in.
 */

export type Provider = 'gemini' | 'claude' | 'groq' | 'workers-ai'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIGatewayConfig {
  accountId: string
  gatewayId: string
  /** Per-provider API keys. 'workers-ai' uses the Workers AI binding and needs no key here. */
  keys: Partial<Record<Provider, string>>
  /** Default failover order if caller does not override. */
  failover: Provider[]
  /** Optional AI binding for workers-ai fallback. */
  aiBinding?: {
    run: (model: string, input: unknown) => Promise<unknown>
  }
  /** Injected fetch, defaults to globalThis.fetch. Used by tests. */
  fetchImpl?: typeof fetch
}

export interface GatewayResponse {
  text: string
  provider: Provider
  model: string
  cached: boolean
  latencyMs: number
  tokensIn: number
  tokensOut: number
  /** Cloudflare AI Gateway request id (cf-aig-id). */
  gatewayRequestId?: string
  /** Cost in USD reported by Gateway. 0 if unknown. */
  costUsd: number
}

export interface VisionCall {
  imageBase64: string
  prompt: string
  modelHint?: Provider
  cacheKey?: string
  /** Cache TTL seconds. Default 3600 for vision, 0 disables. */
  cacheTtl?: number
}

export interface ChatCall {
  messages: ChatMessage[]
  modelHint?: Provider
  cacheKey?: string
  cacheTtl?: number
}

const PROVIDER_SLUG: Record<Provider, string> = {
  gemini: 'google-ai-studio',
  claude: 'anthropic',
  groq: 'groq',
  'workers-ai': 'workers-ai',
}

const DEFAULT_VISION_MODEL: Record<Provider, string> = {
  gemini: 'gemini-2.0-flash',
  claude: 'claude-haiku-4-5',
  groq: 'llama-3.2-90b-vision-preview',
  'workers-ai': '@cf/meta/llama-3.2-11b-vision-instruct',
}

// Chat: Llama-3.3-70B family on both workers-ai (tier 1) and groq (tier 2).
const DEFAULT_CHAT_MODEL: Record<Provider, string> = {
  gemini: 'gemini-2.0-flash',
  claude: 'claude-haiku-4-5',
  groq: 'llama-3.3-70b-versatile',
  'workers-ai': '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
}

export class AIGatewayError extends Error {
  constructor(
    message: string,
    public readonly attempts: Array<{ provider: Provider; status?: number; error: string }>
  ) {
    super(message)
    this.name = 'AIGatewayError'
  }
}

export class AIGateway {
  private readonly fetch: typeof fetch
  constructor(private readonly cfg: AIGatewayConfig) {
    this.fetch = cfg.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  private baseUrl(provider: Provider): string {
    const slug = PROVIDER_SLUG[provider]
    return `https://gateway.ai.cloudflare.com/v1/${this.cfg.accountId}/${this.cfg.gatewayId}/${slug}`
  }

  private pickChain(hint?: Provider): Provider[] {
    if (!hint) return this.cfg.failover
    return [hint, ...this.cfg.failover.filter((p) => p !== hint)]
  }

  async chat(call: ChatCall): Promise<GatewayResponse> {
    return this.run('chat', call.modelHint, call.messages, undefined, call.cacheKey, call.cacheTtl)
  }

  async vision(call: VisionCall): Promise<GatewayResponse> {
    const messages: ChatMessage[] = [
      { role: 'user', content: call.prompt },
    ]
    return this.run('vision', call.modelHint, messages, call.imageBase64, call.cacheKey, call.cacheTtl ?? 3600)
  }

  /** Direct Workers AI call for embeddings — not via Gateway. */
  async embed(text: string): Promise<number[]> {
    if (!this.cfg.aiBinding) throw new Error('AI binding missing for embed()')
    const out = (await this.cfg.aiBinding.run('@cf/baai/bge-small-en-v1.5', {
      text: [text.slice(0, 2000)],
    })) as { data?: number[][] }
    const vec = out.data?.[0]
    if (!vec || vec.length !== 384) throw new Error('embed: bad vector length')
    return vec
  }

  private async run(
    kind: 'chat' | 'vision',
    hint: Provider | undefined,
    messages: ChatMessage[],
    imageBase64: string | undefined,
    cacheKey: string | undefined,
    cacheTtl: number | undefined
  ): Promise<GatewayResponse> {
    const chain = this.pickChain(hint)
    const attempts: Array<{ provider: Provider; status?: number; error: string }> = []

    for (const provider of chain) {
      const started = Date.now()
      try {
        const model = kind === 'vision' ? DEFAULT_VISION_MODEL[provider] : DEFAULT_CHAT_MODEL[provider]

        if (provider === 'workers-ai') {
          if (!this.cfg.aiBinding) throw new Error('workers-ai binding missing')
          const input =
            kind === 'vision'
              ? {
                  messages: [
                    {
                      role: 'user',
                      content: [
                        { type: 'text', text: messages[messages.length - 1].content },
                        { type: 'image', image: (imageBase64 ?? '').replace(/^data:image\/\w+;base64,/, '') },
                      ],
                    },
                  ],
                  max_tokens: 1024,
                  temperature: 0.3,
                }
              : {
                  messages,
                  max_tokens: 1024,
                  temperature: 0.3,
                }
          const out = (await this.cfg.aiBinding.run(model, input)) as { response?: string }
          return {
            text: out?.response ?? '',
            provider,
            model,
            cached: false,
            latencyMs: Date.now() - started,
            tokensIn: 0,
            tokensOut: 0,
            costUsd: 0,
          }
        }

        const key = this.cfg.keys[provider]
        if (!key) throw new Error(`missing api key for ${provider}`)

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        }
        if (cacheKey) headers['cf-aig-cache-key'] = cacheKey
        if (cacheTtl && cacheTtl > 0) headers['cf-aig-cache-ttl'] = String(cacheTtl)

        const { url, body } = buildProviderRequest(this.baseUrl(provider), provider, kind, model, messages, imageBase64, key)
        if (provider === 'gemini') {
          // Gemini uses API key in querystring, not Authorization header.
          delete headers.Authorization
        }

        const res = await this.fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
        if (!res.ok) {
          const errText = await safeText(res)
          attempts.push({ provider, status: res.status, error: errText.slice(0, 200) })
          continue
        }

        const data = (await res.json()) as Record<string, unknown>
        const parsed = parseProviderResponse(provider, data)
        const cached = (res.headers.get('cf-aig-cache-status') ?? '').toLowerCase() === 'hit'
        const cost = Number(res.headers.get('cf-aig-cost') ?? '0') || 0
        return {
          text: parsed.text,
          provider,
          model,
          cached,
          latencyMs: Date.now() - started,
          tokensIn: parsed.tokensIn,
          tokensOut: parsed.tokensOut,
          gatewayRequestId: res.headers.get('cf-aig-id') ?? undefined,
          costUsd: cost,
        }
      } catch (err) {
        attempts.push({ provider, error: err instanceof Error ? err.message : String(err) })
      }
    }

    throw new AIGatewayError('all providers failed', attempts)
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function buildProviderRequest(
  base: string,
  provider: Provider,
  kind: 'chat' | 'vision',
  model: string,
  messages: ChatMessage[],
  imageBase64: string | undefined,
  apiKey: string
): { url: string; body: unknown } {
  const bareImage = (imageBase64 ?? '').replace(/^data:image\/\w+;base64,/, '')

  switch (provider) {
    case 'gemini': {
      // Gemini API schema (v1beta): generateContent on a model
      const parts: Array<Record<string, unknown>> = [{ text: combineSystemAndUser(messages) }]
      if (kind === 'vision' && bareImage) {
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: bareImage } })
      }
      return {
        url: `${base}/v1beta/models/${model}:generateContent?key=${apiKey}`,
        body: {
          contents: [{ parts }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        },
      }
    }
    case 'claude': {
      const content: Array<Record<string, unknown>> = [{ type: 'text', text: combineSystemAndUser(messages) }]
      if (kind === 'vision' && bareImage) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: bareImage },
        })
      }
      return {
        url: `${base}/v1/messages`,
        body: {
          model,
          max_tokens: 1024,
          temperature: 0.3,
          messages: [{ role: 'user', content }],
        },
      }
    }
    case 'groq': {
      const openaiMessages = messages.map((m) =>
        kind === 'vision' && m.role === 'user' && bareImage
          ? {
              role: 'user',
              content: [
                { type: 'text', text: m.content },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${bareImage}` } },
              ],
            }
          : { role: m.role, content: m.content }
      )
      return {
        url: `${base}/openai/v1/chat/completions`,
        body: {
          model,
          messages: openaiMessages,
          max_tokens: 1024,
          temperature: 0.3,
          response_format: kind === 'vision' ? { type: 'json_object' } : undefined,
        },
      }
    }
    case 'workers-ai':
      throw new Error('workers-ai handled inline, not via fetch')
  }
}

function combineSystemAndUser(messages: ChatMessage[]): string {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const rest = messages.filter((m) => m.role !== 'system').map((m) => `${m.role}: ${m.content}`).join('\n\n')
  return sys ? `${sys}\n\n${rest}` : rest
}

function parseProviderResponse(
  provider: Provider,
  data: Record<string, unknown>
): { text: string; tokensIn: number; tokensOut: number } {
  switch (provider) {
    case 'gemini': {
      const candidates = (data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>) ?? []
      const text = candidates[0]?.content?.parts?.[0]?.text ?? ''
      const usage = (data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number }) ?? {}
      return { text, tokensIn: usage.promptTokenCount ?? 0, tokensOut: usage.candidatesTokenCount ?? 0 }
    }
    case 'claude': {
      const content = (data.content as Array<{ text?: string }>) ?? []
      const text = content[0]?.text ?? ''
      const usage = (data.usage as { input_tokens?: number; output_tokens?: number }) ?? {}
      return { text, tokensIn: usage.input_tokens ?? 0, tokensOut: usage.output_tokens ?? 0 }
    }
    case 'groq': {
      const choices = (data.choices as Array<{ message?: { content?: string } }>) ?? []
      const text = choices[0]?.message?.content ?? ''
      const usage = (data.usage as { prompt_tokens?: number; completion_tokens?: number }) ?? {}
      return { text, tokensIn: usage.prompt_tokens ?? 0, tokensOut: usage.completion_tokens ?? 0 }
    }
    case 'workers-ai':
      return { text: '', tokensIn: 0, tokensOut: 0 }
  }
}

/** Stable cache key builder — SHA256 hex of the stable inputs. */
export async function buildCacheKey(parts: {
  provider: Provider | 'auto'
  kind: 'chat' | 'vision'
  prompt: string
  imageSha256?: string
}): Promise<string> {
  const raw = JSON.stringify(parts)
  const buf = new TextEncoder().encode(raw)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
