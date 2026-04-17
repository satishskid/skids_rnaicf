# SKIDS Edge-Stack v1 — System Blueprint

**Status:** Live in production as of 2026-04-17.
**Audience:** Tech, business, ops, clinical — this is the single source of truth.
**Supersedes:** `docs/SYSTEM_WORKFLOW.md` (historical, pre-Phase-01).

---

## 1 · What this platform does, in one paragraph

SKIDS Screen is an offline-capable pediatric screening platform. A nurse uses an Android tablet to capture vitals, imagery, and behavioural observations of a child; three tiers of AI (on-device, cloud-gateway, server-side second-opinion) classify findings; a doctor reviews flagged cases in a web inbox backed by vector-similarity + retrieval-augmented evidence; the parent receives a signed PDF report with QR-verified access; every artefact is auditable, exportable, and rolled up into a nightly analytics pipeline that clinical ops + researchers consume.

---

## 2 · Who uses it

| Persona | Surface | What they need | What they create |
|---|---|---|---|
| **Nurse** (field screener) | Expo mobile app, offline-first | Fast capture, on-device AI, sync when online | Observations, media, Tier-1 AI annotations |
| **Doctor** (reviewer) | Web DoctorInbox + mobile review | Tier-2 cloud AI, evidence, similar cases, one-click decisions | Reviews (approve/refer/follow-up/discharge/retake), second-opinion requests |
| **Parent** | Web Parent Portal + QR-signed PDF | Plain-language report in their language, anywhere | Consents, follow-up intent |
| **Admin / Ops manager** | Web admin pages | Campaign setup, user management, fleet readiness | Campaigns, assignments, reports release |
| **Clinical ops / Researcher** | Analytics dashboard, parquet exports | Aggregate metrics, cohort queries, IRB-safe data | Study cohorts, canonical-query runs |
| **Authority / District officer** | Authority dashboard | Scoped campaign visibility (assigned only) | Approvals, escalations |

---

## 3 · Stack in one glance

```mermaid
flowchart LR
  subgraph Device["DEVICE — Nurse tablet (offline-first)"]
    CAM[Capture: camera / mic / form]
    QG[Quality gate]
    T1[Tier 1 on-device AI<br/>ONNX + MediaPipe + rules]
    T2OD[Tier 2 on-device ensemble]
  end

  subgraph CF["CLOUDFLARE perimeter (APAC)"]
    API[skids-api Worker<br/>Hono + Better Auth]
    WF((Workflow:<br/>ScreeningObservation))
    Q1[/Queue<br/>sandbox-pdf/]
    Q2[/Queue<br/>sandbox-2nd-opinion/]
    Q3[/Queue<br/>analytics-trigger/]
    SB[[Sandbox AI container<br/>deferred]]
    AG[AI Gateway<br/>→ Groq / Anthropic / Gemini]
    LF[Langfuse traces]
    VEC[(Vectorize<br/>skids-evidence<br/>147 chunks)]
    AI[Workers AI<br/>bge-small-en-v1.5]
    ANL[skids-analytics Worker<br/>nightly cron]
  end

  subgraph Data["DATA plane"]
    TURSO[(Turso libSQL<br/>observations · reviews · audit<br/>workflow_events · accuracy_metrics<br/>embedding F32_BLOB)]
    R2M[(R2 skids-media)]
    R2R[(R2 skids-reports)]
    R2Mod[(R2 skids-models)]
    R2A[(R2 skids-analytics<br/>Parquet)]
  end

  subgraph Clients["CLIENTS"]
    WEB[DoctorInbox<br/>Admin · Parent portal]
    MOB[Expo mobile]
    PAR[Parent link + QR]
  end

  CAM --> QG --> T1 --> T2OD --> API
  MOB -. offline queue .-> API
  API --> TURSO
  API --> R2M
  API -->|FEATURE_USE_WORKFLOW=1| WF
  WF --> TURSO
  WF --> AI
  WF --> Q2
  WF --> Q3
  Q2 -. when SANDBOX_AI bound .-> SB
  SB --> R2Mod
  Q3 --> ANL
  API --> AG
  AG --> LF
  API --> AI
  AI --> VEC
  WEB --> API
  PAR --> API
  API --> R2R
  ANL --> TURSO
  ANL --> R2A
```

---

## 4 · The four primary journeys

### 4.1 Nurse captures a screening

```mermaid
sequenceDiagram
  autonumber
  participant N as Nurse (mobile)
  participant D as Device AI
  participant API as skids-api
  participant WF as Workflow
  participant T as Turso
  participant AI as Workers AI
  participant Q as Queues

  N->>D: Capture photo / audio / form
  D->>D: Quality gate + Tier-1 ONNX + Tier-2 ensemble
  D-->>N: AIAnnotation[]
  N->>N: Review chips, confirm/correct
  N->>API: POST /api/observations
  alt FEATURE_USE_WORKFLOW=1 (live 2026-04-17)
    API->>WF: SCREENING_WF.create(params)
    API-->>N: 202 { id, workflowId }
    WF->>T: persist (INSERT OR REPLACE)
    WF->>WF: quality-gate (confidence, riskLevel, needsSecondOpinion)
    WF->>AI: embed (bge-small-en-v1.5)
    AI->>T: UPDATE embedding F32_BLOB
    WF->>Q: enqueue sandbox-second-opinion (if needed)
    WF->>WF: await 'doctor-review' event (timeout 72h)
  else fallback (flag off)
    API->>T: INSERT observations
    API-->>N: 201 { id }
  end
```

**Key latencies observed:** persist 691 ms · quality-gate 0 ms · embed 69 ms · enqueue skipped in happy path. Doctor receives the inbox row within 1 s of sync.

---

### 4.2 Doctor reviews

```mermaid
sequenceDiagram
  autonumber
  participant Doc as Doctor (web)
  participant API as skids-api
  participant T as Turso
  participant VEC as Vectorize (skids-evidence)
  participant SIM as Similarity (Turso vectors)
  participant WF as Workflow instance
  participant Q as sandbox-2nd-opinion

  Doc->>API: GET /api/observations?campaign=...
  API->>T: SELECT * FROM observations
  API-->>Doc: list
  Doc->>API: Expand observation → GET /api/reviews/:id/context
  par parallel
    API->>VEC: evidenceSearch(query, topK=5)
    VEC-->>API: evidence hits + metadata
  and
    API->>SIM: similarityRoutes internal fetch
    SIM->>T: libsql_vector_top_k(embedding)
    SIM-->>API: top-5 similar observations
  end
  API-->>Doc: { evidence[], similarCases[], query }
  Doc->>API: (optional) POST /api/observations/:id/second-opinion
  API->>Q: enqueue SandboxSecondOpinionMessage
  Q->>Q: consumer: budget check + pending row + container call
  Doc->>API: PATCH /api/observations/:id/doctor-review
  API->>T: UPDATE clinician_review + INSERT training_samples
  API->>WF: sendEvent('doctor-review') — workflow await-review resolves
  WF->>Q: analytics-trigger ('observation-reviewed')
  WF->>T: workflow_events: notify ok
```

---

### 4.3 Parent gets their report

```mermaid
sequenceDiagram
  autonumber
  participant Admin as Admin / Ops
  participant API as skids-api
  participant R2 as R2 skids-reports
  participant PP as Parent Portal
  participant P as Parent
  participant SMS as Delivery (SMS / WhatsApp)

  Admin->>API: POST /api/reports/render (admin/ops_manager only)
  API->>API: renderTemplate (satori + resvg-wasm + pdf-lib)
  API->>R2: put PDF bytes
  API->>API: issueToken (HMAC over reportId)
  API-->>Admin: { reportUrl, token } (token returned ONCE)
  Admin->>SMS: deliver link to parent
  P->>API: GET /api/reports/:id/pdf?t=<token>.<hmac>
  API->>API: verifyToken (HMAC) — url IS the auth
  API->>R2: fetch PDF
  API-->>P: stream PDF
  P->>PP: (alternative) scan QR on health card
  PP->>API: POST /api/parent-portal/lookup + /verify (DOB)
  API-->>PP: my-children + reports
```

Cron pre-warm runs every 10 min during 03:00–12:00 UTC (= 08:30–17:30 IST) when `FEATURE_REPORT_PREWARM=1`.

---

### 4.4 Analytics + research

```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron 20:30 UTC
  participant ANL as skids-analytics Worker
  participant T as Turso (read-only token)
  participant R2A as R2 skids-analytics
  participant API as skids-api
  participant Ops as Ops / researcher
  participant Q as analytics-trigger queue

  Cron->>ANL: scheduled()
  ANL->>T: SELECT … where created_at > cursor
  ANL->>R2A: write Parquet partitions (v1/<table>/<isoDate>/)
  ANL->>T: update analytics_cursor
  Ops->>API: POST /api/analytics/run { queryId: Q1 }
  API->>ANL: service binding /run
  ANL->>T: canonical query (allow-list Q1–Q5)
  ANL-->>Ops: { columns, rows, engine: turso }
  Note over Q: Review events also enqueue<br/>analytics-trigger messages,<br/>processed by the consumer
```

Canonical queries: Q1 module/age × agreement, Q2 disagreement trends, Q3 module coverage, Q4 doctor throughput, Q5 campaign-level rollup.

---

## 5 · Infrastructure inventory (live)

| Layer | Resource | Purpose | Binding / key |
|---|---|---|---|
| **Compute** | `skids-api` Worker | Main API, Hono | [apps/worker](apps/worker) |
| | `skids-analytics` Worker | Nightly Parquet + `/run` proxy | [apps/analytics-worker](apps/analytics-worker) |
| | `ScreeningObservationWorkflow` | Durable per-observation flow | binding `SCREENING_WF` |
| **Queues** | `sandbox-pdf` (+ DLQ) | Report render fan-out | `SANDBOX_PDF_Q` |
| | `sandbox-second-opinion` (+ DLQ) | ONNX re-analysis | `SANDBOX_2ND_OPINION_Q` |
| | `analytics-trigger` (+ DLQ) | Review-driven refresh | `ANALYTICS_Q` |
| **Vector** | Vectorize `skids-evidence` | 147 chunks · 384-dim cosine | `EVIDENCE_VEC` |
| | Turso native vectors | Observation embeddings `F32_BLOB(384)` | `libsql_vector_idx` |
| **AI** | Workers AI | `@cf/baai/bge-small-en-v1.5` | `AI` |
| | AI Gateway | Groq → Anthropic → Gemini overflow | `AI_GATEWAY_ID=skids-screen` |
| | Langfuse | LLM trace observability | `LANGFUSE_*` secrets |
| **Storage** | Turso `skids-screen-v3` | libSQL primary + replicas | `TURSO_URL` secret |
| | R2 `skids-media` | Nurse uploads | `R2_BUCKET` |
| | R2 `skids-reports` | Rendered PDFs | `R2_REPORTS_BUCKET` |
| | R2 `skids-models` | ONNX / Liquid AI weights | `R2_MODELS_BUCKET` |
| | R2 `skids-analytics` | Nightly Parquet | `ANALYTICS_R2` |
| **Cron** | `*/10 3-12 * * *` | Parent-window PDF pre-warm | `FEATURE_REPORT_PREWARM` |
| | `30 20 * * *` | Nightly analytics export | `FEATURE_ANALYTICS_CRON` |

---

## 6 · Feature flag registry (current state)

| Flag | Where | Value | What it gates | Rollback |
|---|---|---|---|---|
| `FEATURE_TURSO_VECTORS` | worker env | default ON | Phase 01 similarity search | set `"0"` |
| `FEATURE_AI_GATEWAY` | worker env | default ON | Phase 02 gateway routing | set `"0"` |
| `FEATURE_REPORT_PREWARM` | worker env | `0` | Phase 03 cron pre-warm | flip to `"1"` when ready |
| `FEATURE_ANALYTICS_CRON` | analytics env | `1` | Nightly Parquet export | set `"0"` |
| `FEATURE_DUCKDB_ANALYTICS` | worker env | `1` | `/api/analytics/run` | set `"0"` |
| `FEATURE_USE_WORKFLOW` | worker env | `1` | Phase 05 durable workflow | set `"0"` + redeploy |
| `FEATURE_EVIDENCE_RAG` | worker env | `1` | Phase 07 evidence search + `/context` | set `"0"` |

All flags live in `apps/worker/wrangler.toml` or `apps/analytics-worker/wrangler.toml` — toggles are git-tracked and rolled out via `wrangler deploy`.

---

## 7 · Database entities (who writes what)

```mermaid
erDiagram
  campaigns ||--o{ children : "has"
  campaigns ||--o{ campaign_assignments : "scoped to"
  children ||--o{ observations : "examined in"
  observations ||--o{ reviews : "decided by"
  observations ||--o{ ai_annotations_secondary : "re-analyzed"
  observations ||--o{ workflow_events : "orchestrated"
  observations ||--o{ accuracy_metrics : "evaluated"
  campaigns ||--o{ audit_log : "traced"
  observations {
    text id PK
    text session_id
    text workflow_id
    F32_BLOB embedding
    integer risk_level
  }
  ai_annotations_secondary {
    text id PK
    text model_version
    text status
    real agreement_tier1
  }
  session_ai_budget {
    text session_id PK
    integer second_opinion_count
    integer budget_limit
  }
  evidence_index_version {
    integer id PK
    integer version
    integer chunk_count
  }
```

Migrations live in [packages/db/src/migrations](packages/db/src/migrations). Schema snapshot is [packages/db/src/schema.sql](packages/db/src/schema.sql).

---

## 8 · Safety nets + observability

| Concern | Mechanism | Signal |
|---|---|---|
| **Nurse blocked by server** | Every observation write is idempotent + the inline path is a 1-flag rollback | `POST /api/observations` P95 < 200 ms |
| **AI hallucination** | 3-tier confidence gate: on-device → cloud → doctor | `accuracy_metrics.agreement_score` rolling |
| **Cost runaway** | `session_ai_budget` caps second-opinions at 5/session | `queue.second-opinion.budget-exhausted` audit rows |
| **Poison queue message** | 3 retries → DLQ → `audit_log` + Langfuse error trace | `queue.dlq.*` audit rows |
| **Workflow stuck** | 72 h timeout on `await-review`, then workflow records `timeout` and continues | `workflow_events.status = 'timeout'` |
| **PHI leakage** | All media stays in R2 APAC; Vectorize only stores 280-char previews of curated corpus; no patient text in Vectorize metadata | Residency doc: [docs/RESIDENCY.md](docs/RESIDENCY.md) |
| **PDF link leakage** | URL IS the auth — HMAC over `reportId` with 30-d TTL; parent DOB verification on portal | `report_access_tokens` hashed rows |
| **Audit everything** | `logAudit()` called from every write route; append-only `audit_log` | `audit_log` table |
| **LLM traces** | Every cloud AI call → AI Gateway → Langfuse | Langfuse dashboard |

---

## 9 · What's still deferred (known gaps)

| Item | Why it's deferred | Unblocker |
|---|---|---|
| **Sandbox AI container image** | Open-beta `[[containers]]` API + Docker image build needs host-side tooling | Run `docker build apps/worker/sandbox-ai` → `wrangler containers push` → uncomment `[[containers]]` in wrangler.toml |
| **Parent SMS/WhatsApp delivery** | Out of scope for v1; report URL generation is live, last-mile is manual | Wire `scripts/publish-model.sh`-style delivery adapter |
| **PDF render inside workflow** | Report render is admin-endpoint today; Phase 05 `sandbox-pdf` queue is a stub | Replace consumer body with a `renderTemplate()` call |
| **Doctor inbox SecondOpinionBadge in row header** | `ObservationContextPanel` shows it in the expand pane; row-level badge needs secondary annotation loaded in list query | Extend `GET /api/observations` select to join `ai_annotations_secondary` |
| **MotherDuck / researcher SQL** | Phase 8 originally scoped; not needed for v1 | External DuckDB reads Parquet directly |

---

## 10 · Glossary

| Term | Meaning |
|---|---|
| **Tier 1** | On-device AI (ONNX, MediaPipe, jpeg-js pixel math) — runs offline, <1 s |
| **Tier 2** | Cloud AI via AI Gateway (Groq primary, Anthropic/Gemini overflow) — doctor-only |
| **Secondary** | Server-side ONNX re-analysis in the Sandbox AI container — Phase 06, budget-gated |
| **Observation** | One captured media + AI annotation pair — the atomic clinical event |
| **Session** | A child's full screening across all modules — bounded by `session_id` |
| **Campaign** | An organisational scope (school, district, clinic week) — bounded by `campaign_code` |
| **Canonical query** | One of Q1–Q5 — allow-listed de-identified aggregates for analytics |
| **RAG** | Retrieval-augmented generation — here, evidence lookup into curated clinical corpus |
| **HMAC report token** | Signed URL for parent PDF access; URL itself carries the auth |

---

## 11 · Where to look when things break

| Symptom | First place | Runbook |
|---|---|---|
| Nurse can't sync | `skids-api` `/api/health`, Turso dashboard | [docs/RUNBOOK.md](docs/RUNBOOK.md) |
| Doctor inbox blank | `GET /api/observations` + `authMiddleware` logs | RUNBOOK |
| Workflow stuck | `wrangler workflows instances list screening-observation` | RUNBOOK Phase 05 section |
| Queue backed up | `wrangler queues consumer get <queue>` | RUNBOOK Phase 05 section |
| Evidence search empty | `wrangler vectorize info skids-evidence` · `FEATURE_EVIDENCE_RAG` value | RUNBOOK Phase 07 |
| Analytics stale | last row in `analytics_runs` + cron trigger | RUNBOOK Phase 04 |
| Second-opinion pending | `ai_annotations_secondary.status` · `SANDBOX_AI` binding present? | Deferred: container not yet deployed |

---

_Last updated: 2026-04-17 · author: edge-stack rollout · next review: after Phase 06 container ships._
