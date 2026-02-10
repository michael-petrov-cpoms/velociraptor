import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from '../ConfirmDialog.vue'

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mountDialog(props: Partial<InstanceType<typeof ConfirmDialog>['$props']> = {}) {
  return mount(ConfirmDialog, {
    props: {
      title: 'Confirm Action',
      message: 'Are you sure you want to proceed?',
      ...props,
    },
    attachTo: document.body,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('ConfirmDialog', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Rendering Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders the title', () => {
      const wrapper = mountDialog({ title: 'Delete Team' })

      expect(wrapper.find('h2').text()).toBe('Delete Team')
    })

    it('renders the message', () => {
      const wrapper = mountDialog({ message: 'This action cannot be undone.' })

      expect(wrapper.find('.confirm-message').text()).toBe('This action cannot be undone.')
    })

    it('renders default button texts', () => {
      const wrapper = mountDialog()

      expect(wrapper.find('.btn-cancel').text()).toBe('Cancel')
      expect(wrapper.find('.btn-confirm').text()).toBe('Confirm')
    })

    it('renders custom button texts', () => {
      const wrapper = mountDialog({
        confirmText: 'Delete',
        cancelText: 'Keep',
      })

      expect(wrapper.find('.btn-cancel').text()).toBe('Keep')
      expect(wrapper.find('.btn-confirm').text()).toBe('Delete')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Event Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Events', () => {
    it('emits confirm when confirm button is clicked', async () => {
      const wrapper = mountDialog()

      await wrapper.find('.btn-confirm').trigger('click')

      expect(wrapper.emitted('confirm')).toHaveLength(1)
    })

    it('emits cancel when cancel button is clicked', async () => {
      const wrapper = mountDialog()

      await wrapper.find('.btn-cancel').trigger('click')

      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('emits cancel on Escape key', async () => {
      const wrapper = mountDialog()

      await wrapper.find('.modal-overlay').trigger('keydown', { key: 'Escape' })

      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('emits cancel on overlay click', async () => {
      const wrapper = mountDialog()

      await wrapper.find('.modal-overlay').trigger('click')

      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('does not emit cancel when clicking inside the modal container', async () => {
      const wrapper = mountDialog()

      await wrapper.find('.modal-container').trigger('click')

      expect(wrapper.emitted('cancel')).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Destructive Prop Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Destructive Prop', () => {
    it('applies danger styling when destructive is true', () => {
      const wrapper = mountDialog({ destructive: true })

      expect(wrapper.find('.btn-confirm').classes()).toContain('btn-danger')
    })

    it('does not apply danger styling when destructive is false', () => {
      const wrapper = mountDialog({ destructive: false })

      expect(wrapper.find('.btn-confirm').classes()).not.toContain('btn-danger')
    })

    it('does not apply danger styling by default', () => {
      const wrapper = mountDialog()

      expect(wrapper.find('.btn-confirm').classes()).not.toContain('btn-danger')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Accessibility Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('focuses the cancel button on mount', async () => {
      const wrapper = mountDialog()

      // Wait for onMounted to execute
      await wrapper.vm.$nextTick()

      expect(document.activeElement).toBe(wrapper.find('.btn-cancel').element)

      wrapper.unmount()
    })

    it('has role="alertdialog" on the modal container', () => {
      const wrapper = mountDialog()

      expect(wrapper.find('.modal-container').attributes('role')).toBe('alertdialog')
    })

    it('has aria-modal="true"', () => {
      const wrapper = mountDialog()

      expect(wrapper.find('.modal-container').attributes('aria-modal')).toBe('true')
    })

    it('has aria-labelledby pointing to the title', () => {
      const wrapper = mountDialog()

      const container = wrapper.find('.modal-container')
      const titleId = wrapper.find('h2').attributes('id')

      expect(container.attributes('aria-labelledby')).toBe(titleId)
    })
  })
})
