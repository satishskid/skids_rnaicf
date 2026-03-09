import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  Megaphone,
  Activity,
  ChevronUp,
  ChevronDown,
  Check,
  BarChart3,
} from 'lucide-react'
import { StatsCard } from '../components/StatsCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useApi } from '../lib/hooks'
import { apiCall } from '../lib/api'
import {
  getModuleName,
  FOUR_D_CONDITIONS,
  FOUR_D_CATEGORY_LABELS,
  FOUR_D_CATEGORY_COLORS,
} from '@skids/shared'
import type { FourDCategory } from '@skids/shared'

// ── Types ──

interface CampaignRow {
  code: string
  name: string
  schoolName?: string
  status: string
  totalChildren?: number
}

interface CampaignsResponse {
  campaigns: CampaignRow[]
}

interface ObservationRow {
  id: string
  moduleType: string
  childId?: string
  annotationData?: { selectedChips?: string[] }
  aiAnnotations?: Array<{ riskCategory?: string }>
}

interface ChildRow {
  id: string
  name: string
}

interface CampaignAggregation {
  code: string
  name: string
  children: ChildRow[]
  observations: ObservationRow[]
}

type SortField = 'name' | 'children' | 'observations' | 'highRisk' | 'completion'
type SortDir = 'asc' | 'desc'

// ── Page ──

export function AuthorityDashboardPage() {
  const { data, isLoading: campaignsLoading } =
    useApi<CampaignsResponse>('/api/campaigns')

  const allCampaigns = useMemo(() => data?.campaigns ?? [], [data])
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set())
  const [aggregations, setAggregations] = useState<CampaignAggregation[]>([])
  const [fetching, setFetching] = useState(false)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Auto-select all active campaigns on first load
  useEffect(() => {
    if (allCampaigns.length > 0 && selectedCodes.size === 0) {
      const activeCodes = allCampaigns
        .filter((c) => c.status === 'active')
        .map((c) => c.code)
      if (activeCodes.length > 0) {
        setSelectedCodes(new Set(activeCodes))
      }
    }
  }, [allCampaigns]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch data for selected campaigns
  const fetchAggregations = useCallback(async () => {
    if (selectedCodes.size === 0) {
      setAggregations([])
      return
    }
    setFetching(true)
    try {
      const results = await Promise.all(
        Array.from(selectedCodes).map(async (code) => {
          const campaign = allCampaigns.find((c) => c.code === code)
          const [childrenRes, obsRes] = await Promise.all([
            apiCall<{ children: ChildRow[] }>(`/api/children?campaign=${code}`),
            apiCall<{ observations: ObservationRow[] }>(
              `/api/observations?campaign=${code}`,
            ),
          ])
          return {
            code,
            name: campaign?.name || campaign?.schoolName || code,
            children: childrenRes.children ?? [],
            observations: obsRes.observations ?? [],
          }
        }),
      )
      setAggregations(results)
    } catch {
      // Silently handle — partial data is still useful
    } finally {
      setFetching(false)
    }
  }, [selectedCodes, allCampaigns])

  useEffect(() => {
    fetchAggregations()
  }, [fetchAggregations])

  // Toggle campaign selection
  function toggleCampaign(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function selectAll() {
    setSelectedCodes(new Set(allCampaigns.map((c) => c.code)))
  }

  function clearAll() {
    setSelectedCodes(new Set())
  }

  // ── Aggregated metrics ──

  const allChildren = useMemo(
    () => aggregations.flatMap((a) => a.children),
    [aggregations],
  )
  const allObservations = useMemo(
    () => aggregations.flatMap((a) => a.observations),
    [aggregations],
  )
  const uniqueChildIds = useMemo(
    () => new Set(allChildren.map((c) => c.id)),
    [allChildren],
  )

  const totalScreened = uniqueChildIds.size
  const totalEnrolled = allCampaigns
    .filter((c) => selectedCodes.has(c.code))
    .reduce((sum, c) => sum + (c.totalChildren ?? 0), 0)
  const coveragePct =
    totalEnrolled > 0 ? Math.round((totalScreened / totalEnrolled) * 100) : 0

  const highRiskCount = allObservations.filter(
    (o) => o.aiAnnotations?.[0]?.riskCategory === 'high_risk',
  ).length

  const activeCampaignCount = allCampaigns.filter(
    (c) => selectedCodes.has(c.code) && c.status === 'active',
  ).length

  // ── Prevalence by 4D category ──

  const prevalenceByCategory = useMemo(() => {
    const categories: FourDCategory[] = [
      'defects',
      'delay',
      'disability',
      'deficiency',
      'behavioral',
      'immunization',
      'learning',
    ]

    // Collect all selected chips across observations
    const allChips = new Set<string>()
    for (const obs of allObservations) {
      const chips = obs.annotationData?.selectedChips ?? []
      chips.forEach((c) => allChips.add(c))
    }

    return categories.map((cat) => {
      const conditions = FOUR_D_CONDITIONS.filter((c) => c.category === cat)
      let matchCount = 0
      for (const condition of conditions) {
        if (condition.chipIds.some((cid) => allChips.has(cid))) {
          matchCount++
        }
      }
      return {
        category: cat,
        label: FOUR_D_CATEGORY_LABELS[cat],
        colors: FOUR_D_CATEGORY_COLORS[cat],
        conditionsFound: matchCount,
        totalConditions: conditions.length,
        affectedPct:
          totalScreened > 0
            ? Math.round((matchCount / totalScreened) * 100)
            : 0,
      }
    })
  }, [allObservations, totalScreened])

  // ── Risk distribution ──

  const riskDistribution = useMemo(() => {
    const counts = { no_risk: 0, possible_risk: 0, high_risk: 0 }
    for (const obs of allObservations) {
      const risk = obs.aiAnnotations?.[0]?.riskCategory
      if (risk === 'no_risk') counts.no_risk++
      else if (risk === 'possible_risk') counts.possible_risk++
      else if (risk === 'high_risk') counts.high_risk++
    }
    const total = counts.no_risk + counts.possible_risk + counts.high_risk
    return { counts, total }
  }, [allObservations])

  // ── Module coverage ──

  const moduleCoverage = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const obs of allObservations) {
      counts[obs.moduleType] = (counts[obs.moduleType] || 0) + 1
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([mod, count]) => ({ module: mod, count }))
  }, [allObservations])

  // ── Campaign comparison table ──

  const campaignRows = useMemo(() => {
    return aggregations.map((agg) => {
      const campaign = allCampaigns.find((c) => c.code === agg.code)
      const enrolled = campaign?.totalChildren ?? agg.children.length
      const obsCount = agg.observations.length
      const hrCount = agg.observations.filter(
        (o) => o.aiAnnotations?.[0]?.riskCategory === 'high_risk',
      ).length
      const hrPct = obsCount > 0 ? Math.round((hrCount / obsCount) * 100) : 0
      const completionPct =
        enrolled > 0
          ? Math.round((agg.children.length / enrolled) * 100)
          : 0
      return {
        code: agg.code,
        name: agg.name,
        childrenCount: agg.children.length,
        obsCount,
        hrPct,
        completionPct,
      }
    })
  }, [aggregations, allCampaigns])

  const sortedCampaignRows = useMemo(() => {
    const rows = [...campaignRows]
    rows.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'children':
          cmp = a.childrenCount - b.childrenCount
          break
        case 'observations':
          cmp = a.obsCount - b.obsCount
          break
        case 'highRisk':
          cmp = a.hrPct - b.hrPct
          break
        case 'completion':
          cmp = a.completionPct - b.completionPct
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [campaignRows, sortField, sortDir])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // ── Loading state ──

  if (campaignsLoading) {
    return <LoadingSpinner message="Loading authority dashboard..." />
  }

  const maxModuleCount =
    moduleCoverage.length > 0 ? moduleCoverage[0].count : 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Authority Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Population health analytics aggregated across screening campaigns.
        </p>
      </div>

      {/* Campaign Multi-Select */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              Campaigns ({selectedCodes.size} of {allCampaigns.length} selected)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Select All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={clearAll}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="ml-2 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {dropdownOpen ? 'Hide' : 'Show'} Campaigns
            </button>
          </div>
        </div>

        {dropdownOpen && (
          <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {allCampaigns.map((c) => {
              const selected = selectedCodes.has(c.code)
              return (
                <button
                  key={c.code}
                  onClick={() => toggleCampaign(c.code)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                      selected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="truncate font-medium">
                    {c.name || c.schoolName || c.code}
                  </span>
                  <span className="ml-auto flex-shrink-0 text-xs text-gray-400">
                    {c.totalChildren ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {fetching && <LoadingSpinner message="Aggregating campaign data..." />}

      {!fetching && selectedCodes.size > 0 && (
        <>
          {/* Population Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Children Screened"
              value={totalScreened}
              subtitle="Across selected campaigns"
              icon={Users}
              color="blue"
            />
            <StatsCard
              title="Screening Coverage"
              value={`${coveragePct}%`}
              subtitle={`${totalScreened} / ${totalEnrolled} enrolled`}
              icon={ShieldCheck}
              color="green"
            />
            <StatsCard
              title="High Risk"
              value={highRiskCount}
              subtitle="Observations flagged"
              icon={AlertTriangle}
              color="red"
            />
            <StatsCard
              title="Active Campaigns"
              value={activeCampaignCount}
              subtitle={`${selectedCodes.size} selected total`}
              icon={Activity}
              color="purple"
            />
          </div>

          {/* Prevalence Report */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-base font-semibold text-gray-900">
              4D Prevalence Report
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Conditions detected across {totalScreened} screened children.
            </p>
            {totalScreened === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No screening data available.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {prevalenceByCategory.map((item) => (
                  <div key={item.category} className="flex items-center gap-3">
                    <span
                      className={`w-56 truncate rounded-md px-2 py-1 text-sm font-medium ${item.colors.badge}`}
                    >
                      {item.label}
                    </span>
                    <div className="flex-1">
                      <div className="h-4 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-4 rounded-full transition-all ${item.colors.bg.replace('-50', '-400')}`}
                          style={{
                            width: `${
                              item.totalConditions > 0
                                ? Math.min(
                                    100,
                                    (item.conditionsFound /
                                      item.totalConditions) *
                                      100,
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-24 text-right text-xs font-medium text-gray-500">
                      {item.conditionsFound} / {item.totalConditions} conds
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk Distribution */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-base font-semibold text-gray-900">
              Risk Distribution
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Aggregated risk levels across {allObservations.length}{' '}
              observations.
            </p>
            {riskDistribution.total === 0 ? (
              <p className="mt-4 text-sm text-gray-400">
                No risk data available.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <RiskBar
                  label="No Risk"
                  count={riskDistribution.counts.no_risk}
                  total={riskDistribution.total}
                  color="bg-green-500"
                />
                <RiskBar
                  label="Possible Risk"
                  count={riskDistribution.counts.possible_risk}
                  total={riskDistribution.total}
                  color="bg-yellow-500"
                />
                <RiskBar
                  label="High Risk"
                  count={riskDistribution.counts.high_risk}
                  total={riskDistribution.total}
                  color="bg-red-500"
                />
              </div>
            )}
          </div>

          {/* Campaign Comparison Table */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                Campaign Comparison
              </h3>
            </div>
            {sortedCampaignRows.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">
                No campaigns selected.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortableHeader
                        label="Campaign"
                        field="name"
                        current={sortField}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Children"
                        field="children"
                        current={sortField}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Observations"
                        field="observations"
                        current={sortField}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="High Risk %"
                        field="highRisk"
                        current={sortField}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                      <SortableHeader
                        label="Completion %"
                        field="completion"
                        current={sortField}
                        dir={sortDir}
                        onSort={handleSort}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedCampaignRows.map((row) => (
                      <tr
                        key={row.code}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {row.name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {row.childrenCount}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {row.obsCount}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.hrPct > 20
                                ? 'bg-red-100 text-red-800'
                                : row.hrPct > 10
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {row.hrPct}%
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 rounded-full bg-gray-100">
                              <div
                                className="h-2 rounded-full bg-blue-500"
                                style={{
                                  width: `${Math.min(100, row.completionPct)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-500">
                              {row.completionPct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Module Coverage */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-400" />
              <h3 className="text-base font-semibold text-gray-900">
                Module Coverage
              </h3>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Observation counts per screening module across all selected
              campaigns.
            </p>
            {moduleCoverage.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">No data.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {moduleCoverage.map(({ module: mod, count }) => (
                  <div key={mod} className="flex items-center gap-3">
                    <span className="w-40 truncate text-sm text-gray-700">
                      {getModuleName(mod)}
                    </span>
                    <div className="flex-1">
                      <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-3 rounded-full bg-blue-500 transition-all"
                          style={{
                            width: `${Math.min(100, (count / maxModuleCount) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-gray-500">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!fetching && selectedCodes.size === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Megaphone className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-semibold text-gray-900">
            No campaigns selected
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Select one or more campaigns above to view aggregated population
            health analytics.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Shared UI helpers ──

function RiskBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm text-gray-600">{label}</span>
      <div className="flex-1">
        <div className="h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-3 rounded-full ${color} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="w-16 text-right text-xs font-medium text-gray-500">
        {count} ({pct}%)
      </span>
    </div>
  )
}

function SortableHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string
  field: SortField
  current: SortField
  dir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = current === field
  return (
    <th
      className="cursor-pointer select-none px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3 w-3 text-blue-600" />
          ) : (
            <ChevronDown className="h-3 w-3 text-blue-600" />
          )
        ) : (
          <ChevronUp className="h-3 w-3 text-gray-300" />
        )}
      </div>
    </th>
  )
}
