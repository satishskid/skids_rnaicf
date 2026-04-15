# Phase 5 — Cloudflare Workflows + Queues

**Goal**: Replace ad-hoc async chains with a durable screening-lifecycle Workflow and a Queue for Sandbox fan-out. Campaign-day load spikes become absorbable.

**Prerequisites**: Phase 3 (Sandbox) complete. Best after Phase 2.

**Effort**: 2 days.

---

## Read first

- `packages/shared/src/screening-lifecycle.ts` — the lifecycle state machine (already exists in shared)
- `apps/worker/src/routes/observations.ts` — current flow (sync write, nothing async)
- `apps/worker/src/routes/report-render.ts` (from Phase 3)
- Cloudflare Workflows + Queues docs (current)

---

## Decisions

- **One Workflow per observation**, not per session. Observations are the atomic unit. Grouping is by `session_id` for reporting.
- **Workflow steps**: `persist → quality-gate → embed → enqueue-second-opinion → await-review → notify`
- **Queues**:
  - `sandbox-pdf` (from Phase 3, now formalized)
  - `sandbox-second-opinion` (new, used in Phase 6)
  - `analytics-trigger` (fires analytics partial refresh on high-priority events)
- **Concurrency**: Sandbox queue max-concurrency = 10 per worker. Tune via wrangler.
- **Dead-letter**: failed messages after 3 attempts go to `*-dlq` queue and trigger a Langfuse alert.

---

## Deliverables

1. `apps/worker/src/workflows/screening-observation.ts` — Workflow class
2. `apps/worker/src/queues/index.ts` — queue producer helpers
3. `apps/worker/src/queues/consumers/sandbox-pdf.ts`
4. `apps/worker/src/queues/consumers/sandbox-second-opinion.ts` (stub for Phase 6)
5. `apps/worker/src/queues/consumers/analytics-trigger.ts`
6. `apps/worker/src/queues/dlq.ts`
7. wrangler.toml — declare workflow + 3 queues + DLQ
8. Modify `apps/worker/src/routes/observations.ts` — kick off workflow instead of inline processing
9. Migration `0005_workflow_state.sql` — track workflow run id per observation
10. Admin UI: `apps/web/src/pages/AuthorityDashboard.tsx` — tile showing workflow latencies + queue depths
11. Tests (unit + integration)
12. Update `docs/RUNBOOK.md`

---

## Step-by-step

### 1. Workflow class

`apps/worker/src/workflows/screening-observation.ts`:

```typescript
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers'

export type ScreeningObservationParams = {
  observationId: string
  campaignCode: string
  sessionId: string
  moduleType: string
  priority: 'normal' | 'urgent'
}

export class ScreeningObservationWorkflow extends WorkflowEntrypoint<Env, ScreeningObservationParams> {
  async run(event: WorkflowEvent<ScreeningObservationParams>, step: WorkflowStep) {
    const { observationId } = event.payload

    const obs = await step.do('load observation', async () => {
      // ... load from Turso
    })

    await step.do('quality gate', async () => {
      // ... compute quality metrics, persist
    })

    await step.do('embed', {
      retries: { limit: 3, backoff: 'exponential', delay: '30s' },
    }, async () => {
      // ... call Phase 1 embedding
    })

    if (obs.needsSecondOpinion) {
      await step.do('enqueue second opinion', async () => {
        await this.env.SANDBOX_2ND_OPINION_Q.send({ observationId })
      })
    }

    await step.waitForEvent('doctor-review-complete', {
      timeout: '72h',
      type: 'doctor-review-complete',
    })

    await step.do('notify parent', async () => {
      // ... if reports_released, send via BHASH/Neodove
    })
  }
}
```

### 2. Queue declarations

wrangler.toml:
```toml
[[workflows]]
name = "screening-observation"
binding = "SCREENING_WF"
class_name = "ScreeningObservationWorkflow"

[[queues.producers]]
binding = "SANDBOX_PDF_Q"
queue = "sandbox-pdf"

[[queues.producers]]
binding = "SANDBOX_2ND_OPINION_Q"
queue = "sandbox-second-opinion"

[[queues.producers]]
binding = "ANALYTICS_Q"
queue = "analytics-trigger"

[[queues.consumers]]
queue = "sandbox-pdf"
max_batch_size = 5
max_concurrency = 10
dead_letter_queue = "sandbox-pdf-dlq"

[[queues.consumers]]
queue = "sandbox-second-opinion"
max_batch_size = 2
max_concurrency = 5
dead_letter_queue = "sandbox-2nd-opinion-dlq"

[[queues.consumers]]
queue = "analytics-trigger"
max_batch_size = 20
max_concurrency = 2
```

### 3. Consumers

Each consumer file exports a handler that reads a batch of messages, processes, ack/nack per message. `sandbox-pdf` calls the Phase 3 render path. `sandbox-second-opinion` is a stub for Phase 6. `analytics-trigger` calls analytics-worker refresh endpoint.

DLQ handler emits a Langfuse alert + writes to `audit_log` with action `queue.dlq`.

### 4. Route change

`observations.ts` POST flow:

```typescript
// after INSERT success:
const wfInstance = await c.env.SCREENING_WF.create({
  params: { observationId, campaignCode, sessionId, moduleType, priority },
})
await db.execute({
  sql: `UPDATE observations SET workflow_id = ? WHERE id = ?`,
  args: [wfInstance.id, observationId],
})
return c.json({ ok: true, observationId, workflowId: wfInstance.id })
```

Critical: the HTTP request returns within 200ms. All real work happens in the workflow.

### 5. Migration

`0005_workflow_state.sql`:
```sql
ALTER TABLE observations ADD COLUMN workflow_id TEXT;
CREATE INDEX IF NOT EXISTS idx_obs_workflow ON observations(workflow_id);
CREATE TABLE IF NOT EXISTS workflow_events (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,
  ms INTEGER,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 6. Admin tile

`AuthorityDashboard.tsx`:
- "Today's queue depth" — one number per queue (via `/api/admin/queue-stats`)
- "Workflow P50/P95 latency" — from `workflow_events`
- "DLQ count" — link to DLQ viewer page

### 7. Tests

- Mock Workflow framework; unit-test each step in isolation
- Integration: post 10 observations, assert 10 workflow instances created, 10 complete within 60s (fake review complete via event dispatch)
- Chaos: force embed step to fail twice, succeed on 3rd — assert retries work
- Timeout: workflow hits 72h review timeout → step completes with `timeout` status, observation flagged

### 8. Runbook

- How to replay a DLQ message
- How to inspect a stuck workflow
- How to drain a queue during deploy
- Capacity planning: per-minute inflight budget

---

## Acceptance criteria

- [ ] `pnpm typecheck && pnpm build` green
- [ ] A posted observation returns in < 200ms (P95)
- [ ] Workflow completes end-to-end on happy path within 10s (no second-opinion) / 5 min (with)
- [ ] 100-observation load test: no failures, Sandbox concurrency cap respected
- [ ] DLQ receives messages when configured to fail; alert fires
- [ ] `workflow_events` table populated for every step
- [ ] AuthorityDashboard shows live queue + latency numbers

## Rollback

Feature flag `features_json.use_workflow` — when false, observations.ts falls back to inline processing. Keep both paths in code until Phase 6 is green.

## Out of scope

- Workflow fan-out to multiple regions (single-region for now)
- UI for manually replaying workflows (CLI script only this phase)
- Cross-observation batch workflows (do per-observation only)
