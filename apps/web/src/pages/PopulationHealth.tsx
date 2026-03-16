/**
 * PopulationHealth — Cohort builder, epi dashboard, and cohort comparison.
 */

import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '../lib/api'
import {
  Activity,
  Users,
  Plus,
  Save,
  Trash2,
  Search,
  BarChart3,
  GitCompare,
  Filter,
} from 'lucide-react'

interface CohortDefinition {
  id: string
  org_code: string
  name: string
  description: string
  filter_json: string
  created_at: string
}

interface CohortFilter {
  campaignCodes?: string[]
  gender?: string
  ageMin?: number
  ageMax?: number
  classes?: string[]
  conditions?: string[]
}

interface PopHealthDashboard {
  totalChildren: number
  screenedChildren: number
  screeningCoverage: number
  topConditions: { module_type: string; affected: number }[]
  campaigns: { code: string; name: string; school_name: string; city: string; state: string; total_children: number }[]
}

interface CohortAnalytics {
  cohortId: string
  cohortName: string
  count: number
  demographics: { male: number; female: number }
  ageGroups: Record<string, number>
  screeningCoverage: number
  topFindings: { module_type: string; count: number }[]
}

export function PopulationHealthPage() {
  const [dashboard, setDashboard] = useState<PopHealthDashboard | null>(null)
  const [cohorts, setCohorts] = useState<CohortDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cohorts' | 'builder'>('dashboard')
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null)
  const [cohortAnalytics, setCohortAnalytics] = useState<CohortAnalytics | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, cohortRes] = await Promise.all([
        apiCall('/api/cohorts/population-health/dashboard'),
        apiCall('/api/cohorts'),
      ])
      setDashboard(dashRes as any)
      setCohorts((cohortRes as any).cohorts || [])
    } catch (err) {
      console.error('Failed to load pop health data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const loadCohortAnalytics = async (cohortId: string) => {
    setSelectedCohort(cohortId)
    try {
      const res: any = await apiCall(`/api/cohorts/${cohortId}/analytics`)
      setCohortAnalytics(res)
    } catch (err) {
      console.error('Failed to load cohort analytics:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Population Health Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Epidemiological dashboard, cohort management, and comparative analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {[
          { key: 'dashboard' as const, label: 'Epi Dashboard', icon: Activity },
          { key: 'cohorts' as const, label: 'Saved Cohorts', icon: Users },
          { key: 'builder' as const, label: 'Cohort Builder', icon: Filter },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : activeTab === 'dashboard' ? (
        <DashboardView dashboard={dashboard} />
      ) : activeTab === 'cohorts' ? (
        <CohortsView
          cohorts={cohorts}
          selectedCohort={selectedCohort}
          cohortAnalytics={cohortAnalytics}
          onSelectCohort={loadCohortAnalytics}
          onRefresh={loadData}
        />
      ) : (
        <CohortBuilder onSaved={loadData} />
      )}
    </div>
  )
}

function DashboardView({ dashboard }: { dashboard: PopHealthDashboard | null }) {
  if (!dashboard) return <div className="py-10 text-center text-gray-500">No data available</div>

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 p-5 text-white">
          <p className="text-3xl font-bold">{dashboard.totalChildren.toLocaleString()}</p>
          <p className="text-sm text-blue-100">Total Children</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-green-500 to-green-700 p-5 text-white">
          <p className="text-3xl font-bold">{dashboard.screenedChildren.toLocaleString()}</p>
          <p className="text-sm text-green-100">Screened</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 p-5 text-white">
          <p className="text-3xl font-bold">{dashboard.screeningCoverage}%</p>
          <p className="text-sm text-purple-100">Coverage Rate</p>
        </div>
      </div>

      {/* Top Conditions */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <BarChart3 className="h-5 w-5 text-blue-600" /> Top Conditions by Prevalence
        </h3>
        <div className="mt-4 space-y-3">
          {dashboard.topConditions.length === 0 ? (
            <p className="text-sm text-gray-500">No screening data available yet.</p>
          ) : (
            dashboard.topConditions.map((cond, i) => {
              const pct = dashboard.screenedChildren > 0
                ? ((cond.affected as number) / dashboard.screenedChildren * 100).toFixed(1)
                : '0'
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-8 text-right text-xs font-medium text-gray-500">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {(cond.module_type as string).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-sm text-gray-500">{cond.affected} ({pct}%)</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.min(100, Number(pct))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Campaigns Overview */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">Campaign Breakdown</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Campaign</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">School</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Location</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">Children</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.campaigns.map(camp => (
                <tr key={camp.code} className="border-b border-gray-100">
                  <td className="py-2 font-mono text-xs font-medium text-blue-600">{camp.code}</td>
                  <td className="py-2 text-gray-700">{camp.school_name || camp.name}</td>
                  <td className="py-2 text-gray-500">{[camp.city, camp.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="py-2 text-right text-gray-700">{camp.total_children}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CohortsView({ cohorts, selectedCohort, cohortAnalytics, onSelectCohort, onRefresh }: {
  cohorts: CohortDefinition[]
  selectedCohort: string | null
  cohortAnalytics: CohortAnalytics | null
  onSelectCohort: (id: string) => void
  onRefresh: () => void
}) {
  const handleDelete = async (id: string) => {
    try {
      await apiCall(`/api/cohorts/${id}`, { method: 'DELETE' })
      onRefresh()
    } catch (err) {
      console.error('Failed to delete cohort:', err)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Cohort List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Saved Cohort Definitions</h3>
        {cohorts.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">No saved cohorts. Use the Cohort Builder to create one.</p>
          </div>
        ) : (
          cohorts.map(c => {
            const filter = JSON.parse(c.filter_json) as CohortFilter
            return (
              <div
                key={c.id}
                className={`cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-colors ${
                  selectedCohort === c.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onSelectCohort(c.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{c.name}</h4>
                    {c.description && <p className="mt-0.5 text-xs text-gray-500">{c.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {filter.gender && <FilterChip label={filter.gender} />}
                      {filter.ageMin !== undefined && <FilterChip label={`Age ${filter.ageMin}-${filter.ageMax ?? '∞'}`} />}
                      {filter.classes?.map(cl => <FilterChip key={cl} label={`Class ${cl}`} />)}
                      {filter.conditions?.map(co => <FilterChip key={co} label={co} />)}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(c.id) }}
                    className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Analytics Panel */}
      <div>
        {cohortAnalytics ? (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">{cohortAnalytics.cohortName}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xl font-bold text-blue-700">{cohortAnalytics.count}</p>
                <p className="text-xs text-blue-600">Members</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xl font-bold text-green-700">{cohortAnalytics.screeningCoverage}%</p>
                <p className="text-xs text-green-600">Screened</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-xl font-bold text-purple-700">{cohortAnalytics.demographics.male}</p>
                <p className="text-xs text-purple-600">Male</p>
              </div>
              <div className="rounded-lg bg-pink-50 p-3">
                <p className="text-xl font-bold text-pink-700">{cohortAnalytics.demographics.female}</p>
                <p className="text-xs text-pink-600">Female</p>
              </div>
            </div>

            {/* Age Distribution */}
            {Object.keys(cohortAnalytics.ageGroups).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700">Age Distribution</h4>
                <div className="mt-2 space-y-1">
                  {Object.entries(cohortAnalytics.ageGroups).map(([group, count]) => (
                    <div key={group} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{group} years</span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Findings */}
            {cohortAnalytics.topFindings.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700">Top Findings</h4>
                <div className="mt-2 space-y-1">
                  {cohortAnalytics.topFindings.map((f: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{(f.module_type as string).replace(/_/g, ' ')}</span>
                      <span className="font-medium text-gray-900">{f.count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-20 text-sm text-gray-500">
            Select a cohort to view analytics
          </div>
        )}
      </div>
    </div>
  )
}

function CohortBuilder({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [gender, setGender] = useState('')
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const buildFilter = (): CohortFilter => {
    const filter: CohortFilter = {}
    if (gender) filter.gender = gender
    if (ageMin) filter.ageMin = Number(ageMin)
    if (ageMax) filter.ageMax = Number(ageMax)
    return filter
  }

  const handlePreview = async () => {
    try {
      const res: any = await apiCall('/api/cohorts/resolve', {
        method: 'POST',
        body: JSON.stringify({ filterJson: buildFilter() }),
      })
      setPreviewCount(res.count)
    } catch (err) {
      console.error('Failed to preview:', err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiCall('/api/cohorts', {
        method: 'POST',
        body: JSON.stringify({ orgCode: 'zpedi', name, description, filterJson: buildFilter() }),
      })
      onSaved()
      setName(''); setDescription(''); setGender(''); setAgeMin(''); setAgeMax('')
      setPreviewCount(null)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
        <Filter className="h-5 w-5 text-blue-600" /> Build a Cohort
      </h3>

      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Cohort Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Anemic girls aged 5-10" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional description" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Min Age</label>
            <input value={ageMin} onChange={e => setAgeMin(e.target.value)}
              type="number" min={0} max={18}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max Age</label>
            <input value={ageMax} onChange={e => setAgeMax(e.target.value)}
              type="number" min={0} max={18}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={handlePreview}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Search className="h-4 w-4" /> Preview
          </button>
          {previewCount !== null && (
            <span className="text-sm text-gray-600">
              <strong>{previewCount}</strong> children match this filter
            </span>
          )}
          <div className="flex-1" />
          <button onClick={handleSave} disabled={saving || !name}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Cohort'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
      {label}
    </span>
  )
}
