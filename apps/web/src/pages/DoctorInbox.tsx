import { useState, useEffect, useMemo, useCallback } from 'react'
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
  Brain,
  Image as ImageIcon,
  X,
  Search,
  ChevronLeft,
  ShieldCheck,
  FileText,
} from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { MedicalDisclaimer } from '../components/MedicalDisclaimer'
import { ConfidenceBadge } from '../components/ConfidenceBadge'
import { useApi } from '../lib/hooks'
import { apiCall } from '../lib/api'
import { useAuth } from '../lib/auth'
import { getModuleName, getModuleConfig, computeObservationQuality } from '@skids/shared'
import {
  buildClinicalPrompt,
  queryLLM,
  DEFAULT_LLM_CONFIG,
  type LLMConfig,
  type LLMResponse,
} from '../lib/ai/llm-gateway'

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
type ModuleFilter = 'all' | string
type SortMode = 'risk' | 'name' | 'date'
type Decision = 'approve' | 'refer' | 'follow_up' | 'discharge' | 'retake'
type QualityRating = 'good' | 'fair' | 'poor'

interface ChipVerdict {
  confirmed: boolean // true = agree, false = disagree
  correctedSeverity?: string // doctor's corrected severity
  note?: string
}

interface DraftReview {
  decision?: Decision
  qualityRating?: QualityRating
  notes: string
  chipVerdicts?: Record<string, ChipVerdict> // per-chip confirm/correct
}

interface ChildGroup {
  child: ChildData
  observations: ObservationData[]
  riskCounts: { high_risk: number; possible_risk: number; no_risk: number }
  reviewStatus: 'pending' | 'partial' | 'complete'
  highestRisk: number
  latestTimestamp: string
}

const SEVERITY_OPTIONS = ['normal', 'mild', 'moderate', 'severe'] as const

const BATCH_TEMPLATES: { label: string; decision: Decision; notes: string }[] = [
  { label: 'Refer to ENT', decision: 'refer', notes: 'Referred to ENT specialist for evaluation.' },
  { label: 'Refer to Ophthalmology', decision: 'refer', notes: 'Referred to ophthalmology for vision assessment.' },
  { label: 'Refer to Dermatology', decision: 'refer', notes: 'Referred to dermatologist for skin evaluation.' },
  { label: 'Nutritional Follow-up', decision: 'follow_up', notes: 'Nutritional counseling and follow-up in 4 weeks.' },
  { label: 'Growth Monitoring', decision: 'follow_up', notes: 'Growth monitoring — recheck height/weight in 3 months.' },
  { label: 'Dental Treatment', decision: 'refer', notes: 'Referred to dental clinic for caries treatment.' },
]

// ── Main Page ──

export function DoctorInboxPage() {
  const { user } = useAuth()
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [expandedChild, setExpandedChild] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [sort, setSort] = useState<SortMode>('risk')
  const [searchQuery, setSearchQuery] = useState('')
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all')
  const [drafts, setDrafts] = useState<Record<string, DraftReview>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)

  // Review speed tracking
  const [childExpandedAt, setChildExpandedAt] = useState<number | null>(null)
  const [reviewTimes, setReviewTimes] = useState<number[]>([])
  const avgReviewTime = reviewTimes.length > 0
    ? Math.round(reviewTimes.reduce((s, t) => s + t, 0) / reviewTimes.length)
    : 0

  // AI state
  const [aiSummaries, setAiSummaries] = useState<Record<string, { loading: boolean; text?: string; error?: string; responses?: LLMResponse[] }>>({})
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG)

  // Load org AI config + BYOK overrides
  useEffect(() => {
    async function loadAiConfig() {
      try {
        const orgId = (user as Record<string, unknown>)?.orgId as string || 'default'
        const res = await apiCall<{ config: Partial<LLMConfig> | null }>(`/api/ai-config/${orgId}`)
        const orgConfig = { ...DEFAULT_LLM_CONFIG, ...res.config }
        // Apply BYOK overrides from localStorage
        try {
          const byok = JSON.parse(localStorage.getItem('skids-doctor-byok') || '{}')
          if (byok.enabled && byok.apiKey) {
            orgConfig.cloudApiKey = byok.apiKey
            orgConfig.cloudProvider = byok.provider || orgConfig.cloudProvider
            if (orgConfig.mode === 'local_only') orgConfig.mode = 'local_first'
          }
        } catch { /* ignore */ }
        setLlmConfig(orgConfig)
      } catch { /* keep defaults */ }
    }
    loadAiConfig()
  }, [user])

  // Ask AI for a child summary
  const askAiForChild = useCallback(async (childId: string, childName: string, childAge: string, childObs: ObservationData[]) => {
    setAiSummaries(prev => ({ ...prev, [childId]: { loading: true } }))
    try {
      const obsForPrompt = childObs.map(obs => ({
        moduleType: obs.moduleType,
        moduleName: getModuleName(obs.moduleType),
        riskCategory: obs.aiAnnotations?.[0]?.riskCategory || 'unknown',
        summaryText: obs.aiAnnotations?.[0]?.summaryText || 'No AI summary',
        nurseChips: obs.annotationData?.selectedChips || [],
        chipSeverities: {} as Record<string, string>,
        aiFindings: [],
        notes: '',
      }))
      const messages = buildClinicalPrompt(childName, childAge, obsForPrompt)
      const responses = await queryLLM(llmConfig, messages)
      const best = responses.find(r => !r.error) || responses[0]
      if (best.error) {
        setAiSummaries(prev => ({ ...prev, [childId]: { loading: false, error: best.error, responses } }))
      } else {
        setAiSummaries(prev => ({ ...prev, [childId]: { loading: false, text: best.text, responses } }))
      }
    } catch (err) {
      setAiSummaries(prev => ({
        ...prev,
        [childId]: { loading: false, error: err instanceof Error ? err.message : 'AI request failed' },
      }))
    }
  }, [llmConfig])

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

  // Get unique module types for filter dropdown
  const uniqueModuleTypes = useMemo(() => {
    const types = new Set<string>()
    for (const obs of observations) types.add(obs.moduleType)
    return Array.from(types).sort()
  }, [observations])

  // Filter (includes search + module filter)
  const filteredGroups = useMemo(() => {
    return childGroups.map(g => {
      // If module filter is active, filter observations within each child
      if (moduleFilter !== 'all') {
        const filtered = g.observations.filter(o => o.moduleType === moduleFilter)
        if (filtered.length === 0) return null
        return { ...g, observations: filtered }
      }
      return g
    }).filter((g): g is ChildGroup => {
      if (!g) return false
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const nameMatch = g.child.name.toLowerCase().includes(q)
        const classMatch = g.child.class?.toLowerCase().includes(q)
        if (!nameMatch && !classMatch) return false
      }
      if (filter === 'high_risk') return g.riskCounts.high_risk > 0
      if (filter === 'pending') return g.reviewStatus !== 'complete'
      if (filter === 'completed') return g.reviewStatus === 'complete'
      return true
    })
  }, [childGroups, filter, searchQuery, moduleFilter])

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
            chipVerdicts: draft.chipVerdicts || undefined,
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

  // Bulk approve all no_risk observations that haven't been reviewed
  const approveAllNormal = useCallback(async () => {
    const normalObs = observations.filter(obs => {
      const risk = obs.aiAnnotations?.[0]?.riskCategory
      return (risk === 'no_risk' || !risk) && !reviewByObsId[obs.id]
    })
    if (normalObs.length === 0) return
    setBulkApproving(true)
    try {
      await Promise.all(
        normalObs.map(obs =>
          apiCall('/api/reviews', {
            method: 'POST',
            body: JSON.stringify({
              observationId: obs.id,
              campaignCode: selectedCampaign,
              clinicianId: user?.id,
              clinicianName: user?.name,
              decision: 'approve',
              qualityRating: 'good',
              notes: 'Auto-approved: no risk findings',
            }),
          }),
        ),
      )
      refetchReviews()
      refetchObs()
    } catch { /* user can retry */ }
    finally { setBulkApproving(false) }
  }, [observations, reviewByObsId, selectedCampaign, user, refetchReviews, refetchObs])

  const normalUnreviewedCount = observations.filter(obs => {
    const risk = obs.aiAnnotations?.[0]?.riskCategory
    return (risk === 'no_risk' || !risk) && !reviewByObsId[obs.id]
  }).length

  // Prev/next child navigation with timer tracking
  const currentChildIndex = sortedGroups.findIndex(g => g.child.id === expandedChild)

  const recordTimeAndNavigate = useCallback((newChildId: string | null) => {
    if (childExpandedAt && expandedChild) {
      const elapsed = Math.round((Date.now() - childExpandedAt) / 1000)
      if (elapsed > 2 && elapsed < 600) { // ignore < 2s (accidental) and > 10min (idle)
        setReviewTimes(prev => [...prev.slice(-49), elapsed]) // keep last 50
      }
    }
    setExpandedChild(newChildId)
    setChildExpandedAt(newChildId ? Date.now() : null)
  }, [childExpandedAt, expandedChild])

  const goToPrevChild = () => {
    if (currentChildIndex > 0) recordTimeAndNavigate(sortedGroups[currentChildIndex - 1].child.id)
  }
  const goToNextChild = () => {
    if (currentChildIndex < sortedGroups.length - 1) recordTimeAndNavigate(sortedGroups[currentChildIndex + 1].child.id)
  }

  // Draft auto-save to localStorage
  useEffect(() => {
    if (selectedCampaign && Object.keys(drafts).length > 0) {
      localStorage.setItem(`skids-inbox-drafts-${selectedCampaign}`, JSON.stringify(drafts))
    }
  }, [drafts, selectedCampaign])

  // Restore drafts from localStorage when campaign changes
  useEffect(() => {
    if (selectedCampaign) {
      try {
        const saved = localStorage.getItem(`skids-inbox-drafts-${selectedCampaign}`)
        if (saved) setDrafts(JSON.parse(saved))
      } catch { /* ignore */ }
    }
  }, [selectedCampaign])

  // Keyboard shortcuts for rapid review
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only when a child is expanded and not in a text input
      if (!expandedChild) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      const group = sortedGroups.find(g => g.child.id === expandedChild)
      if (!group) return

      // Find first unreviewed observation for keyboard action
      const firstUnreviewed = group.observations.find(o => !reviewByObsId[o.id])
      if (!firstUnreviewed) return
      const obsId = firstUnreviewed.id

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'a': // Ctrl+A = Approve
            e.preventDefault()
            updateDraft(obsId, { decision: 'approve' })
            break
          case 'r': // Ctrl+R = Refer
            e.preventDefault()
            updateDraft(obsId, { decision: 'refer' })
            break
          case 'f': // Ctrl+F = Follow Up
            e.preventDefault()
            updateDraft(obsId, { decision: 'follow_up' })
            break
          case 'd': // Ctrl+D = Discharge
            e.preventDefault()
            updateDraft(obsId, { decision: 'discharge' })
            break
          case 's': // Ctrl+S = Save review
            e.preventDefault()
            saveReview(obsId)
            break
        }
      } else {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            goToPrevChild()
            break
          case 'ArrowRight':
            e.preventDefault()
            goToNextChild()
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedChild, sortedGroups, reviewByObsId, updateDraft, saveReview, goToPrevChild, goToNextChild])

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
        <div className="flex items-center gap-2">
          {normalUnreviewedCount > 0 && selectedCampaign && (
            <button
              onClick={approveAllNormal}
              disabled={bulkApproving}
              className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
            >
              {bulkApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Approve Normal ({normalUnreviewedCount})
            </button>
          )}
          {pendingDraftCount > 0 && (
            <button
              onClick={saveBulkReviews}
              disabled={bulkSaving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All ({pendingDraftCount})
            </button>
          )}
        </div>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {avgReviewTime > 0 ? `${avgReviewTime}s` : '--'}
              </p>
              <p className="text-xs text-gray-500">Avg Review Time</p>
              {reviewTimes.length > 0 && (
                <p className="text-[9px] text-gray-400 mt-0.5">{reviewTimes.length} reviewed</p>
              )}
            </div>
          </div>

          {/* Search + Filter & sort controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search children..."
                className="w-48 rounded-lg border border-gray-300 py-1.5 pl-8 pr-7 text-xs text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
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
            {/* Module-type filter */}
            {uniqueModuleTypes.length > 1 && (
              <select
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Modules</option>
                {uniqueModuleTypes.map(mt => (
                  <option key={mt} value={mt}>{getModuleName(mt)}</option>
                ))}
              </select>
            )}
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
              {sortedGroups.map((group, idx) => (
                <ChildRow
                  key={group.child.id}
                  group={group}
                  expanded={expandedChild === group.child.id}
                  onToggle={() =>
                    recordTimeAndNavigate(expandedChild === group.child.id ? null : group.child.id)
                  }
                  reviewByObsId={reviewByObsId}
                  getDraft={getDraft}
                  updateDraft={updateDraft}
                  saveReview={saveReview}
                  saving={saving}
                  aiSummary={aiSummaries[group.child.id]}
                  onAskAi={askAiForChild}
                  onPrev={idx > 0 ? goToPrevChild : undefined}
                  onNext={idx < sortedGroups.length - 1 ? goToNextChild : undefined}
                  childIndex={idx + 1}
                  totalChildren={sortedGroups.length}
                  campaignCode={selectedCampaign}
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
  aiSummary,
  onAskAi,
  onPrev,
  onNext,
  childIndex,
  totalChildren,
  campaignCode,
}: {
  group: ChildGroup
  expanded: boolean
  onToggle: () => void
  reviewByObsId: Record<string, ReviewData>
  getDraft: (obsId: string) => DraftReview
  updateDraft: (obsId: string, patch: Partial<DraftReview>) => void
  saveReview: (obsId: string) => void
  saving: Record<string, boolean>
  aiSummary?: { loading: boolean; text?: string; error?: string; responses?: LLMResponse[] }
  onAskAi: (childId: string, childName: string, childAge: string, obs: ObservationData[]) => void
  onPrev?: () => void
  onNext?: () => void
  childIndex: number
  totalChildren: number
  campaignCode: string
}) {
  const { child, observations: childObs, riskCounts, reviewStatus } = group
  const age = child.dob ? formatAge(child.dob) : null

  // Group observations by module group (vitals vs head-to-toe)
  const vitalModuleTypes = ['height', 'weight', 'vitals', 'spo2', 'hemoglobin', 'bp', 'muac']
  const vitalObs = childObs.filter(o => vitalModuleTypes.includes(o.moduleType))
  const examObs = childObs.filter(o => !vitalModuleTypes.includes(o.moduleType))

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
          {/* Prev/Next navigation + actions */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onPrev?.() }}
                disabled={!onPrev}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span className="text-xs text-gray-400">{childIndex} of {totalChildren}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onNext?.() }}
                disabled={!onNext}
                className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAskAi(child.id, child.name, age || 'unknown', childObs)
                }}
                disabled={aiSummary?.loading}
                className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-60"
              >
                {aiSummary?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                {aiSummary?.loading ? 'Analyzing...' : aiSummary?.text ? 'Re-analyze' : 'AI Summary'}
              </button>
              <a
                href={`/campaigns/${campaignCode}/children/${child.id}/child-report`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <FileText className="h-3.5 w-3.5" /> Report
              </a>
              {aiSummary?.responses?.[0] && (
                <span className="text-[10px] text-gray-400">
                  {aiSummary.responses[0].provider} ({((aiSummary.responses[0].latencyMs || 0) / 1000).toFixed(1)}s)
                </span>
              )}
            </div>
          </div>

          {/* AI Summary result */}
          {aiSummary?.text && (
            <div className="mb-4 rounded-xl border-2 border-purple-200 bg-purple-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">AI Clinical Summary</span>
              </div>
              <div className="prose prose-xs max-w-none text-xs text-gray-700 whitespace-pre-wrap">
                {aiSummary.text}
              </div>
            </div>
          )}

          {aiSummary?.error && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-700">{aiSummary.error}</p>
              <p className="text-[10px] text-amber-500 mt-1">Ensure Ollama is running or configure cloud AI in Settings.</p>
            </div>
          )}

          {/* Medical disclaimer */}
          <MedicalDisclaimer variant="compact" className="mb-4" />

          {/* Module-grouped observations */}
          {vitalObs.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                Vitals ({vitalObs.length})
              </h4>
              <div className="space-y-3">
                {vitalObs.map((obs) => (
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

          {examObs.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Head-to-Toe Examination ({examObs.length})
              </h4>
              <div className="space-y-3">
                {examObs.map((obs) => (
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
          {obs.aiAnnotations?.[0]?.confidence != null && (
            <ConfidenceBadge confidence={obs.aiAnnotations[0].confidence} />
          )}
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

      {/* Nurse chips with per-chip confirm/correct */}
      {obs.annotationData?.selectedChips && obs.annotationData.selectedChips.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Findings ({obs.annotationData.selectedChips.length})</span>
            {!existingReview && (
              <span className="text-[9px] text-gray-400">Click to confirm/correct each finding</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {obs.annotationData.selectedChips.map(chip => {
              const chipSeverities = (obs.annotationData as Record<string, unknown>)?.chipSeverities as Record<string, string> | undefined
              const severity = chipSeverities?.[chip]
              const verdict = draft.chipVerdicts?.[chip]
              const isConfirmed = verdict?.confirmed === true
              const isRejected = verdict?.confirmed === false

              // Color: confirmed=green, rejected=red/strikethrough, default=severity-based
              const colorClass = isConfirmed
                ? 'bg-green-50 border-green-400 text-green-800 ring-1 ring-green-300'
                : isRejected
                  ? 'bg-red-50 border-red-300 text-red-500 line-through ring-1 ring-red-200'
                  : severity === 'severe' ? 'bg-red-50 border-red-200 text-red-700'
                    : severity === 'moderate' ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : severity === 'mild' ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-700'

              return (
                <span key={chip} className="inline-flex items-center gap-0.5">
                  <button
                    disabled={!!existingReview}
                    onClick={() => {
                      if (existingReview) return
                      const current = draft.chipVerdicts?.[chip]
                      let next: ChipVerdict
                      if (!current) {
                        next = { confirmed: true }
                      } else if (current.confirmed) {
                        next = { confirmed: false }
                      } else {
                        const updated = { ...draft.chipVerdicts }
                        delete updated[chip]
                        onUpdateDraft({ chipVerdicts: updated })
                        return
                      }
                      onUpdateDraft({
                        chipVerdicts: { ...draft.chipVerdicts, [chip]: next }
                      })
                    }}
                    className={`rounded-l-full border px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer ${colorClass} ${!existingReview ? 'hover:ring-2 hover:ring-blue-200' : ''}`}
                    title={isConfirmed ? 'Confirmed — click to reject' : isRejected ? 'Rejected — click to clear' : 'Click to confirm'}
                  >
                    {isConfirmed && '✓ '}{isRejected && '✗ '}{chip}{severity && severity !== 'normal' ? ` (${verdict?.correctedSeverity || severity})` : ''}
                  </button>
                  {/* Severity correction dropdown — only for confirmed chips without review */}
                  {isConfirmed && !existingReview && (
                    <select
                      value={verdict?.correctedSeverity || severity || 'normal'}
                      onChange={e => {
                        onUpdateDraft({
                          chipVerdicts: {
                            ...draft.chipVerdicts,
                            [chip]: { ...verdict!, correctedSeverity: e.target.value }
                          }
                        })
                      }}
                      className="h-5 rounded-r-full border border-l-0 border-green-400 bg-green-50 px-1 text-[9px] text-green-800 focus:outline-none"
                    >
                      {SEVERITY_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Evidence images */}
      <EvidenceImages obs={obs} />

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
          {/* Keyboard shortcut hint */}
          <div className="flex items-center gap-2 text-[9px] text-gray-400">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">Ctrl+A</span> Approve
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">Ctrl+R</span> Refer
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">Ctrl+F</span> Follow Up
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">Ctrl+S</span> Save
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">←→</span> Nav
          </div>

          {/* Quick batch templates */}
          <div>
            <p className="mb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wide">Quick Templates</p>
            <div className="flex flex-wrap gap-1.5">
              {BATCH_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => onUpdateDraft({ decision: t.decision, notes: t.notes })}
                  className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all ${
                    draft.decision === t.decision && draft.notes === t.notes
                      ? 'border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

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

// ── Evidence Images ──

function EvidenceImages({ obs }: { obs: ObservationData }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const images: string[] = []
  if (obs.mediaUrl) images.push(obs.mediaUrl)
  if (obs.annotationData?.evidenceImage) images.push(obs.annotationData.evidenceImage)
  if (obs.annotationData?.evidenceVideoFrames) {
    images.push(...obs.annotationData.evidenceVideoFrames.slice(0, 4))
  }

  if (images.length === 0) return null

  return (
    <>
      <div className="mt-3">
        <div className="flex items-center gap-1.5 mb-2">
          <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Evidence ({images.length})</span>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setExpanded(src) }}
              className="flex-shrink-0 rounded-lg border border-gray-200 overflow-hidden hover:border-blue-400 transition-colors"
            >
              <img
                src={src}
                alt={`Evidence ${i + 1}`}
                className="h-20 w-20 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setExpanded(null)}
        >
          <button
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
            onClick={() => setExpanded(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={expanded}
            alt="Evidence fullscreen"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
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
