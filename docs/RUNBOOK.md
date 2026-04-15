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

## Phase 01–07

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
