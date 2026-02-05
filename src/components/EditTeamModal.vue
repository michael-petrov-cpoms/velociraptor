<script setup lang="ts">
import { ref, computed } from 'vue'
import { deleteField } from 'firebase/firestore'
import { useTeamStore } from '@/stores/teamStore'
import type { Team } from '@/types'

/**
 * Modal component for editing an existing team.
 *
 * Receives the current team via prop, pre-fills the form,
 * validates on submit, and updates the team in Firestore.
 * Parent controls visibility via v-if; this component emits 'close' when done.
 */
const props = defineProps<{
  team: Team
}>()

const emit = defineEmits<{
  close: []
}>()

const teamStore = useTeamStore()

// ─────────────────────────────────────────────────────────────────────────────
// Form State — pre-filled from the team prop
// ─────────────────────────────────────────────────────────────────────────────

const name = ref(props.team.name)
const memberCount = ref<number | null>(props.team.memberCount)
const developerCount = ref<number | null>(props.team.developerCount)
const sprintLengthDays = ref<number | null>(props.team.sprintLengthDays)
const baselineVelocity = ref<number | null>(props.team.baselineVelocity ?? null)

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

const nameError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  const trimmed = name.value.trim()
  if (!trimmed) return 'Team name is required'
  if (trimmed.length > 50) return 'Team name must be 50 characters or less'
  return null
})

const memberCountError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  // v-model.number sets value to '' (empty string) when user clears a number input
  if (
    memberCount.value === null ||
    memberCount.value === undefined ||
    (memberCount.value as unknown) === ''
  ) {
    return 'Member count is required'
  }
  if (!Number.isInteger(memberCount.value)) return 'Must be a whole number'
  if (memberCount.value < 1) return 'Must have at least 1 member'
  return null
})

const developerCountError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  if (
    developerCount.value === null ||
    developerCount.value === undefined ||
    (developerCount.value as unknown) === ''
  ) {
    return 'Developer count is required'
  }
  if (!Number.isInteger(developerCount.value)) return 'Must be a whole number'
  if (developerCount.value < 1) return 'Must have at least 1 developer'
  // Cross-field validation: developers cannot exceed total members
  if (memberCount.value !== null && developerCount.value > memberCount.value) {
    return 'Developers cannot exceed total members'
  }
  return null
})

const sprintLengthError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  if (
    sprintLengthDays.value === null ||
    sprintLengthDays.value === undefined ||
    (sprintLengthDays.value as unknown) === ''
  ) {
    return 'Sprint length is required'
  }
  if (!Number.isInteger(sprintLengthDays.value)) return 'Must be a whole number'
  if (sprintLengthDays.value < 1) return 'Sprint must be at least 1 day'
  if (sprintLengthDays.value > 30) return 'Sprint cannot exceed 30 days'
  return null
})

const baselineVelocityError = computed(() => {
  if (!hasAttemptedSubmit.value) return null
  // Optional field - only validate if a value is provided
  if (baselineVelocity.value === null || baselineVelocity.value === undefined) {
    return null
  }
  if (typeof baselineVelocity.value !== 'number') return null
  if (baselineVelocity.value < 0) return 'Cannot be negative'
  return null
})

/**
 * Returns true if the form has no validation errors.
 */
const isFormValid = computed(() => {
  return (
    !nameError.value &&
    !memberCountError.value &&
    !developerCountError.value &&
    !sprintLengthError.value &&
    !baselineVelocityError.value
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle form submission.
 * Validates all fields, then calls the store to update the team.
 */
async function handleSubmit() {
  // Mark that user has attempted submit - this enables error display
  hasAttemptedSubmit.value = true
  submitError.value = null

  // Check validation after setting hasAttemptedSubmit
  // (computed errors will now evaluate)
  if (!isFormValid.value) {
    return
  }

  isSubmitting.value = true

  try {
    // Build the update payload with required fields
    const updateData: Record<string, unknown> = {
      name: name.value.trim(),
      memberCount: memberCount.value!,
      developerCount: developerCount.value!,
      sprintLengthDays: sprintLengthDays.value!,
    }

    // Handle optional baselineVelocity
    const baselineIsEmpty =
      baselineVelocity.value === null ||
      baselineVelocity.value === undefined ||
      baselineVelocity.value === ('' as unknown)

    if (!baselineIsEmpty) {
      updateData.baselineVelocity = baselineVelocity.value
    } else if (props.team.baselineVelocity != null) {
      // User cleared a previously-set baseline — use Firestore's deleteField()
      // sentinel to remove the field from the document entirely.
      updateData.baselineVelocity = deleteField()
    }

    // Type assertion: updateTeam expects Team fields, but deleteField() is a
    // Firestore FieldValue sentinel. This is safe because updateDoc handles it.
    await teamStore.updateTeam(props.team.id, updateData as Partial<Omit<Team, 'id' | 'createdAt'>>)

    // Success - close the modal
    emit('close')
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to update team'
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
        <h2 id="modal-title">Edit Team</h2>
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
        <form @submit.prevent="handleSubmit">
          <!-- Team Name -->
          <div class="form-field">
            <label for="team-name" class="form-label">
              Team Name <span class="required">*</span>
            </label>
            <input
              id="team-name"
              v-model="name"
              type="text"
              class="form-input"
              :class="{ 'has-error': nameError }"
              placeholder="e.g., Alpha Team"
              :disabled="isSubmitting"
              maxlength="50"
            />
            <p v-if="nameError" class="field-error" role="alert">{{ nameError }}</p>
          </div>

          <!-- Member Count -->
          <div class="form-field">
            <label for="member-count" class="form-label">
              Total Team Members <span class="required">*</span>
            </label>
            <input
              id="member-count"
              v-model.number="memberCount"
              type="number"
              class="form-input"
              :class="{ 'has-error': memberCountError }"
              placeholder="e.g., 5"
              :disabled="isSubmitting"
              min="1"
              step="1"
            />
            <p v-if="memberCountError" class="field-error" role="alert">{{ memberCountError }}</p>
          </div>

          <!-- Developer Count -->
          <div class="form-field">
            <label for="developer-count" class="form-label">
              Number of Developers <span class="required">*</span>
            </label>
            <input
              id="developer-count"
              v-model.number="developerCount"
              type="number"
              class="form-input"
              :class="{ 'has-error': developerCountError }"
              placeholder="e.g., 4"
              :disabled="isSubmitting"
              min="1"
              step="1"
            />
            <p v-if="developerCountError" class="field-error" role="alert">
              {{ developerCountError }}
            </p>
            <p class="field-hint">Used for velocity calculations (excludes QA, PM, etc.)</p>
          </div>

          <!-- Sprint Length -->
          <div class="form-field">
            <label for="sprint-length" class="form-label">
              Sprint Length (days) <span class="required">*</span>
            </label>
            <input
              id="sprint-length"
              v-model.number="sprintLengthDays"
              type="number"
              class="form-input"
              :class="{ 'has-error': sprintLengthError }"
              placeholder="e.g., 14"
              :disabled="isSubmitting"
              min="1"
              max="30"
              step="1"
            />
            <p v-if="sprintLengthError" class="field-error" role="alert">{{ sprintLengthError }}</p>
          </div>

          <!-- Baseline Velocity (Optional) -->
          <div class="form-field">
            <label for="baseline-velocity" class="form-label">
              Expected Points per Sprint
              <span class="optional">(optional)</span>
            </label>
            <input
              id="baseline-velocity"
              v-model.number="baselineVelocity"
              type="number"
              class="form-input"
              :class="{ 'has-error': baselineVelocityError }"
              placeholder="e.g., 30"
              :disabled="isSubmitting"
              min="0"
              step="0.5"
            />
            <p v-if="baselineVelocityError" class="field-error" role="alert">
              {{ baselineVelocityError }}
            </p>
            <p class="field-hint">
              Provide an estimate if the team doesn't have sprint history yet
            </p>
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

.optional {
  font-weight: 400;
  color: var(--f-text-secondary, #666);
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
