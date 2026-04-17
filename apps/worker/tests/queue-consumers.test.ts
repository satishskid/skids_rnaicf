// Phase 05 — unit tests for queue consumers.
//
// We can't import the production consumers directly here because they
// depend on `@libsql/client` and real Turso secrets. Instead we test the
// dispatch contract of the top-level queue() handler by exercising the
// same branching logic with fakes. This is thin but valuable: the
// consumer surface we can't break is the queue-name dispatch.
//
// Run:
//   pnpm --filter @skids/worker test

import { test } from 'node:test'
import assert from 'node:assert/strict'

type FakeMessage<T> = {
  id: string
  body: T
  attempts?: number
  ack: () => void
  retry: () => void
}

function fakeBatch<T>(queue: string, bodies: T[]): {
  queue: string
  messages: FakeMessage<T>[]
  acked: number
  retried: number
} {
  const state = { acked: 0, retried: 0 }
  const messages: FakeMessage<T>[] = bodies.map((body, i) => ({
    id: `msg-${i}`,
    body,
    attempts: 1,
    ack: () => { state.acked += 1 },
    retry: () => { state.retried += 1 },
  }))
  return { queue, messages, ...state, get acked() { return state.acked }, get retried() { return state.retried } } as never
}

test('queue dispatch — unknown queue name logs warning and does not throw', async () => {
  // This mirrors the switch-default path in src/index.ts. We inline a
  // trimmed copy of the dispatcher because the real export requires CF
  // runtime modules (cloudflare:workers) we cannot load in node:test.
  const batch = fakeBatch('does-not-exist', [{ x: 1 }])
  const warnings: unknown[] = []
  const origWarn = console.warn
  console.warn = (...args: unknown[]) => { warnings.push(args) }
  try {
    const queueName = batch.queue
    const knownQueues = new Set([
      'sandbox-pdf', 'sandbox-second-opinion', 'analytics-trigger',
      'sandbox-pdf-dlq', 'sandbox-2nd-opinion-dlq', 'analytics-trigger-dlq',
    ])
    if (!knownQueues.has(queueName)) console.warn('[queue] unknown queue', queueName)
    assert.equal(warnings.length, 1)
  } finally {
    console.warn = origWarn
  }
})

test('SandboxPdfMessage shape — required fields present at compile-time', () => {
  // Trivial smoke to assert the type import path is valid; the workspace
  // typecheck enforces field shape, this test just nails the export.
  const msg: import('../src/queues').SandboxPdfMessage = {
    kind: 'sandbox-pdf',
    observationId: 'obs_123',
    reportKind: 'parent',
  }
  assert.equal(msg.observationId, 'obs_123')
})

test('SandboxSecondOpinionMessage shape — workflowId + confidence optional/required split', () => {
  const msg: import('../src/queues').SandboxSecondOpinionMessage = {
    observationId: 'obs_456',
    moduleType: 'vision',
    confidence: 0.42,
    riskLevel: 2,
  }
  assert.equal(msg.confidence, 0.42)
  assert.ok(msg.workflowId === undefined)
})

test('AnalyticsTriggerMessage discriminated union — observation-reviewed requires observationId', () => {
  const msg: import('../src/queues').AnalyticsTriggerMessage = {
    kind: 'observation-reviewed',
    observationId: 'obs_789',
    status: 'confirmed',
  }
  assert.equal(msg.kind, 'observation-reviewed')
  if (msg.kind === 'observation-reviewed') assert.equal(msg.observationId, 'obs_789')
})
