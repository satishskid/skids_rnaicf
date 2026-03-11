#!/usr/bin/env node
// Seed V3 with all V2 users — same emails & roles
// Usage: node scripts/seed-users.mjs

const API = process.env.SEED_API || 'https://skids-api.satish-9f4.workers.dev'
const DEFAULT_PASSWORD = 'Skids@2026'

const users = [
  // Admins
  { name: 'Satish (Admin)',   email: 'satish@skids.health',    role: 'admin',       password: DEFAULT_PASSWORD },
  { name: 'Dev Admin',        email: 'devadmin@skids.health',  role: 'admin',       password: DEFAULT_PASSWORD },
  { name: 'FS Dev',           email: 'fsdev@skids.health',     role: 'admin',       password: DEFAULT_PASSWORD },

  // Ops Managers
  { name: 'Ops Manager 1',    email: 'opsmgr1@skids.health',   role: 'ops_manager', password: DEFAULT_PASSWORD },
  { name: 'Ops Manager 2',    email: 'opsmgr2@skids.health',   role: 'ops_manager', password: DEFAULT_PASSWORD },
  { name: 'Ops Manager 3',    email: 'opsmgr3@skids.health',   role: 'ops_manager', password: DEFAULT_PASSWORD },

  // Nurses
  { name: 'Nurse 1',          email: 'nurse1@skids.health',    role: 'nurse',       password: DEFAULT_PASSWORD },
  { name: 'Nurse 2',          email: 'nurse2@skids.health',    role: 'nurse',       password: DEFAULT_PASSWORD },
  { name: 'Nurse 3',          email: 'nurse3@skids.health',    role: 'nurse',       password: DEFAULT_PASSWORD },
  { name: 'Nurse 4',          email: 'nurse4@skids.health',    role: 'nurse',       password: DEFAULT_PASSWORD },
  { name: 'Nurse 5',          email: 'nurse5@skids.health',    role: 'nurse',       password: DEFAULT_PASSWORD },

  // Doctors
  { name: 'Doctor 1',         email: 'doctor1@skids.health',   role: 'doctor',      password: DEFAULT_PASSWORD },
  { name: 'Doctor 2',         email: 'doctor2@skids.health',   role: 'doctor',      password: DEFAULT_PASSWORD },
  { name: 'Doctor 3',         email: 'doctor3@skids.health',   role: 'doctor',      password: DEFAULT_PASSWORD },
  { name: 'Doctor 4',         email: 'doctor4@skids.health',   role: 'doctor',      password: DEFAULT_PASSWORD },
  { name: 'Doctor 5',         email: 'doctor5@skids.health',   role: 'doctor',      password: DEFAULT_PASSWORD },

  // Authority (read-only officials)
  { name: 'Authority 1',      email: 'auth1@skids.health',     role: 'authority',   password: DEFAULT_PASSWORD },
  { name: 'Authority 2',      email: 'auth2@skids.health',     role: 'authority',   password: DEFAULT_PASSWORD },
]

async function seedUsers() {
  console.log(`\n🌱 Seeding ${users.length} users to ${API}\n`)

  let created = 0, skipped = 0, failed = 0

  for (const user of users) {
    // Small delay to avoid CF Worker CPU limits
    await new Promise(r => setTimeout(r, 1500))
    try {
      const res = await fetch(`${API}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'https://skids-web.pages.dev' },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
          orgCode: 'zpedi',
        }),
      })

      const data = await res.json()

      if (res.ok && data.user) {
        console.log(`  ✅ ${user.role.padEnd(12)} ${user.email.padEnd(28)} → ${data.user.id}`)
        created++
      } else if (data.message?.includes('already exists') || data.code === 'USER_ALREADY_EXISTS') {
        console.log(`  ⏭️  ${user.role.padEnd(12)} ${user.email.padEnd(28)} → already exists`)
        skipped++
      } else {
        console.log(`  ❌ ${user.role.padEnd(12)} ${user.email.padEnd(28)} → ${data.message || JSON.stringify(data)}`)
        failed++
      }
    } catch (err) {
      console.log(`  ❌ ${user.role.padEnd(12)} ${user.email.padEnd(28)} → ${err.message}`)
      failed++
    }
  }

  console.log(`\n📊 Results: ${created} created, ${skipped} skipped, ${failed} failed`)
  console.log(`\n🔑 Default password for all accounts: ${DEFAULT_PASSWORD}`)
  console.log(`\n📋 Role summary:`)
  console.log(`   admin       → satish@, devadmin@, fsdev@skids.health`)
  console.log(`   ops_manager → opsmgr1-3@skids.health`)
  console.log(`   nurse       → nurse1-5@skids.health`)
  console.log(`   doctor      → doctor1-5@skids.health`)
  console.log(`   authority   → auth1-2@skids.health`)
}

seedUsers()
