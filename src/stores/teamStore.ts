import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useCollection } from 'vuefire'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Team } from '@/types'

/**
 * Team store with reactive Firestore binding via VueFire.
 *
 * The `teams` ref is automatically kept in sync with Firestore.
 * Any changes to the 'teams' collection (even from other clients)
 * will be reflected in the reactive state.
 */
export const useTeamStore = defineStore('teams', () => {
  // Create a reference to the 'teams' collection
  const teamsRef = collection(db, 'teams')

  // VueFire's useCollection sets up a real-time listener
  // and returns reactive refs for data, loading state, and errors
  const {
    data: teams,
    pending: isLoading,
    error,
    promise: teamsLoaded,
  } = useCollection<Team>(teamsRef)

  /**
   * Find a team by its Firestore document ID.
   *
   * Returns a computed getter function to enable reactive lookups.
   * Usage: store.getTeamById('abc123')
   */
  const getTeamById = computed(() => {
    return (id: string): Team | undefined => {
      return teams.value.find((team) => team.id === id)
    }
  })

  /**
   * Add a new team to Firestore.
   *
   * @param teamData - Team data without id and createdAt (auto-generated)
   * @returns The auto-generated Firestore document ID
   */
  async function addTeam(teamData: Omit<Team, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(teamsRef, {
      ...teamData,
      createdAt: serverTimestamp(),
    })
    return docRef.id
  }

  /**
   * Update an existing team in Firestore.
   *
   * @param id - The team's Firestore document ID
   * @param teamData - Partial team data to update (id and createdAt cannot be changed)
   */
  async function updateTeam(
    id: string,
    teamData: Partial<Omit<Team, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const teamDocRef = doc(db, 'teams', id)
    await updateDoc(teamDocRef, teamData)
  }

  /**
   * Delete a team and all its associated sprints.
   *
   * Uses a Firestore batch operation to ensure atomicity -
   * either all deletes succeed or none do, preventing orphaned sprints.
   *
   * @param id - The team's Firestore document ID
   */
  async function deleteTeam(id: string): Promise<void> {
    // First, find all sprints belonging to this team
    const sprintsRef = collection(db, 'sprints')
    const sprintsQuery = query(sprintsRef, where('teamId', '==', id))
    const sprintsSnapshot = await getDocs(sprintsQuery)

    // Use a batch for atomic deletion (all-or-nothing)
    const batch = writeBatch(db)

    // Queue each sprint for deletion
    sprintsSnapshot.docs.forEach((sprintDoc) => {
      batch.delete(sprintDoc.ref)
    })

    // Queue the team for deletion
    const teamDocRef = doc(db, 'teams', id)
    batch.delete(teamDocRef)

    // Execute all deletions atomically
    await batch.commit()
  }

  return {
    // Reactive state
    teams,
    isLoading,
    error,
    teamsLoaded,
    // Getters
    getTeamById,
    // Actions
    addTeam,
    updateTeam,
    deleteTeam,
  }
})
