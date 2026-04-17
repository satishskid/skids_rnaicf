-- Phase 06 — Sandbox-based second-opinion state.
--
-- Three tables land together because they share one workflow:
--   ai_annotations_secondary   — heavier ONNX re-analysis rows, parallel
--                                to ai_annotations. Tier is on the row so
--                                the Doctor Inbox renders both uniformly.
--   session_ai_budget          — caps second-opinion cost per screening
--                                session (default 5/session). Enforced by
--                                the consumer before requesting inference.
--   accuracy_metrics           — paired-label rollup used by the model
--                                accuracy dashboard. Populated as doctor
--                                reviews accumulate.
--
-- Additive. Safe to re-apply — IF NOT EXISTS guards, UNIQUE dedup.

CREATE TABLE IF NOT EXISTS ai_annotations_secondary (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  annotations TEXT NOT NULL,              -- JSON, same shape as ai_annotations
  quality TEXT,                           -- 'good' | 'fair' | 'poor' | null
  ms_inference INTEGER,
  agreement_tier1 REAL,                   -- 0..1 vs. primary annotation
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'ok' | 'error' | 'skipped'
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE(observation_id, model_version)
);
CREATE INDEX IF NOT EXISTS idx_second_obs ON ai_annotations_secondary(observation_id);
CREATE INDEX IF NOT EXISTS idx_second_status ON ai_annotations_secondary(status);
CREATE INDEX IF NOT EXISTS idx_second_created ON ai_annotations_secondary(created_at);

CREATE TABLE IF NOT EXISTS session_ai_budget (
  session_id TEXT PRIMARY KEY,
  second_opinion_count INTEGER DEFAULT 0,
  budget_limit INTEGER DEFAULT 5,
  last_update TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accuracy_metrics (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id),
  module_type TEXT NOT NULL,
  tier1_label TEXT,
  tier2_label TEXT,
  secondary_label TEXT,
  doctor_label TEXT,
  agreement_score REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accuracy_obs ON accuracy_metrics(observation_id);
CREATE INDEX IF NOT EXISTS idx_accuracy_module ON accuracy_metrics(module_type);
CREATE INDEX IF NOT EXISTS idx_accuracy_created ON accuracy_metrics(created_at);
