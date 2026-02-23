import { describe, expect, it } from 'vitest'

import { summarizeCalendarCell } from '@/lib/calendar-cell'

describe('summarizeCalendarCell', () => {
  it('puts lead first and computes +N overflow', () => {
    const summary = summarizeCalendarCell([
      { id: '2', full_name: 'Brianna', shift_type: 'day', role: 'staff', status: 'scheduled' },
      { id: '3', full_name: 'Alyce', shift_type: 'day', role: 'staff', status: 'on_call' },
      { id: '1', full_name: 'Mark', shift_type: 'day', role: 'lead', status: 'scheduled' },
      { id: '4', full_name: 'Zoe', shift_type: 'day', role: 'staff', status: 'scheduled' },
    ])

    expect(summary.leadName).toBe('Mark')
    expect(summary.missingLead).toBe(false)
    expect(summary.coverageCount).toBe(4)
    expect(summary.visibleShifts.map((shift) => shift.full_name)).toEqual(['Mark', 'Alyce', 'Brianna'])
    expect(summary.hiddenCount).toBe(1)
  })

  it('marks missing lead and ignores non-coverage statuses', () => {
    const summary = summarizeCalendarCell([
      { id: '1', full_name: 'Alyce', shift_type: 'night', role: 'staff', status: 'sick' },
      { id: '2', full_name: 'Brianna', shift_type: 'night', role: 'staff', status: 'called_off' },
    ])

    expect(summary.leadName).toBeNull()
    expect(summary.missingLead).toBe(true)
    expect(summary.coverageCount).toBe(0)
    expect(summary.hiddenCount).toBe(0)
  })
})
