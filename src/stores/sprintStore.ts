import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useCollection } from 'vuefire'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Sprint } from '@/types'

/**
 * Sprint store with reactive Firestore binding via VueFire.
 *
 * The `sprints` ref is automatically kept in sync with Firestore.
 * Any changes to the 'sprints' collection (even from other clients)
 * will be reflected in the reactive state.
 */
export const useSprintStore = defineStore('sprints', () => {
  // Create a reference to the 'sprints' collection
  const sprintsRef = collection(db, 'sprints')

  // VueFire's useCollection sets up a real-time listener
  // and returns reactive refs for data, loading state, and errors
  const {
    data: sprints,
    pending: isLoading,
    error,
    promise: sprintsLoaded,
  } = useCollection<Sprint>(sprintsRef)

  /**
   * Find a sprint by its Firestore document ID.
   *
   * Returns a computed getter function to enable reactive lookups.
   * Usage: store.getSprintById('abc123')
   */
  const getSprintById = computed(() => {
    return (id: string): Sprint | undefined => {
      return sprints.value.find((sprint) => sprint.id === id)
    }
  })

  /**
   * Get all sprints for a specific team, sorted by endDate descending (newest first).
   *
   * This filters the globally-loaded sprints client-side. For MVP scale this is
   * efficient enough, but could be replaced with a Firestore query for larger datasets.
   *
   * Usage: store.getSprintsForTeam('team-123')
   */
  const getSprintsForTeam = computed(() => {
    return (teamId: string): Sprint[] => {
      return sprints.value
        .filter((sprint) => sprint.teamId === teamId)
        .sort((a, b) => {
          // Sort by endDate descending (newest first)
          // Firestore Timestamps have toMillis() for reliable comparison
          return b.endDate.toMillis() - a.endDate.toMillis()
        })
    }
  })

  /**
   * Add a new sprint to Firestore.
   *
   * The sprint is associated with a team via teamId. The sprintLengthDays and
   * developerCount should be snapshots from the team at the time of logging.
   *
   * @param sprintData - Sprint data without id and createdAt (auto-generated)
   * @returns The auto-generated Firestore document ID
   */
  async function addSprint(
    sprintData: Omit<Sprint, 'id' | 'createdAt'>,
  ): Promise<string> {
    const docRef = await addDoc(sprintsRef, {
      ...sprintData,
      createdAt: serverTimestamp(),
    })
    return docRef.id
  }

  /**
   * Update an existing sprint in Firestore.
   *
   * Note: teamId cannot be changed (a sprint belongs to one team).
   * The sprintLengthDays and developerCount snapshots are also preserved.
   *
   * @param id - The sprint's Firestore document ID
   * @param sprintData - Partial sprint data to update
   */
  async function updateSprint(
    id: string,
    sprintData: Partial<Omit<Sprint, 'id' | 'createdAt' | 'teamId'>>,
  ): Promise<void> {
    const sprintDocRef = doc(db, 'sprints', id)
    await updateDoc(sprintDocRef, sprintData)
  }

  /**
   * Delete a sprint from Firestore.
   *
   * @param id - The sprint's Firestore document ID
   */
  async function deleteSprint(id: string): Promise<void> {
    const sprintDocRef = doc(db, 'sprints', id)
    await deleteDoc(sprintDocRef)
  }

  return {
    // Reactive state
    sprints,
    isLoading,
    error,
    sprintsLoaded,
    // Getters
    getSprintById,
    getSprintsForTeam,
    // Actions
    addSprint,
    updateSprint,
    deleteSprint,
  }
})
