-- Phase 03 — extras on the Phase 03 token table.
--
-- HISTORY (2026-04-16): this file originally ALTERed `report_tokens` to add
-- `report_id`, `report_r2_key`, `rate_limit`. That was a bug: the Phase 03
-- token table was colliding with the pre-Phase-03 parent-portal table of
-- the same name (see apps/worker/src/routes/report-tokens.ts — camelCase
-- columns, 12-char raw token key). The ALTERs landed on the legacy table
-- and did nothing useful for Phase 03 code (which queries snake_case
-- columns that don't exist on the legacy table).
--
-- Fix (2026-04-16): renamed the Phase 03 table to `report_access_tokens`
-- and folded all columns (including the former "extras") into
-- migrations/0003_report_render_cache.sql. This file is retained as a
-- no-op for migration-history consistency and to repair any environment
-- where 0003a already ran against the legacy `report_tokens` table.
--
-- The cleanup below is idempotent:
--   * If the legacy `report_tokens` table still has the three ALTER-added
--     columns, they are left alone (dropping would require SQLite 3.35+
--     and offers no benefit — they are ignored by both code paths).
--   * The stale unique index idx_report_tokens_report_id is dropped so
--     the name is free for any future reuse; on envs where it never
--     existed this is a no-op.

DROP INDEX IF EXISTS idx_report_tokens_report_id;

-- Intentionally left without further ALTERs. The Phase 03 token table is
-- now `report_access_tokens`, fully defined in 0003_report_render_cache.sql.
