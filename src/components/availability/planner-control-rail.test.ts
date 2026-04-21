import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PlannerControlRail } from '@/components/availability/planner-control-rail'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/availability/planner-control-rail.tsx'),
  'utf8'
)
const selectedDatesFormSource = readFileSync(
  resolve(process.cwd(), 'src/components/availability/PlannerSelectedDatesForm.tsx'),
  'utf8'
)

const baseProps = {
  cycles: [
    {
      id: 'cycle-1',
      label: 'Apr 2026',
      start_date: '2026-03-22',
      end_date: '2026-05-02',
    },
  ],
  therapists: [
    {
      id: 'therapist-1',
      full_name: 'Barbara C.',
      shift_type: 'day' as const,
      employment_type: 'full_time' as const,
    },
  ],
  selectedCycleId: 'cycle-1',
  selectedTherapistId: 'therapist-1',
  selectedTherapist: {
    id: 'therapist-1',
    full_name: 'Barbara C.',
    shift_type: 'day' as const,
    employment_type: 'full_time' as const,
  },
  onCycleChange: () => {},
  onTherapistChange: () => {},
  onModeChange: () => {},
  onClearSelectedDates: () => {},
  onRemoveSelectedDate: () => {},
  copyAction: async () => {},
  saveAction: async () => {},
}

describe('PlannerControlRail', () => {
  it('renders the main planner controls and disabled save label when no dates are selected', () => {
    const html = renderToStaticMarkup(
      createElement(PlannerControlRail, {
        ...baseProps,
        mode: 'will_work',
        selectedDates: [],
      })
    )

    expect(html).toContain('Schedule cycle')
    expect(html).toContain('Therapist')
    expect(html).toContain('Will work')
    expect(html).toContain('Cannot work')
    expect(html).toContain('Copy from last block')
    expect(html).toContain('Selected dates')
    expect(html).toContain('Select dates to save')
    expect(html).not.toContain('Save 0 will-work dates')
  })

  it('shows the selected dates summary and singular will-work save label', () => {
    const html = renderToStaticMarkup(
      createElement(PlannerControlRail, {
        ...baseProps,
        mode: 'will_work',
        selectedDates: ['2026-03-24'],
      })
    )

    expect(html).toContain('1 selected')
    expect(html).toContain('Mar 24, 2026')
    expect(html).toContain('Save 1 will-work date')
  })

  it('keeps selected-date save handling in a dedicated form component', () => {
    expect(source).toContain('PlannerSelectedDatesForm')
    expect(selectedDatesFormSource).toContain('Select dates to save')
    expect(selectedDatesFormSource).toContain('Clear selected dates')
  })
})
