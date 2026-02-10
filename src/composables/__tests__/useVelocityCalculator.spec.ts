import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { Timestamp } from 'firebase/firestore'
import type { Sprint, Team } from '@/types'
import {
  calculateSprintVelocityPerDay,
  baselineToVelocityPerDay,
  selectDataPoints,
  calculateAverageVelocity,
  calculateSprintPlan,
  useVelocityCalculator,
} from '../useVelocityCalculator'

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create a mock Sprint for testing.
 * Uses the snapshot pattern from the actual Sprint interface.
 */
function createMockSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-test',
    teamId: 'team-test',
    endDate: { toMillis: () => Date.now() } as Timestamp,
    pointsCompleted: 30,
    leaveDays: 0,
    sprintLengthDays: 14,
    developerCount: 4,
    createdAt: { toDate: () => new Date() } as Timestamp,
    ...overrides,
  }
}

/**
 * Create a mock Team for testing.
 */
function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-test',
    name: 'Test Team',
    memberCount: 5,
    developerCount: 4,
    sprintLengthDays: 14,
    createdAt: { toDate: () => new Date() } as Timestamp,
    ...overrides,
  }
}

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('calculateSprintVelocityPerDay', () => {
  it('should calculate velocity correctly with no leave', () => {
    const sprint = createMockSprint({
      pointsCompleted: 28,
      leaveDays: 0,
      sprintLengthDays: 14,
      developerCount: 4,
    })

    const result = calculateSprintVelocityPerDay(sprint)

    // 28 points / 14 days = 2 points per day
    expect(result).toBe(2)
  })

  it('should calculate velocity correctly with leave days', () => {
    const sprint = createMockSprint({
      pointsCompleted: 24,
      leaveDays: 8, // 8 person-days = 2 equivalent days for 4 developers
      sprintLengthDays: 14,
      developerCount: 4,
    })

    const result = calculateSprintVelocityPerDay(sprint)

    // availableDays = 14 - (8/4) = 14 - 2 = 12
    // velocity = 24 / 12 = 2
    expect(result).toBe(2)
  })

  it('should handle fractional leave days (0.5 increments)', () => {
    const sprint = createMockSprint({
      pointsCompleted: 26,
      leaveDays: 2.5, // Half-day leave included
      sprintLengthDays: 14,
      developerCount: 4,
    })

    const result = calculateSprintVelocityPerDay(sprint)

    // availableDays = 14 - (2.5/4) = 14 - 0.625 = 13.375
    // velocity = 26 / 13.375 ≈ 1.944
    expect(result).toBeCloseTo(26 / 13.375, 10)
  })

  it('should return null when availableDays < 1', () => {
    const sprint = createMockSprint({
      pointsCompleted: 20,
      leaveDays: 56, // 56/4 = 14 equivalent days, more than sprint length
      sprintLengthDays: 14,
      developerCount: 4,
    })

    const result = calculateSprintVelocityPerDay(sprint)

    expect(result).toBeNull()
  })

  it('should handle 0-point sprints (returns 0, not null)', () => {
    const sprint = createMockSprint({
      pointsCompleted: 0,
      leaveDays: 0,
      sprintLengthDays: 14,
      developerCount: 4,
    })

    const result = calculateSprintVelocityPerDay(sprint)

    expect(result).toBe(0)
  })

  it('should use sprint snapshot values, not team current values', () => {
    // Sprint was logged when team had 3 developers and 7-day sprints
    const sprint = createMockSprint({
      pointsCompleted: 21,
      leaveDays: 0,
      sprintLengthDays: 7, // Snapshot: was 7 days
      developerCount: 3, // Snapshot: was 3 developers
    })

    const result = calculateSprintVelocityPerDay(sprint)

    // Should use snapshot values: 21 / 7 = 3
    expect(result).toBe(3)
  })
})

describe('baselineToVelocityPerDay', () => {
  it('should convert baseline points per sprint to per day', () => {
    // Team expects 28 points per 14-day sprint
    const result = baselineToVelocityPerDay(28, 14)

    expect(result).toBe(2)
  })

  it('should handle various sprint lengths', () => {
    // 21 points per 7-day sprint
    const result = baselineToVelocityPerDay(21, 7)

    expect(result).toBe(3)
  })
})

describe('selectDataPoints', () => {
  it('should return empty array when no sprints and no baseline', () => {
    const result = selectDataPoints([], undefined)

    expect(result.dataPoints).toEqual([])
    expect(result.includesBaseline).toBe(false)
  })

  it('should use only baseline when 0 sprints + baseline exists', () => {
    const result = selectDataPoints([], 2.5)

    expect(result.dataPoints).toEqual([2.5])
    expect(result.includesBaseline).toBe(true)
  })

  it('should blend 1 sprint + baseline (2 data points)', () => {
    const result = selectDataPoints([2.0], 2.5)

    expect(result.dataPoints).toEqual([2.0, 2.5])
    expect(result.includesBaseline).toBe(true)
  })

  it('should blend 4 sprints + baseline (5 data points)', () => {
    const sprintVelocities = [2.0, 2.2, 1.8, 2.1]
    const result = selectDataPoints(sprintVelocities, 2.5)

    expect(result.dataPoints).toEqual([2.0, 2.2, 1.8, 2.1, 2.5])
    expect(result.dataPoints.length).toBe(5)
    expect(result.includesBaseline).toBe(true)
  })

  it('should drop baseline when 5+ sprints (use last 5 only)', () => {
    const sprintVelocities = [2.0, 2.2, 1.8, 2.1, 2.3, 1.9, 2.0]
    const result = selectDataPoints(sprintVelocities, 2.5)

    // Should take first 5 sprints, drop baseline
    expect(result.dataPoints).toEqual([2.0, 2.2, 1.8, 2.1, 2.3])
    expect(result.dataPoints.length).toBe(5)
    expect(result.includesBaseline).toBe(false)
  })

  it('should use only sprints when no baseline (1-4 sprints)', () => {
    const sprintVelocities = [2.0, 2.2, 1.8]
    const result = selectDataPoints(sprintVelocities, undefined)

    expect(result.dataPoints).toEqual([2.0, 2.2, 1.8])
    expect(result.includesBaseline).toBe(false)
  })

  it('should take most recent 5 sprints when more available', () => {
    const sprintVelocities = [2.0, 2.2, 1.8, 2.1, 2.3, 1.9, 2.0, 2.4]
    const result = selectDataPoints(sprintVelocities, undefined)

    // First 5 (most recent) only
    expect(result.dataPoints).toEqual([2.0, 2.2, 1.8, 2.1, 2.3])
  })
})

describe('calculateAverageVelocity', () => {
  it('should return null for empty array', () => {
    const result = calculateAverageVelocity([])

    expect(result).toBeNull()
  })

  it('should calculate correct average', () => {
    const result = calculateAverageVelocity([2.0, 2.5, 3.0])

    expect(result).toBe(2.5)
  })

  it('should handle single data point', () => {
    const result = calculateAverageVelocity([2.5])

    expect(result).toBe(2.5)
  })
})

describe('calculateSprintPlan', () => {
  it('should calculate recommended points (floor)', () => {
    // 2.5 velocity * 14 days = 35, should floor to 35
    const result = calculateSprintPlan(2.5, 14, 4, 0)

    expect(result?.recommendedPoints).toBe(35)
  })

  it('should floor non-integer results', () => {
    // 2.3 velocity * 14 days = 32.2, should floor to 32
    const result = calculateSprintPlan(2.3, 14, 4, 0)

    expect(result?.recommendedPoints).toBe(32)
  })

  it('should calculate full capacity points', () => {
    const result = calculateSprintPlan(2.0, 14, 4, 8)

    // Full capacity = 2.0 * 14 = 28
    expect(result?.fullCapacityPoints).toBe(28)
  })

  it('should calculate negative delta when reduced capacity', () => {
    const result = calculateSprintPlan(2.0, 14, 4, 8)

    // Available = 14 - (8/4) = 12 days
    // Recommended = floor(2.0 * 12) = 24
    // Full capacity = floor(2.0 * 14) = 28
    // Delta = 24 - 28 = -4
    expect(result?.recommendedPoints).toBe(24)
    expect(result?.fullCapacityPoints).toBe(28)
    expect(result?.comparisonDelta).toBe(-4)
  })

  it('should calculate zero delta at full capacity', () => {
    const result = calculateSprintPlan(2.0, 14, 4, 0)

    expect(result?.comparisonDelta).toBe(0)
  })

  it('should calculate capacity percentage', () => {
    const result = calculateSprintPlan(2.0, 14, 4, 8)

    // Available = 14 - (8/4) = 12 days
    // Capacity = (12/14) * 100 ≈ 85.71%
    expect(result?.capacityPercentage).toBeCloseTo(85.714, 2)
  })

  it('should return null when availableDays < 1', () => {
    // 60 leave days / 4 devs = 15 equivalent days > 14 sprint days
    const result = calculateSprintPlan(2.0, 14, 4, 60)

    expect(result).toBeNull()
  })

  it('should handle availableDays exactly 1', () => {
    // 52 leave days / 4 devs = 13 equivalent days
    // available = 14 - 13 = 1 day (minimum valid)
    const result = calculateSprintPlan(2.0, 14, 4, 52)

    expect(result).not.toBeNull()
    expect(result?.availableDays).toBe(1)
    expect(result?.recommendedPoints).toBe(2) // floor(2.0 * 1)
  })
})

// ============================================================================
// Composable Integration Tests
// ============================================================================

describe('useVelocityCalculator', () => {
  describe('velocityResult', () => {
    it('should return null when no sprints and no baseline', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(createMockTeam())

      const { velocityResult } = useVelocityCalculator(sprints, team)

      expect(velocityResult.value).toBeNull()
    })

    it('should use baseline only when 0 sprints + baseline exists', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(
        createMockTeam({
          baselineVelocity: 28, // 28 points per 14-day sprint = 2/day
          sprintLengthDays: 14,
        }),
      )

      const { velocityResult } = useVelocityCalculator(sprints, team)

      expect(velocityResult.value).not.toBeNull()
      expect(velocityResult.value?.averageVelocityPerDay).toBe(2)
      expect(velocityResult.value?.dataPointCount).toBe(1)
      expect(velocityResult.value?.includesBaseline).toBe(true)
    })

    it('should blend sprints with baseline correctly', () => {
      const sprint = createMockSprint({
        pointsCompleted: 28,
        leaveDays: 0,
        sprintLengthDays: 14,
        developerCount: 4,
      })
      const sprints = ref<Sprint[]>([sprint])
      const team = ref(
        createMockTeam({
          baselineVelocity: 35, // 35/14 = 2.5/day
          sprintLengthDays: 14,
        }),
      )

      const { velocityResult } = useVelocityCalculator(sprints, team)

      // Sprint velocity: 28/14 = 2
      // Baseline velocity: 35/14 = 2.5
      // Average: (2 + 2.5) / 2 = 2.25
      expect(velocityResult.value?.averageVelocityPerDay).toBe(2.25)
      expect(velocityResult.value?.dataPointCount).toBe(2)
      expect(velocityResult.value?.includesBaseline).toBe(true)
    })

    it('should drop baseline when 5+ sprints', () => {
      const sprints = ref<Sprint[]>([
        createMockSprint({
          id: 's1',
          pointsCompleted: 28,
          endDate: { toMillis: () => 5 } as Timestamp,
        }),
        createMockSprint({
          id: 's2',
          pointsCompleted: 28,
          endDate: { toMillis: () => 4 } as Timestamp,
        }),
        createMockSprint({
          id: 's3',
          pointsCompleted: 28,
          endDate: { toMillis: () => 3 } as Timestamp,
        }),
        createMockSprint({
          id: 's4',
          pointsCompleted: 28,
          endDate: { toMillis: () => 2 } as Timestamp,
        }),
        createMockSprint({
          id: 's5',
          pointsCompleted: 28,
          endDate: { toMillis: () => 1 } as Timestamp,
        }),
      ])
      const team = ref(
        createMockTeam({
          baselineVelocity: 100, // Would significantly skew if included
          sprintLengthDays: 14,
        }),
      )

      const { velocityResult } = useVelocityCalculator(sprints, team)

      // All sprints: 28/14 = 2/day, baseline should be dropped
      expect(velocityResult.value?.averageVelocityPerDay).toBe(2)
      expect(velocityResult.value?.dataPointCount).toBe(5)
      expect(velocityResult.value?.includesBaseline).toBe(false)
    })

    it('should exclude sprints with invalid availableDays', () => {
      const validSprint = createMockSprint({
        id: 's1',
        pointsCompleted: 28,
        leaveDays: 0,
        sprintLengthDays: 14,
        developerCount: 4,
      })
      const invalidSprint = createMockSprint({
        id: 's2',
        pointsCompleted: 10,
        leaveDays: 60, // Too much leave
        sprintLengthDays: 14,
        developerCount: 4,
      })
      const sprints = ref<Sprint[]>([validSprint, invalidSprint])
      const team = ref(createMockTeam())

      const { velocityResult } = useVelocityCalculator(sprints, team)

      // Only valid sprint should be used
      expect(velocityResult.value?.dataPointCount).toBe(1)
      expect(velocityResult.value?.averageVelocityPerDay).toBe(2)
    })

    it('should be reactive to sprint changes', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(createMockTeam())

      const { velocityResult } = useVelocityCalculator(sprints, team)

      expect(velocityResult.value).toBeNull()

      // Add a sprint
      sprints.value = [createMockSprint({ pointsCompleted: 42 })]

      // Should now have velocity
      expect(velocityResult.value).not.toBeNull()
      expect(velocityResult.value?.averageVelocityPerDay).toBe(3) // 42/14
    })

    it('should be reactive to team changes', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(createMockTeam({ sprintLengthDays: 14 }))

      const { velocityResult } = useVelocityCalculator(sprints, team)

      expect(velocityResult.value).toBeNull()

      // Add baseline to team
      team.value = createMockTeam({
        baselineVelocity: 28,
        sprintLengthDays: 14,
      })

      expect(velocityResult.value).not.toBeNull()
      expect(velocityResult.value?.averageVelocityPerDay).toBe(2)
    })
  })

  describe('hasData', () => {
    it('should return false when no data', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(createMockTeam())

      const { hasData } = useVelocityCalculator(sprints, team)

      expect(hasData.value).toBe(false)
    })

    it('should return true when baseline exists', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(createMockTeam({ baselineVelocity: 28 }))

      const { hasData } = useVelocityCalculator(sprints, team)

      expect(hasData.value).toBe(true)
    })

    it('should return true when sprints exist', () => {
      const sprints = ref<Sprint[]>([createMockSprint()])
      const team = ref(createMockTeam())

      const { hasData } = useVelocityCalculator(sprints, team)

      expect(hasData.value).toBe(true)
    })
  })

  describe('dataSourceDescription', () => {
    it('should describe "No velocity data" when empty', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(createMockTeam())

      const { dataSourceDescription } = useVelocityCalculator(sprints, team)

      expect(dataSourceDescription.value).toBe('No velocity data available')
    })

    it('should describe "Based on baseline estimate" for baseline only', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(createMockTeam({ baselineVelocity: 28 }))

      const { dataSourceDescription } = useVelocityCalculator(sprints, team)

      expect(dataSourceDescription.value).toBe('Based on baseline estimate')
    })

    it('should describe "Based on N sprints" without baseline', () => {
      const sprints = ref<Sprint[]>([createMockSprint(), createMockSprint({ id: 's2' })])
      const team = ref(createMockTeam())

      const { dataSourceDescription } = useVelocityCalculator(sprints, team)

      expect(dataSourceDescription.value).toBe('Based on 2 sprints')
    })

    it('should describe "Based on 1 sprint" for singular', () => {
      const sprints = ref<Sprint[]>([createMockSprint()])
      const team = ref(createMockTeam())

      const { dataSourceDescription } = useVelocityCalculator(sprints, team)

      expect(dataSourceDescription.value).toBe('Based on 1 sprint')
    })

    it('should describe "Based on N sprints + baseline" with both', () => {
      const sprints = ref<Sprint[]>([createMockSprint(), createMockSprint({ id: 's2' })])
      const team = ref(createMockTeam({ baselineVelocity: 28 }))

      const { dataSourceDescription } = useVelocityCalculator(sprints, team)

      expect(dataSourceDescription.value).toBe('Based on 2 sprints + baseline')
    })
  })

  describe('calculatePlan', () => {
    it('should return null when no velocity data', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(createMockTeam())

      const { calculatePlan } = useVelocityCalculator(sprints, team)

      expect(calculatePlan(0)).toBeNull()
    })

    it('should calculate correct recommended points', () => {
      const sprints = ref<Sprint[]>([])
      const team = ref(
        createMockTeam({
          baselineVelocity: 28, // 2/day
          sprintLengthDays: 14,
          developerCount: 4,
        }),
      )

      const { calculatePlan } = useVelocityCalculator(sprints, team)
      const plan = calculatePlan(0)

      expect(plan?.recommendedPoints).toBe(28)
      expect(plan?.fullCapacityPoints).toBe(28)
    })

    it('should return null when expected leave is too high', () => {
      const sprints = ref<Sprint[]>([createMockSprint()])
      const team = ref(
        createMockTeam({
          sprintLengthDays: 14,
          developerCount: 4,
        }),
      )

      const { calculatePlan } = useVelocityCalculator(sprints, team)
      // 60 leave days / 4 devs = 15 days > 14 sprint days
      const plan = calculatePlan(60)

      expect(plan).toBeNull()
    })

    it('should work with 0 expected leave days', () => {
      const sprints = ref<Sprint[]>([createMockSprint({ pointsCompleted: 28 })])
      const team = ref(createMockTeam({ sprintLengthDays: 14, developerCount: 4 }))

      const { calculatePlan } = useVelocityCalculator(sprints, team)
      const plan = calculatePlan(0)

      expect(plan?.availableDays).toBe(14)
      expect(plan?.capacityPercentage).toBe(100)
      expect(plan?.comparisonDelta).toBe(0)
    })
  })
})

// ============================================================================
// Edge Case Tests (Required by implementation.md)
// ============================================================================

describe('edge cases', () => {
  it('should handle sprint with 0 points completed', () => {
    const sprints = ref<Sprint[]>([
      createMockSprint({ id: 's1', pointsCompleted: 28 }),
      createMockSprint({ id: 's2', pointsCompleted: 0 }), // 0-point sprint
    ])
    const team = ref(createMockTeam())

    const { velocityResult } = useVelocityCalculator(sprints, team)

    // Sprint 1: 28/14 = 2, Sprint 2: 0/14 = 0
    // Average: (2 + 0) / 2 = 1
    expect(velocityResult.value?.averageVelocityPerDay).toBe(1)
    expect(velocityResult.value?.dataPointCount).toBe(2)
  })

  it('should handle maximum leave (availableDays = 1 exactly)', () => {
    // 4 developers, 14 day sprint
    // Max leave before invalid: (14-1) * 4 = 52 person-days
    const sprint = createMockSprint({
      pointsCompleted: 10,
      leaveDays: 52,
      sprintLengthDays: 14,
      developerCount: 4,
    })
    const sprints = ref<Sprint[]>([sprint])
    const team = ref(createMockTeam())

    const { velocityResult } = useVelocityCalculator(sprints, team)

    // Available = 14 - (52/4) = 14 - 13 = 1
    // Velocity = 10/1 = 10
    expect(velocityResult.value?.averageVelocityPerDay).toBe(10)
  })

  it('should handle all sprints having invalid data', () => {
    const sprints = ref<Sprint[]>([
      createMockSprint({ id: 's1', leaveDays: 100 }), // Invalid
      createMockSprint({ id: 's2', leaveDays: 100 }), // Invalid
    ])
    const team = ref(createMockTeam())

    const { velocityResult, hasData } = useVelocityCalculator(sprints, team)

    expect(velocityResult.value).toBeNull()
    expect(hasData.value).toBe(false)
  })

  it('should handle team with sprintLengthDays = 1', () => {
    const sprint = createMockSprint({
      pointsCompleted: 5,
      leaveDays: 0,
      sprintLengthDays: 1,
      developerCount: 2,
    })
    const sprints = ref<Sprint[]>([sprint])
    const team = ref(createMockTeam({ sprintLengthDays: 1 }))

    const { velocityResult, calculatePlan } = useVelocityCalculator(sprints, team)

    expect(velocityResult.value?.averageVelocityPerDay).toBe(5)

    const plan = calculatePlan(0)
    expect(plan?.recommendedPoints).toBe(5)
  })

  it('should handle baseline = 0', () => {
    const sprints = ref<Sprint[]>([])
    const team = ref(createMockTeam({ baselineVelocity: 0 }))

    const { velocityResult, calculatePlan } = useVelocityCalculator(sprints, team)

    expect(velocityResult.value?.averageVelocityPerDay).toBe(0)

    const plan = calculatePlan(0)
    expect(plan?.recommendedPoints).toBe(0)
  })

  it('should handle very high velocity values', () => {
    const sprint = createMockSprint({
      pointsCompleted: 1000,
      leaveDays: 0,
      sprintLengthDays: 14,
      developerCount: 4,
    })
    const sprints = ref<Sprint[]>([sprint])
    const team = ref(createMockTeam())

    const { velocityResult, calculatePlan } = useVelocityCalculator(sprints, team)

    // 1000/14 ≈ 71.43
    expect(velocityResult.value?.averageVelocityPerDay).toBeCloseTo(71.43, 1)

    const plan = calculatePlan(0)
    expect(plan?.recommendedPoints).toBe(1000)
  })

  it('should handle fractional point values (0.5 increments)', () => {
    const sprint = createMockSprint({
      pointsCompleted: 28.5,
      leaveDays: 0,
      sprintLengthDays: 14,
      developerCount: 4,
    })
    const sprints = ref<Sprint[]>([sprint])
    const team = ref(createMockTeam())

    const { velocityResult, calculatePlan } = useVelocityCalculator(sprints, team)

    // 28.5/14 ≈ 2.036
    expect(velocityResult.value?.averageVelocityPerDay).toBeCloseTo(2.036, 2)

    const plan = calculatePlan(0)
    // floor(2.036 * 14) = floor(28.5) = 28
    expect(plan?.recommendedPoints).toBe(28)
  })
})
