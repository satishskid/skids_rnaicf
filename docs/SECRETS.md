# Secrets — SKIDS Screen V3

Single source of truth for every secret the worker (and downstream workers) needs. All secrets set via `wrangler secret put <NAME>` unless noted.

## Baseline (already present before Phase 00)

| Secret | Scope | Notes |
|---|---|---|
| `TURSO_URL` | skids-api | libSQL URL for primary |
| `TURSO_AUTH_TOKEN` | skids-api | Rotate every 90 days |
| `BETTER_AUTH_SECRET` | skids-api | Session signing key |
| `BETTER_AUTH_API_KEY` | skids-api | Admin-scoped |
| `BETTER_AUTH_URL` | skids-api `[vars]` | Public; not a secret |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | skids-api | For presigned URLs |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | skids-api | |
| `CLOUDFLARE_R2_ENDPOINT` | skids-api | |
| `CLOUDFLARE_R2_BUCKET` | skids-api | `skids-media` |
| `AYUSYNC_WEBHOOK_SECRET` | skids-api | AyuSynk device webhook HMAC |
| `GEMINI_API_KEY` | skids-api | Now optional per-org overflow (Phase 2 tier 3) |

## Phase 2 — Cloud AI suggestions for doctors (admin-gated)

Required for any cloud AI activity:

| Secret | Scope | Purpose |
|---|---|---|
| `GROQ_API_KEY` | skids-api | **Required.** Tier-2 failover — `llama-3.3-70b-versatile`, same family as workers-ai tier 1 |
| `LANGFUSE_SECRET_KEY` | skids-api | Langfuse ingestion auth |
| `LANGFUSE_PUBLIC_KEY` | skids-api | Langfuse ingestion auth |
| `LANGFUSE_BASE_URL` | skids-api `[vars]` | e.g. `https://langfuse.skids.internal` |
| `AI_GATEWAY_ACCOUNT_ID` | skids-api `[vars]` | CF account |
| `AI_GATEWAY_ID` | skids-api `[vars]` | Gateway slug (`skids-screen`) |

Optional per-org overflow (tier 3 / tier 4). Only reached when admin adds the
provider to `ai_config.features.overflow_providers`:

| Secret | Scope | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | skids-api | Tier 3 overflow — Gemini 2.0 Flash |
| `ANTHROPIC_API_KEY` | skids-api | Tier 4 overflow — Claude Haiku 4.5 |

Failover chain: `workers-ai (@cf/meta/llama-3.3-70b-instruct-fp8-fast)` →
`groq (llama-3.3-70b-versatile)` → *(optional)* `gemini` → *(optional)* `claude`.

## Phase 3 — Sandbox PDF reports

| Secret | Scope | Purpose |
|---|---|---|
| `SANDBOX_SIGNING_KEY` | skids-api | HMAC for `/serve/<token>` parent report URLs |
| `REPORT_CACHE_VERSION` | skids-api `[vars]` | Bump to invalidate rendered PDF cache |

## Phase 4 — DuckDB analytics worker

| Secret | Scope | Purpose |
|---|---|---|
| `ANALYTICS_R2_ACCESS_KEY_ID` | analytics-worker | Separate key scoped to `skids-analytics` |
| `ANALYTICS_R2_SECRET_ACCESS_KEY` | analytics-worker | — |

## Phase 6 — Second opinion

| Secret | Scope | Purpose |
|---|---|---|
| `SECOND_OPINION_MODEL_BUCKET` | skids-api `[vars]` | `skids-models` |
| `SECOND_OPINION_QUEUE` | skids-api `[vars]` | Binding name |

## Phase 7 — Evidence RAG

(no new secrets — Vectorize binding + `skids-evidence` R2 bucket in `wrangler.toml`)

## Phase 8 — MotherDuck (DEFERRED)

| Secret | Scope | Purpose |
|---|---|---|
| `MOTHERDUCK_TOKEN` | analytics-worker | MotherDuck DSN |

## Rotation policy

- Auth / DB tokens: 90 days
- R2 keys: 180 days or on personnel change
- HMAC signing keys: 365 days; emit a 30-day grace using a second key before removing the old one
- Provider API keys: rotate on any suspected leak

## Setting secrets

```bash
pnpm --filter @skids/worker exec wrangler secret put TURSO_URL
pnpm --filter @skids/analytics-worker exec wrangler secret put ANALYTICS_R2_ACCESS_KEY_ID  # Phase 4+
```

## Audit

`scripts/preflight.sh` compares deployed secrets against this list. Missing = preflight fails.
