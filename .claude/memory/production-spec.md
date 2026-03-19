# SKIDS Screen V3 — Production Specification

> **Last updated**: 2026-03-19
> **Version**: 3.3.0
> **Status**: Pre-production testing

---

## 1. ROLE-WISE FEATURE MATRIX

### Roles
| Role | Auth Method | Platform | Scope |
|------|-----------|----------|-------|
| **admin** | Email+password | Web | All campaigns, all features |
| **ops_manager** | Email+password | Web | All campaigns, no user CRUD |
| **doctor** | Email+password | Web | Assigned campaigns, review inbox |
| **nurse** | PIN (4-digit) + orgCode | Mobile | Assigned campaigns, screening only |
| **authority** | Email+password | Web | Assigned campaigns only (read-only analytics) |
| **parent** | QR code + DOB | Web (public) | Own child report only |

### Feature Access by Role

| Feature | admin | ops_mgr | doctor | nurse | authority | parent |
|---------|:-----:|:-------:|:------:|:-----:|:---------:|:------:|
| **Web Portal** | | | | | | |
| Dashboard | ✅ | ✅ | ✅ | — | ✅ | — |
| Create Campaign | ✅ | ✅ | — | — | — | — |
| View All Campaigns | ✅ | ✅ | ✅ | — | assigned | — |
| Doctor Inbox | ✅ | ✅ | ✅ | — | — | — |
| Review Observations | ✅ | — | ✅ | — | — | — |
| Population Health | ✅ | ✅ | — | — | ✅ | — |
| Analytics | ✅ | ✅ | — | — | ✅ | — |
| User Management | ✅ | — | — | — | — | — |
| Consent Management | ✅ | ✅ | ✅ | — | — | — |
| Instrument Builder | ✅ | ✅ | ✅ | — | — | — |
| Studies (Clinical) | ✅ | ✅ | ✅ | — | — | — |
| Settings / AI Config | ✅ | — | — | — | — | — |
| Release Parent Reports | ✅ | ✅ | — | — | — | — |
| Download APK | ✅ | ✅ | ✅ | — | ✅ | — |
| **Mobile App** | | | | | | |
| PIN Login | — | — | — | ✅ | — | — |
| View Campaigns | — | — | — | ✅ | — | — |
| Register Children | — | — | — | ✅ | — | — |
| Screening (27 modules) | — | — | — | ✅ | — | — |
| Save Observations | — | — | — | ✅ | — | — |
| Sync to Server | — | — | — | ✅ | — | — |
| Doctor Review (mobile) | — | — | ✅ | — | — | — |
| **Public** | | | | | | |
| Parent Portal (QR+DOB) | — | — | — | — | — | ✅ |
| Health Education | — | — | — | — | — | ✅ |

---

## 2. END-TO-END FLOWS

### Flow A: Campaign Setup → Screening → Report
```
ADMIN (Web)                    NURSE (Mobile)                 DOCTOR (Web)
    │                              │                              │
    ├─ Create Campaign             │                              │
    ├─ Import Children             │                              │
    ├─ Assign Nurses               │                              │
    │                              │                              │
    │                    ┌─ PIN Login (orgCode + PIN)             │
    │                    ├─ Select Campaign                       │
    │                    ├─ Select Child                          │
    │                    ├─ Device & System Check                 │
    │                    │   ├─ Camera ✅                         │
    │                    │   ├─ Mic ✅                            │
    │                    │   ├─ Storage ✅                        │
    │                    │   ├─ Network ✅                        │
    │                    │   ├─ AI Engine ✅                      │
    │                    │   └─ Bluetooth ⚠️                     │
    │                    ├─ Start Screening                       │
    │                    │   ├─ Module 1: Vision (photo)          │
    │                    │   │   ├─ Quality Gate → pass/fail      │
    │                    │   │   ├─ On-device AI → chips          │
    │                    │   │   ├─ Nurse selects/modifies chips  │
    │                    │   │   └─ Save → local queue            │
    │                    │   ├─ Module 2: Hearing (form)          │
    │                    │   ├─ Module 3: Vitals (value)          │
    │                    │   ├─ ... (up to 27 modules)            │
    │                    │   └─ Batch Summary                     │
    │                    ├─ Auto-sync (every 60s)                 │
    │                    │   ├─ POST /api/observations            │
    │                    │   └─ PUT media → R2                    │
    │                    └─ Done                                  │
    │                                                             │
    │                                               ┌─ Doctor Inbox
    │                                               ├─ Review observation
    │                                               │   ├─ View photo/video
    │                                               │   ├─ See AI analysis
    │                                               │   ├─ Decision: approve/refer/retake
    │                                               │   └─ Save review
    │                                               └─ Done
    │
    ├─ View 4D Report (per child)
    ├─ Release Parent Reports
    └─ Parent accesses via QR + DOB
```

### Flow B: Individual Module Screening
```
Nurse opens Module → Screen shows:
  1. Screening Guide (equipment, environment, tips)
  2. Capture UI (photo/video/audio/value/form)
     ├─ photo: CameraCapture → Quality Gate → AI Analysis → Chips
     ├─ video: CameraCapture (30s max) → Frame extraction → AI
     ├─ audio: AyuSync deep link → External app → Webhook result
     ├─ value: TextInput → WHO Z-score → Classification
     └─ form: Custom form (e.g., HearingForm → PictureHearingTest)
  3. AI Analysis card (classification, confidence, suggested chips)
  4. Clinical Findings (chip selector by category)
  5. Observation Notes (free text)
  6. Save Observation → Local queue → Auto-sync
```

### Flow C: Sync Pipeline
```
Mobile (offline)                    Worker API                    Turso DB
    │                                   │                            │
    ├─ Save to AsyncStorage             │                            │
    │   key: @skids/sync-queue          │                            │
    │   status: pending                 │                            │
    │                                   │                            │
    ├─ Check connectivity (60s poll)    │                            │
    │   └─ if online:                   │                            │
    │       ├─ POST /api/observations ──┤─ INSERT observation ──────►│
    │       │   status: syncing         │                            │
    │       ├─ POST /api/r2/presign ───►│─ Generate presigned URL    │
    │       ├─ PUT media → R2 direct    │                            │
    │       │   status: synced ✅       │                            │
    │       └─ if fail:                 │                            │
    │           retryCount++            │                            │
    │           backoff: 1s→30s         │                            │
    │           max 3 retries           │                            │
    └─ status: failed (after 3)        │                            │
```

---

## 3. SCREENING MODULES (ALL 27)

### Module Registry
**File**: `apps/mobile/src/lib/modules.ts`

| # | Module | Capture | Camera | AI Tier 1 (Device) | AI Tier 3 (Cloud) | Chips |
|---|--------|---------|--------|--------------------|--------------------|-------|
| 1 | vision | photo | front | Red reflex, photoscreening | Gemini vision | Myopia, strabismus, amblyopia, media opacity |
| 2 | eyes_external | photo | front | Conjunctival analysis | — | Pallor, ptosis, proptosis |
| 3 | ear | photo | back | Tympanic membrane | — | Cerumen, otitis media, perforation |
| 4 | hearing | form | — | Pure-tone audiometry | — | Normal, mild/moderate/severe loss, unilateral |
| 5 | dental | video | back | Caries detection | — | Caries, malocclusion, gingivitis |
| 6 | skin | photo | back | Lesion detection | — | Rash, wound, infection, pigmentation |
| 7 | general_appearance | photo | front | Pallor/cyanosis/jaundice | — | Pallor, cyanosis, jaundice, edema |
| 8 | height | value | — | WHO LMS Z-score | — | Normal, stunted, tall |
| 9 | weight | value | — | WHO LMS Z-score | — | Normal, underweight, overweight |
| 10 | bmi | value | — | WHO LMS Z-score | — | Normal, thin, obese |
| 11 | bp | value | — | Percentile calc | — | Normal, elevated, hypertension |
| 12 | hemoglobin | value | — | WHO threshold | — | Normal, mild/moderate/severe anemia |
| 13 | vitals | video | front | rPPG (heart rate) | — | Normal, tachycardia, bradycardia |
| 14 | respiratory | audio | — | Cough classification | — | Normal, wheeze, crackles, stridor |
| 15 | cardiac | audio | — | AyuSync stethoscope | — | Normal, murmur, arrhythmia |
| 16 | pulmonary | audio | — | AyuSync stethoscope | — | Normal, crackles, wheeze, diminished |
| 17 | motor | video | back | Pose estimation + DTW | — | Normal, delay, coordination deficit |
| 18 | neurodevelopment | video | front | Gaze + face detection | — | Normal, concern, at-risk |
| 19 | behavioral | video | front | Behavioral protocol | — | Normal, ASD markers |
| 20 | mchat | form | — | M-CHAT-R/F scoring | — | Low/medium/high risk |
| 21 | throat | photo | back | Clinical color | — | Pharyngitis, tonsillitis |
| 22 | abdomen | photo | back | Clinical assessment | — | Distension, tenderness |
| 23 | spine | photo | back | Posture analysis | — | Scoliosis, kyphosis, lordosis |
| 24 | nails | photo | back | Clinical color | — | Clubbing, koilonychia |
| 25 | hair | photo | back | Clinical assessment | — | Alopecia, lice, fungal |
| 26 | lymph_nodes | photo | back | Clinical assessment | — | Lymphadenopathy |
| 27 | vaccination | photo | back | OCR (card reading) | — | Complete, incomplete, missing |

### Every Module Can Be:
- ✅ **Manually completed** — nurse selects chips without AI
- ✅ **Skipped** — "Skip & Go Back" button on every module
- ✅ **Retaken** — "Retake" button after capture
- ✅ **Saved without AI** — AI failure doesn't block save

---

## 4. DATABASE TABLES

### Core Tables (12)
| Table | Primary Key | Key Fields | Relationships |
|-------|-----------|------------|---------------|
| campaigns | code | name, org_code, status, enabled_modules | → children, observations |
| children | id | name, dob, gender, campaign_code, qr_code | → campaign, observations |
| observations | id | child_id, campaign_code, module_type, media_url, ai_annotations, annotation_data | → child, campaign |
| reviews | id | observation_id, clinician_id, decision | → observation |
| sync_state | observation_id | status, media_status, attempts | → observation |
| ai_usage | id | campaign_code, model, tier, cost_usd | → campaign |
| absences | id | child_id, campaign_code, date | → child, campaign |
| training_samples | id | observation_id, doctor_id, feedback | → observation |
| ayusync_reports | id | campaign_code, child_id, reports | → campaign, child |
| campaign_assignments | id | user_id, campaign_code | → campaign |
| parent_claims | id | child_id, firebase_uid | → child |
| cohort_definitions | id | org_code, filter_json | — |

### Research Platform Tables (7)
| Table | Primary Key | Key Fields | Relationships |
|-------|-----------|------------|---------------|
| consent_templates | id | title, body_html, status | — |
| consents | id | template_id, child_id, guardian_name | → template, child |
| instruments | id | name, schema_json, category | — |
| instrument_responses | id | instrument_id, child_id, response_json | → instrument, child |
| studies | id | title, study_type, status, pi_name | → consent_template |
| study_arms | id | study_id, name | → study |
| study_events | id | study_id, name, day_offset | → study |
| study_event_instruments | id | study_event_id, instrument_id | → event, instrument |
| study_enrollments | id | study_id, child_id, arm_id, consent_id | → study, child, arm, consent |

---

## 5. API ENDPOINTS (COMPLETE)

### Public (No Auth)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/pin-auth/login | Nurse PIN login |
| GET | /api/r2/apk | Download APK |
| GET | /api/r2/apk/info | APK metadata |
| POST | /api/parent-portal/lookup | QR code lookup |
| POST | /api/parent-portal/verify | DOB verification |
| GET | /api/report-tokens/:token | View report |
| GET | /api/education/topics | Health education |
| GET | /api/health | Health check |

### Authenticated (All Roles)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/campaigns | List campaigns |
| GET | /api/campaigns/:code | Campaign detail |
| POST | /api/campaigns | Create campaign |
| PUT | /api/campaigns/:code | Update campaign |
| GET | /api/children?campaign=CODE | List children |
| POST | /api/children | Register child |
| GET | /api/observations | List observations |
| POST | /api/observations | Create observation |
| POST | /api/observations/sync | Batch sync |
| GET/POST | /api/reviews | Reviews CRUD |
| GET | /api/campaign-progress/:code | Campaign metrics |
| GET | /api/screening-events/:code | Activity feed |
| POST | /api/r2/presign | Media upload URL |
| GET/POST | /api/consents/* | Consent CRUD |
| GET/POST | /api/instruments/* | Instrument CRUD |
| GET/POST | /api/studies/* | Study CRUD |
| GET | /api/export/* | Data export |
| POST | /api/account/change-password | Self-service |

### Admin Only
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/admin/create-user | Create user |
| POST | /api/admin/reset-password | Reset password |
| GET/POST | /api/ai-config | AI model config |
| GET/POST | /api/campaign-assignments | Authority scoping |

---

## 6. AI PIPELINE ARCHITECTURE

```
Photo/Video captured
    │
    ▼
Quality Gate (on-device)
    ├─ Blur detection (Laplacian variance)
    ├─ Exposure check (histogram analysis)
    ├─ Framing validation (face/body detected)
    └─ Flash detection
    │
    ▼ (if passed)
Tier 1: On-Device AI
    ├─ ONNX Runtime (bundled models)
    ├─ jpeg-js pixel analysis
    ├─ WHO LMS Z-score tables
    └─ Module-specific analyzers
    │
    ▼ (result)
AI Analysis Card
    ├─ Classification (e.g., "Normal", "Mild myopia")
    ├─ Confidence (0-100%)
    ├─ Suggested chips (auto-selected)
    └─ Nurse can override/add/remove chips
    │
    ▼
Save Observation
    ├─ annotation_data: { chips, severity, notes }
    ├─ ai_annotations: { model, classification, confidence }
    └─ Queued for sync
```

### Key Principle: LOCAL AI ONLY at Nurse Level
- **No cloud AI calls during screening** — all analysis is on-device
- Cloud AI (Gemini/Claude) is only used at **doctor review** level
- If AI fails → nurse manually selects chips → save still works

---

## 7. DEPLOYMENT

| Component | Platform | URL | Deploy Command |
|-----------|----------|-----|---------------|
| API Worker | Cloudflare Workers | skids-api.satish-9f4.workers.dev | `wrangler deploy` |
| Web Portal | Cloudflare Pages | skids-web.pages.dev | `wrangler pages deploy dist` |
| Mobile APK | R2 download | /api/r2/apk | Gradle build → upload |
| Database | Turso | libsql://xxx.turso.io | `turso db shell` |
| Media | Cloudflare R2 | skids-media bucket | Presigned URL upload |

---

## 8. TEST CREDENTIALS

| Role | Platform | Login |
|------|----------|-------|
| Admin | Web | Email: dev@skids.health, Password: (set in DB) |
| Nurse (Sunita Devi) | Mobile | Org: `zpedi`, PIN: `5678` |
| Admin (mobile) | Mobile | Org: `zpedi`, PIN: `1234` |

---

## 9. KNOWN ISSUES (as of 2026-03-19)

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| 1 | ~~Base64 undefined in standalone APK~~ | ✅ Fixed | Fallback to string 'base64' |
| 2 | ~~crypto.randomUUID() missing in RN~~ | ✅ Fixed | Replaced with timestamp+random |
| 3 | APK download from ops portal returns 401 | ⚠️ Check deployment | Route is public in code, may need redeploy |
| 4 | Neurodevelopment video capture not tested | 🔲 TODO | Video recording wired but needs testing |
| 5 | AyuSync SDK not embedded | ✅ By design | Deep link to external AyuShare app |
| 6 | Bluetooth device name not configured | 🔲 TODO | No BLE pairing code — AyuSync handles it |
