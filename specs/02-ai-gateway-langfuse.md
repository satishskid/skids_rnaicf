# Phase 2 — AI Gateway + Langfuse end-to-end

**Goal**: Route every LLM call through Cloudflare AI Gateway (caching, rate limits, failover, cost ledger) and emit Langfuse traces for every model invocation. Replace the placeholder in `routes/ai-gateway.ts` with a working implementation.

**Prerequisites**: Phase 0 complete. Independent of Phase 1.

**Effort**: 1 day.

---

## Read first

- `apps/worker/src/routes/ai-gateway.ts` — current placeholder (POST /analyze, POST /vision)
- `apps/worker/src/routes/ai-config.ts` — per-org config storage
- `apps/worker/src/index.ts` — Bindings type with LANGFUSE_* already declared
- `apps/mobile/src/lib/ai/llm-gateway.ts` — mobile-side LLM caller; this is the consumer
- `apps/mobile/src/lib/ai/pipeline.ts` — Tier 3 entry point
- `packages/shared/src/ai/index.ts` — shared AI types

---

## Decisions

- **Gateway path**: `https://gateway.ai.cloudflare.com/v1/{ACCOUNT_ID}/{GATEWAY_ID}/{provider}` for Gemini, Claude, Groq, Workers AI
- **Langfuse hosting**: self-hosted in `ap-south-1` (decision recorded in RESIDENCY.md). If self-host not ready in this phase, START with PHI-redacted spans to the cloud and migrate later.
- **Trace structure**: one trace per screening session, one span per AI call, span attributes include `module_type`, `child_age_months_band`, `provider`, `model`, `tokens_in`, `tokens_out`, `latency_ms`, `cached`. NO raw image bytes, NO patient identifiers.
- **Failover order**: `gemini-2.0-flash` → `claude-haiku-4-5` → `@cf/meta/llama-3.3-70b-instruct` (Workers AI fallback so we always answer). Configurable per-org via `ai_config.features_json.failover_chain`.
- **Cache TTL**: 1 hour for image-analysis prompts (deterministic prompt + same image hash). Disabled for free-text doctor questions.

---

## Deliverables

1. New shared module `packages/shared/src/ai/gateway-client.ts`
2. New shared module `packages/shared/src/ai/langfuse-trace.ts`
3. Replace `apps/worker/src/routes/ai-gateway.ts` POST /analyze and POST /vision with real implementations
4. Add Bindings: `AI_GATEWAY_ACCOUNT_ID`, `AI_GATEWAY_ID` (already in Bindings type? confirm; if not, add)
5. Migration `0002_ai_usage_extension.sql` — add columns: `cached`, `gateway_request_id`, `langfuse_trace_id`, `cost_usd_micros`
6. Mobile: update `apps/mobile/src/lib/ai/llm-gateway.ts` to call worker `/api/ai/vision` (do not direct-call providers)
7. Admin dashboard hook: `apps/web/src/pages/Settings.tsx` — add a "test gateway" button and a "today's spend" tile
8. Test suite extension
9. Update `docs/RUNBOOK.md` Phase 2 section + a "How to inspect a Langfuse trace" sub-section

---

## Step-by-step

### 1. gateway-client.ts (shared)

Single class `AIGateway` with methods:
- `vision({ imageBase64, prompt, modelHint, cacheKey })` → `{ text, model, cached, latencyMs, tokensIn, tokensOut }`
- `chat({ messages, modelHint, cacheKey })` → same return shape
- `embed({ text })` → calls Workers AI directly via binding (not Gateway, since binding is free)

Internals:
- Build the Gateway URL: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${provider}/${model}`
- Provider mapping: gemini → `google-ai-studio`, claude → `anthropic`, groq → `groq`, workers-ai → `workers-ai`
- Send `cf-aig-cache-key` and `cf-aig-cache-ttl` headers
- Capture response headers: `cf-aig-cache-status`, `cf-aig-cost`, `cf-aig-id`
- On failure, walk failover chain. After all fail: throw with structured error.

### 2. langfuse-trace.ts

Lightweight Langfuse client (HTTP, no SDK to keep bundle small). Methods:
- `startTrace({ name, sessionId, userId, metadata })` → `traceId`
- `span({ traceId, name, input, output, model, latencyMs, tokensIn, tokensOut, costUsd })`
- `endTrace({ traceId, output })`

PHI redaction: a `redact(input)` helper replaces:
- base64 image bytes → `<image:sha256:...>`
- child names → `<child>`
- DOBs → `<dob>`
- Phone numbers → `<phone>`

Tested with golden cases.

### 3. Replace ai-gateway.ts

POST /analyze:
```typescript
// gather body, build cache key, call AIGateway.chat with failover,
// record langfuse trace + ai_usage row with all new columns
```

POST /vision:
```typescript
// existing structure but call AIGateway.vision; preserve response shape
// expected by mobile (apps/mobile/src/lib/ai/llm-gateway.ts)
```

Important: do NOT change the response shape mobile depends on. Check `llm-gateway.ts` first to confirm the contract, then preserve it.

### 4. Bindings

In `apps/worker/wrangler.toml`:
```toml
[vars]
AI_GATEWAY_ACCOUNT_ID = "9f4998a66a5d7bd7a230d0222544fbe6"
AI_GATEWAY_ID = "skids-screen"
```

(`AI_GATEWAY_ID` is the gateway slug — create the gateway in CF dashboard first if not exists.)

In `apps/worker/src/index.ts` Bindings type:
```typescript
AI_GATEWAY_ACCOUNT_ID: string
AI_GATEWAY_ID: string
```
(Confirm LANGFUSE_* are already there per current code.)

### 5. Migration

`packages/db/src/migrations/0002_ai_usage_extension.sql`:
```sql
ALTER TABLE ai_usage ADD COLUMN cached INTEGER DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN gateway_request_id TEXT;
ALTER TABLE ai_usage ADD COLUMN langfuse_trace_id TEXT;
ALTER TABLE ai_usage ADD COLUMN cost_usd_micros INTEGER;
ALTER TABLE ai_usage ADD COLUMN module_type TEXT;
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_module ON ai_usage(module_type);
```

### 6. Mobile update

`apps/mobile/src/lib/ai/llm-gateway.ts`:
- Remove any direct provider URLs (Gemini, Claude direct calls).
- Route everything through `${API_BASE}/api/ai/vision` and `/api/ai/analyze`.
- Pass `sessionId` (= screening session) and `moduleType` so worker can build correct trace.

### 7. Admin UI

`apps/web/src/pages/Settings.tsx`:
- Section: "AI Gateway"
  - Button: "Test gateway" → calls `/api/ai/analyze` with a known prompt, displays latency + provider + cached
  - Tile: "Today's spend" → calls new route `GET /api/ai-usage/today` (add it) returning `{ totalUsdMicros, byProvider, byModule }`
  - Toggle: enable/disable each provider in the failover chain (writes to `ai_config.features_json.failover_chain`)

### 8. Tests

- Stub a fake Gateway with `MSW`-style intercept (or hand-rolled fetch stub) returning controlled responses
- Test failover: gemini fails → claude succeeds → log `provider=anthropic`, `tokens_in/out` recorded
- Test cache hit: second call to identical key returns `cached:true`, no provider call
- Test PHI redaction: a span with `imageBase64` length 100k results in a Langfuse payload of length <2k

### 9. Runbook section

`docs/RUNBOOK.md` Phase 2:
- How to view today's spend: dashboard URL + SQL query against `ai_usage`
- How to throttle a misbehaving provider: AI Gateway dashboard rate-limit setting
- How to interpret a Langfuse trace: trace tree, redaction markers, cost rollup
- How to add a new provider to the failover chain

---

## Acceptance criteria

- [ ] `pnpm typecheck && pnpm build` green
- [ ] Migration applies cleanly
- [ ] `POST /api/ai/vision` with a test image returns response in <3s P95 (warm) and matches mobile's expected shape
- [ ] Forcing the primary provider to error triggers failover; final response succeeds with `provider=anthropic`
- [ ] A Langfuse trace appears within 5s of the request, with span tree + redaction markers
- [ ] `ai_usage` rows now contain `cached`, `gateway_request_id`, `langfuse_trace_id`, `cost_usd_micros`
- [ ] Settings page "Test gateway" button works
- [ ] No PHI in any Langfuse span (verified by inspecting 10 random spans)

## Rollback

Revert the worker route file. Migration is additive; columns can stay. Mobile change is the only consumer-affecting change — coordinate.

## Out of scope

- Replacing Gemini/Claude entirely with self-hosted (later)
- Per-user spend caps (later)
- Real-time alerting on cost spikes (later — covered by Phase 4 DuckDB dashboards)
