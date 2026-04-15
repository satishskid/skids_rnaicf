# SKIDS Screen V3 — System Workflow (Current vs. Target)

This doc exists so everyone shares the same mental model before we start building. It shows what runs where, what already works, and where each phase of the edge-stack plan plugs in.

---

## Personas and their surfaces

| Persona | Surface | Lives in |
|---|---|---|
| Nurse (field screener) | Expo mobile app on Android tablet | `apps/mobile` |
| Doctor (reviewer) | Web dashboard + mobile review screen | `apps/web` + `apps/mobile/src/screens/DoctorReviewScreen.tsx` |
| Parent | Web parent portal + PDF report | `apps/web/src/pages/ParentPortal.tsx` + `ParentReport.tsx` |
| Admin / Org owner | Web admin pages | `apps/web/src/pages/{UserManagement,Settings,Campaigns,Analytics}.tsx` |
| Authority (district / govt) | Authority dashboard | `apps/web/src/pages/AuthorityDashboard.tsx` |
| Researcher (IRB-approved) | DuckDB (Phase 4) + optional MotherDuck (Phase 8 deferred) | external |

---

## CURRENT STATE — end-to-end flow

```
 ┌─────────────── DEVICE (offline-capable) ───────────────┐
 │                                                        │
 │  Nurse taps module → Camera / Mic / form input         │
 │          │                                             │
 │          ▼                                             │
 │  Quality gate (blur, exposure, framing, flash)         │
 │          │ pass                                        │
 │          ▼                                             │
 │  Tier 1 on-device AI:                                  │
 │   • jpeg-js pixel analysis (red reflex, clinical color)│
 │   • ONNX inference (photoscreening, ear, skin, dental) │
 │   • MediaPipe (face, pose, landmarks)                  │
 │   • Rule-based scoring (M-CHAT, motor tasks, audiometry)│
 │          │                                             │
 │          ▼                                             │
 │  Tier 2 on-device ensemble → AIAnnotation[]            │
 │          │                                             │
 │          ▼                                             │
 │  Nurse reviews, adds chips, confirms → save observation│
 │          │                                             │
 │          ├── offline: sync-engine queue                │
 │          │                                             │
 │          ▼                                             │
 │  POST /api/observations (online) ──┐                   │
 │                                    │                   │
 │  If Tier 3 cloud AI needed:        │                   │
 │  POST /api/ai/vision (placeholder) │                   │
 │                                    │                   │
 └────────────────────────────────────┼───────────────────┘
                                      │
 ┌─── CLOUDFLARE WORKER (skids-api, Hono) ────────────────┐
 │                                    ▼                   │
 │  Better Auth / PIN auth / Firebase-compat middleware   │
 │          │                                             │
 │          ▼                                             │
 │  Route: observations, campaigns, children, reviews,    │
 │         studies, consents, r2, ai-gateway, ai-config,  │
 │         export, audit-log, pin-auth, welchallyn,       │
 │         ayusync, parent-portal, reports-tokens, ...    │
 │          │                                             │
 │          ▼                                             │
 │   Turso (libSQL, 1 primary, replicas)                  │
 │          │       • campaigns, children, observations,  │
 │          │         studies, consents, instruments,     │
 │          │         sessions, audit_log, ai_usage       │
 │          │       • embedding F32_BLOB(384)  ← RESERVED │
 │          │         (column defined but commented out)  │
 │          │                                             │
 │   R2 (skids-media)                                     │
 │          │       • photo/video/audio from screenings   │
 │          │       • presigned URLs for upload/download  │
 │          │                                             │
 │   Workers AI binding (bound, rarely used today)        │
 │   Gemini API direct (hot path for /api/ai/vision)      │
 │                                                        │
 └────────────────────────────────────────────────────────┘
                                      │
 ┌─── EXTERNAL ───────────────────────┴───────────────────┐
 │  • AyuSynk devices (stethoscope etc.) via webhook      │
 │  • Welch Allyn vitals devices                          │
 │  • BHASH WhatsApp (parent notifications)               │
 │  • Neodove CRM (leads)                                 │
 │  • Razorpay (payments, thrive-care repo)               │
 └────────────────────────────────────────────────────────┘
                                      │
 ┌─── DOCTOR ────────────────────────┴────────────────────┐
 │  Web DoctorInbox → reviews observation →               │
 │  writes clinician_review JSON → POST /api/reviews      │
 │  When all reviews complete: campaigns.reports_released=1│
 └────────────────────────────────────────────────────────┘
                                      │
 ┌─── PARENT ────────────────────────┴────────────────────┐
 │  Parent portal (/p/<qr_code>) or WhatsApp link         │
 │  → /api/report-tokens issues token                     │
 │  → ParentReport.tsx renders HTML (not PDF yet)         │
 └────────────────────────────────────────────────────────┘
```

### What works today (per FEATURE_AUDIT.md)

- Nurse login (PIN + email fallback), campaign list, campaign detail, register child, screening grid, 17 head-to-toe modules + 7 vitals modules
- Capture (camera, video, audio, value, form) with annotation chips
- 3-tier AI pipeline mobile-side with quality gates
- Offline sync engine
- Doctor review screen (mobile + web)
- Parent portal + HTML report
- REDCap-style studies, arms, events, instruments, enrollments
- Consent management
- Audit log

### What is placeholder / half-wired today

- `/api/ai/vision` route — works via direct Gemini call, NO caching, NO failover, NO Langfuse trace
- `/api/ai/analyze` — literal placeholder returning a stub
- Turso vector column — column defined in schema.sql but commented; no embed, no similarity search
- Langfuse secrets declared in Bindings but no client code
- Population-analytics and cohort-analytics computed inline per request (slow at scale)
- Reports generated as HTML only; no PDF; `campaigns.archive_url` reserved but empty
- No async workflow — everything is sync request/response
- No server-side heavier AI — Tier 3 is cloud LLM only, and cloud LLM sees a rough prompt, not a proper vision pipeline
- No evidence RAG in doctor review

---

## TARGET STATE — after Phases 0–7 land

```
 ┌─────────────── DEVICE (unchanged for nurse UX) ────────┐
 │  SAME AS TODAY — on-device Tier 1/2, quality gate,     │
 │  offline sync. No latency regression.                  │
 └───────────────────────────┬────────────────────────────┘
                             │
 ┌─── CLOUDFLARE WORKER ─────┴────────────────────────────┐
 │                                                        │
 │  POST /api/observations                                │
 │    ├── INSERT into Turso                               │
 │    ├── START Workflow: screening-observation (Ph 5)    │
 │    └── Return 200 in <200ms                            │
 │                                                        │
 │  Workflow steps:                                       │
 │    1. load observation                                 │
 │    2. compute/persist quality gate                     │
 │    3. embed → Turso F32_BLOB(384)          ← Phase 1   │
 │    4. if low-confidence/medium-risk:                   │
 │         enqueue sandbox-second-opinion     ← Phase 6   │
 │    5. waitForEvent doctor-review-complete  (up to 72h) │
 │    6. on release: enqueue sandbox-pdf       ← Phase 3  │
 │    7. notify parent via BHASH                          │
 │                                                        │
 │  /api/ai/vision (hot path, sync)                       │
 │    AIGateway.vision (Phase 2):                         │
 │      ├── cf-aig-cache-key check                        │
 │      ├── gemini → claude → workers-ai failover         │
 │      ├── ai_usage row + Langfuse span                  │
 │      └── return to nurse (no regression vs today)      │
 │                                                        │
 │  /api/similarity/observations  (Phase 1)               │
 │    cosine search on Turso F32_BLOB                     │
 │                                                        │
 │  /api/evidence/search  (Phase 7)                       │
 │    Vectorize query on curated evidence index           │
 │                                                        │
 │  /api/reviews/:id/context  (Phase 7)                   │
 │    parallel: evidence + similar cases                  │
 │                                                        │
 │  /api/reports/render + /serve/:token  (Phase 3)        │
 │    cache-key lookup → Sandbox WeasyPrint → R2          │
 │                                                        │
 └────────────────────────────────────────────────────────┘
                             │
 ┌─── ASYNC LANE (Sandbox) ──┴────────────────────────────┐
 │                                                        │
 │  Queue: sandbox-pdf  (Phase 3)                         │
 │    └── WeasyPrint image renders FourD/Child/Parent PDF │
 │         → R2://reports/<type>/<childId>/<hash>.pdf     │
 │                                                        │
 │  Queue: sandbox-second-opinion  (Phase 6)              │
 │    └── Python + onnxruntime in Sandbox                 │
 │         ├── pulls media from R2                        │
 │         ├── loads larger model per module manifest     │
 │         ├── produces AIAnnotation[] (tier="secondary") │
 │         ├── agreement_score vs Tier 1                  │
 │         └── inserts to ai_annotations_secondary        │
 │                                                        │
 │  Queue: analytics-trigger                              │
 │    └── fires partial refresh on high-priority events   │
 │                                                        │
 │  DLQ per queue → Langfuse alert + audit_log            │
 │                                                        │
 └────────────────────────────────────────────────────────┘
                             │
 ┌─── NIGHTLY (analytics-worker) ─┴───────────────────────┐
 │                                                        │
 │  02:00 IST cron  (Phase 4)                             │
 │    Turso → Parquet (zstd) → R2://skids-analytics/v1/   │
 │      partitioned by table + campaign + dt              │
 │    Publishable de-identified views materialized        │
 │                                                        │
 │  DuckDB REPL (analyst-side)                            │
 │    5 canonical queries:                                │
 │      Q1 chip-vs-AI agreement heatmap                   │
 │      Q2 AI spend by provider × module                  │
 │      Q3 red-flag prevalence by campaign/age/gender     │
 │      Q4 screener throughput + P95 observation time     │
 │      Q5 time-to-doctor-review distribution             │
 │                                                        │
 │  /api/analytics/run  (in-app dashboards, Phase 4)      │
 │    service-binding → analytics-worker → DuckDB         │
 │                                                        │
 │  (Phase 8 DEFERRED: MotherDuck per-study share)        │
 │                                                        │
 └────────────────────────────────────────────────────────┘
                             │
 ┌─── DOCTOR ────────────────┴────────────────────────────┐
 │  DoctorInbox expands observation:                      │
 │    • Tier 1 badge (mobile)                             │
 │    • Secondary badge + agreement_score (Phase 6)       │
 │    • Evidence panel (Phase 7)                          │
 │    • Similar past cases (Phase 1 + 7)                  │
 │    • "Request second opinion" button (Phase 6)         │
 │  Doctor writes clinician_review → fires workflow event │
 └────────────────────────────────────────────────────────┘
                             │
 ┌─── PARENT ────────────────┴────────────────────────────┐
 │  Same portal, now with signed PDF link (Phase 3)       │
 │  token → HMAC verify → stream from R2                  │
 └────────────────────────────────────────────────────────┘
```

---

## Where the nurse screening module actually gets better

Not directly from Sandbox. The improvements compound through a feedback loop:

1. **Phase 6 second opinion** writes `ai_annotations_secondary` + `accuracy_metrics` rows
2. **Phase 4 DuckDB Q1** surfaces which modules × age bands the on-device Tier 1 gets wrong
3. **You publish a better ONNX model** via `scripts/publish-model.sh` to R2 + manifest
4. **Mobile's `model-loader-mobile.ts`** pulls the new model at next boot
5. **Next screening** uses the improved model, on-device, same fast UX

Sandbox's role is to generate the evidence that says "model X v2.1 is better than v2.0 for ear module ages 5–7." It does not sit in the nurse's response time.

The *direct* nurse-side improvement in this plan comes from:
- Phase 2 making `/api/ai/vision` cached + failover (so online Tier 3 is faster and never fully fails)
- Nothing else. The mobile pipeline you already built is doing the work.

---

## Where Sandbox DOES sit in the response path

Only for PDF report serving (Phase 3) — but even there, the first render is async (queue → Sandbox → R2) and subsequent serves are direct R2 streams. A parent clicking the report link hits R2, not Sandbox.

---

## Data residency snapshot (target)

| Data | Home | PHI? |
|---|---|---|
| Turso primary | ap-south-1 (Mumbai) | Yes |
| R2 skids-media | APAC | Yes (media) |
| R2 skids-analytics (raw) | APAC | Yes |
| R2 skids-analytics (publishable) | APAC | No (de-identified) |
| R2 skids-models | APAC | No |
| R2 skids-evidence | APAC | No |
| Vectorize skids-evidence | global, evidence-only | No |
| Langfuse | self-hosted Mumbai OR redacted-spans cloud | No (redacted) |
| AI Gateway | pinned APAC | Yes in transit |
| MotherDuck (if enabled later) | US | No (aggregates only) |

---

## What to decide before starting

1. **Langfuse**: self-host in Mumbai (1 day infra work) or start cloud with PHI redaction only. Recommendation: start cloud with redaction, migrate to self-host in Phase 2.5 once the rest is green.
2. **AI Gateway slug**: pick `skids-screen` or similar and create it in CF dashboard during Phase 0.
3. **Sandbox pre-warm hours**: the plan assumes 9–18 IST business hours — confirm this matches your campaign timing.
4. **Feature-flag default**: every new capability defaults to OFF per org. Confirm this conservative posture is what you want.

---

## What success looks like (day of first 7-phase complete campaign)

- Nurse completes a 40-child school campaign offline, syncs at end of day
- Within 30 minutes, second opinions land for every low-confidence observation
- Doctor opens DoctorInbox next morning, sees evidence + similar cases inline, reviews 40 children in <2 hours
- `reports_released` flipped → 40 PDFs render in Sandbox within 15 min → 40 WhatsApp links go out via BHASH
- Next morning, authority dashboard shows the campaign's red-flag prevalence pulled from DuckDB
- Langfuse trace exists for every AI call; ai_usage shows the campaign's total cloud spend
- Zero PHI leaks flagged in any trace / log / DLQ
