# Decision — Web analytics: fix legacy types now, defer DuckDB (Phase 04)

**Date:** 2026-04-15
**Status:** Decided. Implemented in PR #7 (`0d8e780`).
**Authors:** claude-code, satishskid
**Supersedes:** — (new)
**Related:** `specs/04-duckdb-analytics.md`, `specs/08-motherduck-research.md`, PR #6 (worker typecheck cleanup), PR #7 (this decision)

---

## Context

After PR #6 (mechanical worker typecheck cleanup), `pnpm --filter @skids/web typecheck` surfaced ~97 pre-existing errors that had been masked by an earlier parse error in `readiness-check.tsx`. About 35 of those clustered in the analytics surface:

- `apps/web/src/components/analytics/` (8 components)
- `packages/shared/src/population-analytics.ts` (550 lines, ported from V2)
- `packages/shared/src/cohort-analytics.ts`

The root cause: the **web consumers had been written against the shape a DuckDB `GROUP BY` / `ROLLUP` query would emit** (flat, SQL-standard field names, explicit risk counts, scalar pivots) — but the V2-ported shared types lagged behind with an older shape (nested objects, different field names, missing risk breakdowns).

Phase 04 of the master plan introduces a DuckDB analytics worker: nightly Turso → Parquet (R2) pipeline + `/api/analytics/query` route consumed by a server-side DuckDB. That phase is the natural home for population-scale aggregation; the current TypeScript surface is an interim client-side implementation.

The question: **fix the legacy TS surface, or wait for Phase 04 to replace it?**

---

## Options considered

| Path | Effort | Typecheck clean | Scalable | Risk |
|---|---|---|---|---|
| A. DuckDB-first (build Phase 04, skip legacy fixes) | 8–10 days | ✓ (after Phase 04) | ✓✓ | Medium — Phase 04 blockers (Parquet, R2, DuckDB schema) could stall web green |
| B. Fix legacy types only | 4–6 hrs | ✓ | ✗ (client-side still O(N)) | Low |
| **C. Hybrid — fix legacy toward DuckDB shape, defer Phase 04** | **2–3 hrs** | **✓** | **✓ (planned)** | **Low** |

---

## Decision

**Path C.** Fix the legacy TypeScript analytics surface *directionally aligned with Phase 04's DuckDB schema*, so the fix doesn't invert again when the server-side aggregator lands.

Rationale:
1. 35 consistent type errors were a single signal — consumers already matched the target shape. Flipping consumers to the old shared types would double the churn.
2. Path A assumes Phase 04 is the critical path; it isn't. Phase 02a (on-device Liquid AI) and Phase 03 (sandbox PDFs) are higher priority, and `auth.ts` typecheck errors are blocking a fully green preflight.
3. Path B would clear the errors but leave the aggregator internals ad-hoc. By aligning field names to SQL convention (`count`, `total`, `group`, `percentage`, `riskBreakdown`, `PIVOT`-style scalars), we avoid a second round of type churn when Phase 04 ships.
4. Deprecation tags (`@deprecated alias of …`) retain backward-compat for the V2 aggregator call sites without blocking the forward path.

---

## What shipped (PR #7)

Field-level changes in `packages/shared/src/`:

| Target | Action | Why this direction |
|---|---|---|
| `GenderBucket.riskBreakdown` | **ADD** `{noRisk, possibleRisk, highRisk}` | DuckDB: `SELECT gender, risk_level, COUNT(*) GROUP BY ...` pivoted to three counters. Consumer already reads it. |
| `AgeGroupBucket.group` + `.percentage` | **ADD** string + number | DuckDB: `age_bucket()` emits label + `pct_of_total` directly. |
| `ConditionAggregate.count` + `conditionName` | **ADD as SQL-standard aliases** alongside `totalCount` / `name` | `COUNT(*) AS count` is SQL idiom; `totalCount` was a V2 naming convention. |
| `SubCohort.riskBreakdown` | **ADD as alias of `riskDistribution`** | Matches `CohortAnalytics.riskBreakdown`; sub-cohorts are a `GROUP BY` variant of the main cohort query. |
| `CrossTab` scalar pivots (`.male`, `.female`, `.byAge`) | **ADD** alongside canonical `buckets[]` (long format) | DuckDB `PIVOT` produces scalars per demographic; keep long format as source of truth, derive scalars for UI. |
| `CohortAnalytics.moduleCompletion[i].total` | **ADD as alias of `count`** | `COUNT(DISTINCT child_id) AS total` is SQL idiom. |
| `FOUR_D_CATEGORY_COLORS.*.border` | **ADD** | `CohortAnalyticsPanel.tsx:71` already reads with fallback; now per-category borders render. |
| `buildGeoHierarchy` return shape | **CHANGE** `GeoNode[]` → `GeoNode` (root) | DuckDB `GROUP BY ROLLUP(...)` idiom (single rollup row at top of hierarchy). Consumer was already reading `.children` / `.totalChildren` / `.campaignCodes` on the result. |

No consumer-side changes — all components already read the DuckDB-aligned shapes.

Verification (post-merge):
- `@skids/shared` typecheck: clean
- `@skids/shared` tests: 21/21 pass
- `@skids/web` typecheck: 97 → **62** errors (−35, all analytics cleared)

---

## Phase 04 migration hooks

When Phase 04 lands, these are the natural replacement points:

1. **Delete `@deprecated` aliases** (`ConditionAggregate.name`/`.totalCount`, `SubCohort.riskDistribution`, `CohortAnalytics.moduleCompletion[i].count`). The canonical SQL-standard names stay.
2. **Replace `buildGeoHierarchy` internals** with a DuckDB rollup query; the return shape (`GeoNode` with `.children`) stays identical, so consumers don't move.
3. **Replace `computeDemographicBreakdown`** with a server call that returns `{ ageGroups, genderSplit, conditionByAge, conditionByGender }` in the same shape we already emit; DuckDB `PIVOT` populates the scalar pivots directly.
4. **Replace `computePrevalenceReport`** with `/api/analytics/query?q=prevalence&campaign=...` returning the same `PrevalenceReport` shape. SQL already matches the field names.
5. **Retire `population-analytics.ts` / `cohort-analytics.ts` aggregators** once the analytics-worker route covers their callers. Types stay in `@skids/shared` as the DTO surface.

The types are the contract. Swap the computation; keep the contract stable.

---

## What was NOT done

- `auth.ts` typecheck errors (5 × TS2769) — carved out for `fix/worker-auth-typecheck`.
- Remaining 62 web errors after PR #7 — tracked as `fix/web-typecheck` (ParentPortal, ParentReport, AuthorityDashboard, sync libs, case-only filename drift, assorted TS2339/TS2322 scattered through pages).
- Phase 04 itself — spec exists (`specs/04-duckdb-analytics.md`), zero code; tracked as a Parked backlog item in `specs/STATUS.md`.

---

## Appendix A — Original audit (read-only, 2026-04-15)

### Legacy surface — components

| File | Purpose | API Routes | Handler Status | TS Errors |
|---|---|---|---|---|
| `ExecutiveSummary.tsx` | KPI cards + top conditions grid | none (pure) | N/A | 0 |
| `CohortAnalyticsPanel.tsx` | Risk distribution, module completion, 4D category breakdown | none (pure) | N/A | 4 |
| `DemographicBreakdown.tsx` | Gender + age group bars, cross-tabs | none (pure) | N/A | 14 |
| `TemporalTrends.tsx` | Time-series bar chart, date range picker | none (pure) | N/A | 0 |
| `GeographicDrillDown.tsx` | Hierarchical drill-down country → school | none (pure) | N/A | 5 |
| `CampaignMap.tsx` | Leaflet map with school pins | none (pure) | N/A | 0 |
| `PrevalenceReport.tsx` | Condition detail table, sortable, CSV export | none (shared utils) | N/A | 0 |
| `SubcohortComparison.tsx` | Side-by-side sub-cohort cards | none (pure) | N/A | 8 |

All 8 components are active; zero dead code. Reachable at `/analytics` (Sidebar → Analytics, roles admin/ops_manager/authority). No feature flag.

### DuckDB state at time of decision

- `duckdb-wasm` / `@duckdb/node-api` / `packages/analytics` — **not present in the codebase**.
- `duckdb` CLI mention: `specs/04-duckdb-analytics.md` only.
- `wrangler.toml`: no DuckDB / analytics binding.
- `specs/STATUS.md`: Phase 04 = TODO, zero code.
- **Bottom line: spec only, no code.**

### API routes called by Analytics.tsx

| Route | Handler |
|---|---|
| `/api/campaigns` | `apps/worker/src/routes/campaigns.ts` ✓ |
| `/api/children?campaign={code}` | `apps/worker/src/routes/children.ts` ✓ |
| `/api/observations?campaign={code}` | `apps/worker/src/routes/observations.ts` ✓ |

All general data fetches; aggregation happens client-side via shared TS utilities. No analytics-specific endpoint exists today.

---

## Appendix B — Review history

- Audit written: `outputs/WEB_ANALYTICS_AUDIT.md` (now consolidated into this doc).
- Plan written: `outputs/PR_DRAFT_web-analytics-types.md` (now consolidated into this doc).
- Approved in chat, 2026-04-15.
- Implemented: PR #7 — `0d8e780 fix(shared): align analytics types with DuckDB-natural schema (#7)`.
