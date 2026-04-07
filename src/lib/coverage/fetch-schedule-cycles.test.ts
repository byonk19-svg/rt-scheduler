import { describe, expect, it } from 'vitest'

import { isScheduleCycleArchivalColumnError } from '@/lib/coverage/fetch-schedule-cycles'

describe('isScheduleCycleArchivalColumnError', () => {
  it('returns true for Postgres undefined_column on archived_at', () => {
    expect(
      isScheduleCycleArchivalColumnError({
        code: '42703',
        message: 'column schedule_cycles.archived_at does not exist',
      })
    ).toBe(true)
  })

  it('returns true for PostgREST schema cache miss on archived_at', () => {
    expect(
      isScheduleCycleArchivalColumnError({
        code: 'PGRST204',
        message:
          "Could not find the 'archived_at' column of 'schedule_cycles' in the schema cache",
      })
    ).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(
      isScheduleCycleArchivalColumnError({
        code: '42501',
        message: 'permission denied for table schedule_cycles',
      })
    ).toBe(false)
  })
})
