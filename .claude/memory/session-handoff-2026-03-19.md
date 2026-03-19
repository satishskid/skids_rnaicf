# Session Handoff — 2026-03-19 → Next Session

## START HERE NEXT TIME

Copy-paste this to start the next session:

```
We're testing SKIDS_rnaicf (github.com/satishskid/skids_rnaicf) end-to-end.
Repo is at /Users/spr/Desktop/skids-screen-v3/
Branch: main

Read these memory files FIRST before doing anything:
1. .claude/memory/production-spec.md — full spec (roles, modules, API, DB, AI)
2. .claude/memory/flow-diagrams.md — visual diagrams of all flows
3. .claude/memory/SKIDS_ECOSYSTEM_MAP.md — project separation
4. .claude/memory/session-handoff-2026-03-19.md — this file (current state + what to test)

TWO SEPARATE PROJECTS — never mix them:
- skids_PWA_next_vercel (zpediscreen/) = Next.js PWA on Vercel = OPS portal
- skids_rnaicf (skids-screen-v3/) = React Native + Hono on Cloudflare = SCREEN app ← WE'RE TESTING THIS ONE

Test credentials:
- Mobile: Org "zpedi", Nurse PIN "5678" (Sunita Devi), Admin PIN "1234"
- Web: dev@skids.health (admin)
- API: skids-api.satish-9f4.workers.dev
- Web: skids-web.pages.dev
```

---

## WHAT WAS DONE THIS SESSION

### Bugs Fixed
1. ✅ **Base64 error** — `FileSystem.EncodingType.Base64` undefined in standalone APK → added fallback to string `'base64'`
2. ✅ **crypto.randomUUID()** — React Native has no Web Crypto API → replaced with `Date.now() + Math.random()` ID
3. ✅ **Tone playback** — PictureHearingTest cards disappeared instantly on emulator → added `minDisplayMs` guard (2s minimum)
4. ✅ **2x2 card grid layout** — Cards overflowed on small screens → fixed parent padding calculation
5. ✅ **Dual React bundling** — Multiple React copies in monorepo → blocked nested React 19.2.4

### Features Verified on Emulator
- ✅ PIN login (org zpedi, PIN 5678)
- ✅ Campaign selection (Chakradharpur School)
- ✅ Child list loaded
- ✅ Device & System Check dialog (camera, mic, AI engine all green)
- ✅ Module search bar on Screening page
- ✅ Hearing module: PictureHearingTest renders, demo phase works, real test phase works (1/12, Left Ear, Play Sound → 2x2 cards appear)
- ✅ Vision module: photo capture, quality gate, AI analysis card (showed "Unknown" due to Base64 bug — now fixed)

### Docs Created
- ✅ `production-spec.md` — complete spec (roles, 27 modules, API endpoints, DB schema, AI pipeline)
- ✅ `flow-diagrams.md` — 8 ASCII diagrams (architecture, campaign lifecycle, data flow, module flow, sync, AI tiers, 4D report)
- ✅ `SKIDS_ECOSYSTEM_MAP.md` — clear project separation (OPS vs SCREEN)

### Repos Renamed
- `zpediscreen` → `skids_PWA_next_vercel` (OPS — Vercel/Next.js)
- `skids-screen-v3` → `skids_rnaicf` (SCREEN — Cloudflare/RN/Hono)

### Latest Commit
- `a1dd817` on main — ecosystem map correction
- All pushed to `github.com/satishskid/skids_rnaicf`

---

## WHAT NEEDS TESTING NEXT SESSION

### Priority 1: Fix & Verify APK Works Standalone
The standalone APK had two issues:
- Debug APK tried to connect to Metro (red screen "Unable to load script") — JS bundle needs to be embedded
- After embedding, got `useRef of null` error — React version mismatch in monorepo

**Action**: Build a clean standalone APK with embedded JS bundle, test on real phone without Metro running.

### Priority 2: Module-by-Module Testing (27 modules)

Test each module for: **UI renders → Capture works → AI runs → Chips appear → Save succeeds → Sync works**

| Module | Capture | Test What | Status |
|--------|---------|-----------|--------|
| vision | photo (front) | Camera → Quality Gate → AI analysis → chips | 🔲 Retest (Base64 fix) |
| eyes_external | photo (front) | Camera → AI → chips | 🔲 |
| ear | photo (back) | Camera → AI → chips | 🔲 |
| hearing | form | HearingForm → PictureHearingTest → audiometry → chips | ✅ UI verified |
| dental | video (back) | Record → frame extraction → AI → chips | 🔲 |
| skin | photo (back) | Camera → AI → chips | 🔲 |
| general_appearance | photo (front) | Camera → AI → chips | 🔲 |
| height | value | Enter cm → WHO Z-score → classification | 🔲 |
| weight | value | Enter kg → WHO Z-score → classification | 🔲 |
| bmi | value | Auto-calc → Z-score | 🔲 |
| bp | value | Enter mmHg → percentile → classification | 🔲 |
| hemoglobin | value | Enter g/dL → threshold → classification | 🔲 |
| vitals | video (front) | rPPG heart rate from face video | 🔲 |
| respiratory | audio | AyuSync or mic → cough classification | 🔲 |
| cardiac | audio | AyuSync stethoscope → murmur detection | 🔲 |
| pulmonary | audio | AyuSync stethoscope → lung sounds | 🔲 |
| motor | video (back) | Pose estimation → DTW scoring | 🔲 |
| neurodevelopment | video (front) | Gaze + face detection → engagement | 🔲 |
| behavioral | video (front) | Behavioral protocol → markers | 🔲 |
| mchat | form | 16-item questionnaire → risk score | 🔲 |
| throat | photo (back) | Camera → clinical color | 🔲 |
| abdomen | photo (back) | Camera → assessment | 🔲 |
| spine | photo (back) | Camera → posture analysis | 🔲 |
| nails | photo (back) | Camera → clinical color | 🔲 |
| hair | photo (back) | Camera → assessment | 🔲 |
| lymph_nodes | photo (back) | Camera → assessment | 🔲 |
| vaccination | photo (back) | Camera → OCR card reading | 🔲 |

### Priority 3: Save & Sync Flow
- Save observation locally (AsyncStorage)
- Verify sync queue (`@skids/sync-queue`)
- Sync to server (`POST /api/observations`)
- Media upload to R2 (`POST /api/r2/presign` → PUT)
- Verify observation appears in web dashboard
- Test offline save → reconnect → auto-sync

### Priority 4: Doctor Review Flow
- Open web dashboard (`skids-web.pages.dev`)
- Login as admin/doctor
- View doctor inbox
- Open observation → see photo + AI + chips
- Submit review (approve/refer/retake)
- Verify review saved in DB

### Priority 5: End-to-End Campaign Flow
- Create campaign (web)
- Register child (mobile)
- Screen child through 5+ modules (mobile)
- Sync observations (mobile → API → DB)
- Doctor reviews observations (web)
- Generate 4D report (web)
- Release parent report (web)
- Parent views report via QR + DOB (public page)

### Priority 6: APK Distribution
- Fix APK download from OPS portal (was returning 401)
- Upload latest APK to R2
- Verify download from `skids-api.workers.dev/api/r2/apk`
- Verify download link in web sidebar works

---

## KNOWN BUGS TO FIX

| # | Bug | File | Fix Needed |
|---|-----|------|------------|
| 1 | APK tries to connect to Metro instead of embedded JS | `android/app/build.gradle` | Force `bundleInDebug = true` or build release APK |
| 2 | `useRef of null` in standalone bundle | Multiple React copies | pnpm overrides to force single React version |
| 3 | Neurodevelopment video capture not tested | `apps/mobile/src/lib/modules.ts` | Verify `captureType: 'video'` works with front camera |
| 4 | APK download 401 from OPS portal | Worker deployment | Redeploy worker with latest code |

---

## EMULATOR STATE

- **AVD**: `skids_test` (Pixel 6 Pro, API 34)
- **Launch**: `emulator -avd skids_test -gpu host`
- **Metro**: `cd apps/mobile && npx expo start` (port 8081)
- **App**: `com.skids.screen`
- **Last state**: App loaded, logged in as Sunita Devi, Chakradharpur campaign

---

## FILE STRUCTURE QUICK REF

```
/Users/spr/Desktop/skids-screen-v3/     ← skids_rnaicf repo
├── apps/
│   ├── mobile/                          ← SCREEN (React Native APK)
│   │   ├── src/screens/                 ← All screens
│   │   ├── src/lib/ai/                  ← AI analyzers (27 modules)
│   │   ├── src/lib/modules.ts           ← Module registry
│   │   ├── src/lib/sync-engine.ts       ← Offline sync
│   │   └── android/                     ← Gradle build
│   ├── worker/                          ← API (Hono on CF Workers)
│   │   ├── src/index.ts                 ← Route mounting
│   │   ├── src/routes/                  ← All API routes
│   │   └── wrangler.toml               ← CF config
│   └── web/                             ← WEB (Vite SPA)
│       └── src/pages/                   ← All web pages
├── packages/
│   ├── db/src/schema.sql                ← Database schema (19 tables)
│   └── shared/                          ← Shared TS utilities
└── .claude/memory/                      ← Session memory files
    ├── production-spec.md               ← Full spec
    ├── flow-diagrams.md                 ← Visual diagrams
    ├── SKIDS_ECOSYSTEM_MAP.md           ← Project separation
    └── session-handoff-2026-03-19.md    ← THIS FILE
```
