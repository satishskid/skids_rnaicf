// Local AI Page

/**
 * SKIDS Local AI — Real-time Vision Analysis
 * LFM2.5-VL-1.6B running in-browser via WebGPU
 * Layout inspired by Liquid AI's HuggingFace demo
 */

import { useState, useRef, useEffect, useCallback } from 'react'

let inferModule: any = null
async function getInfer() {
  if (!inferModule) inferModule = await import('@/lib/ai/webgpu/infer.js')
  return inferModule
}

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

interface Caption {
  time: string
  text: string
  id: number
}

export default function LocalAIClient() {
  const [gpuInfo, setGpuInfo] = useState<string | null>(null)
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [modelProgress, setModelProgress] = useState(0)
  const [modelStatusText, setModelStatusText] = useState('')
  const [selectedModel, setSelectedModel] = useState('LFM2.5-VL-1.6B-merge-linear-Q4-Q4')
  const [cacheSize, setCacheSize] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [captions, setCaptions] = useState<Caption[]>([])
  const [currentCaption, setCurrentCaption] = useState('')
  const [mode, setMode] = useState<'realtime' | 'upload'>('realtime')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState('')
  const [uploadAnalyzing, setUploadAnalyzing] = useState(false)
  const [prompt, setPrompt] = useState('Describe what you see in this image.')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const captureLoopRef = useRef<boolean>(false)
  const captionIdRef = useRef(0)
  const captionsEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check WebGPU on mount + auto-load model
  useEffect(() => {
    (async () => {
      // Navigator.gpu is only present on browsers that ship @webgpu/types; the
      // DOM lib we compile against doesn't declare it, so we read via an opt-in cast.
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
      if (!gpu) { setGpuInfo(null); return }
      try {
        const adapter = await gpu.requestAdapter()
        const info = (adapter as { info?: Record<string, string> } | null)?.info || {}
        setGpuInfo(info.description || info.vendor || info.architecture || 'WebGPU')
      } catch { setGpuInfo(null) }
    })()
    autoLoadFromCache()
  }, [])

  // Attach stream when camera activates — retry until video element is ready
  useEffect(() => {
    if (!cameraActive || !streamRef.current) return
    let attempts = 0
    const maxAttempts = 20
    const tryAttach = () => {
      const vid = videoRef.current
      if (vid && streamRef.current) {
        vid.srcObject = streamRef.current
        vid.muted = true
        vid.playsInline = true
        vid.play().catch(() => {})
      } else if (attempts < maxAttempts) {
        attempts++
        setTimeout(tryAttach, 100)
      }
    }
    tryAttach()
  }, [cameraActive])

  // Auto-scroll captions
  useEffect(() => {
    captionsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [captions, currentCaption])

  async function autoLoadFromCache() {
    try {
      const infer = await getInfer()
      const info = await infer.getCacheInfo()
      if (info && info.used > 500 * 1024 * 1024) {
        setCacheSize(`${(info.used / 1024 / 1024 / 1024).toFixed(1)} GB cached`)
        setModelStatus('loading')
        setModelStatusText('Loading from cache...')
        await infer.loadModel('LFM2.5-VL-1.6B-merge-linear-Q4-Q4', {
          progressCallback: (p: any) => {
            if (p.status === 'loading') {
              setModelProgress(Math.round(p.progress || 0))
              setModelStatusText(p.file ? `${p.file.split('/').pop()}` : 'Loading...')
            } else if (p.status === 'done') setModelProgress(100)
          }
        })
        setModelStatus('ready')
        setModelStatusText('Ready')
      }
    } catch (e) {
      console.warn('Auto-load failed:', e)
      setModelStatus('idle')
    }
  }

  async function handleLoadModel() {
    if (modelStatus === 'loading') return
    setModelStatus('loading'); setModelProgress(0); setModelStatusText('Initializing...')
    try {
      const infer = await getInfer()
      await infer.loadModel(selectedModel, {
        progressCallback: (p: any) => {
          if (p.status === 'loading') {
            setModelProgress(Math.round(p.progress || 0))
            setModelStatusText(p.file || 'Loading...')
          } else if (p.status === 'done') setModelProgress(100)
        }
      })
      setModelStatus('ready'); setModelStatusText('Ready')
      const info = await infer.getCacheInfo()
      if (info) setCacheSize(`${(info.used / 1024 / 1024 / 1024).toFixed(1)} GB cached`)
    } catch (e: any) {
      setModelStatus('error'); setModelStatusText(e.message)
    }
  }

  async function startCamera() {
    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }
      streamRef.current = stream
      setCameraActive(true)
      // Directly attach stream after a frame to ensure video element is mounted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current
            videoRef.current.muted = true
            videoRef.current.playsInline = true
            videoRef.current.play().catch(() => {})
          }
        })
      })
    } catch (e: any) {
      alert('Camera access denied: ' + e.message)
    }
  }

  function stopCamera() {
    stopCapturing()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }

  function captureFrame(): string | null {
    if (!videoRef.current || !canvasRef.current) return null
    const v = videoRef.current, c = canvasRef.current
    if (v.videoWidth === 0) return null
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', 0.8)
  }

  async function startCapturing() {
    if (modelStatus !== 'ready' || !cameraActive) return
    setCapturing(true)
    captureLoopRef.current = true
    const infer = await getInfer()

    while (captureLoopRef.current) {
      const frame = captureFrame()
      if (!frame) { await new Promise(r => setTimeout(r, 500)); continue }

      const timeStr = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setCurrentCaption('...')

      try {
        // Clear previous image cache for fresh analysis
        infer.clearImageCache?.()
        let fullText = ''
        await infer.generate([
          { role: 'user', content: [{ type: 'image', value: frame }, { type: 'text', value: prompt }] }
        ], {
          maxNewTokens: 80,
          onToken: (token: string) => { fullText += token; setCurrentCaption(fullText) }
        })

        const id = ++captionIdRef.current
        setCaptions(prev => [{ time: timeStr, text: fullText.trim(), id }, ...prev].slice(0, 50))
        setCurrentCaption('')
      } catch (e: any) {
        console.error('Capture loop error:', e)
        setCurrentCaption('Error: ' + e.message)
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    setCapturing(false)
  }

  function stopCapturing() {
    captureLoopRef.current = false
    setCapturing(false)
    setCurrentCaption('')
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setUploadedImage(reader.result as string); setUploadResult(''); setUploadAnalyzing(false) }
    reader.readAsDataURL(file)
  }

  async function analyzeUpload() {
    if (!uploadedImage || modelStatus !== 'ready') return
    setUploadAnalyzing(true); setUploadResult('')
    try {
      const infer = await getInfer()
      infer.clearImageCache?.()
      let full = ''
      await infer.generate([
        { role: 'user', content: [{ type: 'image', value: uploadedImage }, { type: 'text', value: prompt }] }
      ], {
        maxNewTokens: 512,
        onToken: (t: string) => { full += t; setUploadResult(full) }
      })
      setUploadResult(full)
    } catch (e: any) {
      setUploadResult('Error: ' + e.message)
    }
    setUploadAnalyzing(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <header style={{ background: 'rgba(10,10,15,0.95)', borderBottom: '1px solid #1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff' }}>S</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>SKIDS Local AI</h1>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>LFM2.5-VL-1.6B &bull; In-Browser &bull; WebGPU &bull; Zero Data Leaves Device</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {gpuInfo && <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>GPU: {gpuInfo}</span>}
          {/* Mode toggle */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
            <button onClick={() => setMode('realtime')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === 'realtime' ? '#38bdf8' : '#1e293b', color: mode === 'realtime' ? '#000' : '#94a3b8' }}>Real-time</button>
            <button onClick={() => setMode('upload')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: mode === 'upload' ? '#38bdf8' : '#1e293b', color: mode === 'upload' ? '#000' : '#94a3b8' }}>Upload</button>
          </div>
        </div>
      </header>

      {/* Model loader bar */}
      {modelStatus !== 'ready' && (
        <div style={{ padding: '12px 24px', background: '#111118', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 900, margin: '0 auto' }}>
            <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {modelStatus === 'loading' ? `Loading model... ${modelProgress}%` : 'Load AI Model:'}
            </span>
            {modelStatus !== 'loading' && (
              <>
                <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', fontSize: 12 }}>
                  <option value="LFM2.5-VL-1.6B-merge-linear-Q4-Q4">Vision Q4, Decoder Q4 (~1.8 GB)</option>
                  <option value="LFM2.5-VL-1.6B-merge-linear-Q4-FP16">Vision FP16, Decoder Q4 (~2.3 GB)</option>
                </select>
                <button onClick={handleLoadModel} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#38bdf8', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Load</button>
              </>
            )}
            {modelStatus === 'loading' && (
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#1e293b', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#38bdf8', width: `${modelProgress}%`, transition: 'width 0.3s' }} />
              </div>
            )}
            {cacheSize && <span style={{ fontSize: 11, color: '#64748b' }}>{cacheSize}</span>}
          </div>
          {modelStatus === 'error' && <p style={{ color: '#f87171', fontSize: 12, margin: '6px 0 0', textAlign: 'center' }}>{modelStatusText}</p>}
        </div>
      )}

      {/* Loaded badge */}
      {modelStatus === 'ready' && (
        <div style={{ padding: '6px 24px', background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid rgba(34,197,94,0.15)', textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#4ade80' }}>✓ LFM2.5-VL-1.6B loaded &bull; {cacheSize} &bull; 100% on-device</span>
        </div>
      )}

      {/* Main content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
        {mode === 'realtime' ? (
          /* ── REAL-TIME MODE ── */
          <div style={{ display: 'flex', gap: 16, minHeight: 'calc(100vh - 150px)' }}>
            {/* Left: Camera */}
            <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#111118', borderRadius: 12, border: '1px solid #1e293b', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Camera view */}
                <div style={{ flex: 1, position: 'relative', minHeight: 400, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cameraActive ? (
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#475569' }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
                      <p style={{ fontSize: 14 }}>Camera not started</p>
                    </div>
                  )}
                  {capturing && (
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(239,68,68,0.9)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Capturing</span>
                    </div>
                  )}
                </div>
                {/* Controls */}
                <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid #1e293b' }}>
                  {!cameraActive ? (
                    <button onClick={startCamera} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#38bdf8', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Start Camera</button>
                  ) : !capturing ? (
                    <>
                      <button onClick={startCapturing} disabled={modelStatus !== 'ready'}
                        style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: modelStatus === 'ready' ? '#22c55e' : '#334155', color: modelStatus === 'ready' ? '#000' : '#64748b', fontWeight: 700, fontSize: 13, cursor: modelStatus === 'ready' ? 'pointer' : 'default' }}>
                        {modelStatus === 'ready' ? '▶ Start' : 'Load model first'}
                      </button>
                      <button onClick={stopCamera} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Stop Camera</button>
                    </>
                  ) : (
                    <button onClick={stopCapturing} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>■ Stop</button>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Prompt:</span>
                    <select value={prompt} onChange={e => setPrompt(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', fontSize: 11, maxWidth: 200 }}>
                      <option value="Describe what you see in this image.">General</option>
                      <option value="If this is a medical or clinical image, identify notable observations for pediatric screening.">Clinical</option>
                      <option value="Examine for dental conditions: caries, gingivitis, malocclusion.">Dental</option>
                      <option value="Analyze for skin conditions: rashes, lesions, infections.">Skin</option>
                      <option value="Describe motor skills: posture, balance, coordination.">Motor</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Captions */}
            <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#111118', borderRadius: 12, border: '1px solid #1e293b', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>Captions</h2>
                  {captions.length > 0 && (
                    <button onClick={() => setCaptions([])} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 10, cursor: 'pointer' }}>Clear</button>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                  {/* Current (streaming) */}
                  {currentCaption && (
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(56,189,248,0.1)', background: 'rgba(56,189,248,0.05)' }}>
                      <div style={{ fontSize: 10, color: '#38bdf8', marginBottom: 4, fontFamily: 'monospace' }}>now</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{currentCaption}<span style={{ animation: 'pulse 0.5s infinite' }}>|</span></p>
                    </div>
                  )}
                  {/* Past captions */}
                  {captions.map(c => (
                    <div key={c.id} style={{ padding: '8px 16px', borderBottom: '1px solid #1e293b' }}>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, fontFamily: 'monospace' }}>{c.time}</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{c.text}</p>
                    </div>
                  ))}
                  {captions.length === 0 && !currentCaption && (
                    <div style={{ padding: '40px 16px', textAlign: 'center', color: '#475569' }}>
                      <p style={{ fontSize: 13 }}>Start capturing to see real-time AI analysis</p>
                    </div>
                  )}
                  <div ref={captionsEndRef} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── UPLOAD MODE ── */
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ background: '#111118', borderRadius: 12, border: '1px solid #1e293b', padding: 24 }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>Upload Image for Analysis</h2>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#38bdf8', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📁 Choose File</button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                <button onClick={() => {
                  // Create a second input for camera capture
                  const camInput = document.createElement('input')
                  camInput.type = 'file'
                  camInput.accept = 'image/*'
                  camInput.capture = 'environment'
                  camInput.onchange = (ev: any) => {
                    const file = ev.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => { setUploadedImage(reader.result as string); setUploadResult(''); setUploadAnalyzing(false) }
                    reader.readAsDataURL(file)
                  }
                  camInput.click()
                }} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>📸 Take Photo</button>
              </div>
              {uploadedImage && (
                <div>
                  <img src={uploadedImage} alt="Upload" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 8, background: '#000', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <select value={prompt} onChange={e => setPrompt(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', fontSize: 13 }}>
                      <option value="Describe what you see in this image in detail.">General</option>
                      <option value="Analyze this clinical screening image. Identify any abnormalities relevant to pediatric health screening.">Clinical</option>
                      <option value="Examine this dental image. Look for caries, gingivitis, malocclusion, enamel defects.">Dental</option>
                      <option value="Analyze this skin image. Look for rashes, lesions, infections, or dermatological conditions.">Skin</option>
                      <option value="Analyze for motor skills: posture, balance, coordination, and any signs of delays.">Motor</option>
                    </select>
                    <button onClick={analyzeUpload} disabled={modelStatus !== 'ready' || uploadAnalyzing}
                      style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: modelStatus === 'ready' && !uploadAnalyzing ? '#22c55e' : '#334155', color: modelStatus === 'ready' ? '#000' : '#64748b', fontWeight: 700, fontSize: 13, cursor: modelStatus === 'ready' ? 'pointer' : 'default' }}>
                      {uploadAnalyzing ? 'Analyzing...' : '🧠 Analyze'}
                    </button>
                    <button onClick={() => { setUploadedImage(null); setUploadResult('') }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Clear</button>
                  </div>
                  {uploadResult && (
                    <div style={{ padding: 16, borderRadius: 8, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <strong style={{ fontSize: 13, color: '#4ade80' }}>🧠 AI Analysis</strong>
                      <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.6, color: '#cbd5e1', fontFamily: 'inherit' }}>{uploadResult}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Privacy badge */}
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#475569', fontSize: 11 }}>
          <p style={{ margin: '2px 0' }}>🔒 100% on-device &bull; Zero data leaves your browser &bull; No cloud dependency</p>
          <p style={{ margin: '2px 0' }}><strong>SKIDS Screen</strong> &bull; Powered by Liquid AI LFM2.5-VL-1.6B &bull; ONNX Runtime WebGPU</p>
        </div>
      </main>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
    </div>
  )
}
