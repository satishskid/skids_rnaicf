#!/usr/bin/env node
// Set PINs for all test users so they can log in from mobile app
// Usage: node scripts/set-pins.mjs

const API = process.env.SEED_API || 'https://skids-api.satish-9f4.workers.dev'

// PIN assignments — easy to remember pattern:
// Admins: 1001-1003, Ops: 2001-2003, Nurses: 3001-3005, Doctors: 4001-4005, Authority: 5001-5002
const pinAssignments = [
  // Admins
  { email: 'satish@skids.health',   pin: '1001' },
  { email: 'devadmin@skids.health', pin: '1002' },
  { email: 'fsdev@skids.health',    pin: '1003' },

  // Ops Managers
  { email: 'opsmgr1@skids.health',  pin: '2001' },
  { email: 'opsmgr2@skids.health',  pin: '2002' },
  { email: 'opsmgr3@skids.health',  pin: '2003' },

  // Nurses
  { email: 'nurse1@skids.health',   pin: '3001' },
  { email: 'nurse2@skids.health',   pin: '3002' },
  { email: 'nurse3@skids.health',   pin: '3003' },
  { email: 'nurse4@skids.health',   pin: '3004' },
  { email: 'nurse5@skids.health',   pin: '3005' },

  // Doctors
  { email: 'doctor1@skids.health',  pin: '4001' },
  { email: 'doctor2@skids.health',  pin: '4002' },
  { email: 'doctor3@skids.health',  pin: '4003' },
  { email: 'doctor4@skids.health',  pin: '4004' },
  { email: 'doctor5@skids.health',  pin: '4005' },

  // Authority
  { email: 'auth1@skids.health',    pin: '5001' },
  { email: 'auth2@skids.health',    pin: '5002' },
]

const ORG_CODE = 'zpedi'

// SHA-256 hash matching the worker's hashPin function
async function hashPin(pin, orgCode) {
  const data = new TextEncoder().encode(pin + ':' + orgCode)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// We need admin access to update users — sign in as admin first
async function getAdminToken() {
  const res = await fetch(`${API}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://skids-ops.pages.dev' },
    body: JSON.stringify({ email: 'satish@skids.health', password: 'Skids@2026' }),
  })
  const data = await res.json()
  return data.token
}

async function main() {
  console.log(`\n🔐 Setting PINs for ${pinAssignments.length} users on ${API}\n`)

  const adminToken = await getAdminToken()
  if (!adminToken) {
    console.error('Failed to get admin token')
    process.exit(1)
  }
  console.log('  ✅ Admin authenticated\n')

  let success = 0, failed = 0

  for (const { email, pin } of pinAssignments) {
    await new Promise(r => setTimeout(r, 500))
    const pinHash = await hashPin(pin, ORG_CODE)

    try {
      // Use admin API to set PIN hash on user
      const res = await fetch(`${API}/api/admin/set-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ email, pinHash }),
      })

      if (res.ok) {
        console.log(`  ✅ ${email.padEnd(28)} PIN: ${pin}`)
        success++
      } else {
        const err = await res.text()
        console.log(`  ❌ ${email.padEnd(28)} ${err}`)
        failed++
      }
    } catch (err) {
      console.log(`  ❌ ${email.padEnd(28)} ${err.message}`)
      failed++
    }
  }

  console.log(`\n📊 Results: ${success} set, ${failed} failed\n`)
}

main()
