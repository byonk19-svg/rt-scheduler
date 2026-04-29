import { describe, expect, it, vi } from 'vitest'

import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'

describe('fetchActiveOperationalCodeMap', () => {
  it('batches large shift-id lists to stay under request header limits', async () => {
    const inMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ shift_id: 'shift-1', code: 'on_call' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ shift_id: 'shift-150', code: 'call_in' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ shift_id: 'shift-205', code: 'cancelled' }],
        error: null,
      })

    const supabase = {
      from(table: string) {
        expect(table).toBe('shift_operational_entries')
        return {
          select(columns: string) {
            expect(columns).toBe('shift_id, code')
            return {
              eq(column: string, value: unknown) {
                expect(column).toBe('active')
                expect(value).toBe(true)
                return {
                  in: inMock,
                }
              },
            }
          },
        }
      },
    }

    const ids = Array.from({ length: 205 }, (_, index) => `shift-${index + 1}`)
    const map = await fetchActiveOperationalCodeMap(supabase, ids)

    expect(inMock).toHaveBeenCalledTimes(3)
    expect(inMock.mock.calls[0]?.[0]).toBe('shift_id')
    expect(inMock.mock.calls[0]?.[1] as string[]).toHaveLength(100)
    expect(inMock.mock.calls[1]?.[1] as string[]).toHaveLength(100)
    expect(inMock.mock.calls[2]?.[1] as string[]).toHaveLength(5)
    expect(map).toEqual(
      new Map([
        ['shift-1', 'on_call'],
        ['shift-150', 'call_in'],
        ['shift-205', 'cancelled'],
      ])
    )
  })
})
