/**
 * Child Report Page — V2-parity health report with rich condition cards, visualizations, and clinical summary.
 * Sections: Header → Overview → Key Findings → Vitals & Growth → Head-to-Toe Modules → Clinical Summary → Evidence
 */

import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiCall } from '../lib/api'
import type { Child, Observation } from '@skids/shared'
import {
  MODULE_CONFIGS,
  computeFourDReport,
  getReportContent,
} from '@skids/shared'
import type { ReportCondition } from '@skids/shared'
import { InlineGrowthPanel, BehavioralRadar, EvidenceGallery, InlineAudiogram, InlineCardiacSummary } from '../components/report/ReportCharts'
import { GrowthChart } from '../components/visualizations/GrowthChart'
import { AudiogramChart } from '../components/visualizations/AudiogramChart'
import { DentalDiagram } from '../components/visualizations/DentalDiagram'
import { VisionDiagram } from '../components/visualizations/VisionDiagram'

interface APIResponse {
  child: Child
  observations: Observation[]
  reviews?: Array<{
    observationId: string
    decision: string
    notes?: string
    clinicianName?: string
    reviewedAt?: string
  }>
}

type ModuleStatus = 'healthy' | 'finding' | 'not_screened'

interface ModuleResult {
  moduleType: string
  moduleName: string
  status: ModuleStatus
  chips: string[]
  chipSeverities: Record<string, string>
  conditions: string[] // chip IDs that match conditions in REPORT_CONTENT
  risk: string
  observation?: Observation
}

function computeModuleResults(observations: Observation[], enabledModuleTypes: string[]): ModuleResult[] {
  const obsByModule: Record<string, Observation> = {}
  for (const obs of observations) {
    // Keep latest observation per module
    if (!obsByModule[obs.moduleType] || (obs.timestamp > (obsByModule[obs.moduleType]?.timestamp || ''))) {
      obsByModule[obs.moduleType] = obs
    }
  }

  return enabledModuleTypes.map(mt => {
    const obs = obsByModule[mt]
    const config = MODULE_CONFIGS.find(m => m.type === mt)
    const moduleName = config?.name || mt

    if (!obs) {
      return { moduleType: mt, moduleName, status: 'not_screened' as ModuleStatus, chips: [], chipSeverities: {}, conditions: [], risk: 'unknown' }
    }

    const annData = obs.annotationData as { selectedChips?: string[]; chipSeverities?: Record<string, string> } | undefined
    const chips = annData?.selectedChips || []
    const chipSeverities = annData?.chipSeverities || {}
    const risk = obs.aiAnnotations?.[0]?.riskCategory || 'no_risk'

    // A module has findings if it has chips or is high/possible risk
    const hasFindings = chips.length > 0 || risk === 'high_risk' || risk === 'possible_risk'
    const status: ModuleStatus = hasFindings ? 'finding' : 'healthy'

    return { moduleType: mt, moduleName, status, chips, chipSeverities, conditions: chips, risk, observation: obs }
  })
}

function getOverallRisk(results: ModuleResult[]): { level: string; color: string; bg: string; label: string } {
  const findingCount = results.filter(r => r.status === 'finding').length
  if (findingCount >= 3) return { level: 'high', color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Needs Attention' }
  if (findingCount >= 1) return { level: 'medium', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Review Suggested' }
  return { level: 'low', color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'All Clear' }
}

export function ChildReportPage() {
  const { code, childId } = useParams<{ code: string; childId: string }>()
  const [data, setData] = useState<APIResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [childData, obsData, reviewsData] = await Promise.all([
          apiCall<{ child: Child } | Child>(`/api/children/${childId}`),
          apiCall<{ observations: Observation[] } | Observation[]>(`/api/observations?childId=${childId}&campaignCode=${code}`),
          apiCall<{ reviews: APIResponse['reviews'] }>(`/api/reviews?campaign=${code}`).catch(() => ({ reviews: [] as APIResponse['reviews'] })),
        ])

        setData({
          child: (childData as { child: Child }).child || childData as Child,
          observations: (obsData as { observations: Observation[] }).observations || obsData as Observation[],
          reviews: (reviewsData as { reviews: APIResponse['reviews'] }).reviews || [],
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load report')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [code, childId])

  const fourDReport = useMemo(() => {
    if (!data) return null
    return computeFourDReport(data.child, data.observations, 'Screening Team')
  }, [data])

  const moduleResults = useMemo(() => {
    if (!data) return []
    const allTypes = MODULE_CONFIGS.map(m => m.type)
    return computeModuleResults(data.observations, allTypes)
  }, [data])

  const overallRisk = useMemo(() => getOverallRisk(moduleResults), [moduleResults])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 text-sm">{error || 'No data available'}</p>
        <Link to={`/campaigns/${code}`} className="text-sm text-blue-600 mt-2 inline-block">Back to campaign</Link>
      </div>
    )
  }

  const { child, observations } = data
  const reviews = data.reviews || []
  const age = child.dob
    ? `${Math.floor((Date.now() - new Date(child.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years`
    : 'Unknown age'

  // Separate vitals from head-to-toe
  const vitalModuleTypes = ['height', 'weight', 'vitals', 'spo2', 'hemoglobin', 'bp', 'muac']
  const vitalObs = observations.filter(o => vitalModuleTypes.includes(o.moduleType))
  const examObs = observations.filter(o => !vitalModuleTypes.includes(o.moduleType))

  // Module results for display
  const screenedModules = moduleResults.filter(r => r.status !== 'not_screened')
  const findingModules = moduleResults.filter(r => r.status === 'finding')
  const healthyModules = moduleResults.filter(r => r.status === 'healthy')
  const notScreenedModules = moduleResults.filter(r => r.status === 'not_screened' && observations.some(o => true)) // only if campaign uses them

  // Build review lookup
  const reviewByObsId: Record<string, (typeof reviews)[0]> = {}
  for (const r of reviews || []) {
    if (r.observationId) reviewByObsId[r.observationId] = r
  }

  // Get unique reviewer
  const reviewerNames = [...new Set((reviews || []).filter(r => r.clinicianName).map(r => r.clinicianName!))]

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:space-y-4 print:max-w-none">
      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:break-before { break-before: page; }
          section { break-inside: avoid; }
        }
      `}</style>

      {/* Header with branding */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white print:rounded-none print:p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">SKIDS Health Screening Report</h1>
            <p className="text-blue-100 text-xs mt-0.5">Comprehensive School Health Assessment</p>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <Link to={`/campaigns/${code}`} className="text-xs text-blue-200 hover:text-white">
              Back
            </Link>
            <button
              className="text-xs px-3 py-1.5 bg-white/20 text-white rounded-lg hover:bg-white/30"
              onClick={() => window.print()}
            >
              Print Report
            </button>
          </div>
        </div>

        {/* Child info strip */}
        <div className="mt-4 grid grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-blue-200 uppercase tracking-wide">Name</p>
            <p className="text-sm font-semibold">{child.name}</p>
          </div>
          <div>
            <p className="text-[10px] text-blue-200 uppercase tracking-wide">Age / Gender</p>
            <p className="text-sm font-semibold">{age} / {child.gender || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-blue-200 uppercase tracking-wide">Class</p>
            <p className="text-sm font-semibold">{child.class || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-blue-200 uppercase tracking-wide">Campaign</p>
            <p className="text-sm font-semibold">{code}</p>
          </div>
        </div>
      </header>

      {/* Overall Risk Badge + Quick Stats */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-lg border ${overallRisk.bg}`}>
            <p className={`text-lg font-bold ${overallRisk.color}`}>{overallRisk.label}</p>
          </div>
          <div className="flex-1 grid grid-cols-4 gap-3">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xl font-bold text-gray-900">{screenedModules.length}</p>
              <p className="text-[9px] text-gray-500">Modules Screened</p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-xl font-bold text-green-600">{healthyModules.length}</p>
              <p className="text-[9px] text-gray-500">Normal</p>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded-lg">
              <p className="text-xl font-bold text-amber-600">{findingModules.length}</p>
              <p className="text-[9px] text-gray-500">Findings</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xl font-bold text-gray-400">
                {fourDReport ? Object.values(fourDReport.categories).filter(arr => arr.some(c => c.status === 'present')).length : 0}
              </p>
              <p className="text-[9px] text-gray-500">4D Categories</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Findings Banner */}
      {findingModules.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Key Findings</h2>
          <div className="flex flex-wrap gap-2">
            {findingModules.map(m => (
              <div key={m.moduleType} className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${
                  m.risk === 'high_risk' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <span className="text-xs font-medium text-gray-800">{m.moduleName}</span>
                <span className="text-[10px] text-gray-500">({m.chips.length} finding{m.chips.length !== 1 ? 's' : ''})</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section: Vitals & Growth */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Vitals & Growth</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-medium text-gray-600 mb-2">Growth Z-Scores</h3>
            <InlineGrowthPanel observations={vitalObs} />
          </div>
          <div>
            <h3 className="text-xs font-medium text-gray-600 mb-2">Growth Chart</h3>
            <GrowthChart observations={vitalObs} childDob={child.dob} />
          </div>
        </div>

        {/* Vital signs table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1.5 text-gray-500 font-medium">Module</th>
                <th className="text-left py-1.5 text-gray-500 font-medium">Value</th>
                <th className="text-left py-1.5 text-gray-500 font-medium">Status</th>
                <th className="text-left py-1.5 text-gray-500 font-medium">Review</th>
              </tr>
            </thead>
            <tbody>
              {vitalObs.map(obs => {
                const features = obs.aiAnnotations?.[0]?.features as Record<string, unknown> | undefined
                const moduleConfig = MODULE_CONFIGS.find(m => m.type === obs.moduleType)
                const review = reviewByObsId[obs.id]
                return (
                  <tr key={obs.id} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-700">{moduleConfig?.name || obs.moduleType}</td>
                    <td className="py-1.5 text-gray-900 font-medium">
                      {features?.value !== undefined ? `${features.value}` : '—'}
                      {features?.unit ? ` ${features.unit}` : ''}
                    </td>
                    <td className="py-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        obs.aiAnnotations?.[0]?.riskCategory === 'high_risk' ? 'bg-red-100 text-red-700' :
                        obs.aiAnnotations?.[0]?.riskCategory === 'possible_risk' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {obs.aiAnnotations?.[0]?.riskCategory?.replace('_', ' ') || 'normal'}
                      </span>
                    </td>
                    <td className="py-1.5">
                      {review && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          review.decision === 'approve' ? 'bg-green-100 text-green-700' :
                          review.decision === 'refer' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {review.decision}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section: Head-to-Toe Modules with Rich Condition Cards */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-5 print:break-before">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Head-to-Toe Examination</h2>

        <div className="space-y-6">
          {examObs.map(obs => {
            const moduleConfig = MODULE_CONFIGS.find(m => m.type === obs.moduleType)
            const reportContent = getReportContent(obs.moduleType)
            const annData = obs.annotationData as { selectedChips?: string[]; chipSeverities?: Record<string, string> } | undefined
            const chips = annData?.selectedChips || []
            const chipSeverities = annData?.chipSeverities || {}
            const risk = obs.aiAnnotations?.[0]?.riskCategory || 'no_risk'
            const isHealthy = risk === 'no_risk' && chips.length === 0
            const review = reviewByObsId[obs.id]

            // Match chips to conditions from report content
            const matchedConditions: ReportCondition[] = []
            if (reportContent) {
              for (const chip of chips) {
                const normalizedChip = chip.toLowerCase().replace(/[\s_-]+/g, '_')
                const found = reportContent.conditions.find(c =>
                  c.id === normalizedChip ||
                  c.name.toLowerCase().includes(chip.toLowerCase()) ||
                  chip.toLowerCase().includes(c.id.replace(/_/g, ' '))
                )
                if (found && !matchedConditions.includes(found)) {
                  matchedConditions.push(found)
                }
              }
              // If no chip match but has findings, show all conditions for the module
              if (matchedConditions.length === 0 && !isHealthy && reportContent.conditions.length > 0) {
                matchedConditions.push(reportContent.conditions[0])
              }
            }

            return (
              <div key={obs.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Module header */}
                <div className={`flex items-center justify-between p-3 ${
                  isHealthy ? 'bg-green-50' : risk === 'high_risk' ? 'bg-red-50' : 'bg-amber-50'
                }`}>
                  <div className="flex items-center gap-2">
                    {reportContent && <span className="text-lg">{reportContent.icon}</span>}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">
                        {reportContent?.label || moduleConfig?.name || obs.moduleType}
                      </h3>
                      {reportContent && (
                        <p className="text-[10px] text-gray-500">{reportContent.method}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {review && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        review.decision === 'approve' ? 'bg-green-100 text-green-700' :
                        review.decision === 'refer' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        Dr: {review.decision}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isHealthy ? 'bg-green-100 text-green-700' :
                      risk === 'high_risk' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {isHealthy ? 'Healthy' : risk === 'high_risk' ? 'High Risk' : 'Finding'}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Healthy message */}
                  {isHealthy && reportContent && (
                    <p className="text-xs text-green-700 bg-green-50 rounded-lg p-3 border border-green-100">
                      {reportContent.healthyMessage}
                    </p>
                  )}

                  {/* Overview */}
                  {reportContent && !isHealthy && (
                    <p className="text-xs text-gray-600">{reportContent.overview}</p>
                  )}

                  {/* AI Summary */}
                  {obs.aiAnnotations?.[0]?.summaryText && !isHealthy && (
                    <p className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2 border border-gray-100 italic">
                      {obs.aiAnnotations[0].summaryText}
                    </p>
                  )}

                  {/* Chips with severity */}
                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map(chip => {
                        const sev = chipSeverities[chip]
                        const colorClass = sev === 'severe' ? 'bg-red-50 border-red-200 text-red-700'
                          : sev === 'moderate' ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : sev === 'mild' ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                          : 'bg-gray-100 border-gray-200 text-gray-700'
                        return (
                          <span key={chip} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
                            {chip}{sev && sev !== 'normal' ? ` (${sev})` : ''}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Module-specific visualizations */}
                  {obs.moduleType === 'hearing' && <AudiogramChart observations={[obs]} />}
                  {obs.moduleType === 'dental' && <DentalDiagram observations={[obs]} />}
                  {obs.moduleType === 'vision' && <VisionDiagram observations={[obs]} />}
                  {obs.moduleType === 'cardiac' && <InlineCardiacSummary observations={[obs]} />}
                  {obs.moduleType === 'neurodevelopment' && <BehavioralRadar observations={[obs]} />}

                  {/* Evidence image */}
                  {obs.mediaUrl && (
                    <img src={obs.mediaUrl} alt={obs.moduleType} className="w-28 h-28 rounded-lg object-cover border border-gray-200" loading="lazy" />
                  )}

                  {/* Rich Condition Cards (5 sections each) */}
                  {matchedConditions.length > 0 && (
                    <div className="space-y-3 mt-2">
                      {matchedConditions.map(cond => (
                        <ConditionCard key={cond.id} condition={cond} />
                      ))}
                    </div>
                  )}

                  {/* Doctor notes for this observation */}
                  {review?.notes && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                      <p className="text-[10px] font-semibold text-blue-800 mb-0.5">Doctor's Notes</p>
                      <p className="text-xs text-blue-700">{review.notes}</p>
                      {review.clinicianName && (
                        <p className="text-[10px] text-blue-500 mt-1">— Dr. {review.clinicianName}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Section: 4D Clinical Summary */}
      {fourDReport && Object.values(fourDReport.categories).some(arr => arr.some(c => c.status === 'present')) && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 print:break-before">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">4D Clinical Summary</h2>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(fourDReport.categories)
              .filter(([, conditions]) => conditions.some(c => c.status === 'present'))
              .map(([category, conditions]) => {
                const presentConditions = conditions.filter(c => c.status === 'present')
                return (
                  <div key={category} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{category}</h3>
                    <div className="space-y-1.5">
                      {presentConditions.map(cond => (
                        <div key={cond.condition.id} className="flex items-start gap-2">
                          <span className={`mt-0.5 text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                            cond.severity === 'severe' ? 'bg-red-100 text-red-700' :
                            cond.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {cond.severity || 'mild'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800">{cond.condition.name}</p>
                            {cond.condition.icdCode && (
                              <span className="text-[9px] text-gray-400">ICD: {cond.condition.icdCode}</span>
                            )}
                            {cond.condition.description && (
                              <p className="text-[10px] text-gray-500 mt-0.5">{cond.condition.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      )}

      {/* Section: Clinical Summary (Reviewer info) */}
      {reviewerNames.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Clinical Review Summary</h2>
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
              {reviewerNames[0]?.charAt(0) || 'D'}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Dr. {reviewerNames[0]}</p>
              <p className="text-[10px] text-gray-500">Reviewing Clinician</p>
            </div>
          </div>

          {/* Review decisions summary */}
          <div className="grid grid-cols-3 gap-2">
            {['approve', 'refer', 'follow_up'].map(decision => {
              const count = (reviews || []).filter(r => r.decision === decision).length
              if (count === 0) return null
              return (
                <div key={decision} className={`text-center p-2 rounded-lg ${
                  decision === 'approve' ? 'bg-green-50' :
                  decision === 'refer' ? 'bg-red-50' :
                  'bg-amber-50'
                }`}>
                  <p className={`text-lg font-bold ${
                    decision === 'approve' ? 'text-green-600' :
                    decision === 'refer' ? 'text-red-600' :
                    'text-amber-600'
                  }`}>{count}</p>
                  <p className="text-[9px] text-gray-500 capitalize">{decision.replace('_', ' ')}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Evidence Gallery */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Evidence Gallery</h2>
        <EvidenceGallery observations={observations} />
      </section>

      {/* Important Instructions Footer */}
      <section className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-2 print:break-before">
        <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Important Instructions</h2>
        <ul className="text-[10px] text-gray-500 space-y-1 list-disc list-inside">
          <li>This screening report is for preliminary assessment only and does not constitute a medical diagnosis.</li>
          <li>Please consult your SKIDS pediatrician or nearest healthcare professional for any findings noted above.</li>
          <li>Keep this report for your records and bring it to any follow-up medical visits.</li>
          <li>AI-assisted analysis is used to augment clinical decision-making but final decisions rest with qualified medical professionals.</li>
        </ul>
      </section>

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-400 py-4 print:py-2">
        SKIDS Screen V3 — Generated {new Date().toLocaleDateString()} — For clinical use only
      </div>
    </div>
  )
}

// ── Rich Condition Card (5 sections, V2-parity) ──

function ConditionCard({ condition }: { condition: ReportCondition }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Condition header */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-800">{condition.name}</p>
      </div>

      <div className="p-3 space-y-2.5">
        {/* 1. What to Look For */}
        <div>
          <p className="text-[10px] font-semibold text-gray-600 mb-0.5">What to Look For</p>
          <p className="text-[10px] text-gray-700">{condition.symptoms}</p>
        </div>

        {/* 2. How Common Is This (sky-blue accent) */}
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-2">
          <p className="text-[10px] font-semibold text-sky-700 mb-0.5">How Common Is This</p>
          <p className="text-[10px] text-sky-600">{condition.prevalence}</p>
        </div>

        {/* 3. Prevention Tips */}
        <div>
          <p className="text-[10px] font-semibold text-gray-600 mb-0.5">Prevention Tips</p>
          <p className="text-[10px] text-gray-700">{condition.prevention}</p>
        </div>

        {/* 4. What You Can Do (amber accent) */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <p className="text-[10px] font-semibold text-amber-700 mb-0.5">What You Can Do</p>
          <p className="text-[10px] text-amber-600">{condition.care}</p>
        </div>

        {/* 5. When to Talk to a Doctor (rose accent) */}
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-2">
          <p className="text-[10px] font-semibold text-rose-700 mb-0.5">When to Talk to a Doctor</p>
          <p className="text-[10px] text-rose-600">{condition.whenToSeekHelp}</p>
        </div>
      </div>
    </div>
  )
}
