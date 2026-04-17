/**
 * Phase 07 — Doctor Inbox context panel.
 *
 * One collapsible block per observation. On expand it calls the unified
 * GET /api/reviews/:observationId/context endpoint (evidence + similar
 * cases in parallel) and renders both panels. Also exposes the Phase 06
 * RequestSecondOpinionButton so a doctor can kick off a re-analysis
 * without leaving the inbox.
 *
 * Fetch is lazy — one /context round-trip per observation the doctor
 * actively opens. Large inboxes stay fast because nothing loads up front.
 */

import { useCallback, useEffect, useState } from 'react'
import { apiCall } from '../lib/api'
import { RequestSecondOpinionButton } from './SecondOpinionBadge'

interface ContextResponse {
  observationId: string
  query: string
  evidence: Array<{
    id: string
    score: number
    title: string | null
    category: string | null
    module_type: string | null
    text_preview: string | null
    source: string | null
  }>
  similarCases: Array<{
    id: string
    score: number
    moduleType?: string | null
    summaryText?: string | null
  }>
}

export function ObservationContextPanel({ observationId }: { observationId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ContextResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiCall<ContextResponse>(`/api/reviews/${observationId}/context`)
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message.slice(0, 200) : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [observationId])

  useEffect(() => {
    if (open && !data && !loading) load()
  }, [open, data, loading, load])

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
      >
        <span className="flex items-center gap-2">
          <span>{open ? '▾' : '▸'}</span>
          Context (evidence + similar cases)
        </span>
        <RequestSecondOpinionButton observationId={observationId} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200 p-3">
          {loading && <p className="text-[11px] text-slate-500">Loading context…</p>}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          {data && (
            <>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Evidence ({data.evidence.length})
                </p>
                {data.evidence.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No evidence hits — index may be disabled.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.evidence.map((e) => (
                      <li key={e.id} className="rounded border border-slate-200 bg-white p-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-800">
                            {e.title ?? e.id}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {Math.round(e.score * 100)}%
                          </span>
                        </div>
                        {e.text_preview && (
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                            {e.text_preview}
                          </p>
                        )}
                        <p className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-400">
                          {e.category}{e.module_type ? ` · ${e.module_type}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Similar cases ({data.similarCases.length})
                </p>
                {data.similarCases.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No similar cases yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.similarCases.map((s) => (
                      <li key={s.id} className="rounded border border-slate-200 bg-white p-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-mono text-slate-700">{s.id}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {Math.round(s.score * 100)}%
                          </span>
                        </div>
                        {s.moduleType && (
                          <p className="text-[10px] uppercase tracking-wide text-slate-400">
                            {s.moduleType}
                          </p>
                        )}
                        {s.summaryText && (
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                            {s.summaryText}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
