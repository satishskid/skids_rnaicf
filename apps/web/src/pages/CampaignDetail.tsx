import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  ClipboardList,
  FileCheck2,
  BarChart3,
  AlertCircle,
  User,
  Clock,
} from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { useApi } from '../lib/hooks'
import { getModuleName, computeNurseQualityStats } from '@skids/shared'

// ── Types for API responses ──

interface CampaignData {
  code: string
  name: string
  schoolName?: string
  status: string
  totalChildren?: number
  createdAt?: string
  completedAt?: string
  campaignType?: string
  enabledModules?: string[]
  location?: { city?: string; state?: string; address?: string }
  city?: string
  state?: string
  createdBy?: string
}

interface ChildData {
  id: string
  name: string
  dob?: string
  gender?: string
  class?: string
  section?: string
  admissionNumber?: string
  parentContact?: string
}

interface ObservationData {
  id: string
  sessionId?: string
  moduleType: string
  childId?: string
  childName?: string
  timestamp?: string
  status?: string
  annotationData?: {
    selectedChips?: string[]
    evidenceImage?: string
    evidenceVideoFrames?: string[]
  }
  aiAnnotations?: Array<{
    confidence?: number
    riskCategory?: string
    summaryText?: string
  }>
  captureMetadata?: Record<string, unknown>
  mediaUrl?: string
  mediaType?: string
}

interface ReviewData {
  id: string
  observationId?: string
  clinicianId?: string
  clinicianName?: string
  childName?: string
  moduleType?: string
  decision?: string
  notes?: string
  timestamp?: string
  qualityRating?: string
  fourDFindings?: string[]
}

// API returns flat campaign object (not wrapped)
type CampaignResponse = CampaignData

interface ChildrenResponse {
  children: ChildData[]
}

interface ObservationsResponse {
  observations: ObservationData[]
}

interface ReviewsResponse {
  reviews: ReviewData[]
}

type TabKey = 'children' | 'observations' | 'reviews' | 'analytics'

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'children', label: 'Children', icon: Users },
  { key: 'observations', label: 'Observations', icon: ClipboardList },
  { key: 'reviews', label: 'Reviews', icon: FileCheck2 },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export function CampaignDetailPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('children')

  const { data: campaign, isLoading: campaignLoading, error: campaignError } =
    useApi<CampaignResponse>(code ? `/api/campaigns/${code}` : null)

  const campaignQuery = code ? `campaign=${code}` : ''

  const { data: childrenData, isLoading: childrenLoading } =
    useApi<ChildrenResponse>(code ? `/api/children?${campaignQuery}` : null)

  const { data: obsData, isLoading: obsLoading } =
    useApi<ObservationsResponse>(code ? `/api/observations?${campaignQuery}` : null)

  const { data: reviewsData, isLoading: reviewsLoading } =
    useApi<ReviewsResponse>(code ? `/api/reviews?${campaignQuery}` : null)

  const children = childrenData?.children ?? []
  const observations = obsData?.observations ?? []
  const reviews = reviewsData?.reviews ?? []

  if (campaignLoading) {
    return <LoadingSpinner message="Loading campaign..." />
  }

  if (campaignError || !campaign) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/campaigns')}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </button>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="text-lg font-semibold text-gray-900">
            Campaign not found
          </p>
          <p className="mt-1 text-sm text-gray-500">
            The campaign with code &ldquo;{code}&rdquo; could not be loaded.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/campaigns')}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </button>

      {/* Campaign header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {campaign.name || campaign.schoolName || 'Untitled Campaign'}
              </h1>
              <StatusBadge status={campaign.status} size="md" />
            </div>
            <p className="mt-1 font-mono text-sm text-gray-400">
              Code: {campaign.code}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span>
              {campaign.location?.city || campaign.city || 'No location'}
              {(campaign.location?.state || campaign.state) &&
                `, ${campaign.location?.state || campaign.state}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>
              Created{' '}
              {campaign.createdAt
                ? new Date(campaign.createdAt).toLocaleDateString()
                : 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span>{campaign.totalChildren ?? children.length} children</span>
          </div>
          {campaign.campaignType && (
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-400" />
              <span>{campaign.campaignType.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>

        {campaign.enabledModules && campaign.enabledModules.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {campaign.enabledModules.map((mod) => (
              <span
                key={mod}
                className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
              >
                {getModuleName(mod)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {tab.key === 'children'
                  ? children.length
                  : tab.key === 'observations'
                    ? observations.length
                    : tab.key === 'reviews'
                      ? reviews.length
                      : '--'}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'children' && (
          <ChildrenTab children={children} isLoading={childrenLoading} />
        )}
        {activeTab === 'observations' && (
          <ObservationsTab
            observations={observations}
            isLoading={obsLoading}
          />
        )}
        {activeTab === 'reviews' && (
          <ReviewsTab reviews={reviews} isLoading={reviewsLoading} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab observations={observations} reviews={reviews} />
        )}
      </div>
    </div>
  )
}

// ── Children Tab ──

function ChildrenTab({
  children,
  isLoading,
}: {
  children: ChildData[]
  isLoading: boolean
}) {
  if (isLoading) return <LoadingSpinner message="Loading children..." />

  if (children.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No children enrolled"
        description="Children will appear here once they are registered to this campaign."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Age / DOB
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Gender
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Class
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Admission #
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {children.map((child) => {
            const age = child.dob ? formatChildAge(child.dob) : 'N/A'
            return (
              <tr key={child.id} className="transition-colors hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {child.name}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                  {age}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                  {child.gender
                    ? child.gender.charAt(0).toUpperCase() + child.gender.slice(1)
                    : 'N/A'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                  {child.class
                    ? `${child.class}${child.section ? `-${child.section}` : ''}`
                    : 'N/A'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500">
                  {child.admissionNumber || '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Observations Tab ──

function ObservationsTab({
  observations,
  isLoading,
}: {
  observations: ObservationData[]
  isLoading: boolean
}) {
  if (isLoading) return <LoadingSpinner message="Loading observations..." />

  if (observations.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No observations yet"
        description="Observations will appear here once screenings are recorded."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Module
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Child
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Risk
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {observations.map((obs) => {
            const risk = obs.aiAnnotations?.[0]?.riskCategory
            return (
              <tr key={obs.id} className="transition-colors hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <span className="text-sm font-medium text-gray-900">
                    {getModuleName(obs.moduleType)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                  {obs.childName || obs.childId || 'Unknown'}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {risk ? (
                    <StatusBadge status={risk} />
                  ) : (
                    <span className="text-xs text-gray-400">N/A</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <StatusBadge status={obs.status ?? 'pending'} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {obs.timestamp
                      ? new Date(obs.timestamp).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Reviews Tab ──

function ReviewsTab({
  reviews,
  isLoading,
}: {
  reviews: ReviewData[]
  isLoading: boolean
}) {
  if (isLoading) return <LoadingSpinner message="Loading reviews..." />

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={FileCheck2}
        title="No reviews yet"
        description="Clinician reviews will appear here once observations are reviewed."
      />
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="rounded-xl border border-gray-200 bg-white p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {review.clinicianName || 'Clinician'}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {review.childName && `Patient: ${review.childName}`}
                {review.moduleType && ` | Module: ${getModuleName(review.moduleType)}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {review.decision && <StatusBadge status={review.decision} />}
              {review.qualityRating && (
                <StatusBadge status={review.qualityRating} />
              )}
            </div>
          </div>

          {review.notes && (
            <p className="mt-3 text-sm text-gray-600">{review.notes}</p>
          )}

          {review.fourDFindings && review.fourDFindings.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500">4D Findings:</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {review.fourDFindings.map((finding, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                  >
                    {finding}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-400">
            {review.timestamp
              ? new Date(review.timestamp).toLocaleString()
              : ''}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── Analytics Tab ──

function AnalyticsTab({
  observations,
  reviews,
}: {
  observations: ObservationData[]
  reviews: ReviewData[]
}) {
  const qualityStats = computeNurseQualityStats(observations)

  // Count observations by module
  const moduleCounts: Record<string, number> = {}
  for (const obs of observations) {
    moduleCounts[obs.moduleType] = (moduleCounts[obs.moduleType] || 0) + 1
  }
  const sortedModules = Object.entries(moduleCounts).sort(
    ([, a], [, b]) => b - a,
  )

  // Risk distribution
  const riskCounts = { no_risk: 0, possible_risk: 0, high_risk: 0, unknown: 0 }
  for (const obs of observations) {
    const risk = obs.aiAnnotations?.[0]?.riskCategory
    if (risk && risk in riskCounts) {
      riskCounts[risk as keyof typeof riskCounts]++
    } else {
      riskCounts.unknown++
    }
  }

  // Review decisions
  const decisionCounts: Record<string, number> = {}
  for (const r of reviews) {
    if (r.decision) {
      decisionCounts[r.decision] = (decisionCounts[r.decision] || 0) + 1
    }
  }

  return (
    <div className="space-y-6">
      {/* Quality Overview */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Data Quality Overview
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {qualityStats.averageScore}%
            </p>
            <p className="text-xs text-gray-500">Avg. Quality Score</p>
          </div>
          <div className="rounded-lg bg-green-50 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">
              {qualityStats.good}
            </p>
            <p className="text-xs text-gray-500">Good Quality</p>
          </div>
          <div className="rounded-lg bg-yellow-50 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-700">
              {qualityStats.fair}
            </p>
            <p className="text-xs text-gray-500">Fair Quality</p>
          </div>
          <div className="rounded-lg bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">
              {qualityStats.poor}
            </p>
            <p className="text-xs text-gray-500">Poor Quality</p>
          </div>
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Risk Distribution
        </h3>
        {observations.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">
            No observation data available.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <RiskBar
              label="No Risk"
              count={riskCounts.no_risk}
              total={observations.length}
              color="bg-green-500"
            />
            <RiskBar
              label="Possible Risk"
              count={riskCounts.possible_risk}
              total={observations.length}
              color="bg-yellow-500"
            />
            <RiskBar
              label="High Risk"
              count={riskCounts.high_risk}
              total={observations.length}
              color="bg-red-500"
            />
            <RiskBar
              label="Unknown"
              count={riskCounts.unknown}
              total={observations.length}
              color="bg-gray-400"
            />
          </div>
        )}
      </div>

      {/* Observations by Module */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">
          Observations by Module
        </h3>
        {sortedModules.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No data.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {sortedModules.map(([mod, count]) => (
              <div key={mod} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  {getModuleName(mod)}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{
                        width: `${Math.min(100, (count / observations.length) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-gray-500">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Decisions */}
      {reviews.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900">
            Review Decisions
          </h3>
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(decisionCounts).map(([decision, count]) => (
              <div
                key={decision}
                className="rounded-lg border border-gray-200 px-4 py-3 text-center"
              >
                <p className="text-xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">
                  {decision.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
              </div>
            ))}
          </div>
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

function formatChildAge(dob: string): string {
  try {
    const birthDate = new Date(dob)
    const now = new Date()
    const totalMonths =
      (now.getFullYear() - birthDate.getFullYear()) * 12 +
      (now.getMonth() - birthDate.getMonth())
    if (totalMonths < 12) return `${totalMonths} months`
    const years = Math.floor(totalMonths / 12)
    const months = totalMonths % 12
    if (months === 0) return `${years} years`
    return `${years}y ${months}m`
  } catch {
    return dob
  }
}
