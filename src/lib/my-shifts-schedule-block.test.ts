import { describe, expect, it } from 'vitest'

import {
  addDays,
  formatScheduleBlockRange,
  parseScheduleBlockStart,
  SCHEDULE_BLOCK_DAYS,
  SCHEDULE_BLOCK_WEEKS,
} from '@/lib/my-shifts-schedule-block'

describe('My Shifts Schedule Block helpers', () => {
  it('uses a full 42-day, six-week block', () => {
    const start = '2026-03-22'
    const end = addDays(start, SCHEDULE_BLOCK_DAYS - 1)

    expect(SCHEDULE_BLOCK_DAYS).toBe(42)
    expect(SCHEDULE_BLOCK_WEEKS).toBe(6)
    expect(end).toBe('2026-05-02')
    expect(formatScheduleBlockRange(start, end)).toBe('Mar 22 - May 2, 2026')
  })

  it('normalizes selected dates to the Sunday-start block', () => {
    expect(parseScheduleBlockStart('2026-03-25')).toBe('2026-03-22')
    expect(parseScheduleBlockStart('2026-03-22')).toBe('2026-03-22')
  })
})
