<script setup lang="ts">
import { ref, computed } from 'vue'
import { Timestamp } from 'firebase/firestore'
import { useSprintStore } from '@/stores/sprintStore'
import type { Sprint } from '@/types'

/**
 * Modal component for editing an existing sprint.
 *
 * Receives the sprint via prop, pre-fills the form with editable fields
 * (endDate, pointsCompleted, leaveDays), displays read-only snapshot data
 * (sprintLengthDays, developerCount), validates on submit, and updates
 * the sprint in Firestore. Parent controls visibility via v-if; this
 * component emits 'close' when done.
 */
const props = defineProps<{
  sprint: Sprint
}>()

const emit = defineEmits<{
  close: []
}>()

const sprintStore = useSprintStore()

// ─────────────────────────────────────────────────────────────────────────────
// Form State — pre-filled from the sprint prop
// ─────────────────────────────────────────────────────────────────────────────

const endDate = ref<string>(props.sprint.endDate.toDate().toISOString().split('T')[0]!)
const pointsCompleted = ref<number | null>(props.sprint.pointsCompleted)
const leaveDays = ref<number | null>(props.sprint.leaveDays)

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
  if (
    pointsCompleted.value === null ||
    pointsCompleted.value === undefined ||
    (pointsCompleted.value as unknown) === ''
  ) {
    return 'Points completed is required'
  }
  if (pointsCompleted.value < 0) return 'Points cannot be negative'
  return null
})

const leaveDaysError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  if (
    leaveDays.value === null ||
    leaveDays.value === undefined ||
    (leaveDays.value as unknown) === ''
  ) {
    return 'Leave days is required'
  }
  if (leaveDays.value < 0) return 'Leave days cannot be negative'
  // Cross-field validation: available days must be at least 1
  // Uses the sprint's OWN snapshot values, not the current team config
  if (leaveDays.value !== null && props.sprint.developerCount > 0) {
    const availableDays =
      props.sprint.sprintLengthDays - leaveDays.value / props.sprint.developerCount
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
  return !endDateError.value && !pointsCompletedError.value && !leaveDaysError.value
})

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle form submission.
 * Validates all fields, checks zero-point warning, then updates sprint.
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
    await sprintStore.updateSprint(props.sprint.id, {
      endDate: Timestamp.fromDate(new Date(endDate.value)),
      pointsCompleted: pointsCompleted.value!,
      leaveDays: leaveDays.value!,
    })

    emit('close')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to update sprint'
  } finally {
    isSubmitting.value = false
  }
}

/**
 * Handle modal close (cancel button or X button).
 */
function handleClose() {
  if (!isSubmitting.value) {
    emit('close')
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal-container" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <!-- Header -->
      <header class="modal-header">
        <h2 id="modal-title">Edit Sprint</h2>
        <button
          type="button"
          class="close-button"
          aria-label="Close"
          :disabled="isSubmitting"
          @click="handleClose"
        >
          &times;
        </button>
      </header>

      <!-- Body -->
      <div class="modal-body">
        <!-- Sprint Context Card (read-only) -->
        <section class="sprint-context-card">
          <h3>Sprint Context</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Sprint Length</span>
              <span class="info-value">{{ sprint.sprintLengthDays }} days</span>
            </div>
            <div class="info-item">
              <span class="info-label">Developers</span>
              <span class="info-value">{{ sprint.developerCount }}</span>
            </div>
          </div>
        </section>

        <form @submit.prevent="handleSubmit">
          <!-- End Date -->
          <div class="form-field">
            <label for="edit-end-date" class="form-label">
              Sprint End Date <span class="required">*</span>
            </label>
            <input
              id="edit-end-date"
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
            <label for="edit-points-completed" class="form-label">
              Points Completed <span class="required">*</span>
            </label>
            <input
              id="edit-points-completed"
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
            <label for="edit-leave-days" class="form-label">
              Leave Days <span class="required">*</span>
            </label>
            <input
              id="edit-leave-days"
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
            <p class="field-hint">Total person-days of leave across all developers</p>
          </div>

          <!-- Submit Error -->
          <div v-if="submitError" class="submit-error" role="alert">
            {{ submitError }}
          </div>
        </form>
      </div>

      <!-- Footer -->
      <footer class="modal-footer">
        <f-button text="Cancel" type="tertiary" :disabled="isSubmitting" @click="handleClose" />
        <f-button
          :text="isSubmitting ? 'Saving...' : 'Save Changes'"
          type="primary"
          :disabled="isSubmitting"
          @click="handleSubmit"
        />
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* Modal Container */
.modal-container {
  background: var(--f-background-primary, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--f-border-color, #e0e0e0);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--f-text-secondary, #666);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.close-button:hover:not(:disabled) {
  color: var(--f-text-primary, #333);
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modal Body */
.modal-body {
  padding: 1.5rem;
}

/* Sprint Context Card (read-only info) */
.sprint-context-card {
  background: var(--f-background-secondary, #f5f5f5);
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.sprint-context-card h3 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.info-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--f-text-secondary, #666);
}

.info-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
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

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--f-border-color, #e0e0e0);
}
</style>
