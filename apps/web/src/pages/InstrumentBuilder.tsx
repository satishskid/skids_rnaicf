/**
 * InstrumentBuilder — Create and manage survey instruments (SurveyJS).
 * Features: instrument list, JSON schema editor, preview, response analytics.
 */

import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '../lib/api'
import {
  ClipboardList,
  Plus,
  Edit3,
  Eye,
  BarChart3,
  Search,
  FileJson,
  Play,
} from 'lucide-react'

interface Instrument {
  id: string
  org_code: string
  name: string
  description: string
  category: string
  version: string
  status: string
  schema_json?: string
  scoring_logic?: string
  created_at: string
  updated_at: string
}

type InstrumentCategory = 'screening' | 'survey' | 'questionnaire' | 'crf'

const CATEGORY_LABELS: Record<InstrumentCategory, string> = {
  screening: 'Screening Tool',
  survey: 'Survey',
  questionnaire: 'Questionnaire',
  crf: 'Case Report Form',
}

const CATEGORY_COLORS: Record<InstrumentCategory, string> = {
  screening: 'bg-blue-100 text-blue-700',
  survey: 'bg-green-100 text-green-700',
  questionnaire: 'bg-purple-100 text-purple-700',
  crf: 'bg-amber-100 text-amber-700',
}

// Sample SurveyJS schema
const SAMPLE_SCHEMA = {
  title: 'Sample Health Survey',
  pages: [{
    name: 'page1',
    elements: [
      { type: 'rating', name: 'q1', title: 'How would you rate the child\'s overall health?', rateMin: 1, rateMax: 5 },
      { type: 'boolean', name: 'q2', title: 'Has the child been vaccinated according to the national immunization schedule?' },
      { type: 'text', name: 'q3', title: 'Any known allergies?', placeHolder: 'List allergies or write None' },
    ],
  }],
}

export function InstrumentBuilderPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null)
  const [previewInstrument, setPreviewInstrument] = useState<Instrument | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')

  const loadInstruments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiCall('/api/instruments?status=all')
      setInstruments(res.instruments || [])
    } catch (err) {
      console.error('Failed to load instruments:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInstruments() }, [loadInstruments])

  const filtered = instruments.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !filterCategory || i.category === filterCategory
    return matchesSearch && matchesCategory
  })

  const handleViewDetail = async (id: string) => {
    try {
      const res = await apiCall(`/api/instruments/${id}`)
      setPreviewInstrument(res.instrument)
    } catch (err) {
      console.error('Failed to load instrument:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey & Instrument Builder</h1>
          <p className="mt-1 text-sm text-gray-500">Create screening tools, surveys, and questionnaires</p>
        </div>
        <button
          onClick={() => { setEditingInstrument(null); setShowCreateModal(true) }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Instrument
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <div key={key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">
              {instruments.filter(i => i.category === key).length}
            </p>
            <p className="text-xs text-gray-500">{label}s</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search instruments..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Instrument List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No instruments</h3>
          <p className="mt-2 text-sm text-gray-500">Create a survey or screening instrument to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(instrument => (
            <div key={instrument.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[instrument.category as InstrumentCategory] || 'bg-gray-100 text-gray-600'}`}>
                    {CATEGORY_LABELS[instrument.category as InstrumentCategory] || instrument.category}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  instrument.status === 'active' ? 'bg-green-100 text-green-700' :
                  instrument.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{instrument.status}</span>
              </div>

              <h3 className="mt-3 font-semibold text-gray-900">{instrument.name}</h3>
              {instrument.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">{instrument.description}</p>
              )}

              <div className="mt-1 text-xs text-gray-400">
                v{instrument.version} &middot; Updated {new Date(instrument.updated_at).toLocaleDateString()}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleViewDetail(instrument.id)}
                  className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  <Eye className="h-3 w-3" /> Preview
                </button>
                <button
                  onClick={() => { setEditingInstrument(instrument); setShowCreateModal(true) }}
                  className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                <button
                  className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  <BarChart3 className="h-3 w-3" /> Stats
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Panel */}
      {previewInstrument && (
        <PreviewPanel instrument={previewInstrument} onClose={() => setPreviewInstrument(null)} />
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <InstrumentModal
          instrument={editingInstrument}
          onClose={() => { setShowCreateModal(false); setEditingInstrument(null) }}
          onSaved={() => { setShowCreateModal(false); setEditingInstrument(null); loadInstruments() }}
        />
      )}
    </div>
  )
}

function PreviewPanel({ instrument, onClose }: { instrument: Instrument; onClose: () => void }) {
  let schema: unknown = null
  try {
    schema = typeof instrument.schema_json === 'string' ? JSON.parse(instrument.schema_json) : instrument.schema_json
  } catch { /* ignore */ }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            <Play className="mr-2 inline h-5 w-5 text-blue-600" />
            {instrument.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        <div className="mt-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <FileJson className="h-4 w-4" /> Schema JSON
          </h3>
          <pre className="max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400">
            {JSON.stringify(schema, null, 2)}
          </pre>
        </div>
        {instrument.scoring_logic && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Scoring Logic</h3>
            <pre className="rounded-lg bg-gray-100 p-3 text-xs text-gray-800">{instrument.scoring_logic}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

function InstrumentModal({ instrument, onClose, onSaved }: {
  instrument: Instrument | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(instrument?.name || '')
  const [description, setDescription] = useState(instrument?.description || '')
  const [category, setCategory] = useState(instrument?.category || 'survey')
  const [version, setVersion] = useState(instrument?.version || '1.0')
  const [status, setStatus] = useState(instrument?.status || 'draft')
  const [schemaJson, setSchemaJson] = useState(
    instrument?.schema_json
      ? (typeof instrument.schema_json === 'string' ? instrument.schema_json : JSON.stringify(instrument.schema_json, null, 2))
      : JSON.stringify(SAMPLE_SCHEMA, null, 2)
  )
  const [scoringLogic, setScoringLogic] = useState(instrument?.scoring_logic || '')
  const [saving, setSaving] = useState(false)
  const [jsonError, setJsonError] = useState('')

  const validateJson = (s: string) => {
    try { JSON.parse(s); setJsonError(''); return true } catch (e) { setJsonError(String(e)); return false }
  }

  const handleSave = async () => {
    if (!validateJson(schemaJson)) return
    setSaving(true)
    try {
      const payload = { orgCode: 'zpedi', name, description, category, schemaJson: JSON.parse(schemaJson), scoringLogic: scoringLogic || undefined, version, status }
      if (instrument) {
        await apiCall(`/api/instruments/${instrument.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await apiCall('/api/instruments', { method: 'POST', body: JSON.stringify(payload) })
      }
      onSaved()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">{instrument ? 'Edit' : 'Create'} Instrument</h2>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="M-CHAT-R/F" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Brief description of the instrument" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Version</label>
              <input value={version} onChange={e => setVersion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Schema JSON (SurveyJS format)</label>
            <textarea value={schemaJson} onChange={e => { setSchemaJson(e.target.value); validateJson(e.target.value) }}
              rows={12}
              className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs ${jsonError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} />
            {jsonError && <p className="mt-1 text-xs text-red-600">{jsonError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Scoring Logic (optional JSON weights)</label>
            <textarea value={scoringLogic} onChange={e => setScoringLogic(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
              placeholder='{"q1": 1, "q2": 2, "q3": 1}' />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name || !!jsonError}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : instrument ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
