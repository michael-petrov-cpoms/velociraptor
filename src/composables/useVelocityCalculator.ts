import { computed, toValue, type MaybeRef, type ComputedRef } from 'vue'
import type { Sprint, Team } from '@/types'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Result of velocity calculations across sprint history.
 */
export interface VelocityCalculationResult {
  /** Average velocity per day across data points (null if no data) */
  averageVelocityPerDay: number | null
  /** Number of data points used (sprints + baseline if included) */
  dataPointCount: number
  /** Whether baseline was included in the average */
  includesBaseline: boolean
  /** Individual velocity-per-day values used in average */
  velocityDataPoints: number[]
}

/**
 * Result of sprint planning calculation.
 */
export interface SprintPlanningResult {
  /** Recommended points for the sprint (floor of calculation) */
  recommendedPoints: number
  /** Points if team was at full capacity (no leave) */
  fullCapacityPoints: number
  /** Difference between recommended and full capacity (negative when reduced) */
  comparisonDelta: number
  /** Capacity percentage (0-100+) */
  capacityPercentage: number
  /** Available working days after accounting for leave */
  availableDays: number
}

/**
 * Return type for useVelocityCalculator composable.
 */
export interface UseVelocityCalculatorReturn {
  /** Core velocity calculation result (reactive) */
  velocityResult: ComputedRef<VelocityCalculationResult | null>
  /** Calculate sprint planning based on expected leave days */
  calculatePlan: (expectedLeaveDays: number) => SprintPlanningResult | null
  /** Whether there's enough data to make recommendations */
  hasData: ComputedRef<boolean>
  /** Human-readable data source description */
  dataSourceDescription: ComputedRef<string>
}

// ============================================================================
// Pure Helper Functions (Exported for Testing)
// ============================================================================

/**
 * Calculate velocity per day for a single sprint.
 *
 * Formula: pointsCompleted / availableDays
 * where availableDays = sprintLengthDays - (leaveDays / developerCount)
 *
 * Uses the sprint's snapshot values for sprintLengthDays and developerCount,
 * preserving accuracy even if team configuration has changed.
 *
 * @param sprint - The sprint to calculate velocity for
 * @returns Velocity per day, or null if availableDays < 1
 */
export function calculateSprintVelocityPerDay(sprint: Sprint): number | null {
  const equivalentLeaveDays = sprint.leaveDays / sprint.developerCount
  const availableDays = sprint.sprintLengthDays - equivalentLeaveDays

  // Edge case: protect against division by zero or negative days
  if (availableDays < 1) {
    return null
  }

  return sprint.pointsCompleted / availableDays
}

/**
 * Convert baseline velocity (points per sprint) to velocity per day.
 *
 * @param baselineVelocity - Expected points per sprint
 * @param sprintLengthDays - Team's sprint length in days
 * @returns Velocity per day
 */
export function baselineToVelocityPerDay(
  baselineVelocity: number,
  sprintLengthDays: number,
): number {
  return baselineVelocity / sprintLengthDays
}

/**
 * Select data points for velocity average.
 *
 * Rules:
 * - Take up to 5 most recent sprints
 * - If baseline exists and < 5 sprints, include baseline as one data point
 * - If 5+ sprints, baseline drops out
 *
 * @param sprintVelocities - Velocity per day values from sprints (newest first)
 * @param baselineVelocityPerDay - Optional baseline converted to per-day
 * @returns Array of velocity values to average, and whether baseline is included
 */
export function selectDataPoints(
  sprintVelocities: number[],
  baselineVelocityPerDay?: number,
): { dataPoints: number[]; includesBaseline: boolean } {
  const MAX_DATA_POINTS = 5

  // Take at most 5 sprints
  const sprintDataPoints = sprintVelocities.slice(0, MAX_DATA_POINTS)

  // Include baseline only if:
  // 1. Baseline exists
  // 2. We have fewer than 5 sprint data points
  const shouldIncludeBaseline =
    baselineVelocityPerDay !== undefined && sprintDataPoints.length < MAX_DATA_POINTS

  if (shouldIncludeBaseline) {
    return {
      dataPoints: [...sprintDataPoints, baselineVelocityPerDay],
      includesBaseline: true,
    }
  }

  return {
    dataPoints: sprintDataPoints,
    includesBaseline: false,
  }
}

/**
 * Calculate average of velocity data points.
 *
 * @param dataPoints - Array of velocity per day values
 * @returns Average, or null if no data points
 */
export function calculateAverageVelocity(dataPoints: number[]): number | null {
  if (dataPoints.length === 0) {
    return null
  }

  const sum = dataPoints.reduce((acc, val) => acc + val, 0)
  return sum / dataPoints.length
}

/**
 * Calculate planning metrics for an upcoming sprint.
 *
 * @param averageVelocityPerDay - Calculated average velocity
 * @param sprintLengthDays - Team's sprint length
 * @param developerCount - Team's developer count
 * @param expectedLeaveDays - Expected person-days of leave
 * @returns Planning result or null if available days < 1
 */
export function calculateSprintPlan(
  averageVelocityPerDay: number,
  sprintLengthDays: number,
  developerCount: number,
  expectedLeaveDays: number,
): SprintPlanningResult | null {
  const equivalentLeaveDays = expectedLeaveDays / developerCount
  const availableDays = sprintLengthDays - equivalentLeaveDays

  // Protect against invalid available days
  if (availableDays < 1) {
    return null
  }

  const recommendedPoints = Math.floor(averageVelocityPerDay * availableDays)
  const fullCapacityPoints = Math.floor(averageVelocityPerDay * sprintLengthDays)
  const comparisonDelta = recommendedPoints - fullCapacityPoints
  const capacityPercentage = (availableDays / sprintLengthDays) * 100

  return {
    recommendedPoints,
    fullCapacityPoints,
    comparisonDelta,
    capacityPercentage,
    availableDays,
  }
}

// ============================================================================
// Main Composable
// ============================================================================

/**
 * Composable for calculating team velocity and sprint planning recommendations.
 *
 * Uses historical sprint data and optional baseline velocity to provide:
 * - Average velocity per day (normalized for availability)
 * - Sprint planning recommendations based on expected leave
 *
 * @see https://vuejs.org/guide/reusability/composables
 *
 * @param sprints - Sprints sorted by endDate descending (newest first)
 * @param team - Team with configuration including optional baseline
 * @returns Reactive velocity calculations and planning function
 *
 * @example
 * ```typescript
 * const sprints = computed(() => sprintStore.getSprintsForTeam(teamId))
 * const team = computed(() => teamStore.getTeamById(teamId))
 *
 * const { velocityResult, calculatePlan, hasData } = useVelocityCalculator(sprints, team)
 *
 * const plan = calculatePlan(expectedLeaveDays.value)
 * ```
 */
export function useVelocityCalculator(
  sprints: MaybeRef<Sprint[]>,
  team: MaybeRef<Team>,
): UseVelocityCalculatorReturn {
  /**
   * Core velocity calculation - reactive to sprint/team changes
   */
  const velocityResult = computed<VelocityCalculationResult | null>(() => {
    const sprintList = toValue(sprints)
    const teamData = toValue(team)

    // Calculate velocity per day for each sprint (filter out nulls from edge cases)
    const sprintVelocities = sprintList
      .map(calculateSprintVelocityPerDay)
      .filter((v): v is number => v !== null)

    // Convert baseline if it exists
    const baselineVelocityPerDay =
      teamData.baselineVelocity !== undefined
        ? baselineToVelocityPerDay(teamData.baselineVelocity, teamData.sprintLengthDays)
        : undefined

    // Select which data points to use
    const { dataPoints, includesBaseline } = selectDataPoints(
      sprintVelocities,
      baselineVelocityPerDay,
    )

    // No data at all
    if (dataPoints.length === 0) {
      return null
    }

    const averageVelocityPerDay = calculateAverageVelocity(dataPoints)

    return {
      averageVelocityPerDay,
      dataPointCount: dataPoints.length,
      includesBaseline,
      velocityDataPoints: dataPoints,
    }
  })

  /**
   * Whether we have enough data to make recommendations
   */
  const hasData = computed(() => velocityResult.value !== null)

  /**
   * Human-readable description of data source
   */
  const dataSourceDescription = computed(() => {
    const result = velocityResult.value

    if (!result) {
      return 'No velocity data available'
    }

    const sprintCount = result.includesBaseline ? result.dataPointCount - 1 : result.dataPointCount

    if (sprintCount === 0 && result.includesBaseline) {
      return 'Based on baseline estimate'
    }

    const sprintText = sprintCount === 1 ? '1 sprint' : `${sprintCount} sprints`

    if (result.includesBaseline) {
      return `Based on ${sprintText} + baseline`
    }

    return `Based on ${sprintText}`
  })

  /**
   * Calculate planning for a specific leave amount
   */
  function calculatePlan(expectedLeaveDays: number): SprintPlanningResult | null {
    const result = velocityResult.value
    const teamData = toValue(team)

    if (!result || result.averageVelocityPerDay === null) {
      return null
    }

    return calculateSprintPlan(
      result.averageVelocityPerDay,
      teamData.sprintLengthDays,
      teamData.developerCount,
      expectedLeaveDays,
    )
  }

  return {
    velocityResult,
    calculatePlan,
    hasData,
    dataSourceDescription,
  }
}
