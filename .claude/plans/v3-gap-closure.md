# V3 Gap Closure Plan — From Data Platform to Clinical Decision Support System

## Context
V3 has structural parity (tables, routes, types, chips, 4D mapping). What's missing is the **AI brain**, **clinical visualizations**, **analytics engine**, **parent-facing reports**, and **real-time parallel screening awareness**. This plan ports all V2 intelligence to V3's Cloudflare+Turso+React Native architecture.

Previous research established: Cloudflare AI Gateway for cloud LLM routing, Ollama for local doctor AI, ONNX Runtime Web for on-device nurse AI, Cache API for model persistence.

---

## Phase 1: Shared Intelligence Libraries (packages/shared)
**Goal:** Port the business logic that everything depends on. No UI — just pure functions.

### 1A. Parent Education Content
- **Create** `packages/shared/src/parent-education.ts` (~450 lines)
- Port from V2 `src/lib/parent-education.ts`
- `MODULE_EDUCATION`: Per-module intro, method, healthy message for 30+ modules
- `CONDITION_PARENT_INFO`: Per-condition parent-friendly descriptions for 80+ conditions
  - What it means, how common, what to do, when to see doctor
- `MODULE_BODY_POSITIONS`: Anatomical positions for body diagram overlays
- Export: `getModuleEducation(moduleType)`, `getConditionInfo(conditionKey)`

### 1B. Campaign Progress Engine
- **Create** `packages/shared/src/campaign-progress.ts` (~250 lines)
- Port from V2 `src/lib/campaign-progress.ts`
- `CampaignProgress` interface: totalChildren, screened, fullyScreened, reviewed, referred, completed
- `PipelineStage[]`: Registered → Screened → Fully Screened → Reviewed → Completed
- `NurseActivity[]`: nurseName, childrenScreened, observationsCreated, lastActiveAt
- `ModuleProgress[]`: moduleType, completed/total/percentage per module
- `ReviewBreakdown`: approved, referred, followUp, discharged, pending
- `ScreeningRate`: today, thisWeek, total
- Export: `computeCampaignProgress(children, observations, reviews, enabledModules)`

### 1C. Population Analytics Engine
- **Create** `packages/shared/src/population-analytics.ts` (~560 lines)
- Port from V2 `src/lib/population-analytics.ts`
- `GeoNode` tree: country→state→district→city→school hierarchy
- `buildGeoHierarchy(campaigns)`: Build drill-down tree from campaign locations
- `compareSubCohorts(observations, dimension)`: Gender/age/class cross-tabs
- `computeDemographicBreakdown(children, observations)`: Age groups, gender splits
- `computeTrendAnalysis(observations, interval)`: Time-series prevalence
- `computePopulationSummary(campaigns, observations)`: Aggregate stats

### 1D. Cohort Analytics
- **Create** `packages/shared/src/cohort-analytics.ts` (~330 lines)
- Port from V2 `src/lib/cohort-analytics.ts`
- `CohortAnalytics`: Coverage, risk breakdown, module completion
- `PrevalenceReport`: Per-condition prevalence with ICD codes + severity breakdown
- `computeCohortAnalytics(children, observations, enabledModules)`
- `computePrevalenceReport(observations, fourDConditions)`

### 1E. Export Utilities
- **Create** `packages/shared/src/export-utils.ts` (~260 lines)
- Port from V2 `src/lib/export-utils.ts`
- `exportConditionsToCSV(report)`: Condition table with severity
- `exportFullReportToCSV(report, demographics)`: Full data export
- `exportToJSON(data)`: JSON serialization
- `generateReportFilename(campaignCode, format)`: Naming convention

### 1F. Campaign Location Hierarchy
- **Edit** `packages/shared/src/types.ts` — Add:
  - `LocationLevel`: 'country' | 'state' | 'district' | 'city' | 'school'
  - `CampaignLocation` interface: country, state, district, city, pincode, address, coordinates
- **Edit** `packages/shared/src/campaigns.ts` — Add:
  - `normaliseCampaignLocation(campaign)`: Handle flat vs nested location fields
  - `getLocationLabel(loc, level)`: Display labels per level

### 1G. Update Index Exports
- **Edit** `packages/shared/src/index.ts` — Add exports for all new modules

**Deliverable:** 5 new files + 2 edits in packages/shared. ~1,850 lines of pure business logic.

---

## Phase 2: AI Infrastructure (packages/shared + apps/worker)
**Goal:** Build the AI backbone — model loading, LLM gateway, AI gateway route. No UI.

### 2A. Clinical Algorithm Suite (On-Device, No ML Models)
- **Create** `packages/shared/src/ai/anthropometry.ts` (~200 lines)
  - WHO LMS Z-scores (height/weight/BMI-for-age, 2006/2007 tables)
  - SpO2 classification (normal/mild/moderate/severe hypoxia)
  - Anemia classification (WHO 2011 age-gender thresholds)
  - MUAC classification (SAM/MAM/Normal)
  - `computeAnthropometry(age, gender, height, weight, bmi)`

- **Create** `packages/shared/src/ai/clinical-color.ts` (~150 lines)
  - HSV + LAB color analysis for clinical findings
  - Erythema, pallor, cyanosis, jaundice, white patches, dark spots detection
  - Module-specific chip mapping (dental→caries, throat→erythema, eyes→pallor)
  - `analyzeColorFindings(imageData, moduleType)`

- **Create** `packages/shared/src/ai/audio-analysis.ts` (~200 lines)
  - Cough classification (dry, wet, barking, whooping) via spectral features
  - Cardiac auscultation (S1/S2, murmur, gallop) frequency bands
  - Pulmonary sounds (wheeze >400Hz, rhonchi <200Hz, crackles)
  - `classifyCough(audioFeatures)`, `analyzeHeartSounds(audioFeatures)`, `analyzeLungSounds(audioFeatures)`

- **Create** `packages/shared/src/ai/audiometry.ts` (~180 lines)
  - Pure-tone audiometry scoring (500-4000Hz)
  - WHO hearing loss classification (Normal→Profound)
  - PTA calculation, asymmetry detection
  - `classifyHearingLoss(thresholds)`, `computePTA(thresholds)`

- **Create** `packages/shared/src/ai/mchat-scoring.ts` (~100 lines)
  - M-CHAT-R/F autism screening instrument (20 items)
  - 3 reverse-scored items, 7 critical items
  - Risk determination (Low/Medium/High)
  - `scoreMCHAT(responses)`

- **Create** `packages/shared/src/ai/rppg.ts` (~120 lines)
  - CHROM chrominance-based pulse detection from face ROI
  - Signal processing: `X = 3R - 2G`, `Y = 1.5R + G - 1.5B`
  - Peak detection, BPM calculation (40-200 valid range)
  - `estimateHeartRate(rgbSignals, fps)`

- **Create** `packages/shared/src/ai/motor.ts` (~80 lines)
  - Motion tracking stability, tremor detection, speed/symmetry
  - `analyzeMotorPerformance(motionData)`

- **Create** `packages/shared/src/ai/index.ts` — Re-export all

### 2B. ONNX Model Loader (Web Only)
- **Create** `apps/web/src/lib/ai/model-loader.ts` (~150 lines)
  - Lazy loading from CDN with Cache API persistence
  - Progress tracking callbacks
  - ONNX Runtime Web with WASM backend
  - ImageNet preprocessing (NCHW format)
  - `loadModel(modelUrl, onProgress)`, `runInference(model, input)`

### 2C. ML Models (Web Only — ONNX)
- **Create** `apps/web/src/lib/ai/photoscreening.ts` (~200 lines)
  - MobileNetV2 ONNX for eye amblyopia risk
  - Red reflex analysis, strabismus, anisocoria, ptosis detection
  - Crescent analysis for refractive error estimation
  - `analyzeEyePhoto(imageData)` → { findings, risk, confidence }

- **Create** `apps/web/src/lib/ai/ent-classifier.ts` (~180 lines)
  - 10-class multi-label (ear 4 + dental 3 + throat 3)
  - GradCAM-style explainability heatmaps
  - Nurse vs AI chip comparison
  - `classifyENTImage(imageData)` → { findings[], heatmap, nurseComparison }

- **Create** `apps/web/src/lib/ai/segmentation.ts` (~150 lines)
  - MobileSAM encoder-decoder (interactive segmentation)
  - Point-prompt mask generation
  - Region measurement (area percentage)
  - `segmentRegion(imageData, points)` → { mask, area }

### 2D. LLM Gateway (Multi-Provider Hybrid)
- **Create** `apps/web/src/lib/ai/llm-gateway.ts` (~250 lines)
  - Port from V2 `src/lib/ai/llm-gateway.ts`
  - 4 modes: `local_only` | `local_first` | `cloud_first` | `dual`
  - Local: Ollama (MedGemma 4B, LFM2.5-VL 1.6B, Qwen3.5 4B/9B)
  - Cloud: Cloudflare AI Gateway → Gemini/Claude/GPT-4o/Groq
  - PHI protection: images NEVER sent to cloud by default
  - Vision analysis prompt builder for clinical image review
  - `analyzeObservation(obs, config)` → { risk, findings, summary }
  - `analyzeWithComparison(obs, config)` → { local, cloud, agreement }

### 2E. AI Gateway Worker Route
- **Create** `apps/worker/src/routes/ai-gateway.ts` (~80 lines)
  - `POST /api/ai/analyze` — Route to Cloudflare AI Gateway
  - Accepts anonymized observation summary (chips, severities, risk — NO images)
  - Optional image pass-through (admin-configurable)
  - Provider selection: gemini | claude | gpt4o | groq
  - Log to `ai_usage` table (model, tokens, latency, cost)
  - Response: `{ risk, findings, summary, confidence, model, latency }`

### 2F. Training Data Pipeline
- **Edit** `apps/worker/src/routes/training.ts` — Enhance:
  - Capture nurse-AI-doctor agreement metrics
  - Jaccard similarity for chip sets
  - Risk level distance (0-1 scale)
  - Export formats: JSONL + CSV
  - `POST /api/training/samples` — Store training sample with agreement scores

**Deliverable:** 7 new shared AI modules + 4 web AI modules + 1 new worker route + 1 enhanced route. ~1,860 lines.

---

## Phase 3: Nurse AI Experience (apps/web + apps/mobile)
**Goal:** AI assists the nurse during screening — chip suggestions, readiness checks, real-time analysis.

### 3A. Device Readiness Check
- **Create** `apps/web/src/components/screening/ReadinessCheck.tsx` (~200 lines)
  - Camera access check (front + rear)
  - Microphone access check
  - Storage space check (warns < 100MB)
  - AI model download status (4 ONNX models via Cache API)
  - Download progress bars with abort
  - Local Ollama status (for doctor mode)
  - Cloud AI Gateway connectivity
  - Role-based: Nurse → hardware+models, Doctor → cloud+storage
  - All checks: `checking` → `ok` | `warning` | `error`

- **Create** `apps/mobile/src/components/ReadinessCheck.tsx` (~150 lines)
  - Camera permission check (expo-camera)
  - Microphone permission check (expo-av)
  - Storage check
  - Network connectivity
  - No ONNX models on mobile (lightweight algorithms only)

### 3B. AI Chip Suggestion Engine
- **Create** `apps/web/src/lib/ai/chip-suggester.ts` (~200 lines)
  - Orchestrates on-device AI models to suggest annotation chips
  - Per-module routing:
    - Vision → photoscreening model → suggest v1-v10 chips
    - Dental/Ear/Throat → ENT classifier → suggest d/e/th chips
    - Skin → clinical-color + segmentation → suggest s1-s16 chips
    - Vitals → anthropometry engine → suggest vt/muac chips
    - Respiratory → audio analysis → suggest r1-r8 chips
    - Cardiac → auscultation analysis → suggest ca1-ca7 chips
    - Hearing → audiometry scoring → suggest hr1-hr7 chips
    - Neuro → neurodevelopment analysis → suggest n1-n21 chips
  - Returns: `{ suggestedChips: string[], confidence: number, findings: string[] }`
  - Chips rendered with dashed borders (nurse confirms/rejects)

### 3C. Screening Results Screen Enhancement
- **Edit** `apps/mobile/src/screens/ModuleScreen.tsx` — Add:
  - After capture → run clinical algorithms (anthropometry, color, audio)
  - Show AI-suggested chips with dashed outline
  - Nurse taps to confirm/reject
  - Both nurse selections AND AI suggestions saved in observation
  - `aiAnnotations: [{ summaryText, confidence, riskCategory, suggestedChips }]`

### 3D. Screening Save State Machine (Mobile)
- **Edit** `apps/mobile/src/screens/ScreeningScreen.tsx` — Enhance:
  - Track `completedModules` per child (Set of moduleType)
  - Green checkmark on completed modules in the grid
  - `allModulesDone = enabledModules.every(m → completedModules.has(m))`
  - Auto-advance to next unscreened module
  - Show progress: "12/27 modules completed"
  - Store `lastSavedModule`, `lastSavedChild`, `lastSavedRisk` for results screen

**Deliverable:** 2 new components + 1 new lib + 2 edited screens. ~550 lines new.

---

## Phase 4: Doctor AI Experience (apps/web)
**Goal:** AI assists the doctor during review — analysis panel, hybrid LLM, comparison mode.

### 4A. AI Analysis Panel
- **Create** `apps/web/src/components/ai/AIAnalysisPanel.tsx` (~250 lines)
  - Triggered by "Ask AI" button on observation review
  - Shows: risk level badge, detected findings with confidence, urgent flags
  - Re-analysis button, latency display
  - Loading state with spinner
  - Error messaging with context-aware help
  - Privacy indicator: "Local only 🔒" or "Cloud ☁️"

### 4B. AI Configuration Panel (Admin)
- **Create** `apps/web/src/components/admin/AIConfigPanel.tsx` (~200 lines)
  - LLM mode selector: local_only | local_first | cloud_first | dual
  - Local model picker: MedGemma 4B, LFM2.5-VL 1.6B, Qwen3.5 4B/9B, LFM2 24B
  - Ollama URL input (default: http://localhost:11434)
  - Cloud provider picker: Gemini | Claude | GPT-4o | Groq
  - Cloudflare AI Gateway URL
  - Toggle: Send images to cloud (default: OFF)
  - ONNX model URLs (MobileSAM encoder/decoder, ENT classifier, photoscreening)
  - Save config to DB (new `org_settings` table or campaign-level metadata)
  - Test connection button (Ollama ping, cloud health check)

### 4C. Doctor Review Enhancement
- **Edit** `apps/web/src/pages/DoctorInbox.tsx` — Add:
  - "Ask AI" button per observation → triggers AIAnalysisPanel
  - AI chip suggestions shown alongside nurse selections (different styling)
  - Side-by-side comparison mode (dual mode: local vs cloud analysis)
  - Training data auto-captured on review submission

### 4D. Admin Settings Page
- **Edit** `apps/web/src/pages/Settings.tsx` — Add:
  - AI Configuration section (renders AIConfigPanel)
  - Only visible to admin role
  - Persists to worker API

### 4E. AI Config Worker Routes
- **Create** `apps/worker/src/routes/ai-config.ts` (~60 lines)
  - `GET /api/settings/ai` — Fetch AI config
  - `PUT /api/settings/ai` — Update AI config (admin only)
  - Stored in campaigns table metadata or new settings table

**Deliverable:** 2 new components + 2 edited pages + 1 new worker route. ~510 lines new.

---

## Phase 5: Clinical Visualizations (apps/web)
**Goal:** Rich clinical charts for child reports and analytics dashboards.

### 5A. Install Recharts
- `pnpm -F @skids/web add recharts`

### 5B. Chart Components
- **Create** `apps/web/src/components/visualizations/GrowthChart.tsx` (~200 lines)
  - Z-score bar with color zones (severely low → severely high)
  - Height/Weight/BMI tabs
  - WHO reference bands
  - Child measurement overlay

- **Create** `apps/web/src/components/visualizations/AudiogramChart.tsx` (~180 lines)
  - LineChart with severity bands (Normal→Profound)
  - Left ear (blue, X) vs right ear (red, O)
  - 4-frequency standard (500, 1000, 2000, 4000 Hz)

- **Create** `apps/web/src/components/visualizations/CardiacChart.tsx` (~120 lines)
  - 4-point auscultation assessment
  - Classification badges per point

- **Create** `apps/web/src/components/visualizations/PulmonaryChart.tsx` (~120 lines)
  - Lung sound analysis display
  - 6-point assessment

- **Create** `apps/web/src/components/visualizations/DentalDiagram.tsx` (~200 lines)
  - SVG tooth map with quadrants
  - Severity-colored positions
  - Pin markers for findings

- **Create** `apps/web/src/components/visualizations/SkinBodyMap.tsx` (~150 lines)
  - Body outline with anatomical regions
  - Lesion location mapping with severity colors

- **Create** `apps/web/src/components/visualizations/VisionDiagram.tsx` (~120 lines)
  - Eye diagram with red reflex indicators
  - Symmetry and acuity display

### 5C. Report Inline Charts
- **Create** `apps/web/src/components/report/ReportCharts.tsx` (~350 lines)
  - `VitalsPercentiles`: Percentile bars with normal range
  - `BehavioralRadar`: Spider chart (attention, social, emotional, motor, language, adaptive)
  - `EvidenceGallery`: Image grid (1/2/3 columns)
  - `ZScoreGauge`: Z-score position with color zones (-4 to +4)
  - `InlineGrowthPanel`: Compact height/weight/BMI gauges
  - `InlineAudiogram`: SVG-based compact audiogram
  - `InlineDentalMap`: SVG tooth map compact
  - `InlineVisionDiagram`: Eye diagram compact
  - `InlineCardiacSummary`: 4-point summary
  - Helpers: `extractVitalsData()`, `extractBehavioralData()`, `MODULE_COLORS`

**Deliverable:** 7 visualization components + 1 report charts module. ~1,440 lines.

---

## Phase 6: Child Reports (apps/web)
**Goal:** Rich, multi-page, print-ready child health report with visualizations and parent education.

### 6A. Child Report Page
- **Create** `apps/web/src/pages/ChildReport.tsx` (~600 lines)
  - Port from V2 `src/components/report/child-report.tsx`
  - **Page 1 — Overview:**
    - Child bio (name, age, gender, class, school, campaign)
    - Risk level badge (All Clear / Review Suggested / Needs Attention)
    - Module stats (total, screened, findings, pending)
    - VitalsPercentiles chart
    - BehavioralRadar chart
    - Key findings summary
  - **Page 2 — Vitals & Growth:**
    - Per-vital cards with Z-score gauges (GrowthChart integration)
    - Classification badges (stunted, underweight, wasted, etc.)
  - **Page 3+ — Head-to-Toe Modules:**
    - Module icon + finding count
    - Evidence image gallery (from R2 URLs)
    - "What We Found" section with condition cards
    - Inline visualization per module (dental→DentalDiagram, hearing→AudiogramChart, etc.)
    - Doctor's note + decision badge
  - **Final Page — Clinical Summary:**
    - Doctor info card
    - Specialist referral recommendations
    - Parent education: per-condition "what it means", "what to do", "when to see doctor"
    - Print button → `@media print` stylesheet
  - Add route: `/campaigns/:code/children/:childId/child-report`

### 6B. 4D Report Enhancement
- **Edit** `apps/web/src/pages/FourDReport.tsx` — Add:
  - Export button (JSON + CSV download)
  - Severity breakdown per condition
  - Per-condition ICD code display
  - Evidence links

### 6C. App.tsx Route
- **Edit** `apps/web/src/App.tsx` — Add child-report route

**Deliverable:** 1 new page + 2 edits. ~600 lines new.

---

## Phase 7: Analytics Dashboard (apps/web)
**Goal:** Full population health analytics with geographic drill-down, demographics, and export.

### 7A. Analytics Components
- **Create** `apps/web/src/components/analytics/ExecutiveSummary.tsx` (~120 lines)
  - Key metrics cards: Children Screened, Completion Rate, Referral Rate, High Risk %
  - Overall health score gauge

- **Create** `apps/web/src/components/analytics/CohortAnalyticsPanel.tsx` (~250 lines)
  - Risk distribution pie chart (Recharts PieChart)
  - Module completion horizontal bars
  - 4D category breakdown with progress bars
  - Top conditions list with severity

- **Create** `apps/web/src/components/analytics/PrevalenceReport.tsx` (~150 lines)
  - Condition prevalence table (sortable)
  - Category prevalence section
  - Severity breakdown per condition

- **Create** `apps/web/src/components/analytics/DemographicBreakdown.tsx` (~150 lines)
  - Gender distribution chart
  - Age group distribution
  - Condition × gender cross-tab
  - Condition × age cross-tab

- **Create** `apps/web/src/components/analytics/GeographicDrillDown.tsx` (~200 lines)
  - Hierarchical tree: Country → State → District → City → School
  - Risk distribution per node
  - Click to drill down
  - Breadcrumb navigation

- **Create** `apps/web/src/components/analytics/SubcohortComparison.tsx` (~150 lines)
  - Side-by-side cohort comparison (gender/age/class/location)
  - Completion rates, referral rates, top conditions per cohort

### 7B. Rebuild Analytics Page
- **Rewrite** `apps/web/src/pages/Analytics.tsx` (~300 lines)
  - Tab layout: Overview | Cohort | Prevalence | Demographics | Geographic | Export
  - Each tab renders corresponding analytics component
  - Campaign multi-selector (same as AuthorityDashboard)
  - Uses `computeCohortAnalytics()`, `computePopulationSummary()`, `buildGeoHierarchy()`

### 7C. Authority Dashboard Enhancement
- **Edit** `apps/web/src/pages/AuthorityDashboard.tsx` — Add:
  - Pipeline visualization (5 stages)
  - Module progress bars
  - Nurse activity table
  - Export buttons (CSV, JSON, PDF)
  - Geographic drill-down integration

### 7D. Export Route
- **Create** `apps/worker/src/routes/export.ts` (~100 lines)
  - `GET /api/campaigns/:code/export/csv` — Full campaign CSV export
  - `GET /api/campaigns/:code/export/json` — Full campaign JSON export
  - `GET /api/campaigns/:code/export/report` — Child-level report data
  - Server-side data aggregation for large campaigns

**Deliverable:** 6 new components + 1 rewritten page + 1 edited page + 1 new worker route. ~1,420 lines.

---

## Phase 8: Campaign Location + Parallel Screening (apps/worker + apps/web + apps/mobile)
**Goal:** Location hierarchy in campaigns, real-time multi-device awareness.

### 8A. Campaign Location Schema
- **Edit** `packages/db/src/schema.sql` — Add columns to campaigns:
  - `country TEXT`, `district TEXT`, `pincode TEXT`, `address TEXT`
  - `latitude REAL`, `longitude REAL`
  - Already has: city, state

### 8B. Campaign Create with Location
- **Edit** `apps/web/src/pages/Campaigns.tsx` — Enhance create modal:
  - Country, State, District, City, Pincode, Address fields
  - GPS coordinates capture (navigator.geolocation)
  - Location auto-fill from pincode (optional)

- **Edit** `apps/mobile/src/screens/CampaignsScreen.tsx` — Same for mobile create flow

### 8C. Campaign Progress API
- **Create** `apps/worker/src/routes/campaign-progress.ts` (~80 lines)
  - `GET /api/campaigns/:code/progress` — Returns full CampaignProgress
  - Computed from children + observations + reviews on server
  - Pipeline stages, nurse activity, module progress, review breakdown
  - Supports polling (If-None-Match / ETag caching)

### 8D. Parallel Screening Awareness (SSE or Polling)
- **Create** `apps/worker/src/routes/screening-events.ts` (~60 lines)
  - `GET /api/campaigns/:code/events` — Server-Sent Events stream
  - Broadcasts: new observation (moduleType, childId, nurseName)
  - Alternative: simple polling endpoint with `last_sync_id` cursor
  - Returns: `{ newObservations: number, newReviews: number, lastUpdate: timestamp }`

- **Edit** `apps/mobile/src/components/SyncStatusBar.tsx` — Add:
  - Poll `/api/campaigns/:code/events` every 30s when online
  - Show: "Nurse Priya screened 3 more children" notifications
  - Update module completion badges in real-time

- **Edit** `apps/web/src/pages/CampaignDetail.tsx` — Add:
  - Real-time observation count updates
  - Module completion progress bars
  - Active nurse indicators

**Deliverable:** 2 new worker routes + 4 edits. ~140 lines new + edits.

---

## Phase 9: Parent Access (apps/web)
**Goal:** Parent-friendly child report view, QR code access, education content.

### 9A. Parent Report Page (Public, Token-Protected)
- **Create** `apps/web/src/pages/ParentReport.tsx` (~400 lines)
  - Accessible via `/report/:token` (no login required)
  - Token = one-time or time-limited link generated by doctor/admin
  - Renders simplified ChildReport focused on:
    - Child overview (name, age, school)
    - Module-by-module results in parent-friendly language
    - Condition education: "What was checked", "What we found", "What to do"
    - Growth charts (height/weight percentiles)
    - Specialist referral recommendations
    - Prevention tips
    - NO raw clinical data (no chips, no ICD codes)
  - Print-friendly, mobile-optimized

### 9B. Report Token Generation
- **Create** `apps/worker/src/routes/report-tokens.ts` (~60 lines)
  - `POST /api/reports/generate-link` — Generate time-limited token
  - `GET /api/reports/:token` — Validate token, return child report data
  - Token: `base64(childId + campaignCode + expiry + hmac)`
  - Expiry: 30 days default
  - Rate limited

### 9C. QR Code Generation
- **Edit** `apps/web/src/pages/ChildReport.tsx` — Add:
  - QR code with parent report URL (using qrcode library)
  - "Share with parent" button → generates link + QR
  - Print QR on report footer

### 9D. Routes
- **Edit** `apps/web/src/App.tsx` — Add:
  - `/report/:token` → ParentReport (public, no auth)

**Deliverable:** 1 new page + 1 new worker route + 2 edits. ~460 lines new.

---

## Phase 10: Observability & System Health (apps/worker)
**Goal:** AI usage tracking, error monitoring, system health dashboard.

### 10A. AI Usage Analytics
- **ai_usage table already exists** — Enhance usage:
  - Log every LLM call (model, provider, tokens, latency, cost)
  - Log every ONNX inference (model, latency, device)
  - `GET /api/admin/ai-usage` — Usage stats endpoint (admin only)
  - Aggregate: total cost, avg latency, calls per model, calls per campaign

### 10B. System Health Dashboard
- **Edit** `apps/worker/src/routes/health.ts` — Enhance:
  - `GET /api/health/detailed` — Extended health check (admin only)
  - DB connection + query latency
  - R2 bucket accessibility
  - AI Gateway reachability (if configured)
  - Ollama status (if configured)
  - Worker CPU/memory metrics (from cf headers)

### 10C. Admin Dashboard Widget
- **Edit** `apps/web/src/pages/Settings.tsx` — Add:
  - System health section (admin only)
  - AI usage charts (calls/day, cost/day, latency distribution)
  - Error rates

### 10D. Cloudflare AI Gateway Analytics
- Cloudflare AI Gateway provides built-in analytics dashboard at `dash.cloudflare.com`
- No custom code needed — just configure AI Gateway URL in admin settings
- Captures: requests, tokens, latency, errors, cost per provider
- This replaces the need for Langfuse for LLM observability

**Deliverable:** 1 enhanced route + 2 edits. ~100 lines new.

---

## Implementation Order & Dependencies

```
Phase 1 (Shared Libraries) ──────── No dependencies, pure functions
  ↓
Phase 2 (AI Infrastructure) ─────── Depends on Phase 1 types
  ↓
Phase 3 (Nurse AI) ──────────────── Depends on Phase 2 models
Phase 4 (Doctor AI) ─────────────── Depends on Phase 2 LLM gateway
Phase 5 (Visualizations) ────────── Depends on Phase 1 analytics types
  ↓
Phase 6 (Child Reports) ─────────── Depends on Phase 5 charts + Phase 1 education
Phase 7 (Analytics Dashboard) ───── Depends on Phase 5 charts + Phase 1 analytics
  ↓
Phase 8 (Location + Parallel) ───── Depends on Phase 1 progress engine
Phase 9 (Parent Access) ─────────── Depends on Phase 6 child reports
Phase 10 (Observability) ────────── Depends on Phase 2 AI gateway
```

**Parallelizable groups:**
- Phase 3 + Phase 4 + Phase 5 (after Phase 2)
- Phase 6 + Phase 7 (after Phase 5)
- Phase 8 + Phase 9 + Phase 10 (after earlier phases)

## Estimated New Code
| Phase | New Lines | New Files | Edits |
|-------|-----------|-----------|-------|
| 1. Shared Libraries | ~1,850 | 5 | 2 |
| 2. AI Infrastructure | ~1,860 | 12 | 1 |
| 3. Nurse AI | ~550 | 3 | 2 |
| 4. Doctor AI | ~510 | 3 | 2 |
| 5. Visualizations | ~1,440 | 8 | 0 |
| 6. Child Reports | ~600 | 1 | 2 |
| 7. Analytics Dashboard | ~1,420 | 7 | 1 |
| 8. Location + Parallel | ~140 | 2 | 4 |
| 9. Parent Access | ~460 | 2 | 2 |
| 10. Observability | ~100 | 0 | 3 |
| **Total** | **~8,930** | **43** | **19** |
