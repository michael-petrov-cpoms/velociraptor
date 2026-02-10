<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useTeamStore } from '@/stores/teamStore'
import { useSprintStore } from '@/stores/sprintStore'
import CreateTeamModal from '@/components/CreateTeamModal.vue'

const teamStore = useTeamStore()
const sprintStore = useSprintStore()

// Reactive state from stores
const teams = computed(() => teamStore.teams)
const isLoading = computed(() => teamStore.isLoading || sprintStore.isLoading)
const storeError = computed(() => teamStore.error || sprintStore.error)

// Modal state (will be used when CreateTeamModal is implemented in Step 3.2)
const showCreateModal = ref(false)

/**
 * Teams enriched with computed stats.
 * This avoids calling getSprintsForTeam multiple times per card in the template.
 *
 * Note: VueFire adds `id` as a non-enumerable property, so we must explicitly
 * copy it when spreading the team object. Otherwise, `id` would be lost.
 */
const teamsWithStats = computed(() =>
  teams.value.map((team) => {
    const sprints = sprintStore.getSprintsForTeam(team.id)
    return {
      ...team,
      id: team.id, // Explicitly copy non-enumerable id from VueFire
      stats: {
        sprintCount: sprints.length,
        lastVelocity: sprints[0]?.pointsCompleted ?? null,
      },
    }
  }),
)
</script>

<template>
  <div class="home-view">
    <header class="home-header content-width">
      <h1>Teams</h1>
      <f-button text="Create Team" type="primary" @click="showCreateModal = true" />
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container content-width">
      <f-loading-spinner />
    </div>

    <!-- Error State -->
    <div v-else-if="storeError" class="error-container content-width">
      <div class="error-card">
        <h2>Something went wrong</h2>
        <p>{{ storeError.message || 'Failed to load data' }}</p>
        <p class="error-hint">Try refreshing the page.</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="teams.length === 0" class="empty-state content-width">
      <p>No teams yet. Create your first team to get started!</p>
      <f-button text="Create Team" type="primary" @click="showCreateModal = true" />
    </div>

    <!-- Team Cards -->
    <div v-else class="team-grid content-width">
      <RouterLink
        v-for="team in teamsWithStats"
        :key="team.id"
        :to="`/team/${team.id}`"
        class="team-card"
      >
        <h2 class="team-name">{{ team.name }}</h2>
        <p class="team-developers">{{ team.developerCount }} developers</p>
        <div class="team-stats">
          <span class="stat">
            {{ team.stats.sprintCount }}
            {{ team.stats.sprintCount === 1 ? 'sprint' : 'sprints' }}
          </span>
          <span class="stat">
            <template v-if="team.stats.lastVelocity !== null">
              Last: {{ team.stats.lastVelocity }} pts
            </template>
            <template v-else> No sprints yet </template>
          </span>
        </div>
      </RouterLink>
    </div>

    <!-- Create Team Modal -->
    <CreateTeamModal v-if="showCreateModal" @close="showCreateModal = false" />
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
}

/* Shared content width constraint */
.content-width {
  width: 100%;
  max-width: 1000px;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.home-header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
}

/* Loading State */
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

/* Error State */
.error-container {
  text-align: center;
  padding: 3rem 1rem;
}

.error-card {
  display: inline-block;
  padding: 1.5rem 2rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid var(--f-error-color, #dc2626);
  border-radius: 8px;
  color: var(--f-error-color, #dc2626);
  max-width: 500px;
}

.error-card h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.error-card p {
  margin: 0 0 0.5rem 0;
}

.error-card p:last-child {
  margin-bottom: 0;
}

.error-hint {
  font-size: 0.875rem;
  opacity: 0.8;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  background: var(--f-background-secondary, #f5f5f5);
  border-radius: 8px;
}

.empty-state p {
  margin-bottom: 1.5rem;
  color: var(--f-text-secondary, #666);
}

/* Team Grid */
.team-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

/* Team Card */
.team-card {
  display: block;
  padding: 1.5rem;
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.team-card:hover {
  border-color: var(--f-primary, #0066cc);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.team-name {
  margin: 0 0 0.25rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

.team-developers {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  color: var(--f-text-secondary, #666);
}

.team-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat {
  font-size: 0.875rem;
  color: var(--f-text-secondary, #666);
}
</style>
