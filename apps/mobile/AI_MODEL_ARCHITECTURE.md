# SKIDS Screen v3 — AI Model Architecture

## Overview

The SKIDS mobile app uses a **3-tier ensemble pipeline** for clinical screening AI:

| Tier | Name | Runtime | Latency | Purpose |
|------|------|---------|---------|---------|
| 1 | **Quality Gate** | Rule-based (JS) | <50ms | Image quality validation (blur, exposure, framing) |
| 2 | **On-Device ML** | ONNX/TFLite (native) | 100-500ms | Classification, pose estimation, object detection |
| 3 | **LLM Vision** | Ollama/Cloud API | 1-10s | Clinical reasoning, verification, report generation |

## Model Registry — All Screening Modules

### IMAGE-BASED SCREENING (Photo Capture)

#### 1. Vision / Photoscreening
- **Purpose**: Red reflex abnormality, strabismus, refractive error detection
- **Tier 1**: Rule-based red reflex crescent analysis (HSV color, symmetry)
- **Tier 2**: `photoscreen-mobilenet-v2.onnx` — MobileNetV2 6-class classifier
  - Classes: normal, strabismus, anisocoria, leucocoria, ptosis, abnormal_reflex
  - Input: 224x224 RGB, ImageNet normalized
  - Output: 6-class softmax probabilities
  - Size: ~14MB (INT8 quantized)
  - Source: Custom-trained on pediatric photoscreen dataset
- **Tier 3**: Gemini/Claude vision for complex cases (confidence < 0.7)
- **ICD Codes**: H50.x (strabismus), H52.x (refractive), H44.9 (leucocoria), H26.9 (cataract)

#### 2. Dental / Oral
- **Purpose**: Caries, malocclusion, cleft, gingivitis, fluorosis
- **Tier 1**: Clinical-color analysis (redness, pallor, lesion segmentation)
- **Tier 2**: `dental-classifier.onnx` — EfficientNet-Lite dental classifier
  - Classes: healthy, caries, gingivitis, fluorosis, malocclusion, cleft
  - Input: 224x224 RGB
  - Output: Multi-label probabilities + bounding boxes
  - Size: ~8MB (INT8 quantized)
  - Source: Fine-tuned on oral health dataset
- **Tier 3**: LLM vision for severity grading
- **ICD Codes**: K02 (caries), K05 (periodontal), K00.3 (fluorosis), Q35-37 (cleft)

#### 3. Skin / Dermatology
- **Purpose**: Lesion classification, wound assessment, rash identification
- **Tier 1**: HSV-based wound segmentation, tissue composition (granulation/slough/necrotic)
- **Tier 2**: `skin-classifier.onnx` — DermNet-trained classifier
  - Classes: normal, eczema, impetigo, scabies, fungal, vitiligo, birthmark, wound
  - Input: 224x224 RGB
  - Output: Multi-label probabilities
  - Size: ~12MB (INT8 quantized)
- **Tier 3**: LLM vision for rare conditions
- **ICD Codes**: L20 (eczema), L01 (impetigo), B86 (scabies), B35 (fungal), L80 (vitiligo)

#### 4. Ear / ENT (Otoscopy)
- **Purpose**: Otitis media, TM perforation, wax impaction, inflammation
- **Tier 1**: HSV color scoring, symmetry detection, inflammation indicators
- **Tier 2**: `ear-classifier.onnx` — OtoNet otoscopy classifier
  - Classes: normal, AOM, OME, perforation, wax, foreign_body
  - Input: 224x224 RGB (otoscope image)
  - Output: 6-class softmax
  - Size: ~8MB (INT8 quantized)
- **Tier 3**: LLM vision for unusual presentations
- **ICD Codes**: H65 (OME), H66 (suppurative otitis), H72 (TM perforation)

#### 5. Eye / Anterior Segment
- **Purpose**: Conjunctivitis, pterygium, corneal opacity
- **Tier 1**: Clinical-color (redness, pallor, jaundice in sclera)
- **Tier 2**: Reuse vision-screening model for pupil/reflex analysis
- **Tier 3**: LLM vision
- **ICD Codes**: H10 (conjunctivitis), H11.0 (pterygium), H17 (corneal opacity)

#### 6. General Appearance / Nutrition
- **Purpose**: Pallor, jaundice, cyanosis, SAM/MAM, edema
- **Tier 1**: Clinical-color multi-region (conjunctiva, nails, palms, lips)
- **Tier 2**: No dedicated model needed (clinical-color + MUAC + BMI z-score)
- **Tier 3**: LLM for holistic assessment
- **ICD Codes**: E43 (SAM), E44 (MAM), R23.0 (cyanosis), R17 (jaundice)

---

### VIDEO-BASED SCREENING (Camera Recording)

#### 7. Motor / Neuromotor Assessment
- **Purpose**: Gait analysis, balance, fine motor, coordination
- **Tier 1**: Heuristic skin-tone silhouette tracking (fallback)
- **Tier 2**: `movenet-lightning.tflite` — **CRITICAL MODEL**
  - Architecture: MoveNet Lightning (Google)
  - Output: 17 COCO keypoints per frame (nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles)
  - Input: 192x192 RGB video frames
  - Size: ~3MB TFLite
  - Source: TensorFlow Hub (pre-trained, no fine-tuning needed)
  - **Status: TODO — highest priority model to integrate**
- **Post-processing**: DTW symmetry, center-of-mass stability, jerk/smoothness, autocorrelation rhythm
- **Tasks**: Walking (gait), single-leg stand (balance), finger-to-nose (coordination), block stacking (fine motor)

#### 8. Behavioral / Autism Observation
- **Purpose**: Social engagement, joint attention, repetitive behaviors, sensory response
- **Tier 1**: Rule-based task observation scoring (latency, response type)
- **Tier 2**: Gaze tracking via ML Kit Face Detection (eye contact, smiling)
  - Uses `@react-native-ml-kit/face-detection` (optional)
  - Fallback: skin-tone grid + brightness heuristic
- **Tier 3**: LLM analysis of behavioral patterns (optional)
- **M-CHAT-R/F**: Questionnaire scoring (validated, rule-based — no ML needed)

#### 9. Neurodevelopment / Gaze Tracking
- **Purpose**: Eye contact frequency, social engagement, gaze stability
- **Tier 2**: ML Kit Face Detection (landmarks + classification)
  - Detects: eye openness, smile probability, head rotation angles
  - Computes: gaze stability score, eye contact duration
  - Fallback: brightness-based gaze heuristic
- **No dedicated model needed** — ML Kit is sufficient

#### 10. rPPG (Remote Photoplethysmography)
- **Purpose**: Contactless heart rate measurement from face video
- **Algorithm**: CHROM method (Chrominance-based)
  - Extracts RGB time-series from face ROI
  - Butterworth bandpass filter (0.7–3.5 Hz = 42–210 BPM)
  - Peak detection for heart rate
- **No ML model needed** — DSP/signal processing is sufficient and accurate
- **Requires**: ≥90 frames (3+ seconds at 30fps) for reliable measurement

---

### AUDIO-BASED SCREENING (Microphone Recording)

#### 11. Audiometry / Hearing
- **Purpose**: Pure-tone audiometry, speech-frequency hearing loss
- **Algorithm**: Modified Hughson-Westlake protocol (5dB down, 10dB up)
  - Tone generation at 500/1K/2K/4K Hz
  - WHO classification (Normal/Slight/Mild/Moderate/Severe/Profound)
  - PTA (Pure Tone Average) calculation
- **No ML model needed** — standardized clinical protocol
- **Optional enhancement**: `yamnet.tflite` for ambient noise classification
  - Size: ~3MB
  - Purpose: Classify environmental noise to assess test reliability

#### 12. Audio Analysis (Respiratory / Cardiac Sounds)
- **Purpose**: Cough classification, wheeze/crackle detection, heart sound analysis
- **Algorithm**: FFT spectral analysis + feature extraction
  - Features: peak frequency, spectral centroid, zero-crossing rate, RMS amplitude
  - Cough classifier: dry/wet/barking/whooping via spectral thresholds
  - Cardiac: heart rate from autocorrelation, S1/S2 regularity
  - Pulmonary: wheeze (high-freq continuous), crackles (short bursts), stridor
- **Optional enhancement**: `lung-sound-classifier.onnx`
  - Architecture: AudioSpectrogram + CNN
  - Classes: normal, wheeze, crackle, stridor, rhonchi
  - Input: 5s Mel spectrogram (128 bands)
  - Size: ~5MB

---

### QUESTIONNAIRE / FORM-BASED SCREENING

#### 13. M-CHAT-R/F (Autism Screening)
- **Validated instrument** — 20 yes/no items with domain weighting
- **Risk classification**: Low (0-2) / Medium (3-7) / High (8+)
- **No ML model needed** — rule-based scoring per published protocol

---

### VALUE-BASED SCREENING (Numeric Input / OCR)

#### 14-20. Vitals (Height, Weight, BMI, SpO2, Hemoglobin, BP, MUAC)
- **Algorithm**: WHO z-score classification (age/gender-specific)
- **No ML models needed** — standard clinical reference tables
- **OCR**: ML Kit Text Recognition for reading device displays
  - Extracts: numeric values from BP monitors, pulse oximeters, thermometers
  - Device-specific parsers for display formats

---

## Model Download & Caching Strategy

### On-Device Model Storage
```
expo-file-system://
  ai-models/
    photoscreen-mobilenet-v2.onnx     (~14MB)
    movenet-lightning.tflite          (~3MB)
    dental-classifier.onnx            (~8MB)  [optional]
    skin-classifier.onnx              (~12MB) [optional]
    ear-classifier.onnx               (~8MB)  [optional]
    yamnet.tflite                     (~3MB)  [optional]
    lung-sound-classifier.onnx        (~5MB)  [optional]
```

### Download Priority (by clinical impact)
1. **MUST HAVE** (~17MB total):
   - `photoscreen-mobilenet-v2.onnx` — Vision screening is the primary use case
   - `movenet-lightning.tflite` — Motor assessment without this is heuristic-only

2. **SHOULD HAVE** (~16MB total):
   - `dental-classifier.onnx` — High screening volume
   - `ear-classifier.onnx` — Common pediatric condition

3. **NICE TO HAVE** (~20MB total):
   - `skin-classifier.onnx` — Specialized
   - `yamnet.tflite` — Ambient noise
   - `lung-sound-classifier.onnx` — Respiratory screening enhancement

### Runtime Selection
```
Tier 2 Model Selection:
  - ONNX models → onnxruntime-react-native (CPU/GPU)
  - TFLite models → @tensorflow/tfjs-react-native or react-native-tflite

Tier 3 LLM Selection (configurable):
  Local:  Ollama (lfm2.5-vl:1.6b, medgemma:4b, qwen3-vl:8b)
  Cloud:  Gemini 2.0 Flash | Claude Sonnet 4 | GPT-4o | Groq Llama 3.3 70B
```

## PHI (Protected Health Information) Controls

| Role | AI Mode | Send Images to Cloud | Personal API Key |
|------|---------|---------------------|-----------------|
| Nurse | `local_only` (forced) | OFF | N/A |
| Doctor | Configurable | Configurable | BYOK supported |
| Admin | Configurable | Configurable | Server key |

## Integration Architecture (gpubrowse-inspired)

From the gpubrowse POC, we adopt:
1. **ONNX Runtime** for cross-platform model inference (not WebGPU — we're React Native, not browser)
2. **Lazy model loading** — download on first use, cache in app storage
3. **SAM 2 architecture** — potential future use for interactive lesion segmentation
4. **Cloudflare Workers AI** as edge fallback (already wired via ai-gateway.ts)
5. **Model config stored in AsyncStorage** — runtime model selection without app update

## Pipeline Flow Per Module

```
Capture (photo/video/audio/value)
    ↓
Quality Gate (Tier 1) — blur, exposure, framing check
    ↓ (pass)
On-Device ML (Tier 2) — ONNX/TFLite classifier
    ↓ (confidence < threshold)
LLM Vision (Tier 3) — Ollama or Cloud API
    ↓
Merge Findings — ensemble by confidence weighting
    ↓
Annotation Chips — nurse selects/overrides AI suggestions
    ↓
Save Observation — sync to Turso via API
```
