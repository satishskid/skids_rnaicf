-- Phase 03 — extra columns on report_tokens for the C-pivot consumer route.
-- Additive ALTERs. Safe on fresh databases (re-applies are no-ops modulo a
-- logged "duplicate column" error from the migrator's try/catch).
--
-- Columns:
--   report_id     — opaque public identifier used in /api/reports/:id/pdf.
--                   Distinct from token_hash so the URL does not leak the
--                   hashed-token value.
--   report_r2_key — full key into R2_REPORTS_BUCKET for this issuance.
--                   Format: reports/{report_id}/{yyyy-mm-dd}/{data-hash}.pdf
--   rate_limit    — per-token access cap. Serve handler rejects with 403
--                   once access_count reaches this value.

ALTER TABLE report_tokens ADD COLUMN report_id TEXT;
ALTER TABLE report_tokens ADD COLUMN report_r2_key TEXT NOT NULL DEFAULT '';
ALTER TABLE report_tokens ADD COLUMN rate_limit INTEGER NOT NULL DEFAULT 60;

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_tokens_report_id ON report_tokens(report_id);
