# SKIDS Screen Mobile APK — Feature & AI Audit

**App**: com.skids.screen v3.0.0 | Expo SDK 54 | React Native 0.81.5
**APK**: ~/Desktop/skids-screen-v3-debug.apk (130MB, built Mar 10)
**API**: https://skids-api.satish-9f4.workers.dev

---

## 1. Screens (12)

| Screen | Route | Purpose | Status |
|--------|-------|---------|--------|
| LoginScreen | Auth Stack | PIN (6-digit + org code) or email/password login | ✅ Built |
| HomeScreen | MainTabs → Home | Campaign list alias (redirects to Campaigns) | ✅ Built |
| CampaignsScreen | Home Stack | List campaigns, create new, pull-to-refresh | ✅ Built |
| CampaignDetailScreen | Home → Detail | Stats (children/obs/reviews), progress bar, child list | ✅ Built |
| RegisterChildScreen | Detail → Register | Form: name, gender, DOB, class, section, parent, phone | ✅ Built |
| ScreeningScreen | Home/Screening Tab | Module grid (6 Vitals + 21 Head-to-Toe), child selector, batch mode | ✅ Built |
| ModuleScreen | Screening → Module | Capture UI (photo/video/audio/value/form), AI analysis, annotation chips | ✅ Built (~1250 lines) |
| QuickVitalsScreen | Screening → Quick | Height/Weight/MUAC/SpO2/Hb/BP in one screen, age-filtered fields | ✅ Built |
| BatchSummaryScreen | Module → Summary | Normal/review/attention stats, finding cards, completion list | ✅ Built |
| ObservationListScreen | Detail → Obs | Observation list with status badges, tap to review | ✅ Built |
| DoctorReviewScreen | Obs → Review | Approve/Refer/Follow-up/Discharge/Retake, AI assist, clinical notes | ✅ Built |
| ProfileScreen | MainTabs → Profile | User info, app version, AI engine status, sync status, logout | ✅ Built |

---

## 2. Components (8)

| Component | Purpose |
|-----------|---------|
| CameraCapture | Embedded camera + system picker fallback, quality gate overlay |
| AIResultCard | Displays AI classification with confidence, risk badge |
| AnnotationChips | Selectable chips per module, severity grades, AI auto-select |
| ModuleCard | Module tile in screening grid (icon, name, completion dot) |
| ReadinessCheck | Pre-screening modal: camera/mic/network/storage/AI checks |
| ScreeningHeader | Campaign + child info header bar |
| StatCard | Stat display card (count + label) |
| SyncStatusBar | Offline queue count, sync status indicator |

---

## 3. Local AI — Three-Tier Pipeline

```
Image/Data → Quality Gate → Tier 1 (Rule-Based) → Tier 2 (On-Device ML) → Tier 3 (LLM Vision)
                              Always runs           If Tier 1 < threshold    If Tier 2 < 0.7
```

### Tier 1: Rule-Based Analysis (Pure TypeScript — fully offline)

| Algorithm | File | Input | Output | Test Priority |
|-----------|------|-------|--------|---------------|
| WHO Z-Score Height | ai-engine.ts | height + age + gender | Stunted/Normal/Tall | 🔴 HIGH |
| WHO Z-Score Weight | ai-engine.ts | weight + age + gender | Underweight/Normal/Overweight | 🔴 HIGH |
| SpO2 Classification | ai-engine.ts | SpO2 % value | Normal/Mild/Moderate/Severe hypoxia | 🔴 HIGH |
| Hemoglobin (Anemia) | ai-engine.ts | Hb + age + gender | Normal/Mild/Moderate/Severe anemia | 🔴 HIGH |
| MUAC (Malnutrition) | ai-engine.ts | MUAC cm | Normal/MAM/SAM | 🔴 HIGH |
| BP Classification | ai-engine.ts | systolic/diastolic + age | Normal/Elevated/Stage 1-2 | 🔴 HIGH |
| Red Reflex Analysis | vision-screening.ts | RGBA pixels | Present/absent, symmetry score | 🟡 MEDIUM |
| Crescent Analysis | vision-screening.ts | RGBA pixels | Myopia/hyperopia/astigmatism risk | 🟡 MEDIUM |
| Clinical Color (HSV/LAB) | clinical-color.ts | RGBA pixels | Redness/pallor/cyanosis/jaundice | 🟡 MEDIUM |
| Ear Inflammation | ear-analysis.ts | RGBA pixels | Inflammation indicator, risk category | 🟡 MEDIUM |
| Wound Segmentation | skin-analysis.ts | RGBA pixels | Granulation/slough/necrotic % | 🟡 MEDIUM |
| Cough Classification | audio-analysis.ts | PCM audio | Dry/wet/barking/whooping + confidence | 🟡 MEDIUM |
| Cardiac Audio | audio-analysis.ts | PCM audio | Heart rate, murmur detection | 🟡 MEDIUM |
| Pulmonary Audio | audio-analysis.ts | PCM audio | Wheeze/crackle/stridor detection | 🟡 MEDIUM |
| rPPG Heart Rate | rppg.ts | RGB face samples | Heart rate BPM (CHROM method) | 🟡 MEDIUM |
| Audiometry | audiometry.ts | Threshold data | WHO hearing classification, PTA | 🟡 MEDIUM |
| M-CHAT-R/F Scoring | mchat-scoring.ts | 20 yes/no answers | Low/medium/high autism risk | 🟡 MEDIUM |
| Pose Estimation (heuristic) | pose-estimation.ts | RGBA pixels | 17 COCO keypoints | 🟢 LOW |
| Motor Task Scoring | motor-tasks.ts | Pose sequences | Gait/balance/coordination scores | 🟢 LOW |
| Behavioral Assessment | behavioral-assessment.ts | Task observations | Social + restricted behavior scores | 🟢 LOW |
| Neurodevelopment/Gaze | neurodevelopment.ts | Face detection frames | Engagement, attention, risk | 🟢 LOW |

### Tier 2: On-Device ML Models (ONNX Runtime)

| Model | File | Architecture | Source URL | Status |
|-------|------|-------------|------------|--------|
| Vision Photoscreening | vision-screening.ts | MobileNetV2 (6-class, 224×224) | `pub-skids-models.r2.dev/photoscreen-v1.onnx` | ⚠️ Needs R2 download test |
| MoveNet Lightning | pose-estimation.ts | TFLite (~3MB) | `pub-skids-models.r2.dev/movenet-lightning-v4.tflite` | ⚠️ TFLite runtime TODO — falls back to heuristic |

**Model Loader** (`model-loader-mobile.ts`):
- Downloads from R2 CDN → caches in `${documentDirectory}ai-models/`
- Inference via `onnxruntime-react-native` with CPU execution provider
- Preprocessing: nearest-neighbor resize to 224×224, NCHW format, ImageNet normalization

### Tier 3: LLM Vision (Online — optional)

| Provider | Model | Mode |
|----------|-------|------|
| Ollama (local) | lfm2.5-vl:1.6b (default) | local_only / local_first |
| Ollama (local) | medgemma:4b | Medical-specific |
| Google Gemini | gemini-2.0-flash | cloud_first / dual |
| Anthropic Claude | claude-3-5-sonnet | cloud fallback |
| OpenAI | gpt-4o | cloud fallback |
| Groq | llama-3.2-90b-vision | fast cloud |

**LLM Gateway** (`llm-gateway.ts`):
- 4 routing modes: `local_only`, `local_first`, `cloud_first`, `dual`
- Cloud via Cloudflare AI Gateway: `gateway.ai.cloudflare.com/v1/9f4998a.../skids-ai-gateway`
- Config persisted in AsyncStorage (`@skids/llm-config`)

### Quality Gates (5 module-specific)

| Gate | File | Checks |
|------|------|--------|
| visionQualityGate | quality-gate.ts | Blur, exposure, flash, eye region framing |
| dentalQualityGate | quality-gate.ts | Blur, exposure, mouth region framing |
| skinQualityGate | quality-gate.ts | Blur, exposure, lesion region framing |
| earQualityGate | quality-gate.ts | Blur, exposure, ear canal framing |
| generalQualityGate | quality-gate.ts | Blur, exposure, subject framing |

### OCR Engine (ML Kit Text Recognition)

| Extractor | Extracts | Pattern |
|-----------|----------|---------|
| extractTemperature | Temp (35-42°C / 95-107.6°F) | Regex from thermometer display |
| extractBloodPressure | Systolic/diastolic/pulse | Regex from BP monitor |
| extractWeight | Weight (2-100kg / 4-220lbs) | Regex from weighing scale |
| extractSpO2 | O2 sat + pulse | Regex from pulse oximeter |
| extractHealthCard | Ayushman Bharat card ID, name, DOB | Regex from health card |

---

## 4. Data Sync & Offline

| Parameter | Value |
|-----------|-------|
| Storage Key | `@skids/sync-queue` (AsyncStorage) |
| Max Retries | 3 |
| Auto-Sync Interval | 60 seconds |
| Backoff | Exponential (2^attempt × 1000ms) |
| Batch Endpoint | `POST /api/observations/sync` |
| Individual Fallback | `POST /api/observations` |
| Connectivity Check | `@react-native-community/netinfo` |

---

## 5. API Endpoints Used

| Method | Path | Screen |
|--------|------|--------|
| POST | `/api/pin-auth/login` | LoginScreen |
| POST | `/api/auth/sign-in/email` | LoginScreen |
| POST | `/api/auth/sign-up/email` | AuthContext |
| GET | `/api/auth/get-session` | AuthContext |
| GET | `/api/campaigns` | CampaignsScreen |
| POST | `/api/campaigns` | CampaignsScreen |
| GET | `/api/campaigns/:code/children` | CampaignDetail, Screening |
| GET | `/api/campaigns/:code/stats` | CampaignDetailScreen |
| GET | `/api/observations?campaign=X` | CampaignDetailScreen |
| GET | `/api/observations?campaign_code=X&childId=Y` | ObservationList |
| POST | `/api/observations` | ModuleScreen, QuickVitals |
| POST | `/api/observations/sync` | sync-engine |
| POST | `/api/children` | RegisterChildScreen |
| POST | `/api/reviews` | DoctorReviewScreen |

---

## 6. Permissions (Android)

| Permission | Purpose |
|------------|---------|
| CAMERA | Photo/video screening capture |
| RECORD_AUDIO | Audio recording (cough, heart, hearing) |
| BLUETOOTH + ADMIN + CONNECT + SCAN | AyuSynk stethoscope |
| NFC | Future medical device integration |
| INTERNET | API communication |
| ACCESS_NETWORK_STATE | Offline detection |
| MODIFY_AUDIO_SETTINGS | Audiometry tone generation |

---

## 7. Known Issues & Gaps

| Issue | Severity | Details |
|-------|----------|---------|
| MoveNet TFLite runtime TODO | 🟡 | Pose estimation falls back to heuristic skin-tone tracking |
| Tier 3 LLM base64 placeholder | 🟡 | `pipeline.ts:241` — LLM vision needs base64 conversion, not wired |
| No QR code scanning | 🟡 | Child lookup is manual search only |
| No test suite | 🔴 | Zero tests, no jest/detox installed |
| No crash reporting | 🟡 | No Sentry/Bugsnag — errors logged to console only |
| No iOS support | 🟢 | Android only, app.json has no iOS config |
| ModuleScreen 1250 lines | 🟢 | Handles all 5 capture types — works but hard to maintain |
| Hardcoded API base | 🟡 | No staging/dev environment switching |
| Annotation chips duplicated | 🟢 | Local copy of shared/annotations.ts — must sync manually |
| Ollama localhost assumption | 🟡 | localhost:11434 only works if Ollama runs on device |
| No image compression | 🟡 | Photos at 0.8 quality but no resize before upload |
| No date picker | 🟢 | DOB is plain TextInput with YYYY-MM-DD format |
| No OTA updates | 🟡 | No expo-updates configured |
| AyuSynk client ID hardcoded | 🟢 | `AYUSYNC_CLIENT_ID = 'ySdydiuSkydkuSSA'` |

---

## 8. Testing Checklist

### 🔴 Critical Path (must work)
- [ ] Login with PIN (org code: zpedi)
- [ ] Login with email/password
- [ ] List campaigns
- [ ] Open campaign → see children
- [ ] Register new child
- [ ] Open screening → see 27 module grid
- [ ] Capture photo for a module → quality gate fires
- [ ] Enter height value → WHO Z-score classification appears
- [ ] Enter weight value → classification appears
- [ ] Enter SpO2 → classification appears
- [ ] Save observation → syncs to API
- [ ] Doctor review → approve/refer works

### 🟡 AI Pipeline (verify accuracy)
- [ ] Quick Vitals: all 6 fields classify correctly for test ages
- [ ] Vision module: red reflex analysis on eye photo
- [ ] Dental module: clinical color analysis
- [ ] Skin module: wound segmentation
- [ ] Ear module: inflammation detection
- [ ] Audio: cough recording → dry/wet classification
- [ ] M-CHAT form → autism risk scoring
- [ ] ONNX model download from R2 → cached
- [ ] LLM gateway: Ollama local model if available
- [ ] Quality gate: rejects blurry/dark images

### 🟢 Secondary Features
- [ ] Batch screening: auto-advance through modules
- [ ] Offline: save observation when offline → syncs when online
- [ ] Sync status bar shows pending count
- [ ] ReadinessCheck modal validates permissions
- [ ] Profile shows AI engine status
- [ ] AyuSynk stethoscope deep link
