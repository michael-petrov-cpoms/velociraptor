import { onMounted, onUnmounted, type Ref } from 'vue'

const FOCUSABLE_SELECTOR =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * Traps keyboard focus within a modal container for accessibility.
 *
 * - On mount: saves the currently focused element, then focuses the first
 *   focusable child inside the container.
 * - On Tab / Shift+Tab: cycles focus within the container boundaries.
 * - On Escape: calls the onClose callback to dismiss the modal.
 * - On unmount: removes the listener and restores focus to the previously
 *   focused element.
 *
 * @param containerRef - Template ref pointing to the modal container element
 * @param onClose - Callback invoked when Escape is pressed
 */
export function useFocusTrap(containerRef: Ref<HTMLElement | null>, onClose: () => void): void {
  let previouslyFocused: HTMLElement | null = null

  function getFocusableElements(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = getFocusableElements()
    if (focusable.length === 0) return

    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!

    if (event.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  onMounted(() => {
    previouslyFocused = document.activeElement as HTMLElement | null

    // Focus the first focusable element inside the container
    const focusable = getFocusableElements()
    if (focusable.length > 0) {
      focusable[0]!.focus()
    }

    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)

    // Restore focus to the element that was focused before the modal opened
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus()
    }
  })
}
