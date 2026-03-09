import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
} from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { StatusBadge } from '../components/StatusBadge'
import { useApi } from '../lib/hooks'
import {
  computeFourDReport,
  FOUR_D_CATEGORY_LABELS,
  FOUR_D_CATEGORY_COLORS,
  getModuleName,
} from '@skids/shared'
import type {
  FourDReport,
  FourDCategory,
  FourDConditionResult,
  Child,
  Observation,
} from '@skids/shared'

// ── Types for API responses ──

interface ChildResponse {
  id: string
  name: string
  dob: string
  gender?: string
  class?: string
  section?: string
  campaignCode: string
}

interface ObsResponse {
  observations: Array<{
    id: string
    moduleType: string
    childId: string
    annotationData?: {
      selectedChips?: string[]
      chipSeverities?: Record<string, string>
    }
    aiAnnotations?: Array<{
      riskCategory?: string
      summaryText?: string
      confidence?: number
    }>
    timestamp?: string
    screenedBy?: string
  }>
}

// ── Risk styling ──

const RISK_CONFIG: Record<string, { bg: string; text: string; icon: typeof ShieldCheck; label: string }> = {
  no_risk: { bg: 'bg-green-100', text: 'text-green-800', icon: ShieldCheck, label: 'No Risk' },
  possible_risk: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle, label: 'Possible Risk' },
  high_risk: { bg: 'bg-red-100', text: 'text-red-800', icon: ShieldAlert, label: 'High Risk' },
}

const CATEGORY_ORDER: FourDCategory[] = [
  'defects', 'delay', 'disability', 'deficiency', 'behavioral', 'immunization', 'learning',
]

// ── Main component ──

export function FourDReportPage() {
  const { code, childId } = useParams<{ code: string; childId: string }>()
  const navigate = useNavigate()

  const { data: child, isLoading: childLoading, error: childError } =
    useApi<ChildResponse>(childId ? `/api/children/${childId}` : null)

  const { data: obsData, isLoading: obsLoading } =
    useApi<ObsResponse>(
      code && childId ? `/api/observations?campaign=${code}&child=${childId}` : null,
    )

  const observations = obsData?.observations ?? []

  // Find screener name from the first observation that has one
  const screenerName = useMemo(() => {
    for (const obs of observations) {
      if (obs.screenedBy) return obs.screenedBy
    }
    return 'Screener'
  }, [observations])

  // Compute the report once data is ready
  const report: FourDReport | null = useMemo(() => {
    if (!child || !obsData) return null
    try {
      return computeFourDReport(
        { id: child.id, name: child.name, dob: child.dob, gender: child.gender } as Child,
        observations as unknown as Observation[],
        screenerName,
      )
    } catch {
      return null
    }
  }, [child, obsData, observations, screenerName])

  // ── Loading / Error states ──

  if (childLoading || obsLoading) {
    return <LoadingSpinner message="Generating 4D Report..." />
  }

  if (childError || !child) {
    return (
      <div className="space-y-4">
        <BackButton code={code} navigate={navigate} />
        <div className="flex flex-col items-center justify-center py-16">
          <XCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="text-lg font-semibold text-gray-900">Child not found</p>
          <p className="mt-1 text-sm text-gray-500">
            Could not load data for this child.
          </p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <BackButton code={code} navigate={navigate} />
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="mb-3 h-10 w-10 text-yellow-400" />
          <p className="text-lg font-semibold text-gray-900">Report unavailable</p>
          <p className="mt-1 text-sm text-gray-500">
            No observations found to generate the 4D report.
          </p>
        </div>
      </div>
    )
  }

  const riskCfg = RISK_CONFIG[report.overallRisk] ?? RISK_CONFIG.no_risk
  const RiskIcon = riskCfg.icon

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header actions — hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <BackButton code={code} navigate={navigate} />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" />
          Print Report
        </button>
      </div>

      {/* Child header + overall risk */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{report.childName}</h1>
            <div className="mt-1 flex flex-wrap gap-4 text-sm text-gray-500">
              <span>Age: {report.childAge}</span>
              {child.gender && (
                <span>Gender: {child.gender.charAt(0).toUpperCase() + child.gender.slice(1)}</span>
              )}
              {child.class && (
                <span>Class: {child.class}{child.section ? `-${child.section}` : ''}</span>
              )}
              <span>Campaign: {code}</span>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-xl px-5 py-3 ${riskCfg.bg}`}>
            <RiskIcon className={`h-6 w-6 ${riskCfg.text}`} />
            <span className={`text-lg font-bold ${riskCfg.text}`}>{riskCfg.label}</span>
          </div>
        </div>
      </div>

      {/* Category summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {CATEGORY_ORDER.map((cat) => {
          const colors = FOUR_D_CATEGORY_COLORS[cat]
          const summary = report.summary[cat]
          return (
            <div
              key={cat}
              className={`rounded-xl border border-gray-200 p-4 ${colors.bg}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
                {FOUR_D_CATEGORY_LABELS[cat].split('(')[0].trim()}
              </p>
              <div className="mt-2 flex gap-3 text-xs">
                {summary.present > 0 && (
                  <span className="font-semibold text-red-700">{summary.present} found</span>
                )}
                {summary.absent > 0 && (
                  <span className="text-green-700">{summary.absent} clear</span>
                )}
                {summary.notScreened > 0 && (
                  <span className="text-gray-500">{summary.notScreened} N/A</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detailed category sections */}
      {CATEGORY_ORDER.map((cat) => (
        <CategorySection
          key={cat}
          category={cat}
          results={report.categories[cat]}
        />
      ))}

      {/* Metadata footer */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Generated: {new Date(report.generatedAt).toLocaleString()}
          </div>
          <span>Screener: {report.screenerName}</span>
          <span>Child ID: {report.childId}</span>
        </div>
      </div>
    </div>
  )
}

// ── Category detail section ──

function CategorySection({
  category,
  results,
}: {
  category: FourDCategory
  results: FourDConditionResult[]
}) {
  const colors = FOUR_D_CATEGORY_COLORS[category]
  const present = results.filter((r) => r.status === 'present')
  const absent = results.filter((r) => r.status === 'absent')
  const notScreened = results.filter((r) => r.status === 'not_screened')

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className={`px-6 py-4 ${colors.bg} border-b border-gray-200`}>
        <h2 className={`text-sm font-bold uppercase tracking-wide ${colors.text}`}>
          {FOUR_D_CATEGORY_LABELS[category]}
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {present.length} detected / {absent.length} clear / {notScreened.length} not screened
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Present conditions — show details */}
        {present.map((r) => (
          <div key={r.condition.id} className="flex items-start gap-3 px-6 py-3 bg-red-50/40">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900">
                  {r.condition.name}
                </span>
                <StatusBadge status="high_risk" size="sm" />
                {r.severity && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    {r.severity}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                {r.condition.icdCode && <span>ICD: {r.condition.icdCode}</span>}
                {r.sourceModule && <span>Source: {getModuleName(r.sourceModule)}</span>}
              </div>
              {r.condition.description && (
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  {r.condition.description}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Absent conditions — green check */}
        {absent.map((r) => (
          <div key={r.condition.id} className="flex items-center gap-3 px-6 py-2.5">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
            <span className="text-sm text-gray-700">{r.condition.name}</span>
            {r.sourceModule && (
              <span className="text-xs text-gray-400 ml-auto">
                {getModuleName(r.sourceModule)}
              </span>
            )}
          </div>
        ))}

        {/* Not screened conditions — gray */}
        {notScreened.map((r) => (
          <div key={r.condition.id} className="flex items-center gap-3 px-6 py-2.5 bg-gray-50/50">
            <MinusCircle className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span className="text-sm text-gray-400">{r.condition.name}</span>
            <span className="text-xs text-gray-400 ml-auto">Not screened</span>
          </div>
        ))}

        {results.length === 0 && (
          <div className="px-6 py-4 text-sm text-gray-400">
            No conditions in this category.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared helpers ──

function BackButton({
  code,
  navigate,
}: {
  code?: string
  navigate: ReturnType<typeof useNavigate>
}) {
  return (
    <button
      onClick={() => navigate(code ? `/campaigns/${code}` : '/campaigns')}
      className="flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Campaign
    </button>
  )
}
