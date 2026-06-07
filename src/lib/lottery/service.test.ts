import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  applyLotteryDecision,
  buildAvailableDates,
  moveLotteryListEntry,
  type LotteryActor,
} from '@/lib/lottery/service'

const actor: LotteryActor = {
  userId: 'manager-1',
  fullName: 'Manager User',
  role: 'manager',
  siteId: 'default',
  shiftType: 'day',
}

describe('buildAvailableDates', () => {
  it('deduplicates overlapping published cycle dates before rendering selectors', () => {
    expect(
      buildAvailableDates([
        { start_date: '2026-05-01', end_date: '2026-05-03' },
        { start_date: '2026-05-03', end_date: '2026-05-05' },
      ])
    ).toEqual(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'])
  })
})

describe('applyLotteryDecision', () => {
  it('does not allow leads to apply lottery decisions', async () => {
    const result = await applyLotteryDecision({
      actor: { ...actor, userId: 'lead-1', role: 'lead' },
      authClient: {
        rpc: vi.fn(),
      },
      shiftDate: '2026-04-23',
      shiftType: 'day',
      keepToWork: 0,
      contextSignature: 'ctx-1',
      actions: [],
    })

    expect(result).toEqual({
      ok: false,
      error: 'Only managers can apply Lottery results.',
    })
  })

  it('rolls back the current assignment when reconciliation fails after the status mutation', async () => {
    const updateAssignmentStatusWithLotteryMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: 'Could not create the Lottery history entry.',
        previousStatus: 'scheduled',
        statusMutated: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        previousStatus: 'on_call',
      })

    const result = await applyLotteryDecision(
      {
        actor,
        authClient: {
          rpc: vi.fn(),
        },
        shiftDate: '2026-04-23',
        shiftType: 'day',
        keepToWork: 0,
        contextSignature: 'ctx-1',
        actions: [{ therapistId: 'therapist-1', status: 'on_call' }],
      },
      {
        loadLotterySnapshot: vi.fn(async () => ({
          recommendation: {
            state: 'preview',
            keepToWork: 0,
            scheduledCount: 1,
            reductionsNeeded: 1,
            actions: [
              { therapistId: 'therapist-1', therapistName: 'Therapist 1', status: 'on_call' },
            ],
            explanation: [],
            contextSignature: 'ctx-1',
            latestAppliedAt: null,
            latestAppliedBy: null,
            overrideApplied: false,
          },
          recommendationError: null,
        })) as never,
        loadSlotAssignments: vi.fn(async () => [
          {
            shiftId: 'shift-1',
            therapistId: 'therapist-1',
            therapistName: 'Therapist 1',
            employmentType: 'full_time',
            liveStatus: 'scheduled',
          },
        ]) as never,
        updateAssignmentStatusWithLottery: updateAssignmentStatusWithLotteryMock as never,
      }
    )

    expect(result).toEqual({
      ok: false,
      error: 'Could not create the Lottery history entry.',
    })
    expect(updateAssignmentStatusWithLotteryMock).toHaveBeenCalledTimes(2)
    expect(updateAssignmentStatusWithLotteryMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        shiftId: 'shift-1',
        nextStatus: 'on_call',
      })
    )
    expect(updateAssignmentStatusWithLotteryMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        shiftId: 'shift-1',
        nextStatus: 'scheduled',
      })
    )
  })
})

describe('moveLotteryListEntry', () => {
  function createLoadLotteryList(state: Record<string, number>) {
    return vi.fn(async () => [
      {
        id: 'entry-1',
        therapistId: 'therapist-1',
        therapistName: 'Alpha',
        fixedOrder: state['entry-1'],
        lastLotteriedDate: null,
      },
      {
        id: 'entry-2',
        therapistId: 'therapist-2',
        therapistName: 'Bravo',
        fixedOrder: state['entry-2'],
        lastLotteriedDate: null,
      },
    ])
  }

  it('does not allow leads to edit the lottery list', async () => {
    const result = await moveLotteryListEntry({
      actor: { ...actor, userId: 'lead-1', role: 'lead' },
      entryId: 'entry-1',
      shiftType: 'day',
      direction: 'down',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Only managers can edit the Lottery list.',
    })
  })

  it('restores the original order when step 2 fails', async () => {
    const orderState: Record<string, number> = {
      'entry-1': 1,
      'entry-2': 2,
    }

    const updateLotteryListEntryOrderMock = vi.fn(
      async ({
        entryId,
        expectedOrder,
        nextOrder,
        stepLabel,
      }: {
        entryId: string
        expectedOrder: number
        nextOrder: number
        stepLabel: string
      }) => {
        if (orderState[entryId] !== expectedOrder) {
          return { ok: false as const, error: 'Could not reorder the Lottery list.' }
        }
        if (stepLabel === 'step 2') {
          return { ok: false as const, error: 'Could not reorder the Lottery list.' }
        }

        orderState[entryId] = nextOrder
        return { ok: true as const }
      }
    )

    const result = await moveLotteryListEntry(
      {
        actor,
        entryId: 'entry-1',
        shiftType: 'day',
        direction: 'down',
      },
      {
        loadLotteryList: createLoadLotteryList(orderState) as never,
        updateLotteryListEntryOrder: updateLotteryListEntryOrderMock as never,
      }
    )

    expect(result).toEqual({
      ok: false,
      error: 'Could not reorder the Lottery list.',
    })
    expect(orderState).toEqual({
      'entry-1': 1,
      'entry-2': 2,
    })
    expect(
      updateLotteryListEntryOrderMock.mock.calls.map(
        (call) => (call[0] as { stepLabel: string }).stepLabel
      )
    ).toEqual(['step 1', 'step 2', 'rollback-current'])
  })

  it('restores both rows when step 3 fails after the swap is partially applied', async () => {
    const orderState: Record<string, number> = {
      'entry-1': 1,
      'entry-2': 2,
    }

    const updateLotteryListEntryOrderMock = vi.fn(
      async ({
        entryId,
        expectedOrder,
        nextOrder,
        stepLabel,
      }: {
        entryId: string
        expectedOrder: number
        nextOrder: number
        stepLabel: string
      }) => {
        if (orderState[entryId] !== expectedOrder) {
          return { ok: false as const, error: 'Could not reorder the Lottery list.' }
        }
        if (stepLabel === 'step 3') {
          return { ok: false as const, error: 'Could not reorder the Lottery list.' }
        }

        orderState[entryId] = nextOrder
        return { ok: true as const }
      }
    )

    const result = await moveLotteryListEntry(
      {
        actor,
        entryId: 'entry-1',
        shiftType: 'day',
        direction: 'down',
      },
      {
        loadLotteryList: createLoadLotteryList(orderState) as never,
        updateLotteryListEntryOrder: updateLotteryListEntryOrderMock as never,
      }
    )

    expect(result).toEqual({
      ok: false,
      error: 'Could not reorder the Lottery list.',
    })
    expect(orderState).toEqual({
      'entry-1': 1,
      'entry-2': 2,
    })
    expect(
      updateLotteryListEntryOrderMock.mock.calls.map(
        (call) => (call[0] as { stepLabel: string }).stepLabel
      )
    ).toEqual(['step 1', 'step 2', 'step 3', 'rollback-target', 'rollback-current'])
  })
})
