# SKIDS Ecosystem — Project Map

> **CRITICAL**: Two separate GitHub repos. Don't mix them up.

---

## EVOLUTION TIMELINE

```
zpediscreen (v1 → v2.1)              skids-screen-v3 (v3.x)
━━━━━━━━━━━━━━━━━━━━━━━              ━━━━━━━━━━━━━━━━━━━━━━
Next.js monolith                      Hono + RN monorepo
Vercel                                Cloudflare
Started first                         Built later as rewrite
Vercel Postgres                       Turso (libSQL)
NextAuth                              Better Auth + PIN auth
PWA (browser-based)                   Native APK + Worker API
```

The V2 (zpediscreen) was the **original project**. V3 (skids-screen-v3) was built as a **ground-up rewrite** with a different architecture. They are **two separate GitHub repos**, not branches of one.

---

## REPO 1: `zpediscreen` — "SKIDS OPS"

| | Detail |
|---|---|
| **Repo** | `github.com/satishskid/zpediscreen` → `/Users/spr/Desktop/zpediscreen/` |
| **Version** | 2.1.0 |
| **Tech** | Next.js 16, Tailwind, shadcn/ui, TypeScript |
| **Hosting** | **Vercel** (+ Cloudflare Pages mirror at `skids-ops.pages.dev`) |
| **Database** | Vercel Postgres / Neon |
| **Auth** | NextAuth.js (email + password) |
| **Type** | PWA — Progressive Web App (runs in browser, installable) |
| **Deploy** | `vercel --prod` → `skids-ai.vercel.app` |
| **Purpose** | Ops dashboard — campaign management, doctor review, analytics |

### What it does:
- ✅ Campaign CRUD, child management
- ✅ Doctor review inbox (approve/refer/retake)
- ✅ Population health analytics, 4D reports
- ✅ User management (admin panel)
- ✅ Clinical research (consent, instruments, studies)
- ✅ Parent portal (QR + DOB)
- ✅ APK download link
- ✅ Data export (CSV, FHIR)

### What it does NOT do:
- ❌ No native camera/mic capture
- ❌ No on-device AI
- ❌ No offline screening
- ❌ No field screening workflow
- ❌ Not a native mobile app

### Who uses it:
- **Admin** — full access
- **Ops Manager** — campaign + assignment management
- **Doctor** — review inbox, clinical decisions
- **Authority** — read-only population health

---

## REPO 2: `skids-screen-v3` — "SKIDS SCREEN"

| | Detail |
|---|---|
| **Repo** | `github.com/satishskid/skids-screen-v3` → `/Users/spr/Desktop/skids-screen-v3/` |
| **Version** | 3.3.0 (mobile), 3.1.0 (monorepo) |
| **Tech** | Monorepo: React Native (Expo) + Hono (CF Workers) + Vite SPA |
| **Hosting** | **Cloudflare** (Workers + Pages + R2) — NO Vercel |
| **Database** | Turso (libSQL/SQLite) |
| **Auth** | Better Auth (web) + PIN auth (mobile) |
| **Type** | Native Android APK + REST API + Lightweight web |
| **Deploy** | `wrangler deploy` (API), `wrangler pages deploy` (web) |
| **Purpose** | Field screening by nurses + API backend |

### Three sub-apps in the monorepo:

| Sub-app | Path | Tech | Deployed at |
|---------|------|------|-------------|
| **SCREEN** (Mobile) | `apps/mobile/` | React Native + Expo | APK on nurse's phone |
| **API** (Backend) | `apps/worker/` | Hono on CF Workers | `skids-api.satish-9f4.workers.dev` |
| **WEB** (Dashboard) | `apps/web/` | Vite + React SPA | `skids-web.pages.dev` |

### What it does:
- ✅ 27 screening modules (photo, video, audio, value, form)
- ✅ On-device AI (ONNX, pixel analysis, WHO Z-scores)
- ✅ Offline-first with sync queue
- ✅ PIN login for nurses
- ✅ Camera, microphone, NFC, Bluetooth
- ✅ AyuSync device integration (stethoscope)
- ✅ Quality gate (blur, exposure, framing)
- ✅ R2 media storage
- ✅ Lightweight web dashboard (mirrors some OPS features)

### Who uses it:
- **Nurse** — Mobile APK for field screening (primary user)
- **Doctor** — Web dashboard for quick reviews (secondary)
- **Admin** — Web dashboard for campaign monitoring (secondary)

---

## INFRASTRUCTURE COMPARISON

```
SKIDS OPS (zpediscreen)              SKIDS SCREEN (skids-screen-v3)
━━━━━━━━━━━━━━━━━━━━━━               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ┌──────────────┐                     ┌──────────────┐
  │  Vercel      │                     │  Cloudflare  │
  │  ┌────────┐  │                     │  ┌────────┐  │
  │  │Next.js │  │                     │  │ Worker │  │
  │  │  PWA   │  │                     │  │ (Hono) │  │
  │  └────┬───┘  │                     │  └────┬───┘  │
  │       │      │                     │       │      │
  │  ┌────▼───┐  │                     │  ┌────▼───┐  │
  │  │Vercel  │  │                     │  │ Turso  │  │
  │  │Postgres│  │                     │  │(libSQL)│  │
  │  └────────┘  │                     │  └────────┘  │
  └──────────────┘                     │       │      │
                                       │  ┌────▼───┐  │
  URLs:                                │  │  R2    │  │
  • skids-ai.vercel.app               │  │(media) │  │
  • skids-ops.pages.dev               │  └────────┘  │
                                       │              │
                                       │  ┌────────┐  │
                                       │  │ Pages  │  │
                                       │  │(Vite)  │  │
                                       │  └────────┘  │
                                       └──────────────┘

                                       URLs:
                                       • skids-api.satish-9f4.workers.dev
                                       • skids-web.pages.dev
                                       • APK on phone
```

---

## NAMING CONVENTION

Always use these names to avoid confusion:

| Short Name | Meaning | Repo | Infra |
|------------|---------|------|-------|
| **OPS** | SKIDS OPS Portal (PWA) | zpediscreen | Vercel |
| **SCREEN** | SKIDS Screen Mobile App | skids-screen-v3/apps/mobile | APK |
| **API** | SKIDS Screen Backend | skids-screen-v3/apps/worker | Cloudflare Workers |
| **WEB** | SKIDS Screen Web Dashboard | skids-screen-v3/apps/web | Cloudflare Pages |
| **DB** | SKIDS Database | skids-screen-v3/packages/db | Turso |

---

## DEPLOYMENT COMMANDS

| Project | Command | Result |
|---------|---------|--------|
| **OPS** | `cd zpediscreen && vercel --prod` | skids-ai.vercel.app |
| **API** | `cd skids-screen-v3/apps/worker && wrangler deploy` | skids-api.workers.dev |
| **WEB** | `cd skids-screen-v3/apps/web && pnpm build && wrangler pages deploy dist` | skids-web.pages.dev |
| **SCREEN** | `cd skids-screen-v3/apps/mobile/android && ./gradlew assembleDebug` | APK file |
| **DB** | `cd skids-screen-v3/packages/db && turso db shell` | SQL access |
