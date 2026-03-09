import { useState, useMemo, useCallback } from 'react'
import {
  Inbox,
  ChevronDown,
  ChevronRight,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  ArrowUpDown,
  Save,
  Loader2,
  FileCheck2,
  Stethoscope,
} from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { useApi } from '../lib/hooks'
import { apiCall } from '../lib/api'
import { useAuth } from '../lib/auth'
import { getModuleName, computeObservationQuality } from '@skids/shared'

// ── Types ──

interface CampaignRow {
  code: string
  name: string
  schoolName?: string
  status: string
}

interface CampaignsResponse {
  campaigns: CampaignRow[]
}

interface ChildData {
  id: string
  name: string
  dob?: string
  gender?: string
  class?: string
  section?: string
}

interface ChildrenResponse {
  children: ChildData[]
}

interface ObservationData {
  id: string
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

interface ObservationsResponse {
  observations: ObservationData[]
}

interface ReviewData {
  id: string
  observationId?: string
  clinicianId?: string
  clinicianName?: string
  decision?: string
  qualityRating?: string
  notes?: string
  timestamp?: string
}

interface ReviewsResponse {
  reviews: ReviewData[]
}

type FilterMode = 'all' | 'high_risk' | 'pending' | 'completed'
type SortMode = 'risk' | 'name' | 'date'
type Decision = 'approve' | 'refer' | 'follow_up' | 'discharge' | 'retake'
type QualityRating = 'good' | 'fair' | 'poor'

interface DraftReview {
  decision?: Decision
  qualityRating?: QualityRating
  notes: string
}

interface ChildGroup {
  child: ChildData
  observations: ObservationData[]
  riskCounts: { high_risk: number; possible_risk: number; no_risk: number }
  reviewStatus: 'pending' | 'partial' | 'complete'
  highestRisk: number
  latestTimestamp: string
}

// ── Main Page ──

export function DoctorInboxPage() {
  const { user } = useAuth()
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [expandedChild, setExpandedChild] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [sort, setSort] = useState<SortMode>('risk')
  const [drafts, setDrafts] = useState<Record<string, DraftReview>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [bulkSaving, setBulkSaving] = useState(false)

  // Fetch campaigns
  const { data: campaignsData, isLoading: campaignsLoading } =
    useApi<CampaignsResponse>('/api/campaigns')

  // Fetch data for selected campaign
  const campaignQuery = selectedCampaign ? `campaign=${selectedCampaign}` : ''
  const { data: childrenData, isLoading: childrenLoading } =
    useApi<ChildrenResponse>(selectedCampaign ? `/api/children?${campaignQuery}` : null)
  const { data: obsData, isLoading: obsLoading, refetch: refetchObs } =
    useApi<ObservationsResponse>(selectedCampaign ? `/api/observations?${campaignQuery}` : null)
  const { data: reviewsData, isLoading: reviewsLoading, refetch: refetchReviews } =
    useApi<ReviewsResponse>(selectedCampaign ? `/api/reviews?${campaignQuery}` : null)

  const campaigns = campaignsData?.campaigns ?? []
  const children = childrenData?.children ?? []
  const observations = obsData?.observations ?? []
  const reviews = reviewsData?.reviews ?? []

  const isDataLoading = childrenLoading || obsLoading || reviewsLoading

  // Build review lookup: observationId -> ReviewData
  const reviewByObsId = useMemo(() => {
    const map: Record<string, ReviewData> = {}
    for (const r of reviews) {
      if (r.observationId) map[r.observationId] = r
    }
    return map
  }, [reviews])

  // Group observations by child and compute risk summaries
  const childGroups = useMemo((): ChildGroup[] => {
    const obsByChild: Record<string, ObservationData[]> = {}
    for (const obs of observations) {
      const cid = obs.childId || 'unknown'
      if (!obsByChild[cid]) obsByChild[cid] = []
      obsByChild[cid].push(obs)
    }

    const childMap: Record<string, ChildData> = {}
    for (const c of children) {
      childMap[c.id] = c
    }

    return Object.entries(obsByChild).map(([childId, childObs]) => {
      const child = childMap[childId] || {
        id: childId,
        name: childObs[0]?.childName || 'Unknown Child',
      }

      const riskCounts = { high_risk: 0, possible_risk: 0, no_risk: 0 }
      let latestTimestamp = ''
      for (const obs of childObs) {
        const risk = obs.aiAnnotations?.[0]?.riskCategory
        if (risk === 'high_risk') riskCounts.high_risk++
        else if (risk === 'possible_risk') riskCounts.possible_risk++
        else riskCounts.no_risk++
        if (obs.timestamp && obs.timestamp > latestTimestamp) {
          latestTimestamp = obs.timestamp
        }
      }

      const reviewedCount = childObs.filter((o) => reviewByObsId[o.id]).length
      let reviewStatus: 'pending' | 'partial' | 'complete' = 'pending'
      if (reviewedCount > 0 && reviewedCount >= childObs.length) reviewStatus = 'complete'
      else if (reviewedCount > 0) reviewStatus = 'partial'

      const highestRisk = riskCounts.high_risk > 0 ? 2 : riskCounts.possible_risk > 0 ? 1 : 0

      return { child, observations: childObs, riskCounts, reviewStatus, highestRisk, latestTimestamp }
    })
  }, [observations, children, reviewByObsId])

  // Filter
  const filteredGroups = useMemo(() => {
    return childGroups.filter((g) => {
      if (filter === 'high_risk') return g.riskCounts.high_risk > 0
      if (filter === 'pending') return g.reviewStatus !== 'complete'
      if (filter === 'completed') return g.reviewStatus === 'complete'
      return true
    })
  }, [childGroups, filter])

  // Sort
  const sortedGroups = useMemo(() => {
    const sorted = [...filteredGroups]
    if (sort === 'risk') {
      sorted.sort((a, b) => b.highestRisk - a.highestRisk || a.child.name.localeCompare(b.child.name))
    } else if (sort === 'name') {
      sorted.sort((a, b) => a.child.name.localeCompare(b.child.name))
    } else if (sort === 'date') {
      sorted.sort((a, b) => (b.latestTimestamp || '').localeCompare(a.latestTimestamp || ''))
    }
    return sorted
  }, [filteredGroups, sort])

  // Draft review helpers
  const getDraft = useCallback(
    (obsId: string): DraftReview => drafts[obsId] || { notes: '' },
    [drafts],
  )

  const updateDraft = useCallback((obsId: string, patch: Partial<DraftReview>) => {
    setDrafts((prev) => ({
      ...prev,
      [obsId]: { ...prev[obsId] || { notes: '' }, ...patch },
    }))
  }, [])

  // Save single review
  const saveReview = useCallback(
    async (obsId: string) => {
      const draft = drafts[obsId]
      if (!draft?.decision) return
      setSaving((prev) => ({ ...prev, [obsId]: true }))
      try {
        await apiCall('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({
            observationId: obsId,
            campaignCode: selectedCampaign,
            clinicianId: user?.id,
            clinicianName: user?.name,
            decision: draft.decision,
            qualityRating: draft.qualityRating,
            notes: draft.notes || undefined,
          }),
        })
        setDrafts((prev) => {
          const next = { ...prev }
          delete next[obsId]
          return next
        })
        refetchReviews()
        refetchObs()
      } catch {
        // Error handled silently; user can retry
      } finally {
        setSaving((prev) => ({ ...prev, [obsId]: false }))
      }
    },
    [drafts, selectedCampaign, user, refetchReviews, refetchObs],
  )

  // Bulk save all drafts that have a decision
  const saveBulkReviews = useCallback(async () => {
    const actionable = Object.entries(drafts).filter(([, d]) => d.decision)
    if (actionable.length === 0) return
    setBulkSaving(true)
    try {
      await Promise.all(
        actionable.map(([obsId, draft]) =>
          apiCall('/api/reviews', {
            method: 'POST',
            body: JSON.stringify({
              observationId: obsId,
              campaignCode: selectedCampaign,
              clinicianId: user?.id,
              clinicianName: user?.name,
              decision: draft.decision,
              qualityRating: draft.qualityRating,
              notes: draft.notes || undefined,
            }),
          }),
        ),
      )
      setDrafts({})
      refetchReviews()
      refetchObs()
    } catch {
      // Error handled silently; user can retry
    } finally {
      setBulkSaving(false)
    }
  }, [drafts, selectedCampaign, user, refetchReviews, refetchObs])

  const pendingDraftCount = Object.values(drafts).filter((d) => d.decision).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctor Inbox</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review screening observations and provide clinical decisions.
          </p>
        </div>
        {pendingDraftCount > 0 && (
          <button
            onClick={saveBulkReviews}
            disabled={bulkSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save All Reviews ({pendingDraftCount})
          </button>
        )}
      </div>

      {/* Campaign selector */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Select Campaign
        </label>
        {campaignsLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading campaigns...
          </div>
        ) : (
          <select
            value={selectedCampaign}
            onChange={(e) => {
              setSelectedCampaign(e.target.value)
              setExpandedChild(null)
              setDrafts({})
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Choose a campaign --</option>
            {campaigns.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name || c.schoolName || c.code} ({c.status})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* No campaign selected */}
      {!selectedCampaign && (
        <EmptyState
          icon={Inbox}
          title="Select a campaign"
          description="Choose a campaign above to view observations awaiting review."
        />
      )}

      {/* Loading state */}
      {selectedCampaign && isDataLoading && (
        <LoadingSpinner message="Loading observations..." />
      )}

      {/* Main content */}
      {selectedCampaign && !isDataLoading && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{childGroups.length}</p>
              <p className="text-xs text-gray-500">Children</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-red-600">
                {childGroups.reduce((s, g) => s + g.riskCounts.high_risk, 0)}
              </p>
              <p className="text-xs text-gray-500">High Risk</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {childGroups.filter((g) => g.reviewStatus === 'pending').length}
              </p>
              <p className="text-xs text-gray-500">Pending Review</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {childGroups.filter((g) => g.reviewStatus === 'complete').length}
              </p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>

          {/* Filter & sort controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-gray-400" />
              {(['all', 'high_risk', 'pending', 'completed'] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'high_risk' ? 'High Risk' : f === 'pending' ? 'Pending Review' : 'Completed'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-4 w-4 text-gray-400" />
              {(['risk', 'name', 'date'] as SortMode[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    sort === s
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s === 'risk' ? 'Risk Level' : s === 'name' ? 'Name' : 'Date'}
                </button>
              ))}
            </div>
          </div>

          {/* Child list */}
          {sortedGroups.length === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="No matching children"
              description="Adjust your filters or select a different campaign."
            />
          ) : (
            <div className="space-y-3">
              {sortedGroups.map((group) => (
                <ChildRow
                  key={group.child.id}
                  group={group}
                  expanded={expandedChild === group.child.id}
                  onToggle={() =>
                    setExpandedChild(expandedChild === group.child.id ? null : group.child.id)
                  }
                  reviewByObsId={reviewByObsId}
                  getDraft={getDraft}
                  updateDraft={updateDraft}
                  saveReview={saveReview}
                  saving={saving}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Child Row ──

function ChildRow({
  group,
  expanded,
  onToggle,
  reviewByObsId,
  getDraft,
  updateDraft,
  saveReview,
  saving,
}: {
  group: ChildGroup
  expanded: boolean
  onToggle: () => void
  reviewByObsId: Record<string, ReviewData>
  getDraft: (obsId: string) => DraftReview
  updateDraft: (obsId: string, patch: Partial<DraftReview>) => void
  saveReview: (obsId: string) => void
  saving: Record<string, boolean>
}) {
  const { child, observations: childObs, riskCounts, reviewStatus } = group
  const age = child.dob ? formatAge(child.dob) : null

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* Child summary row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <User className="h-5 w-5 text-blue-600" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{child.name}</p>
            {age && <span className="text-xs text-gray-400">{age}</span>}
            {child.gender && (
              <span className="text-xs text-gray-400">
                {child.gender.charAt(0).toUpperCase() + child.gender.slice(1)}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>{childObs.length} observation{childObs.length !== 1 ? 's' : ''}</span>
            {child.class && (
              <span>Class {child.class}{child.section ? `-${child.section}` : ''}</span>
            )}
          </div>
        </div>

        {/* Risk pills */}
        <div className="flex items-center gap-2">
          {riskCounts.high_risk > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
              <AlertTriangle className="h-3 w-3" />
              {riskCounts.high_risk}
            </span>
          )}
          {riskCounts.possible_risk > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
              <Clock className="h-3 w-3" />
              {riskCounts.possible_risk}
            </span>
          )}
          {riskCounts.no_risk > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              <CheckCircle2 className="h-3 w-3" />
              {riskCounts.no_risk}
            </span>
          )}
        </div>

        <StatusBadge status={reviewStatus} />

        {expanded ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
        )}
      </button>

      {/* Expanded observations */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <div className="space-y-4">
            {childObs.map((obs) => (
              <ObservationCard
                key={obs.id}
                obs={obs}
                existingReview={reviewByObsId[obs.id]}
                draft={getDraft(obs.id)}
                onUpdateDraft={(patch) => updateDraft(obs.id, patch)}
                onSave={() => saveReview(obs.id)}
                isSaving={saving[obs.id] || false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Observation Card with Inline Review ──

const DECISIONS: { value: Decision; label: string; color: string }[] = [
  { value: 'approve', label: 'Approve', color: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
  { value: 'refer', label: 'Refer', color: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200' },
  { value: 'discharge', label: 'Discharge', color: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
  { value: 'retake', label: 'Retake', color: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200' },
]

const QUALITY_OPTIONS: { value: QualityRating; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
]

function ObservationCard({
  obs,
  existingReview,
  draft,
  onUpdateDraft,
  onSave,
  isSaving,
}: {
  obs: ObservationData
  existingReview?: ReviewData
  draft: DraftReview
  onUpdateDraft: (patch: Partial<DraftReview>) => void
  onSave: () => void
  isSaving: boolean
}) {
  const risk = obs.aiAnnotations?.[0]?.riskCategory
  const summaryText = obs.aiAnnotations?.[0]?.summaryText
  const quality = computeObservationQuality(obs)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {/* Observation info */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
            <Stethoscope className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {getModuleName(obs.moduleType)}
            </p>
            <p className="text-xs text-gray-400">
              {obs.timestamp ? new Date(obs.timestamp).toLocaleString() : 'No date'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {risk && <StatusBadge status={risk} />}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              quality.grade === 'good'
                ? 'bg-green-100 text-green-700'
                : quality.grade === 'fair'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}
          >
            Q: {quality.overall}%
          </span>
        </div>
      </div>

      {summaryText && (
        <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{summaryText}</p>
      )}

      {/* Existing review display */}
      {existingReview && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-xs font-semibold text-green-800">Reviewed</span>
            {existingReview.decision && <StatusBadge status={existingReview.decision} />}
            {existingReview.qualityRating && <StatusBadge status={existingReview.qualityRating} />}
          </div>
          {existingReview.notes && (
            <p className="mt-1.5 text-xs text-green-700">{existingReview.notes}</p>
          )}
          <p className="mt-1 text-xs text-green-500">
            By {existingReview.clinicianName || 'Clinician'}{' '}
            {existingReview.timestamp && `on ${new Date(existingReview.timestamp).toLocaleDateString()}`}
          </p>
        </div>
      )}

      {/* Inline review form (only if no existing review) */}
      {!existingReview && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          {/* Decision buttons */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Decision</p>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => onUpdateDraft({ decision: d.value })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    draft.decision === d.value
                      ? `${d.color} ring-2 ring-offset-1 ring-blue-400`
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality rating */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Quality Rating</p>
            <div className="flex gap-2">
              {QUALITY_OPTIONS.map((q) => (
                <button
                  key={q.value}
                  onClick={() => onUpdateDraft({ qualityRating: q.value })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    draft.qualityRating === q.value
                      ? 'border-blue-300 bg-blue-50 text-blue-700 ring-2 ring-offset-1 ring-blue-400'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Notes</p>
            <textarea
              value={draft.notes}
              onChange={(e) => onUpdateDraft({ notes: e.target.value })}
              placeholder="Add clinical notes..."
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={onSave}
              disabled={!draft.decision || isSaving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Review
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──

function formatAge(dob: string): string {
  try {
    const birthDate = new Date(dob)
    const now = new Date()
    const totalMonths =
      (now.getFullYear() - birthDate.getFullYear()) * 12 +
      (now.getMonth() - birthDate.getMonth())
    if (totalMonths < 12) return `${totalMonths}m`
    const years = Math.floor(totalMonths / 12)
    const months = totalMonths % 12
    if (months === 0) return `${years}y`
    return `${years}y ${months}m`
  } catch {
    return dob
  }
}
