
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { ScreeningProps } from './types'
import { extractFacePosition, computeNeuroResults } from '@/lib/ai/neurodevelopment'
import { Icons } from '@/components/icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { getUserMediaWithFallback } from '@/lib/camera-utils'
import { MCHAT_ITEMS, scoreMChat, mchatToFeatures, type MChatAnswer, type MChatResult } from '@/lib/ai/mchat-scoring'
import { MediaPipeOverlay, type MediaPipeMetrics } from './mediapipe-overlay'

interface StimulusTask {
  name: string
  instruction: string
  duration: number
  stimulusType: 'split_video' | 'attention_video' | 'manual'
}

// ── Image-based engagement level cards ─────────────────────────────────
// Observer taps the card that best describes the child's response.
// More granular than binary Responded/No Response.
const ENGAGEMENT_CARDS = [
  { id: 'full',    emoji: '\u{1F31F}', label: 'Full Response',  desc: 'Actively engaged',  level: 3, bg: 'bg-green-50',  border: 'border-green-400',  ring: 'ring-green-400' },
  { id: 'partial', emoji: '\u{1F440}', label: 'Partial',        desc: 'Briefly noticed',    level: 2, bg: 'bg-yellow-50', border: 'border-yellow-400', ring: 'ring-yellow-400' },
  { id: 'minimal', emoji: '\u{1F610}', label: 'Minimal',        desc: 'Barely reacted',     level: 1, bg: 'bg-orange-50', border: 'border-orange-400', ring: 'ring-orange-400' },
  { id: 'none',    emoji: '\u{274C}',  label: 'No Response',    desc: 'Didn\'t react',      level: 0, bg: 'bg-red-50',    border: 'border-red-400',    ring: 'ring-red-400' },
] as const

export function NeuroScreening({ step, setStep, onComplete, instructions, childName }: ScreeningProps) {
  const [currentTask, setCurrentTask] = useState(0)
  const [taskStartTime, setTaskStartTime] = useState(0)
  const [responseTimes, setResponseTimes] = useState<number[]>([])
  const [taskCompletions, setTaskCompletions] = useState<boolean[]>([])
  const [gazeFrames, setGazeFrames] = useState<Array<{ faceX: number; faceY: number; time: number }>>([])
  const [isTracking, setIsTracking] = useState(false)
  const [trackingProgress, setTrackingProgress] = useState(0)
  // M-CHAT state
  const [showMChat, setShowMChat] = useState(false)
  const [mchatAnswers, setMchatAnswers] = useState<MChatAnswer[]>([])
  const [mchatResult, setMchatResult] = useState<MChatResult | null>(null)
  const [mchatCurrentItem, setMchatCurrentItem] = useState(0)
  const [engagementLevels, setEngagementLevels] = useState<number[]>([])
  const [selectedEngagement, setSelectedEngagement] = useState<string | null>(null)
  const [neuroMetrics, setNeuroMetrics] = useState<MediaPipeMetrics | null>(null)
  // Stimulus video URLs (from org config or defaults)
  const [stimulusUrls] = useState<{ social?: string; geometric?: string; attention?: string }>({})
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stimulusLeftRef = useRef<HTMLVideoElement>(null)
  const stimulusRightRef = useRef<HTMLVideoElement>(null)
  const stimulusAttentionRef = useRef<HTMLVideoElement>(null)
  const trackingRef = useRef(false)

  const tasks: StimulusTask[] = [
    {
      name: 'Visual Preference Test',
      instruction: stimulusUrls.social
        ? 'Show the split screen to the child — camera tracks their gaze preference'
        : 'Show the screen to the child and observe their reaction (stimulus videos not configured)',
      duration: stimulusUrls.social ? 30000 : 8000,
      stimulusType: stimulusUrls.social ? 'split_video' : 'manual',
    },
    {
      name: 'Name Response',
      instruction: 'Call the child\'s name and note if they respond',
      duration: 6000,
      stimulusType: 'manual',
    },
    {
      name: 'Sustained Attention',
      instruction: stimulusUrls.attention
        ? 'Show the animation — note how long the child watches'
        : 'Show an interesting image/toy and observe sustained attention (stimulus video not configured)',
      duration: stimulusUrls.attention ? 20000 : 10000,
      stimulusType: stimulusUrls.attention ? 'attention_video' : 'manual',
    },
  ]

  const startCamera = async () => {
    try {
      const stream = await getUserMediaWithFallback('user', { width: 640, height: 480, exact: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch {
      // Continue without camera - manual observation mode
    }
  }

  const trackGaze = useCallback(() => {
    if (!trackingRef.current || !videoRef.current || !canvasRef.current) return

    const result = extractFacePosition(videoRef.current, canvasRef.current)
    if (result) {
      setGazeFrames(prev => [...prev, {
        faceX: result.faceX,
        faceY: result.faceY,
        time: Date.now()
      }])
    }

    if (trackingRef.current) {
      requestAnimationFrame(trackGaze)
    }
  }, [])

  const startTask = () => {
    setTaskStartTime(Date.now())
    setIsTracking(true)
    trackingRef.current = true
    setTrackingProgress(0)
    requestAnimationFrame(trackGaze)

    const taskDuration = tasks[currentTask].duration
    const progressInterval = setInterval(() => {
      setTrackingProgress(prev => {
        const next = prev + (100 / (taskDuration / 200))
        if (next >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return next
      })
    }, 200)

    // Auto-complete tracking after task duration
    setTimeout(() => {
      trackingRef.current = false
      setIsTracking(false)
      clearInterval(progressInterval)
      setTrackingProgress(100)
    }, taskDuration)
  }

  const markResponse = (level: number) => {
    const responseTime = Date.now() - taskStartTime
    setResponseTimes(prev => [...prev, responseTime])
    setTaskCompletions(prev => [...prev, level >= 2]) // Full/Partial = responded
    setEngagementLevels(prev => [...prev, level])
    setSelectedEngagement(ENGAGEMENT_CARDS.find(c => c.level === level)?.id || null)
  }

  const completeTask = () => {
    trackingRef.current = false
    setIsTracking(false)

    // If no response was explicitly marked, assume partial completion
    if (taskCompletions.length <= currentTask) {
      setTaskCompletions(prev => [...prev, true])
      setResponseTimes(prev => [...prev, Date.now() - (taskStartTime || Date.now())])
    }

    if (currentTask < tasks.length - 1) {
      setCurrentTask(prev => prev + 1)
      setTrackingProgress(0)
      setSelectedEngagement(null)
    } else {
      // Stop camera
      const stream = videoRef.current?.srcObject as MediaStream
      stream?.getTracks().forEach(track => track.stop())

      // Show M-CHAT questionnaire option
      setShowMChat(true)
    }
  }

  const finishScreening = (mchat?: MChatResult) => {
    const results = computeNeuroResults(responseTimes, gazeFrames, taskCompletions)

    // Compute stimulus preference from gaze data (left = social, right = geometric)
    // Only meaningful if split-screen video was shown
    let stimulusPreference: 'social' | 'geometric' | 'neutral' = 'neutral'
    if (tasks[0].stimulusType === 'split_video' && gazeFrames.length > 10) {
      const leftGaze = gazeFrames.filter(f => f.faceX < 0.5).length
      const rightGaze = gazeFrames.filter(f => f.faceX >= 0.5).length
      const total = leftGaze + rightGaze
      if (total > 0) {
        const socialRatio = leftGaze / total
        if (socialRatio > 0.6) stimulusPreference = 'social'
        else if (socialRatio < 0.4) stimulusPreference = 'geometric'
      }
    }

    // Merge M-CHAT features if available
    const mchatFeatures = mchat ? mchatToFeatures(mchat) : {}

    // If M-CHAT indicates higher risk, escalate
    let riskCategory = results.riskCategory
    if (mchat && mchat.risk === 'high') riskCategory = 'high_risk'
    else if (mchat && mchat.risk === 'medium' && riskCategory === 'no_risk') riskCategory = 'possible_risk'
    // Geometric preference is also a risk indicator
    if (stimulusPreference === 'geometric' && riskCategory === 'no_risk') riskCategory = 'possible_risk'

    onComplete({
      engagement: results.engagement,
      gazeScore: results.gazeScore,
      responseTime: results.responseTime,
      attentionSpan: results.attentionSpan,
      stimulusPreference,
      confidence: results.confidence,
      riskCategory,
      qualityFlags: gazeFrames.length > 50 ? ['good_tracking'] : ['limited_tracking'],
      stimulusVideoConfigured: !!stimulusUrls.social,
      engagementLevels,
      ...mchatFeatures,
      mediapipeMetrics: neuroMetrics ? {
        eyeContactPercent: neuroMetrics.face?.eyeContactDuration?.contactPercentage,
        eyeContact: neuroMetrics.face?.eyeContact,
        mouthOpen: neuroMetrics.face?.mouthOpen,
        handFlapping: neuroMetrics.hand?.flapping,
        balance: neuroMetrics.pose?.balance,
        gaitSymmetry: neuroMetrics.pose?.gaitSymmetry,
      } : undefined,
    })
  }

  const answerMChat = (itemId: number, response: boolean) => {
    setMchatAnswers(prev => {
      const updated = prev.filter(a => a.itemId !== itemId)
      return [...updated, { itemId, response }]
    })
  }

  const completeMChat = () => {
    const result = scoreMChat(mchatAnswers)
    setMchatResult(result)
    finishScreening(result)
  }

  useEffect(() => {
    if (step === 1) startCamera()
    return () => { trackingRef.current = false }
  }, [step])

  if (step === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Developmental Screening</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Icons.Info className="w-4 h-4" />
            <AlertDescription className="text-sm">
              This screening has {tasks.length} short activities + an optional M-CHAT questionnaire. The camera tracks {childName}&apos;s face position and response patterns.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            {tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">{task.name}</span>
                  <p className="text-xs text-gray-500">{task.instruction}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
              <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-sm">
                +
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">M-CHAT-R/F Questionnaire</span>
                <p className="text-xs text-gray-500">20-item validated ASD screening (optional, ages 16–30 months)</p>
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={() => setStep(1)}>
            Begin Activities
          </Button>
        </CardContent>
      </Card>
    )
  }

  // M-CHAT Questionnaire UI
  if (showMChat && !mchatResult) {
    const currentItem = MCHAT_ITEMS[mchatCurrentItem]
    const answered = mchatAnswers.find(a => a.itemId === currentItem.id)

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Icons.Brain className="w-5 h-5 text-violet-600" />
            M-CHAT-R/F Questionnaire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <Progress value={(mchatAnswers.length / MCHAT_ITEMS.length) * 100} className="h-2 flex-1" />
            <span className="text-xs text-gray-500">{mchatAnswers.length}/{MCHAT_ITEMS.length}</span>
          </div>

          {/* Current item */}
          <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px] bg-white">
                Q{currentItem.id}
              </Badge>
              {currentItem.critical && (
                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                  Critical
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-500">
                {currentItem.domain}
              </Badge>
            </div>
            <p className="text-sm text-gray-800 mb-4">{currentItem.text}</p>
            <div className="flex gap-3">
              <Button
                className={`flex-1 ${answered?.response === true ? 'bg-green-600 hover:bg-green-700' : ''}`}
                variant={answered?.response === true ? 'default' : 'outline'}
                onClick={() => answerMChat(currentItem.id, true)}
              >
                Yes
              </Button>
              <Button
                className={`flex-1 ${answered?.response === false ? 'bg-red-600 hover:bg-red-700' : ''}`}
                variant={answered?.response === false ? 'default' : 'outline'}
                onClick={() => answerMChat(currentItem.id, false)}
              >
                No
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={mchatCurrentItem === 0}
              onClick={() => setMchatCurrentItem(prev => prev - 1)}
            >
              Previous
            </Button>
            <div className="flex-1" />
            {mchatCurrentItem < MCHAT_ITEMS.length - 1 ? (
              <Button
                size="sm"
                disabled={!answered}
                onClick={() => setMchatCurrentItem(prev => prev + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={mchatAnswers.length < MCHAT_ITEMS.length}
                onClick={completeMChat}
              >
                Score & Complete
              </Button>
            )}
          </div>

          {/* Skip option */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-gray-400"
            onClick={() => finishScreening()}
          >
            Skip M-CHAT (complete without questionnaire)
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show M-CHAT completion option after behavioral tasks
  if (showMChat && mchatResult) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>M-CHAT Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`p-3 rounded-lg text-center ${
            mchatResult.risk === 'low' ? 'bg-green-50 text-green-700' :
            mchatResult.risk === 'medium' ? 'bg-yellow-50 text-yellow-700' :
            'bg-red-50 text-red-700'
          }`}>
            <p className="text-lg font-bold">Score: {mchatResult.totalScore}/20</p>
            <p className="text-sm">{mchatResult.risk.toUpperCase()} RISK</p>
          </div>
          <p className="text-xs text-gray-600">{mchatResult.recommendation}</p>
          <p className="text-xs text-gray-500 text-center">Results saved with observation</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{tasks[currentTask].name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stimulus area — shows video content or manual instructions */}
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
          {tasks[currentTask].stimulusType === 'split_video' && stimulusUrls.social && stimulusUrls.geometric ? (
            /* Split-screen: social (left) vs geometric (right) — GeoPref paradigm */
            <div className="flex w-full h-full">
              <video
                ref={stimulusLeftRef}
                src={stimulusUrls.social}
                autoPlay
                loop
                muted
                playsInline
                className="w-1/2 h-full object-cover"
              />
              <video
                ref={stimulusRightRef}
                src={stimulusUrls.geometric}
                autoPlay
                loop
                muted
                playsInline
                className="w-1/2 h-full object-cover"
              />
            </div>
          ) : tasks[currentTask].stimulusType === 'attention_video' && stimulusUrls.attention ? (
            /* Single attention-grabbing animation */
            <video
              ref={stimulusAttentionRef}
              src={stimulusUrls.attention}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            /* Fallback: manual mode with gradient + instructions */
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-center p-4">
              <div>
                <Icons.Brain className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm">{tasks[currentTask].instruction}</p>
                {!stimulusUrls.social && tasks[currentTask].stimulusType !== 'manual' && (
                  <p className="text-xs mt-2 text-purple-200 italic">
                    Admin: configure stimulus videos in Settings → AI → Push Config
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Front camera overlay (small PiP in corner) for gaze tracking */}
          {videoRef.current?.srcObject && (
            <div className="absolute bottom-2 right-2 w-20 h-20 rounded-lg overflow-hidden border-2 border-white/50 shadow-lg">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          )}
          {/* Hidden front camera if not showing PiP */}
          {!videoRef.current?.srcObject && (
            <video ref={videoRef} autoPlay playsInline muted className="hidden" />
          )}

          {isTracking && (
            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full">
              Tracking: {gazeFrames.length} frames
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          {videoRef.current?.srcObject && (
            <MediaPipeOverlay
              videoRef={videoRef as React.RefObject<HTMLVideoElement>}
              tasks={['face', 'pose', 'hand']}
              onMetrics={setNeuroMetrics}
            />
          )}
        </div>

        {isTracking && (
          <Progress value={trackingProgress} className="h-2" />
        )}

        <div className="flex gap-2">
          {tasks.map((_, i) => (
            <div key={i} className={`flex-1 h-2 rounded-full ${i <= currentTask ? 'bg-purple-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="flex gap-2">
          {!isTracking && trackingProgress === 0 && (
            <Button variant="outline" className="flex-1" onClick={startTask}>
              <Icons.Play className="w-4 h-4 mr-2" />
              Start Activity
            </Button>
          )}

          {isTracking && (
            <div className="space-y-2 flex-1">
              <p className="text-xs text-gray-500 text-center font-medium">
                How did {childName} respond?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {ENGAGEMENT_CARDS.map(card => {
                  const isSelected = selectedEngagement === card.id
                  return (
                    <button
                      key={card.id}
                      onClick={() => markResponse(card.level)}
                      disabled={!!selectedEngagement}
                      className={`
                        rounded-xl border-2 p-2 transition-all duration-150
                        active:scale-95 disabled:opacity-60
                        ${card.bg} ${card.border}
                        ${isSelected ? `ring-3 ${card.ring} scale-95` : 'hover:scale-[1.02] shadow-sm'}
                      `}
                    >
                      <div className="text-2xl mb-0.5 select-none">{card.emoji}</div>
                      <p className="text-[10px] font-bold select-none leading-tight">{card.label}</p>
                      <p className="text-[8px] text-gray-500 select-none leading-tight">{card.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!isTracking && trackingProgress > 0 && (
            <Button className="flex-1" onClick={completeTask}>
              {currentTask < tasks.length - 1 ? 'Next Activity' : 'Complete'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default NeuroScreening
