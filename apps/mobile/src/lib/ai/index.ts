/**
 * AI Module Index — All clinical algorithms, screening AI, and LLM gateway.
 *
 * Three-tier ensemble pipeline: pipeline.ts (orchestrator)
 * Image quality: quality-gate.ts (blur, exposure, framing, flash)
 * Model loading: model-loader-mobile.ts (ONNX/TFLite on-device)
 * Value classifiers (WHO-based): ai-engine.ts (existing)
 * Signal processing: rppg, audiometry, audio-analysis
 * Image analysis: vision-screening, ear-analysis, skin-analysis, clinical-color
 * Behavioral: mchat-scoring, neurodevelopment, behavioral-assessment, motor-assessment
 * Motor: pose-estimation, motor-tasks, motor-assessment
 * OCR: ocr-engine (ML Kit text recognition)
 * LLM: llm-gateway (Ollama + cloud routing)
 */

// ── Three-Tier Ensemble Pipeline ──
export { runPipeline, mergeFindings, computeOverallRisk, computeOverallConfidence, DEFAULT_PIPELINE_CONFIG } from './pipeline'
export type { QualityGateResult, QualityCheck, AIFinding, AITierResult, BoundingBox, PipelineResult, PipelineConfig } from './pipeline'

// ── Image Quality Gate ──
export { runQualityGate, visionQualityGate, dentalQualityGate, skinQualityGate, earQualityGate, generalQualityGate } from './quality-gate'
export type { QualityGateOptions } from './quality-gate'

// ── Model Loader (ONNX/TFLite on mobile) ──
export { loadModel, runInference, preprocessPixels, isModelCached, clearModelCache, getCachedModelSize, listCachedModels } from './model-loader-mobile'
export type { LoadedModel, ModelLoadProgress } from './model-loader-mobile'

// ── Existing WHO-based value classifiers ──
export { runLocalAI } from '../ai-engine'

// ── rPPG — contactless heart rate from camera ──
export { extractFaceSignalFromPixels, computeHeartRateCHROM } from './rppg'
export type { RGBSample } from './rppg'

// ── Pure-tone audiometry — hearing screening ──
export {
  classifyHearingLoss, getHearingColor, calculatePTA, calculateSpeechPTA, calculateHighFreqPTA,
  calculateHearingHandicap, selectTestProtocol, getProtocolInstructions,
  measureAmbientNoise, generateAudiogramData, generateAudiometryResult, suggestHearingChips,
  TEST_FREQUENCIES, AUDIOGRAM_ZONES,
} from './audiometry'
export type {
  AudiometryThreshold, AudiometryResult, Ear, TestFrequency,
  FrequencyPattern, TestProtocol, AudiogramPoint, AmbientNoiseResult,
} from './audiometry'

// ── M-CHAT-R/F — autism screening (16-30 months) ──
export { scoreMChat, mchatToFeatures, MCHAT_ITEMS } from './mchat-scoring'
export type { MChatItem, MChatAnswer, MChatResult, MChatRisk } from './mchat-scoring'

// ── Audio — cough/respiratory classification ──
export { extractAudioFeatures, classifyCough } from './audio-analysis'
export type { AudioFeatures, CoughClassification } from './audio-analysis'

// ── Vision — red reflex, photoscreening, anisocoria, crescent analysis ──
export { analyzeRedReflex, analyzePhotoscreening } from './vision-screening'
export type { RedReflexResult, PhotoscreenFinding } from './vision-screening'

// ── Motor — pose-based neuromotor assessment ──
export { analyzeMotorPerformance } from './motor-assessment'
export type { MotorAnalysisResult } from './motor-assessment'

// ── Pose Estimation — 17-keypoint body pose ──
export { estimatePose, getKeypoint, keypointDistance, jointAngle, centerOfMass, dtwDistance, KEYPOINT_NAMES, SKELETON_CONNECTIONS } from './pose-estimation'
export type { Keypoint as PoseKeypoint, PoseFrame, PoseSequence } from './pose-estimation'

// ── Motor Tasks — structured motor assessment protocol ──
export { MOTOR_TASKS, generateMotorAssessment } from './motor-tasks'
export { getTasksForAge as getMotorTasksForAge } from './motor-tasks'
export type { MotorTask, TaskScore as MotorTaskScore, MotorAssessmentResult as MotorAssessment } from './motor-tasks'

// ── Neurodevelopment — engagement, gaze tracking (ML Kit face detection) ──
export { analyzeGazeStability, extractFacePosition, computeNeuroResults } from './neurodevelopment'
export type { NeuroScreeningResult } from './neurodevelopment'

// ── Behavioral Assessment — autism behavioral observation protocol ──
export { BEHAVIORAL_TASKS, generateBehavioralAssessment } from './behavioral-assessment'
export { getTasksForAge as getBehavioralTasksForAge } from './behavioral-assessment'
export type { BehavioralTask, TaskObservation, BehavioralAssessmentResult as BehavioralAssessment } from './behavioral-assessment'

// ── OCR Engine — ML Kit text recognition + device extractors ──
export { extractFromDevice, recognizeText } from './ocr-engine'
export type { OCRResult, ExtractedValue as DeviceReading, DeviceType } from './ocr-engine'

// ── Ear — inflammation, otitis detection ──
export { analyzeEarImage } from './ear-analysis'
export type { EarAnalysisResult } from './ear-analysis'

// ── Skin — wound segmentation ──
export { segmentWound } from './skin-analysis'
export type { WoundSegmentationResult } from './skin-analysis'

// ── Clinical color — HSV/LAB analysis for erythema, pallor, cyanosis, jaundice ──
export { analyzeClinicalColors, mapSuggestionsToChipIds } from './clinical-color'
export type { ClinicalColorResult } from './clinical-color'

// ── LLM Gateway — local (Ollama) + cloud (Gemini/Claude/GPT-4o/Groq) ──
export {
  queryLLM, checkOllamaStatus, buildClinicalPrompt, buildVisionPrompt, parseVisionAnalysis,
  loadLLMConfig, saveLLMConfig, DEFAULT_LLM_CONFIG, LOCAL_MODEL_RECOMMENDATIONS,
} from './llm-gateway'
export type { LLMConfig, LLMMessage, LLMResponse, AIMode, CloudProvider, VisionAnalysisResult, ModelRecommendation } from './llm-gateway'
