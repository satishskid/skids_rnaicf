/**
 * Phase 06 — Secondary (sandbox-AI) opinion badge + request button.
 *
 * Two UI affordances in one file so the Doctor Inbox can import a single
 * component per observation:
 *   <SecondOpinionBadge /> — shows when a tier-2 analysis has landed.
 *   <RequestSecondOpinionButton /> — posts to /api/observations/:id/
 *                                    second-opinion.
 *
 * Neither component owns data fetching — callers pass the secondary
 * payload in, or handle the 202 response from the request button.
 */

import { useState } from 'react'
import { apiCall } from '../lib/api'

export interface SecondaryAnnotation {
  modelName?: string
  modelVersion?: string
  status: 'pending' | 'running' | 'ok' | 'error' | 'skipped'
  annotations?: Array<{ label?: string; confidence?: number }>
  agreementTier1?: number | null
  quality?: 'good' | 'fair' | 'poor' | null
}

export function SecondOpinionBadge({ secondary }: { secondary: SecondaryAnnotation | null | undefined }) {
  if (!secondary) return null
  const tone = toneFor(secondary.status)
  const top = secondary.annotations?.[0]
  const label = secondary.status === 'ok' && top?.label ? top.label : statusLabel(secondary.status)
  const pct = typeof top?.confidence === 'number' ? ` ${Math.round(top.confidence * 100)}%` : ''

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}
      title={`Tier 2 (${secondary.modelName ?? 'secondary'} ${secondary.modelVersion ?? ''})`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      2nd opinion: {label}{pct}
    </span>
  )
}

export function RequestSecondOpinionButton({
  observationId,
  disabled,
  onQueued,
}: {
  observationId: string
  disabled?: boolean
  onQueued?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    setLoading(true)
    try {
      await apiCall(`/api/observations/${observationId}/second-opinion`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      onQueued?.()
    } catch (err) {
      setError(err instanceof Error ? err.message.slice(0, 200) : 'request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={handleClick}
        className="inline-flex items-center gap-1 rounded-md border border-blue-500 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        {loading ? 'Queuing…' : 'Request 2nd opinion'}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  )
}

function toneFor(status: SecondaryAnnotation['status']): string {
  switch (status) {
    case 'ok': return 'border-emerald-500 bg-emerald-50 text-emerald-700'
    case 'pending':
    case 'running': return 'border-amber-500 bg-amber-50 text-amber-700'
    case 'error': return 'border-red-500 bg-red-50 text-red-700'
    case 'skipped': return 'border-slate-400 bg-slate-50 text-slate-600'
  }
}

function statusLabel(status: SecondaryAnnotation['status']): string {
  switch (status) {
    case 'pending': return 'queued'
    case 'running': return 'running'
    case 'ok': return 'done'
    case 'error': return 'failed'
    case 'skipped': return 'skipped'
  }
}
