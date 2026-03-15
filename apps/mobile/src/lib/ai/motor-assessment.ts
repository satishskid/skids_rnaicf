/**
 * Motor Assessment — pose-based motor skill evaluation.
 *
 * Enhanced from basic position tracking to use 17-keypoint pose estimation.
 * Analyzes video of child performing structured motor tasks.
 *
 * Pipeline:
 *   1. Extract pose frames from video
 *   2. Score each motor task (walk, stand, hop, finger-nose, tandem)
 *   3. Generate composite motor assessment with risk category
 *
 * Backward-compatible: still exports analyzeMotorPerformance for legacy callers.
 */

import { estimatePose } from './pose-estimation'
import type { PoseFrame, PoseSequence } from './pose-estimation'
import { centerOfMass, dtwDistance } from './pose-estimation'
import {
  scoreWalkingTask,
  scoreOneLegStand,
  scoreHoppingTask,
  scoreFingerNose,
  generateMotorAssessment,
  getTasksForAge,
} from './motor-tasks'
import type { TaskScore, MotorAssessmentResult } from './motor-tasks'

// ── Legacy-Compatible Types ──

export interface MotorAnalysisResult {
  stability: number    // 0-1, 1 = very stable
  symmetry: number     // 0-1
  avgSpeed: number     // pixels/sec
  tremor: number       // 0-1, higher = more tremor
  // Enhanced fields
  compositeScore?: number
  riskCategory?: MotorAssessmentResult['riskCategory']
  taskScores?: TaskScore[]
  findings?: string[]
  recommendations?: string[]
}

// ── Legacy API (backward-compatible) ──

/**
 * Analyze motor performance from position tracking data.
 * Legacy API — kept for backward compatibility with ModuleScreen.
 */
export function analyzeMotorPerformance(
  positions: Array<{ x: number; y: number; time: number }>
): MotorAnalysisResult {
  if (positions.length < 10) {
    return { stability: 0.5, symmetry: 0.5, avgSpeed: 0, tremor: 0 }
  }

  // Compute speeds
  const speeds: number[] = []
  for (let i = 1; i < positions.length; i++) {
    const dx = positions[i].x - positions[i - 1].x
    const dy = positions[i].y - positions[i - 1].y
    const dt = (positions[i].time - positions[i - 1].time) / 1000
    if (dt > 0) speeds.push(Math.sqrt(dx * dx + dy * dy) / dt)
  }

  if (speeds.length === 0) {
    return { stability: 0.5, symmetry: 0.5, avgSpeed: 0, tremor: 0 }
  }

  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length
  const speedVariance = speeds.reduce((a, b) => a + (b - avgSpeed) ** 2, 0) / speeds.length
  const stability = Math.max(0, 1 - speedVariance / 10000)

  // Tremor: velocity direction reversals
  let tremorCount = 0
  for (let i = 2; i < speeds.length; i++) {
    if (Math.sign(speeds[i] - speeds[i - 1]) !== Math.sign(speeds[i - 1] - speeds[i - 2])) {
      tremorCount++
    }
  }
  const tremor = tremorCount / speeds.length

  // Left-right symmetry from x positions
  const midX = positions.reduce((s, p) => s + p.x, 0) / positions.length
  const leftPositions = positions.filter(p => p.x < midX)
  const rightPositions = positions.filter(p => p.x >= midX)
  const symmetry = leftPositions.length > 0 && rightPositions.length > 0
    ? 1 - Math.abs(leftPositions.length - rightPositions.length) / positions.length
    : 0.5

  return { stability, symmetry: Math.max(0, Math.min(1, symmetry)), avgSpeed, tremor }
}

// ── Enhanced Pose-Based API ──

/**
 * Process video frames into a pose sequence.
 * Call this with pixel data from each video frame.
 */
export async function processVideoFrames(
  frames: Array<{ pixels: Uint8Array; width: number; height: number; timestamp: number }>
): Promise<PoseSequence> {
  const poseFrames: PoseFrame[] = []

  for (const frame of frames) {
    const pose = await estimatePose(frame.pixels, frame.width, frame.height, frame.timestamp)
    poseFrames.push(pose)
  }

  const duration = frames.length > 1
    ? (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000
    : 0
  const fps = duration > 0 ? frames.length / duration : 30

  return { frames: poseFrames, fps, duration }
}

/**
 * Run a specific motor task scoring on a pose sequence.
 */
export function scoreMotorTask(taskId: string, sequence: PoseSequence): TaskScore {
  switch (taskId) {
    case 'walk_forward':
      return scoreWalkingTask(sequence)
    case 'one_leg_stand':
      return scoreOneLegStand(sequence)
    case 'hop_one_foot':
      return scoreHoppingTask(sequence)
    case 'finger_nose':
      return scoreFingerNose(sequence)
    default:
      // Generic scoring for unknown tasks
      return scoreGenericTask(taskId, sequence)
  }
}

/**
 * Generic motor task scoring — used when no specific scorer exists.
 */
function scoreGenericTask(taskId: string, sequence: PoseSequence): TaskScore {
  const { frames } = sequence
  if (frames.length < 5) {
    return {
      taskId, symmetry: 0.5, stability: 0.5, smoothness: 0.5,
      rhythm: 0.5, completion: 0, overall: 0.5, confidence: 0.1,
      details: 'Insufficient frames',
    }
  }

  // Center of mass stability
  const comPoints = frames.map(f => centerOfMass(f)).filter(Boolean) as Array<{ x: number; y: number }>

  let stability = 0.5
  if (comPoints.length >= 3) {
    const avgX = comPoints.reduce((s, p) => s + p.x, 0) / comPoints.length
    const avgY = comPoints.reduce((s, p) => s + p.y, 0) / comPoints.length
    const variance = comPoints.reduce((s, p) =>
      s + (p.x - avgX) ** 2 + (p.y - avgY) ** 2, 0
    ) / comPoints.length
    stability = Math.max(0, 1 - variance * 100)
  }

  const confidence = Math.min(0.6, frames.length / 60)

  return {
    taskId,
    symmetry: 0.5,
    stability,
    smoothness: 0.5,
    rhythm: 0.5,
    completion: frames.length >= 15 ? 1 : frames.length / 15,
    overall: stability * 0.6 + 0.4 * (frames.length >= 15 ? 1 : frames.length / 15),
    confidence,
    details: `Generic scoring: ${frames.length} frames analyzed`,
  }
}

/**
 * Run full motor assessment from video.
 * This is the main entry point for the enhanced motor assessment.
 */
export async function runMotorAssessment(
  videoFrames: Array<{ pixels: Uint8Array; width: number; height: number; timestamp: number }>,
  taskId: string,
  ageMonths: number,
): Promise<{
  poseSequence: PoseSequence
  taskScore: TaskScore
  assessment: MotorAssessmentResult
}> {
  // Process frames into pose sequence
  const poseSequence = await processVideoFrames(videoFrames)

  // Score the specific task
  const taskScore = scoreMotorTask(taskId, poseSequence)

  // Generate assessment (single task for now, accumulate across tasks in ModuleScreen)
  const assessment = generateMotorAssessment([taskScore], ageMonths)

  return { poseSequence, taskScore, assessment }
}

// Re-export types and utilities for consumers
export type { PoseFrame, PoseSequence, TaskScore, MotorAssessmentResult }
export { getTasksForAge, generateMotorAssessment }
