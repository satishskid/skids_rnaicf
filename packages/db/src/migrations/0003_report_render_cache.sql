-- Phase 3 — Sandbox PDF reports: render cache + hashed-token issuance
--
-- Note (2026-04-16): This migration originally named the Phase 03 table
-- `report_tokens` which collided with the pre-Phase-03 parent-portal flow
-- in apps/worker/src/routes/report-tokens.ts (different shape: 12-char
-- URL token, camelCase columns, already-live on-demand CREATE). The
-- collision caused `CREATE TABLE IF NOT EXISTS` to silently no-op against
-- the legacy camelCase table, and then `CREATE INDEX ... ON (child_id)`
-- silently failed because the live table had `childId` not `child_id`.
-- Phase 03 now uses `report_access_tokens` as a distinct table.
-- Additive; safe to re-run.

-- Report access tokens. token_hash is sha256(random_component). The raw
-- token is never persisted — only delivered to the recipient once, at
-- issuance. Access predicate on serve:
--   expires_at > now() AND revoked_at IS NULL AND access_count < rate_limit
CREATE TABLE IF NOT EXISTS report_access_tokens (
  token_hash TEXT PRIMARY KEY,                                   -- sha256(random part of token)
  report_id TEXT NOT NULL,                                       -- opaque public id used in /api/reports/:id/pdf
  report_r2_key TEXT NOT NULL,                                   -- key into R2_REPORTS_BUCKET
  child_id TEXT NOT NULL REFERENCES children(id),
  campaign_code TEXT NOT NULL REFERENCES campaigns(code),
  report_type TEXT NOT NULL CHECK (report_type IN ('fourd', 'child', 'parent')),
  created_by TEXT,                                               -- issuer user id (nullable for bulk-release/system)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,                                                  -- first successful access; NULL = never served
  revoked_at TEXT,                                               -- NULL = active
  access_count INTEGER NOT NULL DEFAULT 0,
  rate_limit INTEGER NOT NULL DEFAULT 60                         -- per-token access cap; 403 once access_count = rate_limit
);
CREATE INDEX IF NOT EXISTS idx_report_access_tokens_child ON report_access_tokens(child_id);
CREATE INDEX IF NOT EXISTS idx_report_access_tokens_campaign ON report_access_tokens(campaign_code);
CREATE INDEX IF NOT EXISTS idx_report_access_tokens_expiry ON report_access_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_access_tokens_report_id ON report_access_tokens(report_id);

-- Content-addressable PDF render cache. cache_key = sha256(report_type +
-- child_id + canonical(content) + template_version). Lifetime of the R2
-- object is governed by bucket lifecycle (365d, see wrangler.toml); no
-- DB-level TTL.
CREATE TABLE IF NOT EXISTS report_renders (
  cache_key TEXT PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('fourd', 'child', 'parent')),
  child_id TEXT NOT NULL REFERENCES children(id),
  r2_key TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  ms_render INTEGER NOT NULL,
  template_version TEXT NOT NULL,
  renderer TEXT NOT NULL DEFAULT 'weasyprint',
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_report_renders_child ON report_renders(child_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_renders_created ON report_renders(created_at);
