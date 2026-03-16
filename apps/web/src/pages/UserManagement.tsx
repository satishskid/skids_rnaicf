// User Management — admin-only page for managing users, PINs, and passwords
import { useState, useEffect } from 'react'
import { apiCall } from '../lib/api'

interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  orgCode: string
  createdAt: string
  hasPin: boolean
}

export function UserManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal state
  const [modal, setModal] = useState<{
    type: 'set-pin' | 'reset-pin' | 'reset-password' | 'create-user' | 'assign-campaigns' | null
    user?: AdminUser
  }>({ type: null })
  const [pinValue, setPinValue] = useState('')
  const [passwordValue, setPasswordValue] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  // Campaign assignment state
  const [allCampaigns, setAllCampaigns] = useState<Array<{ code: string; name: string; status: string }>>([])
  const [assignedCodes, setAssignedCodes] = useState<Set<string>>(new Set())
  const [assignmentMap, setAssignmentMap] = useState<Record<string, string>>({}) // campaignCode → assignmentId
  const [assignLoading, setAssignLoading] = useState<string | null>(null) // campaignCode being toggled

  // Create user form
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'nurse',
    orgCode: 'zpedi',
  })

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await apiCall<{ users: AdminUser[] }>('/api/admin/users')
      setUsers(res.users)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleSetPin = async () => {
    if (!/^\d{4,6}$/.test(pinValue)) {
      setActionMessage('PIN must be 4-6 digits')
      return
    }
    setActionLoading(true)
    try {
      await apiCall('/api/admin/set-pin', {
        method: 'POST',
        body: JSON.stringify({ userId: modal.user?.id, pin: pinValue }),
      })
      setActionMessage('PIN set successfully')
      setPinValue('')
      setTimeout(() => {
        setModal({ type: null })
        setActionMessage('')
        fetchUsers()
      }, 1000)
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Failed to set PIN')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetPin = async () => {
    setActionLoading(true)
    try {
      await apiCall('/api/admin/reset-pin', {
        method: 'POST',
        body: JSON.stringify({ userId: modal.user?.id }),
      })
      setActionMessage('PIN cleared')
      setTimeout(() => {
        setModal({ type: null })
        setActionMessage('')
        fetchUsers()
      }, 1000)
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Failed to reset PIN')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (passwordValue.length < 8) {
      setActionMessage('Password must be at least 8 characters')
      return
    }
    setActionLoading(true)
    try {
      await apiCall('/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({ userId: modal.user?.id, newPassword: passwordValue }),
      })
      setActionMessage('Password reset successfully')
      setPasswordValue('')
      setTimeout(() => {
        setModal({ type: null })
        setActionMessage('')
      }, 1000)
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Failed to reset password')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setActionMessage('Name, email, and password are required')
      return
    }
    setActionLoading(true)
    try {
      await apiCall('/api/admin/create-user', {
        method: 'POST',
        body: JSON.stringify(newUser),
      })
      setActionMessage('User created successfully')
      setNewUser({ name: '', email: '', password: '', role: 'nurse', orgCode: 'zpedi' })
      setTimeout(() => {
        setModal({ type: null })
        setActionMessage('')
        fetchUsers()
      }, 1000)
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setActionLoading(false)
    }
  }

  const openAssignModal = async (user: AdminUser) => {
    setModal({ type: 'assign-campaigns', user })
    setActionMessage('')
    try {
      // Fetch all campaigns and user's current assignments in parallel
      const [campaignsRes, assignmentsRes] = await Promise.all([
        apiCall<{ campaigns: Array<{ code: string; name: string; status: string }> }>('/api/campaigns'),
        apiCall<{ assignments: Array<{ id: string; campaignCode: string }> }>(
          `/api/campaign-assignments?userId=${user.id}`
        ),
      ])
      setAllCampaigns(campaignsRes.campaigns)
      const codes = new Set(assignmentsRes.assignments.map((a) => a.campaignCode))
      setAssignedCodes(codes)
      const idMap: Record<string, string> = {}
      assignmentsRes.assignments.forEach((a) => {
        idMap[a.campaignCode] = a.id
      })
      setAssignmentMap(idMap)
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Failed to load campaigns')
    }
  }

  const toggleCampaignAssignment = async (campaignCode: string) => {
    if (!modal.user) return
    setAssignLoading(campaignCode)
    try {
      if (assignedCodes.has(campaignCode)) {
        // Remove assignment
        const assignmentId = assignmentMap[campaignCode]
        if (assignmentId) {
          await apiCall(`/api/campaign-assignments/${assignmentId}`, { method: 'DELETE' })
        }
        setAssignedCodes((prev) => {
          const next = new Set(prev)
          next.delete(campaignCode)
          return next
        })
        setAssignmentMap((prev) => {
          const next = { ...prev }
          delete next[campaignCode]
          return next
        })
      } else {
        // Add assignment
        const res = await apiCall<{ id: string }>('/api/campaign-assignments', {
          method: 'POST',
          body: JSON.stringify({ userId: modal.user.id, campaignCode }),
        })
        setAssignedCodes((prev) => new Set([...prev, campaignCode]))
        setAssignmentMap((prev) => ({ ...prev, [campaignCode]: res.id }))
      }
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Failed to update assignment')
    } finally {
      setAssignLoading(null)
    }
  }

  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    ops_manager: 'bg-purple-100 text-purple-700',
    doctor: 'bg-blue-100 text-blue-700',
    nurse: 'bg-green-100 text-green-700',
    authority: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage accounts, PINs, and passwords for field workers
          </p>
        </div>
        <button
          onClick={() => {
            setModal({ type: 'create-user' })
            setActionMessage('')
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Create User
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Users table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Org
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                PIN
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {u.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{u.email}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        roleBadgeColor[u.role] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {u.orgCode || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {u.hasPin ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Set
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setModal({ type: 'set-pin', user: u })
                          setPinValue('')
                          setActionMessage('')
                        }}
                        className="rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        {u.hasPin ? 'Change PIN' : 'Set PIN'}
                      </button>
                      {u.hasPin && (
                        <button
                          onClick={() => {
                            setModal({ type: 'reset-pin', user: u })
                            setActionMessage('')
                          }}
                          className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          Clear PIN
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setModal({ type: 'reset-password', user: u })
                          setPasswordValue('')
                          setActionMessage('')
                        }}
                        className="rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => openAssignModal(u)}
                        className="rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        Campaigns
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal overlay */}
      {modal.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            {/* Set PIN */}
            {modal.type === 'set-pin' && (
              <>
                <h2 className="text-lg font-bold text-gray-900">
                  {modal.user?.hasPin ? 'Change' : 'Set'} PIN for {modal.user?.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">Enter a 4-6 digit PIN</p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter PIN"
                  className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                />
                {actionMessage && (
                  <p className={`mt-2 text-sm ${actionMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                    {actionMessage}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setModal({ type: null })}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSetPin}
                    disabled={actionLoading || pinValue.length < 4}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Saving...' : 'Set PIN'}
                  </button>
                </div>
              </>
            )}

            {/* Reset/Clear PIN */}
            {modal.type === 'reset-pin' && (
              <>
                <h2 className="text-lg font-bold text-gray-900">Clear PIN for {modal.user?.name}?</h2>
                <p className="mt-1 text-sm text-gray-500">
                  This will remove the PIN. The user will not be able to log in with PIN until a new one is set.
                </p>
                {actionMessage && (
                  <p className={`mt-2 text-sm ${actionMessage.includes('clear') ? 'text-green-600' : 'text-red-600'}`}>
                    {actionMessage}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setModal({ type: null })}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPin}
                    disabled={actionLoading}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Clearing...' : 'Clear PIN'}
                  </button>
                </div>
              </>
            )}

            {/* Reset Password */}
            {modal.type === 'reset-password' && (
              <>
                <h2 className="text-lg font-bold text-gray-900">Reset Password for {modal.user?.name}</h2>
                <p className="mt-1 text-sm text-gray-500">Minimum 8 characters</p>
                <input
                  type="text"
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="New password"
                  className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                />
                {actionMessage && (
                  <p className={`mt-2 text-sm ${actionMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                    {actionMessage}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setModal({ type: null })}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={actionLoading || passwordValue.length < 8}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </>
            )}

            {/* Create User */}
            {modal.type === 'create-user' && (
              <>
                <h2 className="text-lg font-bold text-gray-900">Create New User</h2>
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    autoFocus
                  />
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Email"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Password (min 8 characters)"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <div className="flex gap-3">
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="nurse">Nurse</option>
                      <option value="doctor">Doctor</option>
                      <option value="admin">Admin</option>
                      <option value="ops_manager">Ops Manager</option>
                      <option value="authority">Authority</option>
                    </select>
                    <input
                      type="text"
                      value={newUser.orgCode}
                      onChange={(e) => setNewUser({ ...newUser, orgCode: e.target.value })}
                      placeholder="Org code"
                      className="w-32 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
                {actionMessage && (
                  <p className={`mt-2 text-sm ${actionMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                    {actionMessage}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setModal({ type: null })}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={actionLoading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </>
            )}

            {/* Assign Campaigns */}
            {modal.type === 'assign-campaigns' && (
              <>
                <h2 className="text-lg font-bold text-gray-900">
                  Campaign Access &mdash; {modal.user?.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Select which campaigns this {modal.user?.role} can access.
                  {modal.user?.role === 'authority' && ' Authority users will only see assigned campaigns.'}
                </p>
                {actionMessage && (
                  <p className="mt-2 text-sm text-red-600">{actionMessage}</p>
                )}
                <div className="mt-4 max-h-72 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
                  {allCampaigns.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-400">Loading campaigns...</p>
                  ) : (
                    allCampaigns.map((c) => (
                      <label
                        key={c.code}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          assignedCodes.has(c.code) ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        } ${assignLoading === c.code ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={assignedCodes.has(c.code)}
                          onChange={() => toggleCampaignAssignment(c.code)}
                          disabled={assignLoading === c.code}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {c.name || c.code}
                          </p>
                          <p className="text-xs text-gray-500">{c.code}</p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            c.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : c.status === 'completed'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {c.status}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {assignedCodes.size} campaign{assignedCodes.size !== 1 ? 's' : ''} assigned
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setModal({ type: null })}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
