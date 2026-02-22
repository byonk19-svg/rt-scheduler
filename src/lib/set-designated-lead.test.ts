import { describe, expect, it, vi } from 'vitest'

import { setDesignatedLeadMutation } from '@/lib/set-designated-lead'

describe('set designated lead mutation', () => {
  it('maps unique index errors to multiple lead prevention', async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const result = await setDesignatedLeadMutation(
      { rpc },
      {
        cycleId: 'cycle-1',
        date: '2026-03-08',
        shiftType: 'day',
        therapistId: 'therapist-1',
      }
    )

    expect(result).toEqual({
      ok: false,
      reason: 'multiple_leads_prevented',
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
  })
})
