/**
 * Parent Report Page — Token-protected, no-login view of child health report.
 * Accessed via /report/:token — suitable for QR code sharing.
 * Parent-friendly language, simplified visualizations, educational content.
 * Enhanced with: percentile bars, radar charts, rich condition cards, evidence gallery, print layout.
 */

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import type { Child, Observation } from '@skids/shared'
import {
  MODULE_CONFIGS,
  computeFourDReport,
  getModuleEducation,
  getConditionInfo,
  CONDITION_DESCRIPTIONS,
  FOUR_D_CATEGORY_LABELS,
  FOUR_D_CATEGORY_COLORS,
} from '@skids/shared'
import { RadarChart } from '../components/report/RadarChart'

interface ReportData {
  child: Child
  observations: Observation[]
  campaignCode: string
  reviews?: Array<{
    decision?: string
    notes?: string
    clinicianName?: string
    moduleType?: string
  }>
}

export function ParentReportPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || ''
        const res = await fetch(`${apiUrl}/api/report-tokens/${token}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'This report link is invalid or has expired.')
        }
        const result = await res.json()
        setData(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load report')
      } finally {
        setLoading(false)
      }
    }
    if (token) load()
  }, [token])

  const fourDReport = useMemo(() => {
    if (!data) return null
    return computeFourDReport(data.observations)
  }, [data])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading health report...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl">!</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Report Unavailable</h1>
          <p className="mt-2 text-sm text-gray-500">{error || 'This report could not be found.'}</p>
          <p className="mt-4 text-xs text-gray-400">
            If you believe this is an error, please contact your child's school or clinic.
          </p>
        </div>
      </div>
    )
  }

  const { child, observations, reviews } = data
  const ageMs = child.dob ? Date.now() - new Date(child.dob).getTime() : 0
  const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000))
  const ageMonths = Math.floor((ageMs / (30.44 * 24 * 60 * 60 * 1000)) % 12)
  const ageStr = child.dob
    ? ageYears > 0 ? `${ageYears}y ${ageMonths}m` : `${ageMonths} months`
    : ''

  const vitalModules = ['height', 'weight', 'vitals', 'spo2', 'hemoglobin', 'bp', 'muac', 'bmi']
  const vitalObs = observations.filter(o => vitalModules.includes(o.moduleType))
  const examObs = observations.filter(o => !vitalModules.includes(o.moduleType))

  const normalCount = observations.filter(o =>
    !o.aiAnnotations?.[0]?.riskCategory || o.aiAnnotations[0].riskCategory === 'no_risk'
  ).length
  const findingsCount = observations.length - normalCount

  // Determine risk level
  const hasHighRisk = observations.some(o => o.aiAnnotations?.[0]?.riskCategory === 'high_risk')
  const hasPossibleRisk = observations.some(o => o.aiAnnotations?.[0]?.riskCategory === 'possible_risk')
  const riskLevel: 'all_clear' | 'review' | 'attention' =
    hasHighRisk ? 'attention' : hasPossibleRisk ? 'review' : 'all_clear'

  // Behavioral/learning data for radar chart
  const behavioralModules = ['behavioral', 'learning', 'social', 'emotional', 'motor', 'language']
  const behavioralObs = observations.filter(o => behavioralModules.includes(o.moduleType))

  const radarData = useMemo(() => {
    if (behavioralObs.length === 0) return null
    const dimensions = ['Attention', 'Social', 'Emotional', 'Motor', 'Language', 'Adaptive']
    const moduleMap: Record<string, string> = {
      behavioral: 'Attention',
      social: 'Social',
      emotional: 'Emotional',
      motor: 'Motor',
      language: 'Language',
      learning: 'Adaptive',
    }

    return dimensions.map(dim => {
      const matchedObs = behavioralObs.find(o => moduleMap[o.moduleType] === dim)
      if (!matchedObs) return { dimension: dim, value: 3 }
      const risk = matchedObs.aiAnnotations?.[0]?.riskCategory
      const score = risk === 'high_risk' ? 1 : risk === 'possible_risk' ? 2 : 4
      return { dimension: dim, value: score }
    })
  }, [behavioralObs])

  // Evidence images
  const evidenceImages = observations
    .filter(o => o.mediaUrl)
    .map(o => ({
      url: o.mediaUrl!,
      module: MODULE_CONFIGS.find(m => m.type === o.moduleType)?.name || o.moduleType,
    }))

  // Doctor's notes from reviews
  const doctorNotes = (reviews || []).filter(r => r.notes && r.notes.trim())

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Print-only header */}
      <div className="hidden print:block print:mb-4">
        <div className="text-center border-b-2 border-blue-600 pb-3">
          <h1 className="text-xl font-bold text-blue-800">SKIDS Health Screening Report</h1>
          <p className="text-xs text-gray-500 mt-1">Generated {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Screen header */}
      <div className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold text-lg">{child.name?.[0] || 'C'}</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Health Screening Report</h1>
                <p className="text-sm text-gray-500">{child.name} {ageStr && `| ${ageStr}`}</p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Report
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 print:py-2 print:space-y-4">
        {/* Child Profile (print) */}
        <div className="hidden print:block">
          <div className="flex items-center gap-4 text-sm">
            <span><strong>Name:</strong> {child.name}</span>
            <span><strong>Age:</strong> {ageStr}</span>
            {child.gender && <span><strong>Gender:</strong> {child.gender}</span>}
            {child.class && <span><strong>Class:</strong> {child.class}</span>}
          </div>
        </div>

        {/* Risk Level Badge */}
        <div className={`rounded-xl border-2 p-4 text-center ${
          riskLevel === 'all_clear' ? 'bg-green-50 border-green-300' :
          riskLevel === 'review' ? 'bg-amber-50 border-amber-300' :
          'bg-red-50 border-red-300'
        }`}>
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${
            riskLevel === 'all_clear' ? 'bg-green-200 text-green-800' :
            riskLevel === 'review' ? 'bg-amber-200 text-amber-800' :
            'bg-red-200 text-red-800'
          }`}>
            <span className="text-lg">{riskLevel === 'all_clear' ? '\u2713' : riskLevel === 'review' ? '\u26A0' : '\u26A0'}</span>
            {riskLevel === 'all_clear' ? 'All Clear' : riskLevel === 'review' ? 'Review Suggested' : 'Needs Attention'}
          </div>
          <p className={`mt-2 text-xs ${
            riskLevel === 'all_clear' ? 'text-green-700' :
            riskLevel === 'review' ? 'text-amber-700' :
            'text-red-700'
          }`}>
            {riskLevel === 'all_clear'
              ? 'Your child\'s screening results are within normal range. Great job!'
              : riskLevel === 'review'
                ? 'Some results may benefit from a follow-up with your doctor.'
                : 'Please schedule a doctor visit to discuss the findings below.'}
          </p>
        </div>

        {/* Quick Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-4">Summary</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-blue-50">
              <p className="text-2xl font-bold text-blue-700">{observations.length}</p>
              <p className="text-xs text-blue-600">Tests Done</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <p className="text-2xl font-bold text-green-700">{normalCount}</p>
              <p className="text-xs text-green-600">Normal</p>
            </div>
            <div className={`p-3 rounded-lg ${findingsCount > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <p className={`text-2xl font-bold ${findingsCount > 0 ? 'text-amber-700' : 'text-green-700'}`}>{findingsCount}</p>
              <p className={`text-xs ${findingsCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {findingsCount > 0 ? 'Need Attention' : 'All Clear'}
              </p>
            </div>
          </div>
        </div>

        {/* Vitals with Percentile Bars */}
        {vitalObs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 print:break-before-auto">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              Measurements & Growth
            </h2>
            <div className="space-y-4">
              {vitalObs.map(obs => {
                const features = obs.aiAnnotations?.[0]?.features as Record<string, unknown> | undefined
                const moduleConfig = MODULE_CONFIGS.find(m => m.type === obs.moduleType)
                const risk = obs.aiAnnotations?.[0]?.riskCategory || 'no_risk'
                const zScore = features?.zScore as number | undefined
                const percentile = zScore !== undefined ? zScoreToPercentile(zScore) : null
                const value = features?.value !== undefined ? `${features.value}` : ''
                const unit = features?.unit ? ` ${features.unit}` : ''

                return (
                  <div key={obs.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {moduleConfig?.name || obs.moduleType}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{value}{unit}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          risk === 'high_risk' ? 'bg-red-100 text-red-700' :
                          risk === 'possible_risk' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {risk === 'no_risk' ? 'Normal' : risk === 'possible_risk' ? 'Check' : 'Attention'}
                        </span>
                      </div>
                    </div>

                    {/* Percentile Bar */}
                    {percentile !== null && (
                      <div className="mt-1.5">
                        <div className="relative h-3 rounded-full overflow-hidden">
                          {/* Gradient background */}
                          <div className="absolute inset-0 flex">
                            <div className="w-[5%] bg-red-300" />
                            <div className="w-[10%] bg-amber-200" />
                            <div className="w-[70%] bg-green-200" />
                            <div className="w-[10%] bg-amber-200" />
                            <div className="w-[5%] bg-red-300" />
                          </div>
                          {/* Marker */}
                          <div
                            className="absolute top-0 h-3 w-1 bg-gray-900 rounded-full"
                            style={{ left: `${Math.min(99, Math.max(1, percentile))}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[9px] text-gray-400">Very Low</span>
                          <span className="text-[9px] text-gray-400">Below Avg</span>
                          <span className="text-[9px] text-gray-500 font-medium">Normal Range</span>
                          <span className="text-[9px] text-gray-400">Above Avg</span>
                          <span className="text-[9px] text-gray-400">Very High</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {getPercentileLabel(percentile)} (Percentile: {Math.round(percentile)}th)
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Behavioral/Learning Radar Chart */}
        {radarData && radarData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 print:break-before-page">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              Development Profile
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              This chart shows your child's developmental screening across key areas.
              Higher values indicate typical development.
            </p>
            <div className="flex justify-center">
              <RadarChart data={radarData} size={260} />
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Concern (1)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Developing (2-3)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Typical (4-5)
              </span>
            </div>
          </div>
        )}

        {/* Examination Results */}
        {examObs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Examination Results</h2>
            <div className="space-y-3">
              {examObs.map(obs => {
                const moduleConfig = MODULE_CONFIGS.find(m => m.type === obs.moduleType)
                const education = getModuleEducation(obs.moduleType)
                const risk = obs.aiAnnotations?.[0]?.riskCategory || 'no_risk'
                const isNormal = risk === 'no_risk'

                return (
                  <div key={obs.id} className={`rounded-lg border p-3 ${
                    isNormal ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-800">{moduleConfig?.name || obs.moduleType}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isNormal ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'
                      }`}>
                        {isNormal ? 'Normal' : 'Needs Follow-up'}
                      </span>
                    </div>

                    {obs.aiAnnotations?.[0]?.summaryText && (
                      <p className="mt-1 text-xs text-gray-600">{obs.aiAnnotations[0].summaryText}</p>
                    )}

                    {education && (
                      <p className="mt-2 text-xs text-gray-500">
                        {isNormal ? education.healthyMessage : education.intro}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Enhanced Condition Cards */}
        {fourDReport && fourDReport.categories.some(c => c.conditions.length > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 print:break-before-page">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              What We Found
            </h2>
            <div className="space-y-4">
              {fourDReport.categories
                .filter(c => c.conditions.length > 0)
                .flatMap(cat => cat.conditions.map(cond => ({ ...cond, categoryKey: cat.category as keyof typeof FOUR_D_CATEGORY_LABELS })))
                .map(cond => {
                  const condInfo = getConditionInfo(cond.id)
                  const catColors = FOUR_D_CATEGORY_COLORS[cond.categoryKey]
                  const catLabel = FOUR_D_CATEGORY_LABELS[cond.categoryKey]

                  return (
                    <div key={cond.id} className="rounded-xl border border-gray-200 overflow-hidden">
                      {/* Condition Header */}
                      <div className={`px-4 py-3 flex items-center justify-between ${
                        cond.severity === 'severe' ? 'bg-red-50' :
                        cond.severity === 'moderate' ? 'bg-amber-50' : 'bg-yellow-50'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            cond.severity === 'severe' ? 'bg-red-200 text-red-800' :
                            cond.severity === 'moderate' ? 'bg-amber-200 text-amber-800' :
                            'bg-yellow-200 text-yellow-800'
                          }`}>
                            {cond.severity}
                          </span>
                          <h3 className="text-sm font-semibold text-gray-900">{cond.name}</h3>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catColors?.badge || 'bg-gray-100 text-gray-700'}`}>
                          {catLabel}
                        </span>
                      </div>

                      {/* Condition Details */}
                      <div className="px-4 py-3 space-y-3">
                        {condInfo && (
                          <>
                            {condInfo.description && (
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">What is this?</p>
                                <p className="text-xs text-gray-700 mt-0.5">{condInfo.description}</p>
                              </div>
                            )}
                            {condInfo.prevalence && (
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">How common?</p>
                                <p className="text-xs text-gray-600 mt-0.5">{condInfo.prevalence}</p>
                              </div>
                            )}
                            {condInfo.symptoms && (
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">What to watch for</p>
                                <p className="text-xs text-gray-600 mt-0.5">{condInfo.symptoms}</p>
                              </div>
                            )}
                            {condInfo.intervention && (
                              <div className="bg-blue-50 rounded-lg p-2.5">
                                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Recommended care</p>
                                <p className="text-xs text-blue-800 mt-0.5 font-medium">{condInfo.intervention}</p>
                              </div>
                            )}
                            {condInfo.warningSign && (
                              <div className="bg-red-50 rounded-lg p-2.5">
                                <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider">When to seek help</p>
                                <p className="text-xs text-red-800 mt-0.5">{condInfo.warningSign}</p>
                              </div>
                            )}
                          </>
                        )}
                        {!condInfo && CONDITION_DESCRIPTIONS[cond.id] && (
                          <p className="text-xs text-gray-600">{CONDITION_DESCRIPTIONS[cond.id]}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Evidence Gallery */}
        {evidenceImages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 print:break-before-page">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              Screening Images
            </h2>
            <div className={`grid gap-3 ${
              evidenceImages.length === 1 ? 'grid-cols-1' :
              evidenceImages.length === 2 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}>
              {evidenceImages.map((img, idx) => (
                <div key={idx} className="rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={img.url}
                    alt={`${img.module} screening`}
                    loading="lazy"
                    className="w-full h-40 object-cover bg-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <p className="text-[10px] text-gray-500 px-2 py-1 bg-gray-50">{img.module}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Doctor's Notes */}
        {doctorNotes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
              Doctor's Notes
            </h2>
            <div className="space-y-2">
              {doctorNotes.map((review, idx) => (
                <div key={idx} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-700">{review.notes}</p>
                  {review.clinicianName && (
                    <p className="mt-1 text-[10px] text-gray-400">— {review.clinicianName}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-blue-800 mb-2">Next Steps</h2>
          <ul className="space-y-1.5 text-xs text-blue-700">
            {findingsCount > 0 ? (
              <>
                <li>1. Share this report with your child's doctor at the next visit.</li>
                <li>2. If any condition is marked "severe," schedule a doctor visit soon.</li>
                <li>3. Follow any specific recommendations listed above.</li>
                <li>4. Continue regular health check-ups as recommended.</li>
              </>
            ) : (
              <>
                <li>1. Keep this report for your records.</li>
                <li>2. Continue regular health check-ups.</li>
                <li>3. Maintain a balanced diet and regular physical activity.</li>
              </>
            )}
          </ul>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-gray-400 py-4 print:mt-8 print:border-t print:border-gray-200">
          SKIDS Health Screening Report | Generated {new Date().toLocaleDateString()}
          <br />This is a screening report, not a diagnosis. Please consult a doctor for medical advice.
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──

function zScoreToPercentile(z: number): number {
  // Approximation using error function
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return (z > 0 ? (1 - p) : p) * 100
}

function getPercentileLabel(pct: number): string {
  if (pct < 5) return 'Very Low'
  if (pct < 15) return 'Below Average'
  if (pct <= 85) return 'Normal Range'
  if (pct <= 95) return 'Above Average'
  return 'Very High'
}
