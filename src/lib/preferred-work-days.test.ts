import { describe, expect, it } from 'vitest'

import { parsePreferredWorkDaysSelection } from '@/lib/preferred-work-days'

describe('parsePreferredWorkDaysSelection', () => {
  it('returns unset when the form does not include a mode', () => {
    expect(parsePreferredWorkDaysSelection(new FormData())).toEqual({
      mode: 'unset',
      days: [],
    })
  })

  it('returns no_preference with no saved days', () => {
    const formData = new FormData()
    formData.set('preferred_work_days_mode', 'no_preference')
    formData.append('preferred_work_days', '1')
    formData.append('preferred_work_days', '4')

    expect(parsePreferredWorkDaysSelection(formData)).toEqual({
      mode: 'no_preference',
      days: [],
    })
  })

  it('returns specific_days with normalized weekdays', () => {
    const formData = new FormData()
    formData.set('preferred_work_days_mode', 'specific_days')
    formData.append('preferred_work_days', '4')
    formData.append('preferred_work_days', '1')
    formData.append('preferred_work_days', '4')
    formData.append('preferred_work_days', '8')

    expect(parsePreferredWorkDaysSelection(formData)).toEqual({
      mode: 'specific_days',
      days: [1, 4],
    })
  })
})
