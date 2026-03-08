// Quick migration runner — reads .dev.vars from worker
import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Read env from worker .dev.vars
const devVarsPath = join(__dirname, '../../../apps/worker/.dev.vars')
const devVars = readFileSync(devVarsPath, 'utf-8')
const env = {}
for (const line of devVars.split('\n')) {
  const [key, ...val] = line.split('=')
  if (key && val.length) env[key.trim()] = val.join('=').trim()
}

const url = env.TURSO_URL
const authToken = env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  console.error('Missing TURSO_URL or TURSO_AUTH_TOKEN in apps/worker/.dev.vars')
  process.exit(1)
}

console.log(`Connecting to ${url}...`)
const db = createClient({ url, authToken })

// Execute each statement individually (handles multi-line CREATE TABLE properly)
const statements = [
  // Campaigns
  `CREATE TABLE IF NOT EXISTS campaigns (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    org_code TEXT,
    school_name TEXT,
    academic_year TEXT,
    campaign_type TEXT DEFAULT 'school_health_4d',
    status TEXT NOT NULL DEFAULT 'active',
    enabled_modules TEXT NOT NULL DEFAULT '[]',
    custom_modules TEXT DEFAULT '[]',
    total_children INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    city TEXT,
    state TEXT,
    district TEXT,
    address TEXT,
    pincode TEXT,
    lat REAL,
    lng REAL,
    metadata TEXT
  )`,

  // Children
  `CREATE TABLE IF NOT EXISTS children (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dob TEXT NOT NULL,
    gender TEXT,
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_children_campaign ON children(campaign_code)`,

  // Observations
  `CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    child_id TEXT NOT NULL REFERENCES children(id),
    campaign_code TEXT NOT NULL REFERENCES campaigns(code),
    module_type TEXT NOT NULL,
    body_region TEXT,
    media_url TEXT,
    media_urls TEXT,
    media_type TEXT,
    capture_metadata TEXT,
    ai_annotations TEXT,
    annotation_data TEXT,
    clinician_review TEXT,
    risk_level INTEGER DEFAULT 0,
    screened_by TEXT NOT NULL,
    device_id TEXT,
    timestamp TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    synced_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_obs_campaign ON observations(campaign_code)`,
  `CREATE INDEX IF NOT EXISTS idx_obs_child ON observations(child_id)`,
  `CREATE INDEX IF NOT EXISTS idx_obs_module ON observations(campaign_code, module_type)`,
  `CREATE INDEX IF NOT EXISTS idx_obs_unsynced ON observations(synced_at) WHERE synced_at IS NULL`,

  // Reviews
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    observation_id TEXT NOT NULL REFERENCES observations(id),
    campaign_code TEXT NOT NULL,
    clinician_id TEXT NOT NULL,
    clinician_name TEXT NOT NULL,
    decision TEXT NOT NULL,
    notes TEXT,
    quality_rating TEXT,
    quality_notes TEXT,
    retake_reason TEXT,
    reviewed_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_obs ON reviews(observation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_campaign ON reviews(campaign_code)`,

  // Sync state
  `CREATE TABLE IF NOT EXISTS sync_state (
    observation_id TEXT PRIMARY KEY REFERENCES observations(id),
    status TEXT NOT NULL DEFAULT 'pending',
    media_status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    last_attempt_at TEXT,
    synced_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_state(status)`,

  // AI usage
  `CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY,
    campaign_code TEXT NOT NULL,
    model TEXT NOT NULL,
    tier TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER,
    cost_usd REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_campaign ON ai_usage(campaign_code)`,
]

console.log(`Executing ${statements.length} statements...`)

for (const sql of statements) {
  try {
    await db.execute(sql)
    const preview = sql.trim().split('\n')[0].slice(0, 65)
    console.log(`  ✓ ${preview}`)
  } catch (e) {
    const preview = sql.trim().split('\n')[0].slice(0, 65)
    console.error(`  ✗ ${preview}`)
    console.error(`    Error: ${e.message}`)
  }
}

// Verify
const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
console.log(`\nTables in database:`)
for (const row of tables.rows) {
  const count = await db.execute(`SELECT COUNT(*) as c FROM ${row.name}`)
  console.log(`  • ${row.name} (${count.rows[0].c} rows)`)
}

console.log('\n✅ Migration complete!')
