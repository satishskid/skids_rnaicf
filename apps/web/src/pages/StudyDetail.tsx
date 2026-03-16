/**
 * StudyDetail — Study dashboard with enrollment progress, event timeline, completion matrix.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiCall } from '../lib/api'
import {
  FlaskConical,
  Users,
  Calendar,
  ChevronLeft,
  ClipboardList,
  Plus,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'

interface StudyDetail {
  study: Record<string, any>
  arms: Record<string, any>[]
  events: (Record<string, any> & { instruments: Record<string, any>[] })[]
  enrollment: { active: number; completed: number; withdrawn: number; total: number }
}

interface Participant {
  child_id: string
  child_name: string
  dob: string
  gender: string
  class: string
  arm_name: string
  enrolled_at: string
  status: string
}

export function StudyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<StudyDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'events'>('overview')

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [detailRes, partRes] = await Promise.all([
        apiCall(`/api/studies/${id}`),
        apiCall(`/api/studies/${id}/participants`),
      ])
      setData(detailRes as any)
      setParticipants((partRes as any).participants || [])
    } catch (err) {
      console.error('Failed to load study:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!data) {
    return <div className="py-20 text-center text-gray-500">Study not found</div>
  }

  const study = data.study

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate('/studies')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" /> Back to Studies
        </button>
        <div className="mt-2 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <FlaskConical className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{study.title as string}</h1>
              <div className="mt-0.5 flex items-center gap-3 text-sm text-gray-500">
                <span className="font-mono font-semibold text-blue-600">{study.short_code as string}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  study.status === 'active' ? 'bg-green-100 text-green-700' :
                  study.status === 'recruiting' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{study.status as string}</span>
                {study.pi_name && <span>PI: {study.pi_name as string}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              const res: any = await apiCall(`/api/studies/${id}/export`)
              const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `study-${study.short_code}-export.json`; a.click()
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> Export Data
          </button>
        </div>
      </div>

      {/* Enrollment Stats */}
      <div className="grid grid-cols-4 gap-4">
        <EnrollmentCard icon={<Users className="h-5 w-5 text-blue-600" />} label="Total Enrolled" value={data.enrollment.total}
          subtitle={study.target_enrollment ? `Target: ${study.target_enrollment}` : undefined} />
        <EnrollmentCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="Active" value={data.enrollment.active} />
        <EnrollmentCard icon={<Clock className="h-5 w-5 text-purple-600" />} label="Completed" value={data.enrollment.completed} />
        <EnrollmentCard icon={<XCircle className="h-5 w-5 text-gray-400" />} label="Withdrawn" value={data.enrollment.withdrawn} />
      </div>

      {/* Enrollment Progress Bar */}
      {study.target_enrollment && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Enrollment Progress</span>
            <span className="text-gray-500">{data.enrollment.total} / {study.target_enrollment as number}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, (data.enrollment.total / (study.target_enrollment as number)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {(['overview', 'participants', 'events'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'participants' ? 'Participants' : 'Events & Instruments'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Study Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Study Details</h3>
            <dl className="mt-3 space-y-2">
              <DL label="Type" value={study.study_type as string} />
              <DL label="IRB Number" value={(study.irb_number as string) || '—'} />
              <DL label="Start Date" value={study.start_date ? new Date(study.start_date as string).toLocaleDateString() : '—'} />
              <DL label="End Date" value={study.end_date ? new Date(study.end_date as string).toLocaleDateString() : '—'} />
              {study.description && <DL label="Description" value={study.description as string} />}
            </dl>
          </div>

          {/* Arms */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Study Arms ({data.arms.length})</h3>
            {data.arms.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No arms defined yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {data.arms.map((arm, i) => (
                  <div key={arm.id as string} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${
                      i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-green-600' : 'bg-purple-600'
                    }`}>{i + 1}</div>
                    <div>
                      <p className="font-medium text-gray-900">{arm.name as string}</p>
                      {arm.description && <p className="text-xs text-gray-500">{arm.description as string}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'participants' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Gender</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Arm</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Enrolled</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {participants.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-gray-500">No participants enrolled</td></tr>
              ) : (
                participants.map(p => (
                  <tr key={p.child_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.child_name}</td>
                    <td className="px-4 py-3 text-sm capitalize text-gray-500">{p.gender}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.class || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{p.arm_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(p.enrolled_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        p.status === 'active' ? 'bg-green-100 text-green-700' :
                        p.status === 'completed' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          {data.events.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <Calendar className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No events defined. Add scheduled timepoints to track data collection.</p>
            </div>
          ) : (
            data.events.map((event, i) => (
              <div key={event.id as string} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{event.name as string}</h3>
                    <p className="text-xs text-gray-500">
                      Day {event.day_offset as number} (window: -{event.window_before as number} to +{event.window_after as number} days)
                    </p>
                  </div>
                </div>
                {event.instruments.length > 0 && (
                  <div className="mt-3 ml-[52px] space-y-1">
                    {event.instruments.map(inst => (
                      <div key={inst.id as string} className="flex items-center gap-2 text-sm">
                        <ClipboardList className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-700">{inst.instrument_name as string}</span>
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                          {inst.instrument_category as string}
                        </span>
                        {inst.required ? (
                          <span className="text-[10px] font-medium text-red-600">Required</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">Optional</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function EnrollmentCard({ icon, label, value, subtitle }: { icon: React.ReactNode; label: string; value: number; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

function DL({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}
