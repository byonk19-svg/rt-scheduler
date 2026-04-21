import { describe, expect, it } from 'vitest'

import {
  mapAvailabilityRowsToTableRows,
  selectAvailabilityCycle,
  type AvailabilityCycle,
  type AvailabilityOverrideRow,
} from '@/lib/availability-page-data'

describe('availability-page-data', () => {
  it('prefers the requested cycle, then an unpublished cycle, then the first cycle', () => {
    const cycles: AvailabilityCycle[] = [
      {
        id: 'published',
        label: 'Published',
        start_date: '2026-04-01',
        end_date: '2026-04-14',
        published: true,
      },
      {
        id: 'draft',
        label: 'Draft',
        start_date: '2026-04-15',
        end_date: '2026-04-28',
        published: false,
      },
    ]

    expect(selectAvailabilityCycle(cycles, 'published')?.id).toBe('published')
    expect(selectAvailabilityCycle(cycles)?.id).toBe('draft')
    expect(selectAvailabilityCycle([cycles[0]])?.id).toBe('published')
  })

  it('maps availability overrides into the shared table row shape', () => {
    const rows: AvailabilityOverrideRow[] = [
      {
        id: 'row-1',
        date: '2026-04-18',
        shift_type: 'both',
        override_type: 'force_off',
        note: 'Family event',
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-02T00:00:00.000Z',
        therapist_id: 'ther-1',
        cycle_id: 'cycle-1',
        profiles: { full_name: 'Aleyce L.' },
        schedule_cycles: { label: 'Cycle 1', start_date: '2026-04-15', end_date: '2026-04-28' },
      },
    ]

    expect(mapAvailabilityRowsToTableRows(rows)).toEqual([
      {
        id: 'row-1',
        therapistId: 'ther-1',
        cycleId: 'cycle-1',
        date: '2026-04-18',
        reason: 'Family event',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-02T00:00:00.000Z',
        requestedBy: 'Aleyce L.',
        cycleLabel: 'Cycle 1 (2026-04-15 to 2026-04-28)',
        entryType: 'force_off',
        shiftType: 'both',
        canDelete: true,
      },
    ])
  })
})
