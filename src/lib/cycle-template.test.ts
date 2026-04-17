import { describe, expect, it } from 'vitest'

import {
  applyTemplateToCycle,
  serializeCycleShifts,
  type TemplateShiftData,
} from '@/lib/cycle-template'

describe('cycle template helpers', () => {
  it('serializes cycle shifts into day_of_cycle entries', () => {
    expect(
      serializeCycleShifts(
        [
          {
            user_id: 'ther-1',
            date: '2026-04-10',
            shift_type: 'day',
            role: 'staff',
          },
          {
            user_id: 'ther-2',
            date: '2026-04-12',
            shift_type: 'night',
            role: 'lead',
          },
        ],
        '2026-04-10'
      )
    ).toEqual([
      { user_id: 'ther-1', shift_type: 'day', role: 'staff', day_of_cycle: 0 },
      { user_id: 'ther-2', shift_type: 'night', role: 'lead', day_of_cycle: 2 },
    ])
  })

  it('applies template rows to a new cycle and skips inactive therapists', () => {
    const templateData: TemplateShiftData[] = [
      { user_id: 'ther-1', shift_type: 'day', role: 'staff', day_of_cycle: 0 },
      { user_id: 'ther-2', shift_type: 'night', role: 'lead', day_of_cycle: 3 },
    ]

    expect(applyTemplateToCycle(templateData, '2026-05-01', new Set(['ther-1']))).toEqual([
      {
        user_id: 'ther-1',
        date: '2026-05-01',
        shift_type: 'day',
        status: 'scheduled',
        role: 'staff',
      },
    ])
  })
})
