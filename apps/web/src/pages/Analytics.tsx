/**
 * Analytics Page — Tabbed population health analytics dashboard.
 * Tabs: Overview | Cohort | Prevalence | Demographics | Geographic | Comparison
 * Fetches aggregate data from selected campaigns, delegates to analytics components.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  BarChart3, Activity, Users, Megaphone,
  Check, ChevronDown,
} from 'lucide-react'
import { StatsCard } from '../components/StatsCard'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useApi } from '../lib/hooks'
import { apiCall } from '../lib/api'
import {
  getModuleName,
  MODULE_CONFIGS,
  computePopulationSummary,
} from '@skids/shared'
import type { Child, Observation, CampaignDataBundle, ModuleType } from '@skids/shared'
import { ExecutiveSummary } from '../components/analytics/ExecutiveSummary'
import { CohortAnalyticsPanel } from '../components/analytics/CohortAnalyticsPanel'
import { PrevalenceReport } from '../components/analytics/PrevalenceReport'
import { DemographicBreakdown } from '../components/analytics/DemographicBreakdown'
import { GeographicDrillDown } from '../components/analytics/GeographicDrillDown'
import { SubcohortComparison } from '../components/analytics/SubcohortComparison'

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

type Tab = 'overview' | 'cohort' | 'prevalence' | 'demographics' | 'geographic' | 'comparison'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'prevalence', label: 'Prevalence' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'geographic', label: 'Geographic' },
  { id: 'comparison', label: 'Comparison' },
]

export function AnalyticsPage() {
  const { data, isLoading: campaignsLoading } = useApi<CampaignsResponse>('/api/campaigns')
  const allCampaigns = useMemo(() => data?.campaigns ?? [], [data])

  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set())
  const [bundles, setBundles] = useState<CampaignDataBundle[]>([])
  const [fetching, setFetching] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectorOpen, setSelectorOpen] = useState(false)

  // Auto-select all active campaigns on load
  useEffect(() => {
    if (allCampaigns.length > 0 && selectedCodes.size === 0) {
      const activeCodes = allCampaigns.filter(c => c.status === 'active').map(c => c.code)
      if (activeCodes.length > 0) setSelectedCodes(new Set(activeCodes))
    }
  }, [allCampaigns]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch children + observations for selected campaigns
  const fetchBundles = useCallback(async () => {
    if (selectedCodes.size === 0) {
      setBundles([])
      return
    }
    setFetching(true)
    try {
      const results = await Promise.all(
        Array.from(selectedCodes).map(async code => {
          const campaign = allCampaigns.find(c => c.code === code)
          const [childRes, obsRes] = await Promise.all([
            apiCall<{ children: Child[] }>(`/api/children?campaign=${code}`),
            apiCall<{ observations: Observation[] }>(`/api/observations?campaign=${code}`),
          ])
          return {
            campaign: {
              code,
              name: campaign?.name || campaign?.schoolName || code,
              schoolName: campaign?.schoolName,
            },
            children: childRes.children ?? [],
            observations: (obsRes.observations ?? []) as any[],
            reviews: {} as Record<string, any>,
          } satisfies CampaignDataBundle
        }),
      )
      setBundles(results)
    } catch {
      // Partial data is still useful
    } finally {
      setFetching(false)
    }
  }, [selectedCodes, allCampaigns])

  useEffect(() => { fetchBundles() }, [fetchBundles])

  // Aggregate all children + observations
  const allChildren = useMemo(() => bundles.flatMap(b => b.children), [bundles])
  const allObservations = useMemo(() => bundles.flatMap(b => b.observations as unknown as Observation[]), [bundles])

  // Population summary
  const summary = useMemo(() => {
    if (bundles.length === 0) return null
    return computePopulationSummary(bundles)
  }, [bundles])

  const enabledModules = useMemo(
    () => MODULE_CONFIGS.map(m => m.type) as ModuleType[],
    [],
  )

  function toggleCampaign(code: string) {
    setSelectedCodes(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  if (campaignsLoading) {
    return <LoadingSpinner message="Loading analytics..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Population health insights across screening campaigns.
        </p>
      </div>

      {/* Campaign Selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              Campaigns ({selectedCodes.size} of {allCampaigns.length})
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedCodes(new Set(allCampaigns.map(c => c.code)))} className="text-xs font-medium text-blue-600 hover:text-blue-700">Select All</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => setSelectedCodes(new Set())} className="text-xs font-medium text-gray-500 hover:text-gray-700">Clear</button>
            <button
              onClick={() => setSelectorOpen(o => !o)}
              className="ml-2 flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {selectorOpen ? 'Hide' : 'Show'}
              <ChevronDown className={`h-3 w-3 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {selectorOpen && (
          <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {allCampaigns.map(c => {
              const selected = selectedCodes.has(c.code)
              return (
                <button
                  key={c.code}
                  onClick={() => toggleCampaign(c.code)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selected ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                    {selected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="truncate font-medium">{c.name || c.schoolName || c.code}</span>
                  <span className="ml-auto flex-shrink-0 text-xs text-gray-400">{c.totalChildren ?? 0}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {fetching && <LoadingSpinner message="Loading campaign data..." />}

      {!fetching && selectedCodes.size === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <Megaphone className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-semibold text-gray-900">No campaigns selected</p>
          <p className="mt-1 text-sm text-gray-500">Select campaigns above to view analytics.</p>
        </div>
      )}

      {!fetching && selectedCodes.size > 0 && (
        <div>
          {activeTab === 'overview' && summary && (
            <ExecutiveSummary
              totalScreened={summary.screenedChildren}
              totalEnrolled={summary.totalChildren}
              highRiskCount={summary.highRiskChildren}
              referralRate={summary.referralRate}
              normalRate={summary.totalObservations > 0
                ? Math.round(((summary.totalObservations - summary.highRiskChildren) / summary.totalObservations) * 100)
                : 100}
              topConditions={[]}
            />
          )}

          {activeTab === 'cohort' && (
            <CohortAnalyticsPanel
              children={allChildren}
              observations={allObservations}
              enabledModules={enabledModules}
            />
          )}

          {activeTab === 'prevalence' && (
            <PrevalenceReport
              children={allChildren}
              observations={allObservations}
              campaignCode={Array.from(selectedCodes).join(',')}
            />
          )}

          {activeTab === 'demographics' && (
            <DemographicBreakdown bundles={bundles} />
          )}

          {activeTab === 'geographic' && (
            <GeographicDrillDown bundles={bundles} />
          )}

          {activeTab === 'comparison' && (
            <SubcohortComparison bundles={bundles} />
          )}
        </div>
      )}
    </div>
  )
}
