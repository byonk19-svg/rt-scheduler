import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  buildRosterSections,
  chunkRosterWeeks,
  resolveRosterCellIntent,
  type RosterMemberRow,
} from '@/components/coverage/RosterScheduleView'

const rosterScheduleViewSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/RosterScheduleView.tsx'),
  'utf8'
)
const mobileRosterDayCardsSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/MobileRosterDayCards.tsx'),
  'utf8'
)
const rosterScheduleHeaderSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/RosterScheduleHeader.tsx'),
  'utf8'
)
const rosterScheduleDesktopSource = readFileSync(
  resolve(process.cwd(), 'src/components/coverage/RosterScheduleDesktop.tsx'),
  'utf8'
)

function makeMember(overrides: Partial<RosterMemberRow> = {}): RosterMemberRow {
  return {
    id: 'member-1',
    full_name: 'Barbara C.',
    role: 'therapist',
    employment_type: 'full_time',
    ...overrides,
  }
}

describe('buildRosterSections', () => {
  it('keeps leads first inside the regular section and moves PRN below it', () => {
    const result = buildRosterSections([
      makeMember({ id: 't-1', full_name: 'Barbara C.', role: 'therapist', employment_type: 'full_time' }),
      makeMember({ id: 'l-1', full_name: 'Brianna Yonkin', role: 'lead', employment_type: 'full_time' }),
      makeMember({ id: 'p-1', full_name: 'Roy H.', role: 'therapist', employment_type: 'prn' }),
      makeMember({ id: 'p-2', full_name: 'Demo Lead (Night)', role: 'lead', employment_type: 'prn' }),
    ])

    expect(result.regularRows.map((row) => row.full_name)).toEqual(['Brianna Yonkin', 'Barbara C.'])
    expect(result.prnRows.map((row) => row.full_name)).toEqual(['Demo Lead (Night)', 'Roy H.'])
  })
})

describe('chunkRosterWeeks', () => {
  it('groups cycle dates into 7-day weeks in order', () => {
    const result = chunkRosterWeeks([
      '2026-03-22',
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
    ])

    expect(result).toEqual([
      ['2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28'],
      ['2026-03-29', '2026-03-30'],
    ])
  })
})

describe('resolveRosterCellIntent', () => {
  it('gives managers quick-assign on empty cells and actions on filled cells', () => {
    expect(resolveRosterCellIntent(true, true, false)).toBe('quick_assign')
    expect(resolveRosterCellIntent(true, true, true)).toBe('manage')
  })

  it('gives non-manager leads status editing only when a shift exists', () => {
    expect(resolveRosterCellIntent(false, true, true)).toBe('status')
    expect(resolveRosterCellIntent(false, true, false)).toBe('none')
  })

  it('returns none for read-only cells', () => {
    expect(resolveRosterCellIntent(false, false, true)).toBe('none')
  })
})

describe('RosterScheduleView framing', () => {
  it('keeps mobile day cards in a dedicated component', () => {
    expect(mobileRosterDayCardsSource).toContain('Open day editor')
    expect(mobileRosterDayCardsSource).toContain('PRN coverage')
    expect(rosterScheduleViewSource).toContain('MobileRosterDayCards')
  })

  it('keeps roster legend and heading chrome in a dedicated component', () => {
    expect(rosterScheduleHeaderSource).toContain('Roster matrix legend')
    expect(rosterScheduleHeaderSource).toContain('Operational status')
    expect(rosterScheduleViewSource).toContain('RosterScheduleHeader')
  })

  it('keeps desktop roster matrix rendering in a dedicated component', () => {
    expect(rosterScheduleDesktopSource).toContain('Clinical staff')
    expect(rosterScheduleDesktopSource).toContain('Active tally')
    expect(rosterScheduleViewSource).toContain('RosterSection')
  })
})
