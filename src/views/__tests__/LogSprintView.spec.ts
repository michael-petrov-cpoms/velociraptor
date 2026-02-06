import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref, nextTick } from 'vue'
import LogSprintView from '../LogSprintView.vue'

// ─────────────────────────────────────────────────────────────────────────────
// Mock Types
// ─────────────────────────────────────────────────────────────────────────────

interface MockTeam {
  id: string
  name: string
  memberCount: number
  developerCount: number
  sprintLengthDays: number
  createdAt: { toDate: () => Date; seconds: number; nanoseconds: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

// Mock reactive state
const mockTeam = ref<MockTeam | undefined>(undefined)
const mockTeamsLoading = ref(false)
const mockAddSprint = vi.fn()

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
    addSprint: mockAddSprint,
  }),
}))

// Mock route params
const mockRouterPush = vi.fn()
const mockRouteParams = ref({ id: 'team-123' })

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRoute: () => ({
      params: mockRouteParams.value,
    }),
    useRouter: () => ({
      push: mockRouterPush,
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
    { path: '/team/:id/log', name: 'log-sprint', component: LogSprintView },
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

/**
 * Returns a past date string in YYYY-MM-DD format suitable for the date input.
 */
function pastDateString(): string {
  return '2024-06-15'
}

/**
 * Returns a future date string in YYYY-MM-DD format.
 */
function futureDateString(): string {
  const future = new Date()
  future.setFullYear(future.getFullYear() + 1)
  return future.toISOString().split('T')[0]!
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('LogSprintView', () => {
  let wrapper: VueWrapper
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    // Reset mocks
    mockTeam.value = undefined
    mockTeamsLoading.value = false
    mockRouteParams.value = { id: 'team-123' }
    mockAddSprint.mockReset()
    mockAddSprint.mockResolvedValue('sprint-new-id')
    mockRouterPush.mockReset()

    // Mock window.confirm
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Reset router
    router.push('/team/team-123/log')
    await router.isReady()
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  async function mountComponent() {
    wrapper = mount(LogSprintView, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    })
    await wrapper.vm.$nextTick()
    return wrapper
  }

  /**
   * Helper to fill all required form fields with valid data.
   */
  async function fillValidForm() {
    await wrapper.find('#end-date').setValue(pastDateString())
    await wrapper.find('#points-completed').setValue(21)
    await wrapper.find('#leave-days').setValue(2)
  }

  /**
   * Helper to click the submit button (Log Sprint / Saving...).
   */
  async function clickSubmit() {
    const buttons = wrapper.findAll('button')
    const submitButton = buttons.find(
      (b) => b.text().includes('Log Sprint') || b.text().includes('Saving'),
    )
    await submitButton?.trigger('click')
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
      expect(wrapper.find('.sprint-content').exists()).toBe(false)
      expect(wrapper.find('.not-found').exists()).toBe(false)
    })

    it('shows "Team Not Found" when team does not exist', async () => {
      mockTeam.value = undefined

      await mountComponent()

      expect(wrapper.find('.not-found').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Team Not Found')
      expect(wrapper.text()).toContain("doesn't exist or has been deleted")
    })

    it('shows form with all fields when team exists', async () => {
      mockTeam.value = { ...mockTeamData }

      await mountComponent()

      expect(wrapper.find('#end-date').exists()).toBe(true)
      expect(wrapper.find('#points-completed').exists()).toBe(true)
      expect(wrapper.find('#leave-days').exists()).toBe(true)
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

    it('shows back link with team name', async () => {
      mockTeam.value = { ...mockTeamData }

      await mountComponent()

      const backLink = wrapper.find('.back-link')
      expect(backLink.exists()).toBe(true)
      expect(backLink.text()).toContain('Backend Team')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Validation — No Errors Before Submit
  // ───────────────────────────────────────────────────────────────────────────

  describe('Validation - No Errors Before Submit', () => {
    it('does not show validation errors before submit attempt', async () => {
      mockTeam.value = { ...mockTeamData }

      await mountComponent()

      expect(wrapper.findAll('.field-error').length).toBe(0)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Validation — End Date
  // ───────────────────────────────────────────────────────────────────────────

  describe('Validation - End Date', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
    })

    it('shows error when end date is empty on submit', async () => {
      await mountComponent()
      // Set other fields but leave end date empty
      await wrapper.find('#points-completed').setValue(10)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).toContain('End date is required')
    })

    it('shows error when end date is in the future', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(futureDateString())
      await wrapper.find('#points-completed').setValue(10)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).toContain('End date cannot be in the future')
    })

    it('no error for valid past date', async () => {
      await mountComponent()
      await fillValidForm()
      await clickSubmit()

      expect(wrapper.text()).not.toContain('End date is required')
      expect(wrapper.text()).not.toContain('End date cannot be in the future')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Validation — Points Completed
  // ───────────────────────────────────────────────────────────────────────────

  describe('Validation - Points Completed', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
    })

    it('shows error when points completed is empty on submit', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#leave-days').setValue(0)
      // Leave points-completed empty
      await clickSubmit()

      expect(wrapper.text()).toContain('Points completed is required')
    })

    it('shows error when points is negative', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(-5)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).toContain('Points cannot be negative')
    })

    it('accepts 0 as valid (though warning shown)', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(0)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).not.toContain('Points completed is required')
      expect(wrapper.text()).not.toContain('Points cannot be negative')
    })

    it('accepts 0.5 increment values', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(10.5)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).not.toContain('Points completed is required')
      expect(wrapper.text()).not.toContain('Points cannot be negative')
      expect(mockAddSprint).toHaveBeenCalledWith(
        expect.objectContaining({ pointsCompleted: 10.5 }),
      )
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Validation — Leave Days
  // ───────────────────────────────────────────────────────────────────────────

  describe('Validation - Leave Days', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
    })

    it('shows error when leave days is empty on submit', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(10)
      // Leave leave-days empty
      await clickSubmit()

      expect(wrapper.text()).toContain('Leave days is required')
    })

    it('shows error when leave days is negative', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(10)
      await wrapper.find('#leave-days').setValue(-3)
      await clickSubmit()

      expect(wrapper.text()).toContain('Leave days cannot be negative')
    })

    it('accepts 0 as valid', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(10)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).not.toContain('Leave days is required')
      expect(wrapper.text()).not.toContain('Leave days cannot be negative')
    })

    it('accepts 0.5 increment values', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(10)
      await wrapper.find('#leave-days').setValue(2.5)
      await clickSubmit()

      expect(wrapper.text()).not.toContain('Leave days is required')
      expect(wrapper.text()).not.toContain('Leave days cannot be negative')
      expect(mockAddSprint).toHaveBeenCalledWith(
        expect.objectContaining({ leaveDays: 2.5 }),
      )
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Cross-Field Validation (Available Days)
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cross-Field Validation (Available Days)', () => {
    it('shows "Leave days too high" when availableDays < 1', async () => {
      // team: sprintLength=10, devCount=2 -> availableDays = 10 - (19/2) = 0.5
      mockTeam.value = { ...mockTeamData, developerCount: 2 }

      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(10)
      await wrapper.find('#leave-days').setValue(19)
      await clickSubmit()

      expect(wrapper.text()).toContain('Leave days too high')
    })

    it('no error when leave days result in availableDays = 1 (boundary)', async () => {
      // team: sprintLength=10, devCount=4 -> leaveDays=36 -> availableDays = 10 - (36/4) = 1
      mockTeam.value = { ...mockTeamData, developerCount: 4, sprintLengthDays: 10 }

      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(10)
      await wrapper.find('#leave-days').setValue(36)
      await clickSubmit()

      expect(wrapper.text()).not.toContain('Leave days too high')
    })

    it('no error when leave days are 0', async () => {
      mockTeam.value = { ...mockTeamData }

      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(10)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).not.toContain('Leave days too high')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Zero-Point Warning
  // ───────────────────────────────────────────────────────────────────────────

  describe('Zero-Point Warning', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
    })

    it('shows window.confirm when pointsCompleted is 0', async () => {
      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(0)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(confirmSpy).toHaveBeenCalledWith(
        "Points completed is 0. This will lower the team's average velocity. Continue?",
      )
    })

    it('submits when user confirms', async () => {
      confirmSpy.mockReturnValue(true)

      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(0)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()
      await nextTick()

      expect(mockAddSprint).toHaveBeenCalled()
    })

    it('does NOT submit when user cancels', async () => {
      confirmSpy.mockReturnValue(false)

      await mountComponent()
      await wrapper.find('#end-date').setValue(pastDateString())
      await wrapper.find('#points-completed').setValue(0)
      await wrapper.find('#leave-days').setValue(0)
      await clickSubmit()

      expect(mockAddSprint).not.toHaveBeenCalled()
    })

    it('does NOT show confirm for non-zero points', async () => {
      await mountComponent()
      await fillValidForm()
      await clickSubmit()

      expect(confirmSpy).not.toHaveBeenCalled()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Submission
  // ───────────────────────────────────────────────────────────────────────────

  describe('Submission', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
    })

    it('calls addSprint with correct data including team snapshots and Timestamp', async () => {
      await mountComponent()
      await fillValidForm()
      await clickSubmit()
      await nextTick()

      expect(mockAddSprint).toHaveBeenCalledWith({
        teamId: 'team-123',
        endDate: expect.objectContaining({
          seconds: expect.any(Number),
          nanoseconds: 0,
        }),
        pointsCompleted: 21,
        leaveDays: 2,
        sprintLengthDays: 10,
        developerCount: 4,
      })
    })

    it('redirects to team detail page after successful save', async () => {
      await mountComponent()
      await fillValidForm()
      await clickSubmit()
      await nextTick()

      expect(mockRouterPush).toHaveBeenCalledWith('/team/team-123')
    })

    it('shows submit error message on failure', async () => {
      mockAddSprint.mockRejectedValue(new Error('Network error'))

      await mountComponent()
      await fillValidForm()
      await clickSubmit()
      await nextTick()

      const submitError = wrapper.find('.submit-error')
      expect(submitError.exists()).toBe(true)
      expect(submitError.text()).toContain('Network error')
    })

    it('disables form inputs while submitting', async () => {
      // Make addSprint hang to test loading state
      mockAddSprint.mockImplementation(() => new Promise(() => {}))

      await mountComponent()
      await fillValidForm()
      await clickSubmit()

      const inputs = wrapper.findAll('input')
      inputs.forEach((input) => {
        expect(input.element.disabled).toBe(true)
      })
    })

    it('shows "Saving..." on submit button while submitting', async () => {
      mockAddSprint.mockImplementation(() => new Promise(() => {}))

      await mountComponent()
      await fillValidForm()
      await clickSubmit()

      const buttons = wrapper.findAll('button')
      const savingButton = buttons.find((b) => b.text().includes('Saving'))
      expect(savingButton?.exists()).toBe(true)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Cancel / Navigation
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cancel / Navigation', () => {
    it('cancel button links to team detail page', async () => {
      mockTeam.value = { ...mockTeamData }

      await mountComponent()

      // The Cancel button is inside a RouterLink to /team/:id
      const links = wrapper.findAll('a')
      const cancelLink = links.find((l) => {
        const button = l.find('button')
        return button.exists() && button.text() === 'Cancel'
      })
      expect(cancelLink?.attributes('href')).toBe('/team/team-123')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Accessibility
  // ───────────────────────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    beforeEach(() => {
      mockTeam.value = { ...mockTeamData }
    })

    it('all inputs have associated labels', async () => {
      await mountComponent()

      const inputs = wrapper.findAll('input')
      inputs.forEach((input) => {
        const id = input.attributes('id')
        expect(id).toBeTruthy()
        const label = wrapper.find(`label[for="${id}"]`)
        expect(label.exists()).toBe(true)
      })
    })

    it('validation errors have role="alert"', async () => {
      await mountComponent()
      // Submit empty form to trigger all errors
      await clickSubmit()

      const errors = wrapper.findAll('.field-error')
      expect(errors.length).toBeGreaterThan(0)
      errors.forEach((error) => {
        expect(error.attributes('role')).toBe('alert')
      })
    })

    it('submit error has role="alert"', async () => {
      mockAddSprint.mockRejectedValue(new Error('Fail'))

      await mountComponent()
      await fillValidForm()
      await clickSubmit()
      await nextTick()

      const submitError = wrapper.find('.submit-error')
      expect(submitError.attributes('role')).toBe('alert')
    })
  })
})
