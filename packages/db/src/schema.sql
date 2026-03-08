-- ============================================
-- SKIDS Screen V3 — Turso (libSQL) Schema
-- ============================================

-- Campaigns (organizations in Better Auth terms)
CREATE TABLE IF NOT EXISTS campaigns (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org_code TEXT,
  school_name TEXT,
  academic_year TEXT,
  campaign_type TEXT DEFAULT 'school_health_4d',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'paused')),
  enabled_modules TEXT NOT NULL DEFAULT '[]',  -- JSON array
  custom_modules TEXT DEFAULT '[]',            -- JSON array
  total_children INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  -- Location
  city TEXT,
  state TEXT,
  district TEXT,
  address TEXT,
  pincode TEXT,
  lat REAL,
  lng REAL,
  metadata TEXT  -- JSON for flexible fields
);

-- Children (patients)
CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dob TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  location TEXT,
  photo_url TEXT,
  admission_number TEXT,
  class TEXT,
  section TEXT,
  academic_year TEXT,
  school_name TEXT,
  campaign_code TEXT NOT NULL REFERENCES campaigns(code),
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_children_campaign ON children(campaign_code);

-- Observations (screening results)
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  child_id TEXT NOT NULL REFERENCES children(id),
  campaign_code TEXT NOT NULL REFERENCES campaigns(code),
  module_type TEXT NOT NULL,
  body_region TEXT,
  media_url TEXT,
  media_urls TEXT,       -- JSON array of R2 URLs
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio')),
  capture_metadata TEXT,  -- JSON
  ai_annotations TEXT,    -- JSON array
  annotation_data TEXT,   -- JSON
  clinician_review TEXT,  -- JSON
  risk_level INTEGER DEFAULT 0,
  -- Vector embedding for similarity search (384-dim for all-MiniLM-L6-v2)
  -- embedding F32_BLOB(384),  -- Uncomment when Turso vectors are needed
  screened_by TEXT NOT NULL,
  device_id TEXT,
  timestamp TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_obs_campaign ON observations(campaign_code);
CREATE INDEX IF NOT EXISTS idx_obs_child ON observations(child_id);
CREATE INDEX IF NOT EXISTS idx_obs_module ON observations(campaign_code, module_type);
CREATE INDEX IF NOT EXISTS idx_obs_unsynced ON observations(synced_at) WHERE synced_at IS NULL;

-- Doctor Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL REFERENCES observations(id),
  campaign_code TEXT NOT NULL,
  clinician_id TEXT NOT NULL,
  clinician_name TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'refer', 'follow_up', 'discharge', 'retake')),
  notes TEXT,
  quality_rating TEXT CHECK (quality_rating IN ('good', 'fair', 'poor')),
  quality_notes TEXT,
  retake_reason TEXT,
  reviewed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_obs ON reviews(observation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_campaign ON reviews(campaign_code);

-- Sync tracking
CREATE TABLE IF NOT EXISTS sync_state (
  observation_id TEXT PRIMARY KEY REFERENCES observations(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed')),
  media_status TEXT NOT NULL DEFAULT 'pending' CHECK (media_status IN ('pending', 'uploading', 'uploaded', 'failed', 'na')),
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  last_attempt_at TEXT,
  synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_state(status);

-- AI usage tracking
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  campaign_code TEXT NOT NULL,
  model TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('device', 'laptop', 'cloud')),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER,
  cost_usd REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_campaign ON ai_usage(campaign_code);
