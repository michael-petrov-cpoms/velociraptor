<script setup lang="ts">
import { ref, computed } from 'vue'
import { deleteField } from 'firebase/firestore'
import { useTeamStore } from '@/stores/teamStore'
import { useFocusTrap } from '@/composables/useFocusTrap'
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

// Focus trap for accessibility
const modalRef = ref<HTMLElement | null>(null)

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
useFocusTrap(modalRef, handleClose)

function handleClose() {
  if (!isSubmitting.value) {
    emit('close')
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div
      ref="modalRef"
      class="modal-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
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
.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.optional {
  font-weight: 400;
  color: var(--f-text-secondary, #666);
}
</style>
