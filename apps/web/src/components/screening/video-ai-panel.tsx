
/**
 * VideoAIPanel — Reusable on-device AI analysis panel for screening modules
 *
 * Drop this into any screening module to get real-time LFM2.5-VL analysis.
 * Uses the shared useLFMModel() hook — model downloads once, shared across all modules.
 *
 * Usage:
 *   <VideoAIPanel
 *     moduleType="dental"
 *     imageBase64={capturedFrame}
 *     onAnalysisComplete={(result) => saveToObservation(result)}
 *   />
 */

import React, { useState, useCallback } from 'react'
import { useLFMModel } from '@/hooks/use-lfm-model'
import { getModulePrompt, getModuleAILabel, getModuleDevice, moduleHasVideoAI } from '@/lib/ai/module-prompts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface VideoAIPanelProps {
  /** Module type for prompt selection */
  moduleType: string
  /** Base64 image to analyze (from video frame or photo capture) */
  imageBase64: string | null
  /** Called when analysis completes with the result text */
  onAnalysisComplete?: (result: VideoAIResult) => void
  /** Optional: multiple frames to analyze (picks best result) */
  allFrames?: string[]
  /** Child name for context */
  childName?: string
  /** Child age for context */
  childAge?: string
}

export interface VideoAIResult {
  text: string
  modelId: string
  moduleType: string
  timestamp: string
  processingType: 'browser-local'
  deviceInfo: string
}

export function VideoAIPanel({
  moduleType,
  imageBase64,
  onAnalysisComplete,
  childName,
  childAge,
}: VideoAIPanelProps) {
  const [modelState, modelActions] = useLFMModel()
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!moduleHasVideoAI(moduleType)) return null

  const label = getModuleAILabel(moduleType)
  const device = getModuleDevice(moduleType)
  const prompt = getModulePrompt(moduleType)

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64 || !modelActions.isReady) return
    setAnalyzing(true)
    setResult(null)
    setStreamingText('')
    setError(null)

    try {
      // Build contextual prompt
      let contextPrompt = prompt
      if (childName) contextPrompt += `\n\nPatient: ${childName}`
      if (childAge) contextPrompt += `, Age: ${childAge}`

      const fullText = await modelActions.generate(imageBase64, contextPrompt, {
        maxNewTokens: 300,
        onToken: (token) => {
          setStreamingText(prev => prev + token)
        }
      })

      setResult(fullText)
      setStreamingText('')

      // Report result back to parent module
      onAnalysisComplete?.({
        text: fullText,
        modelId: 'LFM2.5-VL-1.6B-Q4',
        moduleType,
        timestamp: new Date().toISOString(),
        processingType: 'browser-local',
        deviceInfo: modelState.gpuInfo || 'WebGPU',
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }, [imageBase64, modelActions, prompt, childName, childAge, moduleType, onAnalysisComplete, modelState.gpuInfo])

  return (
    <Card className="border-blue-500/30 bg-blue-950/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>🧠</span>
            <span>On-Device AI: {label}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {device === 'tablet' && (
              <Badge variant="outline" className="text-xs">Best on Tablet/Laptop</Badge>
            )}
            {modelState.status === 'ready' && (
              <Badge className="bg-green-600/20 text-green-400 text-xs">Model Ready</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Model not loaded */}
        {modelState.status === 'idle' && (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground mb-2">
              AI model not loaded. Download once (~1.8 GB), works offline forever.
            </p>
            <Button onClick={modelActions.loadModel} size="sm">
              Download AI Model
            </Button>
          </div>
        )}

        {/* Model loading */}
        {(modelState.status === 'loading' || modelState.status === 'checking') && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{modelState.statusText}</p>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${modelState.progress}%` }}
              />
            </div>
            {modelState.cacheSize && (
              <p className="text-xs text-muted-foreground">{modelState.cacheSize}</p>
            )}
          </div>
        )}

        {/* WebGPU not supported */}
        {modelState.status === 'unsupported' && (
          <Alert>
            <AlertDescription className="text-xs">
              WebGPU not available. Use Chrome 113+ on a device with a GPU for on-device AI.
            </AlertDescription>
          </Alert>
        )}

        {/* Model error */}
        {modelState.status === 'error' && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">
              {modelState.statusText}
              <Button onClick={modelActions.loadModel} size="sm" variant="outline" className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Ready to analyze */}
        {modelState.status === 'ready' && (
          <>
            {!imageBase64 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Capture an image first, then AI will analyze it.
              </p>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  size="sm"
                  className="w-full"
                >
                  {analyzing ? '🔄 Analyzing...' : `🧠 Analyze with AI (${label})`}
                </Button>

                {/* Streaming output */}
                {streamingText && (
                  <div className="p-3 rounded-md bg-muted/50 text-sm whitespace-pre-wrap">
                    {streamingText}
                    <span className="animate-pulse">▊</span>
                  </div>
                )}

                {/* Final result */}
                {result && !streamingText && (
                  <div className="p-3 rounded-md bg-green-950/20 border border-green-500/20 text-sm whitespace-pre-wrap">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-green-400 font-semibold">AI Analysis Result</span>
                      <Badge variant="outline" className="text-xs ml-auto">On-Device</Badge>
                    </div>
                    {result}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  🔒 100% on-device • No data leaves your {device} • LFM2.5-VL-1.6B via WebGPU
                </p>
                <p className="flex items-center justify-center gap-1 text-[9px] text-amber-500 mt-1">
                  ⚠️ AI suggestions are screening aids only. Use clinical judgment for all observations.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
