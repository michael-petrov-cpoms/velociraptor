import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import HomeView from '../HomeView.vue'

// Mock reactive state - these refs drive the mock stores
const mockTeams = ref<Array<{ id: string; name: string; developerCount?: number }>>([])
const mockTeamsLoading = ref(false)
const mockSprintsLoading = ref(false)
const mockTeamError = ref<Error | null>(null)
const mockSprintError = ref<Error | null>(null)
const mockGetSprintsForTeam = vi.fn()

// Mock the stores using getters to properly simulate Pinia's auto-unwrapping behavior
vi.mock('@/stores/teamStore', () => ({
  useTeamStore: () => ({
    // Pinia auto-unwraps refs, so we use getters to return .value
    get teams() {
      return mockTeams.value
    },
    get isLoading() {
      return mockTeamsLoading.value
    },
    get error() {
      return mockTeamError.value
    },
  }),
}))

vi.mock('@/stores/sprintStore', () => ({
  useSprintStore: () => ({
    get sprints() {
      return []
    },
    get isLoading() {
      return mockSprintsLoading.value
    },
    get error() {
      return mockSprintError.value
    },
    getSprintsForTeam: mockGetSprintsForTeam,
  }),
}))

// Create a minimal test router
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/team/:id', name: 'team-detail', component: { template: '<div>Team Detail</div>' } },
  ],
})

// Stub FeatherUI components
const globalStubs = {
  'f-button': {
    template: '<button @click="$emit(\'click\')"><slot>{{ text }}</slot></button>',
    props: ['text', 'type'],
  },
  'f-loading-spinner': {
    template: '<div data-testid="loading-spinner">Loading...</div>',
  },
}

describe('HomeView', () => {
  let wrapper: VueWrapper

  beforeEach(async () => {
    // Reset mocks before each test
    mockTeams.value = []
    mockTeamsLoading.value = false
    mockSprintsLoading.value = false
    mockTeamError.value = null
    mockSprintError.value = null
    mockGetSprintsForTeam.mockReset()
    mockGetSprintsForTeam.mockReturnValue([])

    // Fresh Pinia instance
    setActivePinia(createPinia())

    // Reset router
    router.push('/')
    await router.isReady()
  })

  async function mountComponent() {
    wrapper = mount(HomeView, {
      global: {
        plugins: [router],
        stubs: globalStubs,
      },
    })
    // Allow component to update
    await wrapper.vm.$nextTick()
    return wrapper
  }

  describe('Loading State', () => {
    it('shows loading spinner when teams are loading', async () => {
      mockTeamsLoading.value = true

      await mountComponent()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
      expect(wrapper.find('.team-grid').exists()).toBe(false)
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })

    it('shows loading spinner when sprints are loading', async () => {
      mockSprintsLoading.value = true

      await mountComponent()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(true)
    })

    it('hides loading spinner when data is loaded', async () => {
      mockTeamsLoading.value = false
      mockSprintsLoading.value = false
      mockTeams.value = []

      await mountComponent()

      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(false)
    })
  })

  describe('Error State', () => {
    it('shows error card when teamStore has an error', async () => {
      mockTeamError.value = new Error('Permission denied')

      await mountComponent()

      expect(wrapper.find('.error-card').exists()).toBe(true)
      expect(wrapper.text()).toContain('Something went wrong')
      expect(wrapper.text()).toContain('Permission denied')
    })

    it('shows error card when sprintStore has an error', async () => {
      mockSprintError.value = new Error('Network error')

      await mountComponent()

      expect(wrapper.find('.error-card').exists()).toBe(true)
      expect(wrapper.text()).toContain('Network error')
    })

    it('does not show error card when no errors exist', async () => {
      mockTeamError.value = null
      mockSprintError.value = null

      await mountComponent()

      expect(wrapper.find('.error-card').exists()).toBe(false)
    })

    it('error state takes priority over empty state', async () => {
      mockTeamError.value = new Error('Firestore unavailable')
      mockTeams.value = []

      await mountComponent()

      expect(wrapper.find('.error-card').exists()).toBe(true)
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })
  })

  describe('Empty State', () => {
    it('shows empty state message when no teams exist', async () => {
      mockTeams.value = []

      await mountComponent()

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('No teams yet')
    })

    it('shows Create Team button in empty state', async () => {
      mockTeams.value = []

      await mountComponent()

      const emptyState = wrapper.find('.empty-state')
      const button = emptyState.find('button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Create Team')
    })
  })

  describe('Team Cards', () => {
    const mockTeamData = [
      { id: 'team-1', name: 'Alpha Team', developerCount: 4 },
      { id: 'team-2', name: 'Beta Team', developerCount: 3 },
    ]

    it('renders team cards when teams exist', async () => {
      mockTeams.value = mockTeamData

      await mountComponent()

      expect(wrapper.find('.team-grid').exists()).toBe(true)
      expect(wrapper.findAll('.team-card')).toHaveLength(2)
    })

    it('displays team names on cards', async () => {
      mockTeams.value = mockTeamData

      await mountComponent()

      const cards = wrapper.findAll('.team-card')
      expect(cards[0].text()).toContain('Alpha Team')
      expect(cards[1].text()).toContain('Beta Team')
    })

    it('links team cards to team detail page', async () => {
      mockTeams.value = mockTeamData

      await mountComponent()

      const cards = wrapper.findAll('.team-card')
      expect(cards[0].attributes('href')).toBe('/team/team-1')
      expect(cards[1].attributes('href')).toBe('/team/team-2')
    })

    it('does not show empty state or loading when teams exist', async () => {
      mockTeams.value = mockTeamData

      await mountComponent()

      expect(wrapper.find('.empty-state').exists()).toBe(false)
      expect(wrapper.find('[data-testid="loading-spinner"]').exists()).toBe(false)
    })

    it('displays developer count on cards', async () => {
      mockTeams.value = mockTeamData

      await mountComponent()

      const cards = wrapper.findAll('.team-card')
      expect(cards[0].text()).toContain('4 developers')
      expect(cards[1].text()).toContain('3 developers')
    })
  })

  describe('Team Stats', () => {
    it('displays sprint count for a team', async () => {
      mockTeams.value = [{ id: 'team-1', name: 'Alpha Team', developerCount: 4 }]
      mockGetSprintsForTeam.mockReturnValue([
        { id: 'sprint-1', pointsCompleted: 30 },
        { id: 'sprint-2', pointsCompleted: 25 },
      ])

      await mountComponent()

      expect(wrapper.text()).toContain('2 sprints')
    })

    it('displays singular "sprint" for one sprint', async () => {
      mockTeams.value = [{ id: 'team-1', name: 'Alpha Team', developerCount: 4 }]
      mockGetSprintsForTeam.mockReturnValue([{ id: 'sprint-1', pointsCompleted: 30 }])

      await mountComponent()

      expect(wrapper.text()).toContain('1 sprint')
      expect(wrapper.text()).not.toContain('1 sprints')
    })

    it('displays "0 sprints" for team with no sprints', async () => {
      mockTeams.value = [{ id: 'team-1', name: 'Alpha Team', developerCount: 4 }]
      mockGetSprintsForTeam.mockReturnValue([])

      await mountComponent()

      expect(wrapper.text()).toContain('0 sprints')
    })

    it('displays last velocity from most recent sprint', async () => {
      mockTeams.value = [{ id: 'team-1', name: 'Alpha Team', developerCount: 4 }]
      // Sprints are returned newest first by the store
      mockGetSprintsForTeam.mockReturnValue([
        { id: 'sprint-2', pointsCompleted: 35 }, // Most recent
        { id: 'sprint-1', pointsCompleted: 30 },
      ])

      await mountComponent()

      expect(wrapper.text()).toContain('Last: 35 pts')
    })

    it('displays "No sprints yet" when team has no sprints', async () => {
      mockTeams.value = [{ id: 'team-1', name: 'Alpha Team', developerCount: 4 }]
      mockGetSprintsForTeam.mockReturnValue([])

      await mountComponent()

      expect(wrapper.text()).toContain('No sprints yet')
    })
  })

  describe('Create Team Button', () => {
    it('renders Create Team button in header', async () => {
      mockTeams.value = []

      await mountComponent()

      const header = wrapper.find('.home-header')
      const button = header.find('button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Create Team')
    })

    it('header button is present even when teams exist', async () => {
      mockTeams.value = [{ id: 'team-1', name: 'Alpha Team', developerCount: 4 }]
      mockGetSprintsForTeam.mockReturnValue([])

      await mountComponent()

      const header = wrapper.find('.home-header')
      expect(header.find('button').exists()).toBe(true)
    })
  })

  describe('Page Structure', () => {
    it('renders page title', async () => {
      await mountComponent()

      expect(wrapper.find('h1').text()).toBe('Teams')
    })

    it('has correct container class', async () => {
      await mountComponent()

      expect(wrapper.find('.home-view').exists()).toBe(true)
    })
  })
})
