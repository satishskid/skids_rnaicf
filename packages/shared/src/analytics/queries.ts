/**
 * Allow-list of Phase 04 canonical queries.
 *
 * The raw SQL lives in `queries.sql`. This module is the TS-level
 * contract: it enumerates the query ids, their parameter schemas, and
 * their expected result shapes. The analytics-worker consumes this.
 *
 * Adding a new query = adding a new entry here + appending SQL to
 * queries.sql + a test. Nothing else should ever execute arbitrary SQL.
 */

export type QueryParamType = 'string' | 'integer' | 'number' | 'boolean' | 'optional-string'

export interface QueryParam {
  name: string
  type: QueryParamType
  /** Default value used when param is absent. `undefined` = required. */
  default?: string | number | boolean | null
  description: string
}

export interface QuerySpec {
  id: string
  title: string
  description: string
  params: QueryParam[]
  /** Ordered list of columns returned. */
  columns: string[]
}

export const QUERIES: Record<string, QuerySpec> = {
  Q1: {
    id: 'Q1',
    title: 'Chip-vs-AI agreement heatmap',
    description:
      'Agreement ratio between clinician chip and cloud AI, grouped by module × age band. Feeds calibration tile.',
    params: [
      {
        name: 'campaign_code',
        type: 'optional-string',
        default: null,
        description: 'Campaign filter; null or absent = all campaigns.',
      },
      {
        name: 'days_back',
        type: 'integer',
        default: 30,
        description: 'Rolling window size in days.',
      },
    ],
    columns: ['module_type', 'age_months_band', 'total', 'disagreements', 'agreement_ratio'],
  },
  Q2: {
    id: 'Q2',
    title: 'Daily AI spend by provider × module',
    description:
      'Per-day aggregate of AI calls + token usage + USD cost, grouped by provider and module. Feeds the cost dashboard.',
    params: [
      {
        name: 'days_back',
        type: 'integer',
        default: 7,
        description: 'Rolling window size in days.',
      },
    ],
    columns: [
      'day',
      'provider',
      'module_type',
      'calls',
      'input_tokens',
      'output_tokens',
      'cost_usd_sum',
      'avg_latency_ms',
      'cached_hits',
    ],
  },
  Q3: {
    id: 'Q3',
    title: 'Red-flag prevalence by campaign × age band × gender',
    description:
      'Observation risk_level >= 2 prevalence, sliced by demographics. Powers PopulationHealth prevalence tile.',
    params: [
      {
        name: 'campaign_code',
        type: 'optional-string',
        default: null,
        description: 'Campaign filter; null or absent = all campaigns.',
      },
    ],
    columns: [
      'campaign_code',
      'module_type',
      'age_months_band',
      'gender',
      'total',
      'red_flags',
      'red_flag_rate',
    ],
  },
  Q4: {
    id: 'Q4',
    title: 'Screener throughput + P95 session time',
    description:
      'Per-day screener productivity + session latency distribution. Ops dashboard.',
    params: [
      {
        name: 'campaign_code',
        type: 'optional-string',
        default: null,
        description: 'Campaign filter; null or absent = all campaigns.',
      },
      {
        name: 'days_back',
        type: 'integer',
        default: 7,
        description: 'Rolling window size in days.',
      },
    ],
    columns: [
      'day',
      'campaign_code',
      'screened_by',
      'sessions',
      'total_obs',
      'avg_session_seconds',
      'p95_session_seconds',
      'obs_per_minute',
    ],
  },
  Q5: {
    id: 'Q5',
    title: 'Time-to-doctor-review distribution',
    description: 'Latency from observation capture to doctor review decision. SLA.',
    params: [
      {
        name: 'days_back',
        type: 'integer',
        default: 30,
        description: 'Rolling window size in days.',
      },
    ],
    columns: [
      'reviewed_day',
      'decision',
      'reviews',
      'avg_minutes',
      'p50_minutes',
      'p95_minutes',
      'p99_minutes',
    ],
  },
}

export type QueryId = keyof typeof QUERIES

export function isQueryId(x: string): x is QueryId {
  return Object.prototype.hasOwnProperty.call(QUERIES, x)
}

/**
 * Validate + coerce user-supplied params against a query's schema.
 * Throws on missing-required or type-mismatch.
 */
export function validateQueryParams(
  queryId: QueryId,
  raw: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> {
  const spec = QUERIES[queryId]
  const out: Record<string, string | number | boolean | null> = {}
  for (const p of spec.params) {
    const present = raw !== undefined && Object.prototype.hasOwnProperty.call(raw, p.name)
    if (!present) {
      if (p.default === undefined) {
        throw new Error(`Missing required param: ${p.name}`)
      }
      out[p.name] = p.default ?? null
      continue
    }
    const v = raw![p.name]
    switch (p.type) {
      case 'string':
        if (typeof v !== 'string') throw new Error(`Param ${p.name} must be string`)
        out[p.name] = v
        break
      case 'optional-string':
        if (v === null || v === undefined) out[p.name] = null
        else if (typeof v === 'string') out[p.name] = v
        else throw new Error(`Param ${p.name} must be string or null`)
        break
      case 'integer': {
        const n = typeof v === 'string' ? Number(v) : v
        if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) {
          throw new Error(`Param ${p.name} must be integer`)
        }
        out[p.name] = n
        break
      }
      case 'number': {
        const n = typeof v === 'string' ? Number(v) : v
        if (typeof n !== 'number' || !Number.isFinite(n)) {
          throw new Error(`Param ${p.name} must be number`)
        }
        out[p.name] = n
        break
      }
      case 'boolean':
        if (typeof v !== 'boolean') throw new Error(`Param ${p.name} must be boolean`)
        out[p.name] = v
        break
    }
  }
  return out
}
