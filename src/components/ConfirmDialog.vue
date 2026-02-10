<script setup lang="ts">
import { ref, onMounted } from 'vue'

/**
 * A reusable confirmation dialog for destructive or important actions.
 *
 * Uses the same modal overlay pattern as CreateTeamModal.
 * Auto-focuses the cancel button to prevent accidental confirmations.
 */

const props = withDefaults(
  defineProps<{
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    destructive?: boolean
  }>(),
  {
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    destructive: false,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

// ─────────────────────────────────────────────────────────────────────────────
// Auto-focus cancel button on mount
// ─────────────────────────────────────────────────────────────────────────────

const cancelButtonRef = ref<HTMLButtonElement | null>(null)

onMounted(() => {
  cancelButtonRef.value?.focus()
})
</script>

<template>
  <div class="modal-overlay" @click.self="emit('cancel')" @keydown.escape="emit('cancel')">
    <div class="modal-container" role="alertdialog" aria-modal="true" :aria-labelledby="'confirm-dialog-title'">
      <!-- Header -->
      <header class="modal-header">
        <h2 id="confirm-dialog-title">{{ title }}</h2>
      </header>

      <!-- Body -->
      <div class="modal-body">
        <p class="confirm-message">{{ message }}</p>
      </div>

      <!-- Footer -->
      <footer class="modal-footer">
        <button
          ref="cancelButtonRef"
          type="button"
          class="btn btn-cancel"
          @click="emit('cancel')"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          class="btn btn-confirm"
          :class="{ 'btn-danger': destructive }"
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Modal Overlay — same pattern as CreateTeamModal */
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

/* Modal Container — smaller than form modals */
.modal-container {
  background: var(--f-background-primary, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 400px;
}

/* Modal Header */
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--f-border-color, #e0e0e0);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--f-text-primary, #333);
}

/* Modal Body */
.modal-body {
  padding: 1.5rem;
}

.confirm-message {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: var(--f-text-primary, #333);
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--f-border-color, #e0e0e0);
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid var(--f-border-color, #e0e0e0);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-cancel {
  background: var(--f-background-primary, #fff);
  color: var(--f-text-primary, #333);
}

.btn-cancel:hover {
  background: var(--f-background-secondary, #f5f5f5);
}

.btn-confirm {
  background: var(--f-primary, #0066cc);
  color: #fff;
  border-color: var(--f-primary, #0066cc);
}

.btn-confirm:hover {
  opacity: 0.9;
}

.btn-danger {
  background: var(--f-error-color, #dc2626);
  border-color: var(--f-error-color, #dc2626);
  color: #fff;
}

.btn-danger:hover {
  opacity: 0.9;
}
</style>
