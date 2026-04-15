# Runbook — SKIDS Screen V3

Operational handbook for the edge stack. Grows one section per phase.

## Prereqs

- Node 20+, pnpm 10.29+
- Wrangler 3+ (ships with `@skids/worker` devDeps)
- Turso CLI
- Cloudflare account with Workers, R2, AI, Vectorize enabled

## Local dev

```bash
pnpm install
pnpm --filter @skids/worker dev
pnpm --filter @skids/web dev
pnpm --filter @skids/mobile start
```

## Deploy

```bash
pnpm --filter @skids/worker deploy
pnpm --filter @skids/web build
wrangler pages deploy apps/web/dist --project-name skids-web
```

## Phase 00 — Preflight

Goal: verify baseline. No production impact.

```bash
bash scripts/preflight.sh
```

Preflight checks:

1. Branch is `feat/edge-stack-v1-plan` or descendant
2. Planning files (MASTER_PLAN, specs/STATUS, docs/RESIDENCY/SECRETS/RUNBOOK) exist
3. Spec files `specs/00..08-*.md` exist
4. `pnpm install`, `pnpm typecheck`, `pnpm build` all pass
5. `wrangler deploy --dry-run` succeeds (bindings resolve)
6. `embedding F32_BLOB(384)` line is still reserved in `packages/db/src/schema.sql`
7. `apps/worker/src/routes/audit-log.ts` exists

## Phase 02 — AI Gateway + Langfuse

All LLM calls are proxied through Cloudflare AI Gateway (caching, rate limits,
failover, cost ledger). Each request writes a Langfuse trace (PHI-redacted) and
an `ai_usage` row carrying `cached`, `gateway_request_id`, `langfuse_trace_id`,
`cost_usd_micros`, `module_type`, `provider`, `session_id`.

### Scope (2026-04-15)

**Doctor-only cloud AI suggestions.** Nurses do NOT call `/api/ai/*` — they
receive 403. Every nurse-side AI capability lands in Phase 02a (on-device
Liquid AI LFM2.5-VL-450M, see `specs/02a-liquid-ai-on-device.md`). Cloud AI
output is always labeled "AI Suggestion — Doctor's Diagnosis Required" and
every accept / reject / edit is written to `audit_log`.

### Admin enablement (per-org)

Cloud AI is **off by default**. An admin must flip it on for the org:

```sql
-- Turn on for org "default" (adjust org_id as needed)
UPDATE ai_config
   SET config_json = json_set(
         COALESCE(config_json, '{}'),
         '$.features.cloud_ai_suggestions', json('true')
       )
 WHERE org_id = 'default';
```

To enable optional overflow providers (Gemini / Claude), extend
`features.overflow_providers`:

```sql
UPDATE ai_config
   SET config_json = json_set(
         config_json,
         '$.features.overflow_providers', json('["gemini"]')
       )
 WHERE org_id = 'default';
```

When the flag is off, doctor calls to `/api/ai/*` return 503 with `remedy`
pointing back here. Admin users bypass the flag so the Settings test-gateway
button still works.

### Deploy prerequisites

**Create the AI Gateway slug `skids-screen` in the Cloudflare dashboard BEFORE
deploying the worker.** Navigate: Account → AI → AI Gateway → Create Gateway →
slug `skids-screen`. Without this, the base URL built in
`packages/shared/src/ai/gateway-client.ts`
(`https://gateway.ai.cloudflare.com/v1/{account}/skids-screen/{provider}`)
resolves to a 404 and every LLM call fails over straight to the workers-ai
last-resort binding — silent degradation that's hard to spot until Langfuse
costs stay at zero.

Provision once per environment:

- **Required**: `GROQ_API_KEY` (tier 2 failover — same `llama-3.3-70b` family
  as workers-ai tier 1, so model behavior stays consistent when workers-ai
  blips).
- **Required**: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`
  (self-hosted Langfuse on Hetzner Mumbai preferred; redaction already enforced
  in code, but Mumbai keeps latency tight).
- **Optional (per-org overflow)**: `GEMINI_API_KEY` (tier 3),
  `ANTHROPIC_API_KEY` (tier 4). Only reached when the admin adds the provider
  to `ai_config.features.overflow_providers`.

### Deployment

```bash
# One-time: create the Gateway in CF dashboard with slug `skids-screen`.
# Required secrets (set per env):
wrangler secret put LANGFUSE_PUBLIC_KEY --name skids-api
wrangler secret put LANGFUSE_SECRET_KEY --name skids-api
wrangler secret put LANGFUSE_BASE_URL   --name skids-api   # e.g. https://langfuse.skids.in
wrangler secret put GROQ_API_KEY        --name skids-api   # REQUIRED (tier 2)
# Optional overflow — only if the admin plans to enable it per-org:
wrangler secret put GEMINI_API_KEY      --name skids-api   # optional (tier 3)
wrangler secret put ANTHROPIC_API_KEY   --name skids-api   # optional (tier 4)

# AI_GATEWAY_ACCOUNT_ID and AI_GATEWAY_ID are in wrangler.toml [vars] —
# override per-env with wrangler secret put if staging uses a different gateway.

# Apply migration
turso db shell skids-screen < packages/db/src/migrations/0002_ai_usage_extension.sql

# Deploy
pnpm --filter @skids/worker deploy
```

### Feature flag

`FEATURE_AI_GATEWAY` env var. Unset or `1`/`true` = on (default). Set to `0` or
`false` to return 503 from `/api/ai/analyze` and `/api/ai/vision`. Useful as an
emergency kill switch while keeping the route surface intact.

### How to view today's spend

Admin UI: **Settings → AI & Devices → AI Gateway** card shows `totalUsdMicros`,
requests, cache hits, and per-provider breakdown. Raw SQL:

```sql
SELECT provider,
       COUNT(*) AS requests,
       SUM(cost_usd_micros) / 1e6 AS spend_usd,
       SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) AS cache_hits
FROM ai_usage
WHERE date(created_at) = date('now')
GROUP BY provider
ORDER BY spend_usd DESC;
```

### How to inspect a Langfuse trace

Every response (success or failure) includes `traceId`. Open
`${LANGFUSE_BASE_URL}/trace/<traceId>`. Expect:

- Root trace `ai.vision` or `ai.analyze`, tagged with `sessionId`, `moduleType`.
- One `generation` span per provider attempt, with `model`, `provider`,
  `tokensIn/Out`, `costUsd`, `latencyMs`, `cached` flag.
- Redaction markers: `<image:base64>`, `<image:sha:xxxxxxxx>`, `<child>`,
  `<phone>`, `<dob>`. If any raw PHI-looking value appears, re-run the
  `@skids/shared` redaction tests — do NOT hot-fix by redacting upstream.

### Throttling a misbehaving provider

1. In Cloudflare dashboard → AI Gateway → `skids-screen` → Rules → add a
   rate-limit (per-minute or per-second) targeting `provider = anthropic` (or
   the slug causing issues).
2. Failover will kick in automatically; watch Langfuse spans to confirm.

### Adding a provider to the failover chain

1. Extend `Provider` union in `packages/shared/src/ai/gateway-client.ts`.
2. Add URL/body builder in `buildProviderRequest` and parser in
   `parseProviderResponse`.
3. Add the binding key to `apps/worker/src/index.ts` `Bindings` type and
   register it in `buildGateway()` under `keys`.
4. Update `failover` in `buildGateway()` (or make per-org via
   `ai_config.features_json.failover_chain`).

## Phase 03–07

(Appended during each phase PR. See each phase's spec for commands.)

## Incident response

### Nurse app slow

- Check on-device quality-gate latency (target <200ms)
- Check Langfuse for `/api/ai/vision` provider latency + cache-hit rate (Phase 2+)
- If AI Gateway provider outage: verify Workers AI failover

### Doctor reviews piling up

- `/api/campaign-progress` for unreviewed count
- If Phase 6 second-opinion workers blocked, drain DLQ

### PHI leak suspected

1. `wrangler tail --format=pretty` to capture
2. Roll back worker
3. Inspect Langfuse redaction tests
4. File CERT-In notification within 72h (DPDP Act)

### Rollback

Migrations are additive — rollback = worker redeploy + feature-flag flip in `ai_config.features_json`.
