
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Icons } from '@/components/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { OrgConfig } from '@/lib/org-config'

interface ReadinessItem {
  id: string
  label: string
  status: 'checking' | 'ok' | 'warning' | 'error' | 'downloading'
  detail?: string
  downloadable?: boolean
  downloadProgress?: number // 0-100
  sizeLabel?: string
}

interface ReadinessCheckProps {
  onReady: () => void
  onSkip: () => void
  orgConfig?: OrgConfig | null
  role?: 'nurse' | 'doctor'
}

// Known AI model definitions
const AI_MODELS = [
  { key: 'mobileSamEncoder', label: 'MobileSAM Encoder', fallbackUrl: '', configKey: 'mobileSamEncoder' as const },
  { key: 'mobileSamDecoder', label: 'MobileSAM Decoder', fallbackUrl: '', configKey: 'mobileSamDecoder' as const },
  { key: 'entClassifier', label: 'ENT Classifier', fallbackUrl: '', configKey: 'entClassifier' as const },
  { key: 'photoscreening', label: 'Photoscreening', fallbackUrl: '', configKey: 'photoscreening' as const },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ReadinessCheck({ onReady, onSkip, orgConfig, role = 'nurse' }: ReadinessCheckProps) {
  const [items, setItems] = useState<ReadinessItem[]>([])
  const [modelItems, setModelItems] = useState<ReadinessItem[]>([])
  const [downloadingAll, setDownloadingAll] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const updateItem = useCallback((id: string, update: Partial<ReadinessItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...update } : item))
  }, [])

  const updateModelItem = useCallback((id: string, update: Partial<ReadinessItem>) => {
    setModelItems(prev => prev.map(item => item.id === id ? { ...item, ...update } : item))
  }, [])

  useEffect(() => {
    // Initialize check items based on role
    if (role === 'doctor') {
      // Doctor: skip camera/devices, check AI connectivity
      setItems([
        { id: 'storage', label: 'Storage Space', status: 'checking' },
        { id: 'ollama', label: 'Local AI (Ollama)', status: 'checking' },
        { id: 'cloud-ai', label: 'Cloud AI Gateway', status: 'checking' },
      ])
    } else {
      // Nurse: full checks
      setItems([
        { id: 'camera', label: 'Camera Access', status: 'checking' },
        { id: 'devices', label: 'Connected Devices', status: 'checking' },
        { id: 'stethoscope', label: 'Stethoscope Bridge', status: 'checking' },
        { id: 'storage', label: 'Storage Space', status: 'checking' },
        { id: 'ollama', label: 'Local AI (Ollama)', status: 'checking' },
      ])
    }

    // Initialize model items from orgConfig
    const models = AI_MODELS.map(m => {
      const configModel = orgConfig?.aiModels?.[m.configKey]
      return {
        id: m.key,
        label: m.label,
        status: 'checking' as const,
        downloadable: !!configModel?.url,
        sizeLabel: configModel?.sizeBytes ? formatBytes(configModel.sizeBytes) : undefined,
      }
    })
    setModelItems(models)

    runChecks()
    checkModels()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runChecks = async () => {
    // Camera access (nurse only)
    if (role === 'nurse') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(t => t.stop())
        updateItem('camera', { status: 'ok', detail: 'Camera available' })
      } catch {
        updateItem('camera', { status: 'error', detail: 'Camera denied or unavailable' })
      }

      // Connected devices (USB/Bluetooth) — nurse only
      await checkDevices()
    }

    // Storage space
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate()
        const usedMB = Math.round((est.usage || 0) / 1024 / 1024)
        const quotaMB = Math.round((est.quota || 0) / 1024 / 1024)
        const freeMB = quotaMB - usedMB
        if (freeMB > 100) {
          updateItem('storage', { status: 'ok', detail: `${freeMB} MB free` })
        } else {
          updateItem('storage', { status: 'warning', detail: `Only ${freeMB} MB free — consider clearing old data` })
        }
      } else {
        updateItem('storage', { status: 'ok', detail: 'Storage API unavailable' })
      }
    } catch {
      updateItem('storage', { status: 'ok', detail: 'Could not estimate storage' })
    }

    // Ollama status
    try {
      const { checkOllamaStatus } = await import('@/lib/ai/llm-gateway')
      const status = await checkOllamaStatus()
      if (status.available) {
        updateItem('ollama', { status: 'ok', detail: `Connected — ${status.models.length} model${status.models.length !== 1 ? 's' : ''}` })
      } else {
        updateItem('ollama', { status: 'warning', detail: 'Offline — AI analysis unavailable' })
      }
    } catch {
      updateItem('ollama', { status: 'warning', detail: 'Check failed' })
    }

    // Stethoscope bridge check (nurse only)
    if (role === 'nurse') {
      try {
        const ws = new WebSocket('ws://localhost:8765')
        const stethoPromise = new Promise<void>((resolve) => {
          ws.onopen = () => { updateItem('stethoscope', { status: 'ok', detail: 'Bridge connected' }); ws.close(); resolve() }
          ws.onerror = () => { updateItem('stethoscope', { status: 'warning', detail: 'Not detected — optional for cardiac/pulmonary' }); resolve() }
          setTimeout(() => { try { ws.close() } catch {} resolve() }, 2000)
        })
        await stethoPromise
      } catch {
        updateItem('stethoscope', { status: 'warning', detail: 'Not available' })
      }
    }

    // Cloud AI gateway (doctor only)
    if (role === 'doctor') {
      try {
        const gatewayUrl = orgConfig?.llmConfig?.cloudGatewayUrl
        if (gatewayUrl) {
          // Just verify the URL is reachable (HEAD or GET with timeout)
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 5000)
          try {
            const res = await fetch(gatewayUrl, { method: 'HEAD', signal: controller.signal })
            clearTimeout(timeout)
            updateItem('cloud-ai', {
              status: res.ok || res.status === 405 ? 'ok' : 'warning',
              detail: res.ok || res.status === 405 ? 'Cloud AI gateway reachable' : `Status ${res.status}`,
            })
          } catch {
            clearTimeout(timeout)
            updateItem('cloud-ai', { status: 'warning', detail: 'Cloud AI unreachable — local AI still works' })
          }
        } else {
          updateItem('cloud-ai', { status: 'warning', detail: 'Not configured — using local AI only' })
        }
      } catch {
        updateItem('cloud-ai', { status: 'warning', detail: 'Check failed' })
      }
    }
  }

    // Report readiness to server (non-blocking)
    try {
      const API_URL = import.meta.env.VITE_API_URL || ''
      const token = localStorage.getItem('auth_token')
      if (token && API_URL) {
        fetch(`${API_URL}/api/device-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            deviceType: 'web',
            checks: items.map(i => ({ id: i.id, label: i.label, status: i.status, detail: i.detail })),
            overallStatus: items.some(i => i.status === 'error') ? 'error'
              : items.some(i => i.status === 'warning') ? 'warning' : 'ready',
          }),
        }).catch(() => {}) // Silently fail
      }
    } catch { /* non-critical */ }
  }

  const checkDevices = async () => {
    const detected: string[] = []

    // Enumerate media devices (cameras, microphones)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter(d => d.kind === 'videoinput')
      const mics = devices.filter(d => d.kind === 'audioinput')
      if (cameras.length > 0) detected.push(`${cameras.length} camera${cameras.length > 1 ? 's' : ''}`)
      if (mics.length > 0) detected.push(`${mics.length} mic${mics.length > 1 ? 's' : ''}`)
    } catch { /* skip */ }

    // Check USB devices (Web USB API)
    try {
      if ('usb' in navigator) {
        const usbDevices = await (navigator as unknown as { usb: { getDevices(): Promise<{ productName?: string }[]> } }).usb.getDevices()
        if (usbDevices.length > 0) {
          detected.push(`${usbDevices.length} USB device${usbDevices.length > 1 ? 's' : ''}`)
        }
      }
    } catch { /* WebUSB not available or denied */ }

    // Check Bluetooth (Web Bluetooth API) - only check already paired
    try {
      if ('bluetooth' in navigator) {
        // getDevices() returns previously granted devices (no prompt)
        const btApi = navigator as unknown as { bluetooth: { getDevices?: () => Promise<{ name?: string }[]> } }
        if (btApi.bluetooth.getDevices) {
          const btDevices = await btApi.bluetooth.getDevices()
          if (btDevices.length > 0) {
            const names = btDevices.map(d => d.name || 'Unknown').join(', ')
            detected.push(`BT: ${names}`)
          }
        }
      }
    } catch { /* Web Bluetooth not available */ }

    if (detected.length > 0) {
      updateItem('devices', { status: 'ok', detail: detected.join(' · ') })
    } else {
      updateItem('devices', { status: 'warning', detail: 'No external devices found — built-in camera OK' })
    }
  }

  const checkModels = async () => {
    try {
      const { isModelCached } = await import('@/lib/ai/model-loader')

      for (const model of AI_MODELS) {
        const configModel = orgConfig?.aiModels?.[model.configKey]
        const url = configModel?.url

        if (!url) {
          updateModelItem(model.key, {
            status: 'warning',
            detail: 'Not configured by admin',
            downloadable: false,
          })
          continue
        }

        const cached = await isModelCached(url)
        if (cached) {
          updateModelItem(model.key, {
            status: 'ok',
            detail: 'Cached on device',
            downloadable: false,
          })
        } else {
          updateModelItem(model.key, {
            status: 'warning',
            detail: 'Not downloaded yet',
            downloadable: true,
            sizeLabel: configModel?.sizeBytes ? formatBytes(configModel.sizeBytes) : 'unknown size',
          })
        }
      }
    } catch {
      for (const model of AI_MODELS) {
        updateModelItem(model.key, {
          status: 'warning',
          detail: 'Model check failed',
          downloadable: false,
        })
      }
    }
  }

  const downloadModel = async (modelKey: string) => {
    const configModel = orgConfig?.aiModels?.[modelKey as keyof NonNullable<OrgConfig['aiModels']>]
    if (!configModel?.url) return

    updateModelItem(modelKey, { status: 'downloading', downloadProgress: 0, detail: 'Starting download...' })

    try {
      const { isModelCached } = await import('@/lib/ai/model-loader')

      // Use fetchModelBytes approach: fetch with progress → store in Cache API
      const cache = await caches.open('zpediscreen-ai-models-v1')
      const response = await fetch(configModel.url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const total = parseInt(response.headers.get('content-length') || '0', 10)
      const reader = response.body?.getReader()

      if (!reader) {
        // No streaming, just buffer it
        const buffer = await response.arrayBuffer()
        await cache.put(configModel.url, new Response(buffer, {
          headers: { 'Content-Type': 'application/octet-stream' },
        }))
        updateModelItem(modelKey, { status: 'ok', detail: `Downloaded (${formatBytes(buffer.byteLength)})`, downloadable: false, downloadProgress: 100 })
        return
      }

      const chunks: Uint8Array[] = []
      let loaded = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        loaded += value.length
        const percent = total ? Math.round((loaded / total) * 100) : 0
        updateModelItem(modelKey, {
          status: 'downloading',
          downloadProgress: percent,
          detail: `${formatBytes(loaded)}${total ? ` / ${formatBytes(total)}` : ''} (${percent}%)`,
        })
      }

      // Combine and cache
      const combined = new Uint8Array(loaded)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }

      await cache.put(configModel.url, new Response(combined.buffer, {
        headers: { 'Content-Type': 'application/octet-stream' },
      }))

      // Verify
      const verified = await isModelCached(configModel.url)
      updateModelItem(modelKey, {
        status: verified ? 'ok' : 'error',
        detail: verified ? `Downloaded (${formatBytes(loaded)})` : 'Download failed verification',
        downloadable: !verified,
        downloadProgress: 100,
      })
    } catch (err) {
      updateModelItem(modelKey, {
        status: 'error',
        detail: `Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        downloadable: true,
        downloadProgress: 0,
      })
    }
  }

  const downloadAllModels = async () => {
    setDownloadingAll(true)
    const downloadable = modelItems.filter(m => m.downloadable && m.status !== 'downloading')
    for (const model of downloadable) {
      await downloadModel(model.id)
    }
    setDownloadingAll(false)
  }

  const allItemsDone = items.every(i => i.status !== 'checking')
  const allModelsDone = modelItems.every(i => i.status !== 'checking' && i.status !== 'downloading')
  const allDone = allItemsDone && allModelsDone
  const hasErrors = items.some(i => i.status === 'error')
  const modelsDownloadable = modelItems.filter(m => m.downloadable && m.status !== 'downloading')
  const totalModels = modelItems.length
  const cachedModels = modelItems.filter(m => m.status === 'ok').length

  const statusIcon = (status: ReadinessItem['status']) => {
    switch (status) {
      case 'checking': return <Icons.Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      case 'ok': return <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><Icons.Check className="w-3 h-3 text-white" /></div>
      case 'warning': return <Icons.AlertTriangle className="w-4 h-4 text-amber-500" />
      case 'error': return <Icons.X className="w-4 h-4 text-red-500" />
      case 'downloading': return <Icons.Loader2 className="w-4 h-4 animate-spin text-blue-500" />
    }
  }

  const renderItem = (item: ReadinessItem, isModel = false) => (
    <div key={item.id} className="space-y-1">
      <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
        {statusIcon(item.status)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{item.label}</p>
          {item.detail && (
            <p className="text-xs text-gray-500 truncate">{item.detail}</p>
          )}
        </div>
        {item.status === 'ok' && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 border-green-200">Ready</Badge>}
        {item.status === 'warning' && !item.downloadable && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200">Optional</Badge>}
        {item.status === 'error' && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">Issue</Badge>}
        {item.downloadable && item.status === 'warning' && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
            onClick={() => downloadModel(item.id)}
          >
            <Icons.Download className="w-3 h-3 mr-1" />
            {item.sizeLabel || 'Download'}
          </Button>
        )}
      </div>
      {item.status === 'downloading' && item.downloadProgress !== undefined && (
        <Progress value={item.downloadProgress} className="h-1.5 mx-2" />
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Icons.Shield className="w-5 h-5" />
          {role === 'doctor' ? 'Review Readiness' : 'Device Setup & Readiness'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-500">
          {role === 'doctor'
            ? 'Checking AI connectivity and resources. AI features enhance review but are optional.'
            : 'Checking device capabilities and downloading required resources. AI features are optional — screening works without them.'}
        </p>

        {/* System checks */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">System</p>
          <div className="space-y-1">
            {items.map(item => renderItem(item))}
          </div>
        </div>

        {/* AI Models section */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              AI Models ({cachedModels}/{totalModels} cached)
            </p>
            {modelsDownloadable.length > 0 && !downloadingAll && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-6 px-2"
                onClick={downloadAllModels}
              >
                <Icons.Download className="w-3 h-3 mr-1" />
                Download All
              </Button>
            )}
            {downloadingAll && (
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                <Icons.Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Downloading...
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            {modelItems.map(item => renderItem(item, true))}
          </div>
        </div>

        {/* Action buttons */}
        {allDone && (
          <div className="flex gap-2">
            {!hasErrors ? (
              <Button className="flex-1" onClick={onReady}>
                {cachedModels === totalModels && items.every(i => i.status === 'ok')
                  ? role === 'doctor' ? 'All Clear — Start Reviews' : 'All Clear — Start Screening'
                  : role === 'doctor' ? 'Continue — Start Reviews' : 'Continue — Start Screening'}
              </Button>
            ) : (
              <>
                <Button variant="outline" className="flex-1" onClick={onSkip}>
                  Skip & Continue Anyway
                </Button>
                <Button className="flex-1" onClick={() => {
                  setItems(prev => prev.map(i => ({ ...i, status: 'checking' as const, detail: undefined })))
                  setModelItems(prev => prev.map(i => ({ ...i, status: 'checking' as const, detail: undefined })))
                  runChecks()
                  checkModels()
                }}>
                  Retry
                </Button>
              </>
            )}
          </div>
        )}

        {!allDone && (
          <Button variant="ghost" size="sm" className="w-full text-gray-400" onClick={onSkip}>
            Skip checks
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
