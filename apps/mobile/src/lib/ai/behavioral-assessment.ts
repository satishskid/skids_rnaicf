/**
 * Behavioral Assessment — structured autism/neurodevelopmental observation protocol.
 *
 * Complements M-CHAT-R/F questionnaire with video-based behavioral observations.
 *
 * Protocol tasks:
 *   1. Social smile — show funny stimulus, measure smile latency
 *   2. Response to name — call child's name, measure head turn latency
 *   3. Joint attention — point at object, measure gaze following
 *   4. Eye contact — examiner talks, measure gaze-at-face duration
 *   5. Repetitive behavior — free observation, detect movement patterns
 *   6. Emotional response — show emotion cards, measure expression mirroring
 *   7. Gaze preference — split-screen social/geometric stimulus, measure gaze ratio
 *
 * Gaze Preference Task (Pierce et al. 2011, 2016):
 *   Displays a split-screen video: social scene (children playing) on one side,
 *   geometric patterns (spinning shapes, fractals) on the other.
 *   ML Kit Face Landmarker tracks (x,y) gaze coordinates to compute the
 *   Geometric Preference Ratio (GPR). GPR > 0.69 correlates with ASD risk
 *   with >90% specificity in toddlers 14-42 months.
 *
 * References:
 *   - Pierce K et al. (2011) "Preference for geometric patterns early in life"
 *     Arch Gen Psychiatry 68(1):101-109
 *   - Pierce K et al. (2016) "Eye tracking reveals abnormal visual preference
 *     for geometric images as an early biomarker" Biol Psychiatry 79(8):657-666
 *   - Wen TH et al. (2022) "Large scale validation of an early-age eye-tracking
 *     biomarker" Sci Rep 12(1):4253
 *
 * Each produces a score that combines with M-CHAT for composite risk.
 */

import type { GazeFrame, NeuroScreeningResult } from './neurodevelopment'
import type { MChatResult, MChatRisk } from './mchat-scoring'

// ── Task Definitions ──

export interface BehavioralTask {
  id: string
  name: string
  description: string
  instructions: string[]
  durationSeconds: number
  minAgeMonths: number
  maxAgeMonths?: number
  metrics: string[]
}

export const BEHAVIORAL_TASKS: BehavioralTask[] = [
  {
    id: 'social_smile',
    name: 'Social Smile',
    description: 'Present a funny stimulus and observe smile response',
    instructions: [
      'Show the child a funny animation or make a silly face',
      'Watch for spontaneous smile or laugh',
      'Note the time from stimulus to smile',
      'Record whether the child looks at your face while smiling',
    ],
    durationSeconds: 15,
    minAgeMonths: 12,
    metrics: ['smileLatency', 'smileDuration', 'socialReference'],
  },
  {
    id: 'response_to_name',
    name: 'Response to Name',
    description: 'Call child\'s name and measure head turn',
    instructions: [
      'Ensure child is not looking at you',
      'Call the child\'s name in a clear voice',
      'Wait 3 seconds for a response',
      'Try up to 3 times if no response',
      'Record: head turn, eye contact, time to respond',
    ],
    durationSeconds: 10,
    minAgeMonths: 12,
    metrics: ['headTurnLatency', 'eyeContactAfterName', 'triesNeeded'],
  },
  {
    id: 'joint_attention',
    name: 'Joint Attention',
    description: 'Point at object and check if child follows gaze',
    instructions: [
      'Place an interesting toy to one side',
      'Point at the toy and say "Look!"',
      'Watch if the child follows your point and looks at the object',
      'Note: does child look at the object, then back at you?',
    ],
    durationSeconds: 15,
    minAgeMonths: 12,
    metrics: ['gazeFollowing', 'referentialLooking', 'latency'],
  },
  {
    id: 'eye_contact',
    name: 'Eye Contact Duration',
    description: 'Examiner talks to child, measure sustained eye contact',
    instructions: [
      'Talk to the child in a friendly manner for 30 seconds',
      'Note how often and how long the child maintains eye contact',
      'Record: total eye contact time, longest single gaze',
    ],
    durationSeconds: 30,
    minAgeMonths: 12,
    metrics: ['eyeContactDuration', 'longestGaze', 'gazeShifts'],
  },
  {
    id: 'repetitive_behavior',
    name: 'Repetitive Behavior Check',
    description: 'Observe child during free play for repetitive movements',
    instructions: [
      'Let child play freely for 1 minute',
      'Observe for: hand flapping, spinning, rocking, lining up objects',
      'Note frequency and duration of any repetitive movements',
      'Record if child gets distressed when interrupted',
    ],
    durationSeconds: 60,
    minAgeMonths: 18,
    metrics: ['repetitiveMovements', 'stereotypies', 'rigidity'],
  },
  {
    id: 'emotional_response',
    name: 'Emotional Response',
    description: 'Show emotion cards and observe facial expression mirroring',
    instructions: [
      'Show pictures of happy, sad, and surprised faces',
      'Ask "How does this person feel?"',
      'Watch if child mirrors or recognizes the emotion',
      'Note: verbal labels, facial mirroring, empathic response',
    ],
    durationSeconds: 30,
    minAgeMonths: 24,
    metrics: ['emotionRecognition', 'facialMirroring', 'verbalLabeling'],
  },
  {
    id: 'gaze_preference',
    name: 'Gaze Preference (Social vs. Geometric)',
    description: 'Split-screen stimulus video: social scene vs. geometric patterns — automated gaze tracking measures preference ratio as ASD biomarker',
    instructions: [
      'Seat child 40-60cm from device screen',
      'Tap "Start Stimulus" to play the 60-second split-screen video',
      'LEFT side: children playing / social interaction scenes',
      'RIGHT side: spinning geometric shapes / dynamic abstract patterns',
      'Hold device steady — front camera tracks the child\'s gaze direction',
      'Ensure good lighting on child\'s face (avoid backlight)',
      'Do not direct the child\'s attention — let them look freely',
      'The app will automatically calculate the Geometric Preference Ratio',
    ],
    durationSeconds: 60,
    minAgeMonths: 14,
    maxAgeMonths: 42,
    metrics: ['geometricPreferenceRatio', 'socialGazeTime', 'geometricGazeTime', 'transitionCount'],
  },
]

/** Get tasks appropriate for age. */
export function getTasksForAge(ageMonths: number): BehavioralTask[] {
  return BEHAVIORAL_TASKS.filter(
    t => ageMonths >= t.minAgeMonths && (!t.maxAgeMonths || ageMonths <= t.maxAgeMonths)
  )
}

// ── Task Scoring ──

export interface TaskObservation {
  taskId: string
  completed: boolean
  // Timing
  latencyMs?: number            // time to first response
  durationMs?: number           // how long behavior lasted
  // Categorical
  responseType?: 'immediate' | 'delayed' | 'partial' | 'none'
  // Gaze data (from camera)
  gazeFrames?: GazeFrame[]
  // Nurse observation
  nurseNotes?: string
  // Scores (0-1)
  scores: Record<string, number>
}

export interface BehavioralTaskScore {
  taskId: string
  score: number           // 0-1, higher = more typical behavior
  concern: boolean        // true if score suggests atypical behavior
  details: string
  confidence: number
}

/**
 * Score a social smile observation.
 */
export function scoreSocialSmile(obs: TaskObservation): BehavioralTaskScore {
  if (!obs.completed) {
    return { taskId: 'social_smile', score: 0.5, concern: false, details: 'Not completed', confidence: 0.1 }
  }

  const latency = obs.latencyMs ?? 5000
  const gazeFrames = obs.gazeFrames || []
  const smileDetected = gazeFrames.some(f => f.smiling)
  const socialReference = gazeFrames.filter(f => f.smiling && f.eyeContact).length > 0

  let score = 0
  if (smileDetected && latency < 2000) score = 1.0     // Quick, spontaneous smile
  else if (smileDetected && latency < 4000) score = 0.7 // Delayed smile
  else if (smileDetected) score = 0.5                    // Very delayed
  else score = 0.2                                        // No smile

  if (socialReference) score = Math.min(1, score + 0.15) // Bonus for looking at examiner while smiling

  return {
    taskId: 'social_smile',
    score,
    concern: score < 0.5,
    details: smileDetected
      ? `Smile detected at ${latency}ms${socialReference ? ' with social reference' : ''}`
      : 'No smile response observed',
    confidence: gazeFrames.length > 5 ? 0.75 : 0.4,
  }
}

/**
 * Score response to name.
 */
export function scoreResponseToName(obs: TaskObservation): BehavioralTaskScore {
  if (!obs.completed) {
    return { taskId: 'response_to_name', score: 0.5, concern: false, details: 'Not completed', confidence: 0.1 }
  }

  const latency = obs.latencyMs ?? 5000
  const responseType = obs.responseType ?? 'none'
  const triesNeeded = obs.scores['triesNeeded'] ?? 3

  let score = 0
  switch (responseType) {
    case 'immediate': score = triesNeeded === 1 ? 1.0 : 0.85; break
    case 'delayed': score = 0.6; break
    case 'partial': score = 0.4; break
    case 'none': score = 0.1; break
  }

  // Adjust for number of tries
  if (triesNeeded > 2) score *= 0.7

  return {
    taskId: 'response_to_name',
    score,
    concern: score < 0.5,
    details: responseType === 'none'
      ? 'No response to name (3 attempts)'
      : `${responseType} response at ${latency}ms (${triesNeeded} attempt${triesNeeded > 1 ? 's' : ''})`,
    confidence: 0.7,
  }
}

/**
 * Score joint attention task.
 */
export function scoreJointAttention(obs: TaskObservation): BehavioralTaskScore {
  if (!obs.completed) {
    return { taskId: 'joint_attention', score: 0.5, concern: false, details: 'Not completed', confidence: 0.1 }
  }

  const gazeFollowing = obs.scores['gazeFollowing'] ?? 0
  const referentialLooking = obs.scores['referentialLooking'] ?? 0

  // Full joint attention: child follows point AND looks back at examiner
  let score = gazeFollowing * 0.6 + referentialLooking * 0.4

  return {
    taskId: 'joint_attention',
    score,
    concern: score < 0.5,
    details: gazeFollowing > 0.5
      ? `Child followed point${referentialLooking > 0.5 ? ' and showed referential looking' : ''}`
      : 'Child did not follow pointing gesture',
    confidence: 0.65,
  }
}

/**
 * Score eye contact duration task.
 */
export function scoreEyeContact(obs: TaskObservation): BehavioralTaskScore {
  if (!obs.completed) {
    return { taskId: 'eye_contact', score: 0.5, concern: false, details: 'Not completed', confidence: 0.1 }
  }

  const gazeFrames = obs.gazeFrames || []
  const eyeContactFrames = gazeFrames.filter(f => f.eyeContact)
  const ratio = gazeFrames.length > 0 ? eyeContactFrames.length / gazeFrames.length : 0

  // Find longest continuous eye contact
  let longestStreak = 0
  let currentStreak = 0
  for (const frame of gazeFrames) {
    if (frame.eyeContact) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }
  const longestGazeSeconds = longestStreak / 10 // ~10fps

  // Score: typical children maintain >40% eye contact
  let score = Math.min(1, ratio * 2) // 50% contact = 1.0

  return {
    taskId: 'eye_contact',
    score,
    concern: ratio < 0.2,
    details: `Eye contact: ${(ratio * 100).toFixed(0)}% of time, longest: ${longestGazeSeconds.toFixed(1)}s`,
    confidence: gazeFrames.length > 30 ? 0.8 : 0.4,
  }
}

/**
 * Score repetitive behavior observation.
 */
export function scoreRepetitiveBehavior(obs: TaskObservation): BehavioralTaskScore {
  if (!obs.completed) {
    return { taskId: 'repetitive_behavior', score: 0.5, concern: false, details: 'Not completed', confidence: 0.1 }
  }

  const repetitiveMovements = obs.scores['repetitiveMovements'] ?? 0
  const stereotypies = obs.scores['stereotypies'] ?? 0
  const rigidity = obs.scores['rigidity'] ?? 0

  // Higher score = more typical (LESS repetitive behavior)
  const score = Math.max(0, 1 - (repetitiveMovements * 0.4 + stereotypies * 0.35 + rigidity * 0.25))

  return {
    taskId: 'repetitive_behavior',
    score,
    concern: score < 0.5,
    details: score > 0.7
      ? 'No significant repetitive behaviors observed'
      : `Repetitive behaviors noted: movement=${(repetitiveMovements * 100).toFixed(0)}%, stereotypies=${(stereotypies * 100).toFixed(0)}%`,
    confidence: 0.6,
  }
}

/**
 * Score emotional response task.
 */
export function scoreEmotionalResponse(obs: TaskObservation): BehavioralTaskScore {
  if (!obs.completed) {
    return { taskId: 'emotional_response', score: 0.5, concern: false, details: 'Not completed', confidence: 0.1 }
  }

  const emotionRecognition = obs.scores['emotionRecognition'] ?? 0
  const facialMirroring = obs.scores['facialMirroring'] ?? 0
  const verbalLabeling = obs.scores['verbalLabeling'] ?? 0

  const score = emotionRecognition * 0.35 + facialMirroring * 0.35 + verbalLabeling * 0.3

  return {
    taskId: 'emotional_response',
    score,
    concern: score < 0.4,
    details: score > 0.6
      ? 'Appropriate emotional recognition and response'
      : `Limited emotional response: recognition=${(emotionRecognition * 100).toFixed(0)}%, mirroring=${(facialMirroring * 100).toFixed(0)}%`,
    confidence: 0.55,
  }
}

// ── Gaze Preference Scoring (Pierce et al. 2011) ──

/**
 * Gaze Preference Result — computed from front-camera gaze tracking during
 * the split-screen social/geometric stimulus video.
 */
export interface GazePreferenceResult {
  geometricPreferenceRatio: number  // 0-1, fraction of total looking time on geometric side
  socialGazeTimeMs: number          // total time looking at social side
  geometricGazeTimeMs: number       // total time looking at geometric side
  awayGazeTimeMs: number            // time looking away from screen
  transitionCount: number           // number of gaze shifts between sides
  totalFrames: number               // total gaze frames recorded
  validFrames: number               // frames with confident face detection
  riskCategory: 'typical' | 'monitor' | 'elevated'
}

/**
 * Compute Geometric Preference Ratio from gaze tracking frames.
 *
 * Algorithm (Pierce et al. 2011, 2016):
 *   1. For each frame, classify gaze direction as 'left' (social), 'right' (geometric), or 'away'
 *      using normalized face X position from ML Kit Face Landmarker
 *   2. GPR = geometric_time / (social_time + geometric_time)
 *   3. Risk thresholds (Pierce 2016, validated in Wen 2022):
 *      - GPR < 0.30 → Typical (strong social preference)
 *      - GPR 0.30-0.69 → Monitor (mixed preference)
 *      - GPR ≥ 0.69 → Elevated ASD risk (geometric preference)
 *
 * Note: Social side is displayed on LEFT, geometric on RIGHT.
 * faceX < 0.4 means child is looking left (at social), faceX > 0.6 means right (geometric).
 *
 * @param gazeFrames - Array of gaze tracking frames from ML Kit during 60s stimulus
 * @param stimulusDurationMs - Total stimulus duration (default 60000ms)
 */
export function computeGazePreference(
  gazeFrames: GazeFrame[],
  stimulusDurationMs: number = 60000,
): GazePreferenceResult {
  let socialFrames = 0
  let geometricFrames = 0
  let awayFrames = 0
  let transitions = 0
  let lastSide: 'social' | 'geometric' | 'away' = 'away'

  const validFrames = gazeFrames.filter(f => f.faceX >= 0 && f.faceX <= 1)

  for (const frame of validFrames) {
    let currentSide: 'social' | 'geometric' | 'away'

    if (frame.gazeDirection === 'away' || frame.faceX < 0 || frame.faceX > 1) {
      currentSide = 'away'
      awayFrames++
    } else if (frame.faceX < 0.4) {
      // Looking left → social side
      currentSide = 'social'
      socialFrames++
    } else if (frame.faceX > 0.6) {
      // Looking right → geometric side
      currentSide = 'geometric'
      geometricFrames++
    } else {
      // Center gaze — ambiguous, split equally
      currentSide = 'away'
      awayFrames++
    }

    if (currentSide !== 'away' && lastSide !== 'away' && currentSide !== lastSide) {
      transitions++
    }
    if (currentSide !== 'away') {
      lastSide = currentSide
    }
  }

  // Estimate time from frame counts (assume ~10 FPS from ML Kit processing)
  const estimatedFPS = validFrames.length > 0
    ? validFrames.length / (stimulusDurationMs / 1000)
    : 10
  const msPerFrame = 1000 / Math.max(1, estimatedFPS)

  const socialGazeTimeMs = Math.round(socialFrames * msPerFrame)
  const geometricGazeTimeMs = Math.round(geometricFrames * msPerFrame)
  const awayGazeTimeMs = Math.round(awayFrames * msPerFrame)

  const totalLookingFrames = socialFrames + geometricFrames
  const geometricPreferenceRatio = totalLookingFrames > 0
    ? geometricFrames / totalLookingFrames
    : 0.5 // No valid data → neutral

  // Risk classification (Pierce 2016 thresholds, validated Wen 2022)
  let riskCategory: GazePreferenceResult['riskCategory'] = 'typical'
  if (geometricPreferenceRatio >= 0.69) {
    riskCategory = 'elevated'
  } else if (geometricPreferenceRatio >= 0.30) {
    riskCategory = 'monitor'
  }

  return {
    geometricPreferenceRatio: Math.round(geometricPreferenceRatio * 1000) / 1000,
    socialGazeTimeMs,
    geometricGazeTimeMs,
    awayGazeTimeMs,
    transitionCount: transitions,
    totalFrames: gazeFrames.length,
    validFrames: validFrames.length,
    riskCategory,
  }
}

/**
 * Score gaze preference task observation.
 *
 * Uses Geometric Preference Ratio as primary biomarker.
 * Score is inverted: higher score = more typical (social preference).
 */
export function scoreGazePreference(obs: TaskObservation): BehavioralTaskScore {
  if (!obs.completed) {
    return { taskId: 'gaze_preference', score: 0.5, concern: false, details: 'Not completed', confidence: 0.1 }
  }

  const gazeFrames = obs.gazeFrames || []

  // Need minimum frames for reliable measurement (at least 20s of data at 10fps)
  if (gazeFrames.length < 200) {
    return {
      taskId: 'gaze_preference',
      score: 0.5,
      concern: false,
      details: `Insufficient gaze data (${gazeFrames.length} frames, need ≥200)`,
      confidence: 0.15,
    }
  }

  const result = computeGazePreference(gazeFrames)

  // Convert GPR to behavioral score (inverted: social preference = high score)
  const score = Math.max(0, 1 - result.geometricPreferenceRatio)

  // Confidence based on valid frame ratio and away-time
  const validRatio = result.validFrames / Math.max(1, result.totalFrames)
  const lookingRatio = (result.socialGazeTimeMs + result.geometricGazeTimeMs) /
    Math.max(1, result.socialGazeTimeMs + result.geometricGazeTimeMs + result.awayGazeTimeMs)
  const confidence = Math.min(0.9, validRatio * 0.5 + lookingRatio * 0.4)

  const gprPercent = (result.geometricPreferenceRatio * 100).toFixed(1)

  let details: string
  if (result.riskCategory === 'elevated') {
    details = `Geometric preference ratio: ${gprPercent}% (≥69% = elevated ASD risk). ` +
      `Social: ${(result.socialGazeTimeMs / 1000).toFixed(1)}s, Geometric: ${(result.geometricGazeTimeMs / 1000).toFixed(1)}s, ` +
      `${result.transitionCount} gaze shifts`
  } else if (result.riskCategory === 'monitor') {
    details = `Geometric preference ratio: ${gprPercent}% (mixed preference, monitor). ` +
      `${result.transitionCount} gaze shifts between stimuli`
  } else {
    details = `Geometric preference ratio: ${gprPercent}% (typical social preference). ` +
      `Strong social engagement observed`
  }

  return {
    taskId: 'gaze_preference',
    score,
    concern: result.riskCategory === 'elevated',
    details,
    confidence,
  }
}

// ── Score a task by ID ──

export function scoreBehavioralTask(obs: TaskObservation): BehavioralTaskScore {
  switch (obs.taskId) {
    case 'social_smile': return scoreSocialSmile(obs)
    case 'response_to_name': return scoreResponseToName(obs)
    case 'joint_attention': return scoreJointAttention(obs)
    case 'eye_contact': return scoreEyeContact(obs)
    case 'repetitive_behavior': return scoreRepetitiveBehavior(obs)
    case 'emotional_response': return scoreEmotionalResponse(obs)
    case 'gaze_preference': return scoreGazePreference(obs)
    default: return { taskId: obs.taskId, score: 0.5, concern: false, details: 'Unknown task', confidence: 0.1 }
  }
}

// ── Composite Assessment ──

export interface BehavioralAssessmentResult {
  taskScores: BehavioralTaskScore[]
  compositeScore: number         // 0-1, behavioral observation composite
  mchatRisk?: MChatRisk          // from M-CHAT-R/F questionnaire
  combinedRisk: 'low' | 'medium' | 'high'
  socialCommunicationScore: number   // 0-1
  restrictedBehaviorScore: number    // 0-1
  findings: string[]
  recommendations: string[]
}

/**
 * Generate composite behavioral assessment.
 * Combines behavioral observation scores with optional M-CHAT result.
 */
export function generateBehavioralAssessment(
  taskScores: BehavioralTaskScore[],
  ageMonths: number,
  mchatResult?: MChatResult,
): BehavioralAssessmentResult {
  if (taskScores.length === 0) {
    return {
      taskScores: [],
      compositeScore: 0.5,
      combinedRisk: 'low',
      socialCommunicationScore: 0.5,
      restrictedBehaviorScore: 0.5,
      findings: ['No behavioral tasks completed'],
      recommendations: ['Complete behavioral observation protocol'],
    }
  }

  // Domain scores
  const socialTasks = ['social_smile', 'response_to_name', 'joint_attention', 'eye_contact', 'gaze_preference']
  const restrictedTasks = ['repetitive_behavior']

  const socialScores = taskScores.filter(s => socialTasks.includes(s.taskId))
  const restrictedScores = taskScores.filter(s => restrictedTasks.includes(s.taskId))

  const socialCommunicationScore = socialScores.length > 0
    ? socialScores.reduce((s, t) => s + t.score * t.confidence, 0) /
      socialScores.reduce((s, t) => s + t.confidence, 0)
    : 0.5

  const restrictedBehaviorScore = restrictedScores.length > 0
    ? restrictedScores.reduce((s, t) => s + t.score * t.confidence, 0) /
      restrictedScores.reduce((s, t) => s + t.confidence, 0)
    : 0.5

  // Composite: social communication weighted more heavily
  const compositeScore = socialCommunicationScore * 0.7 + restrictedBehaviorScore * 0.3

  // Combine with M-CHAT if available
  const mchatRisk = mchatResult?.risk
  let combinedRisk: BehavioralAssessmentResult['combinedRisk'] = 'low'

  // Gaze preference is a strong independent biomarker — elevated GPR alone warrants referral
  const gazeScore = taskScores.find(s => s.taskId === 'gaze_preference')
  const gazeElevated = gazeScore?.concern === true && gazeScore.confidence > 0.5

  if (mchatRisk === 'high' || compositeScore < 0.35 || gazeElevated) {
    combinedRisk = 'high'
  } else if (mchatRisk === 'medium' || compositeScore < 0.55) {
    combinedRisk = 'medium'
  } else {
    combinedRisk = 'low'
  }

  // If M-CHAT and behavioral disagree, flag it
  const findings: string[] = []
  const recommendations: string[] = []

  const concernTasks = taskScores.filter(s => s.concern)
  for (const task of concernTasks) {
    findings.push(task.details)
  }

  // Gaze preference specific findings
  if (gazeElevated) {
    findings.push('Geometric visual preference detected (Pierce et al. biomarker)')
    recommendations.push('Elevated geometric preference ratio — refer for comprehensive ASD evaluation')
  }

  if (combinedRisk === 'high') {
    findings.push('Multiple indicators suggest developmental concern')
    recommendations.push('Urgent referral for comprehensive developmental evaluation')
    recommendations.push('Consider ADOS-2 or Bayley assessment')
  } else if (combinedRisk === 'medium') {
    findings.push('Some behavioral indicators warrant monitoring')
    recommendations.push('Follow-up screening in 3-6 months')
    recommendations.push('Encourage social interaction and play')
    if (mchatRisk === 'medium') {
      recommendations.push('Complete M-CHAT Follow-Up Interview')
    }
  } else {
    if (taskScores.every(s => s.score > 0.7)) {
      findings.push('Age-appropriate social communication and behavior')
    }
  }

  // Age-specific notes
  if (ageMonths < 24 && combinedRisk !== 'low') {
    recommendations.push('Note: Children under 2 may have variable presentation \u2014 re-screen at 24 months')
  }

  return {
    taskScores,
    compositeScore,
    mchatRisk,
    combinedRisk,
    socialCommunicationScore,
    restrictedBehaviorScore,
    findings,
    recommendations,
  }
}
