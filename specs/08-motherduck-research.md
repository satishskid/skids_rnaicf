# Phase 8 — MotherDuck per-study research shares

**Goal**: Let external researchers query de-identified, consent-gated slices of SKIDS data via MotherDuck, with row-level data only when IRB + consent allow it. Default path is aggregate-only.

**Prerequisites**: Phase 4 (DuckDB + Parquet layer) complete. Phase 0 residency doc + consents system required.

**Effort**: 1.5 days.

---

## Read first

- `apps/worker/src/routes/studies.ts` — REDCap-inspired study model
- `apps/worker/src/routes/consents.ts` — consent storage + lookup
- `packages/shared/src/export-utils.ts`
- Phase 4 outputs: `apps/analytics-worker/src/publishable.ts`, `queries.sql`

---

## Decisions

- **Posture**: MotherDuck is US-hosted. By default, ONLY aggregate exports cross the border. Row-level PHI never goes to MotherDuck.
- **Two share types**:
  1. **Aggregate share** — publishable_* views aggregated to population level. Default open to all research collaborators.
  2. **Study share** — a specific slice for a specific IRB-approved study, gated by consent rows with the matching study code. Still de-identified (no names, DOBs → age bands, no addresses below district).
- **Share mechanism**: MotherDuck SHARE model. A single MotherDuck workspace `skids-research`, per-study databases `study_<code>`.
- **Refresh**: weekly for aggregates, event-driven for study shares (when new consents flip or new observations land in consented cohort)
- **Audit**: every MotherDuck sync is logged to `audit_log` + `analytics_runs`.

---

## Deliverables

1. `apps/analytics-worker/src/motherduck.ts` — sync module
2. `apps/analytics-worker/src/study-slicer.ts` — given a study code, produce a Parquet set for that study's consented cohort
3. New worker route `POST /api/studies/:code/share` — admin-only, starts a one-shot sync
4. MotherDuck workspace + DB setup (infra, documented in RUNBOOK)
5. Migration `0008_share_ledger.sql` — tracks share version per study
6. Consent-check helper in `packages/shared/src/consent-check.ts` — single source of truth
7. De-identification pipeline in `apps/analytics-worker/src/deident.ts`
8. `docs/RESEARCH_SHARES.md` — researcher-facing doc (how to connect, what's in each share, how to request new cuts)
9. Tests
10. Update `docs/RUNBOOK.md`, `docs/RESIDENCY.md`

---

## Step-by-step

### 1. MotherDuck setup (infra)

```bash
# On admin laptop
pip install duckdb
# Sign in, create workspace 'skids-research'
# Create service-account token, save as MOTHERDUCK_TOKEN secret
wrangler secret put MOTHERDUCK_TOKEN --name skids-analytics
```

Create two initial DBs via MotherDuck UI:
- `skids_aggregate` — for aggregate share
- `skids_study_template` — cloned per new study

### 2. study-slicer.ts

Given `studyCode`:
1. `SELECT child_id FROM consents WHERE study_code = ? AND status = 'granted' AND revoked_at IS NULL`
2. Filter `publishable_observations` Parquet in DuckDB to that cohort
3. Write a study-specific Parquet set to `r2://skids-analytics/study-shares/<study_code>/dt=<today>/`
4. Apply de-identification pass:
   - Drop any free-text fields that could contain names
   - Age in months → age band (0–12, 13–36, 37–60, 61–120, 121–216)
   - Location: keep district, drop everything finer
   - Generate deterministic pseudonyms for child_id (HMAC with a per-study salt)
5. Log `analytics_runs` row with status, count, bytes

### 3. motherduck.ts

```typescript
// Using duckdb-wasm or duckdb-node via service-binding to analytics-worker host
// (analytics-worker runs Node-compatible flags, so a lightweight DuckDB client works)

export async function syncToMotherDuck(studyCode: string, env: Env) {
  const ddb = await duckdb.open() // in-proc
  await ddb.query(`ATTACH 'md:?MOTHERDUCK_TOKEN=${env.MOTHERDUCK_TOKEN}' AS md;`)
  await ddb.query(`
    CREATE OR REPLACE TABLE md.study_${studyCode}.observations AS
    SELECT * FROM read_parquet('r2://skids-analytics/study-shares/${studyCode}/**/*.parquet', hive_partitioning=1);
  `)
  // ...repeat for other entities relevant to the study
}
```

### 4. Consent-check helper

`packages/shared/src/consent-check.ts`:

```typescript
export type ConsentScope = {
  studyCode: string
  childId: string
}
export function isConsented(consents: Consent[], scope: ConsentScope): boolean {
  return consents.some(c =>
    c.child_id === scope.childId &&
    c.study_code === scope.studyCode &&
    c.status === 'granted' &&
    !c.revoked_at
  )
}
```

Used in study-slicer BEFORE any row is included. Also reused in parent-portal flows.

### 5. De-identification pipeline

`apps/analytics-worker/src/deident.ts`:

```typescript
export const DEIDENT_RULES = {
  drop: ['name', 'parent_phone', 'address', 'admission_number'],
  transform: {
    dob: (d: string, today: string) => ageBandMonths(d, today),
    lat: () => null,
    lng: () => null,
    pincode: (p: string) => null,
    child_id: (id: string, salt: string) => hmac(id, salt).slice(0, 12),
  },
}
```

Emit a `deident_manifest.json` next to every share Parquet set — states which rules applied and the salt version.

### 6. Migration

`0008_share_ledger.sql`:
```sql
CREATE TABLE IF NOT EXISTS research_shares (
  id TEXT PRIMARY KEY,
  study_code TEXT NOT NULL,
  share_type TEXT NOT NULL CHECK (share_type IN ('aggregate','study')),
  version INTEGER NOT NULL,
  row_counts_json TEXT,
  r2_prefix TEXT NOT NULL,
  motherduck_db TEXT,
  initiated_by TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_share_study ON research_shares(study_code);
```

### 7. Share route

`POST /api/studies/:code/share`:
- AuthZ: must be admin OR study PI
- Validates study exists and has IRB approval flag in `studies.metadata`
- Calls analytics-worker service binding `ANALYTICS_SVC.fetch('/share', {studyCode})`
- Returns `{ shareId, status: 'queued' }`
- Audit log entry

`GET /api/studies/:code/shares` — list past shares.

### 8. Researcher doc `docs/RESEARCH_SHARES.md`

Cover:
- What researchers see (schema of aggregate share, schema of study share)
- How to request access (email, IRB attach, signed DUA)
- How to connect: MotherDuck CLI + Python example
- What's NOT in the share (names, DOBs, addresses, raw media, raw audio)
- Rotation policy for pseudonym salts
- How to report a privacy concern

### 9. Tests

- Slicer with 3 studies, overlapping cohorts: each study share contains ONLY consented children for that study
- De-ident pipeline: run golden sample, assert no dropped field appears in output; assert age band correct
- Revoked consent: a child whose consent is revoked is absent from the next share refresh
- MotherDuck sync (integration, optional if MOTHERDUCK_TOKEN set in CI): a table appears in the study DB

### 10. Runbook

- How to rotate a study salt (full re-share required)
- How to respond to a "right to be forgotten" request (consent revocation → next refresh removes that child's pseudonym; deletes aren't retroactive for past researcher pulls — document this explicitly in the DUA)
- How to add a new study to the share program
- Cost: MotherDuck free-tier is enough for aggregates; larger studies need paid tier — cost tracked in `research_shares`

---

## Acceptance criteria

- [ ] Aggregate share appears in MotherDuck `skids_aggregate` DB, queryable by service-account credentials
- [ ] Study share only contains consented children (verified with a unit test using 3 studies)
- [ ] De-identification verified: grep-based and column-based audit on 3 sample shares shows zero PHI
- [ ] Revoking a consent and re-syncing removes that child from the study share
- [ ] `research_shares` table tracks every sync with row counts
- [ ] `docs/RESEARCH_SHARES.md` reviewed by legal/clinical stakeholder
- [ ] `docs/RESIDENCY.md` updated to reflect MotherDuck (US) + explicit aggregate-only policy
- [ ] Tests green

## Rollback

Disable the share route (admin lock). Delete MotherDuck DBs if needed. R2 share prefixes can stay or be deleted per DUA terms.

## Out of scope

- Researcher UI for querying (they use MotherDuck's own UI / CLI)
- Long-term pseudonym stability across salt rotations (explicitly a trade-off; salt rotation = new pseudonyms, pull-based studies continue to work)
- Automated IRB workflow (manual PDF attach + admin flip for now)
