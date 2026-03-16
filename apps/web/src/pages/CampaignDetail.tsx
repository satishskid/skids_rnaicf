import { useState, useRef } from 'react'
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
  Upload,
  Download,
  FileText,
  Loader2,
  Share2,
  X,
  Copy,
  Check,
  ExternalLink,
  Search,
} from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useAuth } from '../lib/auth'
import { EmptyState } from '../components/EmptyState'
import { CampaignProgress } from '../components/CampaignProgress'
import { useApi } from '../lib/hooks'
import { apiCall } from '../lib/api'
import { getModuleName, computeNurseQualityStats } from '@skids/shared'
import { HealthCardPrintView } from '../components/report/HealthCard'

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
  qrCode?: string
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

type TabKey = 'children' | 'observations' | 'reviews' | 'analytics' | 'progress'

const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'progress', label: 'Progress', icon: BarChart3 },
  { key: 'children', label: 'Children', icon: Users },
  { key: 'observations', label: 'Observations', icon: ClipboardList },
  { key: 'reviews', label: 'Reviews', icon: FileCheck2 },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export function CampaignDetailPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'ops_manager'
  const [activeTab, setActiveTab] = useState<TabKey>('progress')
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [showHealthCards, setShowHealthCards] = useState(false)

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

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          <CsvImportButton campaignCode={code!} onImported={() => window.location.reload()} />
          <WelchAllynImportButton campaignCode={code!} children={children} />
          <a
            href={`https://skids-api.satish-9f4.workers.dev/api/campaigns/${code}/export`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </a>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowReleaseModal(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                Release Reports
              </button>
              <button
                onClick={() => setShowHealthCards(true)}
                className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Print Health Cards
              </button>
            </>
          )}
        </div>

        {/* Release Reports Modal */}
        {showReleaseModal && (
          <ReportReleaseModal
            campaignCode={code!}
            campaignName={campaign.name || campaign.schoolName || code!}
            childCount={campaign.totalChildren ?? children.length}
            onClose={() => setShowReleaseModal(false)}
          />
        )}

        {/* Health Cards Print View */}
        {showHealthCards && (
          <div className="fixed inset-0 z-50 bg-white overflow-auto">
            <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">QR Health Cards — {campaign.name || code}</h2>
              <button
                onClick={() => setShowHealthCards(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <HealthCardPrintView
              children={children.filter(c => c.qrCode).map(c => ({
                name: c.name,
                class: c.class,
                section: c.section,
                qrCode: c.qrCode!,
                schoolName: campaign.schoolName,
              }))}
              schoolName={campaign.schoolName}
              campaignName={campaign.name}
            />
            {children.filter(c => !c.qrCode).length > 0 && (
              <div className="no-print max-w-lg mx-auto px-6 py-4">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm text-amber-800 font-medium">
                    {children.filter(c => !c.qrCode).length} children don't have QR codes yet.
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Release reports to auto-generate QR codes, or they'll be generated at next enrollment.
                  </p>
                </div>
              </div>
            )}
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
                      : tab.key === 'progress'
                        ? `${children.length > 0 ? Math.round((observations.length / Math.max(children.length, 1)) * 100) : 0}%`
                        : '--'}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'progress' && (
          <CampaignProgress campaignCode={code!} />
        )}
        {activeTab === 'children' && (
          <ChildrenTab children={children} isLoading={childrenLoading} campaignCode={code!} />
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
  campaignCode,
}: {
  children: ChildData[]
  isLoading: boolean
  campaignCode: string
}) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

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

  const filtered = searchTerm.length >= 2
    ? children.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.admissionNumber && c.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.qrCode && c.qrCode.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : children

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, admission number, or QR code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {searchTerm.length >= 2 && (
        <p className="text-sm text-gray-500">
          Showing {filtered.length} of {children.length} children
        </p>
      )}

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
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-12 text-center text-sm text-gray-500">
                No children match &quot;{searchTerm}&quot;
              </td>
            </tr>
          ) : (
            filtered.map((child) => {
              const age = child.dob ? formatChildAge(child.dob) : 'N/A'
              return (
                <tr
                  key={child.id}
                  onClick={() => navigate(`/campaigns/${campaignCode}/children/${child.id}/report`)}
                  className="cursor-pointer transition-colors hover:bg-blue-50"
                >
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-700 underline-offset-2 hover:underline">
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
            })
          )}
        </tbody>
      </table>
      </div>
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

// ── CSV Import Button ──

function CsvImportButton({ campaignCode, onImported }: { campaignCode: string; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ added: number; skipped: number; errors?: string[] } | null>(null)

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return null

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'student_name' || h === 'child_name')
    const dobIdx = headers.findIndex(h => h === 'dob' || h === 'date_of_birth' || h === 'birthdate')
    const genderIdx = headers.findIndex(h => h === 'gender' || h === 'sex')
    const classIdx = headers.findIndex(h => h === 'class' || h === 'grade' || h === 'standard')
    const sectionIdx = headers.findIndex(h => h === 'section' || h === 'division')
    const admIdx = headers.findIndex(h => h === 'admission_number' || h === 'admission_no' || h === 'roll_no')

    if (nameIdx === -1) return null

    return lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim())
      return {
        name: cols[nameIdx] || '',
        dob: dobIdx >= 0 ? cols[dobIdx] : undefined,
        gender: genderIdx >= 0 ? cols[genderIdx]?.toLowerCase() : undefined,
        class: classIdx >= 0 ? cols[classIdx] : undefined,
        section: sectionIdx >= 0 ? cols[sectionIdx] : undefined,
        admissionNumber: admIdx >= 0 ? cols[admIdx] : undefined,
      }
    }).filter(c => c.name)
  }

  const parseExcel = async (data: ArrayBuffer) => {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(data, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    if (json.length === 0) return null

    const headers = Object.keys(json[0])
    const find = (patterns: RegExp[]) => headers.find(h => patterns.some(p => p.test(h)))
    const nameCol = find([/^name$/i, /student.?name/i, /child.?name/i])
    const dobCol = find([/dob/i, /date.?of.?birth/i, /birth.?date/i])
    const genderCol = find([/gender/i, /^sex$/i])
    const classCol = find([/class/i, /grade/i, /standard/i])
    const sectionCol = find([/section/i, /division/i])
    const admCol = find([/stud?ent.?id/i, /admission/i, /roll.?no/i, /enrol/i])

    if (!nameCol) return null

    return json.map(row => {
      const g = String(row[genderCol!] || '').trim().toLowerCase()
      let dobStr: string | undefined
      if (dobCol) {
        const v = row[dobCol]
        if (v instanceof Date) dobStr = v.toISOString().slice(0, 10)
        else if (typeof v === 'number') {
          const d = XLSX.SSF.parse_date_code(v)
          if (d) dobStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
        } else if (v) {
          const parsed = new Date(String(v))
          if (!isNaN(parsed.getTime())) dobStr = parsed.toISOString().slice(0, 10)
        }
      }
      return {
        name: String(row[nameCol] || '').trim(),
        dob: dobStr,
        gender: ['male','m','boy'].includes(g) ? 'male' : ['female','f','girl'].includes(g) ? 'female' : undefined,
        class: classCol ? String(row[classCol] || '').trim() || undefined : undefined,
        section: sectionCol ? String(row[sectionCol] || '').trim() || undefined : undefined,
        admissionNumber: admCol ? String(row[admCol] || '').trim() || undefined : undefined,
      }
    }).filter(c => c.name)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setResult(null)

    try {
      let children: ReturnType<typeof parseCSV>
      const isExcel = /\.xlsx?$/i.test(file.name)
      if (isExcel) {
        const buf = await file.arrayBuffer()
        children = await parseExcel(buf)
      } else {
        const text = await file.text()
        children = parseCSV(text)
      }

      if (!children || children.length === 0) {
        setResult({ added: 0, skipped: 0, errors: ['Could not find a "name" column in the file'] })
        setImporting(false)
        return
      }

      // Upload in batches of 25
      let totalAdded = 0, totalSkipped = 0
      const BATCH = 25
      for (let i = 0; i < children.length; i += BATCH) {
        const batch = children.slice(i, i + BATCH)
        const res = await apiCall<{ added: number; skipped: number }>(
          `/api/campaigns/${campaignCode}/children`,
          { method: 'POST', body: JSON.stringify({ children: batch }) }
        )
        totalAdded += res.added
        totalSkipped += res.skipped
      }
      setResult({ added: totalAdded, skipped: totalSkipped })
      if (totalAdded > 0) onImported()
    } catch (err) {
      setResult({ added: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="inline-flex flex-col">
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {importing ? 'Importing...' : 'Import Children (Excel/CSV)'}
      </button>
      {result && (
        <p className={`mt-1 text-xs ${result.errors?.length ? 'text-red-600' : 'text-green-600'}`}>
          {result.errors?.length ? result.errors[0] : `Added ${result.added}, skipped ${result.skipped} duplicates`}
        </p>
      )}
    </div>
  )
}

// ── Welch Allyn Import Button ──

function WelchAllynImportButton({ campaignCode, children: campaignChildren }: { campaignCode: string; children: ChildData[] }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ stored?: number; error?: string } | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setResult(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) {
        setResult({ error: 'CSV must have a header row and at least one data row' })
        setImporting(false)
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      // Expected Welch Allyn Spot CSV columns
      const recordIdIdx = headers.findIndex(h => h.includes('record') || h.includes('id'))
      const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('patient'))
      const timestampIdx = headers.findIndex(h => h.includes('date') || h.includes('time'))
      const resultIdx = headers.findIndex(h => h.includes('result') || h.includes('pass') || h.includes('screening'))
      const odIdx = headers.findIndex(h => h.includes('od') || h.includes('right'))
      const osIdx = headers.findIndex(h => h.includes('os') || h.includes('left'))

      const observations = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim())
        const patientName = nameIdx >= 0 ? cols[nameIdx] : ''
        const resultText = resultIdx >= 0 ? cols[resultIdx] : ''
        const passed = resultText.toLowerCase().includes('pass') || resultText.toLowerCase().includes('normal')

        // Try to match to a campaign child by name
        const matchedChild = campaignChildren.find(c =>
          c.name.toLowerCase() === patientName.toLowerCase() ||
          c.name.toLowerCase().includes(patientName.toLowerCase()) ||
          patientName.toLowerCase().includes(c.name.toLowerCase())
        )

        const riskCategory = passed ? 'no_risk' : resultText.toLowerCase().includes('refer') ? 'high' : 'medium'

        return {
          childId: matchedChild?.id || `unmatched_${patientName.replace(/\s+/g, '_')}`,
          childName: patientName,
          screeningData: {
            recordId: recordIdIdx >= 0 ? cols[recordIdIdx] : `spot_${Date.now()}`,
            timestamp: timestampIdx >= 0 ? cols[timestampIdx] : new Date().toISOString(),
            passed,
            resultText,
            od: odIdx >= 0 ? { raw: cols[odIdx] } : undefined,
            os: osIdx >= 0 ? { raw: cols[osIdx] } : undefined,
          },
          mapping: {
            suggestedChips: passed ? ['normal_vision'] : ['vision_concern'],
            summaryText: `Welch Allyn Spot: ${resultText || (passed ? 'Pass' : 'Refer')}`,
            riskCategory,
          },
        }
      }).filter(o => o.childName)

      const res = await apiCall<{ stored: number }>(
        `/api/campaigns/${campaignCode}/welchallyn`,
        { method: 'POST', body: JSON.stringify({ observations }) }
      )
      setResult({ stored: res.stored })
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Import failed' })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="inline-flex flex-col">
      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
      >
        {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {importing ? 'Importing...' : 'Welch Allyn Import'}
      </button>
      {result && (
        <p className={`mt-1 text-xs ${result.error ? 'text-red-600' : 'text-green-600'}`}>
          {result.error || `Imported ${result.stored} vision screening results`}
        </p>
      )}
    </div>
  )
}

// ── Report Release Modal ──

interface ReleaseToken {
  childId: string
  childName: string
  token: string
  childClass?: string
}

function ReportReleaseModal({
  campaignCode,
  campaignName,
  childCount,
  onClose,
}: {
  campaignCode: string
  campaignName: string
  childCount: number
  onClose: () => void
}) {
  const [releasing, setReleasing] = useState(false)
  const [released, setReleased] = useState(false)
  const [result, setResult] = useState<{
    released: number
    skipped: number
    total: number
    expiresAt: string
    tokens: ReleaseToken[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleRelease() {
    setReleasing(true)
    setError(null)
    try {
      const data = await apiCall<{
        released: number
        skipped: number
        total: number
        expiresAt: string
        tokens: ReleaseToken[]
      }>('/api/report-tokens/bulk-release', {
        method: 'POST',
        body: JSON.stringify({ campaignCode, expiresInDays: 30 }),
      })
      setResult(data)
      setReleased(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release reports')
    } finally {
      setReleasing(false)
    }
  }

  function copyAllLinks() {
    if (!result) return
    const base = window.location.origin
    const lines = result.tokens.map(
      (t) => `${t.childName}${t.childClass ? ` (Class ${t.childClass})` : ''}\t${base}/report/${t.token}`
    )
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadCSV() {
    if (!result) return
    const base = window.location.origin
    const rows = [
      'Child Name,Class,Report Link',
      ...result.tokens.map(
        (t) => `"${t.childName}","${t.childClass || ''}","${base}/report/${t.token}"`
      ),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaignCode}-report-links.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Release Reports</h3>
            <p className="text-xs text-gray-500 mt-0.5">{campaignName} &mdash; {childCount} children</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!released ? (
            <>
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  This will generate unique report links for <span className="font-semibold">{childCount}</span> children
                  in this campaign. Each link is valid for 30 days and requires no login.
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Parents can view their child's screening report by opening the link or scanning a QR code.
                  Children who already have report links will be skipped.
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleRelease}
                disabled={releasing}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {releasing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating report links...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Release All Reports
                  </>
                )}
              </button>
            </>
          ) : result ? (
            <>
              {/* Success summary */}
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-sm font-medium text-green-800">
                  Reports released successfully!
                </p>
                <div className="mt-2 flex gap-4 text-xs text-green-700">
                  <span><span className="font-semibold">{result.released}</span> new links</span>
                  <span><span className="font-semibold">{result.skipped}</span> already existed</span>
                  <span><span className="font-semibold">{result.total}</span> total children</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Expires: {new Date(result.expiresAt).toLocaleDateString()}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={copyAllLinks}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy All Links'}
                </button>
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </button>
              </div>

              {/* Token list */}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Child</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Class</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Report Link</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.tokens.map((t) => (
                      <tr key={t.childId} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{t.childName}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">{t.childClass || '-'}</td>
                        <td className="px-4 py-2.5">
                          <code className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            /report/{t.token}
                          </code>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={`${window.location.origin}/report/${t.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="Open report"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(`Health report for ${t.childName}: ${window.location.origin}/report/${t.token}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-800 p-1"
                              title="Share via WhatsApp"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            {released ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
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
