/**
 * Motor Assessment Tasks — structured motor skill evaluation protocol.
 *
 * Defines age-appropriate tasks with scoring criteria:
 *   - Walk forward: gait symmetry, arm swing
 *   - Stand on one leg: balance, sway
 *   - Hop on one foot: coordination, rhythm
 *   - Finger-to-nose: fine motor, tremor
 *   - Tandem walk: balance, coordination
 *   - Catch/throw: hand-eye coordination
 *
 * Each task produces normalized scores (0-1) that feed into the composite motor score.
 */

import type { PoseFrame, PoseSequence, KeypointName } from './pose-estimation'
import { getKeypoint, keypointDistance, centerOfMass, dtwDistance } from './pose-estimation'

// ── Task Definitions ──

export interface MotorTask {
  id: string
  name: string
  description: string
  instructions: string[]   // step-by-step for nurse
  minAgeMonths: number
  durationSeconds: number
  captureType: 'video'
  metrics: string[]        // which scores this task produces
}

export const MOTOR_TASKS: MotorTask[] = [
  {
    id: 'walk_forward',
    name: 'Walk Forward',
    description: 'Child walks 5 steps toward the camera',
    instructions: [
      'Position camera at child\'s chest height, 3 meters away',
      'Ask child to walk normally toward the camera',
      'Record for 10 seconds',
      'Watch for: limping, arm swing, toe/heel pattern',
    ],
    minAgeMonths: 36, // 3 years
    durationSeconds: 10,
    captureType: 'video',
    metrics: ['gaitSymmetry', 'armSwing', 'stepRegularity'],
  },
  {
    id: 'one_leg_stand',
    name: 'Stand on One Leg',
    description: 'Child stands on one leg for as long as possible',
    instructions: [
      'Ask child to stand on their preferred leg',
      'Arms can be out for balance',
      'Time how long they maintain balance',
      'Record both legs separately if possible',
    ],
    minAgeMonths: 48, // 4 years
    durationSeconds: 15,
    captureType: 'video',
    metrics: ['balance', 'sway', 'duration'],
  },
  {
    id: 'hop_one_foot',
    name: 'Hop on One Foot',
    description: 'Child hops in place on one foot 5 times',
    instructions: [
      'Demonstrate hopping first',
      'Ask child to hop on preferred foot',
      'Count 5 hops',
      'Watch for: rhythm, height, balance on landing',
    ],
    minAgeMonths: 60, // 5 years
    durationSeconds: 10,
    captureType: 'video',
    metrics: ['rhythm', 'hopHeight', 'landingStability'],
  },
  {
    id: 'finger_nose',
    name: 'Finger to Nose',
    description: 'Child touches nose then extends arm, 3 times',
    instructions: [
      'Ask child to touch their nose with index finger',
      'Then extend arm fully to the side',
      'Repeat 3 times',
      'Watch for: overshoot, tremor, accuracy',
    ],
    minAgeMonths: 48,
    durationSeconds: 10,
    captureType: 'video',
    metrics: ['accuracy', 'tremor', 'smoothness'],
  },
  {
    id: 'tandem_walk',
    name: 'Tandem Walk',
    description: 'Child walks heel-to-toe in a straight line',
    instructions: [
      'Place a line of tape on the floor',
      'Ask child to walk heel-to-toe along the line',
      'Record from the side',
      'Watch for: stepping off line, wobbling, arm use',
    ],
    minAgeMonths: 60,
    durationSeconds: 10,
    captureType: 'video',
    metrics: ['balance', 'lineDeviation', 'stepAccuracy'],
  },
]

/** Get tasks appropriate for a given age. */
export function getTasksForAge(ageMonths: number): MotorTask[] {
  return MOTOR_TASKS.filter(t => ageMonths >= t.minAgeMonths)
}

// ── Task Scoring ──

export interface TaskScore {
  taskId: string
  symmetry: number       // 0-1: left-right symmetry
  stability: number      // 0-1: center of mass steadiness
  smoothness: number     // 0-1: movement jerk metric (lower jerk = smoother = higher score)
  rhythm: number         // 0-1: regularity of repeated movements
  completion: number     // 0-1: did child perform expected pattern
  overall: number        // weighted composite
  confidence: number     // how reliable this assessment is
  details: string        // human-readable summary
}

export interface MotorAssessmentResult {
  taskScores: TaskScore[]
  compositeScore: number       // 0-1 overall motor competency
  riskCategory: 'age_appropriate' | 'mild_delay' | 'moderate_delay' | 'significant_delay'
  findings: string[]           // clinical findings
  recommendations: string[]   // follow-up suggestions
}

// ── Scoring Algorithms ──

/**
 * Score gait (walking) task from pose sequence.
 * Analyzes: symmetry of left/right leg movements, arm swing, step regularity.
 */
export function scoreWalkingTask(sequence: PoseSequence): TaskScore {
  const { frames } = sequence
  if (frames.length < 10) {
    return emptyScore('walk_forward', 'Insufficient frames for gait analysis')
  }

  // Extract ankle Y trajectories for left and right
  const leftAnkleY = frames.map(f => getKeypoint(f, 'left_ankle')?.y ?? 0.5)
  const rightAnkleY = frames.map(f => getKeypoint(f, 'right_ankle')?.y ?? 0.5)

  // Gait symmetry: DTW distance between left and right ankle patterns
  const dtwDist = dtwDistance(leftAnkleY, rightAnkleY)
  const symmetry = Math.max(0, 1 - dtwDist * 5)

  // Arm swing: check wrist movement amplitude
  const leftWristY = frames.map(f => getKeypoint(f, 'left_wrist')?.y ?? 0.5)
  const rightWristY = frames.map(f => getKeypoint(f, 'right_wrist')?.y ?? 0.5)
  const leftArmRange = Math.max(...leftWristY) - Math.min(...leftWristY)
  const rightArmRange = Math.max(...rightWristY) - Math.min(...rightWristY)
  const armSwingScore = Math.min(1, (leftArmRange + rightArmRange) * 5)

  // Step regularity: autocorrelation of ankle Y
  const stepRegularity = computeAutocorrelation(leftAnkleY)

  // Center of mass stability
  const comTrajectory = frames.map(f => centerOfMass(f)).filter(Boolean)
  const stability = computeStability(comTrajectory as Array<{ x: number; y: number }>)

  // Smoothness (jerk)
  const smoothness = computeSmoothness(leftAnkleY)

  const overall = symmetry * 0.3 + stability * 0.2 + armSwingScore * 0.15 + stepRegularity * 0.2 + smoothness * 0.15

  return {
    taskId: 'walk_forward',
    symmetry,
    stability,
    smoothness,
    rhythm: stepRegularity,
    completion: frames.length >= 20 ? 1 : frames.length / 20,
    overall,
    confidence: Math.min(0.85, frames.length / 60),
    details: `Gait symmetry: ${(symmetry * 100).toFixed(0)}%, Arm swing: ${(armSwingScore * 100).toFixed(0)}%, Step regularity: ${(stepRegularity * 100).toFixed(0)}%`,
  }
}

/**
 * Score one-leg stand task from pose sequence.
 * Analyzes: balance duration, sway amplitude, recovery movements.
 */
export function scoreOneLegStand(sequence: PoseSequence): TaskScore {
  const { frames } = sequence
  if (frames.length < 10) {
    return emptyScore('one_leg_stand', 'Insufficient frames')
  }

  // Track center of mass sway
  const comPoints = frames.map(f => centerOfMass(f)).filter(Boolean) as Array<{ x: number; y: number }>
  const stability = computeStability(comPoints)

  // Check if one ankle stays elevated
  const leftAnkleY = frames.map(f => getKeypoint(f, 'left_ankle')?.y ?? 0.5)
  const rightAnkleY = frames.map(f => getKeypoint(f, 'right_ankle')?.y ?? 0.5)

  // One foot should be consistently higher than the other
  const avgDiff = leftAnkleY.reduce((s, ly, i) => s + Math.abs(ly - rightAnkleY[i]), 0) / frames.length
  const oneFootRaised = Math.min(1, avgDiff * 10)

  // Duration: count frames where pose is maintained
  const balanceFrames = frames.filter(f => {
    const com = centerOfMass(f)
    return com !== null
  }).length
  const duration = balanceFrames / sequence.fps

  // Smoothness of sway (less jerk = better balance)
  const comX = comPoints.map(p => p.x)
  const smoothness = computeSmoothness(comX)

  const overall = stability * 0.35 + oneFootRaised * 0.25 + smoothness * 0.2 + Math.min(1, duration / 10) * 0.2

  return {
    taskId: 'one_leg_stand',
    symmetry: 0.5, // N/A for this task
    stability,
    smoothness,
    rhythm: 0.5, // N/A
    completion: oneFootRaised,
    overall,
    confidence: Math.min(0.8, frames.length / 45),
    details: `Balance duration: ${duration.toFixed(1)}s, Stability: ${(stability * 100).toFixed(0)}%, Sway: ${((1 - smoothness) * 100).toFixed(0)}%`,
  }
}

/**
 * Score hopping task from pose sequence.
 * Analyzes: hop rhythm, height consistency, landing stability.
 */
export function scoreHoppingTask(sequence: PoseSequence): TaskScore {
  const { frames } = sequence
  if (frames.length < 10) {
    return emptyScore('hop_one_foot', 'Insufficient frames')
  }

  // Track ankle Y to detect hops (peaks in Y trajectory = feet leaving ground)
  const ankleY = frames.map(f => {
    const la = getKeypoint(f, 'left_ankle')?.y ?? 0.5
    const ra = getKeypoint(f, 'right_ankle')?.y ?? 0.5
    return Math.min(la, ra) // whichever foot is higher
  })

  // Rhythm: autocorrelation of ankle Y
  const rhythm = computeAutocorrelation(ankleY)

  // Count hops (local minima in Y = feet at highest point)
  let hopCount = 0
  for (let i = 1; i < ankleY.length - 1; i++) {
    if (ankleY[i] < ankleY[i - 1] && ankleY[i] < ankleY[i + 1]) {
      hopCount++
    }
  }
  const completion = Math.min(1, hopCount / 5) // target: 5 hops

  // Stability between hops
  const comPoints = frames.map(f => centerOfMass(f)).filter(Boolean) as Array<{ x: number; y: number }>
  const stability = computeStability(comPoints)

  const smoothness = computeSmoothness(ankleY)

  const overall = rhythm * 0.3 + completion * 0.25 + stability * 0.25 + smoothness * 0.2

  return {
    taskId: 'hop_one_foot',
    symmetry: 0.5,
    stability,
    smoothness,
    rhythm,
    completion,
    overall,
    confidence: Math.min(0.75, frames.length / 30),
    details: `Hops detected: ${hopCount}, Rhythm: ${(rhythm * 100).toFixed(0)}%, Stability: ${(stability * 100).toFixed(0)}%`,
  }
}

/**
 * Score finger-to-nose task.
 * Analyzes: accuracy, tremor, movement smoothness.
 */
export function scoreFingerNose(sequence: PoseSequence): TaskScore {
  const { frames } = sequence
  if (frames.length < 10) {
    return emptyScore('finger_nose', 'Insufficient frames')
  }

  // Track wrist-to-nose distance over time
  const wristNoseDist = frames.map(f => {
    const nose = getKeypoint(f, 'nose')
    const wrist = getKeypoint(f, 'right_wrist') ?? getKeypoint(f, 'left_wrist')
    if (!nose || !wrist) return 0.5
    return keypointDistance(nose, wrist)
  })

  // Accuracy: how close wrist gets to nose (minimum distance)
  const minDist = Math.min(...wristNoseDist)
  const accuracy = Math.max(0, 1 - minDist * 10) // closer = better

  // Tremor: high-frequency oscillations in wrist position
  const wristX = frames.map(f => getKeypoint(f, 'right_wrist')?.x ?? getKeypoint(f, 'left_wrist')?.x ?? 0.5)
  let tremor = 0
  for (let i = 2; i < wristX.length; i++) {
    const d1 = wristX[i] - wristX[i - 1]
    const d2 = wristX[i - 1] - wristX[i - 2]
    if (Math.sign(d1) !== Math.sign(d2)) tremor++
  }
  const tremorScore = Math.max(0, 1 - tremor / frames.length)

  // Smoothness
  const smoothness = computeSmoothness(wristNoseDist)

  // Count completed touch-extend cycles
  let cycles = 0
  let wasClose = false
  for (const d of wristNoseDist) {
    if (d < 0.1 && !wasClose) { wasClose = true; cycles++ }
    if (d > 0.2) wasClose = false
  }
  const completion = Math.min(1, cycles / 3)

  const overall = accuracy * 0.3 + tremorScore * 0.25 + smoothness * 0.25 + completion * 0.2

  return {
    taskId: 'finger_nose',
    symmetry: 0.5,
    stability: tremorScore,
    smoothness,
    rhythm: 0.5,
    completion,
    overall,
    confidence: Math.min(0.7, frames.length / 30),
    details: `Accuracy: ${(accuracy * 100).toFixed(0)}%, Tremor: ${((1 - tremorScore) * 100).toFixed(0)}%, Cycles: ${cycles}/3`,
  }
}

// ── Helper Functions ──

function emptyScore(taskId: string, reason: string): TaskScore {
  return {
    taskId, symmetry: 0.5, stability: 0.5, smoothness: 0.5,
    rhythm: 0.5, completion: 0, overall: 0.5, confidence: 0.1,
    details: reason,
  }
}

/** Compute stability from a trajectory of points (lower variance = more stable). */
function computeStability(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0.5

  const avgX = points.reduce((s, p) => s + p.x, 0) / points.length
  const avgY = points.reduce((s, p) => s + p.y, 0) / points.length

  const variance = points.reduce((s, p) =>
    s + (p.x - avgX) ** 2 + (p.y - avgY) ** 2, 0
  ) / points.length

  return Math.max(0, 1 - variance * 100) // normalize
}

/** Compute smoothness via jerk metric (third derivative). Lower jerk = smoother. */
function computeSmoothness(signal: number[]): number {
  if (signal.length < 4) return 0.5

  // Compute third derivative (jerk)
  let totalJerk = 0
  for (let i = 3; i < signal.length; i++) {
    const jerk = signal[i] - 3 * signal[i - 1] + 3 * signal[i - 2] - signal[i - 3]
    totalJerk += jerk * jerk
  }

  const avgJerk = totalJerk / (signal.length - 3)
  return Math.max(0, 1 - avgJerk * 1000)
}

/** Compute normalized autocorrelation for rhythm detection. */
function computeAutocorrelation(signal: number[]): number {
  if (signal.length < 10) return 0.5

  const mean = signal.reduce((s, v) => s + v, 0) / signal.length
  const centered = signal.map(v => v - mean)

  let maxCorr = 0
  const minLag = 3
  const maxLag = Math.min(Math.floor(signal.length / 2), 30)

  // Variance for normalization
  const variance = centered.reduce((s, v) => s + v * v, 0)
  if (variance < 0.0001) return 0.5

  for (let lag = minLag; lag < maxLag; lag++) {
    let correlation = 0
    for (let i = 0; i < signal.length - lag; i++) {
      correlation += centered[i] * centered[i + lag]
    }
    const normalized = correlation / variance
    if (normalized > maxCorr) maxCorr = normalized
  }

  return Math.max(0, Math.min(1, maxCorr))
}

// ── Composite Assessment ──

/**
 * Generate composite motor assessment from multiple task scores.
 */
export function generateMotorAssessment(
  taskScores: TaskScore[],
  ageMonths: number
): MotorAssessmentResult {
  if (taskScores.length === 0) {
    return {
      taskScores: [],
      compositeScore: 0.5,
      riskCategory: 'age_appropriate',
      findings: ['No motor tasks completed'],
      recommendations: ['Complete at least 2 motor tasks for assessment'],
    }
  }

  // Weighted composite: higher-confidence scores count more
  let weightedSum = 0
  let totalWeight = 0
  for (const score of taskScores) {
    const weight = score.confidence
    weightedSum += score.overall * weight
    totalWeight += weight
  }
  const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5

  // Risk classification
  let riskCategory: MotorAssessmentResult['riskCategory']
  if (compositeScore >= 0.8) riskCategory = 'age_appropriate'
  else if (compositeScore >= 0.6) riskCategory = 'mild_delay'
  else if (compositeScore >= 0.4) riskCategory = 'moderate_delay'
  else riskCategory = 'significant_delay'

  // Generate findings
  const findings: string[] = []
  for (const score of taskScores) {
    if (score.symmetry < 0.6) findings.push(`Asymmetric movement in ${score.taskId}`)
    if (score.stability < 0.5) findings.push(`Poor stability during ${score.taskId}`)
    if (score.smoothness < 0.4) findings.push(`Jerky/uncoordinated movement in ${score.taskId}`)
    if (score.rhythm < 0.4 && score.taskId !== 'one_leg_stand') findings.push(`Irregular rhythm in ${score.taskId}`)
  }

  // Recommendations
  const recommendations: string[] = []
  if (riskCategory === 'significant_delay') {
    recommendations.push('Urgent referral to pediatric neurologist recommended')
    recommendations.push('Consider developmental assessment (PDMS-2 or Bayley)')
  } else if (riskCategory === 'moderate_delay') {
    recommendations.push('Referral to pediatric physiotherapist')
    recommendations.push('Re-assess in 3 months')
  } else if (riskCategory === 'mild_delay') {
    recommendations.push('Monitor and re-assess in 6 months')
    recommendations.push('Encourage active play and gross motor activities')
  }

  // Age-specific adjustments
  if (ageMonths < 48 && compositeScore < 0.7) {
    recommendations.push('Note: Younger children (3-4y) may have lower scores \u2014 interpret with caution')
  }

  return { taskScores, compositeScore, riskCategory, findings, recommendations }
}
