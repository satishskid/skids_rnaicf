/**
 * AWS API Proxy Route — CORS proxy for AWS API Gateway endpoints.
 * SSRF protection: only allows *.execute-api.*.amazonaws.com/* domains.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'

const ALLOWED_PATTERNS = [
  /^https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com\//,
]

export const awsProxyRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

awsProxyRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      url?: string
      method?: string
      body?: unknown
    }>()

    const { url: targetUrl, method: httpMethod, body: requestBody } = body

    if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
      return c.json({ error: 'Invalid URL — must be HTTPS' }, 400)
    }

    // SSRF protection
    if (!ALLOWED_PATTERNS.some((p) => p.test(targetUrl))) {
      return c.json({ error: 'URL not allowed' }, 403)
    }

    const res = await fetch(targetUrl, {
      method: httpMethod || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(requestBody ? { body: JSON.stringify(requestBody) } : {}),
    })

    const data = await res.json().catch(() => null)
    return c.json({ success: true, data, status: res.status })
  } catch (err) {
    console.error('AWS proxy error:', err)
    return c.json({ error: 'Proxy request failed' }, 500)
  }
})
