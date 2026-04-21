import { describe, expect, it } from 'vitest'

import {
  AVAILABILITY_CYCLE_SELECT,
  AVAILABILITY_ENTRY_SELECT,
  fetchAvailabilityCycles,
  fetchAvailabilityEntries,
  fetchAvailabilitySubmissionRows,
  fetchManagerPlannerOverrides,
} from '@/lib/availability-server-data'

function createMockClient(resultData: unknown) {
  const calls: Array<{
    table: string
    selection?: string
    eq?: Array<[string, unknown]>
    in?: Array<[string, string[]]>
  }> = []
  let activeCall: (typeof calls)[number] | null = null

  const chain = {
    is() {
      return chain
    },
    gte() {
      return chain
    },
    lte() {
      return chain
    },
    order() {
      return chain
    },
    eq(column: string, value: unknown) {
      if (activeCall) {
        activeCall.eq = [...(activeCall.eq ?? []), [column, value]]
      }
      return chain
    },
    in(column: string, values: string[]) {
      if (activeCall) {
        activeCall.in = [...(activeCall.in ?? []), [column, values]]
      }
      return Promise.resolve({ data: resultData })
    },
    then(resolve: (value: { data: unknown }) => unknown) {
      return Promise.resolve(resolve({ data: resultData }))
    },
  }

  return {
    client: {
      from(table: string) {
        activeCall = { table }
        calls.push(activeCall)
        return {
          select(selection: string) {
            if (activeCall) activeCall.selection = selection
            return chain
          },
        }
      },
    },
    calls,
  }
}

describe('availability-server-data', () => {
  it('uses the shared cycle select for cycle fetches', async () => {
    const mock = createMockClient([])
    await fetchAvailabilityCycles(mock.client as never, '2026-04-19')
    expect(mock.calls[0]?.selection).toBe(AVAILABILITY_CYCLE_SELECT)
  })

  it('uses the shared entry select for availability entry fetches', async () => {
    const mock = createMockClient([])
    await fetchAvailabilityEntries({
      supabase: mock.client as never,
      selectedCycleId: 'cycle-1',
      therapistId: 'ther-1',
    })
    expect(mock.calls[0]?.selection).toBe(AVAILABILITY_ENTRY_SELECT)
    expect(mock.calls[0]?.eq).toEqual([
      ['therapist_id', 'ther-1'],
      ['cycle_id', 'cycle-1'],
    ])
  })

  it('skips submission and planner override queries when there are no cycle ids', async () => {
    expect(
      await fetchAvailabilitySubmissionRows({
        supabase: createMockClient([]).client as never,
        therapistId: 'ther-1',
        cycleIds: [],
      })
    ).toEqual([])

    expect(await fetchManagerPlannerOverrides(createMockClient([]).client as never, [])).toEqual([])
  })
})
