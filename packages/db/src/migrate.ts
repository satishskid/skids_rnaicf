// Run schema migration against Turso
// Usage: pnpm --filter @skids/db migrate

import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const url = process.env.TURSO_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url || !authToken) {
    console.error('Set TURSO_URL and TURSO_AUTH_TOKEN environment variables')
    process.exit(1)
  }

  const db = createClient({ url, authToken })

  console.log(`Connecting to ${url}...`)

  // Read and execute schema
  const schemaPath = join(__dirname, 'schema.sql')
  const schema = readFileSync(schemaPath, 'utf-8')

  // Split by semicolons and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
    .filter(s => s.length > 0)

  console.log(`Executing ${statements.length} statements...`)

  for (const sql of statements) {
    try {
      await db.execute(sql)
      // Show first 60 chars of each statement
      console.log(`  ✓ ${sql.slice(0, 60).replace(/\n/g, ' ')}...`)
    } catch (e) {
      console.error(`  ✗ ${sql.slice(0, 60).replace(/\n/g, ' ')}...`)
      console.error(`    Error: ${e instanceof Error ? e.message : e}`)
    }
  }

  // Verify tables
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  console.log(`\nTables in database:`)
  for (const row of tables.rows) {
    console.log(`  • ${row.name}`)
  }

  console.log('\n✅ Migration complete!')
}

migrate().catch(console.error)
