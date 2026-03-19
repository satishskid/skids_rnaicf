# SKIDS Screen V3 — Visual Flow Diagrams

> Last updated: 2026-03-19

---

## 1. SYSTEM ARCHITECTURE — WHO USES WHAT

```
                        ┌─────────────────────────────────────────────────┐
                        │              SKIDS ECOSYSTEM                     │
                        └─────────────────────────────────────────────────┘

  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │  👩‍⚕️ NURSE    │    │  👨‍⚕️ DOCTOR   │    │  👔 ADMIN/OPS │    │  👨‍👩‍👧 PARENT   │
  │  (Field)     │    │  (Clinic)    │    │  (Office)    │    │  (Home)      │
  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
         │                   │                   │                   │
         ▼                   ▼                   ▼                   ▼
  ┌──────────────┐    ┌──────────────────────────────────┐    ┌──────────────┐
  │  📱 MOBILE   │    │       🖥️  WEB OPS PORTAL          │    │  🌐 PARENT   │
  │  APK (RN)    │    │       (React SPA)                │    │  PORTAL      │
  │              │    │                                  │    │  (Public)    │
  │ • Screening  │    │ • Dashboard    • Doctor Inbox    │    │              │
  │ • 27 modules │    │ • Campaigns    • Analytics       │    │ • QR + DOB   │
  │ • Camera/Mic │    │ • Users        • Studies         │    │ • View report│
  │ • On-device  │    │ • Consents     • Pop Health      │    │ • Education  │
  │   AI         │    │ • Instruments  • Settings        │    │              │
  └──────┬───────┘    └──────────┬───────────────────────┘    └──────┬───────┘
         │                       │                                   │
         │    ┌──────────────────┼───────────────────────────────────┘
         │    │                  │
         ▼    ▼                  ▼
  ┌─────────────────────────────────────────┐
  │         ⚡ CLOUDFLARE WORKER (Hono)      │
  │         skids-api.satish-9f4.workers.dev │
  │                                         │
  │  /api/pin-auth    /api/campaigns        │
  │  /api/children    /api/observations     │
  │  /api/reviews     /api/r2               │
  │  /api/studies     /api/export           │
  │  /api/ai          /api/parent-portal    │
  └─────────┬──────────────┬────────────────┘
            │              │
     ┌──────┘              └──────┐
     ▼                            ▼
┌──────────┐              ┌──────────────┐
│ 🗄️ TURSO │              │ 📦 R2 BUCKET │
│ (libSQL) │              │ (Media)      │
│          │              │              │
│ 19 tables│              │ Photos       │
│ campaigns│              │ Videos       │
│ children │              │ Audio        │
│ observ.  │              │ APK file     │
│ reviews  │              │              │
└──────────┘              └──────────────┘
```

---

## 2. USER JOURNEY — CAMPAIGN LIFECYCLE

```
════════════════════════════════════════════════════════════════════════
                    PHASE 1: SETUP (Admin/Ops — Web)
════════════════════════════════════════════════════════════════════════

  Admin logs in (email+password)
      │
      ├─→ Creates Campaign
      │     name: "Chakradharpur School 2025-26"
      │     code: "CHKR1"
      │     modules: [vision, hearing, dental, skin, vitals, height, weight]
      │
      ├─→ Imports Children (CSV or manual)
      │     476 children registered
      │
      ├─→ Assigns Nurses
      │     Sunita Devi → CHKR1
      │     Priya Kumari → CHKR1
      │
      └─→ Assigns Authority (for analytics)
            District Health Officer → CHKR1


════════════════════════════════════════════════════════════════════════
                    PHASE 2: SCREENING (Nurse — Mobile)
════════════════════════════════════════════════════════════════════════

  Nurse opens APK → PIN pad
      │
      ├─→ Org Code: "zpedi"
      ├─→ PIN: "5678"
      │     POST /api/pin-auth/login
      │     → Bearer token (24h)
      │
      ├─→ Home Screen → Select Campaign "CHKR1"
      │     GET /api/campaigns/CHKR1
      │     GET /api/children?campaign=CHKR1
      │
      ├─→ Select Child "Aarav Kumar"
      │
      ├─→ Device & System Check
      │     ✅ Camera, Mic, Storage, Network
      │     ✅ AI Engine (7/7 modules)
      │     ⚠️ Bluetooth (not needed for most modules)
      │
      ├─→ Start Screening
      │     │
      │     ├─→ Module: VISION (photo, front camera)
      │     │     Capture photo → Quality Gate ✅
      │     │     → On-device AI: "Normal bilateral"
      │     │     → Nurse confirms chips: [Eye alignment normal]
      │     │     → Save → Local queue ✅
      │     │
      │     ├─→ Module: HEARING (form)
      │     │     HearingForm → contextual checkboxes
      │     │     → Start Sound Game (PictureHearingTest)
      │     │     → 12 trials (6 freq × 2 ears)
      │     │     → Result: "Hearing normal (bilateral)"
      │     │     → Save → Local queue ✅
      │     │
      │     ├─→ Module: HEIGHT (value)
      │     │     Enter: 142 cm
      │     │     → WHO Z-score: -0.3 (Normal)
      │     │     → Save → Local queue ✅
      │     │
      │     ├─→ Module: WEIGHT (value)
      │     │     Enter: 35 kg
      │     │     → WHO Z-score: -0.1 (Normal)
      │     │     → Save → Local queue ✅
      │     │
      │     ├─→ Module: DENTAL (video, back camera)
      │     │     Record 10s video → extract frames
      │     │     → AI: "Possible caries upper right"
      │     │     → Nurse adds: [Dental caries]
      │     │     → Save → Local queue ✅
      │     │
      │     └─→ Module: SKIN (photo, back camera)
      │           Capture photo → Quality Gate ✅
      │           → AI: "No abnormality detected"
      │           → Nurse confirms: [Skin normal]
      │           → Save → Local queue ✅
      │
      └─→ Batch Summary: 6/6 modules complete
            Auto-sync → POST /api/observations/sync
            6 observations synced ✅


════════════════════════════════════════════════════════════════════════
                    PHASE 3: REVIEW (Doctor — Web)
════════════════════════════════════════════════════════════════════════

  Doctor logs in → Doctor Inbox
      │
      ├─→ Pending Reviews (filtered by campaign)
      │     "Aarav Kumar — Dental — Possible caries"
      │     "Priya Singh — Vision — Mild myopia suspected"
      │
      ├─→ Opens Review
      │     Sees: photo/video, AI analysis, nurse chips
      │     │
      │     ├─→ Decision: APPROVE (AI + nurse agreed)
      │     │     Severity: mild
      │     │     Notes: "Refer to school dental program"
      │     │
      │     ├─→ Decision: REFER
      │     │     Referral: "District hospital ophthalmology"
      │     │
      │     └─→ Decision: RETAKE
      │           Reason: "Image blurry, need better lighting"
      │
      └─→ Review saved → POST /api/reviews


════════════════════════════════════════════════════════════════════════
                    PHASE 4: REPORTING (Admin → Parent)
════════════════════════════════════════════════════════════════════════

  Admin views campaign analytics
      │
      ├─→ 4D Report per child
      │     Development: Normal
      │     Disease: Dental caries (mild)
      │     Disability: None
      │     Deficiency: None
      │
      ├─→ Population Health
      │     Dental caries prevalence: 23%
      │     Myopia prevalence: 12%
      │     Anemia prevalence: 8%
      │
      ├─→ Release Reports
      │     POST /api/report-tokens/bulk-release
      │     QR codes generated for each child
      │
      └─→ Parent receives QR card
            Opens: skids-web.pages.dev/parent
            Scans QR → Enters child DOB
            → Sees health card with findings + recommendations
```

---

## 3. DATA FLOW — OBSERVATION LIFECYCLE

```
┌──────────────────────────────────────────────────────────────────┐
│                    📱 MOBILE (Nurse)                              │
│                                                                  │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐  │
│  │ CAPTURE  │──→│ QUALITY  │──→│ ON-DEVICE│──→│ CHIP SELECT  │  │
│  │          │   │  GATE    │   │  AI      │   │              │  │
│  │ Camera   │   │          │   │          │   │ Auto-suggest │  │
│  │ Mic      │   │ Blur ✓   │   │ ONNX     │   │ from AI      │  │
│  │ Form     │   │ Light ✓  │   │ jpeg-js  │   │ + nurse edit │  │
│  │ Value    │   │ Frame ✓  │   │ WHO LMS  │   │              │  │
│  └─────────┘   └──────────┘   └──────────┘   └──────┬───────┘  │
│                                                      │          │
│                                              ┌───────▼───────┐  │
│                                              │  SAVE LOCAL   │  │
│                                              │               │  │
│                                              │ AsyncStorage  │  │
│                                              │ @skids/sync   │  │
│                                              │ status:pending│  │
│                                              └───────┬───────┘  │
│                                                      │          │
└──────────────────────────────────────────────────────┼──────────┘
                                                       │
                              ┌─────────────────────────┘
                              │ Auto-sync (60s interval)
                              │ if (online)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ⚡ WORKER API                                  │
│                                                                  │
│  ┌───────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ POST           │    │ Validate &   │    │ INSERT INTO      │  │
│  │ /observations  │──→ │ Enrich       │──→ │ observations     │  │
│  │                │    │              │    │                  │  │
│  │ {              │    │ • Check auth │    │ id, child_id,    │  │
│  │   childId,     │    │ • Validate   │    │ campaign_code,   │  │
│  │   moduleType,  │    │   campaign   │    │ module_type,     │  │
│  │   mediaUrl,    │    │ • Parse JSON │    │ media_url,       │  │
│  │   annotations, │    │              │    │ ai_annotations,  │  │
│  │   aiAnalysis   │    │              │    │ annotation_data, │  │
│  │ }              │    │              │    │ timestamp        │  │
│  └───────────────┘    └──────────────┘    └────────┬─────────┘  │
│                                                     │           │
└─────────────────────────────────────────────────────┼───────────┘
                                                      │
                              ┌────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    🗄️ TURSO DATABASE                              │
│                                                                  │
│  observations table                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ id: obs-1710856200-abc1234                               │   │
│  │ child_id: child-aarav-001                                │   │
│  │ campaign_code: CHKR1                                     │   │
│  │ module_type: vision                                      │   │
│  │ media_url: https://r2.../campaigns/CHKR1/vision/abc.jpg  │   │
│  │ ai_annotations: {                                        │   │
│  │   classification: "Normal bilateral",                    │   │
│  │   confidence: 87,                                        │   │
│  │   model: "on-device-v1"                                  │   │
│  │ }                                                        │   │
│  │ annotation_data: {                                       │   │
│  │   chips: ["Eye alignment normal"],                       │   │
│  │   severity: {},                                          │   │
│  │   notes: ""                                              │   │
│  │ }                                                        │   │
│  │ screened_by: "Sunita Devi"                               │   │
│  │ timestamp: 2026-03-19T10:30:00Z                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│         ┌─── READ by ──────────────────────────────┐            │
│         ▼                    ▼                     ▼            │
│  Doctor Inbox         4D Report Engine      Parent Portal       │
│  (review queue)       (aggregate child)     (QR + DOB)          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. MODULE SCREENING — CAPTURE → AI → SAVE

```
                    ┌─────────────────────────┐
                    │   NURSE TAPS MODULE     │
                    │   e.g., "Vision"        │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   SCREENING GUIDE       │
                    │   • Equipment needed    │
                    │   • Environment tips    │
                    │   • Positioning guide   │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼──────┐  ┌───────▼───────┐  ┌──────▼───────┐
     │ 📷 PHOTO      │  │ 🎥 VIDEO      │  │ 📝 FORM      │
     │               │  │               │  │              │
     │ CameraCapture │  │ Record 30s    │  │ HearingForm  │
     │ front/back    │  │ Extract frames│  │ M-CHAT       │
     │               │  │               │  │ Custom       │
     └────────┬──────┘  └───────┬───────┘  └──────┬───────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   QUALITY GATE          │
                    │                         │
                    │   Blur:     ✅ sharp    │
                    │   Exposure: ✅ good     │
                    │   Framing:  ✅ centered │
                    │   Flash:    ✅ none     │
                    │                         │
                    │   ❌ FAIL → "Retake"    │
                    │   ✅ PASS → continue    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   ON-DEVICE AI          │
                    │   (Tier 1 — no network) │
                    │                         │
                    │   Model: ONNX / pixel   │
                    │   Analysis: 200-500ms   │
                    │                         │
                    │   Result:               │
                    │   ├─ Classification     │
                    │   ├─ Confidence %       │
                    │   └─ Suggested chips    │
                    │                         │
                    │   ❌ AI FAILS?          │
                    │   → Show "Unknown"      │
                    │   → Nurse picks chips   │
                    │   → Save still works!   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   CLINICAL FINDINGS     │
                    │   (Chip Selector)       │
                    │                         │
                    │   Auto-suggested:       │
                    │   ✅ Eye alignment norm  │
                    │   ○  Strabismus         │
                    │   ○  Myopia suspected   │
                    │   ○  Media opacity      │
                    │                         │
                    │   Nurse can:            │
                    │   • Accept AI chips     │
                    │   • Add more chips      │
                    │   • Remove chips        │
                    │   • Set severity        │
                    │   • Add notes           │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼──────┐  ┌───────▼───────┐  ┌──────▼───────┐
     │ 💾 SAVE       │  │ ⏭️  SKIP      │  │ 🔄 RETAKE   │
     │               │  │               │  │              │
     │ → Local queue │  │ → Next module │  │ → Camera     │
     │ → Auto-sync   │  │ → No data     │  │ → Re-capture │
     │ → Next module │  │   saved       │  │              │
     └───────────────┘  └───────────────┘  └──────────────┘
```

---

## 5. ROLE-BASED SCREEN MAP

```
═══════════════════════════════════════════════════════════════
                📱 MOBILE APP (Nurse + Doctor)
═══════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────┐
  │                     PIN LOGIN                           │
  │  ┌─────┐ ┌─────┐ ┌─────┐                              │
  │  │  1  │ │  2  │ │  3  │  Org: zpedi                  │
  │  │  4  │ │  5  │ │  6  │  PIN: ****                   │
  │  │  7  │ │  8  │ │  9  │  → POST /api/pin-auth/login  │
  │  │     │ │  0  │ │  ⌫  │                              │
  │  └─────┘ └─────┘ └─────┘                              │
  └─────────────────────┬───────────────────────────────────┘
                        │
  ┌─────────────────────▼───────────────────────────────────┐
  │  ┌────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  │
  │  │  Home  │  │ Screening│  │ Profile │  │ Settings │  │
  │  └────┬───┘  └────┬─────┘  └─────────┘  └──────────┘  │
  │       │           │                                     │
  │       ▼           ▼                                     │
  │  ┌─────────┐  ┌──────────────┐                         │
  │  │Campaign │  │ Search bar   │                         │
  │  │List     │  │ Module grid  │                         │
  │  │         │  │ (27 modules) │                         │
  │  └────┬────┘  └──────┬───────┘                         │
  │       │              │                                  │
  │       ▼              ▼                                  │
  │  ┌─────────┐  ┌──────────────┐                         │
  │  │Children │  │ ModuleScreen │                         │
  │  │List     │  │              │                         │
  │  │(search) │  │ Guide → Cam  │                         │
  │  └────┬────┘  │ → AI → Chips │                         │
  │       │       │ → Save/Skip  │                         │
  │       ▼       └──────────────┘                         │
  │  ┌─────────┐                                           │
  │  │Register │                                           │
  │  │Child    │                                           │
  │  └─────────┘                                           │
  └─────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════
                🖥️  WEB OPS PORTAL (All Web Roles)
═══════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────┐
  │  SIDEBAR                    │  MAIN CONTENT             │
  │                             │                           │
  │  ┌──────────────────┐      │                           │
  │  │ 📊 Dashboard     │──────│──→ KPI cards, campaigns   │
  │  │ 📋 Campaigns     │──────│──→ Campaign CRUD + list   │
  │  │ 📥 Doctor Inbox  │──────│──→ Review queue           │
  │  │ 🏥 Pop Health    │──────│──→ Cohort analytics       │
  │  │ 📈 Analytics     │──────│──→ Prevalence, trends     │
  │  │ 📝 Consent       │──────│──→ Template builder       │
  │  │ 📊 Surveys       │──────│──→ SurveyJS instruments   │
  │  │ 🔬 Studies       │──────│──→ Clinical trial mgmt    │
  │  │ 👥 Users         │──────│──→ User CRUD (admin)      │
  │  │ 📖 Documentation │──────│──→ Quick start, guides    │
  │  │ ⚙️  Settings      │──────│──→ Org config, AI keys    │
  │  │                  │      │                           │
  │  │ ── ECOSYSTEM ──  │      │                           │
  │  │ 📱 Download APK  │──────│──→ /api/r2/apk            │
  │  │ 👨‍👩‍👧 Parent Portal │──────│──→ /parent (public)       │
  │  └──────────────────┘      │                           │
  └─────────────────────────────────────────────────────────┘

  ROLE VISIBILITY:
  ┌─────────────────────────────────────────────────────────┐
  │  admin      → ALL menu items                           │
  │  ops_manager→ ALL except Users                         │
  │  doctor     → Dashboard, Campaigns, Inbox, Consents,   │
  │               Surveys, Studies, Docs                    │
  │  authority  → Dashboard, Pop Health, Analytics          │
  │  nurse      → (uses mobile app, not web)               │
  └─────────────────────────────────────────────────────────┘
```

---

## 6. SYNC & OFFLINE — STATE MACHINE

```
                ┌──────────┐
                │ CAPTURED │
                │ (local)  │
                └────┬─────┘
                     │
                     ▼
              ┌──────────────┐
              │   PENDING    │◄──────────────────────┐
              │              │                       │
              │ AsyncStorage │                       │
              │ queue        │                       │
              └──────┬───────┘                       │
                     │                               │
                     │ if (online)                   │
                     ▼                               │
              ┌──────────────┐              ┌────────┴───────┐
              │   SYNCING    │──── fail ───→│    FAILED      │
              │              │              │                │
              │ POST /api/   │              │ retry < 3?     │
              │ observations │              │ YES → backoff  │
              │              │              │   1s → 30s     │
              └──────┬───────┘              │ NO → stuck     │
                     │                      │   (manual)     │
                     │ success              └────────────────┘
                     ▼
              ┌──────────────┐
              │   SYNCED ✅  │
              │              │
              │ synced_at    │
              │ visible in   │
              │ web portal   │
              └──────────────┘


  MEDIA UPLOAD (parallel):
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ Captured │──→ │ Presign  │──→ │ PUT to   │──→ │ URL in   │
  │ locally  │    │ URL from │    │ R2 direct│    │ observ.  │
  │          │    │ Worker   │    │          │    │ record   │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## 7. AI PIPELINE — 3 TIERS

```
  ┌─────────────────────────────────────────────────────────────┐
  │  TIER 1: ON-DEVICE (Nurse's phone — NO NETWORK NEEDED)     │
  │                                                             │
  │  ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐ │
  │  │ Quality   │  │ Pixel    │  │ WHO LMS   │  │ ONNX    │ │
  │  │ Gate      │  │ Analysis │  │ Z-scores  │  │ Runtime │ │
  │  │           │  │           │  │           │  │         │ │
  │  │ blur,     │  │ red reflex│  │ height,   │  │ bundled │ │
  │  │ exposure, │  │ color     │  │ weight,   │  │ models  │ │
  │  │ framing   │  │ analysis  │  │ BMI, BP,  │  │         │ │
  │  │           │  │           │  │ hemoglobin│  │         │ │
  │  └───────────┘  └──────────┘  └───────────┘  └─────────┘ │
  │                                                             │
  │  Latency: 200-500ms  |  Works offline  |  Free             │
  └─────────────────────────────────────────────────────────────┘
                     │
                     │ (classification + confidence)
                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  NURSE DECISION POINT                                       │
  │                                                             │
  │  AI says: "Normal bilateral" (87% confidence)               │
  │                                                             │
  │  Nurse can:                                                 │
  │    ✅ Accept → Save with AI chips                           │
  │    ✏️  Edit  → Modify chips, add severity                   │
  │    ❌ Override → Remove AI chips, pick own                  │
  │    ⏭️  Skip  → No data saved for this module                │
  │                                                             │
  │  AI FAILURE? → "Unknown (0%)" → Nurse picks manually       │
  └─────────────────────────────────────────────────────────────┘
                     │
                     │ (saved observation synced to server)
                     ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  TIER 3: CLOUD AI (Doctor review — Web portal only)         │
  │                                                             │
  │  ┌───────────┐  ┌──────────┐  ┌───────────────────────┐   │
  │  │ Gemini    │  │ Claude   │  │ Cloudflare AI         │   │
  │  │ Flash     │  │ (future) │  │ (free tier)           │   │
  │  │           │  │          │  │                       │   │
  │  │ Vision    │  │ Clinical │  │ Text classification   │   │
  │  │ analysis  │  │ summary  │  │ Embedding generation  │   │
  │  │ of photos │  │ writing  │  │                       │   │
  │  └───────────┘  └──────────┘  └───────────────────────┘   │
  │                                                             │
  │  Used by: Doctor during review (not nurse during screening) │
  │  Latency: 1-3s  |  Requires internet  |  API costs         │
  └─────────────────────────────────────────────────────────────┘
```

---

## 8. 4D REPORT GENERATION

```
  Child "Aarav Kumar" has observations across modules:

  ┌──────────────────────────────────────────────────────┐
  │  OBSERVATIONS (from screening)                       │
  │                                                      │
  │  Vision:  [Eye alignment normal]                     │
  │  Hearing: [Hearing normal bilateral]                 │
  │  Dental:  [Dental caries] severity: mild             │
  │  Skin:    [Skin normal]                              │
  │  Height:  142cm, Z-score: -0.3 [Normal]              │
  │  Weight:  35kg, Z-score: -0.1 [Normal]               │
  │  Hb:      12.1 g/dL [Normal]                         │
  └──────────────────────┬───────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  4D CLASSIFICATION ENGINE                            │
  │                                                      │
  │  Maps each chip → ICD code → 4D category             │
  │                                                      │
  │  ┌────────────────┐  ┌────────────────────────────┐ │
  │  │ DEVELOPMENT    │  │ Motor, neuro, behavioral,  │ │
  │  │ (D1)           │  │ speech, learning            │ │
  │  │                │  │ → No observations           │ │
  │  │ Status: Normal │  │                             │ │
  │  └────────────────┘  └────────────────────────────┘ │
  │                                                      │
  │  ┌────────────────┐  ┌────────────────────────────┐ │
  │  │ DISEASE        │  │ Infections, conditions     │ │
  │  │ (D2)           │  │ → Dental caries (mild)     │ │
  │  │                │  │                             │ │
  │  │ Status: 1 issue│  │                             │ │
  │  └────────────────┘  └────────────────────────────┘ │
  │                                                      │
  │  ┌────────────────┐  ┌────────────────────────────┐ │
  │  │ DISABILITY     │  │ Vision, hearing, motor     │ │
  │  │ (D3)           │  │ impairments                │ │
  │  │                │  │ → No observations           │ │
  │  │ Status: Normal │  │                             │ │
  │  └────────────────┘  └────────────────────────────┘ │
  │                                                      │
  │  ┌────────────────┐  ┌────────────────────────────┐ │
  │  │ DEFICIENCY     │  │ Nutrition, anemia,         │ │
  │  │ (D4)           │  │ vitamin deficiency          │ │
  │  │                │  │ → Normal growth, no anemia  │ │
  │  │ Status: Normal │  │                             │ │
  │  └────────────────┘  └────────────────────────────┘ │
  │                                                      │
  └──────────────────────┬───────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  HEALTH CARD (Parent Report)                         │
  │                                                      │
  │  Child: Aarav Kumar | Age: 12y | Class: VII          │
  │  ──────────────────────────────────────────────      │
  │  ✅ Development: Normal                              │
  │  ⚠️  Disease: Dental caries (mild) — see dentist     │
  │  ✅ Disability: None detected                        │
  │  ✅ Deficiency: Normal nutrition                     │
  │  ──────────────────────────────────────────────      │
  │  Recommendation: Dental check-up within 3 months     │
  │  Next screening: March 2027                          │
  │                                                      │
  │  QR Code: [████████] → Parent Portal                 │
  └──────────────────────────────────────────────────────┘
```
