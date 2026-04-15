# Phase 03 — Sandbox PDF reports: 15-minute architectural plan

**Date:** 2026-04-15
**Status:** DRAFT for review. No code yet.
**Authors:** claude-code
**Scope:** Planning only. Implementation branch `phase/03-sandbox-pdfs` to be created after this doc is approved.
**Companion phase:** Phase 02a (on-device Liquid AI) runs in parallel in a separate session. Overlap is limited to `wrangler.toml` (new bindings block each) and `specs/STATUS.md` (own row).
**Related:** `specs/03-sandbox-pdf-reports.md` (baseline spec).

---

## Scope clarification vs baseline spec

The baseline spec committed to **Cloudflare Sandbox + WeasyPrint (Python)** for rendering. That remains the default. This plan records the architecture, the known deviations, and the decisions that fell out of the integration review below.

Two deviations from the baseline spec, both requested by reviewers:

1. Capture and document a **JS-first alternative** (satori + resvg-js in Worker) so we have a no-Sandbox escape hatch if Sandbox GA pricing or cold-start latency hurts us in staging. Decision is still WeasyPrint; the alternative is planning-only.
2. The baseline spec's route name (`report-render.ts` + `/api/reports/render`) is preserved. The reviewer's target `/api/reports/:id/pdf` is added as a GET alias that resolves `:id` = `token` and proxies to the serve-via-token path.

No changes to module-type schemas, R2 bucket naming, or HMAC signing strategy from the baseline spec.

---

## 1. PDF generation approach

**Recommendation: WeasyPrint inside Cloudflare Sandbox (baseline spec preserved). JS-first is the escape hatch.**

| Option | Fit | Pros | Cons | Decision |
|---|---|---|---|---|
| **WeasyPrint (Python) in Sandbox** | Deterministic HTML→PDF, server-side, no Chromium. Supports @font-face, CSS paged media, Noto CJK, complex tables, SVG charts. | Mature. Output byte-identical given same input. Font bundling is just `fonts-noto fonts-noto-cjk`. | Sandbox cold-start ≈ 3–5s first hit; needs pre-warm cron. Python runtime is a net-new dep. | **CHOSEN.** |
| **satori + resvg-js in Worker** | JSX → SVG → PNG in a single Worker. | No Sandbox needed. Cold-start is Worker-native (<100 ms). Same JSX templates the web app already uses. | satori does not do paged layout — can't emit true A4 multi-page PDFs natively (outputs SVG per page, then we paginate). Font coverage is more work; CJK fonts inflate bundle. | **FALLBACK**, keep design on file. |
| **@react-pdf/renderer polyfilled** | React-based, emits PDFs directly. | Same JSX surface as web. | Depends on Node APIs (`stream`, `Buffer`); polyfilling in Workers is load-bearing and fragile. Already bitten on `packages/db/src/index.ts:process` in PR #6. | **REJECTED.** |
| **jsPDF** | Imperative PDF API, runs in Workers. | Small bundle. | Imperative drawing = every layout change is a rewrite. Not a fit for the kind of report we ship. | **REJECTED.** |

### When we'd flip to the fallback

Tripwires that flip us to satori+resvg:
- Sandbox GA per-invocation price > $0.001 at expected volume (~5k reports/day).
- Cold-start + render consistently > 8 s P95 in staging even with 10-minute pre-warm cron (`specs/03-*` acceptance bar).
- Sandbox residency constraint can't be met in India/APAC for production data.

---

## 2. Template strategy

**Recommendation: Jinja2 templates in `apps/worker/sandbox/templates/` keyed by report type, driven by TS-side content builder.**

The baseline spec calls for Jinja — that stays. The reviewer asked for "JSX-rendered templates in `packages/pdf-templates/`"; we reconcile by:

- **Content lives in TypeScript.** `packages/shared/src/report-render-input.ts` (new) is the single builder that returns a typed `ReportRenderInput` JSON blob. Both the HTML preview (`apps/web/src/pages/{FourDReport,ChildReport,ParentReport}.tsx`) and the Sandbox renderer consume the same shape. **One source of truth for what goes in the report.**
- **Presentation lives as Jinja in Python.** `apps/worker/sandbox/templates/{fourd,child,parent}.html.j2` + `_base.html.j2` + `_styles.css`. Variants by campaign flag are keyed off fields in `ReportRenderInput` (e.g. `branding.primaryColor`, `locale`), not different template files — variant explosion is a maintenance trap.
- **Why not `packages/pdf-templates/`?** Because templates are executed by WeasyPrint inside Sandbox (Python). Placing them under `packages/` implies they're JS-import-visible; they aren't. `apps/worker/sandbox/templates/` tracks the Sandbox image exactly.
- **Shared CSS tokens.** `_styles.css` references the same Tailwind-inspired palette used by `FOUR_D_CATEGORY_COLORS` (see `packages/shared/src/four-d-mapping.ts:126`). Emit tokens from TS → generate `_styles.css` via a build step if we want parity; v1 we hard-code because divergence risk is low (7 categories).
- **Template versioning.** `TEMPLATE_VERSION` constant in `packages/shared/src/report-render-input.ts`. Bumped on any breaking template change; part of the cache-key hash so old PDFs auto-invalidate.

### Variants

Per-campaign or per-org customization (logo, primary color, footer disclaimer text) flows through the input JSON, not separate templates. Open question: does `ai_config.features_json.report_branding` need to be introduced now or deferred? Defer — v1 uses one set of SKIDS branding; custom branding lands in a follow-up phase when the first paying customer needs it.

---

## 3. Storage — R2 layout, TTL, signed URLs

**Bucket:** new dedicated bucket `skids-reports` (binding `R2_REPORTS_BUCKET`).

Resolved 2026-04-15 — reviewer chose the split. Rationale kept in the repo:

- **Residency + retention distinct from media.** Media (`skids-media`) holds screening images which follow per-child lifecycle; reports have their own 365-day lifecycle rule and are parent-facing, so audit / access-control concerns diverge.
- **Least-privilege R2 keys.** Worker binding for reports doesn't need write access to media; ops scripts touching media don't need access to reports.
- **All writes funnel through `putReportPdf(r2, key, bytes)` against `R2_REPORTS_BUCKET`.** No fallback to `R2_BUCKET`.

### Key pattern

```
<reportType>/<childId>/<cacheKey>.pdf
```

(No `reports/` prefix — the bucket is already `skids-reports`.)

Where `cacheKey = sha256(reportType + childId + JSON.stringify(content) + TEMPLATE_VERSION)`. Content-addressable: identical input produces identical key, so re-render is a no-op + 200ms cache read.

### TTL / lifecycle

- **No object TTL for v1.** Report retention is governed by the campaign/child lifecycle — when a child's data is archived (Phase already-merged R2 campaign archival), their report PDFs move with them.
- R2 lifecycle rule on `skids-reports`: **delete objects older than 365 days** unless referenced by a live `report_tokens.token`. Implemented via R2 lifecycle config in `wrangler.toml`; no worker code.
- Manual invalidation path in runbook (delete `report_renders` row + R2 object; next render regenerates).

### Signed URLs

**Recommendation: do NOT use R2 presigned URLs for the PDF download.** The worker proxies the stream.

- R2 presigned URLs leak the object path and require S3-credential-style signing. We already sign HMAC tokens for report-tokens; using the existing flow keeps the auth surface minimal.
- `GET /api/reports/serve/:token` — worker verifies HMAC, loads R2 key from `report_tokens`, streams bytes with `Content-Type: application/pdf`, `Cache-Control: private, no-store`, `Content-Disposition: inline; filename="..."`.
- Latency: R2 → Worker streaming with `R2Object.body` passthrough adds <20 ms vs direct presigned. Worth it for the simpler security model.

### Bytes-in-flight PHI

Every report contains the child's name, DOB, campaign, and screening findings. PDFs are PHI. The same residency + no-logging rules as Turso apply. Langfuse never sees the PDF bytes (only the render metadata span).

---

## 4. Access control — token-gated, audit-logged

**Route surface:**

| Method + path | Auth | Purpose |
|---|---|---|
| `POST /api/report-tokens` | authenticated (nurse/doctor/admin) | Existing route. Modified to call the render pipeline synchronously before returning the token. Body: `{ childId, campaignCode, reportType, expiresInDays? }`. |
| `POST /api/reports/render` | authenticated | Explicit render trigger (admin tooling / force re-render). Body: `{ reportType, childId, force? }`. |
| `GET /api/reports/serve/:token` | public (token is the auth) | Streams the PDF. Increments `report_tokens.accessCount`, writes `audit_log`. |
| `GET /api/reports/:id/pdf` | public (`:id` = token, alias) | Redirect or direct-stream of `serve/:token` — satisfies the reviewer-requested URL shape without duplicating handlers. |

**HMAC layer.** `report_tokens.token` is a 12-char URL-safe random today (`report-tokens.ts:12`). We **keep** that as the DB key but add an HMAC payload for tamper-resistance:

- Token as issued to parents = `<random12>.<base64url(hmac(SANDBOX_SIGNING_KEY, childId:reportType:exp))>`.
- Verify on GET: split, HMAC-check, then DB lookup.
- Rejects mutated tokens without a DB round-trip on most attacks.

**Audit log entries:**

| Event | `audit_log.action` | Details |
|---|---|---|
| Token issued | `report_token.issued` | `{ token_prefix, childId, reportType, expiresAt }` |
| PDF rendered (cache miss) | `report.rendered` | `{ cache_key, reportType, childId, ms_render, bytes }` |
| PDF served (cache hit at the token edge) | `report.served` | `{ token_prefix, childId, reportType, accessCount }` |
| Render failed | `report.render_failed` | `{ reportType, childId, error }` |

Matches the pattern set by Phase 02 (`cloud_ai_suggestion.emitted` / `*.accepted`). Mutation endpoints always emit an audit row per master-plan principle #6.

**Rate limiting.** Token-bucket in-memory per-token: 60 serves / hour. If exceeded, 429 with `Retry-After`. Cheap protection against bulk-scraping a leaked link.

---

## 5. Data model — new tables / migration shape

**Migration file:** `packages/db/src/migrations/0003_report_render_cache.sql`

```sql
-- Phase 3 — report render cache
-- Additive only (baseline spec pattern).

CREATE TABLE IF NOT EXISTS report_renders (
  cache_key TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,                     -- 'fourd' | 'child' | 'parent'
  child_id TEXT NOT NULL REFERENCES children(id),
  r2_key TEXT NOT NULL,                          -- reports/<type>/<child>/<key>.pdf
  bytes INTEGER NOT NULL,
  ms_render INTEGER NOT NULL,                    -- for perf diligence
  template_version TEXT NOT NULL,                -- part of cache_key hash, also denormalized
  renderer TEXT NOT NULL DEFAULT 'weasyprint',   -- future-proof for satori fallback
  locale TEXT NOT NULL DEFAULT 'en',             -- 'en' | 'hi' | 'kn' | 'ta' | 'te'
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_report_renders_child ON report_renders(child_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_renders_created ON report_renders(created_at);
```

**`report_tokens` table stays as-is** (already created on-demand by `report-tokens.ts:39`). We do not add columns; the HMAC payload is computed, not stored.

### Reviewer's "0003_report_tokens.sql" question

The reviewer asked for `0003_report_tokens.sql`. Our plan instead names this migration `0003_report_render_cache.sql` because `report_tokens` already exists. If a schema formalization of the existing on-demand CREATE is desired, that's a follow-up (`0003a_formalize_report_tokens.sql`) — not blocking.

---

## 6. Locale / language + fonts

**Scripts in scope for v1:**

| Locale | Script | Font |
|---|---|---|
| en | Latin | Inter + DM Serif Display |
| hi | Devanagari | Noto Sans Devanagari |
| kn | Kannada | Noto Sans Kannada |
| ta | Tamil | Noto Sans Tamil |
| te | Telugu | Noto Sans Telugu |
| ml | Malayalam | Noto Sans Malayalam |
| mr | Marathi | Noto Sans Devanagari (shared with hi) |

**Bundling.** Install via `fonts-noto` + `fonts-noto-cjk` (baseline spec) — covers Devanagari, Kannada, Tamil, Telugu, Malayalam, and CJK. `apps/worker/sandbox/Dockerfile` apt-installs them. No custom `.ttf` in the repo.

**Locale detection.** `campaigns.locale` (new column? baseline spec doesn't add one — defer) OR pass `locale` from the caller. V1: `ReportRenderInput.locale` is an explicit field the render pipeline must supply; default `'en'`. Campaign-level default stored in `ai_config.features_json.default_report_locale` (existing JSON blob, no migration).

**RTL.** Not in scope. No RTL language in the current rollout.

**Accessibility.** PDF/UA compliance is out of scope for v1. WeasyPrint emits tagged PDFs by default; we don't actively verify WCAG. Flag for future.

---

## 7. PHI redaction in PDFs

Different model than Langfuse. **Langfuse redacts by default; PDFs are PHI and carry it intentionally** — the child's name, DOB, and findings are the whole point of a report. What we DO redact:

- **Images from screening observations are NOT embedded by default.** An admin-gated flag `features_json.parent_reports_include_images: false` is the default. Images leak iris + face + oral cavity PHI in ways parents don't expect; consent is separate. When set to `true`, only observations marked `annotationData.consentedForParentReport: true` are embedded.
- **Doctor free-text notes are never embedded** unless the doctor explicitly marks them `shareWithParent: true` on the review.
- **Raw chip IDs** (technical identifiers like `red_reflex_absent`) are rewritten to human text via `packages/shared/src/condition-descriptions.ts` before render — same as the web report pages do today.
- **Audit log entries** for `report.rendered` include `cache_key`, `child_id`, `reportType`, `bytes`, `ms_render`. They do NOT include findings, names, or DOB — only the fact of a render.

The Langfuse span emitted by the worker around the render call uses `redactValue()` (Phase 02) on input payloads so trace storage is clean even though the PDF itself carries PHI.

### Sandbox process isolation

WeasyPrint runs in the Sandbox, PDF bytes stream back to the worker, and the Sandbox instance is stopped (or returned to the warm pool). We DO NOT persist the input JSON or the output bytes on the Sandbox disk after the process exits. Sandbox filesystem is ephemeral; explicit `sb.stop()` in the finally block as defense in depth.

---

## Coordination with Phase 02a

| Surface | Phase 03 (this session) | Phase 02a (other session) | Conflict risk |
|---|---|---|---|
| `wrangler.toml` | Add `[[sandbox]]` binding + `SANDBOX_SIGNING_KEY` secret stub + cron trigger + R2 lifecycle | Adds R2 `skids-models` bucket + LFM manifest URLs | **Low.** Both append new blocks with `# Phase 03` / `# Phase 02a` headers. |
| `specs/STATUS.md` | Flip Phase 03 row only | Flip Phase 02a row only | **Zero.** |
| Migrations | `0003_report_render_cache.sql` | None (Phase 02a doesn't touch `packages/db`) | **Zero.** |
| `packages/shared/` | `src/report-render-input.ts` (new file) | `src/ai/module-schemas/` (new dir) | **Zero.** |
| `packages/shared/src/index.ts` | Add one export | May add exports for module-schemas | **Low** — append-only; rebase resolves. |
| `apps/worker/src/routes/` | `report-render.ts` new, `report-tokens.ts` modified, `audit-log.ts` untouched | Adds `/api/on-device-ai/:outcome` route | **Zero** — different files. |
| `apps/worker/src/index.ts` | Register new `report-render` route | Register new on-device-ai route | **Low** — append-only in the route-mount block; rebase resolves. |
| `apps/web/src/pages/` | `ParentReport.tsx` may get a "download PDF" button | Doesn't touch parent pages | **Zero.** |
| `docs/RUNBOOK.md` | Phase 3 section | Phase 02a section | **Zero** — append-only; different sections. |

Rebase plan: whoever lands first wins. If Phase 02a lands first, Phase 03 rebases; conflicts resolve by taking both hunks in `wrangler.toml`, `STATUS.md`, and `packages/shared/src/index.ts`.

---

## Deliverables (preview — not this PR)

1. `apps/worker/sandbox/Dockerfile` — Python + WeasyPrint + Noto fonts
2. `apps/worker/sandbox/render.py` — single-shot stdin → stdout
3. `apps/worker/sandbox/templates/{_base,_styles,fourd,child,parent}.{html.j2,css}`
4. `apps/worker/src/routes/report-render.ts` (new)
5. `apps/worker/src/routes/report-tokens.ts` (modified: issue-after-render flow, HMAC payload)
6. `wrangler.toml` — `[[sandbox]]` binding, `R2_REPORTS_BUCKET` binding (bucket `skids-reports`), `SANDBOX_SIGNING_KEY` secret stub, cron (`FEATURE_REPORT_PREWARM` gated), R2 lifecycle rule on `skids-reports`
7. `packages/db/src/migrations/0003_report_render_cache.sql` + schema.sql mirror
8. `packages/shared/src/report-render-input.ts` — typed contract + `TEMPLATE_VERSION`
9. Worker `scheduled` handler for pre-warm (9–18 IST cron `*/10 3-12 * * *`)
10. Test suite: render round-trip, cache hit, HMAC tamper-reject, token-expiry, 429 rate-limit
11. `docs/RUNBOOK.md` Phase 3 section + `docs/SECRETS.md` row for `SANDBOX_SIGNING_KEY`

---

## Resolved open questions (2026-04-15)

1. **Bucket split** — **Separate `skids-reports` R2 bucket.** Decision: provision a dedicated bucket. Implications: new binding `R2_REPORTS_BUCKET` in `wrangler.toml`, distinct lifecycle rule (365-day), distinct jurisdiction entry in `docs/RESIDENCY.md`. The `putReportPdf()` helper targets `R2_REPORTS_BUCKET` from day one — no migration path to worry about.
2. **Pre-warm cron** — **Accept `*/10 3-12 * * *`, gate behind `FEATURE_REPORT_PREWARM=1`.** Cron fires every 10 min during 9:00–18:30 IST. Worker `scheduled` handler short-circuits to no-op unless the env var is `1`. Default to off in staging, on in prod. Toggle without a redeploy by flipping the var.
3. **Locale default** — **Via `ai_config.features_json.default_report_locale` feature flag; no `campaigns.locale` column.** Respects the Phase 02 pattern of pushing per-org config through the existing JSON blob. `ReportRenderInput.locale` reads from the flag at build-time; hard-codes to `'en'` if the flag is absent.
4. **HMAC payload** — **Random-token + appended HMAC (`<random12>.<base64url_hmac>`).** DB row stays the source of truth for access counts + expiry; HMAC is tamper-resistance on top. Rejected: full JWT (would complicate `accessCount` writes).
5. **"Download PDF" UI in `ParentReport.tsx`** — **DEFERRED** to a follow-up PR that lands after the `fix/web-typecheck` work clears the existing `ParentReport.tsx` type errors (`screenerName` missing on `ReportData`, per parked backlog). Not in Phase 03 scope.

---

## What this plan deliberately does NOT commit to

- **No `packages/pdf-templates/`.** Reviewer suggested; rejected because templates must execute in Python, not TS.
- **No `@react-pdf/renderer`, `jsPDF`, or pure-JS PDF emission in v1.** Satori+resvg is the escape hatch if WeasyPrint-in-Sandbox hits the tripwires listed in §1.
- **No PDF/UA accessibility compliance** (flag for future).
- **No RTL / Arabic / Hebrew** (no market demand).
- **No per-campaign template override files.** Variants flow through the input JSON.
- **No pre-rendering of reports on screening completion.** Lazy on first token request. (Pre-render-on-completion is an optimization that arrives with Phase 05 workflows.)

---

## Addendum — 2026-04-15 pivot: option (C) JS-only renderer

**Decision:** Flip §1's fallback (satori + resvg-wasm + pdf-lib) to the default for v1. Drop WeasyPrint / Sandbox / Containers.

**Reason the original choice didn't survive first contact:** the baseline spec's `[[sandbox]]` binding name is not a GA wrangler binding. The behavior described (`SANDBOX.start({ image })` + `sb.exec({ cmd: ['python', ...] })`) maps most closely to Cloudflare Workers **Containers** (`[[containers]]` with a Durable-Object class), which would require image registry, a DO class, and heavier deploy plumbing. The two alternatives — Python Workers (Pyodide, cannot load Cairo/Pango for WeasyPrint) and an external Python microservice (new infra outside the Cloudflare APAC perimeter) — each break a load-bearing constraint (feature parity or PHI residency).

**What option (C) buys us:**

- **PHI stays inside the Cloudflare APAC perimeter.** No egress to a sidecar renderer.
- **Same edge runtime as the rest of the worker.** No DO class, no image build, no container orchestration.
- **Single dependency set**: `satori`, `@resvg/resvg-wasm`, `pdf-lib`. All Worker-compatible.
- **Sufficient for v1 parent reports** (2–4 pages, mostly text + inline SVG charts we already pre-render in `packages/shared/src/report-content.ts`).

**What it costs:**

- **No paged-CSS.** satori emits one SVG per "page"; we stitch pages via pdf-lib. Hand-coded page breaks in the template, not CSS `@page`.
- **Font coverage is on us.** WeasyPrint-in-container would have pulled `fonts-noto*` via apt; here we bundle subsetted `.ttf` / `.woff2` in the Worker asset bundle. Budget **< 2 MB compressed** across all locales in scope.
- **PDF/UA tagging is weaker.** pdf-lib emits unstructured PDFs. Acceptable for v1 (accessibility was already flagged out-of-scope).

**Upgrade path preserved.** The binding we commit to is the HTTP contract `POST /api/reports/render` + `GET /api/reports/:id/pdf`. If paged-CSS fidelity becomes load-bearing (doctor-facing clinical PDFs, lab-result-style tables), we can swap the renderer behind that contract to option (A) Workers Containers or option (B) APAC-hosted microservice without touching callers.

### Revised commit plan

| # | Scope |
|---|---|
| 2 (amended) | `wrangler.toml` — `[[r2_buckets]]` for `skids-reports` + `REPORT_SIGNING_KEY` secret ref. **No `[[sandbox]]` block.** |
| 3 | `packages/pdf-templates/` — satori JSX components + resvg-wasm wrapper + pdf-lib multi-page stitcher + subsetted font bundle |
| 4 | `apps/worker/src/routes/report-render.ts` + `apps/worker/src/routes/report-tokens.ts` rewrite (hashed-token CRUD + `/api/reports/:id/pdf` serve path with audit IP + UA) |
| 5 | `packages/shared/src/report-token.ts` — HMAC issue/verify lib (URL token integrity layer) |
| 6 | Cron worker gated by `FEATURE_REPORT_PREWARM` — pre-warms the resvg-wasm module + font cache (not a Python sandbox) |

### Font bundle — scripts in scope

Subset aggressively (glyphs actually used in templates + ASCII + digits + common punctuation). Target total **< 2 MB compressed**.

| Locale(s) | Font family | Script |
|---|---|---|
| en | Inter | Latin |
| hi, mr | Noto Sans Devanagari | Devanagari |
| bn | Noto Sans Bengali | Bengali |
| ta | Noto Sans Tamil | Tamil |
| te | Noto Sans Telugu | Telugu |
| kn | Noto Sans Kannada | Kannada |
| ml | Noto Sans Malayalam | Malayalam |
| gu | Noto Sans Gujarati | Gujarati |
| pa | Noto Sans Gurmukhi | Gurmukhi |

Drop CJK (no market), drop RTL (no market). Tamil / Bengali / Gujarati / Gurmukhi are added vs the pre-pivot list; confirm with product before template commit 3.

### What this addendum supersedes

- §1 "Recommendation: WeasyPrint inside Cloudflare Sandbox." → superseded. Satori + resvg-wasm + pdf-lib is the v1 default.
- §2 Jinja2 templates in `apps/worker/sandbox/templates/` → superseded. Templates move to `packages/pdf-templates/` as TSX.
- §7 "Sandbox process isolation" → no longer applicable. Replaced by "all rendering inside the Worker request; no disk writes; PDF bytes returned to caller or streamed to R2."
- Deliverables list (WeasyPrint Dockerfile, `render.py`, Jinja templates) → removed. `apps/worker/sandbox/` directory will not be created.
- `SANDBOX_SIGNING_KEY` → renamed to `REPORT_SIGNING_KEY` everywhere (it was never bound to Sandbox specifically; it's the URL HMAC key).

All other sections (cache model, R2 layout, access control, audit, migration 0003, token-hash storage, rate limit, pre-warm cron) carry over unchanged.
