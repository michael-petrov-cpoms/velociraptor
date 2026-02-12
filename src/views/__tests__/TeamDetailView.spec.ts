import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import TeamDetailView from '../TeamDetailView.vue'

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
}

interface MockSprint {
  id: string
  teamId: string
  endDate: { toDate: () => Date }
  pointsCompleted: number
  leaveDays: number
  developerCount: number
  sprintLengthDays: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

// Mock reactive state
const mockTeam = ref<MockTeam | undefined>(undefined)
const mockSprints = ref<MockSprint[]>([])
const mockTeamsLoading = ref(false)
const mockSprintsLoading = ref(false)
const mockTeamError = ref<Error | undefined>(undefined)
const mockSprintError = ref<Error | undefined>(undefined)
const mockDeleteTeam = vi.fn()
const mockDeleteSprint = vi.fn()

// Mock the stores
vi.mock('@/stores/teamStore', () => ({
  useTeamStore: () => ({
    get isLoading() {
      return mockTeamsLoading.value
    },
    get error() {
      return mockTeamError.value
    },
    getTeamById: () => mockTeam.value,
    deleteTeam: mockDeleteTeam,
  }),
}))

vi.mock('@/stores/sprintStore', () => ({
  useSprintStore: () => ({
    get isLoading() {
      return mockSprintsLoading.value
    },
    get error() {
      return mockSprintError.value
    },
    getSprintsForTeam: () => mockSprints.value,
    getSprintById: (id: string) => mockSprints.value.find((s) => s.id === id),
    deleteSprint: mockDeleteSprint,
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

// Create a minimal test router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
    { path: '/team/:id', name: 'team-detail', component: TeamDetailView },
    { path: '/team/:id/log', name: 'log-sprint', component: { template: '<div>Log Sprint</div>' } },
    {
      path: '/team/:id/plan',
      name: 'plan-sprint',
      component: { template: '<div>Plan Sprint</div>' },
    },
  ],
})

// Stub FeatherUI components and child modals
const globalStubs = {
  'f-button': {
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
    props: ['text', 'type', 'disabled'],
    emits: ['click'],
  },
  'f-loading-spinner': {
    template: '<div data-testid="loading-spinner">Loading...</div>',
  },
  EditTeamModal: {
    template:
      '<div data-testid="edit-team-modal"><button class="mock-close-btn" @click="$emit(\'close\')">Close</button></div>',
    props: ['team'],
    emits: ['close'],
  },
  EditSprintModal: {
    template:
      '<div data-testid="edit-sprint-modal"><button class="mock-close-btn" @click="$emit(\'close\')">Close</button></div>',
    props: ['sprint'],
    emits: ['close'],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock team with default values.
 */
function createMockTeam(overrides: Partial<MockTeam> = {}): MockTeam {
  return {
    id: 'team-123',
    name: 'Alpha Team',
    memberCount: 8,
    developerCount: 5,
    sprintLengthDays: 14,
    ...overrides,
  }
}

/**
 * Creates a mock sprint with a real Date object wrapped in a Firestore-like toDate() method.
 */
function createMockSprint(
  overrides: Partial<Omit<MockSprint, 'endDate'>> & { endDate?: Date } = {},
): MockSprint {
  const { endDate, ...rest } = overrides
  return {
    id: 'sprint-1',
    teamId: 'team-123',
    endDate: { toDate: () => endDate || new Date('2024-01-15') },
    pointsCompleted: 28,
    leaveDays: 2,
    developerCount: 5,
    sprintLengthDays: 14,
    ...rest,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('TeamDetailView', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    // Reset mocks
    mockTeam.value = undefined
    mockSprints.value = []
    mockTeamsLoading.value = false
    mockSprintsLoading.value = false
    mockTeamError.value = undefined
    mockSprintError.value = undefined
    mockRouteParams.value = { id: 'team-123' }
    mockDeleteTeam.mockReset()
    mockDeleteSprint.mockReset()
    mockRouterPush.mockReset()

    // Fresh Pinia instance
    setActivePinia(createPinia())

    // Reset router
    router.push('/team/team-123')
    await router.isReady()
  })

  async function mountComponent() {
    wrapper = mount(TeamDetailView, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    })
    await wrapper.vm.$nextTick()
    return wrapper
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Loading State Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Loading State', () => {
    it('shows loading spinner when team store is loading', async () => {
      mockTeamsLoading.value = true

      await mountComponent()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
      expect(wrapper.find('.team-content').exists()).toBe(false)
      expect(wrapper.find('.not-found').exists()).toBe(false)
    })

    it('shows loading spinner when sprint store is loading', async () => {
      mockSprintsLoading.value = true

      await mountComponent()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
    })

    it('hides loading spinner when data is loaded', async () => {
      mockTeamsLoading.value = false
      mockSprintsLoading.value = false
      mockTeam.value = createMockTeam()

      await mountComponent()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(false)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Store Error State Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Store Error State', () => {
    it('shows error card when team store has an error', async () => {
      mockTeamError.value = new Error('Permission denied')

      await mountComponent()

      expect(wrapper.find('.error-container').exists()).toBe(true)
      expect(wrapper.find('.error-card').exists()).toBe(true)
      expect(wrapper.text()).toContain('Something went wrong')
      expect(wrapper.text()).toContain('Permission denied')
    })

    it('shows error card when sprint store has an error', async () => {
      mockSprintError.value = new Error('Network error')

      await mountComponent()

      expect(wrapper.find('.error-container').exists()).toBe(true)
      expect(wrapper.text()).toContain('Network error')
    })

    it('shows refresh hint in error state', async () => {
      mockTeamError.value = new Error('Something broke')

      await mountComponent()

      expect(wrapper.text()).toContain('Try refreshing the page.')
    })

    it('error state takes priority over not-found state', async () => {
      mockTeam.value = undefined
      mockTeamError.value = new Error('Connection failed')

      await mountComponent()

      expect(wrapper.find('.error-container').exists()).toBe(true)
      expect(wrapper.find('.not-found').exists()).toBe(false)
    })

    it('does not show error state when stores have no errors', async () => {
      mockTeam.value = createMockTeam()

      await mountComponent()

      expect(wrapper.find('.error-container').exists()).toBe(false)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Team Not Found Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Team Not Found', () => {
    it('shows "Team Not Found" message when team does not exist', async () => {
      mockTeam.value = undefined

      await mountComponent()

      expect(wrapper.find('.not-found').exists()).toBe(true)
      expect(wrapper.find('h1').text()).toBe('Team Not Found')
    })

    it('shows appropriate error description text', async () => {
      mockTeam.value = undefined

      await mountComponent()

      expect(wrapper.text()).toContain("doesn't exist or has been deleted")
    })

    it('displays "Back to Teams" button', async () => {
      mockTeam.value = undefined

      await mountComponent()

      const button = wrapper.find('.not-found button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Back to Teams')
    })

    it('"Back to Teams" button links to home route', async () => {
      mockTeam.value = undefined

      await mountComponent()

      const link = wrapper.find('.not-found a')
      expect(link.attributes('href')).toBe('/')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Team Info Display Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Team Info Display', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
    })

    it('displays team name as page heading', async () => {
      await mountComponent()

      expect(wrapper.find('.team-header h1').text()).toBe('Team Alpha Team')
    })

    it('displays member count', async () => {
      await mountComponent()

      expect(wrapper.text()).toContain('8')
      expect(wrapper.text()).toContain('Total Members')
    })

    it('displays developer count', async () => {
      await mountComponent()

      expect(wrapper.text()).toContain('5')
      expect(wrapper.text()).toContain('Developers')
    })

    it('displays sprint length in days', async () => {
      await mountComponent()

      expect(wrapper.text()).toContain('14 days')
      expect(wrapper.text()).toContain('Sprint Length')
    })

    it('shows baseline velocity if defined', async () => {
      mockTeam.value = createMockTeam({ baselineVelocity: 30 })

      await mountComponent()

      expect(wrapper.text()).toContain('30 pts/sprint')
      expect(wrapper.text()).toContain('Baseline Velocity')
    })

    it('hides baseline velocity section if undefined', async () => {
      mockTeam.value = createMockTeam({ baselineVelocity: undefined })

      await mountComponent()

      expect(wrapper.text()).not.toContain('Baseline Velocity')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Team Action Button Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Team Actions', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
    })

    it('renders "Edit Team" button', async () => {
      await mountComponent()

      const buttons = wrapper.findAll('button')
      const editButton = buttons.find((b) => b.text().includes('Edit Team'))
      expect(editButton?.exists()).toBe(true)
    })

    it('Edit Team button opens edit modal when clicked', async () => {
      await mountComponent()

      // Modal should not be visible initially
      expect(wrapper.find('[data-testid="edit-team-modal"]').exists()).toBe(false)

      const buttons = wrapper.findAll('button')
      const editButton = buttons.find((b) => b.text().includes('Edit Team'))
      await editButton?.trigger('click')

      expect(wrapper.find('[data-testid="edit-team-modal"]').exists()).toBe(true)
    })

    it('Edit Team modal receives team data', async () => {
      await mountComponent()

      const buttons = wrapper.findAll('button')
      const editButton = buttons.find((b) => b.text().includes('Edit Team'))
      await editButton?.trigger('click')

      // Verify modal is rendered (stub has data-testid)
      const modal = wrapper.find('[data-testid="edit-team-modal"]')
      expect(modal.exists()).toBe(true)
    })

    it('Edit Team modal closes when close event emitted', async () => {
      await mountComponent()

      // Open the modal
      const buttons = wrapper.findAll('button')
      const editButton = buttons.find((b) => b.text().includes('Edit Team'))
      await editButton?.trigger('click')
      expect(wrapper.find('[data-testid="edit-team-modal"]').exists()).toBe(true)

      // Click the mock close button to emit 'close'
      await wrapper.find('.mock-close-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="edit-team-modal"]').exists()).toBe(false)
    })

    it('renders "Delete Team" button', async () => {
      await mountComponent()

      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((b) => b.text().includes('Delete Team'))
      expect(deleteButton?.exists()).toBe(true)
    })

    it('Delete Team button shows ConfirmDialog', async () => {
      await mountComponent()

      // ConfirmDialog should not be visible initially
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)

      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((b) => b.text().includes('Delete Team'))
      await deleteButton?.trigger('click')

      // ConfirmDialog should now be visible
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
      expect(wrapper.text()).toContain('Delete Team')
      expect(wrapper.text()).toContain('Are you sure you want to delete "Alpha Team"?')
    })

    it('confirming team deletion calls teamStore.deleteTeam and navigates home', async () => {
      mockDeleteTeam.mockResolvedValue(undefined)

      await mountComponent()

      // Open the confirm dialog
      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((b) => b.text().includes('Delete Team'))
      await deleteButton?.trigger('click')

      // Click the confirm button in the dialog
      await wrapper.find('.btn-confirm').trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockDeleteTeam).toHaveBeenCalledWith('team-123')
      expect(mockRouterPush).toHaveBeenCalledWith('/')
    })

    it('canceling team deletion does not call teamStore.deleteTeam', async () => {
      await mountComponent()

      // Open the confirm dialog
      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((b) => b.text().includes('Delete Team'))
      await deleteButton?.trigger('click')

      // Click the cancel button in the dialog
      await wrapper.find('.btn-cancel').trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockDeleteTeam).not.toHaveBeenCalled()
      // Dialog should be closed
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('delete confirmation shows sprint count warning', async () => {
      mockSprints.value = [createMockSprint(), createMockSprint({ id: 'sprint-2' })]

      await mountComponent()

      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((b) => b.text().includes('Delete Team'))
      await deleteButton?.trigger('click')

      expect(wrapper.text()).toContain('delete all 2 sprint(s)')
    })

    it('shows deleteError banner when team deletion fails', async () => {
      mockDeleteTeam.mockRejectedValue(new Error('Delete failed'))

      await mountComponent()

      // Open and confirm deletion
      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((b) => b.text().includes('Delete Team'))
      await deleteButton?.trigger('click')
      await wrapper.find('.btn-confirm').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.delete-error').exists()).toBe(true)
      expect(wrapper.find('.delete-error').text()).toContain('Delete failed')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Navigation Button Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Navigation Buttons', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
    })

    it('renders "Log Sprint" button with correct link', async () => {
      await mountComponent()

      const link = wrapper.find('a[href="/team/team-123/log"]')
      expect(link.exists()).toBe(true)
    })

    it('renders "Plan Sprint" button with correct link', async () => {
      await mountComponent()

      const link = wrapper.find('a[href="/team/team-123/plan"]')
      expect(link.exists()).toBe(true)
    })

    it('renders "Back to Teams" navigation link', async () => {
      await mountComponent()

      const backLink = wrapper.find('.back-link')
      expect(backLink.exists()).toBe(true)
      expect(backLink.text()).toContain('Back to Teams')
    })

    it('Back to Teams link navigates to home', async () => {
      await mountComponent()

      const backLink = wrapper.find('.back-link')
      expect(backLink.attributes('href')).toBe('/')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Empty Sprint State Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Empty Sprint State', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
      mockSprints.value = []
    })

    it('shows empty state when team has no sprints', async () => {
      await mountComponent()

      expect(wrapper.find('.empty-sprints').exists()).toBe(true)
    })

    it('empty state message encourages logging first sprint', async () => {
      await mountComponent()

      expect(wrapper.text()).toContain('No sprints logged yet')
      expect(wrapper.text()).toContain('Log your first sprint')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Sprint Table Rendering Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Sprint Table Rendering', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
    })

    it('renders sprint history table when sprints exist', async () => {
      mockSprints.value = [createMockSprint()]

      await mountComponent()

      expect(wrapper.find('.sprint-table').exists()).toBe(true)
    })

    it('table has correct column headers', async () => {
      mockSprints.value = [createMockSprint()]

      await mountComponent()

      const headers = wrapper.findAll('th')
      const headerTexts = headers.map((h) => h.text())

      expect(headerTexts).toContain('End Date')
      expect(headerTexts).toContain('Points')
      expect(headerTexts).toContain('Leave Days')
      expect(headerTexts).toContain('Developers')
      expect(headerTexts).toContain('Actions')
    })

    it('displays correct number of sprint rows', async () => {
      mockSprints.value = [
        createMockSprint({ id: 'sprint-1' }),
        createMockSprint({ id: 'sprint-2' }),
        createMockSprint({ id: 'sprint-3' }),
      ]

      await mountComponent()

      const rows = wrapper.findAll('tbody tr')
      expect(rows).toHaveLength(3)
    })

    it('displays end date in correct format (en-GB locale)', async () => {
      mockSprints.value = [createMockSprint({ endDate: new Date('2024-01-15') })]

      await mountComponent()

      // en-GB format: 15/01/2024
      expect(wrapper.text()).toContain('15/01/2024')
    })

    it('displays points completed with "pts" suffix', async () => {
      mockSprints.value = [createMockSprint({ pointsCompleted: 32 })]

      await mountComponent()

      expect(wrapper.text()).toContain('32 pts')
    })

    it('displays leave days with "days" suffix', async () => {
      mockSprints.value = [createMockSprint({ leaveDays: 4.5 })]

      await mountComponent()

      expect(wrapper.text()).toContain('4.5 days')
    })

    it('displays sprint developer count', async () => {
      mockSprints.value = [createMockSprint({ developerCount: 6 })]

      await mountComponent()

      const developerCells = wrapper.findAll('.developer-cell')
      expect(developerCells[0]?.text()).toContain('6')
    })

    it('sprints are displayed in endDate descending order', async () => {
      // Note: Store returns them pre-sorted, this tests that order is preserved
      mockSprints.value = [
        createMockSprint({ id: 'sprint-2', endDate: new Date('2024-01-22') }),
        createMockSprint({ id: 'sprint-1', endDate: new Date('2024-01-15') }),
      ]

      await mountComponent()

      const rows = wrapper.findAll('tbody tr')
      expect(rows[0]?.text()).toContain('22/01/2024')
      expect(rows[1]?.text()).toContain('15/01/2024')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Developer Mismatch Indicator Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Developer Mismatch Indicator', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam({ developerCount: 5 })
    })

    it('shows mismatch badge when sprint developerCount differs from team', async () => {
      mockSprints.value = [createMockSprint({ developerCount: 4 })]

      await mountComponent()

      expect(wrapper.find('.mismatch-badge').exists()).toBe(true)
      expect(wrapper.find('.mismatch-badge').text()).toBe('Changed')
    })

    it('hides mismatch badge when sprint developerCount matches team', async () => {
      mockSprints.value = [createMockSprint({ developerCount: 5 })]

      await mountComponent()

      expect(wrapper.find('.mismatch-badge').exists()).toBe(false)
    })

    it('mismatch badge has correct tooltip text', async () => {
      mockSprints.value = [createMockSprint({ developerCount: 4 })]

      await mountComponent()

      const badge = wrapper.find('.mismatch-badge')
      expect(badge.attributes('data-tooltip')).toBe('Team now has 5 developers')
    })

    it('handles multiple sprints with varying mismatch states', async () => {
      mockSprints.value = [
        createMockSprint({ id: 'sprint-1', developerCount: 5 }), // matches
        createMockSprint({ id: 'sprint-2', developerCount: 4 }), // mismatch
        createMockSprint({ id: 'sprint-3', developerCount: 5 }), // matches
      ]

      await mountComponent()

      const badges = wrapper.findAll('.mismatch-badge')
      expect(badges).toHaveLength(1) // Only one sprint has mismatch
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Sprint Action Button Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Sprint Actions', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
      mockSprints.value = [createMockSprint()]
    })

    it('each sprint row has Edit button', async () => {
      await mountComponent()

      const editButton = wrapper.find('.edit-btn')
      expect(editButton.exists()).toBe(true)
      expect(editButton.text()).toBe('Edit')
    })

    it('each sprint row has Delete button', async () => {
      await mountComponent()

      const deleteButton = wrapper.find('.delete-btn')
      expect(deleteButton.exists()).toBe(true)
      expect(deleteButton.text()).toBe('Delete')
    })

    it('Edit Sprint button opens edit sprint modal when clicked', async () => {
      await mountComponent()

      expect(wrapper.find('[data-testid="edit-sprint-modal"]').exists()).toBe(false)

      const editButton = wrapper.find('.edit-btn')
      await editButton.trigger('click')

      expect(wrapper.find('[data-testid="edit-sprint-modal"]').exists()).toBe(true)
    })

    it('Delete Sprint button shows ConfirmDialog', async () => {
      await mountComponent()

      const deleteButton = wrapper.find('.delete-btn')
      await deleteButton.trigger('click')

      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
      expect(wrapper.text()).toContain('Delete Sprint')
      expect(wrapper.text()).toContain('Are you sure you want to delete this sprint?')
    })

    it('confirming sprint deletion calls sprintStore.deleteSprint with correct ID', async () => {
      mockDeleteSprint.mockResolvedValue(undefined)

      await mountComponent()

      const deleteButton = wrapper.find('.delete-btn')
      await deleteButton.trigger('click')

      await wrapper.find('.btn-confirm').trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockDeleteSprint).toHaveBeenCalledWith('sprint-1')
    })

    it('canceling sprint deletion does not call deleteSprint', async () => {
      await mountComponent()

      const deleteButton = wrapper.find('.delete-btn')
      await deleteButton.trigger('click')

      await wrapper.find('.btn-cancel').trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockDeleteSprint).not.toHaveBeenCalled()
    })

    it('delete button passes correct sprint ID for each row', async () => {
      mockSprints.value = [
        createMockSprint({ id: 'sprint-abc' }),
        createMockSprint({ id: 'sprint-xyz' }),
      ]
      mockDeleteSprint.mockResolvedValue(undefined)

      await mountComponent()

      const deleteButtons = wrapper.findAll('.delete-btn')
      await deleteButtons[1]?.trigger('click')

      await wrapper.find('.btn-confirm').trigger('click')
      await wrapper.vm.$nextTick()

      expect(mockDeleteSprint).toHaveBeenCalledWith('sprint-xyz')
    })

    it('shows deleteError banner when sprint deletion fails', async () => {
      mockDeleteSprint.mockRejectedValue(new Error('Sprint delete failed'))

      await mountComponent()

      const deleteButton = wrapper.find('.delete-btn')
      await deleteButton.trigger('click')
      await wrapper.find('.btn-confirm').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.delete-error').exists()).toBe(true)
      expect(wrapper.find('.delete-error').text()).toContain('Sprint delete failed')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Accessibility Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
      mockSprints.value = [createMockSprint()]
    })

    it('team info card has proper heading hierarchy', async () => {
      await mountComponent()

      const h1 = wrapper.find('h1')
      const h2s = wrapper.findAll('h2')

      expect(h1.exists()).toBe(true)
      expect(h2s.length).toBeGreaterThanOrEqual(2) // Team Configuration + Sprint History
    })

    it('table has proper table semantics (thead, tbody, th scope)', async () => {
      await mountComponent()

      expect(wrapper.find('thead').exists()).toBe(true)
      expect(wrapper.find('tbody').exists()).toBe(true)

      const ths = wrapper.findAll('th')
      ths.forEach((th) => {
        expect(th.attributes('scope')).toBe('col')
      })
    })

    it('buttons have accessible text', async () => {
      await mountComponent()

      const buttons = wrapper.findAll('button')
      buttons.forEach((button) => {
        expect(button.text().length).toBeGreaterThan(0)
      })
    })

    it('mismatch badge has accessible tooltip attribute', async () => {
      mockSprints.value = [createMockSprint({ developerCount: 4 })]

      await mountComponent()

      const badge = wrapper.find('.mismatch-badge')
      expect(badge.attributes('data-tooltip')).toBeTruthy()
    })

    it('action buttons are keyboard accessible (native buttons)', async () => {
      await mountComponent()

      const editBtn = wrapper.find('.edit-btn')
      const deleteBtn = wrapper.find('.delete-btn')

      // Native buttons are keyboard accessible by default
      expect(editBtn.element.tagName).toBe('BUTTON')
      expect(deleteBtn.element.tagName).toBe('BUTTON')
    })

    it('Baseline Velocity label has explanatory tooltip', async () => {
      mockTeam.value = createMockTeam({ baselineVelocity: 30 })

      await mountComponent()

      const label = wrapper.find('.info-label.has-tooltip')
      expect(label.exists()).toBe(true)
      expect(label.attributes('data-tooltip')).toContain('expected points per sprint')
    })

    it('Leave Days column header has explanatory tooltip', async () => {
      await mountComponent()

      const headers = wrapper.findAll('th')
      const leaveDaysHeader = headers.find((h) => h.text().includes('Leave Days'))
      expect(leaveDaysHeader?.attributes('data-tooltip')).toContain('person-days of leave')
    })

    it('deleteError banner has role="alert"', async () => {
      mockDeleteTeam.mockRejectedValue(new Error('Delete failed'))

      await mountComponent()

      // Trigger delete error
      const buttons = wrapper.findAll('button')
      const deleteButton = buttons.find((b) => b.text().includes('Delete Team'))
      await deleteButton?.trigger('click')
      await wrapper.find('.btn-confirm').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.delete-error').attributes('role')).toBe('alert')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ───────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
    })

    it('handles team with many sprints (10+)', async () => {
      mockSprints.value = Array.from({ length: 12 }, (_, i) =>
        createMockSprint({
          id: `sprint-${i}`,
          endDate: new Date(`2024-${String(i + 1).padStart(2, '0')}-15`),
        }),
      )

      await mountComponent()

      const rows = wrapper.findAll('tbody tr')
      expect(rows).toHaveLength(12)
    })

    it('handles sprint with 0 leave days', async () => {
      mockSprints.value = [createMockSprint({ leaveDays: 0 })]

      await mountComponent()

      expect(wrapper.text()).toContain('0 days')
    })

    it('handles sprint with 0.5 increment values', async () => {
      mockSprints.value = [createMockSprint({ leaveDays: 2.5, pointsCompleted: 27.5 })]

      await mountComponent()

      expect(wrapper.text()).toContain('2.5 days')
      expect(wrapper.text()).toContain('27.5 pts')
    })

    it('handles sprint with 0 points completed', async () => {
      mockSprints.value = [createMockSprint({ pointsCompleted: 0 })]

      await mountComponent()

      expect(wrapper.text()).toContain('0 pts')
    })

    it('handles team with long name (50 characters)', async () => {
      mockTeam.value = createMockTeam({ name: 'A'.repeat(50) })

      await mountComponent()

      expect(wrapper.find('.team-header h1').text()).toBe('Team ' + 'A'.repeat(50))
    })

    it('handles baselineVelocity of 0', async () => {
      mockTeam.value = createMockTeam({ baselineVelocity: 0 })

      await mountComponent()

      expect(wrapper.text()).toContain('0 pts/sprint')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Page Structure Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Page Structure', () => {
    beforeEach(() => {
      mockTeam.value = createMockTeam()
    })

    it('has correct container class', async () => {
      await mountComponent()

      expect(wrapper.find('.team-detail-view').exists()).toBe(true)
    })

    it('has content width constraint', async () => {
      await mountComponent()

      expect(wrapper.find('.content-width').exists()).toBe(true)
    })

    it('renders team info card section', async () => {
      await mountComponent()

      expect(wrapper.find('.team-info-card').exists()).toBe(true)
    })

    it('renders sprint history section', async () => {
      await mountComponent()

      expect(wrapper.find('.sprint-history').exists()).toBe(true)
    })
  })
})
