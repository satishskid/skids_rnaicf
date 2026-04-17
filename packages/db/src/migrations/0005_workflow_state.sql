-- Phase 05 — Cloudflare Workflows + Queues durable state.
--
-- Adds a workflow_id pointer on observations and a per-step event log so
-- ops can reconstruct any screening's trajectory through
-- ScreeningObservationWorkflow (persist → quality-gate → embed →
-- enqueue-second-opinion → await-review → notify). Additive only; safe to
-- re-apply.

ALTER TABLE observations ADD COLUMN workflow_id TEXT;
CREATE INDEX IF NOT EXISTS idx_obs_workflow ON observations(workflow_id);

CREATE TABLE IF NOT EXISTS workflow_events (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,           -- 'started' | 'ok' | 'error' | 'skipped' | 'timeout'
  ms INTEGER,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wfe_obs ON workflow_events(observation_id);
CREATE INDEX IF NOT EXISTS idx_wfe_workflow ON workflow_events(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wfe_created ON workflow_events(created_at);
CREATE INDEX IF NOT EXISTS idx_wfe_status ON workflow_events(status);
