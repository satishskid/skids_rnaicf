/**
 * AI Gateway Worker Route — Proxies LLM requests through Cloudflare AI Gateway.
 * Logs usage to ai_usage table for cost tracking and observability.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

export const aiGatewayRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** POST /api/ai/analyze — Route LLM request through Cloudflare AI Gateway */
aiGatewayRoutes.post('/analyze', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const startTime = Date.now()

  const body = await c.req.json<{
    model: string
    messages: Array<{ role: string; content: string }>
    max_tokens?: number
    temperature?: number
    provider?: string
  }>()

  // For now, proxy to the configured cloud gateway
  // In production, this would route through Cloudflare AI Gateway binding
  const latencyMs = Date.now() - startTime

  // Log usage
  try {
    await db.execute({
      sql: `INSERT INTO ai_usage (user_id, model, provider, tokens_input, tokens_output, latency_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [
        userId || 'anonymous',
        body.model,
        body.provider || 'cloud',
        0, // Will be populated from actual response
        0,
        latencyMs,
      ],
    })
  } catch {
    // Don't fail the request if logging fails
  }

  return c.json({
    message: 'AI Gateway route placeholder — configure Cloudflare AI binding to enable.',
    model: body.model,
    provider: body.provider || 'cloud',
    latencyMs,
  })
})

/** POST /api/ai/vision — Analyze a clinical image via Gemini Flash */
aiGatewayRoutes.post('/vision', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const startTime = Date.now()

  const body = await c.req.json<{
    image: string  // base64 image data
    moduleType: string
    moduleName: string
    childAge?: string
    nurseChips?: string[]
    chipSeverities?: Record<string, string>
    availableChipIds?: string[]
  }>()

  if (!body.image) {
    return c.json({ error: 'No image provided' }, 400)
  }

  // Try env secret first, then fall back to DB-stored key from admin UI
  let apiKey = c.env.GEMINI_API_KEY
  if (!apiKey) {
    try {
      const orgResult = await db.execute(
        `SELECT config_json FROM ai_config LIMIT 1`
      )
      if (orgResult.rows.length > 0) {
        const config = JSON.parse(orgResult.rows[0].config_json as string)
        if (config.geminiApiKey) {
          apiKey = config.geminiApiKey
        }
      }
    } catch {
      // ai_config table may not exist yet — continue without key
    }
  }

  // Build the clinical vision prompt
  const systemPrompt = `You are a pediatric screening AI assistant analyzing clinical images from school health screenings in India.

Analyze the provided ${body.moduleName} screening image and identify clinically relevant findings.

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

  let userContent = `Analyze this ${body.moduleName} (${body.moduleType}) screening image.`
  if (body.childAge) userContent += ` Patient age: ${body.childAge}.`
  if (body.nurseChips?.length) {
    const chips = body.nurseChips.map(chip =>
      body.chipSeverities?.[chip] && body.chipSeverities[chip] !== 'normal'
        ? `${chip} (${body.chipSeverities[chip]})`
        : chip
    )
    userContent += `\n\nNurse findings: ${chips.join(', ')}. Confirm or suggest corrections.`
  }
  if (body.availableChipIds?.length) {
    userContent += `\n\nAvailable chip IDs to map findings to: ${body.availableChipIds.slice(0, 30).join(', ')}`
  }

  try {
    // ═══ TRY 1: Cloudflare Workers AI (FREE, no API key needed) ═══
    let responseText = ''
    let provider = 'workers-ai'
    let tokensIn = 0
    let tokensOut = 0

    try {
      const ai = c.env.AI
      if (ai) {
        const cfResult = await ai.run('@cf/meta/llama-3.2-11b-vision-instruct', {
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userContent },
                { type: 'image', image: body.image.replace(/^data:image\/\w+;base64,/, '') },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0.3,
        }) as { response?: string }

        if (cfResult?.response) {
          responseText = cfResult.response
          provider = 'workers-ai/llama-3.2-11b-vision'
        }
      }
    } catch (cfErr) {
      console.warn('Workers AI failed, trying Gemini:', cfErr)
    }

    // ═══ TRY 2: Gemini Flash (needs API key) ═══
    if (!responseText && apiKey) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
      const geminiBody = {
        contents: [{
          parts: [
            { text: `${systemPrompt}\n\n${userContent}` },
            { inline_data: { mime_type: 'image/jpeg', data: body.image.replace(/^data:image\/\w+;base64,/, '') } }
          ]
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: 'application/json' }
      }

      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      })

      if (res.ok) {
        const data = await res.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
        }
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        tokensIn = data.usageMetadata?.promptTokenCount || 0
        tokensOut = data.usageMetadata?.candidatesTokenCount || 0
        provider = 'gemini-2.0-flash'
      }
    }

    // ═══ TRY 3: Groq (needs API key, fast inference) ═══
    if (!responseText) {
      let groqApiKey = ''
      try {
        const orgResult = await db.execute(`SELECT config_json FROM ai_config LIMIT 1`)
        if (orgResult.rows.length > 0) {
          const config = JSON.parse(orgResult.rows[0].config_json as string)
          if (config.groqApiKey) groqApiKey = config.groqApiKey
        }
      } catch { /* skip */ }

      if (groqApiKey) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.2-90b-vision-preview',
              messages: [
                { role: 'system', content: systemPrompt },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: userContent },
                    { type: 'image_url', image_url: { url: body.image.startsWith('data:') ? body.image : `data:image/jpeg;base64,${body.image}` } },
                  ],
                },
              ],
              max_tokens: 1024,
              temperature: 0.3,
              response_format: { type: 'json_object' },
            }),
          })

          if (groqRes.ok) {
            const groqData = await groqRes.json() as {
              choices?: Array<{ message?: { content?: string } }>
              usage?: { prompt_tokens?: number; completion_tokens?: number }
            }
            responseText = groqData.choices?.[0]?.message?.content || ''
            tokensIn = groqData.usage?.prompt_tokens || 0
            tokensOut = groqData.usage?.completion_tokens || 0
            provider = 'groq/llama-3.2-90b-vision'
          }
        } catch (groqErr) {
          console.warn('Groq failed:', groqErr)
        }
      }
    }

    if (!responseText) {
      return c.json({
        error: 'All AI providers failed',
        fallback: true,
        result: {
          riskLevel: 'normal',
          findings: [],
          urgentFlags: [],
          summary: 'AI analysis temporarily unavailable — please annotate manually.',
        }
      }, 200)
    }

    const latencyMs = Date.now() - startTime

    // Parse the response
    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      // Try extracting JSON from markdown code blocks
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) {
        result = JSON.parse(match[1].trim())
      } else {
        result = {
          riskLevel: 'normal',
          findings: [],
          urgentFlags: [],
          summary: responseText.slice(0, 200) || 'Could not parse AI response',
        }
      }
    }

    // Log usage
    try {
      await db.execute({
        sql: `INSERT INTO ai_usage (user_id, model, provider, tokens_input, tokens_output, latency_ms, created_at)
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [userId || 'anonymous', provider, provider.startsWith('workers') ? 'cloudflare' : 'google', tokensIn, tokensOut, latencyMs],
      })
    } catch { /* don't fail request if logging fails */ }

    return c.json({
      result,
      provider,
      latencyMs,
      tokensUsed: tokensIn + tokensOut,
    })
  } catch (err) {
    const latencyMs = Date.now() - startTime
    console.error('Vision analysis error:', err)
    return c.json({
      error: err instanceof Error ? err.message : 'Vision analysis failed',
      fallback: true,
      result: {
        riskLevel: 'normal',
        findings: [],
        urgentFlags: [],
        summary: 'AI analysis failed — please annotate manually.',
      },
      latencyMs,
    }, 200)
  }
})

/** GET /api/ai/usage — Get AI usage stats (admin only) */
aiGatewayRoutes.get('/usage', async (c) => {
  const db = c.get('db')

  try {
    const result = await db.execute(`
      SELECT
        model,
        provider,
        COUNT(*) as request_count,
        SUM(tokens_input + tokens_output) as total_tokens,
        AVG(latency_ms) as avg_latency_ms,
        MAX(created_at) as last_used
      FROM ai_usage
      GROUP BY model, provider
      ORDER BY request_count DESC
    `)

    return c.json({ usage: result.rows })
  } catch {
    // Table might not exist yet
    return c.json({ usage: [], note: 'ai_usage table not yet created' })
  }
})
