import { describe, expect, it, vi } from 'vitest'

import {
  CLEAR_AVAILABILITY_CONFIRMATION,
  COPY_PREVIOUS_AVAILABILITY_CONFIRMATION,
  confirmAvailabilityDestructiveAction,
} from '@/lib/availability-destructive-confirmation'

describe('confirmAvailabilityDestructiveAction', () => {
  it('does not prompt when there are no unsaved changes or current selections', () => {
    const confirm = vi.fn(() => false)

    expect(
      confirmAvailabilityDestructiveAction({
        hasUnsavedChanges: false,
        hasExistingSelections: false,
        message: COPY_PREVIOUS_AVAILABILITY_CONFIRMATION,
        confirm,
      })
    ).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('continues when the user confirms a destructive availability action', () => {
    const confirm = vi.fn(() => true)

    expect(
      confirmAvailabilityDestructiveAction({
        hasUnsavedChanges: true,
        message: CLEAR_AVAILABILITY_CONFIRMATION,
        confirm,
      })
    ).toBe(true)
    expect(confirm).toHaveBeenCalledWith(CLEAR_AVAILABILITY_CONFIRMATION)
  })

  it('prompts when current saved selections would be replaced even without unsaved changes', () => {
    const confirm = vi.fn(() => false)

    expect(
      confirmAvailabilityDestructiveAction({
        hasUnsavedChanges: false,
        hasExistingSelections: true,
        message: COPY_PREVIOUS_AVAILABILITY_CONFIRMATION,
        confirm,
      })
    ).toBe(false)
    expect(confirm).toHaveBeenCalledWith(COPY_PREVIOUS_AVAILABILITY_CONFIRMATION)
  })

  it('cancels when the user declines a destructive availability action', () => {
    const confirm = vi.fn(() => false)

    expect(
      confirmAvailabilityDestructiveAction({
        hasUnsavedChanges: true,
        message: COPY_PREVIOUS_AVAILABILITY_CONFIRMATION,
        confirm,
      })
    ).toBe(false)
    expect(confirm).toHaveBeenCalledWith(COPY_PREVIOUS_AVAILABILITY_CONFIRMATION)
  })
})
