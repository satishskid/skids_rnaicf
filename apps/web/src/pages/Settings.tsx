import { useState, useEffect } from 'react'
import { User, Bell, Shield, Monitor, Activity, RefreshCw, Brain, Key } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { apiCall } from '../lib/api'
import { AIConfigPanel } from '../components/admin/AIConfigPanel'
import type { LLMConfig } from '../lib/ai/llm-gateway'

interface HealthCheck {
  status: string
  latencyMs: number
  details?: Record<string, unknown>
}

interface DetailedHealth {
  status: string
  version: string
  environment: string
  timestamp: string
  checks: Record<string, HealthCheck>
}

const BYOK_KEY = 'skids-doctor-byok'

interface ByokConfig {
  enabled: boolean
  provider: string
  apiKey: string
}

function loadByok(): ByokConfig {
  try {
    const raw = localStorage.getItem(BYOK_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { enabled: false, provider: 'gemini', apiKey: '' }
}

export function SettingsPage() {
  const { user } = useAuth()
  const [health, setHealth] = useState<DetailedHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  // AI Config state
  const [aiConfig, setAiConfig] = useState<Partial<LLMConfig> | null>(null)
  const [aiConfigLoading, setAiConfigLoading] = useState(true)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSaveMsg, setAiSaveMsg] = useState<string | null>(null)

  // Doctor BYOK state
  const [byok, setByok] = useState<ByokConfig>(loadByok)

  // Determine if current user is admin
  const isAdmin = user?.role === 'admin' || user?.role === 'ops_manager'

  async function fetchHealth() {
    setHealthLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/health/detailed`)
      const data = await res.json()
      setHealth(data)
    } catch {
      setHealth(null)
    } finally {
      setHealthLoading(false)
    }
  }

  // Fetch org AI config
  useEffect(() => {
    async function fetchAiConfig() {
      try {
        const orgId = (user as Record<string, unknown>)?.orgId as string || 'default'
        const res = await apiCall<{ config: Partial<LLMConfig> | null }>(`/api/ai-config/${orgId}`)
        setAiConfig(res.config || {})
      } catch {
        setAiConfig({})
      } finally {
        setAiConfigLoading(false)
      }
    }
    fetchAiConfig()
  }, [user])

  // Save org AI config
  async function handleSaveAiConfig(config: LLMConfig) {
    setAiSaving(true)
    setAiSaveMsg(null)
    try {
      const orgId = (user as Record<string, unknown>)?.orgId as string || 'default'
      await apiCall(`/api/ai-config/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ config }),
      })
      setAiConfig(config)
      setAiSaveMsg('AI configuration saved')
      setTimeout(() => setAiSaveMsg(null), 3000)
    } catch {
      setAiSaveMsg('Failed to save — check permissions')
      setTimeout(() => setAiSaveMsg(null), 4000)
    } finally {
      setAiSaving(false)
    }
  }

  // Save BYOK to localStorage
  function handleByokChange(patch: Partial<ByokConfig>) {
    setByok(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(BYOK_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => { fetchHealth() }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Profile</h3>
            <p className="text-sm text-gray-500">Your account information</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-500">
              Name
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {user?.name ?? 'Not set'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">
              Email
            </label>
            <p className="mt-1 text-sm text-gray-900">
              {user?.email ?? 'Not set'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">
              Role
            </label>
            <p className="mt-1 text-sm text-gray-900">Doctor</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">
              Account ID
            </label>
            <p className="mt-1 font-mono text-sm text-gray-500">
              {user?.id ?? '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <Monitor className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Preferences
            </h3>
            <p className="text-sm text-gray-500">
              Dashboard display settings
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Compact table view
              </p>
              <p className="text-xs text-gray-500">
                Show more data per page in tables
              </p>
            </div>
            <div className="h-5 w-9 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Show risk highlights
              </p>
              <p className="text-xs text-gray-500">
                Highlight high-risk observations in red
              </p>
            </div>
            <div className="h-5 w-9 rounded-full bg-blue-600" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
            <Bell className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Notifications
            </h3>
            <p className="text-sm text-gray-500">
              Manage alert preferences
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                New screening alerts
              </p>
              <p className="text-xs text-gray-500">
                Notify when new screenings need review
              </p>
            </div>
            <div className="h-5 w-9 rounded-full bg-blue-600" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                High-risk alerts
              </p>
              <p className="text-xs text-gray-500">
                Immediate alerts for high-risk findings
              </p>
            </div>
            <div className="h-5 w-9 rounded-full bg-blue-600" />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <Shield className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Security
            </h3>
            <p className="text-sm text-gray-500">
              Authentication and security settings
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm text-gray-600">
            Authentication is managed via Better Auth. Password changes and
            two-factor authentication can be configured through your account
            provider.
          </p>
        </div>
      </div>

      {/* AI Configuration (Admin) */}
      {isAdmin && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">AI Configuration</h3>
              <p className="text-sm text-gray-500">Organization AI model and routing settings</p>
            </div>
          </div>

          <div className="mt-6">
            {aiConfigLoading ? (
              <p className="text-sm text-gray-400">Loading AI configuration...</p>
            ) : (
              <AIConfigPanel
                config={aiConfig || undefined}
                onSave={handleSaveAiConfig}
                saving={aiSaving}
              />
            )}
            {aiSaveMsg && (
              <p className={`mt-3 text-xs font-medium ${aiSaveMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                {aiSaveMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Doctor BYOK (Bring Your Own Key) */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
            <Key className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Personal AI Key</h3>
            <p className="text-sm text-gray-500">Use your own API key for cloud AI (stored locally, never sent to server)</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Use personal API key</p>
              <p className="text-xs text-gray-500">Overrides organization cloud AI config</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={byok.enabled}
                onChange={e => handleByokChange({ enabled: e.target.checked })}
              />
              <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          {byok.enabled && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Provider</label>
                <select
                  value={byok.provider}
                  onChange={e => handleByokChange({ provider: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="gemini">Gemini Flash (Google)</option>
                  <option value="claude">Claude Sonnet (Anthropic)</option>
                  <option value="gpt4o">GPT-4o (OpenAI)</option>
                  <option value="groq">Groq (Llama 3.3 70B)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                <input
                  type="password"
                  value={byok.apiKey}
                  onChange={e => handleByokChange({ apiKey: e.target.value })}
                  placeholder="sk-... or AIza..."
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Your API key is stored in this browser only (localStorage). It is never sent to the SKIDS server — it goes directly from your browser to the AI provider.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* System Health */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">System Health</h3>
              <p className="text-sm text-gray-500">API and service status</p>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            disabled={healthLoading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {health ? (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${health.status === 'healthy' ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="text-sm font-medium text-gray-900 capitalize">{health.status}</span>
              <span className="text-xs text-gray-400">v{health.version} | {health.environment}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(health.checks).map(([name, check]) => (
                <div key={name} className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 capitalize">{name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      check.status === 'ok' ? 'bg-green-100 text-green-700' :
                      check.status === 'not_configured' ? 'bg-gray-100 text-gray-500' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {check.status}
                    </span>
                  </div>
                  {check.latencyMs > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">{check.latencyMs}ms latency</p>
                  )}
                  {check.details && typeof check.details === 'object' && (
                    <div className="mt-1.5 space-y-0.5">
                      {Object.entries(check.details).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[10px]">
                          <span className="text-gray-500">{k}</span>
                          <span className="text-gray-700 font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[10px] text-gray-400">
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-400">
            {healthLoading ? 'Checking system health...' : 'Unable to connect to API.'}
          </p>
        )}
      </div>

      {/* Version info */}
      <div className="rounded-lg bg-gray-50 p-4 text-center">
        <p className="text-xs text-gray-400">
          SKIDS Screen v3.0 &mdash; Doctor Dashboard
        </p>
        <p className="text-xs text-gray-400">
          API: skids-api.satish-9f4.workers.dev
        </p>
      </div>
    </div>
  )
}
