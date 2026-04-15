/**
 * AI Analysis Panel — "Ask AI" button with risk badge, findings, confidence.
 * Ported from V2 ai-analysis-panel.tsx.
 *
 * Used in both nurse (local-only) and doctor (hybrid) modes.
 */

import { useState, useCallback } from 'react'

export interface AIAnalysisResult {
  riskLevel: 'normal' | 'low' | 'moderate' | 'high'
  findings: Array<{
    label: string
    chipId?: string
    confidence: number
    reasoning: string
  }>
  urgentFlags: string[]
  summary: string
  provider?: string
  model?: string
  latencyMs?: number
}

interface AIAnalysisPanelProps {
  imageDataUrl?: string
  moduleType: string
  moduleName: string
  childAge?: string
  nurseChips?: string[]
  chipSeverities?: Record<string, string>
  availableChipIds?: string[]
  mode?: 'nurse' | 'doctor'
  llmConfig?: {
    mode?: string
    ollamaUrl?: string
    ollamaModel?: string
    cloudGatewayUrl?: string
    cloudProvider?: string
    cloudApiKey?: string
    sendImagesToCloud?: boolean
  }
  onSuggestChips?: (chipIds: string[]) => void
  onAnalysisComplete?: (result: AIAnalysisResult) => void
}

const RISK_COLORS: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 border border-green-300',
  low: 'bg-blue-100 text-blue-800 border border-blue-300',
  moderate: 'bg-orange-100 text-orange-800 border border-orange-300',
  high: 'bg-red-100 text-red-800 border border-red-300',
}

export function AIAnalysisPanel({
  imageDataUrl,
  moduleType,
  moduleName,
  childAge,
  nurseChips = [],
  chipSeverities = {},
  availableChipIds,
  mode = 'nurse',
  llmConfig,
  onSuggestChips,
  onAnalysisComplete,
}: AIAnalysisPanelProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = useCallback(async () => {
    if (!imageDataUrl) {
      setError('No image available for analysis')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { buildVisionPrompt, parseVisionAnalysis, queryLLM, DEFAULT_LLM_CONFIG } =
        await import('../../lib/ai/llm-gateway')

      const messages = buildVisionPrompt(
        moduleType,
        moduleName,
        childAge,
        nurseChips,
        chipSeverities,
        availableChipIds,
      )

      const messagesWithImage = messages.map(m => {
        if (m.role === 'user') {
          return { ...m, images: [imageDataUrl] }
        }
        return m
      })

      // Build config from defaults + org overrides
      const config = {
        ...DEFAULT_LLM_CONFIG,
        ...(llmConfig?.mode && { mode: llmConfig.mode as typeof DEFAULT_LLM_CONFIG.mode }),
        ...(llmConfig?.ollamaUrl && { ollamaUrl: llmConfig.ollamaUrl }),
        ...(llmConfig?.ollamaModel && { ollamaModel: llmConfig.ollamaModel }),
        ...(llmConfig?.cloudGatewayUrl && { cloudGatewayUrl: llmConfig.cloudGatewayUrl }),
        ...(llmConfig?.cloudProvider && { cloudProvider: llmConfig.cloudProvider as typeof DEFAULT_LLM_CONFIG.cloudProvider }),
        ...(llmConfig?.cloudApiKey && { cloudApiKey: llmConfig.cloudApiKey }),
        ...(llmConfig?.sendImagesToCloud !== undefined && { sendImagesToCloud: llmConfig.sendImagesToCloud }),
      }

      // Nurse mode: on-device ONLY. Cloud AI is doctor-tier (Phase 02).
      // Full on-device stack (LFM2.5-VL-450M + function calling) lands in
      // Phase 02a — see specs/02a-liquid-ai-on-device.md. Until then, nurses
      // run the Ollama path via `local_only` with zero cloud egress.
      if (mode === 'nurse') {
        config.mode = 'local_only'
        config.sendImagesToCloud = false
        config.cloudGatewayUrl = ''
        config.cloudApiKey = ''
      }

      const responses = await queryLLM(config, messagesWithImage)
      const bestResponse = responses.find(r => !r.error) || responses[0]

      if (bestResponse.error) {
        setError(
          bestResponse.error.includes('connection')
            ? 'AI unavailable offline — screening continues without it. Ensure Ollama is running.'
            : `AI error: ${bestResponse.error}`
        )
        return
      }

      const parsed = parseVisionAnalysis(bestResponse.text)
      if (!parsed) {
        setError('Could not parse AI response. Try again.')
        return
      }

      const analysisResult: AIAnalysisResult = {
        ...parsed,
        provider: bestResponse.provider,
        model: bestResponse.model,
        latencyMs: bestResponse.latencyMs,
      }

      setResult(analysisResult)
      onAnalysisComplete?.(analysisResult)

      const suggestedChipIds = parsed.findings
        .filter(f => f.chipId && f.confidence >= 0.5)
        .map(f => f.chipId!)

      if (suggestedChipIds.length > 0) {
        onSuggestChips?.(suggestedChipIds)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes('fetch')
            ? 'AI unavailable — is Ollama running? Screening continues without it.'
            : err.message
          : 'Analysis failed'
      )
    } finally {
      setLoading(false)
    }
  }, [imageDataUrl, moduleType, moduleName, childAge, nurseChips, chipSeverities, availableChipIds, mode, llmConfig, onSuggestChips, onAnalysisComplete])

  return (
    <div className="rounded-xl border-2 border-purple-200 bg-purple-50/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-purple-800">AI Analysis</span>
          {mode === 'nurse' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-300">
              Local AI
            </span>
          )}
          {mode === 'doctor' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-300">
              Hybrid AI
            </span>
          )}
        </div>

        {!result && (
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-purple-100 border border-purple-300 text-purple-700 hover:bg-purple-200 disabled:opacity-50"
            onClick={handleAnalyze}
            disabled={loading || !imageDataUrl}
          >
            {loading ? 'Analyzing...' : 'AI Analyze Photo'}
          </button>
        )}

        {result && (
          <button
            className="text-xs text-purple-600 hover:text-purple-800"
            onClick={() => { setResult(null); setError(null) }}
          >
            Re-analyze
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">{error}</p>
          <p className="text-[10px] text-amber-500 mt-1">
            Screening continues normally without AI — tap chips manually.
          </p>
        </div>
      )}

      {/* No image hint */}
      {!imageDataUrl && !loading && !result && (
        <p className="text-xs text-purple-500">
          Capture a photo first, then tap "AI Analyze Photo" for automated detection.
        </p>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-2.5">
          {/* HITL banner — every cloud-AI output carries this label so the
              doctor knows the suggestion is advisory, not a diagnosis. */}
          {mode === 'doctor' && (
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-medium">
              AI Suggestion &mdash; Doctor&rsquo;s Diagnosis Required
            </div>
          )}

          {/* Risk badge + summary */}
          <div className="flex items-start gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${RISK_COLORS[result.riskLevel]}`}>
              {result.riskLevel.toUpperCase()}
            </span>
            <p className="text-xs text-gray-700 flex-1">{result.summary}</p>
          </div>

          {/* Urgent flags */}
          {result.urgentFlags.length > 0 && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-700 mb-1">Urgent</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {result.urgentFlags.map((flag, i) => (
                  <li key={i}>- {flag}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Findings */}
          {result.findings.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">
                Detected Findings
              </p>
              {result.findings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-purple-100">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: `conic-gradient(rgb(147 51 234) ${finding.confidence * 360}deg, #e9d5ff ${finding.confidence * 360}deg)`,
                      color: finding.confidence > 0.7 ? '#fff' : '#7c3aed',
                    }}
                  >
                    {Math.round(finding.confidence * 100)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800">{finding.label}</p>
                    {finding.reasoning && (
                      <p className="text-[10px] text-gray-500 mt-0.5">{finding.reasoning}</p>
                    )}
                    {finding.chipId && (
                      <span className="text-[9px] px-1 py-0.5 mt-1 inline-block rounded border border-purple-200 bg-purple-50 text-purple-600">
                        {finding.chipId}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.findings.length === 0 && (
            <p className="text-xs text-green-600 font-medium">No abnormalities detected by AI.</p>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            {result.provider && <span>Provider: {result.provider}</span>}
            {result.model && <span>Model: {result.model}</span>}
            {result.latencyMs && <span>{(result.latencyMs / 1000).toFixed(1)}s</span>}
          </div>
        </div>
      )}
    </div>
  )
}
