-- Phase 1 — Turso native vectors on observations
-- Additive migration. Safe to re-apply (IF NOT EXISTS guards).
-- Adds 384-dim embedding column (bge-small-en-v1.5), a text-hash for
-- skip-if-unchanged, and a timestamp for backfill progress tracking.

ALTER TABLE observations ADD COLUMN embedding F32_BLOB(384);
ALTER TABLE observations ADD COLUMN embedding_text_hash TEXT;
ALTER TABLE observations ADD COLUMN embedded_at TEXT;

CREATE INDEX IF NOT EXISTS idx_obs_embedding
  ON observations(libsql_vector_idx(embedding));

CREATE INDEX IF NOT EXISTS idx_obs_embedded_at ON observations(embedded_at);
