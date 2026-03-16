# SKIDS Screen V3 — Production Verification Spec

> **SINGLE SOURCE OF TRUTH** for what features exist and whether they actually work.

```
# RULES FOR EVERY SESSION
1. Before claiming ANY feature is "done", check this spec
2. "Build passes" is NOT verification — mark as BUILD_PASSES only
3. Only mark VERIFIED_ON_DEVICE after APK tested on real Android device
4. Update the "Last verified" date when testing
5. If you add a new feature, add it to this spec FIRST
6. AI status must trace from SCREEN -> FUNCTION CALL -> actual execution
```

---

## Table of Contents

1. [LoginScreen](#1-loginscreen)
2. [CampaignsScreen](#2-campaignsscreen)
3. [CampaignDetailScreen](#3-campaigndetailscreen)
4. [RegisterChildScreen](#4-registerchildscreen)
5. [ScreeningScreen](#5-screeningscreen)
6. [ModuleScreen](#6-modulescreen)
7. [QuickVitalsScreen](#7-quickvitalsscreen)
8. [BatchSummaryScreen](#8-batchsummaryscreen)
9. [ObservationListScreen](#9-observationlistscreen)
10. [DoctorReviewScreen](#10-doctorreviewscreen)
11. [ProfileScreen](#11-profilescreen)
12. [AI Module Inventory](#ai-module-inventory)

---

## 1. LoginScreen

- **File**: `apps/mobile/src/screens/LoginScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| SKIDS logo image | Image | YES | `logoImage` 180x120 |
| Brand subtitle | Text | YES | Below logo |
| Org code input | TextInput | YES | Persisted to AsyncStorage key `@skids/last-org-code` |
| Org code label | Text | YES | "Organization Code" |
| PIN dots (6 max) | View (dots) | YES | Animated shake on failure |
| PIN keypad (0-9, CLR, backspace) | TouchableOpacity grid | YES | `PIN_KEYS` array, 3x4 grid |
| Sign In button (PIN) | TouchableOpacity | YES | Disabled if PIN < 4 digits or loading |
| "Use Email Login" toggle | TouchableOpacity | YES | Toggles `showEmailLogin` state |
| Email input | TextInput | YES | Shown when email login expanded |
| Password input | TextInput | YES | With show/hide toggle |
| Show password toggle | TouchableOpacity | YES | Eye icon toggle |
| Email Sign In button | TouchableOpacity | YES | Calls `handleEmailLogin` |
| Loading spinner | ActivityIndicator | YES | During auth calls |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| LoginScreen | CampaignsScreen (MainTabs) | Successful login (auth state change) |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `/api/auth/sign-in/pin` | POST | PIN login via `loginWithPin(pin, orgCode)` from AuthContext |
| `/api/auth/sign-in/email` | POST | Email login via `login(email, password)` from AuthContext |

### AI Integration: `NOT_NEEDED`

---

## 2. CampaignsScreen

- **File**: `apps/mobile/src/screens/CampaignsScreen.tsx`
- **Also exported as**: `HomeScreen` via `apps/mobile/src/screens/HomeScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Header with "SKIDS screen" branding | View + Text | YES | Bold/light split |
| Greeting subtitle | Text | YES | "Welcome, {firstName}" |
| User pill (avatar + name + role) | View | YES | Top-right of header, shows initial, name, role |
| Campaign cards (FlatList) | FlatList | YES | Card per campaign |
| Campaign name | Text | YES | In card header |
| Status badge | View + Text | YES | Color-coded: active/completed/archived/paused |
| School name | Text | YES | With school emoji icon |
| Location | Text | YES | City/state/country or schoolName fallback |
| Children count | Text | YES | Number + "Children" label |
| Chevron (">" ) | Text | YES | Right side of card footer |
| Pull-to-refresh | RefreshControl | YES | `onRefresh` triggers `fetchCampaigns` |
| Loading spinner | ActivityIndicator | YES | On initial load |
| Empty state | View | YES | Clipboard emoji + "No campaigns yet" |
| FAB (floating action button) | -- | **NO** | Intentionally absent, no FAB |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| CampaignsScreen | CampaignDetailScreen | Tap campaign card |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `GET /api/campaigns` | GET | On mount + pull-to-refresh |

### AI Integration: `NOT_NEEDED`

---

## 3. CampaignDetailScreen

- **File**: `apps/mobile/src/screens/CampaignDetailScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Campaign name | Text | YES | Large title |
| Status badge | View | YES | Color-coded |
| Code meta | Text | YES | Campaign code |
| School name meta | Text | YES | |
| Location meta | Text | YES | |
| Stats cards (3) | View | YES | Children count, Observations count, Reviews count |
| "Register Child" action button | TouchableOpacity | YES | Green tint |
| "Start Screening" action button | TouchableOpacity | YES | Blue tint |
| "View Results" action button | TouchableOpacity | YES | Amber tint, navigates to ObservationList |
| "Device Check" action button | TouchableOpacity | YES | Purple tint, opens ReadinessCheck modal |
| Child search bar | TextInput | YES | Search by name, class, admission# |
| Search clear button | TouchableOpacity | YES | "X" when search has text |
| Search result count | Text | YES | "{filtered} of {total} children" |
| Children list (max 50 rendered) | View (map) | YES | Not FlatList, uses `.slice(0, 50).map()` |
| Child card (avatar, name, status badge, meta, progress bar) | View | YES | Per child |
| Child progress bar | View | YES | Colored fill based on modules completed |
| Pull-to-refresh | RefreshControl | YES | On ScrollView |
| Device Readiness modal | Modal | YES | Contains `ReadinessCheck` component |
| Readiness close button | TouchableOpacity | YES | "Close" text |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| CampaignDetailScreen | RegisterChildScreen | "Register Child" button, passes `campaignCode` |
| CampaignDetailScreen | ScreeningScreen | "Start Screening" button, passes `campaignCode` |
| CampaignDetailScreen | ObservationListScreen | "View Results" button, passes `campaignCode` + `campaignName` |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `GET /api/campaigns/{code}/children` | GET | On mount + refresh |
| `GET /api/campaigns/{code}/stats` | GET | On mount + refresh |
| `GET /api/observations?campaign_code={code}` | GET | On mount + refresh (for module completion map) |

### AI Integration: `NOT_NEEDED`

---

## 4. RegisterChildScreen

- **File**: `apps/mobile/src/screens/RegisterChildScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Campaign badge | View | YES | Shows campaign code |
| "Register Child" form title | Text | YES | |
| Form subtitle | Text | YES | "Enter the child's details for screening" |
| Name input (required) | TextInput | YES | autoCapitalize="words" |
| Date of Birth input | TextInput | YES | Placeholder "YYYY-MM-DD" |
| Gender selector (Male/Female) | TouchableOpacity x2 | YES | Highlighted when selected |
| Class input | TextInput | YES | e.g. "5" |
| Section input | TextInput | YES | e.g. "A", autoCapitalize="characters" |
| Admission Number input | TextInput | YES | |
| Parent/Guardian Name input | TextInput | YES | |
| Parent Phone input | TextInput | YES | keyboardType="phone-pad" |
| "Register Child" save button | TouchableOpacity | YES | Disabled when saving or no name/gender |
| Loading spinner | ActivityIndicator | YES | In save button when saving |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| RegisterChildScreen | Back (goBack) | Successful save |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `POST /api/children` | POST | On save, body: `{name, dob, gender, parentName, parentPhone, class, section, admissionNumber, campaignCode}` |

### Validation Rules

- Name: required (alert if empty)
- Gender: required (alert if not selected)
- All other fields: optional
- DOB format: not validated (raw string)

### AI Integration: `NOT_NEEDED`

---

## 5. ScreeningScreen

- **File**: `apps/mobile/src/screens/ScreeningScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Header "SKIDS screen" | Text | YES | Bold/light brand |
| Nurse name subtitle | Text | YES | "Nurse: {name}" |
| Module count badge | View | YES | "{N} modules" top-right |
| SyncStatusBar component | Component | YES | Pending count, syncing state, last sync, sync button |
| Child selector bar | View | YES | Shows when campaignCode present |
| Child search input | TextInput | YES | In child selector |
| Child chip list (horizontal FlatList) | FlatList | YES | Scrollable chips with avatar + name |
| Selected child highlight | View | YES | Blue border on selected chip |
| Progress header | View | YES | "{completed}/{total} modules completed" + progress bar |
| Module grid (SectionList) | SectionList | YES | Grouped by category |
| Section headers ("Vitals & Measurements", "Head-to-Toe Examination") | Text | YES | Group labels |
| Module cards (3 per row) | TouchableOpacity | YES | Emoji icon, name, duration, color |
| Completed badge (checkmark) | View | YES | Green overlay on completed modules |
| "Start Full Screening" button | TouchableOpacity | YES | Batch mode, shown when child selected |
| Readiness check modal | Modal | YES | `ReadinessCheck` component before batch start |
| Network status check | useEffect interval | YES | 30-second ping to google 204 endpoint |

### Module Count: **27 modules** (7 vitals + 20 head-to-toe)

Full module list:
- **Vitals (7)**: height, weight, vitals, spo2, hemoglobin, bp, muac
- **Head-to-Toe (20)**: general_appearance, hair, eyes_external, vision, ear, hearing, nose, dental, throat, neck, respiratory, abdomen, skin, musculoskeletal, neurological, lymph_nodes, developmental, behavioral, pulmonary, intervention (+ nutrition_intake if present)

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| ScreeningScreen | ModuleScreen | Tap individual module card |
| ScreeningScreen | ModuleScreen (batch) | "Start Full Screening" -> ReadinessCheck -> first uncompleted module |
| ScreeningScreen | QuickVitalsScreen | (via ModuleScreen or direct nav if configured) |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `GET /api/campaigns/{code}/children` | GET | On mount when campaignCode present |
| `GET /api/observations?campaign_code={code}&child_id={id}` | GET | On focus (useFocusEffect) to refresh completed modules |

### AI Integration: `NOT_NEEDED`

---

## 6. ModuleScreen

- **File**: `apps/mobile/src/screens/ModuleScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Module header (icon, name, description) | View | YES | Emoji icon from config, colored background |
| Capture type label | Text | YES | "Photo Capture" / "Video Capture" / etc. |
| Child info bar | View | YES | When childId provided: name, age, gender |
| Batch progress indicator | View | YES | "{index+1} of {total}" when in batch mode |
| **Photo capture**: Camera button | TouchableOpacity | YES | Uses `expo-image-picker` launchCameraAsync |
| **Video capture**: Record button | TouchableOpacity | YES | Uses `expo-image-picker` with `mediaTypes: ['videos']`, 30s max |
| **Audio capture**: Record/Stop buttons | TouchableOpacity | YES | Uses `expo-av` Audio.Recording |
| Audio duration timer | Text | YES | Seconds counter during recording |
| **Value capture**: TextInput | TextInput | YES | Numeric keyboard, with unit label |
| **Form capture**: (placeholder) | -- | PARTIAL | Treated same as value capture |
| Captured image preview | Image | YES | Shows `capturedUri` |
| Retake button | TouchableOpacity | YES | Clears captured media |
| Notes input | TextInput | YES | Multiline, optional |
| AnnotationChips component | Component | YES | Module-specific chips from `getChipsForModule()` |
| Chip severity selector | -- | YES | Per-chip severity via `chipSeverities` state |
| AIResultCard component | Component | YES | Shows AI analysis results |
| Quality feedback display | View | YES | From CameraCapture component |
| "Save Observation" button | TouchableOpacity | YES | |
| Success feedback ("online"/"offline") | View | YES | Flash after save |
| Batch "Next Module" auto-advance | Logic | YES | After save in batch mode, navigates to next module |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| ModuleScreen | Back (goBack) | Save success (non-batch) |
| ModuleScreen | ModuleScreen (next) | Save success in batch mode, advances to next module |
| ModuleScreen | BatchSummaryScreen | Save success on last batch module |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `POST /api/observations` | POST | On save. Falls back to offline sync queue on failure |

### AI Integration: `WIRED`

| AI Function | Source File | Call Site | Status |
|-------------|------------|-----------|--------|
| `runLocalAI(moduleType, value, childContext)` | `lib/ai-engine.ts` | Line ~188, for value-type modules (height, weight, spo2, hb, muac, bp) | `WIRED_TO_SCREEN` |
| `buildVisionPrompt(moduleType, moduleName, childAge, guidance)` | `lib/ai/llm-gateway.ts` | Line ~259, for photo/video modules after capture | `WIRED_TO_SCREEN` |
| `queryLLM(config, messagesWithImage)` | `lib/ai/llm-gateway.ts` | Line ~275, sends image+prompt to Ollama/cloud for analysis | `WIRED_TO_SCREEN` |
| `parseVisionAnalysis(responseText)` | `lib/ai/llm-gateway.ts` | After LLM response, extracts structured findings | `WIRED_TO_SCREEN` |
| `runQualityGate` (imported) | `lib/ai/quality-gate.ts` | Imported but quality gate functions need pixel data (Uint8Array) — **not called with real pixels from camera** | `IMPORTED_NOT_EXECUTED` |
| `visionQualityGate`, `dentalQualityGate`, `skinQualityGate`, `earQualityGate`, `generalQualityGate` | `lib/ai/quality-gate.ts` | Imported but same issue — no pixel extraction pipeline | `IMPORTED_NOT_EXECUTED` |

**Key gap**: Quality gate functions are imported and state variables exist (`qualityGateResult`, `qualityFeedback`), but there is no code path that extracts raw pixel data from the captured image to pass to these functions. The quality gate is effectively a pass-through.

---

## 7. QuickVitalsScreen

- **File**: `apps/mobile/src/screens/QuickVitalsScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Child info header | View | YES | Avatar initial, name, age display, gender, age in months |
| AI Engine status bar | View | YES | Green dot + "AI Engine Active - WHO Growth Standards" |
| "Anthropometry" section header | Text | YES | "Growth measurements" hint |
| Height field (cm) | TextInput + AI badge | YES | With inline AI classification |
| Weight field (kg) | TextInput + AI badge | YES | With inline AI classification |
| MUAC field (cm) | TextInput + AI badge | YES | Only shown if child < 60 months (`maxAge: 60`) |
| "Clinical Vitals" section header | Text | YES | "Lab & device readings" hint |
| SpO2 field (%) | TextInput + AI badge | YES | |
| Hemoglobin field (g/dL) | TextInput + AI badge | YES | |
| Blood Pressure field (mmHg) | TextInput + AI badge | YES | Only shown if child >= 60 months (`minAge: 60`) |
| AI classification badge per field | View | YES | Color-coded: Normal (green), Elevated/MAM (amber), SAM/Stage 2 HTN (red) |
| AI Summary card | View | YES | Shows normal count + flagged findings |
| "Detailed Entry" link | TouchableOpacity | YES | Navigates to ModuleScreen for first module |
| Fixed "Save All Vitals" button | TouchableOpacity | YES | Bottom bar, disabled when no values entered or saving |
| Save count indicator | Text | YES | "{N} measurements" in button |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| QuickVitalsScreen | Back (goBack) | Successful save |
| QuickVitalsScreen | ModuleScreen | "Detailed Entry" link, for first vital module |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `POST /api/observations` | POST | Per field, iterates filled fields. Falls back to offline sync queue on failure |

### AI Integration: `WIRED`

| AI Function | Source File | Call Site | Status |
|-------------|------------|-----------|--------|
| `runLocalAI(moduleType, value, childContext)` | `lib/ai-engine.ts` | `handleValueChange` — runs on every value change with debounce-like behavior | `WIRED_TO_SCREEN` |
| `getNormalRange(moduleType, ageMonths, gender)` | `lib/normal-ranges.ts` | Used alongside AI for range display | `WIRED_TO_SCREEN` |

AI runs **locally in real-time** for all 6 fields using WHO z-score tables. No LLM or cloud calls.

---

## 8. BatchSummaryScreen

- **File**: `apps/mobile/src/screens/BatchSummaryScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Child name header | Text | YES | "Screening Complete for {childName}" |
| Stats row (3 cards) | View | YES | Total modules, Normal count, Needs Review count |
| Normal stat card (green) | View | YES | Count with checkmark |
| Review stat card (amber) | View | YES | Count for review+attention |
| Attention stat card (red) | View | YES | Count for attention-only |
| "All Clear" banner | View | YES | Shown when no findings, green background |
| Findings cards | View (map) | YES | Per module with findings, colored by risk |
| Module emoji icon per finding | Text | YES | From MODULE_EMOJI map |
| Finding chips | Text | YES | Rendered from `batchResults[].findings[]` |
| Risk badge per finding | View | YES | "Review" / "Needs Attention" |
| "Return to Screening" button | TouchableOpacity | YES | Navigates back (popToTop or goBack) |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| BatchSummaryScreen | Back (goBack / popToTop) | "Return to Screening" button |

### API Calls

None. This screen only displays data passed via route params (`completedModules` and `batchResults` as JSON strings).

### AI Integration: `NOT_NEEDED`

Data displayed is the result of AI that ran on ModuleScreen during batch mode.

---

## 9. ObservationListScreen

- **File**: `apps/mobile/src/screens/ObservationListScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Campaign info header | View | YES | Campaign name + observation count |
| Observation cards (FlatList) | FlatList | YES | One card per observation |
| Module icon (colored circle with letter) | View | YES | First char of module name, background from config color |
| Module name | Text | YES | |
| Observation date | Text | YES | `toLocaleDateString()` |
| Review status badge | View | YES | Color-coded: pending/approved/referred/follow_up/retake |
| Child name | Text | YES | If present on observation |
| Pull-to-refresh | RefreshControl | YES | |
| Loading spinner | ActivityIndicator | YES | On initial load |
| Empty state | View | YES | Magnifying glass emoji + "No observations yet" |
| **Status filter tabs** | -- | **NO** | No filter UI exists. All observations shown in one flat list |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| ObservationListScreen | DoctorReviewScreen | Tap observation card, passes full observation object |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `GET /api/observations?campaign_code={code}` | GET | On mount + pull-to-refresh |

### AI Integration: `NOT_NEEDED`

**NOTE**: Despite the user's request listing "status filters", the ObservationListScreen does **NOT** have filter tabs. It shows all observations in a single unfiltered list.

---

## 10. DoctorReviewScreen

- **File**: `apps/mobile/src/screens/DoctorReviewScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Observation info card | View | YES | Module icon, name, description |
| Meta grid | View | YES | Date, Capture Type, Campaign code |
| Nurse notes display | View | YES | If observation.notes present |
| "Ask AI for Clinical Summary" button | TouchableOpacity | YES | Brain emoji, triggers `handleAskAi` |
| AI loading spinner | ActivityIndicator | YES | While LLM processing |
| "Re-analyze with AI" (after first result) | TouchableOpacity | YES | Same button, text changes |
| AI Clinical Summary result | View | YES | Purple-tinted card with AI text |
| AI error display | View | YES | Error text + hint about Ollama |
| Decision grid (5 buttons) | TouchableOpacity x5 | YES | approve, refer, follow_up, discharge, retake |
| Decision highlight | View | YES | Border + background tint on selected |
| Retake reason input | TextInput | YES | Only shown when decision=retake, required |
| Quality rating selector (3 options) | TouchableOpacity x3 | YES | Good, Fair, Poor |
| Additional notes input | TextInput | YES | Multiline, optional |
| "Submit Review" button | TouchableOpacity | YES | Disabled when no decision selected |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| DoctorReviewScreen | Back (goBack) | Successful review submission |

### API Calls

| Endpoint | Method | When |
|----------|--------|------|
| `POST /api/reviews` | POST | On submit, body: `{observationId, decision, qualityRating, notes, retakeReason, clinicianId, clinicianName, timestamp}` |

### AI Integration: `WIRED`

| AI Function | Source File | Call Site | Status |
|-------------|------------|-----------|--------|
| `buildClinicalPrompt(childName, ageStr, observations)` | `lib/ai/llm-gateway.ts` | `handleAskAi` callback | `WIRED_TO_SCREEN` |
| `queryLLM(DEFAULT_LLM_CONFIG, messages)` | `lib/ai/llm-gateway.ts` | `handleAskAi` callback | `WIRED_TO_SCREEN` |

LLM is called via Ollama (local) or cloud gateway. Requires Ollama running with configured model, or cloud API key.

---

## 11. ProfileScreen

- **File**: `apps/mobile/src/screens/ProfileScreen.tsx`
- **Verification**: `UNTESTED`
- **Last verified**: never

### UI Elements

| Element | Type | Present | Notes |
|---------|------|---------|-------|
| Header "SKIDS screen" + "Profile" | View | YES | |
| User card (avatar circle, name, email, role badge) | View | YES | Initials in circle |
| AI Status card | View | YES | Shows Ollama connection status |
| AI status indicator (green/red dot) | View | YES | Green = connected, Red = unavailable |
| AI model name | Text | YES | Shows configured model name |
| AI error text | Text | YES | When connection fails |
| "Re-check AI" button | TouchableOpacity | YES | Reruns `checkOllamaStatus` |
| App info card | View | YES | Version, platform info |
| "Sign Out" button | TouchableOpacity | YES | Red, triggers confirmation Alert |
| Sign out confirmation dialog | Alert | YES | "Cancel" / "Sign Out (destructive)" |

### Navigation Paths

| From | To | Trigger |
|------|----|---------|
| ProfileScreen | LoginScreen | Logout (auth state change) |

### API Calls

None from ProfileScreen directly. Logout is handled by AuthContext.

### AI Integration: `WIRED` (status check only)

| AI Function | Source File | Call Site | Status |
|-------------|------------|-----------|--------|
| `checkOllamaStatus(ollamaUrl, ollamaModel)` | `lib/ai/llm-gateway.ts` | `useEffect` on mount + "Re-check AI" button | `WIRED_TO_SCREEN` |

---

## Navigation Architecture

### Tab Structure (from `App.tsx`)

```
MainTabs (Bottom Tab Navigator)
  |-- Home Tab -> HomeStack
  |     |-- Campaigns (CampaignsScreen, headerShown: false)
  |     |-- CampaignDetail
  |     |-- RegisterChild
  |     |-- Screening
  |     |-- Module
  |     |-- QuickVitals
  |     |-- ObservationList
  |     |-- BatchSummary
  |     |-- DoctorReview
  |
  |-- Screening Tab -> ScreeningStack (nurses/doctors/admin/ops_manager only)
  |     |-- ScreeningTab (ScreeningScreen, headerShown: false)
  |     |-- Module
  |     |-- QuickVitals
  |     |-- BatchSummary
  |
  |-- Profile Tab -> ProfileScreen
```

Auth flow: `AuthStack (Login)` shown when not authenticated, `MainTabs` when authenticated.

---

## AI Module Inventory

### Tier 1: WIRED TO SCREENS (actually called from UI)

| File | Function | Called From | What It Does | Dependencies |
|------|----------|-------------|--------------|--------------|
| `lib/ai-engine.ts` | `runLocalAI(moduleType, value, childContext)` | ModuleScreen (line ~188), QuickVitalsScreen (handleValueChange) | WHO z-score classification for height, weight, spo2, hemoglobin, muac, bp | None (pure math) |
| `lib/ai/llm-gateway.ts` | `queryLLM(config, messages)` | ModuleScreen (line ~275, image analysis), DoctorReviewScreen (AI summary) | Multi-provider LLM routing: Ollama local, Gemini, Claude, GPT-4o, Groq cloud | Ollama server OR cloud API key |
| `lib/ai/llm-gateway.ts` | `buildVisionPrompt(moduleType, moduleName, childAge, guidance)` | ModuleScreen (line ~259) | Constructs vision analysis prompt for photo/video modules | None (pure function) |
| `lib/ai/llm-gateway.ts` | `parseVisionAnalysis(responseText)` | ModuleScreen (after LLM response) | Extracts structured findings from LLM text response | None (pure function) |
| `lib/ai/llm-gateway.ts` | `buildClinicalPrompt(childName, ageStr, observations)` | DoctorReviewScreen (handleAskAi) | Constructs clinical summary prompt from observation data | None (pure function) |
| `lib/ai/llm-gateway.ts` | `checkOllamaStatus(url, model)` | ProfileScreen (useEffect + button) | Pings Ollama server to check availability and models | Network access to Ollama |
| `lib/ai/llm-gateway.ts` | `loadLLMConfig()` | ModuleScreen (on mount) | Loads LLM config from AsyncStorage | AsyncStorage |
| `lib/ai/llm-gateway.ts` | `DEFAULT_LLM_CONFIG` | ModuleScreen, DoctorReviewScreen, ProfileScreen | Default config: ollama at localhost:11434, model "llava" | None (constant) |

### Tier 2: IMPORTED BUT NOT EXECUTED (quality gate gap)

| File | Function | Imported By | Why Not Executed | What's Missing |
|------|----------|-------------|-----------------|----------------|
| `lib/ai/quality-gate.ts` | `runQualityGate(pixels, w, h, options)` | ModuleScreen | No pixel extraction from captured images | Need `expo-image-manipulator` or canvas to get Uint8Array from image URI |
| `lib/ai/quality-gate.ts` | `visionQualityGate(pixels, w, h)` | ModuleScreen | Same as above | Same |
| `lib/ai/quality-gate.ts` | `dentalQualityGate(pixels, w, h)` | ModuleScreen | Same as above | Same |
| `lib/ai/quality-gate.ts` | `skinQualityGate(pixels, w, h)` | ModuleScreen | Same as above | Same |
| `lib/ai/quality-gate.ts` | `earQualityGate(pixels, w, h)` | ModuleScreen | Same as above | Same |
| `lib/ai/quality-gate.ts` | `generalQualityGate(pixels, w, h)` | ModuleScreen | Same as above | Same |

### Tier 3: LOGIC EXISTS (not called from any screen)

| File | Function(s) | What It Does | Dependencies Needed |
|------|-------------|--------------|-------------------|
| `lib/ai/vision-screening.ts` | `analyzeRedReflex()`, `analyzePhotoscreening()` | Red reflex analysis, photoscreening for strabismus/refractive error | Raw pixel data (Uint8Array) |
| `lib/ai/ear-analysis.ts` | `analyzeEarImage()` | Tympanic membrane inflammation detection | Raw pixel data |
| `lib/ai/skin-analysis.ts` | `segmentWound()` | Wound area segmentation | Raw pixel data |
| `lib/ai/clinical-color.ts` | `analyzeClinicalColors()`, `mapSuggestionsToChipIds()` | HSV/LAB color analysis for pallor, cyanosis, jaundice, erythema | Raw pixel data |
| `lib/ai/pipeline.ts` | `runPipeline()`, `mergeFindings()`, `computeOverallRisk()` | Three-tier ensemble orchestrator | All tier-specific AI functions + pixel data |
| `lib/ai/mchat-scoring.ts` | `scoreMChat()`, `mchatToFeatures()` | M-CHAT-R/F autism screening (16-30 months) | No M-CHAT questionnaire screen exists |
| `lib/ai/behavioral-assessment.ts` | `BEHAVIORAL_TASKS`, `generateBehavioralAssessment()`, `getTasksForAge()` | Autism behavioral observation protocol | No behavioral assessment screen exists |
| `lib/ai/motor-assessment.ts` | Motor scoring functions | Motor milestone assessment | No motor assessment screen exists |
| `lib/ai/motor-tasks.ts` | Motor task definitions | Task definitions for motor screening | No motor screen exists |
| `lib/ai/pose-estimation.ts` | `estimatePose()` | Skeletal pose estimation from camera | Camera stream + ONNX model |
| `lib/ai/neurodevelopment.ts` | `analyzeGazeStability()`, `extractFacePosition()`, `computeNeuroResults()` | Gaze tracking, engagement analysis | Camera stream + ML Kit face detection |
| `lib/ai/rppg.ts` | `extractFaceSignalFromPixels()`, `computeHeartRateCHROM()` | Contactless heart rate from video | Camera stream + continuous frame extraction |
| `lib/ai/audiometry.ts` | `classifyHearingLoss()`, `generateAudiometryResult()`, `suggestHearingChips()`, etc. | Pure-tone audiometry hearing screening | Audio hardware (earphones + calibrated output) |
| `lib/ai/audio-analysis.ts` | `extractAudioFeatures()`, `classifyCough()` | Cough/respiratory sound classification | Audio capture + feature extraction |
| `lib/ai/ocr-engine.ts` | `extractFromDevice()`, `recognizeText()` | OCR text recognition from device displays | ML Kit text recognition |
| `lib/ai/model-loader-mobile.ts` | `loadModel()`, `runInference()`, `preprocessPixels()` | ONNX/TFLite on-device model loading | Model URLs not configured, no models deployed |

### Summary Counts

| Status | Count |
|--------|-------|
| WIRED_TO_SCREEN (actively called) | 8 functions across 2 files |
| IMPORTED_NOT_EXECUTED (quality gate gap) | 6 functions in 1 file |
| LOGIC_EXISTS (no screen calls them) | 30+ functions across 15 files |

---

## Offline / Sync Architecture

- **File**: `apps/mobile/src/lib/sync-engine.ts`
- **Hook**: `useSyncEngine(token)` returns `{ pendingCount, isSyncing, lastSyncAt, syncNow, addObservation }`
- **Used by**: ScreeningScreen (SyncStatusBar display), ModuleScreen (fallback save), QuickVitalsScreen (fallback save)
- **Storage**: AsyncStorage queue with retry logic and exponential backoff
- **Status**: `BUILD_PASSES` (logic exists, not verified on device)

---

## Components Inventory

| Component | File | Used By |
|-----------|------|---------|
| `SyncStatusBar` | `components/SyncStatusBar.tsx` | ScreeningScreen |
| `ReadinessCheck` | `components/ReadinessCheck.tsx` | CampaignDetailScreen, ScreeningScreen |
| `AnnotationChips` | `components/AnnotationChips.tsx` | ModuleScreen |
| `AIResultCard` | `components/AIResultCard.tsx` | ModuleScreen |
| `CameraCapture` | `components/CameraCapture.tsx` | ModuleScreen |
| `ScreeningHeader` | `components/ScreeningHeader.tsx` | (available, usage TBD) |
| `ModuleCard` | `components/ModuleCard.tsx` | (available, usage TBD) |
| `StatCard` | `components/StatCard.tsx` | (available, usage TBD) |

---

## Known Gaps & Honest Assessment

1. **Quality gate is a facade**: Functions imported in ModuleScreen but never executed because no pixel extraction from image URIs exists.
2. **ObservationListScreen has no filters**: Despite being labeled "status filters" in requirements, the screen shows a flat list with no filter tabs.
3. **15+ AI modules are dead code**: Algorithms exist but no screens call them. They need dedicated screens or integration into ModuleScreen's capture pipeline.
4. **No on-device ML models deployed**: `model-loader-mobile.ts` exists but no model URLs are configured.
5. **Form capture type is a stub**: Modules with `captureType: 'form'` (like hearing) are treated as value inputs, not real forms.
6. **Batch mode passes data as JSON strings in route params**: `batchResults` is serialized/deserialized via JSON.stringify/parse in route params, which may hit navigation param size limits.
7. **HomeScreen is just a re-export**: `HomeScreen.tsx` re-exports `CampaignsScreen` for backward compatibility.
8. **No SignupScreen**: Admin creates accounts; nurses use PIN. Signup screen was intentionally removed.

---

*Last updated: 2026-03-14*
*Generated from codebase analysis, not from device testing*
*Every screen marked UNTESTED until APK verified on real device*
