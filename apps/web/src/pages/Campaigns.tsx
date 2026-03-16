import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  MapPin,
  Calendar,
  Users,
  Megaphone,
  X,
  Loader2,
  Building,
  Apple,
  Settings,
  Check,
  FileSpreadsheet,
} from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { EmptyState } from '../components/EmptyState'
import { ImportCampaignModal } from '../components/ImportCampaignModal'
import { useApi, useDebounce } from '../lib/hooks'
import { apiCall } from '../lib/api'
import {
  CAMPAIGN_TEMPLATES,
  MODULE_CONFIGS,
  getModuleName,
  type CampaignType,
} from '@skids/shared'

const TEMPLATE_ICONS: Record<string, typeof Building> = {
  Building,
  Apple,
  Settings,
}

interface CampaignRow {
  code: string
  name: string
  schoolName?: string
  status: string
  totalChildren?: number
  createdAt?: string
  completedAt?: string
  city?: string
  state?: string
  campaignType?: string
  enabledModules?: string[]
  location?: { city?: string; state?: string }
}

interface CampaignsResponse {
  campaigns: CampaignRow[]
}

export function CampaignsPage() {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useApi<CampaignsResponse>('/api/campaigns')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const debouncedSearch = useDebounce(searchQuery, 300)

  const campaigns = data?.campaigns ?? []

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch =
      !debouncedSearch ||
      (c.name ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (c.schoolName ?? '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      c.code.toLowerCase().includes(debouncedSearch.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' || c.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (isLoading) {
    return <LoadingSpinner message="Loading campaigns..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your screening campaigns across schools and clinics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Import from Excel
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'active', 'completed', 'archived'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign grid */}
      {filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={searchQuery ? 'No campaigns match your search' : 'No campaigns yet'}
          description={
            searchQuery
              ? 'Try adjusting your search or filters.'
              : 'Create your first screening campaign to get started.'
          }
          action={
            !searchQuery
              ? {
                  label: 'Create Campaign',
                  onClick: () => setShowCreateModal(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <button
              key={campaign.code}
              onClick={() => navigate(`/campaigns/${campaign.code}`)}
              className="rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-gray-900">
                    {campaign.name || campaign.schoolName || 'Untitled'}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-gray-400">
                    {campaign.code}
                  </p>
                </div>
                <StatusBadge status={campaign.status} />
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    {campaign.location?.city || campaign.city || 'No location'}
                    {(campaign.location?.state || campaign.state) &&
                      `, ${campaign.location?.state || campaign.state}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {campaign.createdAt
                      ? new Date(campaign.createdAt).toLocaleDateString()
                      : 'No date'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Users className="h-3.5 w-3.5" />
                  <span>{campaign.totalChildren ?? 0} children enrolled</span>
                </div>
              </div>

              {campaign.enabledModules && campaign.enabledModules.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {campaign.enabledModules.slice(0, 5).map((mod) => (
                    <span
                      key={mod}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500"
                    >
                      {mod.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {campaign.enabledModules.length > 5 && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                      +{campaign.enabledModules.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            refetch()
          }}
        />
      )}

      {/* Import Campaign from Excel Modal */}
      {showImportModal && (
        <ImportCampaignModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            setShowImportModal(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

// ── Create Campaign Modal ────────────────────────

function CreateCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [district, setDistrict] = useState('')
  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('')
  const [campaignType, setCampaignType] = useState<CampaignType>('school_health_4d')
  const [selectedModules, setSelectedModules] = useState<string[]>(
    CAMPAIGN_TEMPLATES[0].defaultModules,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleTypeChange(type: CampaignType) {
    setCampaignType(type)
    const template = CAMPAIGN_TEMPLATES.find((t) => t.type === type)
    if (template) {
      setSelectedModules([...template.defaultModules])
    }
  }

  function toggleModule(moduleType: string) {
    setSelectedModules((prev) =>
      prev.includes(moduleType)
        ? prev.filter((m) => m !== moduleType)
        : [...prev, moduleType],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Campaign name is required.')
      return
    }
    if (selectedModules.length === 0) {
      setError('Select at least one screening module.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await apiCall('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          schoolName: schoolName.trim() || name.trim(),
          campaignType,
          enabledModules: selectedModules,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          district: district.trim() || undefined,
          address: address.trim() || undefined,
          pincode: pincode.trim() || undefined,
        }),
      })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedTemplate = CAMPAIGN_TEMPLATES.find((t) => t.type === campaignType)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            New Campaign
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Campaign Type Selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Campaign Type *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {CAMPAIGN_TEMPLATES.map((template) => {
                  const Icon = TEMPLATE_ICONS[template.icon] || Building
                  const isSelected = campaignType === template.type
                  return (
                    <button
                      key={template.type}
                      type="button"
                      onClick={() => handleTypeChange(template.type)}
                      className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <Icon
                        className={`h-6 w-6 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}
                      />
                      <p
                        className={`mt-2 text-sm font-semibold ${
                          isSelected ? 'text-blue-900' : 'text-gray-900'
                        }`}
                      >
                        {template.name}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {template.type === 'custom'
                          ? 'Pick your modules'
                          : `${template.defaultModules.length} modules`}
                      </p>
                    </button>
                  )
                })}
              </div>
              {selectedTemplate && (
                <p className="mt-2 text-xs text-gray-500">
                  {selectedTemplate.description}
                </p>
              )}
            </div>

            {/* Campaign Details */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Campaign Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., School Health Screening 2026"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                School / Facility Name
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Delhi Public School"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., Mumbai"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., Maharashtra"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  District
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., Pune"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Pincode
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., 411001"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., 123 School Road, Sector 5"
              />
            </div>

            {/* Module Selection */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Screening Modules ({selectedModules.length} selected)
                </label>
                {campaignType !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedModules.length === MODULE_CONFIGS.length) {
                        setSelectedModules([])
                      } else {
                        setSelectedModules(MODULE_CONFIGS.map((m) => m.type))
                      }
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    {selectedModules.length === MODULE_CONFIGS.length
                      ? 'Deselect all'
                      : 'Select all'}
                  </button>
                )}
              </div>

              {/* Vitals group */}
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Vitals & Measurements
                </p>
                <div className="flex flex-wrap gap-2">
                  {MODULE_CONFIGS.filter((m) => m.group === 'vitals').map(
                    (mod) => {
                      const isSelected = selectedModules.includes(mod.type)
                      return (
                        <button
                          key={mod.type}
                          type="button"
                          onClick={() => toggleModule(mod.type)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                            isSelected
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {mod.name}
                        </button>
                      )
                    },
                  )}
                </div>
              </div>

              {/* Head-to-toe group */}
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Head-to-Toe Examination
                </p>
                <div className="flex flex-wrap gap-2">
                  {MODULE_CONFIGS.filter((m) => m.group === 'head_to_toe').map(
                    (mod) => {
                      const isSelected = selectedModules.includes(mod.type)
                      return (
                        <button
                          key={mod.type}
                          type="button"
                          onClick={() => toggleModule(mod.type)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                            isSelected
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {mod.name}
                        </button>
                      )
                    },
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
