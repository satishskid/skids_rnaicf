/**
 * Studies — List and create clinical studies/trials.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiCall } from '../lib/api'
import {
  FlaskConical,
  Plus,
  Search,
  Users,
  Calendar,
  ArrowRight,
} from 'lucide-react'

interface Study {
  id: string
  org_code: string
  title: string
  short_code: string
  description: string
  study_type: string
  status: string
  pi_name: string
  pi_email: string
  irb_number: string
  start_date: string
  end_date: string
  target_enrollment: number
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700',
  recruiting: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-purple-100 text-purple-700',
  archived: 'bg-gray-100 text-gray-500',
}

const TYPE_LABELS: Record<string, string> = {
  observational: 'Observational',
  interventional: 'Interventional',
  cohort: 'Cohort',
  cross_sectional: 'Cross-sectional',
}

export function StudiesPage() {
  const navigate = useNavigate()
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const loadStudies = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await apiCall('/api/studies')
      setStudies(res.studies || [])
    } catch (err) {
      console.error('Failed to load studies:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStudies() }, [loadStudies])

  const filtered = studies.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.short_code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Studies</h1>
          <p className="mt-1 text-sm text-gray-500">Manage clinical trials, research studies, and cohort studies</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Study
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Studies" value={studies.length} color="blue" />
        <StatCard label="Active" value={studies.filter(s => s.status === 'active').length} color="green" />
        <StatCard label="Recruiting" value={studies.filter(s => s.status === 'recruiting').length} color="blue" />
        <StatCard label="Completed" value={studies.filter(s => s.status === 'completed').length} color="purple" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search studies..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Studies List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FlaskConical className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No studies</h3>
          <p className="mt-2 text-sm text-gray-500">Create a clinical study to start tracking participants and data collection.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(study => (
            <div
              key={study.id}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => navigate(`/studies/${study.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <FlaskConical className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{study.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[study.status] || 'bg-gray-100 text-gray-600'}`}>
                        {study.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      <span className="font-mono font-medium text-blue-600">{study.short_code}</span>
                      <span>{TYPE_LABELS[study.study_type] || study.study_type}</span>
                      {study.pi_name && <span>PI: {study.pi_name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  {study.target_enrollment && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>Target: {study.target_enrollment}</span>
                    </div>
                  )}
                  {study.start_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(study.start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
              {study.description && (
                <p className="mt-2 line-clamp-1 pl-[52px] text-sm text-gray-500">{study.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateStudyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); loadStudies() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const bg = { blue: 'bg-blue-50', green: 'bg-green-50', purple: 'bg-purple-50', gray: 'bg-gray-50' }[color] || 'bg-gray-50'
  const text = { blue: 'text-blue-700', green: 'text-green-700', purple: 'text-purple-700', gray: 'text-gray-700' }[color] || 'text-gray-700'

  return (
    <div className={`rounded-lg ${bg} p-4`}>
      <p className={`text-2xl font-bold ${text}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function CreateStudyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [shortCode, setShortCode] = useState('')
  const [description, setDescription] = useState('')
  const [studyType, setStudyType] = useState('observational')
  const [piName, setPiName] = useState('')
  const [piEmail, setPiEmail] = useState('')
  const [irbNumber, setIrbNumber] = useState('')
  const [targetEnrollment, setTargetEnrollment] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiCall('/api/studies', {
        method: 'POST',
        body: JSON.stringify({
          orgCode: 'zpedi',
          title,
          shortCode: shortCode.toUpperCase(),
          description,
          studyType,
          piName: piName || undefined,
          piEmail: piEmail || undefined,
          irbNumber: irbNumber || undefined,
          targetEnrollment: targetEnrollment ? Number(targetEnrollment) : undefined,
        }),
      })
      onCreated()
    } catch (err) {
      console.error('Failed to create study:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">Create Clinical Study</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Study Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Vitamin D Supplementation in School Children" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Short Code</label>
              <input value={shortCode} onChange={e => setShortCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm uppercase"
                placeholder="VIT-D-2026" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Study Type</label>
              <select value={studyType} onChange={e => setStudyType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Principal Investigator</label>
              <input value={piName} onChange={e => setPiName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Dr. Name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PI Email</label>
              <input value={piEmail} onChange={e => setPiEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="pi@institution.edu" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">IRB/Ethics Number</label>
              <input value={irbNumber} onChange={e => setIrbNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Enrollment</label>
              <input value={targetEnrollment} onChange={e => setTargetEnrollment(e.target.value)}
                type="number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !title || !shortCode || !studyType}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Study'}
          </button>
        </div>
      </div>
    </div>
  )
}
