import { describe, expect, it, vi } from 'vitest'

import {
  fetchActiveOperationalCodeMap,
  fetchActiveOperationalDetailMap,
} from '@/lib/operational-codes'

describe('fetchActiveOperationalCodeMap', () => {
  it('batches shift id lookups to avoid oversized Supabase request headers', async () => {
    const batchIds: string[][] = []
    const shiftIds = Array.from({ length: 205 }, (_, index) => `shift-${index}`)
    const inMock = vi.fn(async (_column: string, values: string[]) => {
      batchIds.push(values)
      return {
        data: values.includes('shift-150') ? [{ shift_id: 'shift-150', code: 'call_in' }] : [],
        error: null,
      }
    })

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: inMock,
          })),
        })),
      })),
    }

    const result = await fetchActiveOperationalCodeMap(supabase, [...shiftIds, 'shift-150'])

    expect(batchIds).toHaveLength(3)
    expect(batchIds.map((ids) => ids.length)).toEqual([100, 100, 5])
    expect(result.get('shift-150')).toBe('call_in')
  })
})

describe('fetchActiveOperationalDetailMap', () => {
  it('preserves note and left-early metadata for active operational entries', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [
                {
                  shift_id: 'shift-1',
                  code: 'left_early',
                  note: 'Left for appointment',
                  left_early_time: '14:30:00',
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
    }

    const result = await fetchActiveOperationalDetailMap(supabase, ['shift-1'])

    expect(result.get('shift-1')).toEqual({
      code: 'left_early',
      note: 'Left for appointment',
      leftEarlyTime: '14:30:00',
    })
  })
})
