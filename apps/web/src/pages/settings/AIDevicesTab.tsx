/**
 * AI & Devices Settings Tab — Embeds AIConfigPanel + API key management + device integration.
 */

import { useState, useEffect } from 'react'
import { Bot, Key, Check, AlertCircle, Wifi, Copy, CheckCircle2, Cpu } from 'lucide-react'
import { apiCall } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AIConfigPanel } from '@/components/admin/AIConfigPanel'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import type { LLMConfig } from '@/lib/ai/llm-gateway'

const AYUSYNC_WEBHOOK_URL = 'https://skids-api.satish-9f4.workers.dev/api/ayusync/report'

export function AIDevicesTab() {
  const { user } = useAuth()
  const orgId = (user as any)?.organizationId || (user as any)?.orgId || 'default'

  const [saving, setSaving] = useState(false)
  const [geminiKey, setGeminiKey] = useState('')
  const [geminiKeyMasked, setGeminiKeyMasked] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [savedConfig, setSavedConfig] = useState<Partial<LLMConfig> | undefined>(undefined)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load existing config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res: any = await apiCall(`/api/ai-config/${orgId}`)
        const data = (res?.config !== undefined ? res : { config: null }) as { config: Record<string, unknown> | null }
        if (data.config) {
          setSavedConfig(data.config as Partial<LLMConfig>)
          // Show masked version if key exists
          const existingKey = (data.config as Record<string, unknown>).geminiApiKey as string | undefined
          if (existingKey) {
            setGeminiKeyMasked(existingKey.slice(0, 6) + '...' + existingKey.slice(-4))
          }
        }
      } catch {
        // Config not yet created, that's fine
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [orgId])

  async function handleSaveAIConfig(config: LLMConfig) {
    setSaving(true)
    setMsg(null)
    try {
      // Merge gemini key into config
      const fullConfig = {
        ...config,
        ...(geminiKey ? { geminiApiKey: geminiKey } : {}),
      }
      await apiCall(`/api/ai-config/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ config: fullConfig }),
      })
      setMsg({ type: 'success', text: 'AI configuration saved successfully' })
      if (geminiKey) {
        setGeminiKeyMasked(geminiKey.slice(0, 6) + '...' + geminiKey.slice(-4))
        setGeminiKey('')
        setShowGeminiKey(false)
      }
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save configuration' })
    } finally {
      setSaving(false)
    }
  }

  function handleCopyWebhook() {
    navigator.clipboard.writeText(AYUSYNC_WEBHOOK_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-gray-900 rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Status Message */}
      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msg.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {msg.text}
        </div>
      )}

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
              <Key className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage cloud AI provider credentials</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Gemini API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Gemini API Key</label>
                {geminiKeyMasked && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Configured ({geminiKeyMasked})
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  className="flex-1 text-xs px-3 py-2 border rounded-lg bg-background"
                  placeholder={geminiKeyMasked ? 'Enter new key to replace existing' : 'AIzaSy... (from Google AI Studio)'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="text-xs px-3 py-2 bg-muted border rounded-lg hover:bg-muted/80"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                >
                  {showGeminiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Used for Gemini Flash vision analysis. Get a free key at{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 underline"
                >
                  aistudio.google.com/apikey
                </a>
              </p>
            </div>

            {/* Workers AI Status */}
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-medium text-emerald-800">Cloudflare Workers AI</p>
                  <p className="text-[10px] text-emerald-600">
                    Always enabled — free Llama 3.2 Vision, no API key needed
                  </p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                Active
              </span>
            </div>

            {/* Provider Priority Note */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-[10px] text-blue-700">
                <strong>How it works:</strong> Vision analysis tries Workers AI (free) first.
                If that fails, falls back to Gemini Flash (if API key is configured).
                Setting a Gemini key here stores it in the database so you don't need CLI access to wrangler secrets.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Configuration Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>AI Model Configuration</CardTitle>
              <CardDescription>Set AI mode, local model, and cloud provider preferences</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AIConfigPanel
            config={savedConfig}
            onSave={handleSaveAIConfig}
            saving={saving}
          />
        </CardContent>
      </Card>

      {/* Device Integration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <Wifi className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle>Device Integration</CardTitle>
              <CardDescription>Connect medical devices for automated data capture</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* AyuSync Webhook */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">AyuSync Webhook URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 text-xs px-3 py-2 border rounded-lg bg-muted text-muted-foreground"
                  value={AYUSYNC_WEBHOOK_URL}
                  readOnly
                />
                <button
                  type="button"
                  className="text-xs px-3 py-2 bg-muted border rounded-lg hover:bg-muted/80 flex items-center gap-1"
                  onClick={handleCopyWebhook}
                >
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Configure this URL in your AyuSync device to automatically send vitals data to SKIDS.
              </p>
            </div>

            {/* Welch Allyn Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div>
                <p className="text-xs font-medium text-gray-800">Welch Allyn Spot Vision</p>
                <p className="text-[10px] text-gray-500">
                  Auto-import via AyuSync webhook integration
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
                Via AyuSync
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
