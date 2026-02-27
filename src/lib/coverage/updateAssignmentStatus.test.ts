import { describe, expect, it, vi } from 'vitest'

import { updateCoverageAssignmentStatus } from '@/lib/coverage/updateAssignmentStatus'

describe('updateCoverageAssignmentStatus', () => {
  it('persists optimistic status changes on success', async () => {
    const persistAssignmentStatus = vi.fn().mockResolvedValue({ error: null })
    const applyOptimisticUpdate = vi.fn()
    const rollbackOptimisticUpdate = vi.fn()
    const clearError = vi.fn()
    const showError = vi.fn()
    const logError = vi.fn()

    const updated = await updateCoverageAssignmentStatus({
      shiftId: 'shift-1',
      nextStatus: 'oncall',
      persistAssignmentStatus,
      applyOptimisticUpdate,
      rollbackOptimisticUpdate,
      clearError,
      showError,
      logError,
    })

    expect(updated).toBe(true)
    expect(clearError).toHaveBeenCalledTimes(1)
    expect(applyOptimisticUpdate).toHaveBeenCalledTimes(1)
    expect(persistAssignmentStatus).toHaveBeenCalledWith('shift-1', {
      assignment_status: 'on_call',
      status: 'on_call',
    })
    expect(rollbackOptimisticUpdate).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('rolls back and logs the real error on failure', async () => {
    const dbError = new Error('write failed')
    const persistAssignmentStatus = vi.fn().mockResolvedValue({ error: dbError })
    const applyOptimisticUpdate = vi.fn()
    const rollbackOptimisticUpdate = vi.fn()
    const clearError = vi.fn()
    const showError = vi.fn()
    const logError = vi.fn()

    const updated = await updateCoverageAssignmentStatus({
      shiftId: 'shift-2',
      nextStatus: 'cancelled',
      persistAssignmentStatus,
      applyOptimisticUpdate,
      rollbackOptimisticUpdate,
      clearError,
      showError,
      logError,
    })

    expect(updated).toBe(false)
    expect(clearError).toHaveBeenCalledTimes(1)
    expect(applyOptimisticUpdate).toHaveBeenCalledTimes(1)
    expect(rollbackOptimisticUpdate).toHaveBeenCalledTimes(1)
    expect(showError).toHaveBeenCalledWith('Could not save status update. Changes were rolled back.')
    expect(logError).toHaveBeenCalledWith('Failed to persist coverage status change:', dbError)
  })
})
