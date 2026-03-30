/**
 * AuditLog — Admin-only page showing immutable record of all platform actions.
 * Who did what, when, to which entity.
 */

import { useState, useEffect, useCallback } from 'react'
import { Shield, RefreshCw, Filter, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { apiCall } from '../lib/api'
import { LoadingSpinner } from '../components/LoadingSpinner'

interface AuditEntry {
  id: string
  user_id: string
  userName?: string
  userRole?: string
  action: string
  entity_type?: string
  entity_id?: string
  campaign_code?: string
  details?: string
  ip_address?: string
  created_at: string
}

interface AuditResponse {
  entries: AuditEntry[]
  total: number
  limit: number
  offset: number
}

const ACTION_COLORS: Record<string, string> = {
  'observation.created': 'bg-blue-100 text-blue-700',
  'observation.synced': 'bg-green-100 text-green-700',
  'review.created': 'bg-purple-100 text-purple-700',
  'campaign.created': 'bg-indigo-100 text-indigo-700',
  'user.created': 'bg-teal-100 text-teal-700',
  'user.pin_set': 'bg-amber-100 text-amber-700',
  'report.released': 'bg-pink-100 text-pink-700',
  'login.success': 'bg-green-100 text-green-700',
  'login.failed': 'bg-red-100 text-red-700',
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [actions, setActions] = useState<string[]>([])
  const pageSize = 50

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      })
      if (actionFilter) params.set('action', actionFilter)

      const data = await apiCall<AuditResponse>(`/api/audit-log?${params}`)
      setEntries(data.entries)
      setTotal(data.total)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Load action types for filter
  useEffect(() => {
    apiCall<{ actions: string[] }>('/api/audit-log/actions')
      .then(data => setActions(data.actions))
      .catch(() => {})
  }, [])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Shield className="h-6 w-6 text-blue-600" />
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Immutable record of all platform actions. {total} entries total.
          </p>
        </div>
        <button
          onClick={fetchEntries}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
        >
          <option value="">All Actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-xs text-gray-400">
          Showing {entries.length} of {total}
        </span>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading audit log..." estimatedMs={2000} />
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Shield className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No audit entries found.</p>
          <p className="text-xs text-gray-400 mt-1">
            Audit logging captures screening, review, and admin actions automatically.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(entry => {
                const actionColor = ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-700'
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {new Date(entry.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-xs font-medium text-gray-900">{entry.userName || entry.user_id?.slice(0, 8)}</span>
                        {entry.userRole && (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500">{entry.userRole}</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionColor}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {entry.entity_type && (
                        <span>{entry.entity_type}: {entry.entity_id?.slice(0, 12)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 font-mono">
                      {entry.campaign_code || '-'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-400">
                      {entry.details || '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3 w-3" /> Previous
              </button>
              <span className="text-xs text-gray-400">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
