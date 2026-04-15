/**
 * Phase 2 — AI Gateway routes.
 *
 * Every LLM call goes through Cloudflare AI Gateway (caching, rate limits,
 * failover, cost ledger) and emits a Langfuse trace. Provider API keys are
 * held in Worker secrets; the mobile/web clients never see them.
 *
 * Routes:
 *   POST /api/ai/analyze        → text chat (doctor review etc.)
 *   POST /api/ai/vision         → clinical image analysis
 *   GET  /api/ai/usage          → aggregated usage stats (legacy, kept for compat)
 *   GET  /api/ai/usage/today    → today's spend + breakdown (Settings tile)
 *
 * Shape of /vision response is preserved for apps/mobile/src/lib/ai/llm-gateway.ts.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import {
  AIGateway,
  AIGatewayError,
  buildCacheKey,
  Langfuse,
  type Provider,
} from '@skids/shared'

export const aiGatewayRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const VISION_SYSTEM_PROMPT = `You are a pediatric screening AI assistant analyzing clinical images from school health screenings in India.

Analyze the provided module image and identify clinically relevant findings.

RULES:
- You are a screening aid, NOT a diagnostic tool
- Flag potential concerns for the reviewing doctor
- Rate confidence honestly (0-1)
- If image quality is poor, say so
- Map findings to chipIds from the available list when possible

Respond ONLY with valid JSON:
{
  "riskLevel": "normal" | "low" | "moderate" | "high",
  "findings": [{ "label": "finding name", "chipId": "matching_chip_id", "confidence": 0.0-1.0, "reasoning": "clinical reasoning" }],
  "urgentFlags": ["any urgent concerns"],
  "summary": "1-2 sentence clinical summary"
}`

function buildGateway(c: { env: Bindings }): AIGateway {
  return new AIGateway({
    accountId: c.env.AI_GATEWAY_ACCOUNT_ID,
    gatewayId: c.env.AI_GATEWAY_ID,
    keys: {
      gemini: c.env.GEMINI_API_KEY,
      claude: c.env.ANTHROPIC_API_KEY,
      groq: c.env.GROQ_API_KEY,
    },
    // Gemini primary, Claude fallback, Workers AI as guaranteed-available last resort.
    failover: ['gemini', 'claude', 'workers-ai'],
    aiBinding: c.env.AI,
  })
}

function buildLangfuse(c: { env: Bindings }): Langfuse {
  return new Langfuse({
    publicKey: c.env.LANGFUSE_PUBLIC_KEY,
    secretKey: c.env.LANGFUSE_SECRET_KEY,
    baseUrl: c.env.LANGFUSE_BASE_URL,
  })
}

function gatewayEnabled(c: { env: Bindings }): boolean {
  const flag = c.env.FEATURE_AI_GATEWAY
  return flag !== '0' && flag !== 'false'
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface InsertUsageRow {
  campaignCode: string
  model: string
  tier: 'device' | 'laptop' | 'cloud'
  provider: string
  moduleType?: string
  userId?: string
  sessionId?: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  costUsdMicros: number
  cached: boolean
  gatewayRequestId?: string
  langfuseTraceId?: string
}

async function recordUsage(
  db: Variables['db'],
  row: InsertUsageRow
): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO ai_usage
              (id, campaign_code, model, tier, input_tokens, output_tokens,
               latency_ms, cost_usd, created_at,
               cached, gateway_request_id, langfuse_trace_id, cost_usd_micros,
               module_type, provider, user_id, session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'),
                    ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        row.campaignCode,
        row.model,
        row.tier,
        row.tokensIn,
        row.tokensOut,
        row.latencyMs,
        row.costUsdMicros / 1_000_000,
        row.cached ? 1 : 0,
        row.gatewayRequestId ?? null,
        row.langfuseTraceId ?? null,
        row.costUsdMicros,
        row.moduleType ?? null,
        row.provider,
        row.userId ?? null,
        row.sessionId ?? null,
      ],
    })
  } catch (err) {
    console.warn('[ai_usage] insert failed', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

/** POST /api/ai/analyze — text chat via AI Gateway. */
aiGatewayRoutes.post('/analyze', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const body = await c.req.json<{
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    provider?: Provider
    moduleType?: string
    sessionId?: string
    campaignCode?: string
    cacheable?: boolean
  }>()

  if (!gatewayEnabled(c)) {
    return c.json({ error: 'AI Gateway feature flag disabled' }, 503)
  }

  const gateway = buildGateway(c)
  const langfuse = buildLangfuse(c)

  const joinedPrompt = body.messages.map((m) => `${m.role}:${m.content}`).join('\n')
  const cacheKey = body.cacheable === false ? undefined : await buildCacheKey({
    provider: body.provider ?? 'auto',
    kind: 'chat',
    prompt: joinedPrompt,
  })

  const traceId = await langfuse.startTrace({
    name: 'ai.analyze',
    sessionId: body.sessionId,
    userId,
    metadata: { moduleType: body.moduleType, campaignCode: body.campaignCode },
  })

  try {
    const res = await gateway.chat({
      messages: body.messages,
      modelHint: body.provider,
      cacheKey,
      cacheTtl: body.cacheable === false ? 0 : 3600,
    })

    await langfuse.span({
      traceId,
      name: 'gateway.chat',
      input: { messages: body.messages },
      output: { text: res.text },
      model: res.model,
      provider: res.provider,
      latencyMs: res.latencyMs,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
      metadata: { cached: res.cached, gatewayRequestId: res.gatewayRequestId },
    })
    await langfuse.endTrace({ traceId, output: { text: res.text } })

    await recordUsage(db, {
      campaignCode: body.campaignCode ?? 'unknown',
      model: res.model,
      tier: 'cloud',
      provider: res.provider,
      moduleType: body.moduleType,
      userId,
      sessionId: body.sessionId,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      latencyMs: res.latencyMs,
      costUsdMicros: Math.round(res.costUsd * 1_000_000),
      cached: res.cached,
      gatewayRequestId: res.gatewayRequestId,
      langfuseTraceId: traceId,
    })

    return c.json({
      text: res.text,
      provider: res.provider,
      model: res.model,
      cached: res.cached,
      latencyMs: res.latencyMs,
      tokensUsed: res.tokensIn + res.tokensOut,
      traceId,
    })
  } catch (err) {
    const attempts = err instanceof AIGatewayError ? err.attempts : []
    await langfuse.span({
      traceId,
      name: 'gateway.chat',
      input: { messages: body.messages },
      level: 'ERROR',
      statusMessage: err instanceof Error ? err.message : 'failed',
      metadata: { attempts },
    })
    await langfuse.endTrace({ traceId, output: { error: true } })
    return c.json({ error: 'AI Gateway failed', attempts }, 502)
  }
})

/** POST /api/ai/vision — clinical image analysis via AI Gateway. */
aiGatewayRoutes.post('/vision', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const startTime = Date.now()

  const body = await c.req.json<{
    image: string
    moduleType: string
    moduleName: string
    childAge?: string
    nurseChips?: string[]
    chipSeverities?: Record<string, string>
    availableChipIds?: string[]
    sessionId?: string
    campaignCode?: string
    provider?: Provider
  }>()

  if (!body.image) return c.json({ error: 'No image provided' }, 400)
  if (!gatewayEnabled(c)) return c.json({ error: 'AI Gateway feature flag disabled' }, 503)

  let userContent = `Analyze this ${body.moduleName} (${body.moduleType}) screening image.`
  if (body.childAge) userContent += ` Patient age band: ${body.childAge}.`
  if (body.nurseChips?.length) {
    const chips = body.nurseChips.map((chip) =>
      body.chipSeverities?.[chip] && body.chipSeverities[chip] !== 'normal'
        ? `${chip} (${body.chipSeverities[chip]})`
        : chip
    )
    userContent += `\n\nNurse findings: ${chips.join(', ')}. Confirm or suggest corrections.`
  }
  if (body.availableChipIds?.length) {
    userContent += `\n\nAvailable chip IDs to map findings to: ${body.availableChipIds.slice(0, 30).join(', ')}`
  }

  const bareImage = body.image.replace(/^data:image\/\w+;base64,/, '')
  const imageSha = await sha256Hex(bareImage.slice(0, 4096))
  const cacheKey = await buildCacheKey({
    provider: body.provider ?? 'auto',
    kind: 'vision',
    prompt: `${body.moduleType}::${body.moduleName}::${body.childAge ?? ''}`,
    imageSha256: imageSha,
  })

  const gateway = buildGateway(c)
  const langfuse = buildLangfuse(c)
  const traceId = await langfuse.startTrace({
    name: 'ai.vision',
    sessionId: body.sessionId,
    userId,
    metadata: {
      moduleType: body.moduleType,
      campaignCode: body.campaignCode,
      ageBand: body.childAge,
      imageSha256: imageSha,
    },
  })

  try {
    const res = await gateway.vision({
      imageBase64: bareImage,
      prompt: `${VISION_SYSTEM_PROMPT}\n\n${userContent}`,
      modelHint: body.provider,
      cacheKey,
      cacheTtl: 3600,
    })

    let parsed: unknown
    try {
      parsed = JSON.parse(res.text)
    } catch {
      const match = res.text.match(/```(?:json)?\s*([\s\S]*?)```/)
      parsed = match
        ? JSON.parse(match[1].trim())
        : {
            riskLevel: 'normal',
            findings: [],
            urgentFlags: [],
            summary: (res.text || '').slice(0, 200) || 'Could not parse AI response',
          }
    }

    await langfuse.span({
      traceId,
      name: 'gateway.vision',
      input: { prompt: userContent, imageSha256: imageSha },
      output: parsed,
      model: res.model,
      provider: res.provider,
      latencyMs: res.latencyMs,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      costUsd: res.costUsd,
      metadata: { cached: res.cached, gatewayRequestId: res.gatewayRequestId },
    })
    await langfuse.endTrace({ traceId, output: parsed })

    await recordUsage(db, {
      campaignCode: body.campaignCode ?? 'unknown',
      model: res.model,
      tier: 'cloud',
      provider: res.provider,
      moduleType: body.moduleType,
      userId,
      sessionId: body.sessionId,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      latencyMs: res.latencyMs,
      costUsdMicros: Math.round(res.costUsd * 1_000_000),
      cached: res.cached,
      gatewayRequestId: res.gatewayRequestId,
      langfuseTraceId: traceId,
    })

    return c.json({
      result: parsed,
      provider: res.provider,
      model: res.model,
      cached: res.cached,
      latencyMs: res.latencyMs,
      tokensUsed: res.tokensIn + res.tokensOut,
      traceId,
    })
  } catch (err) {
    const attempts = err instanceof AIGatewayError ? err.attempts : []
    const latencyMs = Date.now() - startTime
    await langfuse.span({
      traceId,
      name: 'gateway.vision',
      input: { prompt: userContent, imageSha256: imageSha },
      level: 'ERROR',
      statusMessage: err instanceof Error ? err.message : 'failed',
      metadata: { attempts },
    })
    await langfuse.endTrace({ traceId, output: { error: true } })
    return c.json(
      {
        error: 'All AI providers failed',
        fallback: true,
        attempts,
        latencyMs,
        traceId,
        result: {
          riskLevel: 'normal',
          findings: [],
          urgentFlags: [],
          summary: 'AI analysis temporarily unavailable — please annotate manually.',
        },
      },
      200
    )
  }
})

/** GET /api/ai/usage — legacy aggregate (kept for compat with Admin tools). */
aiGatewayRoutes.get('/usage', async (c) => {
  const db = c.get('db')
  try {
    const result = await db.execute(`
      SELECT
        model,
        COALESCE(provider, tier) AS provider,
        COUNT(*) as request_count,
        SUM(input_tokens + output_tokens) as total_tokens,
        AVG(latency_ms) as avg_latency_ms,
        MAX(created_at) as last_used
      FROM ai_usage
      GROUP BY model, COALESCE(provider, tier)
      ORDER BY request_count DESC
    `)
    return c.json({ usage: result.rows })
  } catch {
    return c.json({ usage: [], note: 'ai_usage table not yet created' })
  }
})

/** GET /api/ai/usage/today — today's spend for Settings tile. */
aiGatewayRoutes.get('/usage/today', async (c) => {
  const db = c.get('db')
  try {
    const total = await db.execute(`
      SELECT
        COALESCE(SUM(cost_usd_micros), 0) AS total_usd_micros,
        COUNT(*) AS requests,
        SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) AS cache_hits
      FROM ai_usage
      WHERE date(created_at) = date('now')
    `)
    const byProvider = await db.execute(`
      SELECT COALESCE(provider, tier) AS provider,
             COUNT(*) AS requests,
             COALESCE(SUM(cost_usd_micros), 0) AS usd_micros
      FROM ai_usage
      WHERE date(created_at) = date('now')
      GROUP BY COALESCE(provider, tier)
    `)
    const byModule = await db.execute(`
      SELECT module_type,
             COUNT(*) AS requests,
             COALESCE(SUM(cost_usd_micros), 0) AS usd_micros
      FROM ai_usage
      WHERE date(created_at) = date('now') AND module_type IS NOT NULL
      GROUP BY module_type
    `)

    return c.json({
      totalUsdMicros: Number((total.rows[0] as Record<string, unknown> | undefined)?.total_usd_micros ?? 0),
      requests: Number((total.rows[0] as Record<string, unknown> | undefined)?.requests ?? 0),
      cacheHits: Number((total.rows[0] as Record<string, unknown> | undefined)?.cache_hits ?? 0),
      byProvider: byProvider.rows,
      byModule: byModule.rows,
    })
  } catch (err) {
    return c.json({
      totalUsdMicros: 0,
      requests: 0,
      cacheHits: 0,
      byProvider: [],
      byModule: [],
      note: err instanceof Error ? err.message : 'ai_usage query failed',
    })
  }
})
