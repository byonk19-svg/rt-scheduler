import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  partitionTeamProfiles,
  TEAM_LEAD_ROLE_LABEL,
  TEAM_QUICK_EDIT_DIALOG_CLASS,
  teamMemberHasAppAccess,
  type TeamProfileRecord,
} from '@/components/team/team-directory-model'
import { TeamDirectory } from '@/components/team/TeamDirectory'

const directorySource = readFileSync(
  resolve(process.cwd(), 'src/components/team/TeamDirectory.tsx'),
  'utf8'
)

function makeProfile(overrides: Partial<TeamProfileRecord>): TeamProfileRecord {
  return {
    id: overrides.id ?? 'profile-1',
    full_name: overrides.full_name ?? 'Barbara C.',
    role: overrides.role ?? 'therapist',
    shift_type: overrides.shift_type ?? 'day',
    employment_type: overrides.employment_type ?? 'full_time',
    is_lead_eligible: overrides.is_lead_eligible ?? false,
    is_active: overrides.is_active ?? true,
    on_fmla: overrides.on_fmla ?? false,
    fmla_return_date: overrides.fmla_return_date ?? null,
  }
}

describe('TEAM_QUICK_EDIT_DIALOG_CLASS', () => {
  it('keeps the quick edit modal scrollable within the viewport', () => {
    expect(TEAM_QUICK_EDIT_DIALOG_CLASS).toContain('max-h-[calc(100vh-2rem)]')
    expect(TEAM_QUICK_EDIT_DIALOG_CLASS).toContain('overflow-y-auto')
  })

  it('uses the lead therapist label on the team surface', () => {
    expect(TEAM_LEAD_ROLE_LABEL).toBe('Lead Therapist')
  })
})

describe('partitionTeamProfiles', () => {
  it('keeps managers at the top and splits non-managers by shift and role', () => {
    const sections = partitionTeamProfiles([
      makeProfile({ id: 'mgr', role: 'manager' }),
      makeProfile({ id: 'day-lead', role: 'lead', shift_type: 'day' }),
      makeProfile({ id: 'day-ther', role: 'therapist', shift_type: 'day' }),
      makeProfile({ id: 'night-lead', role: 'lead', shift_type: 'night' }),
      makeProfile({ id: 'night-ther', role: 'therapist', shift_type: 'night' }),
      makeProfile({ id: 'inactive-ther', role: 'therapist', is_active: false }),
    ])

    expect(sections.managers.map((profile) => profile.id)).toEqual(['mgr'])
    expect(sections.dayLeads.map((profile) => profile.id)).toEqual(['day-lead'])
    expect(sections.dayTherapists.map((profile) => profile.id)).toEqual(['day-ther'])
    expect(sections.nightLeads.map((profile) => profile.id)).toEqual(['night-lead'])
    expect(sections.nightTherapists.map((profile) => profile.id)).toEqual(['night-ther'])
    expect(sections.inactive.map((profile) => profile.id)).toEqual(['inactive-ther'])
  })
})

describe('teamMemberHasAppAccess', () => {
  it('denies app access to inactive employees', () => {
    expect(teamMemberHasAppAccess(makeProfile({ is_active: false }))).toBe(false)
  })

  it('keeps app access for active employees', () => {
    expect(teamMemberHasAppAccess(makeProfile({ is_active: true }))).toBe(true)
  })
})

describe('TeamDirectory', () => {
  it('hides bulk-selection controls until bulk mode is enabled', () => {
    const html = renderToStaticMarkup(
      createElement(TeamDirectory, {
        summary: {
          totalStaff: 2,
          managers: 0,
          leadTherapists: 1,
          therapists: 1,
          dayShift: 2,
          nightShift: 0,
          inactive: 0,
          onFmla: 0,
        },
        profiles: [
          makeProfile({ id: 'lead-1', role: 'lead' }),
          makeProfile({ id: 'ther-1', role: 'therapist' }),
        ],
        archiveTeamMemberAction: async () => {},
        saveTeamQuickEditAction: async () => {},
        bulkUpdateTeamMembersAction: async () => {},
      })
    )

    expect(html).toContain('Bulk mode')
    expect(html).toContain('Advanced filters')
    expect(html).not.toContain('aria-label="Bulk team actions"')
    expect(html).not.toContain('Select all in')
    expect(directorySource).toContain('showSelectionControls={bulkMode}')
    expect(directorySource).toContain('selectedCount={bulkMode ? selectedIds.size : 0}')
  })
})
