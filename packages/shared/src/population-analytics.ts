/**
 * population-analytics.ts
 *
 * Geographic aggregation engine for authority-level reporting.
 * Enables country -> state -> district -> city -> school drill-downs
 * and side-by-side sub-cohort comparisons.
 *
 * Works with cohort-analytics.ts (single-campaign level)
 * and adds cross-campaign geographic roll-ups.
 *
 * Ported from V2 — adapted to V3 types.
 */

import type {
  Campaign,
  CampaignLocation,
  LocationLevel,
  Child,
  ClinicianReview,
} from './types'
import { normaliseCampaignLocation, getLocationLabel } from './types'
import type { SyncedObservation } from './observation-utils'
import { computePrevalenceReport } from './cohort-analytics'
import type { PrevalenceReport } from './cohort-analytics'
import { toObservation } from './observation-utils'

// ─── Types ──────────────────────────────────────────────────────

/** A campaign with its loaded children + observations */
export interface CampaignDataBundle {
  campaign: Partial<Campaign> & { code: string; name: string; schoolName?: string; createdAt?: string }
  children: Child[]
  observations: SyncedObservation[]
  reviews: Record<string, ClinicianReview>
}

/** A geographic node in the location hierarchy */
export interface GeoNode {
  level: LocationLevel
  label: string
  campaignCodes: string[]
  totalChildren: number
  screenedChildren: number
  topConditions: ConditionAggregate[]
  categoryBreakdown: CategoryAggregate[]
  children: GeoNode[]
  riskDistribution: { noRisk: number; possibleRisk: number; highRisk: number }
  referralRate: number
}

export interface ConditionAggregate {
  conditionId: string
  /** Condition display name. */
  conditionName: string
  /** @deprecated alias of conditionName — kept for existing aggregator call sites. */
  name: string
  icdCode?: string
  category: string
  /** Count of children with this condition present. Aligned with SQL `COUNT(*) AS count`. */
  count: number
  /** @deprecated alias of count — kept for existing aggregator call sites. */
  totalCount: number
  prevalence: number
  severityBreakdown: { mild: number; moderate: number; severe: number }
}

export interface CategoryAggregate {
  category: string
  label: string
  conditionsFound: number
  childrenAffected: number
  prevalence: number
}

/** Sub-cohort comparison result */
export interface SubCohortComparison {
  groupBy: 'gender' | 'age_group' | 'class' | 'location'
  cohorts: SubCohort[]
}

export interface SubCohort {
  label: string
  totalChildren: number
  screenedChildren: number
  completionRate: number
  referralRate: number
  topConditions: ConditionAggregate[]
  /**
   * Risk counts per tier. Named to match the same field on CohortAnalytics;
   * DuckDB GROUP BY variants of the main cohort query emit this shape
   * directly. Kept as `riskDistribution` alias for the existing aggregator.
   */
  riskBreakdown: { noRisk: number; possibleRisk: number; highRisk: number }
  /** @deprecated alias of riskBreakdown — existing aggregator writes this. */
  riskDistribution: { noRisk: number; possibleRisk: number; highRisk: number }
}

/** Demographic breakdown */
export interface DemographicBreakdown {
  ageGroups: AgeGroupBucket[]
  genderSplit: GenderBucket[]
  conditionByAge: CrossTab[]
  conditionByGender: CrossTab[]
}

export interface AgeGroupBucket {
  label: string
  /** Canonical bucket key emitted by SQL age_bucket(): identical to label today. */
  group: string
  minAge: number
  maxAge: number
  count: number
  screenedCount: number
  findingCount: number
  referralCount: number
  /** Share of the total cohort in this bucket (0-100). SQL: `count * 100.0 / total`. */
  percentage: number
}

export interface GenderBucket {
  gender: 'male' | 'female'
  count: number
  screenedCount: number
  findingCount: number
  referralCount: number
  /**
   * Risk counts per tier within this gender. DuckDB shape:
   * `SELECT gender, risk_level, COUNT(*) GROUP BY gender, risk_level`
   * pivoted to three counters.
   */
  riskBreakdown: { noRisk: number; possibleRisk: number; highRisk: number }
}

export interface CrossTab {
  conditionName: string
  conditionId: string
  /**
   * Canonical long-format rows — matches DuckDB GROUP BY output. Keep this
   * as the source of truth; `male` / `female` / `byAge` below are convenience
   * pivots populated by the aggregator for UI consumption.
   */
  buckets: { label: string; count: number; prevalence: number }[]
  /** Affected-children count for this condition × male. DuckDB PIVOT scalar. */
  male?: number
  /** Affected-children count for this condition × female. */
  female?: number
  /** Affected-children count for this condition × age bucket. Key = AgeGroupBucket.group. */
  byAge?: Record<string, number>
}

// ─── Geographic Aggregation ─────────────────────────────────────

/**
 * Build a geographic hierarchy from multiple campaigns.
 * Groups campaigns by location at each level and aggregates
 * prevalence data for drill-down reporting.
 */
/**
 * Build a synthetic root GeoNode with child regions grouped by `rootLevel`.
 *
 * Returning a single root matches DuckDB's `GROUP BY ROLLUP(...)` idiom (one
 * rollup row at the top of the hierarchy) and gives consumers a stable
 * .totalChildren / .campaignCodes / .children surface without worrying
 * about empty-array sentinels.
 */
export function buildGeoHierarchy(
  bundles: CampaignDataBundle[],
  rootLevel: LocationLevel = 'country',
): GeoNode {
  const located = bundles.map(b => ({
    ...b,
    location: normaliseCampaignLocation(b.campaign as Record<string, unknown>),
  }))
  const children = groupByLevel(located, rootLevel)

  const totalChildren = children.reduce((a, c) => a + c.totalChildren, 0)
  const screenedChildren = children.reduce((a, c) => a + c.screenedChildren, 0)
  const campaignCodes = Array.from(new Set(children.flatMap(c => c.campaignCodes)))
  const riskDistribution = children.reduce(
    (acc, c) => ({
      noRisk: acc.noRisk + c.riskDistribution.noRisk,
      possibleRisk: acc.possibleRisk + c.riskDistribution.possibleRisk,
      highRisk: acc.highRisk + c.riskDistribution.highRisk,
    }),
    { noRisk: 0, possibleRisk: 0, highRisk: 0 },
  )
  const referralRate = children.length > 0
    ? children.reduce((a, c) => a + c.referralRate, 0) / children.length
    : 0

  return {
    level: rootLevel,
    label: 'All regions',
    campaignCodes,
    totalChildren,
    screenedChildren,
    topConditions: [],
    categoryBreakdown: [],
    children,
    riskDistribution,
    referralRate,
  }
}

function groupByLevel(
  bundles: (CampaignDataBundle & { location: CampaignLocation })[],
  level: LocationLevel,
): GeoNode[] {
  // Auto-skip levels where all bundles are "Unknown"
  if (bundles.length > 0 && level !== 'school') {
    const allUnknown = bundles.every(b => getLocationLabel(b.location, level) === 'Unknown')
    if (allUnknown) {
      const nextLevel = getChildLevel(level)
      if (nextLevel) return groupByLevel(bundles, nextLevel)
    }
  }

  const groups = new Map<string, (CampaignDataBundle & { location: CampaignLocation })[]>()

  for (const b of bundles) {
    const key = level === 'school'
      ? (b.campaign.schoolName || b.campaign.name || 'Unknown')
      : getLocationLabel(b.location, level)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b)
  }

  return Array.from(groups.entries()).map(([label, groupBundles]) => {
    const childLevel = getChildLevel(level)
    const allChildren = groupBundles.flatMap(b => b.children)
    const allObs = groupBundles.flatMap(b => b.observations)
    const allReviews = groupBundles.reduce((acc, b) => ({ ...acc, ...b.reviews }), {} as Record<string, ClinicianReview>)

    // Compute aggregate stats
    const childIds = new Set(allChildren.map(c => c.id))
    const screenedChildIds = new Set(allObs.map(o => o.childId))
    const totalChildren = childIds.size
    const screenedChildren = screenedChildIds.size

    // Risk distribution
    const riskDist = { noRisk: 0, possibleRisk: 0, highRisk: 0 }
    for (const obs of allObs) {
      if (obs.riskCategory === 'no_risk') riskDist.noRisk++
      else if (obs.riskCategory === 'possible_risk') riskDist.possibleRisk++
      else if (obs.riskCategory === 'high_risk') riskDist.highRisk++
    }

    // Referral rate
    const totalReviews = Object.values(allReviews).length
    const referrals = Object.values(allReviews).filter(r => r.decision === 'refer').length
    const referralRate = totalReviews > 0 ? (referrals / totalReviews) * 100 : 0

    // Condition prevalence via computePrevalenceReport (needs Observation[], convert SyncedObservation)
    const prevalence = safeComputePrevalence(allChildren, allObs, `geo_${label}`)
    const topConditions: ConditionAggregate[] = prevalence
      ? prevalence.conditions
          .filter(c => c.count > 0)
          .slice(0, 10)
          .map(c => ({
            conditionId: c.conditionId,
            conditionName: c.name,
            name: c.name,
            icdCode: c.icdCode,
            category: c.category,
            count: c.count,
            totalCount: c.count,
            prevalence: c.prevalence,
            severityBreakdown: {
              mild: c.severityBreakdown['mild'] || 0,
              moderate: c.severityBreakdown['moderate'] || 0,
              severe: c.severityBreakdown['severe'] || 0,
            },
          }))
      : []

    const categoryBreakdown = prevalence
      ? prevalence.categoryPrevalence.map(cat => ({
          category: cat.category,
          label: cat.category,
          conditionsFound: cat.conditionsFound,
          childrenAffected: cat.childrenAffected,
          prevalence: cat.prevalence,
        }))
      : []

    // Build child nodes (sub-regions)
    const childNodes = childLevel ? groupByLevel(groupBundles, childLevel) : []

    return {
      level,
      label,
      campaignCodes: groupBundles.map(b => b.campaign.code),
      totalChildren,
      screenedChildren,
      topConditions,
      categoryBreakdown,
      children: childNodes,
      riskDistribution: riskDist,
      referralRate: Math.round(referralRate * 10) / 10,
    }
  }).sort((a, b) => b.totalChildren - a.totalChildren)
}

function getChildLevel(level: LocationLevel): LocationLevel | null {
  const hierarchy: LocationLevel[] = ['country', 'state', 'district', 'city', 'school']
  const idx = hierarchy.indexOf(level)
  return idx < hierarchy.length - 1 ? hierarchy[idx + 1] : null
}

function safeComputePrevalence(children: Child[], obs: SyncedObservation[], code: string): PrevalenceReport | null {
  try {
    // Convert SyncedObservation[] to Observation[] for computePrevalenceReport
    const observations = obs.map(toObservation)
    return computePrevalenceReport(children, observations, code)
  } catch {
    return null
  }
}

// ─── Sub-Cohort Comparison ──────────────────────────────────────

/**
 * Compare sub-cohorts by gender, age group, class, or location.
 * Enables side-by-side comparison: "boys vs girls dental caries prevalence"
 */
export function compareSubCohorts(
  bundles: CampaignDataBundle[],
  groupBy: 'gender' | 'age_group' | 'class' | 'location',
): SubCohortComparison {
  const allChildren = bundles.flatMap(b => b.children)
  const allObs = bundles.flatMap(b => b.observations)
  const allReviews = bundles.reduce((acc, b) => ({ ...acc, ...b.reviews }), {} as Record<string, ClinicianReview>)

  // Group children by the requested dimension
  const groups = new Map<string, { children: Child[]; obs: SyncedObservation[]; reviews: Record<string, ClinicianReview> }>()

  for (const child of allChildren) {
    const key = getGroupKey(child, groupBy, bundles)
    if (!groups.has(key)) groups.set(key, { children: [], obs: [], reviews: {} })
    groups.get(key)!.children.push(child)
  }

  // Assign observations and reviews to groups
  for (const obs of allObs) {
    for (const [, group] of groups) {
      if (group.children.some(c => c.id === obs.childId)) {
        group.obs.push(obs)
        const review = allReviews[obs.id]
        if (review) group.reviews[obs.id] = review
        break
      }
    }
  }

  // Build cohort stats for each group
  const cohorts: SubCohort[] = Array.from(groups.entries()).map(([label, group]) => {
    const screenedIds = new Set(group.obs.map(o => o.childId))
    const totalReviews = Object.values(group.reviews).length
    const referrals = Object.values(group.reviews).filter(r => r.decision === 'refer').length

    const riskDist = { noRisk: 0, possibleRisk: 0, highRisk: 0 }
    for (const obs of group.obs) {
      if (obs.riskCategory === 'no_risk') riskDist.noRisk++
      else if (obs.riskCategory === 'possible_risk') riskDist.possibleRisk++
      else if (obs.riskCategory === 'high_risk') riskDist.highRisk++
    }

    const prevalence = safeComputePrevalence(group.children, group.obs, `cohort_${label}`)
    const topConditions: ConditionAggregate[] = prevalence
      ? prevalence.conditions.filter(c => c.count > 0).slice(0, 10).map(c => ({
          conditionId: c.conditionId,
          conditionName: c.name,
          name: c.name,
          icdCode: c.icdCode,
          category: c.category,
          count: c.count,
          totalCount: c.count,
          prevalence: c.prevalence,
          severityBreakdown: {
            mild: c.severityBreakdown['mild'] || 0,
            moderate: c.severityBreakdown['moderate'] || 0,
            severe: c.severityBreakdown['severe'] || 0,
          },
        }))
      : []

    return {
      label,
      totalChildren: group.children.length,
      screenedChildren: screenedIds.size,
      completionRate: group.children.length > 0 ? (screenedIds.size / group.children.length) * 100 : 0,
      referralRate: totalReviews > 0 ? (referrals / totalReviews) * 100 : 0,
      topConditions,
      riskBreakdown: riskDist,
      riskDistribution: riskDist,
    }
  }).sort((a, b) => b.totalChildren - a.totalChildren)

  return { groupBy, cohorts }
}

function getGroupKey(child: Child, groupBy: string, bundles: CampaignDataBundle[]): string {
  switch (groupBy) {
    case 'gender':
      return child.gender === 'male' ? 'Boys' : 'Girls'
    case 'age_group':
      return getAgeGroup(child.dob)
    case 'class':
      return child.class ? `Class ${child.class}` : 'Unknown'
    case 'location': {
      const bundle = bundles.find(b => b.children.some(c => c.id === child.id))
      if (bundle) {
        const loc = normaliseCampaignLocation(bundle.campaign as Record<string, unknown>)
        return loc.city || loc.district || loc.state || 'Unknown'
      }
      return 'Unknown'
    }
    default:
      return 'All'
  }
}

function getAgeGroup(dob: string): string {
  if (!dob) return 'Unknown'
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  if (age < 3) return '0-2 years'
  if (age < 6) return '3-5 years'
  if (age < 10) return '6-9 years'
  if (age < 14) return '10-13 years'
  return '14+ years'
}

// ─── Demographic Breakdown ──────────────────────────────────────

/**
 * Compute detailed demographic breakdown for a set of campaigns.
 * Returns age group buckets, gender splits, and cross-tabulations.
 */
export function computeDemographicBreakdown(
  bundles: CampaignDataBundle[],
): DemographicBreakdown {
  const allChildren = bundles.flatMap(b => b.children)
  const allObs = bundles.flatMap(b => b.observations)
  const allReviews = bundles.reduce((acc, b) => ({ ...acc, ...b.reviews }), {} as Record<string, ClinicianReview>)

  // ── Age group buckets ──
  const ageBuckets: { label: string; minAge: number; maxAge: number }[] = [
    { label: '0-2 years', minAge: 0, maxAge: 2 },
    { label: '3-5 years', minAge: 3, maxAge: 5 },
    { label: '6-9 years', minAge: 6, maxAge: 9 },
    { label: '10-13 years', minAge: 10, maxAge: 13 },
    { label: '14-18 years', minAge: 14, maxAge: 18 },
  ]

  const totalChildrenAll = allChildren.length
  const ageGroups: AgeGroupBucket[] = ageBuckets.map(bucket => {
    const kids = allChildren.filter(c => {
      const age = getAge(c.dob)
      return age >= bucket.minAge && age <= bucket.maxAge
    })
    const kidIds = new Set(kids.map(c => c.id))
    const obs = allObs.filter(o => kidIds.has(o.childId))
    const screened = new Set(obs.map(o => o.childId)).size
    const findings = obs.filter(o => o.riskCategory === 'possible_risk' || o.riskCategory === 'high_risk')
    const findingKids = new Set(findings.map(o => o.childId)).size
    const referred = obs.filter(o => allReviews[o.id]?.decision === 'refer')
    const referredKids = new Set(referred.map(o => o.childId)).size

    return {
      label: bucket.label,
      group: bucket.label,
      minAge: bucket.minAge,
      maxAge: bucket.maxAge,
      count: kids.length,
      screenedCount: screened,
      findingCount: findingKids,
      referralCount: referredKids,
      percentage: totalChildrenAll > 0
        ? Math.round((kids.length / totalChildrenAll) * 1000) / 10
        : 0,
    }
  })

  // ── Gender split ──
  const genderSplit: GenderBucket[] = (['male', 'female'] as const).map(g => {
    const kids = allChildren.filter(c => c.gender === g)
    const kidIds = new Set(kids.map(c => c.id))
    const obs = allObs.filter(o => kidIds.has(o.childId))
    const screened = new Set(obs.map(o => o.childId)).size
    const findings = obs.filter(o => o.riskCategory === 'possible_risk' || o.riskCategory === 'high_risk')
    const findingKids = new Set(findings.map(o => o.childId)).size
    const referred = obs.filter(o => allReviews[o.id]?.decision === 'refer')
    const referredKids = new Set(referred.map(o => o.childId)).size

    const riskBreakdown = { noRisk: 0, possibleRisk: 0, highRisk: 0 }
    for (const o of obs) {
      if (o.riskCategory === 'no_risk') riskBreakdown.noRisk++
      else if (o.riskCategory === 'possible_risk') riskBreakdown.possibleRisk++
      else if (o.riskCategory === 'high_risk') riskBreakdown.highRisk++
    }

    return {
      gender: g,
      count: kids.length,
      screenedCount: screened,
      findingCount: findingKids,
      referralCount: referredKids,
      riskBreakdown,
    }
  })

  // ── Cross-tabs ──
  const prevalence = safeComputePrevalence(allChildren, allObs, 'demographics')
  const topConds = prevalence ? prevalence.conditions.filter(c => c.count > 0).slice(0, 10) : []

  const conditionByAge: CrossTab[] = topConds.map(cond => {
    const buckets = ageBuckets.map(bucket => {
      const kids = allChildren.filter(c => {
        const age = getAge(c.dob)
        return age >= bucket.minAge && age <= bucket.maxAge
      })
      const kidIds = new Set(kids.map(c => c.id))
      const obs = allObs.filter(o =>
        kidIds.has(o.childId) &&
        (o.riskCategory === 'possible_risk' || o.riskCategory === 'high_risk') &&
        o.moduleType === cond.conditionId.split('_')[0]
      )
      const count = new Set(obs.map(o => o.childId)).size
      return {
        label: bucket.label,
        count,
        prevalence: kids.length > 0 ? Math.round((count / kids.length) * 1000) / 10 : 0,
      }
    })
    const byAge: Record<string, number> = {}
    for (const b of buckets) byAge[b.label] = b.count
    return {
      conditionName: cond.name,
      conditionId: cond.conditionId,
      buckets,
      byAge,
    }
  })

  const conditionByGender: CrossTab[] = topConds.map(cond => {
    const buckets = (['male', 'female'] as const).map(g => {
      const kids = allChildren.filter(c => c.gender === g)
      const kidIds = new Set(kids.map(c => c.id))
      const obs = allObs.filter(o =>
        kidIds.has(o.childId) &&
        (o.riskCategory === 'possible_risk' || o.riskCategory === 'high_risk') &&
        o.moduleType === cond.conditionId.split('_')[0]
      )
      const count = new Set(obs.map(o => o.childId)).size
      return {
        label: g === 'male' ? 'Boys' : 'Girls',
        count,
        prevalence: kids.length > 0 ? Math.round((count / kids.length) * 1000) / 10 : 0,
      }
    })
    return {
      conditionName: cond.name,
      conditionId: cond.conditionId,
      buckets,
      male: buckets[0].count,
      female: buckets[1].count,
    }
  })

  return { ageGroups, genderSplit, conditionByAge, conditionByGender }
}

function getAge(dob: string): number {
  if (!dob) return -1
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

// ─── Trend Analysis ─────────────────────────────────────────────

export interface TrendPoint {
  period: string
  campaignCode: string
  totalChildren: number
  screenedChildren: number
  conditionPrevalence: Record<string, number>
  overallReferralRate: number
}

/**
 * Generate trend data points from campaigns ordered by date.
 * Enables "prevalence of dental caries is decreasing over time" insights.
 */
export function computeTrendAnalysis(bundles: CampaignDataBundle[]): TrendPoint[] {
  return bundles
    .sort((a, b) => (a.campaign.createdAt || '').localeCompare(b.campaign.createdAt || ''))
    .map(bundle => {
      const screenedIds = new Set(bundle.observations.map(o => o.childId))
      const totalReviews = Object.values(bundle.reviews).length
      const referrals = Object.values(bundle.reviews).filter(r => r.decision === 'refer').length

      const prevalence = safeComputePrevalence(bundle.children, bundle.observations, bundle.campaign.code)
      const condMap: Record<string, number> = {}
      if (prevalence) {
        for (const c of prevalence.conditions) {
          if (c.count > 0) condMap[c.conditionId] = c.prevalence
        }
      }

      const createdAt = bundle.campaign.createdAt || ''
      const date = createdAt ? new Date(createdAt) : new Date()
      const period = `${date.toLocaleString('en', { month: 'short' })} ${date.getFullYear()}`

      return {
        period,
        campaignCode: bundle.campaign.code,
        totalChildren: bundle.children.length,
        screenedChildren: screenedIds.size,
        conditionPrevalence: condMap,
        overallReferralRate: totalReviews > 0 ? Math.round((referrals / totalReviews) * 1000) / 10 : 0,
      }
    })
}

// ─── Summary Helpers ────────────────────────────────────────────

/** Quick aggregate stats across all bundles */
export function computePopulationSummary(bundles: CampaignDataBundle[]) {
  const allChildren = bundles.flatMap(b => b.children)
  const allObs = bundles.flatMap(b => b.observations)
  const allReviews = bundles.reduce((acc, b) => ({ ...acc, ...b.reviews }), {} as Record<string, ClinicianReview>)

  const totalChildren = new Set(allChildren.map(c => c.id)).size
  const screenedChildren = new Set(allObs.map(o => o.childId)).size
  const totalReviews = Object.values(allReviews).length
  const referrals = Object.values(allReviews).filter(r => r.decision === 'refer').length
  const highRisk = allObs.filter(o => o.riskCategory === 'high_risk')
  const highRiskChildren = new Set(highRisk.map(o => o.childId)).size

  return {
    totalCampaigns: bundles.length,
    totalChildren,
    screenedChildren,
    completionRate: totalChildren > 0 ? Math.round((screenedChildren / totalChildren) * 1000) / 10 : 0,
    referralRate: totalReviews > 0 ? Math.round((referrals / totalReviews) * 1000) / 10 : 0,
    highRiskChildren,
    totalObservations: allObs.length,
  }
}
