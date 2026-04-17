// Phase 05 — typed queue producer helpers.
//
// Thin wrappers around the three Cloudflare Queue bindings declared in
// wrangler.toml. Keeping the shapes centralised means every producer and
// consumer imports the same types, and upgrading a payload shape is a
// compile-time diff.

export type SandboxPdfMessage = {
  kind: 'sandbox-pdf'
  observationId: string
  reportKind: 'parent' | 'clinician' | 'sanction'
  locale?: string
  issuedAt?: string
}

export type SandboxSecondOpinionMessage = {
  kind?: 'sandbox-second-opinion'
  observationId: string
  workflowId?: string
  moduleType: string
  confidence: number
  riskLevel: number
  requestedBy?: string
}

export type AnalyticsTriggerMessage =
  | { kind: 'observation-reviewed'; observationId: string; workflowId?: string; status: string }
  | { kind: 'canonical-query'; queryId: string; params?: Record<string, unknown> }
  | { kind: 'manual-refresh'; reason?: string }

export async function enqueueSandboxPdf(
  q: Queue<SandboxPdfMessage>,
  msg: SandboxPdfMessage
): Promise<void> {
  await q.send(msg)
}

export async function enqueueSecondOpinion(
  q: Queue<SandboxSecondOpinionMessage>,
  msg: SandboxSecondOpinionMessage
): Promise<void> {
  await q.send({ kind: 'sandbox-second-opinion', ...msg })
}

export async function enqueueAnalyticsTrigger(
  q: Queue<AnalyticsTriggerMessage>,
  msg: AnalyticsTriggerMessage
): Promise<void> {
  await q.send(msg)
}
