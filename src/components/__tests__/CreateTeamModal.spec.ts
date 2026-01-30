import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import CreateTeamModal from '../CreateTeamModal.vue'

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

const mockAddTeam = vi.fn()

vi.mock('@/stores/teamStore', () => ({
  useTeamStore: () => ({
    addTeam: mockAddTeam,
  }),
}))

// Stub FeatherUI button component
const globalStubs = {
  'f-button': {
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button>',
    props: ['text', 'type', 'disabled'],
    emits: ['click'],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('CreateTeamModal', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    mockAddTeam.mockReset()
    mockAddTeam.mockResolvedValue('new-team-id')
  })

  function mountComponent() {
    wrapper = mount(CreateTeamModal, {
      global: { stubs: globalStubs },
    })
    return wrapper
  }

  /**
   * Helper to fill all required form fields with valid data.
   */
  async function fillValidForm() {
    await wrapper.find('#team-name').setValue('Alpha Team')
    await wrapper.find('#member-count').setValue(5)
    await wrapper.find('#developer-count').setValue(4)
    await wrapper.find('#sprint-length').setValue(14)
  }

  /**
   * Helper to click the submit button.
   */
  async function clickSubmit() {
    const buttons = wrapper.findAll('button')
    const submitButton = buttons.find((b) => b.text().includes('Create Team'))
    await submitButton?.trigger('click')
    await nextTick()
  }

  /**
   * Helper to click the cancel button.
   */
  async function clickCancel() {
    const buttons = wrapper.findAll('button')
    const cancelButton = buttons.find((b) => b.text() === 'Cancel')
    await cancelButton?.trigger('click')
    await nextTick()
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rendering Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders modal with "Create Team" title', () => {
      mountComponent()

      expect(wrapper.find('h2').text()).toBe('Create Team')
    })

    it('renders all form fields with correct labels', () => {
      mountComponent()

      const labels = wrapper.findAll('label')
      const labelTexts = labels.map((l) => l.text())

      expect(labelTexts).toContain('Team Name *')
      expect(labelTexts).toContain('Total Team Members *')
      expect(labelTexts).toContain('Number of Developers *')
      expect(labelTexts).toContain('Sprint Length (days) *')
      expect(labelTexts).toContain('Expected Points per Sprint (optional)')
    })

    it('renders Cancel and Create Team buttons', () => {
      mountComponent()

      const buttons = wrapper.findAll('button')
      const buttonTexts = buttons.map((b) => b.text())

      expect(buttonTexts).toContain('Cancel')
      expect(buttonTexts).toContain('Create Team')
    })

    it('renders close button in header', () => {
      mountComponent()

      const closeButton = wrapper.find('.close-button')
      expect(closeButton.exists()).toBe(true)
      expect(closeButton.text()).toBe('×')
    })

    it('renders field hints for developer count and baseline velocity', () => {
      mountComponent()

      const hints = wrapper.findAll('.field-hint')
      expect(hints).toHaveLength(2)
      expect(hints[0]!.text()).toContain('velocity calculations')
      expect(hints[1]!.text()).toContain('sprint history')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Validation Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('does not show errors before submit attempt', () => {
      mountComponent()

      expect(wrapper.findAll('.field-error').length).toBe(0)
    })

    it('shows error when name is empty on submit', async () => {
      mountComponent()
      await clickSubmit()

      expect(wrapper.text()).toContain('Team name is required')
    })

    it('shows error when name exceeds 50 characters', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('A'.repeat(51))
      await wrapper.find('#member-count').setValue(5)
      await wrapper.find('#developer-count').setValue(4)
      await wrapper.find('#sprint-length').setValue(14)
      await clickSubmit()

      expect(wrapper.text()).toContain('50 characters or less')
    })

    it('shows error when memberCount is empty', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('Test Team')
      await clickSubmit()

      expect(wrapper.text()).toContain('Member count is required')
    })

    it('shows error when memberCount is less than 1', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('Test Team')
      await wrapper.find('#member-count').setValue(0)
      await wrapper.find('#developer-count').setValue(1)
      await wrapper.find('#sprint-length').setValue(14)
      await clickSubmit()

      expect(wrapper.text()).toContain('at least 1 member')
    })

    it('shows error when developerCount is empty', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('Test Team')
      await wrapper.find('#member-count').setValue(5)
      await clickSubmit()

      expect(wrapper.text()).toContain('Developer count is required')
    })

    it('shows error when developerCount is less than 1', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('Test Team')
      await wrapper.find('#member-count').setValue(5)
      await wrapper.find('#developer-count').setValue(0)
      await wrapper.find('#sprint-length').setValue(14)
      await clickSubmit()

      expect(wrapper.text()).toContain('at least 1 developer')
    })

    it('shows error when developerCount exceeds memberCount', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('Test Team')
      await wrapper.find('#member-count').setValue(3)
      await wrapper.find('#developer-count').setValue(5)
      await wrapper.find('#sprint-length').setValue(14)
      await clickSubmit()

      expect(wrapper.text()).toContain('cannot exceed total members')
    })

    it('shows error when sprintLengthDays is empty', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('Test Team')
      await wrapper.find('#member-count').setValue(5)
      await wrapper.find('#developer-count').setValue(4)
      await clickSubmit()

      expect(wrapper.text()).toContain('Sprint length is required')
    })

    it('shows error when sprintLengthDays is less than 1', async () => {
      mountComponent()
      await fillValidForm()
      await wrapper.find('#sprint-length').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).toContain('at least 1 day')
    })

    it('shows error when sprintLengthDays exceeds 30', async () => {
      mountComponent()
      await fillValidForm()
      await wrapper.find('#sprint-length').setValue(31)
      await clickSubmit()

      expect(wrapper.text()).toContain('cannot exceed 30 days')
    })

    it('allows empty baselineVelocity (optional)', async () => {
      mountComponent()
      await fillValidForm()
      // Leave baseline velocity empty
      await clickSubmit()

      // Should not show any error for baseline velocity
      expect(wrapper.text()).not.toContain('Cannot be negative')
      // Form should be valid and addTeam called
      expect(mockAddTeam).toHaveBeenCalled()
    })

    it('shows error when baselineVelocity is negative', async () => {
      mountComponent()
      await fillValidForm()
      await wrapper.find('#baseline-velocity').setValue(-5)
      await clickSubmit()

      expect(wrapper.text()).toContain('Cannot be negative')
    })

    it('allows baselineVelocity to be 0', async () => {
      mountComponent()
      await fillValidForm()
      await wrapper.find('#baseline-velocity').setValue(0)
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalledWith(
        expect.objectContaining({ baselineVelocity: 0 }),
      )
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Submission Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Submission', () => {
    it('calls addTeam with correct data on valid submission', async () => {
      mountComponent()
      await fillValidForm()
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalledWith({
        name: 'Alpha Team',
        memberCount: 5,
        developerCount: 4,
        sprintLengthDays: 14,
      })
    })

    it('trims whitespace from team name', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('  Padded Team  ')
      await wrapper.find('#member-count').setValue(5)
      await wrapper.find('#developer-count').setValue(4)
      await wrapper.find('#sprint-length').setValue(14)
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Padded Team' }),
      )
    })

    it('includes baselineVelocity when provided', async () => {
      mountComponent()
      await fillValidForm()
      await wrapper.find('#baseline-velocity').setValue(30)
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalledWith(
        expect.objectContaining({ baselineVelocity: 30 }),
      )
    })

    it('omits baselineVelocity when empty', async () => {
      mountComponent()
      await fillValidForm()
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalled()
      const callArgs = mockAddTeam.mock.calls[0]?.[0] as Record<string, unknown>
      expect(callArgs).not.toHaveProperty('baselineVelocity')
    })

    it('emits close on successful creation', async () => {
      mountComponent()
      await fillValidForm()
      await clickSubmit()

      // Wait for async addTeam to complete
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close')?.length).toBe(1)
    })

    it('shows loading state during submission', async () => {
      // Make addTeam hang to test loading state
      mockAddTeam.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await fillValidForm()
      await clickSubmit()

      const buttons = wrapper.findAll('button')
      const submitButton = buttons.find((b) => b.text().includes('Creating'))
      expect(submitButton?.exists()).toBe(true)
    })

    it('disables form during submission', async () => {
      mockAddTeam.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await fillValidForm()
      await clickSubmit()

      const inputs = wrapper.findAll('input')
      inputs.forEach((input) => {
        expect(input.element.disabled).toBe(true)
      })
    })

    it('shows error on submission failure', async () => {
      mockAddTeam.mockRejectedValue(new Error('Network error'))

      mountComponent()
      await fillValidForm()
      await clickSubmit()

      // Wait for rejection to be handled
      await nextTick()

      expect(wrapper.text()).toContain('Network error')
    })

    it('re-enables form after submission failure', async () => {
      mockAddTeam.mockRejectedValue(new Error('Network error'))

      mountComponent()
      await fillValidForm()
      await clickSubmit()

      await nextTick()

      const inputs = wrapper.findAll('input')
      inputs.forEach((input) => {
        expect(input.element.disabled).toBe(false)
      })
    })

    it('does not call addTeam when validation fails', async () => {
      mountComponent()
      // Don't fill form, just try to submit
      await clickSubmit()

      expect(mockAddTeam).not.toHaveBeenCalled()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Close Behavior Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Close Behavior', () => {
    it('emits close when Cancel clicked', async () => {
      mountComponent()
      await clickCancel()

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close when header X button clicked', async () => {
      mountComponent()
      await wrapper.find('.close-button').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('emits close when clicking overlay background', async () => {
      mountComponent()
      await wrapper.find('.modal-overlay').trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('does not emit close when clicking modal container', async () => {
      mountComponent()
      await wrapper.find('.modal-container').trigger('click')

      expect(wrapper.emitted('close')).toBeFalsy()
    })

    it('does not close when submission is in progress (Cancel button disabled)', async () => {
      mockAddTeam.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await fillValidForm()
      await clickSubmit()

      // Try to click cancel while submitting
      const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancel')
      expect(cancelButton?.element.disabled).toBe(true)
    })

    it('does not close when submission is in progress (X button disabled)', async () => {
      mockAddTeam.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await fillValidForm()
      await clickSubmit()

      const closeButton = wrapper.find('.close-button')
      expect((closeButton.element as HTMLButtonElement).disabled).toBe(true)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Accessibility Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('has proper ARIA attributes on modal', () => {
      mountComponent()

      const modal = wrapper.find('.modal-container')
      expect(modal.attributes('role')).toBe('dialog')
      expect(modal.attributes('aria-modal')).toBe('true')
      expect(modal.attributes('aria-labelledby')).toBe('modal-title')
    })

    it('has proper labels for form fields', () => {
      mountComponent()

      // Team name field has matching label
      expect(wrapper.find('#team-name').exists()).toBe(true)
      expect(wrapper.find('label[for="team-name"]').exists()).toBe(true)

      // Member count field has matching label
      expect(wrapper.find('#member-count').exists()).toBe(true)
      expect(wrapper.find('label[for="member-count"]').exists()).toBe(true)
    })

    it('marks error messages with role="alert"', async () => {
      mountComponent()
      await clickSubmit()

      const errors = wrapper.findAll('.field-error')
      errors.forEach((error) => {
        expect(error.attributes('role')).toBe('alert')
      })
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ───────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles 0.5 increments for baselineVelocity', async () => {
      mountComponent()
      await fillValidForm()
      await wrapper.find('#baseline-velocity').setValue(25.5)
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalledWith(
        expect.objectContaining({ baselineVelocity: 25.5 }),
      )
    })

    it('handles exactly 50 character team name', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('A'.repeat(50))
      await wrapper.find('#member-count').setValue(5)
      await wrapper.find('#developer-count').setValue(4)
      await wrapper.find('#sprint-length').setValue(14)
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('50 characters or less')
    })

    it('handles developerCount equal to memberCount', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('All Devs')
      await wrapper.find('#member-count').setValue(5)
      await wrapper.find('#developer-count').setValue(5)
      await wrapper.find('#sprint-length').setValue(14)
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('cannot exceed')
    })

    it('handles sprint length of exactly 30 days', async () => {
      mountComponent()
      await fillValidForm()
      await wrapper.find('#sprint-length').setValue(30)
      await clickSubmit()

      expect(mockAddTeam).toHaveBeenCalledWith(
        expect.objectContaining({ sprintLengthDays: 30 }),
      )
    })
  })
})
