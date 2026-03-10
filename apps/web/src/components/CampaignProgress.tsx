import { useState, useEffect } from 'react'
import {
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Stethoscope,
  Zap,
  TrendingUp,
} from 'lucide-react'
import { apiCall } from '../lib/api'
import { LoadingSpinner } from './LoadingSpinner'

interface PipelineStage {
  name: string
  count: number
  percentage: number
  color: string
}

interface NurseActivity {
  nurseName: string
  childrenScreened: number
  observationsCreated: number
  lastActiveAt: string
}

interface ModuleProgress {
  moduleType: string
  moduleName: string
  completed: number
  total: number
  percentage: number
}

interface CampaignProgressData {
  totalChildren: number
  registeredChildren: number
  screenedChildren: number
  fullyScreenedChildren: number
  reviewedChildren: number
  referredChildren: number
  completedChildren: number
  pipeline: PipelineStage[]
  nurseActivity: NurseActivity[]
  moduleProgress: ModuleProgress[]
  reviewBreakdown: {
    approved: number
    referred: number
    followUp: number
    discharged: number
    pending: number
  }
  screeningRate: {
    today: number
    thisWeek: number
    total: number
  }
}

interface Props {
  campaignCode: string
}

export function CampaignProgress({ campaignCode }: Props) {
  const [progress, setProgress] = useState<CampaignProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiCall<{ progress: CampaignProgressData }>(`/api/campaign-progress/${campaignCode}`)
      .then((res) => {
        setProgress(res.progress)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load progress')
        setLoading(false)
      })
  }, [campaignCode])

  if (loading) return <LoadingSpinner message="Loading progress..." />
  if (error) return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
  if (!progress) return null

  const {
    totalChildren,
    screenedChildren,
    fullyScreenedChildren,
    reviewedChildren,
    referredChildren,
    completedChildren,
    pipeline,
    nurseActivity,
    moduleProgress,
    reviewBreakdown,
    screeningRate,
  } = progress

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total Children"
          value={totalChildren}
          icon={Users}
          color="bg-slate-100 text-slate-700"
        />
        <StatCard
          label="Screened"
          value={screenedChildren}
          subtitle={totalChildren > 0 ? `${Math.round((screenedChildren / totalChildren) * 100)}%` : '0%'}
          icon={Activity}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Fully Screened"
          value={fullyScreenedChildren}
          subtitle={totalChildren > 0 ? `${Math.round((fullyScreenedChildren / totalChildren) * 100)}%` : '0%'}
          icon={CheckCircle2}
          color="bg-indigo-50 text-indigo-700"
        />
        <StatCard
          label="Reviewed"
          value={reviewedChildren}
          subtitle={totalChildren > 0 ? `${Math.round((reviewedChildren / totalChildren) * 100)}%` : '0%'}
          icon={Stethoscope}
          color="bg-green-50 text-green-700"
        />
        <StatCard
          label="Referred"
          value={referredChildren}
          icon={AlertTriangle}
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Completed"
          value={completedChildren}
          subtitle={totalChildren > 0 ? `${Math.round((completedChildren / totalChildren) * 100)}%` : '0%'}
          icon={CheckCircle2}
          color="bg-emerald-50 text-emerald-700"
        />
      </div>

      {/* Pipeline + Review Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pipeline Funnel */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">Screening Pipeline</h3>
          <p className="mt-1 text-xs text-gray-500">
            Progress through each screening stage
          </p>
          <div className="mt-5 space-y-3">
            {pipeline.map((stage) => (
              <div key={stage.name} className="flex items-center gap-3">
                <span className="w-32 text-sm font-medium text-gray-700">{stage.name}</span>
                <div className="flex-1">
                  <div className="relative h-7 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                      style={{
                        width: `${stage.percentage}%`,
                        backgroundColor: stage.color,
                        minWidth: stage.count > 0 ? '2rem' : 0,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-semibold text-gray-700 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">
                        {stage.count} ({stage.percentage}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Review Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">Review Breakdown</h3>
          <p className="mt-1 text-xs text-gray-500">Clinician review decisions</p>
          <div className="mt-5 space-y-3">
            <ReviewRow label="Approved" count={reviewBreakdown.approved} color="bg-green-500" total={totalReviews(reviewBreakdown)} />
            <ReviewRow label="Referred" count={reviewBreakdown.referred} color="bg-red-500" total={totalReviews(reviewBreakdown)} />
            <ReviewRow label="Follow Up" count={reviewBreakdown.followUp} color="bg-amber-500" total={totalReviews(reviewBreakdown)} />
            <ReviewRow label="Discharged" count={reviewBreakdown.discharged} color="bg-blue-500" total={totalReviews(reviewBreakdown)} />
            <ReviewRow label="Pending" count={reviewBreakdown.pending} color="bg-gray-400" total={totalReviews(reviewBreakdown)} />
          </div>
          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-semibold text-gray-900">{totalReviews(reviewBreakdown)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Progress + Screening Velocity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Module Completion */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">Module Completion</h3>
          <p className="mt-1 text-xs text-gray-500">
            Children screened per module
          </p>
          {moduleProgress.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">No module data available.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {moduleProgress.map((mod) => (
                <div key={mod.moduleType} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{mod.moduleName}</span>
                    <span className="text-xs font-semibold text-gray-500">
                      {mod.completed}/{mod.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${mod.percentage}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs text-gray-400">{mod.percentage}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Screening Velocity */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">Screening Velocity</h3>
          <p className="mt-1 text-xs text-gray-500">Observation throughput</p>
          <div className="mt-5 space-y-4">
            <VelocityCard
              label="Today"
              value={screeningRate.today}
              icon={Zap}
              accent="text-amber-600 bg-amber-50"
            />
            <VelocityCard
              label="This Week"
              value={screeningRate.thisWeek}
              icon={TrendingUp}
              accent="text-blue-600 bg-blue-50"
            />
            <VelocityCard
              label="All Time"
              value={screeningRate.total}
              icon={Activity}
              accent="text-indigo-600 bg-indigo-50"
            />
          </div>
        </div>
      </div>

      {/* Nurse Activity */}
      {nurseActivity.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">Nurse Activity</h3>
          <p className="mt-1 text-xs text-gray-500">
            Screening activity by nurse
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Nurse
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Children
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Observations
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {nurseActivity.map((nurse) => (
                  <tr key={nurse.nurseName} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {nurse.nurseName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{nurse.nurseName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      {nurse.childrenScreened}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {nurse.observationsCreated}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(nurse.lastActiveAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  subtitle?: string
  icon: typeof Users
  color: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        {subtitle && (
          <span className="text-xs font-semibold text-gray-400">{subtitle}</span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function ReviewRow({
  label,
  count,
  color,
  total,
}: {
  label: string
  count: number
  color: string
  total: number
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="flex-1 text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{count}</span>
      <span className="w-10 text-right text-xs text-gray-400">{pct}%</span>
    </div>
  )
}

function VelocityCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: typeof Zap
  accent: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
      <div className={`rounded-lg p-2 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

// ── Helpers ──

function totalReviews(rb: CampaignProgressData['reviewBreakdown']): number {
  return rb.approved + rb.referred + rb.followUp + rb.discharged + rb.pending
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  } catch {
    return dateStr
  }
}
