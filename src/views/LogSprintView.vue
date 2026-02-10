<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Timestamp } from 'firebase/firestore'
import { useTeamStore } from '@/stores/teamStore'
import { useSprintStore } from '@/stores/sprintStore'

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
const isLoading = computed(() => teamStore.isLoading)
const storeError = computed(() => teamStore.error)

// ─────────────────────────────────────────────────────────────────────────────
// Form State
// ─────────────────────────────────────────────────────────────────────────────

const endDate = ref<string>('')
const pointsCompleted = ref<number | null>(null)
const leaveDays = ref<number | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Submission State
// ─────────────────────────────────────────────────────────────────────────────

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const hasAttemptedSubmit = ref(false)

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// Each computed returns null if valid, or an error message string if invalid.
// Errors only display after user has attempted to submit (hasAttemptedSubmit).
// ─────────────────────────────────────────────────────────────────────────────

const endDateError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  if (!endDate.value) return 'End date is required'
  const selected = new Date(endDate.value)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (selected > today) return 'End date cannot be in the future'
  return null
})

const pointsCompletedError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  if (pointsCompleted.value === null || pointsCompleted.value === undefined || (pointsCompleted.value as unknown) === '') {
    return 'Points completed is required'
  }
  if (pointsCompleted.value < 0) return 'Points cannot be negative'
  return null
})

const leaveDaysError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  if (leaveDays.value === null || leaveDays.value === undefined || (leaveDays.value as unknown) === '') {
    return 'Leave days is required'
  }
  if (leaveDays.value < 0) return 'Leave days cannot be negative'
  // Cross-field validation: available days must be at least 1
  if (team.value && leaveDays.value !== null && team.value.developerCount > 0) {
    const availableDays = team.value.sprintLengthDays - (leaveDays.value / team.value.developerCount)
    if (availableDays < 1) {
      return 'Leave days too high — available days must be at least 1'
    }
  }
  return null
})

/**
 * Returns true if the form has no validation errors.
 */
const isFormValid = computed(() => {
  return (
    !endDateError.value &&
    !pointsCompletedError.value &&
    !leaveDaysError.value
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle form submission.
 * Validates all fields, checks zero-point warning, then saves sprint.
 */
async function handleSubmit() {
  hasAttemptedSubmit.value = true
  submitError.value = null

  if (!isFormValid.value) return

  // Zero-point warning
  if (pointsCompleted.value === 0) {
    const confirmed = window.confirm(
      "Points completed is 0. This will lower the team's average velocity. Continue?",
    )
    if (!confirmed) return
  }

  isSubmitting.value = true

  try {
    await sprintStore.addSprint({
      teamId: teamId.value,
      endDate: Timestamp.fromDate(new Date(endDate.value)),
      pointsCompleted: pointsCompleted.value!,
      leaveDays: leaveDays.value!,
      sprintLengthDays: team.value!.sprintLengthDays,
      developerCount: team.value!.developerCount,
    })
    router.push(`/team/${teamId.value}`)
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to save sprint'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="log-sprint-view">
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

    <!-- Sprint Form Content -->
    <div v-else class="sprint-content content-width">
      <!-- Header -->
      <header class="page-header">
        <RouterLink :to="`/team/${teamId}`" class="back-link">
          &larr; Back to {{ team.name }}
        </RouterLink>
        <h1>Log Sprint</h1>
      </header>

      <!-- Team Context Card -->
      <section class="team-context-card">
        <h2>Team Context</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Team</span>
            <span class="info-value">{{ team.name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Sprint Length</span>
            <span class="info-value">{{ team.sprintLengthDays }} days</span>
          </div>
          <div class="info-item">
            <span class="info-label">Developers</span>
            <span class="info-value">{{ team.developerCount }}</span>
          </div>
        </div>
      </section>

      <!-- Sprint Form -->
      <section class="form-card">
        <form @submit.prevent="handleSubmit">
          <!-- End Date -->
          <div class="form-field">
            <label for="end-date" class="form-label">
              Sprint End Date <span class="required">*</span>
            </label>
            <input
              id="end-date"
              v-model="endDate"
              type="date"
              class="form-input"
              :class="{ 'has-error': endDateError }"
              :disabled="isSubmitting"
            />
            <p v-if="endDateError" class="field-error" role="alert">{{ endDateError }}</p>
          </div>

          <!-- Points Completed -->
          <div class="form-field">
            <label for="points-completed" class="form-label">
              Points Completed <span class="required">*</span>
            </label>
            <input
              id="points-completed"
              v-model.number="pointsCompleted"
              type="number"
              class="form-input"
              :class="{ 'has-error': pointsCompletedError }"
              placeholder="e.g., 21"
              :disabled="isSubmitting"
              min="0"
              step="0.5"
            />
            <p v-if="pointsCompletedError" class="field-error" role="alert">
              {{ pointsCompletedError }}
            </p>
            <p class="field-hint">Total story points delivered this sprint</p>
          </div>

          <!-- Leave Days -->
          <div class="form-field">
            <label for="leave-days" class="form-label">
              Leave Days <span class="required">*</span>
            </label>
            <input
              id="leave-days"
              v-model.number="leaveDays"
              type="number"
              class="form-input"
              :class="{ 'has-error': leaveDaysError }"
              placeholder="e.g., 2"
              :disabled="isSubmitting"
              min="0"
              step="0.5"
            />
            <p v-if="leaveDaysError" class="field-error" role="alert">
              {{ leaveDaysError }}
            </p>
            <p class="field-hint">
              Total person-days of leave across all developers
            </p>
          </div>

          <!-- Submit Error -->
          <div v-if="submitError" class="submit-error" role="alert">
            {{ submitError }}
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <RouterLink :to="`/team/${teamId}`">
              <f-button text="Cancel" type="tertiary" :disabled="isSubmitting" />
            </RouterLink>
            <f-button
              :text="isSubmitting ? 'Saving...' : 'Log Sprint'"
              type="primary"
              :disabled="isSubmitting"
              @click="handleSubmit"
            />
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.log-sprint-view {
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

/* Page Header */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.back-link {
  font-size: 0.875rem;
  color: var(--f-primary, #0066cc);
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.page-header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

/* Team Context Card */
.team-context-card {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.team-context-card h2 {
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

/* Form Card */
.form-card {
  background: var(--f-background-primary, #fff);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 1.5rem;
}

/* Form Fields */
.form-field {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--f-text-primary, #333);
}

.required {
  color: var(--f-error-color, #dc2626);
}

.form-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 1rem;
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 4px;
  background: var(--f-background-primary, #fff);
  color: var(--f-text-primary, #333);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--f-primary, #0066cc);
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.2);
}

.form-input:disabled {
  background: var(--f-background-secondary, #f5f5f5);
  cursor: not-allowed;
}

.form-input.has-error {
  border-color: var(--f-error-color, #dc2626);
}

.form-input.has-error:focus {
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
}

.field-error {
  margin: 0.375rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--f-error-color, #dc2626);
}

.field-hint {
  margin: 0.375rem 0 0 0;
  font-size: 0.8125rem;
  color: var(--f-text-secondary, #666);
}

/* Submit Error */
.submit-error {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid var(--f-error-color, #dc2626);
  border-radius: 4px;
  color: var(--f-error-color, #dc2626);
  font-size: 0.875rem;
}

/* Form Actions */
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--f-border-color, #e0e0e0);
}
</style>
