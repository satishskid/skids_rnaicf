/**
 * ConsentManagement — Manage consent templates and view consent records.
 * Features: create/edit templates, consent dashboard, per-campaign stats.
 */

import { useState, useEffect, useCallback } from 'react'
import { apiCall } from '../lib/api'
import {
  FileCheck,
  Plus,
  Edit3,
  Eye,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
} from 'lucide-react'

interface ConsentTemplate {
  id: string
  org_code: string
  title: string
  version: string
  language: string
  body_html: string
  requires_witness: number
  min_age_for_assent: number | null
  status: string
  created_at: string
  updated_at: string
}

interface Consent {
  id: string
  template_id: string
  campaign_code: string
  child_id: string
  guardian_name: string
  guardian_relation: string
  consented: number
  consent_date: string
  withdrawn_at: string | null
  created_at: string
}

export function ConsentManagementPage() {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([])
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'templates' | 'records'>('templates')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ConsentTemplate | null>(null)
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, cRes] = await Promise.all([
        apiCall('/api/consents/templates'),
        apiCall('/api/consents'),
      ])
      setTemplates(tRes.templates || [])
      setConsents(cRes.consents || [])
    } catch (err) {
      console.error('Failed to load consent data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filteredTemplates = templates.filter(t =>
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredConsents = consents.filter(c =>
    c.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.campaign_code || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consent Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage informed consent templates and track consent records</p>
        </div>
        <button
          onClick={() => { setEditingTemplate(null); setShowCreateModal(true) }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<FileCheck className="h-5 w-5 text-blue-600" />} label="Templates" value={templates.length} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="Consented" value={consents.filter(c => c.consented === 1 && !c.withdrawn_at).length} />
        <StatCard icon={<XCircle className="h-5 w-5 text-red-600" />} label="Declined" value={consents.filter(c => c.consented === 0).length} />
        <StatCard icon={<AlertCircle className="h-5 w-5 text-amber-600" />} label="Withdrawn" value={consents.filter(c => c.withdrawn_at).length} />
      </div>

      {/* Search + Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(['templates', 'records'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'templates' ? 'Templates' : 'Consent Records'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : activeTab === 'templates' ? (
        <div className="space-y-3">
          {filteredTemplates.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <FileCheck className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No consent templates</h3>
              <p className="mt-2 text-sm text-gray-500">Create a template to start collecting informed consent.</p>
              <button
                onClick={() => { setEditingTemplate(null); setShowCreateModal(true) }}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Template
              </button>
            </div>
          ) : (
            filteredTemplates.map(template => (
              <div key={template.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div
                  className="flex cursor-pointer items-center justify-between p-4"
                  onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                >
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                    <div>
                      <h3 className="font-medium text-gray-900">{template.title}</h3>
                      <p className="text-xs text-gray-500">
                        v{template.version} &middot; {template.language.toUpperCase()} &middot;{' '}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          template.status === 'active' ? 'bg-green-100 text-green-700' :
                          template.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{template.status}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); setEditingTemplate(template); setShowCreateModal(true) }}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    {expandedTemplate === template.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>
                {expandedTemplate === template.id && (
                  <div className="border-t border-gray-200 p-4">
                    <div className="prose prose-sm max-h-60 overflow-y-auto rounded-md bg-gray-50 p-3"
                      dangerouslySetInnerHTML={{ __html: template.body_html }}
                    />
                    <div className="mt-3 flex gap-4 text-xs text-gray-500">
                      <span>Witness required: {template.requires_witness ? 'Yes' : 'No'}</span>
                      {template.min_age_for_assent && <span>Assent age: {template.min_age_for_assent}+</span>}
                      <span>Created: {new Date(template.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Guardian</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredConsents.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-gray-500">No consent records found</td></tr>
              ) : (
                filteredConsents.map(consent => (
                  <tr key={consent.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{consent.guardian_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{consent.campaign_code || '—'}</td>
                    <td className="px-4 py-3">
                      {consent.withdrawn_at ? (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">Withdrawn</span>
                      ) : consent.consented === 1 ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Consented</span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Declined</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {consent.consent_date ? new Date(consent.consent_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Template Modal */}
      {showCreateModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => { setShowCreateModal(false); setEditingTemplate(null) }}
          onSaved={() => { setShowCreateModal(false); setEditingTemplate(null); loadData() }}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

function TemplateModal({ template, onClose, onSaved }: {
  template: ConsentTemplate | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(template?.title || '')
  const [version, setVersion] = useState(template?.version || '1.0')
  const [language, setLanguage] = useState(template?.language || 'en')
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '<p>I, {{guardian_name}}, parent/guardian of {{child_name}}, hereby give my informed consent for my child to participate in the health screening program conducted at {{school_name}}.</p>\n\n<p>I understand that:</p>\n<ul>\n<li>The screening is voluntary and non-invasive</li>\n<li>Results will be shared with me and the school health team</li>\n<li>I may withdraw consent at any time</li>\n</ul>')
  const [requiresWitness, setRequiresWitness] = useState(!!template?.requires_witness)
  const [status, setStatus] = useState(template?.status || 'draft')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (template) {
        await apiCall(`/api/consents/templates/${template.id}`, {
          method: 'PUT',
          body: JSON.stringify({ title, version, language, bodyHtml, requiresWitness, status }),
        })
      } else {
        await apiCall('/api/consents/templates', {
          method: 'POST',
          body: JSON.stringify({ orgCode: 'zpedi', title, version, language, bodyHtml, requiresWitness, status }),
        })
      }
      onSaved()
    } catch (err) {
      console.error('Failed to save template:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">{template ? 'Edit' : 'Create'} Consent Template</h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="School Health Screening Consent" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Version</label>
              <input value={version} onChange={e => setVersion(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Language</label>
              <select value={language} onChange={e => setLanguage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
              </select>
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
            <label className="block text-sm font-medium text-gray-700">Consent Body (HTML)</label>
            <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="HTML content with {{guardian_name}}, {{child_name}}, {{school_name}} variables" />
            <p className="mt-1 text-xs text-gray-400">Variables: {'{{guardian_name}}'}, {'{{child_name}}'}, {'{{school_name}}'}</p>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={requiresWitness} onChange={e => setRequiresWitness(e.target.checked)}
              className="rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700">Requires witness signature</span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !title}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : template ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
