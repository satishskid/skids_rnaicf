-- Phase 07 — Vectorize evidence RAG bookkeeping.
--
-- Single-row table that mirrors the state of the skids-evidence
-- Vectorize index. Read from /api/evidence/index-status and written by
-- scripts/build-evidence-index.ts after each rebuild. No secondary keys
-- — the id=1 constraint keeps exactly one row.

CREATE TABLE IF NOT EXISTS evidence_index_version (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  categories_json TEXT,
  built_at TEXT DEFAULT (datetime('now')),
  built_by TEXT
);
INSERT OR IGNORE INTO evidence_index_version (id, version, chunk_count) VALUES (1, 0, 0);
