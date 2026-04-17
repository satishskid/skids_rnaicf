/**
 * Phase 04 — Canonical analytics tiles (Q1–Q5) for the Population Health page.
 *
 * One file, one shared wrapper, five tiles. Every tile:
 *   - lazy-loads its query via useAnalyticsQuery on mount
 *   - renders loading / empty / error / ready states uniformly
 *   - degrades gracefully when the analytics service binding is missing
 *     or the query returns zero rows (common until campaigns have data)
 *
 * The underlying `/api/analytics/run` endpoint executes Turso-native SQL
 * today — see apps/analytics-worker/src/queries.ts. Engine is always
 * 'turso'; the legacy `'DuckDB analytics'` label has been retired so the
 * UI stops implying a runtime that's not wired.
 */

import { useEffect, useState } from 'react'
import { apiCall } from '../../lib/api'
import { BarChart3, TrendingUp, DollarSign, Timer, Gauge } from 'lucide-react'

type QueryId = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5'

interface AnalyticsRunResult<Row = Record<string, unknown>> {
  queryId: string
  columns: string[]
  rows: Row[]
  ms: number
  engine: string
}

interface TileState<Row> {
  data: AnalyticsRunResult<Row> | null
  error: string | null
  loading: boolean
}

function useAnalyticsQuery<Row>(queryId: QueryId, params: Record<string, unknown>): TileState<Row> {
  const [state, setState] = useState<TileState<Row>>({ data: null, error: null, loading: true })
  // Stringify params so effect deps are stable; params are small + serialisable.
  const paramsKey = JSON.stringify(params)
  useEffect(() => {
    let cancelled = false
    setState({ data: null, error: null, loading: true })
    apiCall('/api/analytics/run', {
      method: 'POST',
      body: JSON.stringify({ queryId, params: JSON.parse(paramsKey) }),
    })
      .then((res) => {
        if (cancelled) return
        setState({ data: res as AnalyticsRunResult<Row>, error: null, loading: false })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          data: null,
          error: err instanceof Error ? err.message : 'analytics unavailable',
          loading: false,
        })
      })
    return () => { cancelled = true }
  }, [queryId, paramsKey])
  return state
}

// ── Shared wrapper ───────────────────────────────────────────────────

function AnalyticsTile({
  title,
  subtitle,
  icon,
  state,
  empty,
  children,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  state: TileState<unknown>
  empty: boolean
  children: React.ReactNode
}) {
  const featureOff =
    state.error?.includes('feature_disabled') ||
    state.error?.includes('service_binding_missing') ||
    false

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-gray-900">
            {icon}
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
          {state.data ? `${state.data.ms}ms · ${state.data.engine}` : 'analytics'}
        </span>
      </div>

      {state.loading ? (
        <p className="mt-4 text-xs text-gray-400">Loading…</p>
      ) : featureOff ? (
        <p className="mt-3 text-xs text-gray-500">
          Analytics pipeline disabled. Flip
          <code className="mx-1 rounded bg-gray-100 px-1">FEATURE_DUCKDB_ANALYTICS=1</code>
          and redeploy.
        </p>
      ) : state.error ? (
        <p className="mt-3 text-xs text-rose-600">Could not load: {state.error}</p>
      ) : empty ? (
        <p className="mt-3 text-xs text-gray-500">No data yet for this window.</p>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </div>
  )
}

// ── Q1 — Chip-vs-AI agreement heatmap ─────────────────────────────────

interface Q1Row {
  module_type: string
  age_months_band: string | null
  total: number
  disagreements: number
  agreement_ratio: number
}

export function Q1AgreementTile() {
  const state = useAnalyticsQuery<Q1Row>('Q1', { campaign_code: null, days_back: 30 })
  const rows = state.data?.rows ?? []
  const empty = rows.length === 0

  return (
    <AnalyticsTile
      title="AI ↔ Clinician Agreement"
      subtitle="Q1 · per module × age band, last 30 days"
      icon={<Gauge className="h-5 w-5 text-emerald-600" />}
      state={state}
      empty={empty}
    >
      <div className="space-y-1.5">
        {rows.slice(0, 12).map((r, i) => {
          const pct = Math.round(r.agreement_ratio * 100)
          const tone =
            r.agreement_ratio >= 0.9
              ? 'bg-emerald-500'
              : r.agreement_ratio >= 0.75
                ? 'bg-amber-500'
                : 'bg-rose-500'
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-xs font-medium text-gray-700">
                {r.module_type.replace(/_/g, ' ')}
                <span className="ml-1 text-gray-400">· {r.age_months_band ?? 'all'}</span>
              </div>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="w-24 text-right text-xs text-gray-500">
                {pct}% <span className="text-gray-400">({r.total})</span>
              </div>
            </div>
          )
        })}
      </div>
    </AnalyticsTile>
  )
}

// ── Q2 — Daily AI spend by provider × module ──────────────────────────

interface Q2Row {
  day: string
  provider: string
  module_type: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd_sum: number
  avg_latency_ms: number
  cached_hits: number
}

export function Q2SpendTile() {
  const state = useAnalyticsQuery<Q2Row>('Q2', { days_back: 7 })
  const rows = state.data?.rows ?? []
  const empty = rows.length === 0

  // Roll up by provider for the headline number.
  const byProvider = new Map<string, { calls: number; cost: number; cached: number }>()
  for (const r of rows) {
    const entry = byProvider.get(r.provider) ?? { calls: 0, cost: 0, cached: 0 }
    entry.calls += r.calls
    entry.cost += r.cost_usd_sum
    entry.cached += r.cached_hits
    byProvider.set(r.provider, entry)
  }
  const totalCost = [...byProvider.values()].reduce((sum, p) => sum + p.cost, 0)
  const totalCalls = [...byProvider.values()].reduce((sum, p) => sum + p.calls, 0)

  return (
    <AnalyticsTile
      title="AI Spend by Provider"
      subtitle="Q2 · last 7 days"
      icon={<DollarSign className="h-5 w-5 text-indigo-600" />}
      state={state}
      empty={empty}
    >
      <div className="mb-3 flex items-baseline gap-4">
        <div>
          <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">total spend</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-700">{totalCalls.toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">calls</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {[...byProvider.entries()]
          .sort((a, b) => b[1].cost - a[1].cost)
          .slice(0, 6)
          .map(([provider, entry]) => {
            const pct = totalCost > 0 ? (entry.cost / totalCost) * 100 : 0
            return (
              <div key={provider} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-xs font-medium text-gray-700">{provider}</div>
                <div className="flex-1">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="w-28 text-right text-xs text-gray-500">
                  ${entry.cost.toFixed(2)} <span className="text-gray-400">({entry.calls})</span>
                </div>
              </div>
            )
          })}
      </div>
    </AnalyticsTile>
  )
}

// ── Q3 — Red-flag prevalence (migrated from inline) ──────────────────

interface Q3Row {
  campaign_code: string
  module_type: string
  age_months_band: string
  gender: string
  total: number
  red_flags: number
  red_flag_rate: number
}

export function Q3RedFlagTile() {
  const state = useAnalyticsQuery<Q3Row>('Q3', { campaign_code: null })
  const top = [...(state.data?.rows ?? [])]
    .filter((r) => r.total >= 10)
    .sort((a, b) => b.red_flag_rate - a.red_flag_rate)
    .slice(0, 12)
  const empty = top.length === 0

  return (
    <AnalyticsTile
      title="Red-Flag Prevalence"
      subtitle="Q3 · module × age × gender (min n=10)"
      icon={<BarChart3 className="h-5 w-5 text-rose-600" />}
      state={state}
      empty={empty}
    >
      <div className="space-y-1.5">
        {top.map((r, i) => {
          const pct = (r.red_flag_rate * 100).toFixed(1)
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-48 shrink-0 text-xs font-medium text-gray-700">
                {r.module_type.replace(/_/g, ' ')}
                <span className="ml-1 text-gray-400">
                  · {r.age_months_band}mo · {r.gender}
                </span>
              </div>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-rose-500"
                    style={{ width: `${Math.min(100, r.red_flag_rate * 100)}%` }}
                  />
                </div>
              </div>
              <div className="w-28 text-right text-xs text-gray-500">
                {r.red_flags}/{r.total} ({pct}%)
              </div>
            </div>
          )
        })}
      </div>
    </AnalyticsTile>
  )
}

// ── Q4 — Screener throughput ─────────────────────────────────────────

interface Q4Row {
  day: string
  campaign_code: string
  screened_by: string
  sessions: number
  total_obs: number
  avg_session_seconds: number
  max_session_seconds: number
  p95_session_seconds: number | null
  obs_per_minute: number | null
}

export function Q4ThroughputTile() {
  const state = useAnalyticsQuery<Q4Row>('Q4', { campaign_code: null, days_back: 7 })
  const rows = state.data?.rows ?? []
  const empty = rows.length === 0

  // Aggregate by screener (drop day dimension for the tile).
  const byScreener = new Map<string, { sessions: number; obs: number; avgSec: number }>()
  for (const r of rows) {
    const entry = byScreener.get(r.screened_by) ?? { sessions: 0, obs: 0, avgSec: 0 }
    entry.sessions += r.sessions
    entry.obs += r.total_obs
    entry.avgSec = (entry.avgSec * (entry.sessions - r.sessions) + r.avg_session_seconds * r.sessions) /
      Math.max(1, entry.sessions)
    byScreener.set(r.screened_by, entry)
  }

  return (
    <AnalyticsTile
      title="Screener Throughput"
      subtitle="Q4 · sessions + avg time, last 7 days"
      icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
      state={state}
      empty={empty}
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <th className="py-1.5">Screener</th>
            <th className="py-1.5 text-right">Sessions</th>
            <th className="py-1.5 text-right">Obs</th>
            <th className="py-1.5 text-right">Avg session</th>
            <th className="py-1.5 text-right">Obs / min</th>
          </tr>
        </thead>
        <tbody>
          {[...byScreener.entries()]
            .sort((a, b) => b[1].obs - a[1].obs)
            .slice(0, 10)
            .map(([screener, e]) => {
              const opm = e.avgSec > 0 ? (e.obs * 60) / (e.sessions * e.avgSec) : null
              return (
                <tr key={screener} className="border-b border-gray-100">
                  <td className="py-1.5 font-medium text-gray-700">{screener}</td>
                  <td className="py-1.5 text-right text-gray-600">{e.sessions}</td>
                  <td className="py-1.5 text-right text-gray-600">{e.obs}</td>
                  <td className="py-1.5 text-right text-gray-600">{Math.round(e.avgSec)}s</td>
                  <td className="py-1.5 text-right text-gray-600">
                    {opm !== null ? opm.toFixed(1) : '—'}
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </AnalyticsTile>
  )
}

// ── Q5 — Time-to-doctor-review SLA ───────────────────────────────────

interface Q5Row {
  reviewed_day: string
  decision: string
  reviews: number
  avg_minutes: number | null
  p50_minutes: number | null
  p95_minutes: number | null
  p99_minutes: number | null
}

export function Q5ReviewSlaTile() {
  const state = useAnalyticsQuery<Q5Row>('Q5', { days_back: 30 })
  const rows = state.data?.rows ?? []
  const empty = rows.length === 0

  // Aggregate by decision (worst-case p95 across the window).
  const byDecision = new Map<string, { reviews: number; p50: number; p95: number; p99: number }>()
  for (const r of rows) {
    const e = byDecision.get(r.decision) ?? { reviews: 0, p50: 0, p95: 0, p99: 0 }
    e.reviews += r.reviews
    e.p50 = Math.max(e.p50, r.p50_minutes ?? 0)
    e.p95 = Math.max(e.p95, r.p95_minutes ?? 0)
    e.p99 = Math.max(e.p99, r.p99_minutes ?? 0)
    byDecision.set(r.decision, e)
  }

  return (
    <AnalyticsTile
      title="Review SLA — Time to Decision"
      subtitle="Q5 · P50 / P95 / P99 minutes by decision, last 30 days"
      icon={<Timer className="h-5 w-5 text-purple-600" />}
      state={state}
      empty={empty}
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <th className="py-1.5">Decision</th>
            <th className="py-1.5 text-right">Reviews</th>
            <th className="py-1.5 text-right">P50 min</th>
            <th className="py-1.5 text-right">P95 min</th>
            <th className="py-1.5 text-right">P99 min</th>
          </tr>
        </thead>
        <tbody>
          {[...byDecision.entries()]
            .sort((a, b) => b[1].reviews - a[1].reviews)
            .map(([decision, e]) => (
              <tr key={decision} className="border-b border-gray-100">
                <td className="py-1.5 font-medium text-gray-700">{decision}</td>
                <td className="py-1.5 text-right text-gray-600">{e.reviews}</td>
                <td className="py-1.5 text-right text-gray-600">{formatMin(e.p50)}</td>
                <td className="py-1.5 text-right text-gray-600">{formatMin(e.p95)}</td>
                <td className="py-1.5 text-right text-gray-600">{formatMin(e.p99)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </AnalyticsTile>
  )
}

function formatMin(m: number): string {
  if (!m || m <= 0) return '—'
  if (m < 60) return `${m.toFixed(1)}m`
  const h = m / 60
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}
