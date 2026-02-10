<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useTeamStore } from '@/stores/teamStore'
import { useSprintStore } from '@/stores/sprintStore'
import EditTeamModal from '@/components/EditTeamModal.vue'
import EditSprintModal from '@/components/EditSprintModal.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Sprint } from '@/types'
import type { Timestamp } from 'firebase/firestore'

// ─────────────────────────────────────────────────────────────────────────────
// Route & Store Setup
// ─────────────────────────────────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const sprintStore = useSprintStore()

// ─────────────────────────────────────────────────────────────────────────────
// Computed State
// ─────────────────────────────────────────────────────────────────────────────
const teamId = computed(() => route.params.id as string)
const team = computed(() => teamStore.getTeamById(teamId.value))
const sprints = computed(() => sprintStore.getSprintsForTeam(teamId.value))
const isLoading = computed(() => teamStore.isLoading || sprintStore.isLoading)
const storeError = computed(() => teamStore.error || sprintStore.error)

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a Firestore Timestamp to a human-readable date string.
 * Uses en-GB locale for DD/MM/YYYY format.
 */
function formatDate(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Checks if a sprint's developer count differs from the current team configuration.
 * This can happen when the team settings change after sprints were logged.
 */
function hasDeveloperMismatch(sprint: Sprint): boolean {
  return team.value ? sprint.developerCount !== team.value.developerCount : false
}

// ─────────────────────────────────────────────────────────────────────────────
// Team Actions
// ─────────────────────────────────────────────────────────────────────────────

const showEditModal = ref(false)
const showEditSprintModal = ref(false)
const editingSprint = ref<Sprint | null>(null)

/**
 * Opens the edit team modal.
 */
function handleEditTeam(): void {
  showEditModal.value = true
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation Dialog State
// ─────────────────────────────────────────────────────────────────────────────

const confirmAction = ref<'delete-team' | 'delete-sprint' | null>(null)
const pendingSprintId = ref<string | null>(null)
const deleteError = ref<string | null>(null)

const confirmDialogTitle = computed(() => {
  if (confirmAction.value === 'delete-team') return 'Delete Team'
  if (confirmAction.value === 'delete-sprint') return 'Delete Sprint'
  return ''
})

const confirmDialogMessage = computed(() => {
  if (confirmAction.value === 'delete-team') {
    const sprintCount = sprints.value.length
    const sprintWarning =
      sprintCount > 0 ? ` This will also delete all ${sprintCount} sprint(s).` : ''
    return `Are you sure you want to delete "${team.value?.name}"?${sprintWarning} This action cannot be undone.`
  }
  if (confirmAction.value === 'delete-sprint') {
    return 'Are you sure you want to delete this sprint? This action cannot be undone.'
  }
  return ''
})

/**
 * Requests confirmation before deleting the team.
 */
function handleDeleteTeam(): void {
  if (!team.value) return
  confirmAction.value = 'delete-team'
}

/**
 * Executes the confirmed delete action with error handling.
 */
async function handleConfirmAction(): Promise<void> {
  deleteError.value = null

  try {
    if (confirmAction.value === 'delete-team') {
      await teamStore.deleteTeam(teamId.value)
      router.push('/')
    } else if (confirmAction.value === 'delete-sprint' && pendingSprintId.value) {
      await sprintStore.deleteSprint(pendingSprintId.value)
    }
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : 'An unexpected error occurred'
  } finally {
    confirmAction.value = null
    pendingSprintId.value = null
  }
}

/**
 * Cancels the pending confirmation dialog.
 */
function handleCancelAction(): void {
  confirmAction.value = null
  pendingSprintId.value = null
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprint Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens the edit sprint modal for the given sprint.
 */
function handleEditSprint(sprintId: string): void {
  editingSprint.value = sprintStore.getSprintById(sprintId) ?? null
  showEditSprintModal.value = true
}

function handleCloseEditSprint(): void {
  showEditSprintModal.value = false
  editingSprint.value = null
}

/**
 * Requests confirmation before deleting a sprint.
 */
function handleDeleteSprint(sprintId: string): void {
  confirmAction.value = 'delete-sprint'
  pendingSprintId.value = sprintId
}
</script>

<template>
  <div class="team-detail-view">
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

    <!-- Team Not Found State -->
    <div v-else-if="!team" class="not-found content-width">
      <h1>Team Not Found</h1>
      <p>The team you're looking for doesn't exist or has been deleted.</p>
      <RouterLink to="/">
        <f-button text="Back to Teams" type="primary" />
      </RouterLink>
    </div>

    <!-- Team Detail Content -->
    <div v-else class="team-content content-width">
      <!-- Delete Error Banner -->
      <div v-if="deleteError" class="delete-error" role="alert">
        {{ deleteError }}
      </div>

      <!-- Header Section -->
      <header class="team-header">
        <div class="header-left">
          <RouterLink to="/" class="back-link"> ← Back to Teams </RouterLink>
          <h1>Team {{ team.name }}</h1>
        </div>
        <div class="header-actions">
          <f-button text="Edit Team" type="secondary" @click="handleEditTeam" />
          <button class="btn-delete-team" @click="handleDeleteTeam">Delete Team</button>
        </div>
      </header>

      <!-- Team Info Card -->
      <section class="team-info-card">
        <h2>Team Configuration</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Total Members</span>
            <span class="info-value">{{ team.memberCount }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Developers</span>
            <span class="info-value">{{ team.developerCount }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Sprint Length</span>
            <span class="info-value">{{ team.sprintLengthDays }} days</span>
          </div>
          <div v-if="team.baselineVelocity !== undefined" class="info-item">
            <span
              class="info-label has-tooltip"
              data-tooltip="Your team's expected points per sprint. Used as a data point in velocity averaging when fewer than 5 sprints are logged."
            >Baseline Velocity</span>
            <span class="info-value">{{ team.baselineVelocity }} pts/sprint</span>
          </div>
        </div>
      </section>

      <!-- Action Buttons -->
      <section class="action-buttons">
        <RouterLink :to="`/team/${teamId}/log`">
          <f-button text="Log Sprint" type="primary" />
        </RouterLink>
        <RouterLink :to="`/team/${teamId}/plan`">
          <f-button text="Plan Sprint" type="secondary" />
        </RouterLink>
      </section>

      <!-- Sprint History Section -->
      <section class="sprint-history">
        <h2>Sprint History</h2>

        <!-- Empty Sprint State -->
        <div v-if="sprints.length === 0" class="empty-sprints">
          <p>No sprints logged yet.</p>
          <p>Log your first sprint to start tracking velocity.</p>
        </div>

        <!-- Sprint Table -->
        <table v-else class="sprint-table">
          <thead>
            <tr>
              <th scope="col">End Date</th>
              <th scope="col" class="text-right">Points</th>
              <th scope="col" class="text-right has-tooltip" data-tooltip="Total person-days of leave across all developers for this sprint.">Leave Days</th>
              <th scope="col" class="text-right">Developers</th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sprint in sprints" :key="sprint.id">
              <td>{{ formatDate(sprint.endDate) }}</td>
              <td class="text-right">{{ sprint.pointsCompleted }} pts</td>
              <td class="text-right">{{ sprint.leaveDays }} days</td>
              <td class="text-right developer-cell">
                {{ sprint.developerCount }}
                <span
                  v-if="hasDeveloperMismatch(sprint)"
                  class="mismatch-badge"
                  :title="`Team now has ${team.developerCount} developers`"
                >
                  Changed
                </span>
              </td>
              <td class="text-right actions-cell">
                <button class="action-btn edit-btn" @click="handleEditSprint(sprint.id)">
                  Edit
                </button>
                <button class="action-btn delete-btn" @click="handleDeleteSprint(sprint.id)">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- Edit Team Modal -->
    <EditTeamModal v-if="showEditModal && team" :team="team" @close="showEditModal = false" />

    <!-- Edit Sprint Modal -->
    <EditSprintModal
      v-if="showEditSprintModal && editingSprint"
      :sprint="editingSprint"
      @close="handleCloseEditSprint"
    />

    <!-- Confirmation Dialog -->
    <ConfirmDialog
      v-if="confirmAction"
      :title="confirmDialogTitle"
      :message="confirmDialogMessage"
      confirm-text="Delete"
      :destructive="true"
      @confirm="handleConfirmAction"
      @cancel="handleCancelAction"
    />
  </div>
</template>

<style scoped>
.team-detail-view {
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

/* Loading State */
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

/* Not Found State */
.not-found {
  text-align: center;
  padding: 3rem 1rem;
}

.not-found h1 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  color: var(--f-text-primary, #333);
}

.not-found p {
  margin-bottom: 1.5rem;
  color: var(--f-text-secondary, #666);
}

/* Header */
.team-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 1rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--f-text-primary, #333);
  text-decoration: none;
  padding: 0.5rem 1rem;
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 9999px;
  background: var(--f-background-primary, #fff);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.back-link:hover {
  background: var(--f-background-secondary, #f5f5f5);
  border-color: var(--f-text-secondary, #666);
  text-decoration: none;
}

.team-header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

/* Team Info Card */
.team-info-card {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.team-info-card h2 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--f-text-secondary, #666);
}

.info-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

/* Sprint History */
.sprint-history {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 1.5rem;
}

.sprint-history h2 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

/* Empty Sprint State */
.empty-sprints {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--f-text-secondary, #666);
}

.empty-sprints p {
  margin: 0 0 0.5rem 0;
}

.empty-sprints p:last-child {
  margin-bottom: 0;
}

/* Sprint Table */
.sprint-table {
  width: 100%;
  border-collapse: collapse;
}

.sprint-table th,
.sprint-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--f-border-color, #e0e0e0);
}

.sprint-table th {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--f-text-secondary, #666);
  background: var(--f-background-secondary, #f5f5f5);
}

.sprint-table tbody tr:hover {
  background: var(--f-background-secondary, #f5f5f5);
}

.sprint-table tbody tr:last-child td {
  border-bottom: none;
}

.text-right {
  text-align: right;
}

/* Developer Cell with Mismatch Badge */
.developer-cell {
  white-space: nowrap;
}

.mismatch-badge {
  margin-left: 0.5rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  background: var(--f-warning-background, #fef3c7);
  color: var(--f-warning-color, #92400e);
  border-radius: 4px;
  cursor: help;
}

/* Actions Cell */
.actions-cell {
  white-space: nowrap;
}

.action-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.edit-btn {
  background: var(--f-background-secondary, #f5f5f5);
  color: var(--f-text-primary, #333);
  margin-right: 0.5rem;
}

.edit-btn:hover {
  background: var(--f-border-color, #e0e0e0);
}

.delete-btn {
  background: transparent;
  color: var(--f-danger, #dc2626);
}

.delete-btn:hover {
  background: rgba(220, 38, 38, 0.1);
}

/* Error Container (store-level errors) */
.error-container {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.error-card {
  text-align: center;
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
}

.error-card h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

.error-card p {
  margin: 0 0 0.5rem 0;
  color: var(--f-text-primary, #333);
}

.error-hint {
  color: var(--f-text-secondary, #666) !important;
  font-size: 0.875rem;
}

/* Delete Team Button */
.btn-delete-team {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--f-error-color, #dc2626);
  background: transparent;
  border: 1px solid var(--f-error-color, #dc2626);
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.btn-delete-team:hover {
  background: var(--f-error-color, #dc2626);
  color: #fff;
}

/* Tooltip Styling */
.has-tooltip {
  cursor: help;
  border-bottom: 1px dotted currentColor;
  position: relative;
}

.has-tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 0.75rem;
  background: var(--f-text-primary, #333);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
  width: max-content;
  max-width: 260px;
  border-radius: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.1s ease;
  z-index: 100;
}

.has-tooltip:hover::after {
  opacity: 1;
}

/* Delete Error Banner */
.delete-error {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid var(--f-error-color, #dc2626);
  border-radius: 4px;
  color: var(--f-error-color, #dc2626);
  font-size: 0.875rem;
}
</style>
