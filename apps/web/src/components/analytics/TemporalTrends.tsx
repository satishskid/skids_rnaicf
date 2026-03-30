/**
 * TemporalTrends — Shows screening trends over time with date range picker.
 * Displays weekly/monthly screening counts, risk rates, and module coverage.
 */

import { useState, useMemo } from 'react'
import { TrendingUp, Calendar, BarChart3 } from 'lucide-react'

interface ObservationRow {
  id: string
  moduleType: string
  timestamp?: string
  aiAnnotations?: Array<{ riskCategory?: string }>
}

interface TemporalTrendsProps {
  observations: ObservationRow[]
}

type Granularity = 'day' | 'week' | 'month'

function getDateKey(date: Date, granularity: Granularity): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  if (granularity === 'day') return `${y}-${m}-${d}`
  if (granularity === 'month') return `${y}-${m}`
  // Week: use ISO week start (Monday)
  const day = date.getDay() || 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - day + 1)
  return `W${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}`
}

function formatDateLabel(key: string, granularity: Granularity): string {
  if (granularity === 'day') {
    const d = new Date(key)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  if (granularity === 'month') {
    const [y, m] = key.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  }
  return key
}

export function TemporalTrends({ observations }: TemporalTrendsProps) {
  const [granularity, setGranularity] = useState<Granularity>('week')
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: '',
    to: '',
  })

  // Filter by date range and bucket by time period
  const { buckets, maxCount } = useMemo(() => {
    let filtered = observations.filter(o => o.timestamp)

    if (dateRange.from) {
      filtered = filtered.filter(o => o.timestamp! >= dateRange.from)
    }
    if (dateRange.to) {
      filtered = filtered.filter(o => o.timestamp! <= dateRange.to + 'T23:59:59')
    }

    const bucketMap: Record<string, { total: number; highRisk: number; modules: Set<string> }> = {}

    for (const obs of filtered) {
      const date = new Date(obs.timestamp!)
      const key = getDateKey(date, granularity)
      if (!bucketMap[key]) bucketMap[key] = { total: 0, highRisk: 0, modules: new Set() }
      bucketMap[key].total++
      bucketMap[key].modules.add(obs.moduleType)
      if (obs.aiAnnotations?.[0]?.riskCategory === 'high_risk') {
        bucketMap[key].highRisk++
      }
    }

    const sorted = Object.entries(bucketMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        label: formatDateLabel(key, granularity),
        key,
        ...data,
        riskRate: data.total > 0 ? (data.highRisk / data.total) * 100 : 0,
        moduleCount: data.modules.size,
      }))

    const maxCount = Math.max(1, ...sorted.map(b => b.total))
    return { buckets: sorted, maxCount }
  }, [observations, granularity, dateRange])

  if (observations.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-gray-400">
        No observations to show trends.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input
            type="date"
            value={dateRange.from}
            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['day', 'week', 'month'] as Granularity[]).map(g => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                granularity === g ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        {(dateRange.from || dateRange.to) && (
          <button
            onClick={() => setDateRange({ from: '', to: '' })}
            className="text-xs text-blue-600 hover:underline"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Bar chart */}
      {buckets.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1" style={{ minHeight: 160, minWidth: buckets.length * 40 }}>
            {buckets.map(b => (
              <div key={b.key} className="flex flex-col items-center" style={{ flex: '1 0 32px', maxWidth: 48 }}>
                {/* Bar */}
                <div className="relative w-full flex flex-col items-center" style={{ height: 120 }}>
                  {/* High risk portion */}
                  {b.highRisk > 0 && (
                    <div
                      className="w-5 rounded-t bg-red-400"
                      style={{
                        height: `${(b.highRisk / maxCount) * 100}%`,
                        position: 'absolute',
                        bottom: `${((b.total - b.highRisk) / maxCount) * 100}%`,
                      }}
                      title={`${b.highRisk} high risk`}
                    />
                  )}
                  {/* Normal portion */}
                  <div
                    className="w-5 rounded-t bg-blue-400"
                    style={{
                      height: `${((b.total - b.highRisk) / maxCount) * 100}%`,
                      position: 'absolute',
                      bottom: 0,
                    }}
                  />
                  {/* Count label */}
                  <span
                    className="absolute text-[9px] font-semibold text-gray-600"
                    style={{ bottom: `${(b.total / maxCount) * 100 + 2}%` }}
                  >
                    {b.total}
                  </span>
                </div>
                {/* Date label */}
                <span className="mt-1 text-[8px] text-gray-400 text-center leading-tight">{b.label}</span>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-blue-400" /> Screenings
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded bg-red-400" /> High Risk
            </span>
          </div>
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center text-sm text-gray-400">
          No data for selected date range.
        </div>
      )}

      {/* Summary stats */}
      {buckets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <TrendingUp className="mx-auto h-4 w-4 text-blue-500 mb-1" />
            <p className="text-lg font-bold text-gray-900">{buckets.reduce((s, b) => s + b.total, 0)}</p>
            <p className="text-[10px] text-gray-500">Total Screenings</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <BarChart3 className="mx-auto h-4 w-4 text-amber-500 mb-1" />
            <p className="text-lg font-bold text-gray-900">
              {(buckets.reduce((s, b) => s + b.riskRate, 0) / Math.max(1, buckets.length)).toFixed(1)}%
            </p>
            <p className="text-[10px] text-gray-500">Avg Risk Rate</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <Calendar className="mx-auto h-4 w-4 text-green-500 mb-1" />
            <p className="text-lg font-bold text-gray-900">{buckets.length}</p>
            <p className="text-[10px] text-gray-500">{granularity === 'day' ? 'Days' : granularity === 'week' ? 'Weeks' : 'Months'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
