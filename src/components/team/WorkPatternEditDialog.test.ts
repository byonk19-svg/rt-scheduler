import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { validateWeekendAnchorDate } from '@/components/team/WorkPatternEditDialog'

const dialogSource = readFileSync(
  resolve(process.cwd(), 'src/components/team/WorkPatternEditDialog.tsx'),
  'utf8'
)
const scheduleFieldsSource = readFileSync(
  resolve(process.cwd(), 'src/components/team/WorkPatternScheduleFields.tsx'),
  'utf8'
)

describe('validateWeekendAnchorDate', () => {
  it('accepts Saturdays and rejects other days', () => {
    expect(validateWeekendAnchorDate('2026-04-18')).toBeNull()
    expect(validateWeekendAnchorDate('2026-04-17')).toBe('Weekend anchor date must be a Saturday.')
  })

  it('keeps recurring day and weekend controls in a dedicated schedule-fields component', () => {
    expect(dialogSource).toContain('WorkPatternScheduleFields')
    expect(scheduleFieldsSource).toContain('Days they never work')
    expect(scheduleFieldsSource).toContain('Weekend rotation')
  })
})
