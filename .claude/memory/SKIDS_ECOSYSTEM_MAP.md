# SKIDS Ecosystem — Project Separation

> **CRITICAL**: These are TWO completely independent projects. Never mix them up.

---

## PROJECT 1: "SKIDS OPS" (V2 — Next.js PWA)

| | Detail |
|---|---|
| **Name** | SKIDS OPS Portal |
| **Repo** | `/Users/spr/Desktop/zpediscreen/` |
| **Tech** | Next.js 14, Tailwind, shadcn/ui, TypeScript |
| **Type** | Progressive Web App (PWA) — runs in browser |
| **Deployed** | `https://skids-ops.pages.dev` and `https://skids-ai.vercel.app` |
| **Database** | Vercel Postgres / Neon (NOT Turso) |
| **Auth** | NextAuth.js (email + password) |
| **Purpose** | **Operations dashboard for admins, doctors, ops managers, authorities** |

### What SKIDS OPS does:
- Campaign management (create, edit, monitor)
- User management (CRUD, role assignment)
- Doctor review inbox (approve/refer/retake observations)
- Population health analytics
- Clinical research (consent, instruments, studies)
- Parent report release
- APK download link (serves APK from its own infra)
- Data export (CSV, FHIR)

### Who uses SKIDS OPS:
- **Admin** — Full access
- **Ops Manager** — Campaign + assignment management
- **Doctor** — Review inbox, clinical decisions
- **Authority** — Read-only population health dashboards

### SKIDS OPS does NOT do:
- ❌ No field screening
- ❌ No camera/mic capture
- ❌ No on-device AI
- ❌ No offline mode
- ❌ Not used by nurses in the field

---

## PROJECT 2: "SKIDS SCREEN" (V3 — React Native + Hono)

| | Detail |
|---|---|
| **Name** | SKIDS Screen (Screening App + API + Web) |
| **Repo** | `/Users/spr/Desktop/skids-screen-v3/` |
| **Tech** | Monorepo: React Native (Expo) + Hono (CF Workers) + Vite SPA |
| **Type** | Mobile APK (Android) + Worker API + Lightweight web dashboard |
| **Deployed** | API: `skids-api.satish-9f4.workers.dev`, Web: `skids-web.pages.dev` |
| **Database** | Turso (libSQL/SQLite) |
| **Auth** | Better Auth (web) + PIN auth (mobile) |
| **Purpose** | **Field screening app for nurses + supporting API** |

### SKIDS SCREEN has 3 sub-apps:

#### 2A. Mobile App (`apps/mobile/`)
- Android APK installed on nurse's phone
- 27 screening modules (photo, video, audio, value, form)
- On-device AI (ONNX, pixel analysis, WHO Z-scores)
- Offline-first with sync queue
- PIN login (4-digit + org code)

#### 2B. Worker API (`apps/worker/`)
- Cloudflare Workers (Hono framework)
- REST API for all CRUD operations
- Turso database
- R2 media storage
- Better Auth sessions
- AI gateway (Gemini, Cloudflare AI)

#### 2C. Web Dashboard (`apps/web/`)
- Lightweight Vite SPA (React)
- Mirrors some SKIDS OPS features (dashboard, campaigns, doctor inbox)
- Used for quick access when full OPS portal isn't needed
- Deployed at `skids-web.pages.dev`

### Who uses SKIDS SCREEN:
- **Nurse** — Mobile APK for field screening
- **Doctor** — Web dashboard for quick reviews
- **Admin** — Web dashboard for campaign monitoring

---

## HOW THEY CONNECT

```
  SKIDS OPS (V2)                    SKIDS SCREEN (V3)
  ┌────────────────┐               ┌────────────────────────┐
  │ Next.js PWA    │               │  ┌──────────────────┐  │
  │                │               │  │ 📱 Mobile APK    │  │
  │ skids-ops.     │               │  │ (Nurse screening)│  │
  │ pages.dev      │               │  └────────┬─────────┘  │
  │                │               │           │             │
  │ Admin dashboard│               │  ┌────────▼─────────┐  │
  │ Doctor inbox   │               │  │ ⚡ Worker API     │  │
  │ Analytics      │  ◄── reads ── │  │ skids-api.       │  │
  │ Studies        │  ── same DB → │  │ workers.dev      │  │
  │ User mgmt     │               │  └────────┬─────────┘  │
  │                │               │           │             │
  │ Serves APK     │               │  ┌────────▼─────────┐  │
  │ download too   │               │  │ 🗄️ Turso DB      │  │
  │                │               │  │ 📦 R2 Media      │  │
  └────────────────┘               │  └──────────────────┘  │
                                   │                        │
                                   │  ┌──────────────────┐  │
                                   │  │ 🖥️ Web Dashboard  │  │
                                   │  │ skids-web.        │  │
                                   │  │ pages.dev         │  │
                                   │  │ (lightweight)     │  │
                                   │  └──────────────────┘  │
                                   └────────────────────────┘
```

---

## QUICK REFERENCE

| Question | Answer |
|----------|--------|
| "Where do I create campaigns?" | SKIDS OPS (V2) or SKIDS SCREEN Web (V3) |
| "Where does screening happen?" | SKIDS SCREEN Mobile APK (V3) only |
| "Where does the doctor review?" | SKIDS OPS (V2) — primary; SKIDS SCREEN Web (V3) — secondary |
| "Where are users managed?" | SKIDS OPS (V2) — admin panel |
| "Where does the nurse log in?" | SKIDS SCREEN Mobile APK (V3) — PIN pad |
| "Where is population health?" | SKIDS OPS (V2) |
| "Where is the APK download?" | Both — SKIDS OPS sidebar link + SKIDS SCREEN `/api/r2/apk` |
| "Which DB has the data?" | Turso (V3 Worker writes to it, V2 reads from it) |

---

## NAMING CONVENTION (use these consistently)

| Short Name | Full Name | Repo Path | URL |
|------------|-----------|-----------|-----|
| **OPS** | SKIDS OPS Portal | `/Users/spr/Desktop/zpediscreen/` | skids-ops.pages.dev |
| **SCREEN** | SKIDS Screen App | `/Users/spr/Desktop/skids-screen-v3/apps/mobile/` | APK on phone |
| **API** | SKIDS Screen API | `/Users/spr/Desktop/skids-screen-v3/apps/worker/` | skids-api.workers.dev |
| **WEB** | SKIDS Screen Web | `/Users/spr/Desktop/skids-screen-v3/apps/web/` | skids-web.pages.dev |
| **DB** | SKIDS Database | `/Users/spr/Desktop/skids-screen-v3/packages/db/` | Turso cloud |

---

## DEPLOYMENT COMMANDS

| Project | Command | Result |
|---------|---------|--------|
| OPS (V2) | `cd zpediscreen && vercel --prod` | skids-ops.pages.dev |
| API (V3) | `cd skids-screen-v3/apps/worker && wrangler deploy` | skids-api.workers.dev |
| WEB (V3) | `cd skids-screen-v3/apps/web && pnpm build && wrangler pages deploy dist` | skids-web.pages.dev |
| SCREEN (V3) | `cd skids-screen-v3/apps/mobile/android && ./gradlew assembleDebug` | APK file |
