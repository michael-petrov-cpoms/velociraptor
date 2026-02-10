import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'

// Mock VueFire before importing the store
vi.mock('vuefire', () => ({
  useCollection: vi.fn(),
}))

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'teams' })),
  doc: vi.fn((db, collectionName, id) => ({ id, path: `${collectionName}/${id}` })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  writeBatch: vi.fn(),
}))

// Mock the Firebase config
vi.mock('@/firebase/config', () => ({
  db: { type: 'mock-firestore' },
}))

// Import after mocks are set up
import { useTeamStore } from '../teamStore'
import { useCollection } from 'vuefire'
import { addDoc, updateDoc, getDocs, writeBatch, doc } from 'firebase/firestore'

describe('teamStore', () => {
  // Mock team data that simulates Firestore documents
  const mockTeams = [
    {
      id: 'team-1',
      name: 'Alpha Team',
      memberCount: 5,
      developerCount: 4,
      sprintLengthDays: 14,
      createdAt: { toDate: () => new Date('2024-01-15') },
    },
    {
      id: 'team-2',
      name: 'Beta Team',
      memberCount: 3,
      developerCount: 3,
      sprintLengthDays: 7,
      baselineVelocity: 20,
      createdAt: { toDate: () => new Date('2024-01-10') },
    },
  ]

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia())

    // Clear all mocks between tests
    vi.clearAllMocks()

    // Setup default useCollection mock - returns reactive refs
    ;(useCollection as Mock).mockReturnValue({
      data: ref(mockTeams),
      pending: ref(false),
      error: ref(undefined),
      promise: ref(Promise.resolve()),
    })
  })

  describe('state', () => {
    it('should expose teams from useCollection', () => {
      const store = useTeamStore()

      expect(store.teams).toHaveLength(2)
      // Non-null assertions are safe here because we control the mock data
      expect(store.teams[0]!.name).toBe('Alpha Team')
      expect(store.teams[1]!.name).toBe('Beta Team')
    })

    it('should expose isLoading as false when data is loaded', () => {
      const store = useTeamStore()

      expect(store.isLoading).toBe(false)
    })

    it('should expose isLoading as true while fetching', () => {
      ;(useCollection as Mock).mockReturnValue({
        data: ref([]),
        pending: ref(true),
        error: ref(undefined),
        promise: ref(new Promise(() => {})),
      })

      const store = useTeamStore()

      expect(store.isLoading).toBe(true)
    })

    it('should expose error when subscription fails', () => {
      const mockError = new Error('Firestore connection failed')
      ;(useCollection as Mock).mockReturnValue({
        data: ref([]),
        pending: ref(false),
        error: ref(mockError),
        // Use resolved promise to avoid unhandled rejection warning
        // The error ref is what matters for this test, not the promise
        promise: ref(Promise.resolve()),
      })

      const store = useTeamStore()

      expect(store.error).toBe(mockError)
    })
  })

  describe('getTeamById', () => {
    it('should return team when found', () => {
      const store = useTeamStore()

      const team = store.getTeamById('team-1')

      expect(team).toBeDefined()
      expect(team?.name).toBe('Alpha Team')
      expect(team?.developerCount).toBe(4)
    })

    it('should return undefined when team not found', () => {
      const store = useTeamStore()

      const team = store.getTeamById('nonexistent-id')

      expect(team).toBeUndefined()
    })

    it('should return team with optional baselineVelocity', () => {
      const store = useTeamStore()

      const team = store.getTeamById('team-2')

      expect(team?.baselineVelocity).toBe(20)
    })
  })

  describe('addTeam', () => {
    it('should call addDoc with team data and serverTimestamp', async () => {
      const mockDocRef = { id: 'new-team-id' }
      ;(addDoc as Mock).mockResolvedValue(mockDocRef)

      const store = useTeamStore()
      const newTeamData = {
        name: 'New Team',
        memberCount: 4,
        developerCount: 3,
        sprintLengthDays: 14,
      }

      const id = await store.addTeam(newTeamData)

      expect(id).toBe('new-team-id')
      expect(addDoc).toHaveBeenCalledTimes(1)
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(), // collection ref
        expect.objectContaining({
          name: 'New Team',
          memberCount: 4,
          developerCount: 3,
          sprintLengthDays: 14,
          createdAt: { _serverTimestamp: true },
        }),
      )
    })

    it('should include optional baselineVelocity when provided', async () => {
      const mockDocRef = { id: 'new-team-id' }
      ;(addDoc as Mock).mockResolvedValue(mockDocRef)

      const store = useTeamStore()
      const newTeamData = {
        name: 'Team with Baseline',
        memberCount: 5,
        developerCount: 4,
        sprintLengthDays: 10,
        baselineVelocity: 30,
      }

      await store.addTeam(newTeamData)

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          baselineVelocity: 30,
        }),
      )
    })
  })

  describe('updateTeam', () => {
    it('should call updateDoc with partial team data', async () => {
      ;(updateDoc as Mock).mockResolvedValue(undefined)

      const store = useTeamStore()

      await store.updateTeam('team-1', { name: 'Updated Name' })

      expect(updateDoc).toHaveBeenCalledTimes(1)
      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'team-1' }), // doc ref
        { name: 'Updated Name' },
      )
    })

    it('should allow updating multiple fields at once', async () => {
      ;(updateDoc as Mock).mockResolvedValue(undefined)

      const store = useTeamStore()

      await store.updateTeam('team-1', {
        name: 'Renamed Team',
        memberCount: 10,
        developerCount: 8,
      })

      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), {
        name: 'Renamed Team',
        memberCount: 10,
        developerCount: 8,
      })
    })

    it('should create correct document reference', async () => {
      ;(updateDoc as Mock).mockResolvedValue(undefined)

      const store = useTeamStore()

      await store.updateTeam('team-123', { name: 'Test' })

      expect(doc).toHaveBeenCalledWith(
        expect.anything(), // db
        'teams',
        'team-123',
      )
    })
  })

  describe('deleteTeam', () => {
    it('should delete team and cascade delete all associated sprints', async () => {
      // Mock sprints query result - team has 2 sprints
      const mockSprintDocs = [
        { ref: { id: 'sprint-1', path: 'sprints/sprint-1' } },
        { ref: { id: 'sprint-2', path: 'sprints/sprint-2' } },
      ]
      ;(getDocs as Mock).mockResolvedValue({ docs: mockSprintDocs })

      // Mock batch operations
      const mockBatch = {
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      }
      ;(writeBatch as Mock).mockReturnValue(mockBatch)

      const store = useTeamStore()

      await store.deleteTeam('team-1')

      // Should delete 2 sprints + 1 team = 3 delete calls
      expect(mockBatch.delete).toHaveBeenCalledTimes(3)
      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
    })

    it('should delete team even when it has no sprints', async () => {
      // Mock empty sprints result
      ;(getDocs as Mock).mockResolvedValue({ docs: [] })

      const mockBatch = {
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      }
      ;(writeBatch as Mock).mockReturnValue(mockBatch)

      const store = useTeamStore()

      await store.deleteTeam('team-1')

      // Should only delete the team (no sprints)
      expect(mockBatch.delete).toHaveBeenCalledTimes(1)
      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
    })

    it('should use atomic batch operation for consistency', async () => {
      ;(getDocs as Mock).mockResolvedValue({ docs: [] })

      const mockBatch = {
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      }
      ;(writeBatch as Mock).mockReturnValue(mockBatch)

      const store = useTeamStore()

      await store.deleteTeam('team-1')

      // Verify batch is created and committed (atomic operation)
      expect(writeBatch).toHaveBeenCalled()
      expect(mockBatch.commit).toHaveBeenCalled()
    })
  })
})
