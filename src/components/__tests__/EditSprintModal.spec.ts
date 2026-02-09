import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import EditSprintModal from '../EditSprintModal.vue'
import type { Sprint } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

const mockUpdateSprint = vi.fn()

vi.mock('@/stores/sprintStore', () => ({
  useSprintStore: () => ({
    updateSprint: mockUpdateSprint,
  }),
}))

// Mock Firebase Timestamp
vi.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: (date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    }),
  },
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

function createMockSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sprint-123',
    teamId: 'team-456',
    endDate: {
      toDate: () => new Date('2024-06-15'),
      toMillis: () => new Date('2024-06-15').getTime(),
      seconds: Math.floor(new Date('2024-06-15').getTime() / 1000),
      nanoseconds: 0,
    } as Sprint['endDate'],
    pointsCompleted: 21,
    leaveDays: 2,
    sprintLengthDays: 10,
    developerCount: 4,
    createdAt: { seconds: 1700000000, nanoseconds: 0 } as Sprint['createdAt'],
    ...overrides,
  }
}

/**
 * Returns a future date string in YYYY-MM-DD format.
 */
function futureDateString(): string {
  const future = new Date()
  future.setFullYear(future.getFullYear() + 1)
  return future.toISOString().split('T')[0]!
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('EditSprintModal', () => {
  let wrapper: VueWrapper
  let mockSprint: Sprint
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockUpdateSprint.mockReset()
    mockUpdateSprint.mockResolvedValue(undefined)
    mockSprint = createMockSprint()

    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  function mountComponent(sprint: Sprint = mockSprint) {
    wrapper = mount(EditSprintModal, {
      props: { sprint },
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
    it('renders modal with "Edit Sprint" title', () => {
      mountComponent()

      expect(wrapper.find('h2').text()).toBe('Edit Sprint')
    })

    it('renders all editable form fields with correct labels', () => {
      mountComponent()

      const labels = wrapper.findAll('label')
      const labelTexts = labels.map((l) => l.text())

      expect(labelTexts).toContain('Sprint End Date *')
      expect(labelTexts).toContain('Points Completed *')
      expect(labelTexts).toContain('Leave Days *')
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

    it('renders sprint context card with read-only data', () => {
      mountComponent()

      const contextCard = wrapper.find('.sprint-context-card')
      expect(contextCard.exists()).toBe(true)
      expect(contextCard.text()).toContain('Sprint Context')
      expect(contextCard.text()).toContain('10 days')
      expect(contextCard.text()).toContain('4')
    })

    it('renders field hints for points and leave days', () => {
      mountComponent()

      const hints = wrapper.findAll('.field-hint')
      expect(hints).toHaveLength(2)
      expect(hints[0]!.text()).toContain('story points')
      expect(hints[1]!.text()).toContain('person-days')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Pre-filled Data Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Pre-filled Data', () => {
    it('pre-fills end date from sprint prop', () => {
      mountComponent()

      const input = wrapper.find('#edit-end-date').element as HTMLInputElement
      expect(input.value).toBe('2024-06-15')
    })

    it('pre-fills points completed from sprint prop', () => {
      mountComponent()

      const input = wrapper.find('#edit-points-completed').element as HTMLInputElement
      expect(input.value).toBe('21')
    })

    it('pre-fills leave days from sprint prop', () => {
      mountComponent()

      const input = wrapper.find('#edit-leave-days').element as HTMLInputElement
      expect(input.value).toBe('2')
    })

    it('displays correct sprint length in context card', () => {
      const sprint = createMockSprint({ sprintLengthDays: 14 })
      mountComponent(sprint)

      const contextCard = wrapper.find('.sprint-context-card')
      expect(contextCard.text()).toContain('14 days')
    })

    it('displays correct developer count in context card', () => {
      const sprint = createMockSprint({ developerCount: 6 })
      mountComponent(sprint)

      const contextCard = wrapper.find('.sprint-context-card')
      expect(contextCard.text()).toContain('6')
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

    it('shows error when end date is cleared on submit', async () => {
      mountComponent()
      await wrapper.find('#edit-end-date').setValue('')
      await clickSubmit()

      expect(wrapper.text()).toContain('End date is required')
    })

    it('shows error when end date is in the future', async () => {
      mountComponent()
      await wrapper.find('#edit-end-date').setValue(futureDateString())
      await clickSubmit()

      expect(wrapper.text()).toContain('End date cannot be in the future')
    })

    it('shows error when points completed is cleared', async () => {
      mountComponent()
      await wrapper.find('#edit-points-completed').setValue('')
      await clickSubmit()

      expect(wrapper.text()).toContain('Points completed is required')
    })

    it('shows error when points is negative', async () => {
      mountComponent()
      await wrapper.find('#edit-points-completed').setValue(-5)
      await clickSubmit()

      expect(wrapper.text()).toContain('Points cannot be negative')
    })

    it('shows error when leave days is cleared', async () => {
      mountComponent()
      await wrapper.find('#edit-leave-days').setValue('')
      await clickSubmit()

      expect(wrapper.text()).toContain('Leave days is required')
    })

    it('shows error when leave days is negative', async () => {
      mountComponent()
      await wrapper.find('#edit-leave-days').setValue(-3)
      await clickSubmit()

      expect(wrapper.text()).toContain('Leave days cannot be negative')
    })

    it('does not call updateSprint when validation fails', async () => {
      mountComponent()
      await wrapper.find('#edit-end-date').setValue('')
      await clickSubmit()

      expect(mockUpdateSprint).not.toHaveBeenCalled()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Cross-Field Validation (Available Days)
  // ───────────────────────────────────────────────────────────────────────────

  describe('Cross-Field Validation (Available Days)', () => {
    it('shows error when leave days too high for available days', async () => {
      // sprint: sprintLength=10, devCount=2 -> leaveDays=19 -> availableDays = 10 - (19/2) = 0.5
      const sprint = createMockSprint({ sprintLengthDays: 10, developerCount: 2 })
      mountComponent(sprint)

      await wrapper.find('#edit-leave-days').setValue(19)
      await clickSubmit()

      expect(wrapper.text()).toContain('Leave days too high')
    })

    it('no error when leave days result in availableDays = 1 (boundary)', async () => {
      // sprint: sprintLength=10, devCount=4 -> leaveDays=36 -> availableDays = 10 - (36/4) = 1
      const sprint = createMockSprint({ sprintLengthDays: 10, developerCount: 4 })
      mountComponent(sprint)

      await wrapper.find('#edit-leave-days').setValue(36)
      await clickSubmit()

      expect(wrapper.text()).not.toContain('Leave days too high')
    })

    it('uses sprint snapshot values, not current team values', async () => {
      // The sprint's own sprintLengthDays and developerCount are what matter
      const sprint = createMockSprint({ sprintLengthDays: 5, developerCount: 1 })
      mountComponent(sprint)

      // leaveDays=5 -> availableDays = 5 - (5/1) = 0 -> should fail
      await wrapper.find('#edit-leave-days').setValue(5)
      await clickSubmit()

      expect(wrapper.text()).toContain('Leave days too high')
    })

    it('no error when leave days are 0', async () => {
      mountComponent()
      await wrapper.find('#edit-leave-days').setValue(0)
      await clickSubmit()

      expect(wrapper.text()).not.toContain('Leave days too high')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Zero-Point Warning
  // ───────────────────────────────────────────────────────────────────────────

  describe('Zero-Point Warning', () => {
    it('shows window.confirm when pointsCompleted is 0', async () => {
      mountComponent()
      await wrapper.find('#edit-points-completed').setValue(0)
      await clickSubmit()

      expect(confirmSpy).toHaveBeenCalledWith(
        "Points completed is 0. This will lower the team's average velocity. Continue?",
      )
    })

    it('submits when user confirms zero points', async () => {
      confirmSpy.mockReturnValue(true)

      mountComponent()
      await wrapper.find('#edit-points-completed').setValue(0)
      await clickSubmit()
      await nextTick()

      expect(mockUpdateSprint).toHaveBeenCalled()
    })

    it('does NOT submit when user cancels zero-point warning', async () => {
      confirmSpy.mockReturnValue(false)

      mountComponent()
      await wrapper.find('#edit-points-completed').setValue(0)
      await clickSubmit()

      expect(mockUpdateSprint).not.toHaveBeenCalled()
    })

    it('does NOT show confirm for non-zero points', async () => {
      mountComponent()
      await clickSubmit()

      expect(confirmSpy).not.toHaveBeenCalled()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Submission Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('Submission', () => {
    it('calls updateSprint with correct sprint ID and editable fields only', async () => {
      mountComponent()
      await clickSubmit()
      await nextTick()

      expect(mockUpdateSprint).toHaveBeenCalledWith('sprint-123', {
        endDate: expect.objectContaining({
          seconds: expect.any(Number),
          nanoseconds: 0,
        }),
        pointsCompleted: 21,
        leaveDays: 2,
      })
    })

    it('calls updateSprint with modified data', async () => {
      mountComponent()
      await wrapper.find('#edit-end-date').setValue('2024-07-01')
      await wrapper.find('#edit-points-completed').setValue(35)
      await wrapper.find('#edit-leave-days').setValue(5)
      await clickSubmit()
      await nextTick()

      expect(mockUpdateSprint).toHaveBeenCalledWith('sprint-123', {
        endDate: expect.objectContaining({
          seconds: expect.any(Number),
        }),
        pointsCompleted: 35,
        leaveDays: 5,
      })
    })

    it('does not include teamId, sprintLengthDays, or developerCount in update', async () => {
      mountComponent()
      await clickSubmit()
      await nextTick()

      const callArgs = mockUpdateSprint.mock.calls[0]?.[1] as Record<string, unknown>
      expect(callArgs).not.toHaveProperty('teamId')
      expect(callArgs).not.toHaveProperty('sprintLengthDays')
      expect(callArgs).not.toHaveProperty('developerCount')
    })

    it('emits close on successful update', async () => {
      mountComponent()
      await clickSubmit()
      await nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close')?.length).toBe(1)
    })

    it('shows loading state during submission', async () => {
      mockUpdateSprint.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await clickSubmit()

      const buttons = wrapper.findAll('button')
      const submitButton = buttons.find((b) => b.text().includes('Saving'))
      expect(submitButton?.exists()).toBe(true)
    })

    it('disables form during submission', async () => {
      mockUpdateSprint.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await clickSubmit()

      const inputs = wrapper.findAll('input')
      inputs.forEach((input) => {
        expect(input.element.disabled).toBe(true)
      })
    })

    it('shows error on submission failure', async () => {
      mockUpdateSprint.mockRejectedValue(new Error('Network error'))

      mountComponent()
      await clickSubmit()
      await nextTick()

      expect(wrapper.text()).toContain('Network error')
    })

    it('shows generic error message for non-Error rejections', async () => {
      mockUpdateSprint.mockRejectedValue('something went wrong')

      mountComponent()
      await clickSubmit()
      await nextTick()

      expect(wrapper.text()).toContain('Failed to update sprint')
    })

    it('re-enables form after submission failure', async () => {
      mockUpdateSprint.mockRejectedValue(new Error('Network error'))

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
      mockUpdateSprint.mockImplementation(() => new Promise(() => {}))

      mountComponent()
      await clickSubmit()

      const cancelButton = wrapper.findAll('button').find((b) => b.text() === 'Cancel')
      expect(cancelButton?.element.disabled).toBe(true)
    })

    it('does not close when submission is in progress (X button disabled)', async () => {
      mockUpdateSprint.mockImplementation(() => new Promise(() => {}))

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

      expect(wrapper.find('#edit-end-date').exists()).toBe(true)
      expect(wrapper.find('label[for="edit-end-date"]').exists()).toBe(true)

      expect(wrapper.find('#edit-points-completed').exists()).toBe(true)
      expect(wrapper.find('label[for="edit-points-completed"]').exists()).toBe(true)

      expect(wrapper.find('#edit-leave-days').exists()).toBe(true)
      expect(wrapper.find('label[for="edit-leave-days"]').exists()).toBe(true)
    })

    it('marks error messages with role="alert"', async () => {
      mountComponent()
      await wrapper.find('#edit-end-date').setValue('')
      await wrapper.find('#edit-points-completed').setValue('')
      await wrapper.find('#edit-leave-days').setValue('')
      await clickSubmit()

      const errors = wrapper.findAll('.field-error')
      expect(errors.length).toBeGreaterThan(0)
      errors.forEach((error) => {
        expect(error.attributes('role')).toBe('alert')
      })
    })

    it('submit error has role="alert"', async () => {
      mockUpdateSprint.mockRejectedValue(new Error('Fail'))

      mountComponent()
      await clickSubmit()
      await nextTick()

      const submitError = wrapper.find('.submit-error')
      expect(submitError.attributes('role')).toBe('alert')
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ───────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('handles 0.5 increment values for points completed', async () => {
      mountComponent()
      await wrapper.find('#edit-points-completed').setValue(10.5)
      await clickSubmit()
      await nextTick()

      expect(mockUpdateSprint).toHaveBeenCalledWith(
        'sprint-123',
        expect.objectContaining({ pointsCompleted: 10.5 }),
      )
    })

    it('handles 0.5 increment values for leave days', async () => {
      mountComponent()
      await wrapper.find('#edit-leave-days').setValue(2.5)
      await clickSubmit()
      await nextTick()

      expect(mockUpdateSprint).toHaveBeenCalledWith(
        'sprint-123',
        expect.objectContaining({ leaveDays: 2.5 }),
      )
    })

    it('allows 0 points completed (with confirm)', async () => {
      confirmSpy.mockReturnValue(true)

      mountComponent()
      await wrapper.find('#edit-points-completed').setValue(0)
      await clickSubmit()
      await nextTick()

      expect(mockUpdateSprint).toHaveBeenCalledWith(
        'sprint-123',
        expect.objectContaining({ pointsCompleted: 0 }),
      )
    })

    it('allows 0 leave days', async () => {
      mountComponent()
      await wrapper.find('#edit-leave-days').setValue(0)
      await clickSubmit()
      await nextTick()

      expect(mockUpdateSprint).toHaveBeenCalledWith(
        'sprint-123',
        expect.objectContaining({ leaveDays: 0 }),
      )
    })

    it('converts endDate to Timestamp on save', async () => {
      mountComponent()
      await wrapper.find('#edit-end-date').setValue('2024-08-20')
      await clickSubmit()
      await nextTick()

      const callArgs = mockUpdateSprint.mock.calls[0]?.[1] as Record<string, unknown>
      const endDateArg = callArgs.endDate as { toDate: () => Date }
      expect(endDateArg.toDate).toBeDefined()
    })
  })
})
