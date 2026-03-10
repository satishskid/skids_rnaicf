/**
 * AI Module Index — All clinical algorithms, screening AI, and LLM gateway.
 *
 * Value classifiers (WHO-based): ai-engine.ts (existing)
 * Signal processing: rppg, audiometry, audio-analysis
 * Image analysis: vision-screening, ear-analysis, skin-analysis, clinical-color
 * Behavioral: mchat-scoring, neurodevelopment, motor-assessment
 * LLM: llm-gateway (Ollama + cloud routing)
 */

// Existing WHO-based value classifiers
export { runLocalAI } from '../ai-engine'

// rPPG — contactless heart rate from camera
export { extractFaceSignalFromPixels, computeHeartRateCHROM } from './rppg'
export type { RGBSample } from './rppg'

// Pure-tone audiometry — hearing screening
export { classifyHearingLoss, calculatePTA, generateAudiometryResult, suggestHearingChips, TEST_FREQUENCIES } from './audiometry'
export type { AudiometryThreshold, AudiometryResult, Ear, TestFrequency } from './audiometry'

// M-CHAT-R/F — autism screening (16-30 months)
export { scoreMChat, mchatToFeatures, MCHAT_ITEMS } from './mchat-scoring'
export type { MChatItem, MChatAnswer, MChatResult, MChatRisk } from './mchat-scoring'

// Audio — cough/respiratory classification
export { extractAudioFeatures, classifyCough } from './audio-analysis'
export type { AudioFeatures, CoughClassification } from './audio-analysis'

// Vision — red reflex, photoscreening, anisocoria
export { analyzeRedReflex, analyzePhotoscreening } from './vision-screening'
export type { RedReflexResult, PhotoscreenFinding } from './vision-screening'

// Motor — tremor, stability analysis
export { analyzeMotorPerformance } from './motor-assessment'
export type { MotorAnalysisResult } from './motor-assessment'

// Neurodevelopment — engagement, gaze tracking
export { analyzeGazeStability, extractFacePosition, computeNeuroResults } from './neurodevelopment'
export type { NeuroScreeningResult } from './neurodevelopment'

// Ear — inflammation, otitis detection
export { analyzeEarImage } from './ear-analysis'
export type { EarAnalysisResult } from './ear-analysis'

// Skin — wound segmentation
export { segmentWound } from './skin-analysis'
export type { WoundSegmentationResult } from './skin-analysis'

// Clinical color — HSV/LAB analysis for erythema, pallor, cyanosis, jaundice
export { analyzeClinicalColors, mapSuggestionsToChipIds } from './clinical-color'
export type { ClinicalColorResult } from './clinical-color'

// LLM Gateway — local (Ollama) + cloud (Gemini/Claude/GPT-4o/Groq)
export {
  queryLLM, checkOllamaStatus, buildClinicalPrompt, buildVisionPrompt, parseVisionAnalysis,
  loadLLMConfig, saveLLMConfig, DEFAULT_LLM_CONFIG, LOCAL_MODEL_RECOMMENDATIONS,
} from './llm-gateway'
export type { LLMConfig, LLMMessage, LLMResponse, AIMode, CloudProvider, VisionAnalysisResult, ModelRecommendation } from './llm-gateway'
