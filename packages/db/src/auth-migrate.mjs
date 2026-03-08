// Create Better Auth tables in Turso
// Better Auth manages these tables for user/session/org data
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

console.log('Creating Better Auth tables...')

// Better Auth core tables
const statements = [
  // Users
  `CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER DEFAULT 0,
    image TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  // Sessions
  `CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id)
  )`,

  // Accounts (OAuth + email/password)
  `CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id),
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt TEXT,
    refreshTokenExpiresAt TEXT,
    scope TEXT,
    password TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  // Verification tokens (email, password reset)
  `CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  )`,

  // Organizations (= Campaigns in SKIDS)
  `CREATE TABLE IF NOT EXISTS organization (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    logo TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    metadata TEXT
  )`,

  // Organization Members (nurse/doctor/admin in a campaign)
  `CREATE TABLE IF NOT EXISTS member (
    id TEXT PRIMARY KEY,
    organizationId TEXT NOT NULL REFERENCES organization(id),
    userId TEXT NOT NULL REFERENCES user(id),
    role TEXT NOT NULL DEFAULT 'nurse',
    createdAt TEXT DEFAULT (datetime('now'))
  )`,

  // Organization Invitations
  `CREATE TABLE IF NOT EXISTS invitation (
    id TEXT PRIMARY KEY,
    organizationId TEXT NOT NULL REFERENCES organization(id),
    email TEXT NOT NULL,
    role TEXT,
    status TEXT DEFAULT 'pending',
    expiresAt TEXT NOT NULL,
    inviterId TEXT NOT NULL REFERENCES user(id)
  )`,
]

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

// Verify all tables
const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
console.log(`\nAll tables in database:`)
for (const row of tables.rows) {
  console.log(`  • ${row.name}`)
}

console.log('\n✅ Better Auth tables ready!')
