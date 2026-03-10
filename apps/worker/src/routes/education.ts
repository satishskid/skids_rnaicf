/**
 * Patient Education Route — Generate parent-friendly condition explanations.
 * POST /api/education/generate — Returns educational text for conditions.
 *
 * Current: Uses static content from @skids/shared (CONDITION_PARENT_INFO).
 * Future: When Workers AI binding is enabled, will use @cf/meta/llama-3.1-8b-instruct
 *         to generate warm, empathetic, age-appropriate explanations.
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../index'
import { getConditionInfo } from '@skids/shared'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.post('/generate', async (c) => {
  const body = await c.req.json<{
    conditions: string[]
    childAge?: number
    language?: string
  }>()

  const { conditions, childAge } = body

  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return c.json({ error: 'conditions array required' }, 400)
  }

  const explanations: Record<string, {
    description: string
    intervention: string
    symptoms?: string
    warningSign?: string
    prevalence?: string
    aiGenerated: boolean
  }> = {}

  // TODO: When AI binding is enabled, use Workers AI for richer explanations:
  // const ai = c.env.AI
  // if (ai) {
  //   const prompt = `Translate these medical findings into warm, empathetic, 3-sentence
  //     explanations for a parent with an 8th-grade reading level.
  //     Child is ${childAge || 'unknown'} years old.
  //     Conditions: ${conditions.join(', ')}`
  //   const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', { prompt })
  //   // Parse and merge with static content
  // }

  // Static content from shared package
  for (const condId of conditions) {
    const info = getConditionInfo(condId)
    if (info) {
      explanations[condId] = {
        description: info.description,
        intervention: info.intervention,
        symptoms: info.symptoms,
        warningSign: info.warningSign,
        prevalence: info.prevalence,
        aiGenerated: false,
      }
    }
  }

  return c.json({ explanations, childAge })
})

export const educationRoutes = app
