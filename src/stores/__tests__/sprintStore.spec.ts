import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'

// Mock VueFire before importing the store
vi.mock('vuefire', () => ({
  useCollection: vi.fn(),
}))

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'sprints' })),
  doc: vi.fn((db, collectionName, id) => ({ id, path: `${collectionName}/${id}` })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}))

// Mock the Firebase config
vi.mock('@/firebase/config', () => ({
  db: { type: 'mock-firestore' },
}))

// Import after mocks are set up
import { useSprintStore } from '../sprintStore'
import { useCollection } from 'vuefire'
import { addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'

describe('sprintStore', () => {
  // Mock sprint data that simulates Firestore documents
  // Note: endDate uses toMillis() for sorting, so we mock that method
  const mockSprints = [
    {
      id: 'sprint-1',
      teamId: 'team-1',
      endDate: { toMillis: () => new Date('2024-01-28').getTime() },
      pointsCompleted: 32,
      leaveDays: 2,
      sprintLengthDays: 14,
      developerCount: 4,
      createdAt: { toDate: () => new Date('2024-01-28') },
    },
    {
      id: 'sprint-2',
      teamId: 'team-1',
      endDate: { toMillis: () => new Date('2024-01-14').getTime() },
      pointsCompleted: 28,
      leaveDays: 0,
      sprintLengthDays: 14,
      developerCount: 4,
      createdAt: { toDate: () => new Date('2024-01-14') },
    },
    {
      id: 'sprint-3',
      teamId: 'team-2',
      endDate: { toMillis: () => new Date('2024-01-21').getTime() },
      pointsCompleted: 20,
      leaveDays: 3,
      sprintLengthDays: 7,
      developerCount: 3,
      createdAt: { toDate: () => new Date('2024-01-21') },
    },
  ]

  beforeEach(() => {
    // Create a fresh Pinia instance for each test
    setActivePinia(createPinia())

    // Clear all mocks between tests
    vi.clearAllMocks()

    // Setup default useCollection mock - returns reactive refs
    ;(useCollection as Mock).mockReturnValue({
      data: ref(mockSprints),
      pending: ref(false),
      error: ref(undefined),
      promise: ref(Promise.resolve()),
    })
  })

  describe('state', () => {
    it('should expose sprints from useCollection', () => {
      const store = useSprintStore()

      expect(store.sprints).toHaveLength(3)
      expect(store.sprints[0]!.id).toBe('sprint-1')
      expect(store.sprints[0]!.pointsCompleted).toBe(32)
    })

    it('should expose isLoading as false when data is loaded', () => {
      const store = useSprintStore()

      expect(store.isLoading).toBe(false)
    })

    it('should expose isLoading as true while fetching', () => {
      ;(useCollection as Mock).mockReturnValue({
        data: ref([]),
        pending: ref(true),
        error: ref(undefined),
        promise: ref(new Promise(() => {})),
      })

      const store = useSprintStore()

      expect(store.isLoading).toBe(true)
    })

    it('should expose error when subscription fails', () => {
      const mockError = new Error('Firestore connection failed')
      ;(useCollection as Mock).mockReturnValue({
        data: ref([]),
        pending: ref(false),
        error: ref(mockError),
        promise: ref(Promise.resolve()),
      })

      const store = useSprintStore()

      expect(store.error).toBe(mockError)
    })
  })

  describe('getSprintById', () => {
    it('should return sprint when found', () => {
      const store = useSprintStore()

      const sprint = store.getSprintById('sprint-1')

      expect(sprint).toBeDefined()
      expect(sprint?.pointsCompleted).toBe(32)
      expect(sprint?.teamId).toBe('team-1')
    })

    it('should return undefined when sprint not found', () => {
      const store = useSprintStore()

      const sprint = store.getSprintById('nonexistent-id')

      expect(sprint).toBeUndefined()
    })
  })

  describe('getSprintsForTeam', () => {
    it('should return sprints filtered by teamId', () => {
      const store = useSprintStore()

      const team1Sprints = store.getSprintsForTeam('team-1')

      expect(team1Sprints).toHaveLength(2)
      expect(team1Sprints.every((s) => s.teamId === 'team-1')).toBe(true)
    })

    it('should return empty array when no sprints for team', () => {
      const store = useSprintStore()

      const sprints = store.getSprintsForTeam('nonexistent-team')

      expect(sprints).toEqual([])
    })

    it('should sort by endDate descending (newest first)', () => {
      const store = useSprintStore()

      const sprints = store.getSprintsForTeam('team-1')

      // sprint-1 (Jan 28) should come before sprint-2 (Jan 14)
      expect(sprints[0]!.id).toBe('sprint-1')
      expect(sprints[1]!.id).toBe('sprint-2')
    })

    it('should return single sprint for team with one sprint', () => {
      const store = useSprintStore()

      const sprints = store.getSprintsForTeam('team-2')

      expect(sprints).toHaveLength(1)
      expect(sprints[0]!.id).toBe('sprint-3')
    })
  })

  describe('addSprint', () => {
    it('should call addDoc with sprint data and serverTimestamp', async () => {
      const mockDocRef = { id: 'new-sprint-id' }
      ;(addDoc as Mock).mockResolvedValue(mockDocRef)

      const store = useSprintStore()
      const newSprintData = {
        teamId: 'team-1',
        endDate: { toMillis: () => Date.now() } as unknown as Timestamp,
        pointsCompleted: 35,
        leaveDays: 1.5,
        sprintLengthDays: 14,
        developerCount: 4,
      }

      const id = await store.addSprint(newSprintData)

      expect(id).toBe('new-sprint-id')
      expect(addDoc).toHaveBeenCalledTimes(1)
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(), // collection ref
        expect.objectContaining({
          teamId: 'team-1',
          pointsCompleted: 35,
          leaveDays: 1.5,
          sprintLengthDays: 14,
          developerCount: 4,
          createdAt: { _serverTimestamp: true },
        }),
      )
    })

    it('should preserve endDate Timestamp when adding', async () => {
      const mockDocRef = { id: 'new-sprint-id' }
      ;(addDoc as Mock).mockResolvedValue(mockDocRef)
      const mockEndDate = { toMillis: () => Date.now() } as unknown as Timestamp

      const store = useSprintStore()
      const newSprintData = {
        teamId: 'team-1',
        endDate: mockEndDate,
        pointsCompleted: 20,
        leaveDays: 0,
        sprintLengthDays: 7,
        developerCount: 3,
      }

      await store.addSprint(newSprintData)

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          endDate: mockEndDate,
        }),
      )
    })
  })

  describe('updateSprint', () => {
    it('should call updateDoc with partial sprint data', async () => {
      ;(updateDoc as Mock).mockResolvedValue(undefined)

      const store = useSprintStore()

      await store.updateSprint('sprint-1', { pointsCompleted: 40 })

      expect(updateDoc).toHaveBeenCalledTimes(1)
      expect(updateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sprint-1' }), // doc ref
        { pointsCompleted: 40 },
      )
    })

    it('should allow updating multiple fields at once', async () => {
      ;(updateDoc as Mock).mockResolvedValue(undefined)

      const store = useSprintStore()

      await store.updateSprint('sprint-1', {
        pointsCompleted: 38,
        leaveDays: 3,
      })

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        {
          pointsCompleted: 38,
          leaveDays: 3,
        },
      )
    })

    it('should create correct document reference', async () => {
      ;(updateDoc as Mock).mockResolvedValue(undefined)

      const store = useSprintStore()

      await store.updateSprint('sprint-123', { leaveDays: 5 })

      expect(doc).toHaveBeenCalledWith(
        expect.anything(), // db
        'sprints',
        'sprint-123',
      )
    })
  })

  describe('deleteSprint', () => {
    it('should call deleteDoc with correct document reference', async () => {
      ;(deleteDoc as Mock).mockResolvedValue(undefined)

      const store = useSprintStore()

      await store.deleteSprint('sprint-1')

      expect(deleteDoc).toHaveBeenCalledTimes(1)
      expect(deleteDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sprint-1' }),
      )
    })

    it('should create correct document reference for deletion', async () => {
      ;(deleteDoc as Mock).mockResolvedValue(undefined)

      const store = useSprintStore()

      await store.deleteSprint('sprint-xyz')

      expect(doc).toHaveBeenCalledWith(
        expect.anything(), // db
        'sprints',
        'sprint-xyz',
      )
    })
  })
})
