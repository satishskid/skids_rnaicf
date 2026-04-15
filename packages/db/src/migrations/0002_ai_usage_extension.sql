-- Phase 2 — AI Gateway + Langfuse extension.
-- Additive only. Columns are nullable (or defaulted) so existing rows remain valid.
-- Wrap each ALTER in a try-around-it by relying on caller idempotency; libSQL does
-- not support IF NOT EXISTS on ADD COLUMN, so re-running this file will fail on
-- the second apply — drivers should track which migrations have run.

ALTER TABLE ai_usage ADD COLUMN cached INTEGER DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN gateway_request_id TEXT;
ALTER TABLE ai_usage ADD COLUMN langfuse_trace_id TEXT;
ALTER TABLE ai_usage ADD COLUMN cost_usd_micros INTEGER;
ALTER TABLE ai_usage ADD COLUMN module_type TEXT;
ALTER TABLE ai_usage ADD COLUMN provider TEXT;
ALTER TABLE ai_usage ADD COLUMN user_id TEXT;
ALTER TABLE ai_usage ADD COLUMN session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_module ON ai_usage(module_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider);
