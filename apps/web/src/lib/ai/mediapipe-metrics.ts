// client-side only

/**
 * mediapipe-metrics.ts — Clinical metric computations from MediaPipe landmarks
 *
 * All angle computations use normalized landmark coordinates (0..1).
 * Pose landmark indices follow the MediaPipe 33-point model:
 *   https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */

import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

// ---------------------------------------------------------------------------
// Landmark index constants (MediaPipe Pose 33-point model)
// ---------------------------------------------------------------------------
const POSE = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const

// Face landmark indices for key features (478-point mesh)
const FACE = {
  // Iris centers
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473,
  // Eye corners
  LEFT_EYE_INNER: 133,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,
  // Lips
  UPPER_LIP_TOP: 13,
  LOWER_LIP_BOTTOM: 14,
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  // Nose tip
  NOSE_TIP: 1,
} as const

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function angleBetweenPoints(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) }
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) }
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2)
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2)
  if (magBA === 0 || magBC === 0) return 0
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)))
  return (Math.acos(cosAngle) * 180) / Math.PI
}

function distance2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function midpoint(a: NormalizedLandmark, b: NormalizedLandmark): NormalizedLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z ?? 0) + (b.z ?? 0)) / 2,
    visibility: Math.min(a.visibility ?? 0, b.visibility ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Gait Symmetry
// ---------------------------------------------------------------------------
export interface GaitSymmetryResult {
  /** 0 = perfect symmetry, 1 = maximum asymmetry */
  asymmetryIndex: number
  leftKneeAngle: number
  rightKneeAngle: number
  leftHipAngle: number
  rightHipAngle: number
}

/**
 * Compare left/right leg joint angles across multiple frames.
 * Computes average asymmetry index (0 = symmetric, 1 = maximally asymmetric).
 */
export function computeGaitSymmetry(
  poseLandmarksFrames: NormalizedLandmark[][]
): GaitSymmetryResult {
  if (poseLandmarksFrames.length === 0) {
    return { asymmetryIndex: 0, leftKneeAngle: 0, rightKneeAngle: 0, leftHipAngle: 0, rightHipAngle: 0 }
  }

  let totalAsymmetry = 0
  let sumLKnee = 0, sumRKnee = 0, sumLHip = 0, sumRHip = 0

  for (const lm of poseLandmarksFrames) {
    if (lm.length < 33) continue

    const lKnee = angleBetweenPoints(lm[POSE.LEFT_HIP], lm[POSE.LEFT_KNEE], lm[POSE.LEFT_ANKLE])
    const rKnee = angleBetweenPoints(lm[POSE.RIGHT_HIP], lm[POSE.RIGHT_KNEE], lm[POSE.RIGHT_ANKLE])
    const lHip = angleBetweenPoints(lm[POSE.LEFT_SHOULDER], lm[POSE.LEFT_HIP], lm[POSE.LEFT_KNEE])
    const rHip = angleBetweenPoints(lm[POSE.RIGHT_SHOULDER], lm[POSE.RIGHT_HIP], lm[POSE.RIGHT_KNEE])

    const kneeAsym = Math.abs(lKnee - rKnee) / 180
    const hipAsym = Math.abs(lHip - rHip) / 180
    totalAsymmetry += (kneeAsym + hipAsym) / 2

    sumLKnee += lKnee
    sumRKnee += rKnee
    sumLHip += lHip
    sumRHip += rHip
  }

  const n = poseLandmarksFrames.length
  return {
    asymmetryIndex: Math.min(1, totalAsymmetry / n),
    leftKneeAngle: sumLKnee / n,
    rightKneeAngle: sumRKnee / n,
    leftHipAngle: sumLHip / n,
    rightHipAngle: sumRHip / n,
  }
}

// ---------------------------------------------------------------------------
// Balance (hip midpoint stability)
// ---------------------------------------------------------------------------
export interface BalanceResult {
  /** Standard deviation of hip midpoint position (lower = more stable) */
  stabilityScore: number
  /** Normalized 0..1 where 1 = perfectly stable */
  balanceIndex: number
  swayPathLength: number
}

/**
 * Measure hip midpoint stability over time. Smaller sway = better balance.
 */
export function computeBalance(
  poseLandmarksFrames: NormalizedLandmark[][]
): BalanceResult {
  if (poseLandmarksFrames.length < 2) {
    return { stabilityScore: 0, balanceIndex: 1, swayPathLength: 0 }
  }

  const hipMidpoints: NormalizedLandmark[] = []
  for (const lm of poseLandmarksFrames) {
    if (lm.length < 33) continue
    hipMidpoints.push(midpoint(lm[POSE.LEFT_HIP], lm[POSE.RIGHT_HIP]))
  }

  if (hipMidpoints.length < 2) {
    return { stabilityScore: 0, balanceIndex: 1, swayPathLength: 0 }
  }

  // Mean position
  const meanX = hipMidpoints.reduce((s, p) => s + p.x, 0) / hipMidpoints.length
  const meanY = hipMidpoints.reduce((s, p) => s + p.y, 0) / hipMidpoints.length

  // Standard deviation (sway)
  const variance =
    hipMidpoints.reduce((s, p) => s + (p.x - meanX) ** 2 + (p.y - meanY) ** 2, 0) /
    hipMidpoints.length
  const stdDev = Math.sqrt(variance)

  // Path length (total sway distance)
  let pathLength = 0
  for (let i = 1; i < hipMidpoints.length; i++) {
    pathLength += distance2D(hipMidpoints[i - 1], hipMidpoints[i])
  }

  // Map stdDev to a 0..1 balance index (0.05 threshold = very unstable)
  const balanceIndex = Math.max(0, Math.min(1, 1 - stdDev / 0.05))

  return { stabilityScore: stdDev, balanceIndex, swayPathLength: pathLength }
}

// ---------------------------------------------------------------------------
// Shoulder Level
// ---------------------------------------------------------------------------
export interface ShoulderLevelResult {
  /** Height difference in normalized coordinates (positive = left higher) */
  heightDifference: number
  /** Angle of shoulder line from horizontal in degrees */
  tiltAngleDeg: number
  /** true if tilt exceeds clinical threshold (> 2 degrees) */
  isAsymmetric: boolean
}

/**
 * Measure shoulder height asymmetry for postural screening.
 */
export function computeShoulderLevel(
  poseLandmarks: NormalizedLandmark[]
): ShoulderLevelResult {
  if (poseLandmarks.length < 33) {
    return { heightDifference: 0, tiltAngleDeg: 0, isAsymmetric: false }
  }

  const ls = poseLandmarks[POSE.LEFT_SHOULDER]
  const rs = poseLandmarks[POSE.RIGHT_SHOULDER]

  // In normalized coords, y increases downward, so lower y = higher position
  const heightDiff = rs.y - ls.y // positive = left is higher
  const dx = rs.x - ls.x
  const dy = rs.y - ls.y
  const tiltAngle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI)
  // Deviation from perfectly horizontal (0 degrees)
  const tiltFromHorizontal = Math.abs(tiltAngle)

  return {
    heightDifference: heightDiff,
    tiltAngleDeg: tiltFromHorizontal,
    isAsymmetric: tiltFromHorizontal > 2,
  }
}

// ---------------------------------------------------------------------------
// Spine Alignment (scoliosis screening)
// ---------------------------------------------------------------------------
export interface SpineAlignmentResult {
  /** Cobb-like angle in degrees (deviation of spine from vertical) */
  deviationAngleDeg: number
  /** Lateral offset of midpoint spine from shoulder-hip midline */
  lateralOffset: number
  /** Clinical flag */
  possibleScoliosis: boolean
}

/**
 * Estimate spinal alignment from shoulder and hip landmarks.
 * Uses the lateral deviation of the nose from the shoulder-hip midline.
 */
export function computeSpineAlignment(
  poseLandmarks: NormalizedLandmark[]
): SpineAlignmentResult {
  if (poseLandmarks.length < 33) {
    return { deviationAngleDeg: 0, lateralOffset: 0, possibleScoliosis: false }
  }

  const shoulderMid = midpoint(
    poseLandmarks[POSE.LEFT_SHOULDER],
    poseLandmarks[POSE.RIGHT_SHOULDER]
  )
  const hipMid = midpoint(
    poseLandmarks[POSE.LEFT_HIP],
    poseLandmarks[POSE.RIGHT_HIP]
  )
  const nose = poseLandmarks[POSE.NOSE]

  // Spine midline vector (hip to shoulder)
  const spineX = shoulderMid.x - hipMid.x
  const spineY = shoulderMid.y - hipMid.y
  const spineLen = Math.sqrt(spineX ** 2 + spineY ** 2)
  if (spineLen === 0) {
    return { deviationAngleDeg: 0, lateralOffset: 0, possibleScoliosis: false }
  }

  // Lateral offset of nose from spine midline
  const noseToHipX = nose.x - hipMid.x
  const noseToHipY = nose.y - hipMid.y
  // Cross product gives signed perpendicular distance
  const crossProduct = (spineX * noseToHipY - spineY * noseToHipX) / spineLen
  const lateralOffset = Math.abs(crossProduct)

  // Convert to approximate angle
  const deviationAngle = (Math.atan2(lateralOffset, spineLen) * 180) / Math.PI

  return {
    deviationAngleDeg: deviationAngle,
    lateralOffset,
    possibleScoliosis: deviationAngle > 7, // Clinical threshold ~7 degrees
  }
}

// ---------------------------------------------------------------------------
// Knee Angle (valgum/varum)
// ---------------------------------------------------------------------------
export interface KneeAngleResult {
  /** Angle at the knee joint in degrees (180 = fully extended) */
  angleDeg: number
  /** Clinical classification */
  classification: 'normal' | 'valgum' | 'varum'
}

/**
 * Measure knee joint angle for valgum (knock-knee) / varum (bow-leg) screening.
 */
export function computeKneeAngle(
  poseLandmarks: NormalizedLandmark[],
  side: 'left' | 'right'
): KneeAngleResult {
  if (poseLandmarks.length < 33) {
    return { angleDeg: 180, classification: 'normal' }
  }

  const hip = side === 'left' ? poseLandmarks[POSE.LEFT_HIP] : poseLandmarks[POSE.RIGHT_HIP]
  const knee = side === 'left' ? poseLandmarks[POSE.LEFT_KNEE] : poseLandmarks[POSE.RIGHT_KNEE]
  const ankle = side === 'left' ? poseLandmarks[POSE.LEFT_ANKLE] : poseLandmarks[POSE.RIGHT_ANKLE]

  const angle = angleBetweenPoints(hip, knee, ankle)

  // Frontal plane analysis: check if knee deviates medially or laterally
  // In frontal view, compare knee x to hip-ankle midline x
  const midX = (hip.x + ankle.x) / 2
  const kneeDeviation = knee.x - midX
  // For left leg: positive deviation = valgum; for right: negative = valgum
  const isValgum =
    side === 'left' ? kneeDeviation > 0.02 : kneeDeviation < -0.02
  const isVarum =
    side === 'left' ? kneeDeviation < -0.02 : kneeDeviation > 0.02

  let classification: 'normal' | 'valgum' | 'varum' = 'normal'
  if (isValgum) classification = 'valgum'
  else if (isVarum) classification = 'varum'

  return { angleDeg: angle, classification }
}

// ---------------------------------------------------------------------------
// Eye Contact (gaze direction)
// ---------------------------------------------------------------------------
export interface EyeContactResult {
  /** true if subject appears to be looking at the camera */
  isLookingAtCamera: boolean
  /** Horizontal gaze ratio: 0 = looking far left, 0.5 = center, 1 = looking far right */
  gazeHorizontal: number
  /** Vertical gaze ratio: 0 = looking up, 0.5 = center, 1 = looking down */
  gazeVertical: number
}

/**
 * Estimate gaze direction from face mesh iris/eye landmarks.
 */
export function computeEyeContact(
  faceLandmarks: NormalizedLandmark[]
): EyeContactResult {
  const defaultResult: EyeContactResult = {
    isLookingAtCamera: false,
    gazeHorizontal: 0.5,
    gazeVertical: 0.5,
  }

  if (faceLandmarks.length < 474) return defaultResult

  // Left eye: iris center position relative to eye corners
  const leftIris = faceLandmarks[FACE.LEFT_IRIS_CENTER]
  const leftInner = faceLandmarks[FACE.LEFT_EYE_INNER]
  const leftOuter = faceLandmarks[FACE.LEFT_EYE_OUTER]

  // Right eye: iris center position relative to eye corners
  const rightIris = faceLandmarks[FACE.RIGHT_IRIS_CENTER]
  const rightInner = faceLandmarks[FACE.RIGHT_EYE_INNER]
  const rightOuter = faceLandmarks[FACE.RIGHT_EYE_OUTER]

  // Horizontal gaze: where is iris between inner/outer corner? (0..1)
  const leftEyeWidth = distance2D(leftInner, leftOuter)
  const rightEyeWidth = distance2D(rightInner, rightOuter)

  if (leftEyeWidth === 0 || rightEyeWidth === 0) return defaultResult

  const leftGazeH = (leftIris.x - leftOuter.x) / (leftInner.x - leftOuter.x)
  const rightGazeH = (rightIris.x - rightOuter.x) / (rightInner.x - rightOuter.x)
  const gazeH = (leftGazeH + rightGazeH) / 2

  // Vertical gaze: iris y relative to eye center y
  const leftEyeCenterY = (leftInner.y + leftOuter.y) / 2
  const rightEyeCenterY = (rightInner.y + rightOuter.y) / 2
  const leftGazeV = leftIris.y - leftEyeCenterY
  const rightGazeV = rightIris.y - rightEyeCenterY
  const gazeV = ((leftGazeV + rightGazeV) / 2 + 0.05) / 0.1 // Normalize to ~0..1

  // Looking at camera = gaze near center
  const isLooking = Math.abs(gazeH - 0.5) < 0.15 && Math.abs(gazeV - 0.5) < 0.2

  return {
    isLookingAtCamera: isLooking,
    gazeHorizontal: Math.max(0, Math.min(1, gazeH)),
    gazeVertical: Math.max(0, Math.min(1, gazeV)),
  }
}

// ---------------------------------------------------------------------------
// Eye Contact Duration
// ---------------------------------------------------------------------------
export interface EyeContactDurationResult {
  /** Percentage of time looking at camera (0..100) */
  contactPercentage: number
  /** Total frames analyzed */
  totalFrames: number
  /** Frames with eye contact */
  contactFrames: number
}

/**
 * Compute percentage of time the subject maintains eye contact across frames.
 */
export function computeEyeContactDuration(
  faceLandmarksFrames: NormalizedLandmark[][],
  _timestamps: number[]
): EyeContactDurationResult {
  if (faceLandmarksFrames.length === 0) {
    return { contactPercentage: 0, totalFrames: 0, contactFrames: 0 }
  }

  let contactCount = 0
  for (const lm of faceLandmarksFrames) {
    const result = computeEyeContact(lm)
    if (result.isLookingAtCamera) contactCount++
  }

  return {
    contactPercentage: (contactCount / faceLandmarksFrames.length) * 100,
    totalFrames: faceLandmarksFrames.length,
    contactFrames: contactCount,
  }
}

// ---------------------------------------------------------------------------
// Mouth Open (dental / throat screening trigger)
// ---------------------------------------------------------------------------
export interface MouthOpenResult {
  /** Mouth aperture ratio (height / width). > 0.5 = wide open */
  apertureRatio: number
  /** true if mouth is open enough for dental/throat inspection */
  isOpen: boolean
}

/**
 * Detect mouth opening from face mesh lip landmarks.
 */
export function computeMouthOpen(
  faceLandmarks: NormalizedLandmark[]
): MouthOpenResult {
  if (faceLandmarks.length < 292) {
    return { apertureRatio: 0, isOpen: false }
  }

  const upperLip = faceLandmarks[FACE.UPPER_LIP_TOP]
  const lowerLip = faceLandmarks[FACE.LOWER_LIP_BOTTOM]
  const mouthLeft = faceLandmarks[FACE.MOUTH_LEFT]
  const mouthRight = faceLandmarks[FACE.MOUTH_RIGHT]

  const mouthHeight = distance2D(upperLip, lowerLip)
  const mouthWidth = distance2D(mouthLeft, mouthRight)

  if (mouthWidth === 0) return { apertureRatio: 0, isOpen: false }

  const ratio = mouthHeight / mouthWidth

  return {
    apertureRatio: ratio,
    isOpen: ratio > 0.35,
  }
}

// ---------------------------------------------------------------------------
// Hand Flapping Detection (ASD behavioral marker)
// ---------------------------------------------------------------------------
export interface HandFlappingResult {
  /** true if rapid oscillatory hand movement detected */
  detected: boolean
  /** Oscillation frequency in Hz (if detected) */
  frequencyHz: number
  /** Amplitude of movement (normalized) */
  amplitude: number
  /** Confidence 0..1 */
  confidence: number
}

/**
 * Detect hand flapping (rapid oscillation) from hand landmark history.
 * Hand flapping is characterized by rapid, repetitive wrist movements
 * with a frequency typically between 2-8 Hz.
 */
export function detectHandFlapping(
  handLandmarksFrames: NormalizedLandmark[][],
  timestamps: number[]
): HandFlappingResult {
  const noResult: HandFlappingResult = {
    detected: false,
    frequencyHz: 0,
    amplitude: 0,
    confidence: 0,
  }

  if (handLandmarksFrames.length < 10 || timestamps.length < 10) return noResult

  // Use wrist position (landmark 0) across frames
  const wristPositions: { x: number; y: number; t: number }[] = []
  for (let i = 0; i < handLandmarksFrames.length; i++) {
    const lm = handLandmarksFrames[i]
    if (lm.length === 0) continue
    wristPositions.push({ x: lm[0].x, y: lm[0].y, t: timestamps[i] })
  }

  if (wristPositions.length < 10) return noResult

  // Compute velocity changes (sign changes indicate oscillation)
  const velocitiesY: number[] = []
  for (let i = 1; i < wristPositions.length; i++) {
    const dt = wristPositions[i].t - wristPositions[i - 1].t
    if (dt === 0) continue
    velocitiesY.push((wristPositions[i].y - wristPositions[i - 1].y) / dt)
  }

  // Count zero-crossings (direction changes)
  let zeroCrossings = 0
  for (let i = 1; i < velocitiesY.length; i++) {
    if (velocitiesY[i] * velocitiesY[i - 1] < 0) zeroCrossings++
  }

  // Compute duration and frequency
  const durationMs = wristPositions[wristPositions.length - 1].t - wristPositions[0].t
  if (durationMs <= 0) return noResult
  const durationSec = durationMs / 1000

  // Each full oscillation has 2 zero crossings
  const frequency = zeroCrossings / (2 * durationSec)

  // Compute amplitude (max displacement in y)
  const ys = wristPositions.map((p) => p.y)
  const amplitude = Math.max(...ys) - Math.min(...ys)

  // Flapping: high frequency (2-8 Hz) + sufficient amplitude
  const isFlapping = frequency >= 2 && frequency <= 8 && amplitude > 0.03
  const confidence = isFlapping
    ? Math.min(1, (zeroCrossings / 10) * (amplitude / 0.05))
    : 0

  return {
    detected: isFlapping,
    frequencyHz: Math.round(frequency * 10) / 10,
    amplitude,
    confidence: Math.min(1, confidence),
  }
}
