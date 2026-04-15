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
  metadata TEXT,  -- JSON for flexible fields
  reports_released INTEGER DEFAULT 0,  -- 0 = not released, 1 = parent reports available
  archive_url TEXT,     -- R2 key for archived campaign JSON
  archived_by TEXT      -- User who archived
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
  qr_code TEXT UNIQUE,  -- 8-char code for parent portal access (printed on health card)
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_children_qr ON children(qr_code);
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
  -- Vector embedding (Phase 1) — 384-dim bge-small-en-v1.5 via Workers AI
  embedding F32_BLOB(384),
  embedding_text_hash TEXT,
  embedded_at TEXT,
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
CREATE INDEX IF NOT EXISTS idx_obs_embedding
  ON observations(libsql_vector_idx(embedding));
CREATE INDEX IF NOT EXISTS idx_obs_embedded_at ON observations(embedded_at);

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
-- Base columns created in schema.sql; Phase 2 migration 0002 adds
-- cached, gateway_request_id, langfuse_trace_id, cost_usd_micros,
-- module_type, provider, user_id, session_id.
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  campaign_code TEXT NOT NULL,
  model TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('device', 'laptop', 'cloud')),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER,
  cost_usd REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  -- Phase 2 additions (also applied via 0002_ai_usage_extension.sql for existing DBs)
  cached INTEGER DEFAULT 0,
  gateway_request_id TEXT,
  langfuse_trace_id TEXT,
  cost_usd_micros INTEGER,
  module_type TEXT,
  provider TEXT,
  user_id TEXT,
  session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_campaign ON ai_usage(campaign_code);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_module ON ai_usage(module_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider);

-- Child absences (attendance tracking)
CREATE TABLE IF NOT EXISTS absences (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  campaign_code TEXT NOT NULL REFERENCES campaigns(code),
  date TEXT NOT NULL,
  reason TEXT,
  marked_by TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_absences_campaign ON absences(campaign_code);
CREATE INDEX IF NOT EXISTS idx_absences_child ON absences(child_id);

-- Training samples (doctor feedback for AI training)
CREATE TABLE IF NOT EXISTS training_samples (
  id TEXT PRIMARY KEY,
  campaign_code TEXT NOT NULL REFERENCES campaigns(code),
  observation_id TEXT NOT NULL REFERENCES observations(id),
  doctor_id TEXT NOT NULL,
  doctor_name TEXT,
  feedback TEXT NOT NULL,  -- JSON: { agree: bool, corrections: {...}, notes: string }
  module_type TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_training_campaign ON training_samples(campaign_code);
CREATE INDEX IF NOT EXISTS idx_training_module ON training_samples(module_type);

-- AyuSynk AI diagnosis reports (heart/lung analysis from AyuShare)
CREATE TABLE IF NOT EXISTS ayusync_reports (
  id TEXT PRIMARY KEY,
  campaign_code TEXT NOT NULL,
  child_id TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  reports TEXT NOT NULL,            -- JSON array of AyuSynkReport objects
  source TEXT NOT NULL DEFAULT 'ayushare_webhook',
  processed INTEGER DEFAULT 0,     -- 0 = pending, 1 = linked to observation
  received_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ayusync_campaign ON ayusync_reports(campaign_code);
CREATE INDEX IF NOT EXISTS idx_ayusync_child ON ayusync_reports(campaign_code, child_id);

-- Campaign assignments (authority scoping — which users see which campaigns)
CREATE TABLE IF NOT EXISTS campaign_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  campaign_code TEXT NOT NULL REFERENCES campaigns(code),
  assigned_by TEXT NOT NULL,
  assigned_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, campaign_code)
);
CREATE INDEX IF NOT EXISTS idx_ca_user ON campaign_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_ca_campaign ON campaign_assignments(campaign_code);

-- ============================================
-- CLINICAL RESEARCH PLATFORM TABLES
-- ============================================

-- Consent form templates (created by researchers/admins)
CREATE TABLE IF NOT EXISTS consent_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  org_code TEXT NOT NULL,
  title TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  language TEXT NOT NULL DEFAULT 'en',
  body_html TEXT NOT NULL,
  requires_witness INTEGER DEFAULT 0,
  min_age_for_assent INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ct_org ON consent_templates(org_code);

-- Individual consent records
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  template_id TEXT NOT NULL REFERENCES consent_templates(id),
  campaign_code TEXT REFERENCES campaigns(code),
  child_id TEXT REFERENCES children(id),
  guardian_name TEXT NOT NULL,
  guardian_relation TEXT,
  guardian_signature TEXT,
  child_assent_signature TEXT,
  witness_name TEXT,
  witness_signature TEXT,
  consented INTEGER NOT NULL DEFAULT 1,
  consent_date TEXT DEFAULT (datetime('now')),
  ip_address TEXT,
  device_info TEXT,
  withdrawn_at TEXT,
  withdrawn_reason TEXT,
  collected_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_consents_child ON consents(child_id);
CREATE INDEX IF NOT EXISTS idx_consents_campaign ON consents(campaign_code);
CREATE INDEX IF NOT EXISTS idx_consents_template ON consents(template_id);

-- Survey/instrument definitions (JSON schema, SurveyJS-compatible)
CREATE TABLE IF NOT EXISTS instruments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  org_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('screening', 'survey', 'questionnaire', 'crf')),
  schema_json TEXT NOT NULL,
  scoring_logic TEXT,
  version TEXT DEFAULT '1.0',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_instruments_org ON instruments(org_code);

-- Individual survey responses
CREATE TABLE IF NOT EXISTS instrument_responses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  campaign_code TEXT,
  child_id TEXT REFERENCES children(id),
  respondent_type TEXT CHECK (respondent_type IN ('nurse', 'parent', 'teacher', 'self', 'doctor')),
  response_json TEXT NOT NULL,
  score_json TEXT,
  completed INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  collected_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ir_instrument ON instrument_responses(instrument_id);
CREATE INDEX IF NOT EXISTS idx_ir_child ON instrument_responses(child_id);
CREATE INDEX IF NOT EXISTS idx_ir_campaign ON instrument_responses(campaign_code);

-- Studies (clinical trials, research projects)
CREATE TABLE IF NOT EXISTS studies (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  org_code TEXT NOT NULL,
  title TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  description TEXT,
  study_type TEXT NOT NULL CHECK (study_type IN ('observational', 'interventional', 'cohort', 'cross_sectional')),
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'recruiting', 'active', 'paused', 'completed', 'archived')),
  pi_name TEXT,
  pi_email TEXT,
  irb_number TEXT,
  start_date TEXT,
  end_date TEXT,
  target_enrollment INTEGER,
  consent_template_id TEXT REFERENCES consent_templates(id),
  protocol_document_url TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_studies_org ON studies(org_code);
CREATE INDEX IF NOT EXISTS idx_studies_code ON studies(short_code);

-- Study arms (e.g., control vs intervention)
CREATE TABLE IF NOT EXISTS study_arms (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  study_id TEXT NOT NULL REFERENCES studies(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sa_study ON study_arms(study_id);

-- Study events (scheduled timepoints)
CREATE TABLE IF NOT EXISTS study_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  study_id TEXT NOT NULL REFERENCES studies(id),
  name TEXT NOT NULL,
  day_offset INTEGER NOT NULL,
  window_before INTEGER DEFAULT 3,
  window_after INTEGER DEFAULT 7,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_se_study ON study_events(study_id);

-- Which instruments are collected at each event
CREATE TABLE IF NOT EXISTS study_event_instruments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  study_event_id TEXT NOT NULL REFERENCES study_events(id),
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  required INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sei_event ON study_event_instruments(study_event_id);

-- Study enrollment (links children to studies + arms)
CREATE TABLE IF NOT EXISTS study_enrollments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  study_id TEXT NOT NULL REFERENCES studies(id),
  child_id TEXT NOT NULL REFERENCES children(id),
  arm_id TEXT REFERENCES study_arms(id),
  consent_id TEXT REFERENCES consents(id),
  enrolled_at TEXT DEFAULT (datetime('now')),
  withdrawn_at TEXT,
  withdrawn_reason TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  enrolled_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_senr_study ON study_enrollments(study_id);
CREATE INDEX IF NOT EXISTS idx_senr_child ON study_enrollments(child_id);

-- ============================================
-- PARENT PORTAL BRIDGE TABLES
-- ============================================

-- Parent claims — links V3 screening children to parent portal firebase users
-- This is the identity bridge between V3 (Better Auth) and Parent Portal (Firebase)
CREATE TABLE IF NOT EXISTS parent_claims (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  child_id TEXT NOT NULL REFERENCES children(id),
  firebase_uid TEXT NOT NULL,
  parent_phone TEXT,
  parent_name TEXT,
  parent_email TEXT,
  verified_at TEXT DEFAULT (datetime('now')),
  UNIQUE(child_id, firebase_uid)
);
CREATE INDEX IF NOT EXISTS idx_parent_claims_firebase ON parent_claims(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_parent_claims_child ON parent_claims(child_id);

-- Saved cohort definitions (reusable queries)
CREATE TABLE IF NOT EXISTS cohort_definitions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  org_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filter_json TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cohort_org ON cohort_definitions(org_code);

-- Phase 3 — Sandbox PDF reports
CREATE TABLE IF NOT EXISTS report_tokens (
  token_hash TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  campaign_code TEXT NOT NULL REFERENCES campaigns(code),
  report_type TEXT NOT NULL CHECK (report_type IN ('fourd', 'child', 'parent')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  access_count INTEGER NOT NULL DEFAULT 0,
  -- Phase 03 — added by migrations/0003a_report_tokens_phase03_extras.sql
  report_id TEXT,
  report_r2_key TEXT NOT NULL DEFAULT '',
  rate_limit INTEGER NOT NULL DEFAULT 60
);
CREATE INDEX IF NOT EXISTS idx_report_tokens_child ON report_tokens(child_id);
CREATE INDEX IF NOT EXISTS idx_report_tokens_campaign ON report_tokens(campaign_code);
CREATE INDEX IF NOT EXISTS idx_report_tokens_expiry ON report_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_tokens_report_id ON report_tokens(report_id);

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
