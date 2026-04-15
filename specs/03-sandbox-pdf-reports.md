# Phase 3 — Sandbox Lane C: Server-side PDF reports

**Goal**: Render FourD / Child / Parent reports as deterministic, signed PDFs inside Cloudflare Sandbox using WeasyPrint. Cache rendered PDFs in R2 by a content hash. Issue signed access tokens via existing `report-tokens.ts`.

**Prerequisites**: Phase 0 complete. Best after Phase 2 (so PDF generation events emit Langfuse traces). Independent of Phase 1.

**Effort**: 2 days.

---

## Read first

- `apps/worker/src/routes/report-tokens.ts` — current token issuance flow
- `apps/web/src/pages/FourDReport.tsx`, `ChildReport.tsx`, `ParentReport.tsx` — current HTML render targets
- `packages/shared/src/four-d-mapping.ts` and `packages/shared/src/report-content.ts` — content pipeline (single source for all 3 reports)
- `apps/worker/src/routes/r2.ts` — R2 helpers
- `packages/db/src/schema.sql` — `campaigns.archive_url`, `report_tokens` table
- Cloudflare Sandbox docs (current GA release notes) — confirm binding syntax

---

## Decisions

- **Renderer**: WeasyPrint inside a Sandbox initialized with `python:3.12-slim` + WeasyPrint deps
- **Template engine**: Jinja2; templates live in `apps/worker/sandbox/templates/{fourd,child,parent}.html.j2`
- **Cache key**: `sha256(report_type + child_id + report_content_json + template_version)`
- **R2 layout**: `r2://skids-media/reports/<report_type>/<child_id>/<cache_key>.pdf`
- **Access**: existing `report_tokens` row maps token → R2 key; worker streams from R2 via signed URL
- **Pre-warm**: a scheduled trigger pings the Sandbox every 10 min to keep a warm instance during business hours (9–18 IST)
- **Signing**: HMAC-SHA256 with `SANDBOX_SIGNING_KEY`, embedded in token payload (`{kid, exp, child_id, cache_key}`)

---

## Deliverables

1. `apps/worker/sandbox/Dockerfile` (or equivalent Sandbox config) — Python + WeasyPrint
2. `apps/worker/sandbox/render.py` — single-input/single-output script
3. `apps/worker/sandbox/templates/fourd.html.j2`, `child.html.j2`, `parent.html.j2`
4. `apps/worker/sandbox/templates/_base.html.j2` + `_styles.css`
5. New worker route `apps/worker/src/routes/report-render.ts`
6. Modify `apps/worker/src/routes/report-tokens.ts` — issue token AFTER ensuring PDF exists in R2
7. Bindings: `SANDBOX` (Sandbox binding), `SANDBOX_SIGNING_KEY` secret
8. Migration `0003_report_render_cache.sql` — table `report_renders` for cache index
9. New shared module `packages/shared/src/report-render-input.ts` — builds the JSON contract Python expects
10. Scheduled trigger for pre-warm
11. Test: render-and-fetch round trip
12. Update `docs/RUNBOOK.md` Phase 3

---

## Step-by-step

### 1. Sandbox image

`apps/worker/sandbox/Dockerfile`:
```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpango-1.0-0 libpangoft2-1.0-0 fonts-noto fonts-noto-cjk \
      fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir weasyprint==62.3 jinja2==3.1.4 pydantic==2.9.0
WORKDIR /app
COPY render.py .
COPY templates ./templates
ENTRYPOINT ["python", "render.py"]
```

Update `wrangler.toml`:
```toml
[[sandbox]]
binding = "SANDBOX"
image = "./sandbox"
```
(Match exact syntax from current Sandbox GA docs.)

### 2. render.py

Single-shot script:
- stdin: JSON `{ report_type, content, template_version }`
- Loads `templates/{report_type}.html.j2`
- Renders with WeasyPrint to PDF bytes
- stdout: PDF bytes (binary)
- stderr: structured log lines

Schema for `content` is defined by `packages/shared/src/report-render-input.ts` (TypeScript) and validated with Pydantic in Python (mirror).

Templates use:
- DM Serif Display + Inter (matches brand)
- A4, 20mm margins
- Page numbers, generated-on date, child name, screener name
- Embedded charts as inline SVG (no JS in PDF context — pre-render charts as SVG strings in shared/report-content.ts and pass through)

### 3. report-render.ts

```typescript
// POST /api/reports/render
// body: { reportType: 'fourd'|'child'|'parent', childId, force?: boolean }
// 1. Build content via shared/report-content.ts (deterministic)
// 2. Compute cacheKey = sha256(reportType + childId + JSON.stringify(content) + TEMPLATE_VERSION)
// 3. Check report_renders table for cacheKey → if present and !force, return existing R2 key
// 4. Else: spawn Sandbox, pipe content JSON in, capture PDF bytes
// 5. Upload to R2: reports/<reportType>/<childId>/<cacheKey>.pdf
// 6. Insert into report_renders { cache_key, report_type, child_id, r2_key, bytes, ms_render, created_at }
// 7. Return { r2_key, cacheKey, cached: false, bytesRendered }
```

Sandbox invocation pseudocode:
```typescript
const sb = await c.env.SANDBOX.start({ image: 'render-pdf' })
const proc = await sb.exec({
  cmd: ['python', 'render.py'],
  stdin: JSON.stringify(input),
  timeoutMs: 30_000,
})
if (proc.exitCode !== 0) throw new Error(`render failed: ${proc.stderr}`)
const pdfBytes = proc.stdout
await sb.stop()
```
(Adjust to actual Sandbox API surface from the GA docs.)

### 4. Modify report-tokens.ts

Current flow probably issues a token first and renders later. Reverse it for parent/child reports:
- POST /api/report-tokens with `{ childId, reportType, ttlMinutes }`
- Internally: call `/api/reports/render` (or the same handler logic) → get cacheKey
- Sign payload `{ cacheKey, childId, reportType, exp }` with `SANDBOX_SIGNING_KEY`
- Store row in `report_tokens` (existing table)
- Return token

GET /api/reports/serve/:token verifies HMAC, looks up R2 key, streams PDF with `Content-Type: application/pdf`, no-cache headers.

### 5. Migration

`packages/db/src/migrations/0003_report_render_cache.sql`:
```sql
CREATE TABLE IF NOT EXISTS report_renders (
  cache_key TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  child_id TEXT NOT NULL REFERENCES children(id),
  r2_key TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  ms_render INTEGER NOT NULL,
  template_version TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_report_renders_child ON report_renders(child_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_renders_created ON report_renders(created_at);
```

### 6. Pre-warm

Cron in wrangler.toml:
```toml
[triggers]
crons = ["*/10 3-12 * * *"]  # 9:00–18:30 IST every 10 min
```
Worker `scheduled` handler dispatches a no-op render to keep Sandbox warm.

### 7. Tests

- Render fourd report for a seeded child → PDF size > 50KB, < 2MB, opens in pdfminer
- Re-render same child → `cached: true`, no Sandbox spawn
- Force re-render → new cache_key (template_version bumped) → new R2 key
- Token issuance: GET with valid token → 200 + PDF; expired → 410; tampered → 401

### 8. Runbook section

- How to update a template (bump TEMPLATE_VERSION constant in shared/report-content.ts)
- How to invalidate a single child's cached report
- How to debug a Sandbox render failure (where logs land)

---

## Acceptance criteria

- [ ] Sandbox binding works in dev (`wrangler dev`) and prod
- [ ] First render for a child takes < 8s; cached returns < 200ms
- [ ] PDF opens in macOS Preview, Chrome, Adobe Reader without errors
- [ ] All Hindi/regional fonts in test child names render correctly (Noto fallback)
- [ ] Token-protected GET returns the PDF; tampered token returns 401
- [ ] `report_renders` row inserted on every fresh render
- [ ] Pre-warm cron runs every 10 min during business hours and is logged
- [ ] No PII appears in Sandbox stderr logs

## Rollback

Stop using `/api/reports/render` from `report-tokens.ts`. PDFs already in R2 stay served. Migration is additive.

## Out of scope

- Bulk batch render at campaign close (Phase 5 will do via Workflow)
- Translation/localized templates (separate epic)
- Heavier image processing inside Sandbox (Phase 6 — Lane A)
