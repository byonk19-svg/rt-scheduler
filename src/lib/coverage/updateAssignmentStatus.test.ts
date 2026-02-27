import { describe, expect, it, vi } from 'vitest'

import { updateCoverageAssignmentStatus } from '@/lib/coverage/updateAssignmentStatus'

describe('updateCoverageAssignmentStatus', () => {
  it('persists optimistic status changes on success (no rollback)', async () => {
    type TestState = { status: 'active' | 'oncall' }
    let state: TestState = { status: 'active' }

    const persistAssignmentStatus = vi.fn().mockResolvedValue({ error: null })
    const setState = vi.fn((updater: (current: TestState) => TestState) => {
      state = updater(state)
    })
    const clearError = vi.fn()
    const showError = vi.fn()
    const logError = vi.fn()

    const updated = await updateCoverageAssignmentStatus({
      shiftId: 'shift-1',
      nextStatus: 'oncall',
      setState,
      persistAssignmentStatus,
      applyOptimisticUpdate: (current): TestState => ({ ...current, status: 'oncall' }),
      rollbackOptimisticUpdate: (current): TestState => ({ ...current, status: 'active' }),
      clearError,
      showError,
      logError,
    })

    expect(updated).toBe(true)
    expect(clearError).toHaveBeenCalledTimes(1)
    expect(setState).toHaveBeenCalledTimes(1)
    expect(state).toEqual({ status: 'oncall' })
    expect(persistAssignmentStatus).toHaveBeenCalledWith('shift-1', {
      assignment_status: 'on_call',
      status: 'on_call',
    })
    expect(showError).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('rolls back against current state and logs the real error on failure', async () => {
    type TestState = { optimisticDepth: number }
    let state: TestState = { optimisticDepth: 0 }

    const dbError = new Error('write failed')
    const persistAssignmentStatus = vi.fn().mockResolvedValue({ error: dbError })
    const setState = vi.fn((updater: (current: TestState) => TestState) => {
      state = updater(state)
    })
    const clearError = vi.fn()
    const showError = vi.fn()
    const logError = vi.fn()

    const updated = await updateCoverageAssignmentStatus({
      shiftId: 'shift-2',
      nextStatus: 'cancelled',
      setState,
      persistAssignmentStatus,
      applyOptimisticUpdate: (current) => ({ ...current, optimisticDepth: current.optimisticDepth + 1 }),
      rollbackOptimisticUpdate: (current) => ({ ...current, optimisticDepth: current.optimisticDepth - 1 }),
      clearError,
      showError,
      logError,
    })

    expect(updated).toBe(false)
    expect(clearError).toHaveBeenCalledTimes(1)
    expect(setState).toHaveBeenCalledTimes(2)
    expect(state).toEqual({ optimisticDepth: 0 })
    expect(showError).toHaveBeenCalledWith('Could not save status update. Changes were rolled back.')
    expect(logError).toHaveBeenCalledWith('Failed to persist coverage status change:', dbError)
  })
})
