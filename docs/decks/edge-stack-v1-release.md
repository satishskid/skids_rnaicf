---
marp: true
theme: default
size: 16:9
paginate: true
header: 'SKIDS Edge-Stack v1 · 2026-04-17'
title: SKIDS Edge-Stack v1 Release
author: SKIDS Platform
style: |
  /* ── Palette ─────────────────────────────────────────────── */
  :root {
    --navy: #065A82;
    --navy-dark: #0A2540;
    --teal: #1C7293;
    --midnight: #21295C;
    --accent: #14B8A6;
    --green: #10B981;
    --amber: #F59E0B;
    --rose: #EF4444;
    --cream: #F8FAFC;
    --slate-900: #0F172A;
    --slate-700: #334155;
    --slate-500: #64748B;
    --slate-300: #CBD5E1;
    --slate-100: #F1F5F9;
  }

  /* ── Base ────────────────────────────────────────────────── */
  section {
    font-family: 'Calibri', 'Helvetica Neue', sans-serif;
    background: var(--cream);
    color: var(--slate-900);
    padding: 0.6em 1.0em 1.1em;
  }
  h1, h2, h3 {
    font-family: 'Georgia', serif;
    color: var(--slate-900);
    margin-top: 0;
  }
  h1 { font-size: 2.0em; line-height: 1.15; }
  h2 {
    font-size: 1.45em;
    background: var(--navy);
    color: white;
    padding: 0.35em 0.7em;
    margin: -0.6em -1.0em 0.7em;
    border-left: 0.25em solid var(--accent);
  }
  h3 { font-size: 1.1em; color: var(--teal); }
  strong { color: var(--slate-900); }
  strong.ok, td strong.ok { color: var(--green) !important; }
  strong.warn, td strong.warn { color: var(--amber) !important; }
  strong.err, td strong.err { color: var(--rose) !important; }
  em { color: var(--slate-700); }
  a { color: var(--teal); text-decoration: none; border-bottom: 1px dotted var(--teal); }
  header {
    font-size: 0.55em;
    color: var(--slate-500);
    padding-top: 0.4em;
  }
  section::after {
    color: var(--slate-500);
    font-size: 0.55em;
  }

  /* ── Cover + closing (dark) ──────────────────────────────── */
  section.cover, section.closing {
    background: var(--navy-dark);
    color: white;
    padding: 1em 1.2em;
    border-left: 0.5em solid var(--accent);
  }
  section.cover h1, section.closing h1 {
    color: white;
    font-size: 2.4em;
    margin-bottom: 0.15em;
  }
  section.cover h2, section.closing h2 {
    background: transparent;
    color: var(--accent);
    padding: 0;
    margin: 0 0 0.6em 0;
    border-left: none;
    font-size: 1.4em;
  }
  section.cover em, section.closing em { color: var(--slate-300); }
  section.cover header, section.closing header { display: none; }
  section.cover::after, section.closing::after { color: var(--slate-300); }

  /* ── Icon-row layout (executive summary) ─────────────────── */
  .points {
    display: flex;
    flex-direction: column;
    gap: 0.55em;
  }
  .point {
    display: grid;
    grid-template-columns: 2.8em 1fr;
    gap: 0.8em;
    align-items: start;
  }
  .point .dot {
    width: 2.4em;
    height: 2.4em;
    border-radius: 50%;
    background: var(--slate-100);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2em;
  }
  .point .body .t { font-weight: bold; font-size: 1.05em; color: var(--slate-900); }
  .point .body .d { font-size: 0.9em; color: var(--slate-700); margin-top: 0.15em; }

  /* ── Tables ──────────────────────────────────────────────── */
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.78em;
  }
  table th {
    background: var(--teal);
    color: white;
    padding: 0.45em 0.7em;
    text-align: left;
    font-family: 'Calibri', sans-serif;
  }
  table td {
    padding: 0.45em 0.7em;
    background: white;
    border: 1px solid var(--slate-300);
    color: var(--slate-700);
  }
  table td strong.ok { color: var(--green); }
  table td strong.warn { color: var(--amber); }
  table td strong.err { color: var(--rose); }

  /* ── Feature-slide accent ─────────────────────────────────── */
  /* Uses a thick left border (part of CSS box model) so content
     never overlaps — padding-left starts AFTER the border. */
  section.feature {
    border-left: 0.4em solid var(--teal);
    padding-top: 0.9em;
    padding-left: 1.2em;
  }
  section.feature header { display: none; }
  section.feature h1 {
    margin-top: 0;
    margin-bottom: 0.15em;
    font-size: 1.55em;
  }
  section.feature .tagline {
    color: var(--teal);
    font-style: italic;
    margin: 0 0 0.8em 0;
    font-size: 0.85em;
  }

  /* ── Two-column grid ─────────────────────────────────────── */
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8em;
  }
  .cols.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
  .card {
    background: white;
    border: 1px solid var(--slate-300);
    border-left: 0.25em solid var(--accent);
    border-radius: 0.25em;
    padding: 0.7em 0.85em;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .card.navy { border-left-color: var(--navy); }
  .card.teal { border-left-color: var(--teal); }
  .card.rose { border-left-color: var(--rose); }
  .card.amber { border-left-color: var(--amber); }
  .card.green { border-left-color: var(--green); }
  .card .label { font-size: 0.65em; text-transform: uppercase; letter-spacing: 0.08em; color: var(--slate-500); font-weight: bold; }
  .card .value {
    font-family: Georgia, serif;
    font-size: 2.0em;
    font-weight: bold;
    line-height: 1;
    margin: 0.1em 0 0.15em;
  }
  .card .value .u { font-size: 0.5em; color: var(--slate-500); font-weight: normal; font-family: Calibri, sans-serif; }
  .card .d { font-size: 0.78em; color: var(--slate-700); margin-top: 0.25em; }
  .card h3 { margin: 0 0 0.3em 0; font-size: 0.95em; color: var(--slate-900); }
  .card.navy .value { color: var(--navy); }
  .card.teal .value { color: var(--teal); }
  .card.rose .value { color: var(--rose); }
  .card.amber .value { color: var(--amber); }
  .card.green .value { color: var(--green); }
  .card ul { margin: 0.1em 0 0 0.9em; padding: 0; }
  .card li { font-size: 0.8em; color: var(--slate-700); margin-bottom: 0.1em; }

  /* Q-tile (population health) */
  .tiles {
    display: grid;
    gap: 0.55em;
    grid-template-columns: 1fr 1fr 1fr;
  }
  .tiles.row2 { grid-template-columns: 1fr 1fr; margin-top: 0.55em; }
  .tile {
    background: white;
    border: 1px solid var(--slate-300);
    border-left: 0.22em solid var(--teal);
    padding: 0.55em 0.75em;
    border-radius: 0.2em;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .tile.q1 { border-left-color: var(--navy); }
  .tile.q2 { border-left-color: var(--teal); }
  .tile.q3 { border-left-color: var(--rose); }
  .tile.q4 { border-left-color: var(--accent); }
  .tile.q5 { border-left-color: var(--amber); }
  .tile .q { font-family: Georgia, serif; font-weight: bold; font-size: 1.25em; display: inline-block; margin-right: 0.35em; }
  .tile.q1 .q { color: var(--navy); }
  .tile.q2 .q { color: var(--teal); }
  .tile.q3 .q { color: var(--rose); }
  .tile.q4 .q { color: var(--accent); }
  .tile.q5 .q { color: var(--amber); }
  .tile .t { font-weight: bold; color: var(--slate-900); font-size: 0.9em; }
  .tile .u { color: var(--slate-700); font-size: 0.75em; font-style: italic; display: block; margin-top: 0.25em; }

  /* Roadmap rows */
  .road-row {
    display: grid;
    grid-template-columns: 4em 1fr auto;
    gap: 0.5em;
    align-items: center;
    background: white;
    border: 1px solid var(--slate-300);
    border-radius: 0.2em;
    padding: 0.35em 0.7em;
    margin-bottom: 0.25em;
    font-size: 0.85em;
  }
  .road-row .pri {
    background: var(--teal);
    color: white;
    text-align: center;
    padding: 0.4em 0.2em;
    border-radius: 0.15em;
    font-weight: bold;
    font-size: 0.85em;
  }
  .road-row.p0 .pri { background: var(--rose); }
  .road-row.p1 .pri { background: var(--amber); }
  .road-row.p2 .pri { background: var(--teal); }
  .road-row.p3 .pri { background: var(--slate-500); }
  .road-row .t { color: var(--slate-900); font-weight: bold; }
  .road-row .o { color: var(--slate-500); font-size: 0.85em; }
  .road-row .eta { color: var(--slate-700); font-style: italic; font-size: 0.85em; }

  /* Safety + governance grid */
  .safety-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45em;
  }
  .safety-grid .card { display: grid; grid-template-columns: 2em 1fr; gap: 0.5em; align-items: start; padding: 0.5em 0.7em; }
  .safety-grid .card .ic {
    width: 1.8em; height: 1.8em;
    border-radius: 50%;
    background: var(--slate-100);
    display: flex; align-items: center; justify-content: center;
    font-size: 1em;
  }
  .safety-grid .card .ic.dark { background: var(--navy); color: white; }
  .safety-grid .card h3 { margin: 0 0 0.15em 0; font-size: 0.85em; color: var(--slate-900); }
  .safety-grid .card p { margin: 0; font-size: 0.72em; color: var(--slate-700); }

  /* Big closing stats */
  .big-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 0.5em;
    margin: 0.55em 0;
  }
  .big-stats .s {
    background: rgba(28, 114, 147, 0.25);
    border: 1px solid var(--teal);
    padding: 0.5em 0.45em;
    border-radius: 0.25em;
    text-align: center;
  }
  .big-stats .s .v {
    font-family: Georgia, serif;
    font-size: 1.85em;
    font-weight: bold;
    color: var(--accent);
    line-height: 1;
  }
  .big-stats .s .l {
    font-size: 0.65em;
    color: var(--slate-300);
    margin-top: 0.25em;
  }
  section.closing h1 { font-size: 2.0em; margin-bottom: 0.15em; }
  section.closing h2 { font-size: 1.1em; margin-bottom: 0.4em; }
  section.closing ul { font-size: 0.88em; margin: 0.3em 0; padding-left: 1.2em; }
  section.closing ul li { margin-bottom: 0.15em; }
  section.closing p:last-child {
    color: var(--accent);
    font-weight: bold;
    font-style: italic;
    letter-spacing: 0.08em;
    margin-top: 0.5em;
    font-size: 0.82em;
  }

  /* Small meta lines */
  .meta {
    font-size: 0.72em;
    color: var(--slate-500);
    font-style: italic;
    margin-top: 0.6em;
  }

  /* Process pill (5-step flow) */
  .steps {
    display: flex;
    flex-direction: column;
    gap: 0.3em;
  }
  .steps .step {
    display: grid;
    grid-template-columns: 1.9em 1fr;
    gap: 0.55em;
    align-items: center;
  }
  .steps .step .n {
    width: 1.7em; height: 1.7em;
    background: var(--navy);
    color: white;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: bold;
    font-size: 0.8em;
  }
  .steps .step .label { font-weight: bold; font-size: 0.88em; color: var(--slate-900); }
  .steps .step .hint { font-style: italic; font-size: 0.72em; color: var(--slate-500); }

  /* Trigger pill */
  .triggers { display: flex; flex-direction: column; gap: 0.3em; }
  .triggers .t {
    border-left: 0.18em solid var(--accent);
    padding: 0.2em 0.5em;
    font-size: 0.82em;
    color: var(--slate-700);
    background: white;
  }
---

<!-- _class: cover -->
<!-- _paginate: false -->

# SKIDS Edge-Stack

## v1 Release

*Closed-loop clinical decision support for pediatric screening*

<br>
<br>

**Released** · 2026-04-17
Audience: clinical · ops · tech · business

---

## Executive summary

<div class="points">

<div class="point">
<div class="dot">💚</div>
<div class="body">
<div class="t">From capture to decision-support</div>
<div class="d">Five new capabilities turn SKIDS Screen from a data-capture platform into a closed-loop clinical decision-support system.</div>
</div>
</div>

<div class="point">
<div class="dot">🩺</div>
<div class="body">
<div class="t">Doctors gain context, not clicks</div>
<div class="d">Every observation surfaces top-5 relevant clinical evidence snippets + top-5 similar past cases in one expand, in under 500 ms.</div>
</div>
</div>

<div class="point">
<div class="dot">⚙️</div>
<div class="body">
<div class="t">Nothing is lost in transit</div>
<div class="d">Durable workflow records 5 steps per observation; queue DLQs catch every poison message; every AI decision is auditable.</div>
</div>
</div>

<div class="point">
<div class="dot">📊</div>
<div class="body">
<div class="t">Ops + research unblocked</div>
<div class="d">All 5 canonical analytics tiles (Q1–Q5) live; nightly de-identified Parquet layer ready for external researchers.</div>
</div>
</div>

</div>

---

## What shipped — at a glance

| # | Feature | Who benefits | Status |
|---|---|---|---|
| 1 | Durable screening workflow — 5-step trace per observation | Nurses · Ops | <strong class="ok">Live</strong> |
| 2 | Sandbox second opinion — budget-capped ONNX re-analysis | Doctors · QA | <strong class="warn">DB + UI live; container deferred</strong> |
| 3 | Evidence RAG + similar cases — 147 chunks, &lt;500 ms P95 | Doctors | <strong class="ok">Live</strong> |
| 4 | Population health Q1–Q5 + de-identified Parquet | Ops · Leadership · Researchers | <strong class="ok">Live</strong> |
| 5 | On-device Liquid AI — zero cloud egress, OPFS cached | Nurses · Doctors | <strong class="warn">Infra live; weights pending</strong> |

<div class="meta">Live = ready for clinical use today.   Amber = one known unblocker before promotion.</div>

---

<!-- _class: feature -->
<!-- _backgroundColor: '#F8FAFC' -->

# 1 · Durable screening workflow

<div class="tagline">ScreeningObservationWorkflow  ·  Cloudflare Workflows + Queues</div>

<div class="cols">

<div>

### The 5 recorded steps

<div class="steps">
<div class="step"><div class="n">1</div><div><div class="label">persist</div><div class="hint">INSERT OR REPLACE into Turso</div></div></div>
<div class="step"><div class="n">2</div><div><div class="label">quality-gate</div><div class="hint">confidence · risk · routing</div></div></div>
<div class="step"><div class="n">3</div><div><div class="label">embed</div><div class="hint">bge-small-en-v1.5 via Workers AI</div></div></div>
<div class="step"><div class="n">4</div><div><div class="label">enqueue 2nd opinion</div><div class="hint">cond-based fan-out to queue</div></div></div>
<div class="step"><div class="n">5</div><div><div class="label">await-review → notify</div><div class="hint">72h timeout · doctor-review event</div></div></div>
</div>

</div>

<div>

<div class="card green">

### Impact

**<span style="color:#EF4444">Before:</span>** any transient error mid-flow silently lost the observation's downstream work.

**<span style="color:#10B981">After:</span>** every step records to `workflow_events`. Ops can reconstruct any screening's full trajectory.

<br>

*Rollback:* `FEATURE_USE_WORKFLOW=0` → redeploy. Inline path resumes; in-flight workflows still drain.

</div>

</div>

</div>

---

<!-- _class: feature -->

# 2 · Sandbox second opinion

<div class="tagline">Doctor-initiated ONNX re-analysis  ·  budget-capped per session</div>

<div class="cols">

<div>

### Triggers

<div class="triggers">
<div class="t">AI confidence &lt; 0.75</div>
<div class="t">Moderate-risk finding with confidence &lt; 0.9</div>
<div class="t">Any vision / ear / skin / dental observation</div>
<div class="t">Doctor manual click in the inbox</div>
</div>

<br>

### What's deferred

*Only the ONNX Docker image. DB schema, queue infra, UI button, session budget — all live. One container deploy enables inference end-to-end.*

</div>

<div>

<div class="cols">

<div class="card navy">
<div class="value">5</div>
<div class="d">Max second-opinions per session (hard cap)</div>
</div>

<div class="card green">
<div class="value">≥0.80</div>
<div class="d">Target agreement score vs. doctor</div>
</div>

<div class="card teal">
<div class="value">60s</div>
<div class="d">P95 budget for queue → ONNX → DB</div>
</div>

<div class="card">
<div class="value">paired</div>
<div class="d">accuracy_metrics row on every opinion</div>
</div>

</div>

</div>

</div>

---

<!-- _class: feature -->

# 3 · Evidence RAG + similar cases

<div class="tagline">GET /api/reviews/:id/context  ·  evidence + similar cases in one fan-out</div>

<div class="cols cols-3">

<div class="card navy">
<div class="value">147<span class="u"> chunks</span></div>
<div class="d">Cloudflare Vectorize index<br>384-dim cosine</div>
</div>

<div class="card teal">
<div class="value">&lt;500<span class="u"> ms P95</span></div>
<div class="d">Unified /context endpoint<br>evidence + similar in parallel</div>
</div>

<div class="card">
<div class="value">top-5<span class="u"> each</span></div>
<div class="d">Evidence snippets + similar past cases<br>per observation</div>
</div>

</div>

<br>

<div class="cols">

<div class="card navy">

### 📖 What's indexed today

- 52 4D condition descriptions
- 20 M-CHAT items with domain + criticality
- Per-module parent-education intros
- Condition-level parent guidance

</div>

<div class="card teal">

### 🔒 Privacy posture

- Only curated, pre-approved educational content
- 280-char previews in metadata, no full text
- No PHI, no patient-record free text
- Index versioned in `evidence_index_version`

</div>

</div>

---

<!-- _class: feature -->

# 4 · Population health analytics

<div class="tagline">Five canonical tiles live on /population-health  ·  Turso hot path + nightly Parquet</div>

<div class="tiles">

<div class="tile q1">
<span class="q">Q1</span><span class="t">AI ↔ clinician agreement</span>
<span class="u">Catch miscalibration per module × age band early</span>
</div>

<div class="tile q2">
<span class="q">Q2</span><span class="t">AI spend breakdown</span>
<span class="u">Detect cost regressions from a model swap within 7 days</span>
</div>

<div class="tile q3">
<span class="q">Q3</span><span class="t">Red-flag prevalence</span>
<span class="u">Flag unusual campaign × age × gender clusters for follow-up</span>
</div>

</div>

<div class="tiles row2">

<div class="tile q4">
<span class="q">Q4</span><span class="t">Screener throughput</span>
<span class="u">Identify training opportunities or tool friction per nurse</span>
</div>

<div class="tile q5">
<span class="q">Q5</span><span class="t">Time-to-review SLA</span>
<span class="u">P50 / P95 / P99 minutes by decision — SLA monitoring</span>
</div>

</div>

<div class="meta">Analysts can also query the nightly de-identified Parquet directly — no PHI, safe for research.</div>

---

<!-- _class: feature -->

# 5 · On-device Liquid AI — LFM2.5-VL-450M

<div class="tagline">Zero cloud egress  ·  OPFS cached  ·  per-shard SHA-256 verified</div>

<div class="cols">

<div class="card green">

### 🟢 Live in production

- Same-origin shard proxy `/api/models/:id/:version/:shard`
- OPFS cache with per-shard SHA-256 verification
- WebLLM + WebGPU runtime handoff
- HITL outcome audit (suggested/accepted/rejected/edited)
- Pinned manifest — no silent model upgrades

</div>

<div class="card amber">

### 🟡 Pending dev-team

- LFM2.5-VL-450M weight shards not yet uploaded
- `MODEL_MANIFEST` still `PENDING-PIN` placeholder
- Mobile track (React Native runtime) not started
- Est. 2–4 engineering days to complete
- `docs/HANDOVER-LIQUID-AI.md` is self-contained plan

</div>

</div>

---

## Safety & governance — shipped alongside

<div class="safety-grid">

<div class="card">
<div class="ic">📋</div>
<div>
<h3>Audit everywhere</h3>
<p>audit_log captures every write, AI decision, model-shard fetch, queue message, and failure.</p>
</div>
</div>

<div class="card">
<div class="ic dark">🛡️</div>
<div>
<h3>DLQ on every queue</h3>
<p>3 retries → dead letter → audit row + optional Langfuse trace. No poison message is silent.</p>
</div>
</div>

<div class="card">
<div class="ic">📈</div>
<div>
<h3>Budget caps</h3>
<p>session_ai_budget (per-session) + ai_usage (rollup). Q2 tile surfaces this on the dashboard.</p>
</div>
</div>

<div class="card">
<div class="ic">🔀</div>
<div>
<h3>Rollback on every flag</h3>
<p>Every new capability is flag-gated in wrangler.toml. Flip to "0" + redeploy = instant revert.</p>
</div>
</div>

<div class="card">
<div class="ic">🔒</div>
<div>
<h3>PHI residency</h3>
<p>Media stays in R2 APAC. Vectorize holds only curated text. Parent PDFs are HMAC-signed URLs, 30-day TTL.</p>
</div>
</div>

<div class="card">
<div class="ic">✅</div>
<div>
<h3>Every PR verified</h3>
<p>Typecheck + tests + /api/health smoke before merge. No deploy without a clean pipeline.</p>
</div>
</div>

</div>

---

## Metrics to watch post-launch

| Metric | Source | Target |
|---|---|---|
| Observation P95 write latency | AI Gateway · Langfuse | <strong class="ok">&lt; 200 ms</strong> |
| Workflow success rate | `workflow_events` table | <strong class="ok">&gt; 99%</strong> |
| Second-opinion ↔ doctor agreement | `accuracy_metrics.agreement_score` | <strong class="ok">&gt; 0.80 rolling</strong> |
| Evidence search P95 | `/api/evidence/search` Langfuse span | <strong class="ok">&lt; 200 ms</strong> |
| /context unified endpoint P95 | `/api/reviews/:id/context` | <strong class="ok">&lt; 500 ms</strong> |
| DLQ depth per queue | `wrangler queues consumer get` | <strong class="err">always 0   (alarm &gt; 5)</strong> |
| Publishable Parquet freshness | R2 `publishable/dt=…` | <strong class="ok">one partition per day</strong> |

---

## What's next — prioritised

<div class="road-row p0">
<div class="pri">P0</div>
<div><div class="t">Liquid AI weights upload</div><div class="o">Dev team (handover doc ready)</div></div>
<div class="eta">2–4 eng days</div>
</div>

<div class="road-row p1">
<div class="pri">P1</div>
<div><div class="t">Sandbox AI container image</div><div class="o">Ops + platform</div></div>
<div class="eta">After container beta stable</div>
</div>

<div class="road-row p1">
<div class="pri">P1</div>
<div><div class="t">Doctor-inbox 2nd-opinion badge in row header</div><div class="o">Frontend</div></div>
<div class="eta">1 sprint</div>
</div>

<div class="road-row p2">
<div class="pri">P2</div>
<div><div class="t">Parent SMS / WhatsApp delivery adapter</div><div class="o">Integrations</div></div>
<div class="eta">Q2</div>
</div>

<div class="road-row p3">
<div class="pri">P3</div>
<div><div class="t">scripts/duckdb-repl.sh for researchers</div><div class="o">Ops</div></div>
<div class="eta">Nice-to-have</div>
</div>

<div class="meta">Explicitly deferred: DuckDB in-Worker (Phase 08 / MotherDuck). Architectural decision, not a bug.</div>

---

<!-- _class: closing -->
<!-- _paginate: false -->

# How this was built

## One engineering day — surfaced, fixed, documented end-to-end.

<div class="big-stats">
<div class="s"><div class="v">13</div><div class="l">PRs merged today</div></div>
<div class="s"><div class="v">7</div><div class="l">feature PRs (#22–29)</div></div>
<div class="s"><div class="v">6</div><div class="l">fix PRs (#30–36)</div></div>
<div class="s"><div class="v">100%</div><div class="l">auto-squash + verified</div></div>
</div>

- Typecheck + tests before every merge
- `/api/health` + canonical-query smoke after every deploy
- Feature flags on every capability — instant rollback path
- Full blueprint + deferred-items register in `docs/BLUEPRINT.md`

<br>

**Shipped · Auditable · Rollbackable**
