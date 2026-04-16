-- Phase 4 — DuckDB analytics pipeline cursors.
--
-- Adds the bookkeeping tables used by the new analytics-worker to track
-- per-table export cursors and run history, and finally creates the
-- long-missing `audit_log` table that existing worker routes already
-- INSERT into (logAudit() in apps/worker/src/routes/audit-log.ts). The
-- audit_log table was referenced but never formally created by a prior
-- migration; landing it here makes the exporter and existing code honest.
--
-- Additive only. Safe to re-apply.

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  campaign_code TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_campaign ON audit_log(campaign_code);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS analytics_cursor (
  table_name TEXT PRIMARY KEY,
  last_cursor TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_runs (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  rows INTEGER,
  bytes INTEGER,
  ms INTEGER,
  partitions INTEGER,
  status TEXT NOT NULL,            -- 'ok' | 'error' | 'skipped'
  error TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_analytics_runs_table ON analytics_runs(table_name);
CREATE INDEX IF NOT EXISTS idx_analytics_runs_created_at ON analytics_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_runs_status ON analytics_runs(status);
