import { useState, useEffect } from 'react'
import { Brain, Key } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { apiCall } from '@/lib/api'
import { AIConfigPanel } from '@/components/admin/AIConfigPanel'
import type { LLMConfig } from '@/lib/ai/llm-gateway'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Switch } from '@/components/ui'

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

interface OrganizationTabProps {
  isAdmin: boolean
}

export function OrganizationTab({ isAdmin }: OrganizationTabProps) {
  const { user } = useAuth()

  // AI Config state (admin only)
  const [aiConfig, setAiConfig] = useState<Partial<LLMConfig> | null>(null)
  const [aiConfigLoading, setAiConfigLoading] = useState(true)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSaveMsg, setAiSaveMsg] = useState<string | null>(null)

  // BYOK state (all users)
  const [byok, setByok] = useState<ByokConfig>(loadByok)

  useEffect(() => {
    async function fetchAiConfig() {
      try {
        const orgId = (user as any)?.orgId as string || 'default'
        const res = await apiCall<{ config: Partial<LLMConfig> | null }>(`/api/ai-config/${orgId}`)
        setAiConfig(res.config || {})
      } catch {
        setAiConfig({})
      } finally {
        setAiConfigLoading(false)
      }
    }
    if (isAdmin) fetchAiConfig()
    else setAiConfigLoading(false)
  }, [user, isAdmin])

  async function handleSaveAiConfig(config: LLMConfig) {
    setAiSaving(true)
    setAiSaveMsg(null)
    try {
      const orgId = (user as any)?.orgId as string || 'default'
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

  function handleByokChange(patch: Partial<ByokConfig>) {
    setByok((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(BYOK_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="space-y-6 mt-6">
      {/* AI Configuration (admin/ops_manager only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>AI Configuration</CardTitle>
                <CardDescription>Organization AI model and routing settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {aiConfigLoading ? (
              <p className="text-sm text-muted-foreground">Loading AI configuration...</p>
            ) : (
              <AIConfigPanel
                config={aiConfig || undefined}
                onSave={handleSaveAiConfig}
                saving={aiSaving}
              />
            )}
            {aiSaveMsg && (
              <p
                className={`mt-3 text-xs font-medium ${
                  aiSaveMsg.includes('Failed') ? 'text-destructive' : 'text-success'
                }`}
              >
                {aiSaveMsg}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Personal AI Key (BYOK) — all users */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
              <Key className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle>Personal AI Key</CardTitle>
              <CardDescription>
                Use your own API key for cloud AI (stored locally, never sent to server)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Use personal API key</p>
                <p className="text-xs text-muted-foreground">Overrides organization cloud AI config</p>
              </div>
              <Switch
                checked={byok.enabled}
                onChange={(v) => handleByokChange({ enabled: v })}
              />
            </div>

            {byok.enabled && (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Provider
                  </label>
                  <select
                    value={byok.provider}
                    onChange={(e) => handleByokChange({ provider: e.target.value })}
                    className="w-full text-sm px-3 py-2 border border-input rounded-lg bg-card"
                  >
                    <option value="gemini">Gemini Flash (Google)</option>
                    <option value="claude">Claude Sonnet (Anthropic)</option>
                    <option value="gpt4o">GPT-4o (OpenAI)</option>
                    <option value="groq">Groq (Llama 3.3 70B)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={byok.apiKey}
                    onChange={(e) => handleByokChange({ apiKey: e.target.value })}
                    placeholder="sk-... or AIza..."
                    className="w-full text-sm px-3 py-2 border border-input rounded-lg bg-card"
                  />
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    Your API key is stored in this browser only (localStorage). It is never sent to
                    the SKIDS server — it goes directly from your browser to the AI provider.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
