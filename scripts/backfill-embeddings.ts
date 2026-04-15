/**
 * Resumable backfill of observation embeddings.
 * Calls POST /api/admin/embed-batch in a loop, 100/min (default), until done.
 *
 * Usage:
 *   API_BASE=https://skids-api.example.workers.dev \
 *   ADMIN_TOKEN=<Better-Auth admin session or API key> \
 *   pnpm tsx scripts/backfill-embeddings.ts
 *
 * Optional env:
 *   BATCH_SIZE=100           (default 100)
 *   SLEEP_MS=60000           (default 60000 — 1 batch/min)
 */

async function main() {
  const API_BASE = process.env.API_BASE
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN
  if (\!API_BASE || \!ADMIN_TOKEN) {
    console.error('Set API_BASE and ADMIN_TOKEN env vars.')
    process.exit(1)
  }
  const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 100)
  const SLEEP_MS = Number(process.env.SLEEP_MS ?? 60_000)

  let totalEmbedded = 0
  let totalErrors = 0
  let batch = 0

  while (true) {
    batch++
    const res = await fetch(`${API_BASE}/api/admin/embed-batch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify({ batchSize: BATCH_SIZE }),
    })
    if (\!res.ok) {
      console.error(`[backfill] batch ${batch} HTTP ${res.status}:`, await res.text())
      await sleep(SLEEP_MS)
      continue
    }
    const json = (await res.json()) as {
      done: boolean
      processed: number
      embedded: number
      unchanged: number
      errors: number
      remaining: number
    }
    totalEmbedded += json.embedded
    totalErrors += json.errors
    console.log(
      `[backfill] batch ${batch}: processed ${json.processed} ` +
        `(embedded ${json.embedded}, unchanged ${json.unchanged}, errors ${json.errors}) ` +
        `— remaining ${json.remaining}`
    )
    if (json.done || json.processed === 0) {
      console.log(
        `[backfill] DONE — totalEmbedded=${totalEmbedded} totalErrors=${totalErrors} batches=${batch}`
      )
      return
    }
    await sleep(SLEEP_MS)
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
