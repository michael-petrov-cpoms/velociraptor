import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref, computed, nextTick } from 'vue'
import PlanSprintView from '../PlanSprintView.vue'
import type { SprintPlanningResult } from '@/composables/useVelocityCalculator'

// ─────────────────────────────────────────────────────────────────────────────
// Mock Types
// ─────────────────────────────────────────────────────────────────────────────

interface MockTeam {
  id: string
  name: string
  memberCount: number
  developerCount: number
  sprintLengthDays: number
  baselineVelocity?: number
  createdAt: { toDate: () => Date; seconds: number; nanoseconds: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

// Mock reactive state - stores
const mockTeam = ref<MockTeam | undefined>(undefined)
const mockTeamsLoading = ref(false)
const mockSprintsLoading = ref(false)

// Mock the stores
vi.mock('@/stores/teamStore', () => ({
  useTeamStore: () => ({
    get isLoading() {
      return mockTeamsLoading.value
    },
    getTeamById: () => mockTeam.value,
  }),
}))

vi.mock('@/stores/sprintStore', () => ({
  useSprintStore: () => ({
    get isLoading() {
      return mockSprintsLoading.value
    },
    getSprintsForTeam: () => [],
  }),
}))

// Mock reactive state - composable
const mockHasData = ref(true)
const mockDataSourceDescription = ref('Based on 3 sprints')
const mockVelocityResult = ref({
  averageVelocityPerDay: 4,
  dataPointCount: 3,
  includesBaseline: false,
  velocityDataPoints: [3.5, 4.0, 4.5],
})
const mockCalculatePlan = vi.fn()

vi.mock('@/composables/useVelocityCalculator', () => ({
  useVelocityCalculator: () => ({
    velocityResult: mockVelocityResult,
    calculatePlan: mockCalculatePlan,
    hasData: computed(() => mockHasData.value),
    dataSourceDescription: computed(() => mockDataSourceDescription.value),
  }),
}))

// Mock route params
const mockRouteParams = ref({ id: 'team-123' })

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRoute: () => ({
      params: mockRouteParams.value,
    }),
  }
})

// Mock Firebase Timestamp
vi.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: (date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    }),
  },
}))

// Create a minimal test router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
    { path: '/team/:id', name: 'team-detail', component: { template: '<div>Detail</div>' } },
    { path: '/team/:id/plan', name: 'plan-sprint', component: PlanSprintView },
    { path: '/team/:id/log', name: 'log-sprint', component: { template: '<div>Log</div>' } },
  ],
})

// Stub FeatherUI components
const globalStubs = {
  'f-button': {
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
    props: ['text', 'type', 'disabled'],
    emits: ['click'],
  },
  'f-loading-spinner': {
    template: '<div data-testid="loading-spinner">Loading...</div>',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mockTeamData: MockTeam = {
  id: 'team-123',
  name: 'Backend Team',
  memberCount: 6,
  developerCount: 4,
  sprintLengthDays: 10,
  createdAt: { toDate: () => new Date(), seconds: 0, nanoseconds: 0 },
}

const defaultPlanResult: SprintPlanningResult = {
  recommendedPoints: 34,
  fullCapacityPoints: 40,
  comparisonDelta: -6,
  capacityPercentage: 85,
  availableDays: 8.5,
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanSprintView', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    // Reset mocks
    mockTeam.value = undefined
    mockTeamsLoading.value = false
    mockSprintsLoading.value = false
    mockRouteParams.value = { id: 'team-123' }
    mockHasData.value = true
    mockDataSourceDescription.value = 'Based on 3 sprints'
    mockVelocityResult.value = {
      averageVelocityPerDay: 4,
      dataPointCount: 3,
      includesBaseline: false,
      velocityDataPoints: [3.5, 4.0, 4.5],
    }
    mockCalculatePlan.mockReset()
    mockCalculatePlan.mockReturnValue({ ...defaultPlanResult })

    // Reset router
    router.push('/team/team-123/plan')
    await router.isReady()
  })

  async function mountComponent() {
    wrapper = mount(PlanSprintView, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    })
    await wrapper.vm.$nextTick()
    return wrapper
  }

  /**
   * Helper to set leave days input and trigger interaction.
   */
  async function setLeaveDays(value: number) {
    const input = wrapper.find('#expected-leave-days')
    await input.setValue(value)
    await input.trigger('input')
    await nextTick()
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rendering Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('shows loading spinner when team data is loading', async () => {
      mockTeamsLoading.value = true

      await mountComponent()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
      expect(wrapper.find('.plan-content').exists()).toBe(false)
      expect(wrapper.find('.not-found').exists()).toBe(false)
    })

    it('shows loading spinner when sprint data is loading', async () => {
      mockSprintsLoading.value = true

      await mountComponent()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
    })

    it('shows "Team Not Found" when team does not exist', async () => {
      mockTeam.value = undefined

      await mountComponent()

      expect(wrapper.find('.not-found').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Team Not Found')
      expect(wrapper.text()).toContain("doesn't exist or has been deleted")
    })

    it('shows content when team exists', async () => {
      mockTeam.value = { ...mockTeamData }

      await mountComponent()

      expect(wrapper.find('.plan-content').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Plan Sprint')
    })

    it('shows back link with team name', async () => {
      mockTeam.value = { ...mockTeamData }

      await mountComponent()

      const backLink = wrapper.find('.back-link')
      expect(backLink.exists()).toBe(true)
      expect(backLink.text()).toContain('Backend Team')
    })

    it('displays team context card with team name, sprint length, developer count', async () => {
      mockTeam.value = { ...mockTeamData }

      await mountComponent()

      const contextCard = wrapper.find('.team-context-card')
      expect(contextCard.exists()).toBe(true)
      expect(contextCard.text()).toContain('Backend Team')
      expect(contextCard.text()).toContain('10 days')
      expect(contextCard.text()).toContain('4')
    })

    it('displays data source description in team context card', async () => {
      mockTeam.value = { ...mockTeamData }
      mockDataSourceDescription.value = 'Based on 3 sprints'

      await mountComponent()

      const contextCard = wrapper.find('.team-context-card')
      expect(contextCard.text()).toContain('Based on 3 sprints')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // No Data State
  // ───────────────────────────────────────────────────────────────────────────

  describe('No Data State', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
      mockHasData.value = false
    })

    it('shows no data message when hasData is false', async () => {
      await mountComponent()

      expect(wrapper.find('.no-data-card').exists()).toBe(true)
      expect(wrapper.text()).toContain('Log at least one sprint or set a baseline velocity')
    })

    it('shows "Log a Sprint" button linking to log page', async () => {
      await mountComponent()

      const noDataCard = wrapper.find('.no-data-card')
      const link = noDataCard.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('/team/team-123/log')
      expect(noDataCard.text()).toContain('Log a Sprint')
    })

    it('hides calculator when there is no data', async () => {
      await mountComponent()

      expect(wrapper.find('.calculator').exists()).toBe(false)
      expect(wrapper.find('#expected-leave-days').exists()).toBe(false)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Calculator Input
  // ───────────────────────────────────────────────────────────────────────────

  describe('Calculator Input', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
      mockHasData.value = true
    })

    it('renders input with correct attributes', async () => {
      await mountComponent()

      const input = wrapper.find('#expected-leave-days')
      expect(input.exists()).toBe(true)
      expect(input.attributes('type')).toBe('number')
      expect(input.attributes('min')).toBe('0')
      expect(input.attributes('step')).toBe('0.5')
    })

    it('has associated label', async () => {
      await mountComponent()

      const label = wrapper.find('label[for="expected-leave-days"]')
      expect(label.exists()).toBe(true)
      expect(label.text()).toContain('Expected Leave Days')
    })

    it('shows hint text', async () => {
      await mountComponent()

      expect(wrapper.find('.field-hint').text()).toContain('Total person-days of leave')
    })

    it('shows no errors initially', async () => {
      await mountComponent()

      expect(wrapper.findAll('.field-error').length).toBe(0)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Live Calculation
  // ───────────────────────────────────────────────────────────────────────────

  describe('Live Calculation', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
      mockHasData.value = true
    })

    it('shows recommended points when leave days are entered', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult, recommendedPoints: 34 })

      await mountComponent()
      await setLeaveDays(3)

      expect(wrapper.find('.results-card').exists()).toBe(true)
      expect(wrapper.find('.hero-number').text()).toBe('34')
    })

    it('shows capacity percentage', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult, capacityPercentage: 85 })

      await mountComponent()
      await setLeaveDays(3)

      expect(wrapper.text()).toContain('Team is at 85% capacity')
    })

    it('shows comparison delta text', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult, comparisonDelta: -6 })

      await mountComponent()
      await setLeaveDays(3)

      expect(wrapper.text()).toContain('-6 points vs full capacity')
    })

    it('shows "Full capacity" when delta is 0', async () => {
      mockCalculatePlan.mockReturnValue({
        ...defaultPlanResult,
        comparisonDelta: 0,
        capacityPercentage: 100,
      })

      await mountComponent()
      await setLeaveDays(0)

      expect(wrapper.text()).toContain('Full capacity')
    })

    it('shows data source in results card', async () => {
      mockDataSourceDescription.value = 'Based on 3 sprints'

      await mountComponent()
      await setLeaveDays(3)

      const dataSource = wrapper.find('.data-source')
      expect(dataSource.text()).toContain('Based on 3 sprints')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Capacity Bar
  // ───────────────────────────────────────────────────────────────────────────

  describe('Capacity Bar', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
      mockHasData.value = true
    })

    it('renders capacity bar track and fill', async () => {
      await mountComponent()
      await setLeaveDays(3)

      expect(wrapper.find('.capacity-bar-track').exists()).toBe(true)
      expect(wrapper.find('.capacity-bar-fill').exists()).toBe(true)
    })

    it('sets fill width to match capacity percentage', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult, capacityPercentage: 85 })

      await mountComponent()
      await setLeaveDays(3)

      const fill = wrapper.find('.capacity-bar-fill')
      expect(fill.attributes('style')).toContain('width: 85%')
    })

    it('applies "high" color class for >= 80% capacity', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult, capacityPercentage: 80 })

      await mountComponent()
      await setLeaveDays(2)

      const fill = wrapper.find('.capacity-bar-fill')
      expect(fill.classes()).toContain('high')
    })

    it('applies "medium" color class for 50-79% capacity', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult, capacityPercentage: 65 })

      await mountComponent()
      await setLeaveDays(5)

      const fill = wrapper.find('.capacity-bar-fill')
      expect(fill.classes()).toContain('medium')
    })

    it('applies "low" color class for < 50% capacity', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult, capacityPercentage: 30 })

      await mountComponent()
      await setLeaveDays(8)

      const fill = wrapper.find('.capacity-bar-fill')
      expect(fill.classes()).toContain('low')
    })

    it('clamps width to 100% maximum', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult, capacityPercentage: 120 })

      await mountComponent()
      await setLeaveDays(0)

      const fill = wrapper.find('.capacity-bar-fill')
      expect(fill.attributes('style')).toContain('width: 100%')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Validation
  // ───────────────────────────────────────────────────────────────────────────

  describe('Validation', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
      mockHasData.value = true
    })

    it('shows no error before interaction', async () => {
      await mountComponent()

      expect(wrapper.findAll('.field-error').length).toBe(0)
    })

    it('shows error for negative leave days', async () => {
      await mountComponent()
      await setLeaveDays(-5)

      expect(wrapper.text()).toContain('Leave days cannot be negative')
    })

    it('shows "Leave days too high" when available days < 1', async () => {
      // team: sprintLength=10, devCount=4 -> leaveDays=37 -> availableDays = 10 - (37/4) = 0.75
      mockCalculatePlan.mockReturnValue(null)

      await mountComponent()
      await setLeaveDays(37)

      expect(wrapper.text()).toContain('Leave days too high')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ───────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
      mockHasData.value = true
    })

    it('shows full capacity result for 0 leave days', async () => {
      mockCalculatePlan.mockReturnValue({
        ...defaultPlanResult,
        recommendedPoints: 40,
        fullCapacityPoints: 40,
        comparisonDelta: 0,
        capacityPercentage: 100,
      })

      await mountComponent()
      await setLeaveDays(0)

      expect(wrapper.find('.hero-number').text()).toBe('40')
      expect(wrapper.text()).toContain('Full capacity')
    })

    it('shows placeholder when input is empty and no interaction', async () => {
      await mountComponent()

      expect(wrapper.find('.results-placeholder').exists()).toBe(true)
      expect(wrapper.text()).toContain(
        'Enter expected leave days above to see your sprint recommendation',
      )
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Accessibility
  // ───────────────────────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
      mockHasData.value = true
    })

    it('input has associated label', async () => {
      await mountComponent()

      const input = wrapper.find('#expected-leave-days')
      expect(input.exists()).toBe(true)
      const label = wrapper.find('label[for="expected-leave-days"]')
      expect(label.exists()).toBe(true)
    })

    it('validation error has role="alert"', async () => {
      await mountComponent()
      await setLeaveDays(-1)

      const errors = wrapper.findAll('.field-error')
      expect(errors.length).toBeGreaterThan(0)
      errors.forEach((error) => {
        expect(error.attributes('role')).toBe('alert')
      })
    })

    it('Recommended Points label has explanatory tooltip', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult })

      await mountComponent()
      await setLeaveDays(3)

      const heroLabel = wrapper.find('.hero-label')
      expect(heroLabel.attributes('data-tooltip')).toContain('average velocity per day')
    })

    it('Capacity label has explanatory tooltip', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult })

      await mountComponent()
      await setLeaveDays(3)

      const capacityTooltip = wrapper.find('.capacity-header .has-tooltip')
      expect(capacityTooltip.attributes('data-tooltip')).toContain('available working days')
    })

    it('Data source has explanatory tooltip', async () => {
      mockCalculatePlan.mockReturnValue({ ...defaultPlanResult })

      await mountComponent()
      await setLeaveDays(3)

      const dataSourceTooltip = wrapper.find('.data-source .has-tooltip')
      expect(dataSourceTooltip.attributes('data-tooltip')).toContain('data points were used')
    })

    it('has proper heading hierarchy', async () => {
      await mountComponent()

      const headings = wrapper.findAll('h1, h2')
      expect(headings[0]!.element.tagName).toBe('H1')
      expect(headings[0]!.text()).toBe('Plan Sprint')
      expect(headings[1]!.element.tagName).toBe('H2')
      expect(headings[1]!.text()).toBe('Team Context')
    })
  })
})
