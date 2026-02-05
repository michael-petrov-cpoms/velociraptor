import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import EditTeamModal from '../EditTeamModal.vue'
import type { Team } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

const mockUpdateTeam = vi.fn()

vi.mock('@/stores/teamStore', () => ({
  useTeamStore: () => ({
    updateTeam: mockUpdateTeam,
  }),
}))

// Mock Firestore's deleteField — returns a sentinel we can assert against
const DELETE_FIELD_SENTINEL = Symbol('deleteField')
vi.mock('firebase/firestore', () => ({
  deleteField: () => DELETE_FIELD_SENTINEL,
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
// Test Data
// ─────────────────────────────────────────────────────────────────────────────

function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-123',
    name: 'Alpha Team',
    memberCount: 5,
    developerCount: 4,
    sprintLengthDays: 14,
    createdAt: { seconds: 1700000000, nanoseconds: 0 } as Team['createdAt'],
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('EditTeamModal', () => {
  let wrapper: VueWrapper
  let mockTeam: Team

  beforeEach(() => {
    mockUpdateTeam.mockReset()
    mockUpdateTeam.mockResolvedValue(undefined)
    mockTeam = createMockTeam()
  })

  function mountComponent(team: Team = mockTeam) {
    wrapper = mount(EditTeamModal, {
      props: { team },
      global: { stubs: globalStubs },
    })
    return wrapper
  }

  /**
   * Helper to click the submit button.
   */
  async function clickSubmit() {
    const buttons = wrapper.findAll('button')
    const submitButton = buttons.find((b) => b.text().includes('Save Changes'))
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
    it('renders modal with "Edit Team" title', () => {
      mountComponent()

      expect(wrapper.find('h2').text()).toBe('Edit Team')
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

    it('renders Cancel and Save Changes buttons', () => {
      mountComponent()

      const buttons = wrapper.findAll('button')
      const buttonTexts = buttons.map((b) => b.text())

      expect(buttonTexts).toContain('Cancel')
      expect(buttonTexts).toContain('Save Changes')
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
  // Pre-filled Data Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Pre-filled Data', () => {
    it('pre-fills team name from prop', () => {
      mountComponent()

      const input = wrapper.find('#team-name').element as HTMLInputElement
      expect(input.value).toBe('Alpha Team')
    })

    it('pre-fills member count from prop', () => {
      mountComponent()

      const input = wrapper.find('#member-count').element as HTMLInputElement
      expect(input.value).toBe('5')
    })

    it('pre-fills developer count from prop', () => {
      mountComponent()

      const input = wrapper.find('#developer-count').element as HTMLInputElement
      expect(input.value).toBe('4')
    })

    it('pre-fills sprint length from prop', () => {
      mountComponent()

      const input = wrapper.find('#sprint-length').element as HTMLInputElement
      expect(input.value).toBe('14')
    })

    it('pre-fills baseline velocity when team has one', () => {
      const teamWithBaseline = createMockTeam({ baselineVelocity: 30 })
      mountComponent(teamWithBaseline)

      const input = wrapper.find('#baseline-velocity').element as HTMLInputElement
      expect(input.value).toBe('30')
    })

    it('leaves baseline velocity empty when team has no baseline', () => {
      mountComponent()

      const input = wrapper.find('#baseline-velocity').element as HTMLInputElement
      expect(input.value).toBe('')
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

    it('shows error when name is cleared to empty on submit', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('')
      await clickSubmit()

      expect(wrapper.text()).toContain('Team name is required')
    })

    it('shows error when name exceeds 50 characters', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('A'.repeat(51))
      await clickSubmit()

      expect(wrapper.text()).toContain('50 characters or less')
    })

    it('shows error when memberCount is cleared', async () => {
      mountComponent()
      await wrapper.find('#member-count').setValue('')
      await clickSubmit()

      expect(wrapper.text()).toContain('Member count is required')
    })

    it('shows error when memberCount is less than 1', async () => {
      mountComponent()
      await wrapper.find('#member-count').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).toContain('at least 1 member')
    })

    it('shows error when developerCount is cleared', async () => {
      mountComponent()
      await wrapper.find('#developer-count').setValue('')
      await clickSubmit()

      expect(wrapper.text()).toContain('Developer count is required')
    })

    it('shows error when developerCount exceeds memberCount', async () => {
      mountComponent()
      await wrapper.find('#member-count').setValue(3)
      await wrapper.find('#developer-count').setValue(5)
      await clickSubmit()

      expect(wrapper.text()).toContain('cannot exceed total members')
    })

    it('shows error when sprintLengthDays is cleared', async () => {
      mountComponent()
      await wrapper.find('#sprint-length').setValue('')
      await clickSubmit()

      expect(wrapper.text()).toContain('Sprint length is required')
    })

    it('shows error when sprintLengthDays is less than 1', async () => {
      mountComponent()
      await wrapper.find('#sprint-length').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).toContain('at least 1 day')
    })

    it('shows error when sprintLengthDays exceeds 30', async () => {
      mountComponent()
      await wrapper.find('#sprint-length').setValue(31)
      await clickSubmit()

      expect(wrapper.text()).toContain('cannot exceed 30 days')
    })

    it('shows error when baselineVelocity is negative', async () => {
      mountComponent()
      await wrapper.find('#baseline-velocity').setValue(-5)
      await clickSubmit()

      expect(wrapper.text()).toContain('Cannot be negative')
    })

    it('does not call updateTeam when validation fails', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('')
      await clickSubmit()

      expect(mockUpdateTeam).not.toHaveBeenCalled()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Submission Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Submission', () => {
    it('calls updateTeam with correct team ID and data', async () => {
      mountComponent()
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith('team-123', {
        name: 'Alpha Team',
        memberCount: 5,
        developerCount: 4,
        sprintLengthDays: 14,
      })
    })

    it('calls updateTeam with modified data', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('Beta Team')
      await wrapper.find('#member-count').setValue(8)
      await wrapper.find('#developer-count').setValue(6)
      await wrapper.find('#sprint-length').setValue(21)
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith('team-123', {
        name: 'Beta Team',
        memberCount: 8,
        developerCount: 6,
        sprintLengthDays: 21,
      })
    })

    it('trims whitespace from team name', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('  Padded Team  ')
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith(
        'team-123',
        expect.objectContaining({ name: 'Padded Team' }),
      )
    })

    it('includes baselineVelocity when provided', async () => {
      mountComponent()
      await wrapper.find('#baseline-velocity').setValue(30)
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith(
        'team-123',
        expect.objectContaining({ baselineVelocity: 30 }),
      )
    })

    it('preserves existing baselineVelocity if not changed', async () => {
      const teamWithBaseline = createMockTeam({ baselineVelocity: 25 })
      mountComponent(teamWithBaseline)
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith(
        'team-123',
        expect.objectContaining({ baselineVelocity: 25 }),
      )
    })

    it('uses deleteField when clearing a previously-set baselineVelocity', async () => {
      const teamWithBaseline = createMockTeam({ baselineVelocity: 25 })
      mountComponent(teamWithBaseline)

      // Clear the baseline velocity field
      await wrapper.find('#baseline-velocity').setValue('')
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith(
        'team-123',
        expect.objectContaining({ baselineVelocity: DELETE_FIELD_SENTINEL }),
      )
    })

    it('does not include baselineVelocity when team never had one and field is empty', async () => {
      mountComponent() // mockTeam has no baselineVelocity
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalled()
      const callArgs = mockUpdateTeam.mock.calls[0]?.[1] as Record<string, unknown>
      expect(callArgs).not.toHaveProperty('baselineVelocity')
    })

    it('emits close on successful update', async () => {
      mountComponent()
      await clickSubmit()

      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close')?.length).toBe(1)
    })

    it('shows loading state during submission', async () => {
      mockUpdateTeam.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await clickSubmit()

      const buttons = wrapper.findAll('button')
      const submitButton = buttons.find((b) => b.text().includes('Saving'))
      expect(submitButton?.exists()).toBe(true)
    })

    it('disables form during submission', async () => {
      mockUpdateTeam.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await clickSubmit()

      const inputs = wrapper.findAll('input')
      inputs.forEach((input) => {
        expect(input.element.disabled).toBe(true)
      })
    })

    it('shows error on submission failure', async () => {
      mockUpdateTeam.mockRejectedValue(new Error('Network error'))

      mountComponent()
      await clickSubmit()

      await nextTick()

      expect(wrapper.text()).toContain('Network error')
    })

    it('shows generic error message for non-Error rejections', async () => {
      mockUpdateTeam.mockRejectedValue('something went wrong')

      mountComponent()
      await clickSubmit()

      await nextTick()

      expect(wrapper.text()).toContain('Failed to update team')
    })

    it('re-enables form after submission failure', async () => {
      mockUpdateTeam.mockRejectedValue(new Error('Network error'))

      mountComponent()
      await clickSubmit()

      await nextTick()

      const inputs = wrapper.findAll('input')
      inputs.forEach((input) => {
        expect(input.element.disabled).toBe(false)
      })
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
      mockUpdateTeam.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await clickSubmit()

      const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancel')
      expect(cancelButton?.element.disabled).toBe(true)
    })

    it('does not close when submission is in progress (X button disabled)', async () => {
      mockUpdateTeam.mockImplementation(() => new Promise(() => {}))

      mountComponent()
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

      expect(wrapper.find('#team-name').exists()).toBe(true)
      expect(wrapper.find('label[for="team-name"]').exists()).toBe(true)

      expect(wrapper.find('#member-count').exists()).toBe(true)
      expect(wrapper.find('label[for="member-count"]').exists()).toBe(true)
    })

    it('marks error messages with role="alert"', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('')
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
      await wrapper.find('#baseline-velocity').setValue(25.5)
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith(
        'team-123',
        expect.objectContaining({ baselineVelocity: 25.5 }),
      )
    })

    it('handles exactly 50 character team name', async () => {
      mountComponent()
      await wrapper.find('#team-name').setValue('A'.repeat(50))
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('50 characters or less')
    })

    it('handles developerCount equal to memberCount', async () => {
      mountComponent()
      await wrapper.find('#member-count').setValue(5)
      await wrapper.find('#developer-count').setValue(5)
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('cannot exceed')
    })

    it('handles sprint length of exactly 30 days', async () => {
      mountComponent()
      await wrapper.find('#sprint-length').setValue(30)
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith(
        'team-123',
        expect.objectContaining({ sprintLengthDays: 30 }),
      )
    })

    it('allows baselineVelocity to be 0', async () => {
      mountComponent()
      await wrapper.find('#baseline-velocity').setValue(0)
      await clickSubmit()

      expect(mockUpdateTeam).toHaveBeenCalledWith(
        'team-123',
        expect.objectContaining({ baselineVelocity: 0 }),
      )
    })
  })
})
