// PIN authentication migration — adds pinHash to user table + rate-limit table
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

const db = createClient({
  url: env.TURSO_URL,
  authToken: env.TURSO_AUTH_TOKEN,
})

console.log('Running PIN auth migration...')

const statements = [
  // Add pinHash column to user table
  `ALTER TABLE user ADD COLUMN "pinHash" TEXT`,

  // Unique index on pinHash (only non-null values)
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pin_hash ON user("pinHash") WHERE "pinHash" IS NOT NULL`,

  // Rate-limiting table for PIN login attempts
  `CREATE TABLE IF NOT EXISTS pin_attempt (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    attemptAt TEXT DEFAULT (datetime('now')),
    success INTEGER DEFAULT 0
  )`,

  // Index for rate-limit queries
  `CREATE INDEX IF NOT EXISTS idx_pin_attempt_lookup ON pin_attempt(identifier, attemptAt)`,
]

for (const sql of statements) {
  try {
    await db.execute(sql)
    console.log('  OK:', sql.slice(0, 60) + '...')
  } catch (e) {
    // Column may already exist, table may already exist
    const msg = e.message || ''
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log('  SKIP (already exists):', sql.slice(0, 60) + '...')
    } else {
      console.error('  FAIL:', msg)
    }
  }
}

console.log('PIN auth migration complete.')
process.exit(0)
