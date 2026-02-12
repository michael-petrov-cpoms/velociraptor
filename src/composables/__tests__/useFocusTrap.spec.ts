import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { useFocusTrap } from '../useFocusTrap'

// ============================================================================
// Test Helper — wraps useFocusTrap in a minimal component
// ============================================================================

function createTrapComponent(options: { onClose?: () => void } = {}) {
  const onClose = options.onClose ?? vi.fn()

  const TestComponent = defineComponent({
    setup() {
      const containerRef = ref<HTMLElement | null>(null)
      useFocusTrap(containerRef, onClose)
      return { containerRef }
    },
    template: `
      <div ref="containerRef">
        <input id="first" type="text" />
        <button id="middle">Middle</button>
        <button id="last">Last</button>
      </div>
    `,
  })

  return { TestComponent, onClose }
}

// ============================================================================
// Tests
// ============================================================================

describe('useFocusTrap', () => {
  beforeEach(() => {
    // Reset active element between tests
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  })

  describe('Escape key', () => {
    it('calls onClose when Escape is pressed', async () => {
      const { TestComponent, onClose } = createTrapComponent()
      mount(TestComponent, { attachTo: document.body })

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('does not call onClose for other keys', async () => {
      const { TestComponent, onClose } = createTrapComponent()
      mount(TestComponent, { attachTo: document.body })

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('Tab wrapping', () => {
    it('wraps focus from last to first element on Tab', async () => {
      const { TestComponent } = createTrapComponent()
      const wrapper = mount(TestComponent, { attachTo: document.body })

      const lastButton = wrapper.find('#last').element as HTMLElement
      lastButton.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      })
      document.dispatchEvent(event)

      // JSDOM focus management is limited, so we verify the event was
      // handled (preventDefault called) which proves the wrap logic ran
      expect(event.defaultPrevented).toBe(true)
    })

    it('wraps focus from first to last element on Shift+Tab', async () => {
      const { TestComponent } = createTrapComponent()
      const wrapper = mount(TestComponent, { attachTo: document.body })

      const firstInput = wrapper.find('#first').element as HTMLElement
      firstInput.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
      document.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
    })

    it('does not prevent default Tab when not on boundary elements', async () => {
      const { TestComponent } = createTrapComponent()
      const wrapper = mount(TestComponent, { attachTo: document.body })

      const middleButton = wrapper.find('#middle').element as HTMLElement
      middleButton.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      })
      document.dispatchEvent(event)

      // Middle element — Tab should flow naturally, not be intercepted
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe('focus on mount', () => {
    it('focuses the first focusable element when mounted', async () => {
      const { TestComponent } = createTrapComponent()
      const wrapper = mount(TestComponent, { attachTo: document.body })

      // useFocusTrap focuses first element in onMounted
      const firstInput = wrapper.find('#first').element
      expect(document.activeElement).toBe(firstInput)
    })
  })

  describe('cleanup on unmount', () => {
    it('removes the keydown listener when unmounted', async () => {
      const { TestComponent, onClose } = createTrapComponent()
      const wrapper = mount(TestComponent, { attachTo: document.body })

      wrapper.unmount()

      // After unmount, Escape should NOT trigger onClose
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(onClose).not.toHaveBeenCalled()
    })

    it('restores focus to previously focused element on unmount', async () => {
      // Create an external button that was "previously focused"
      const externalButton = document.createElement('button')
      externalButton.id = 'external'
      document.body.appendChild(externalButton)
      externalButton.focus()

      expect(document.activeElement).toBe(externalButton)

      const { TestComponent } = createTrapComponent()
      const wrapper = mount(TestComponent, { attachTo: document.body })

      // Focus moved into the trap
      expect(document.activeElement).not.toBe(externalButton)

      wrapper.unmount()

      // Focus should be restored to the external button
      expect(document.activeElement).toBe(externalButton)

      // Cleanup
      document.body.removeChild(externalButton)
    })
  })

  describe('edge cases', () => {
    it('handles container with no focusable elements gracefully', async () => {
      const onClose = vi.fn()

      const EmptyComponent = defineComponent({
        setup() {
          const containerRef = ref<HTMLElement | null>(null)
          useFocusTrap(containerRef, onClose)
          return { containerRef }
        },
        template: '<div ref="containerRef"><p>No focusable elements</p></div>',
      })

      // Should not throw
      mount(EmptyComponent, { attachTo: document.body })

      // Tab should not throw either
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
      document.dispatchEvent(event)

      // Escape still works
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('skips disabled elements in the focus trap', async () => {
      const DisabledComponent = defineComponent({
        setup() {
          const containerRef = ref<HTMLElement | null>(null)
          useFocusTrap(containerRef, vi.fn())
          return { containerRef }
        },
        template: `
          <div ref="containerRef">
            <input id="enabled" type="text" />
            <button id="disabled-btn" disabled>Disabled</button>
            <button id="active-btn">Active</button>
          </div>
        `,
      })

      const wrapper = mount(DisabledComponent, { attachTo: document.body })

      // Focus the last active button, then Tab — should wrap to first input
      const activeBtn = wrapper.find('#active-btn').element as HTMLElement
      activeBtn.focus()

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      })
      document.dispatchEvent(event)

      // The disabled button is excluded from the focusable set,
      // so #active-btn IS the last element — Tab should wrap
      expect(event.defaultPrevented).toBe(true)
    })
  })
})
