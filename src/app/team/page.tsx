import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import {
  archiveTeamMemberAction,
  bulkUpsertEmployeeRosterAction,
  deleteEmployeeRosterEntryAction,
  replaceTherapistRosterAction,
  saveTeamQuickEditAction,
  upsertEmployeeRosterEntryAction,
} from '@/app/team/actions'
import { FeedbackToast } from '@/components/feedback-toast'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { TeamWorkspace } from '@/components/team/team-workspace'
import type { WorkPatternRecord } from '@/components/team/team-directory-model'
import { can } from '@/lib/auth/can'
import { MANAGED_TEAM_ROLE_VALUES, parseRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

type ProfileRow = {
  id: string
  full_name: string | null
  role: 'manager' | 'therapist' | 'lead' | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  is_lead_eligible: boolean | null
  is_active: boolean | null
  on_fmla: boolean | null
  fmla_return_date: string | null
  phone_number: string | null
}

type WorkPatternRow = {
  therapist_id: string
  works_dow: number[]
  works_dow_mode: string
  weekend_rotation: string
  weekend_anchor_date: string | null
}

type TeamSearchParams = {
  success?: string | string[]
  error?: string | string[]
  edit_profile?: string | string[]
  bulk_line?: string | string[]
  roster_bulk_count?: string | string[]
  tab?: string | string[]
}

type EmployeeRosterRow = {
  id: string
  full_name: string
  role: 'manager' | 'therapist' | 'lead'
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
  max_work_days_per_week: number
  is_lead_eligible: boolean
  matched_profile_id: string | null
  matched_at: string | null
  phone_number: string | null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getTeamFeedback(params?: TeamSearchParams): {
  message: string
  variant: 'success' | 'error'
} | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'profile_saved') {
    return { message: 'Team member updated.', variant: 'success' }
  }

  if (success === 'profile_archived') {
    return { message: 'Team member archived.', variant: 'success' }
  }
  if (success === 'roster_saved') {
    return { message: 'Employee roster entry saved.', variant: 'success' }
  }
  if (success === 'roster_deleted') {
    return { message: 'Employee roster entry removed.', variant: 'success' }
  }
  if (success === 'roster_bulk_saved') {
    const count = getSearchParam(params?.roster_bulk_count) ?? ''
    const suffix = count ? ` (${count} rows)` : ''
    return { message: `Employee roster bulk import saved.${suffix}`, variant: 'success' }
  }
  if (success === 'therapist_roster_replaced') {
    const count = getSearchParam(params?.roster_bulk_count) ?? ''
    const suffix = count ? ` (${count} therapists)` : ''
    return { message: `Therapist roster replaced.${suffix}`, variant: 'success' }
  }

  if (error === 'missing_profile') {
    return { message: 'Could not find that team member.', variant: 'error' }
  }

  if (error === 'missing_name') {
    return { message: 'Name is required.', variant: 'error' }
  }

  if (error === 'invalid_role') {
    return { message: 'Choose a valid role.', variant: 'error' }
  }

  if (error === 'invalid_shift') {
    return { message: 'Choose a valid shift.', variant: 'error' }
  }

  if (error === 'invalid_employment') {
    return { message: 'Choose a valid employment type.', variant: 'error' }
  }

  if (error === 'update_failed') {
    return { message: 'Could not save team member changes. Please try again.', variant: 'error' }
  }

  if (error === 'archive_requires_inactive') {
    return { message: 'Only inactive team members can be archived.', variant: 'error' }
  }

  if (error === 'archive_failed') {
    return { message: 'Could not archive that team member. Please try again.', variant: 'error' }
  }
  if (error === 'roster_missing_name') {
    return { message: 'Employee roster name is required.', variant: 'error' }
  }
  if (error === 'roster_invalid_role') {
    return { message: 'Employee roster role is invalid.', variant: 'error' }
  }
  if (error === 'roster_invalid_shift') {
    return { message: 'Employee roster shift is invalid.', variant: 'error' }
  }
  if (error === 'roster_invalid_employment') {
    return { message: 'Employee roster employment type is invalid.', variant: 'error' }
  }
  if (error === 'roster_invalid_max_days') {
    return { message: 'Employee roster max days must be between 1 and 7.', variant: 'error' }
  }
  if (error === 'roster_save_failed') {
    return { message: 'Could not save employee roster entry.', variant: 'error' }
  }
  if (error === 'roster_delete_failed') {
    return { message: 'Could not remove employee roster entry.', variant: 'error' }
  }
  if (error === 'roster_missing_entry') {
    return { message: 'Employee roster entry is missing.', variant: 'error' }
  }
  if (error === 'roster_bulk_empty') {
    return { message: 'Bulk import had no valid lines.', variant: 'error' }
  }
  if (error === 'roster_bulk_invalid') {
    const line = getSearchParam(params?.bulk_line)
    return {
      message: `Bulk import failed${line ? ` on line ${line}` : ''}. Check name and column format.`,
      variant: 'error',
    }
  }
  if (error === 'roster_bulk_save_failed') {
    return { message: 'Bulk import could not be saved. Try again.', variant: 'error' }
  }
  if (error === 'therapist_roster_invalid') {
    const line = getSearchParam(params?.bulk_line)
    return {
      message: `Therapist roster source failed${line ? ` on line ${line}` : ''}. Check the roster format and phone numbers.`,
      variant: 'error',
    }
  }
  if (error === 'therapist_roster_empty') {
    return { message: 'Therapist roster source did not include any therapists.', variant: 'error' }
  }
  if (error === 'therapist_roster_replace_failed') {
    return {
      message: 'Could not replace the therapist roster. Please try again.',
      variant: 'error',
    }
  }

  return null
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<TeamSearchParams>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined

  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (!can(parseRole(profileData?.role), 'access_manager_ui')) {
    redirect('/dashboard/staff')
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, shift_type, employment_type, is_lead_eligible, is_active, on_fmla, fmla_return_date, phone_number'
    )
    .in('role', [...MANAGED_TEAM_ROLE_VALUES])
    .is('archived_at', null)
    .order('full_name', { ascending: true })

  const allProfiles = (profiles ?? []) as ProfileRow[]

  const { data: patternRows } = await supabase
    .from('work_patterns')
    .select(
      'therapist_id, works_dow, offs_dow, works_dow_mode, weekend_rotation, weekend_anchor_date'
    )

  const workPatterns: Record<string, WorkPatternRecord> = {}
  for (const row of (patternRows ?? []) as WorkPatternRow[]) {
    workPatterns[row.therapist_id] = {
      works_dow: row.works_dow,
      offs_dow: (row as { offs_dow?: number[] }).offs_dow ?? [],
      works_dow_mode: row.works_dow_mode === 'soft' ? 'soft' : 'hard',
      weekend_rotation: row.weekend_rotation === 'every_other' ? 'every_other' : 'none',
      weekend_anchor_date: row.weekend_anchor_date ?? null,
    }
  }
  const activeProfiles = allProfiles.filter((profile) => profile.is_active !== false)
  const { data: rosterRows } = await supabase
    .from('employee_roster')
    .select(
      'id, full_name, role, shift_type, employment_type, max_work_days_per_week, is_lead_eligible, matched_profile_id, matched_at, phone_number'
    )
    .order('full_name', { ascending: true })
  const employeeRoster = (rosterRows ?? []) as EmployeeRosterRow[]
  const managerCount = activeProfiles.filter((profile) => profile.role === 'manager').length
  const leadCount = activeProfiles.filter((profile) => profile.role === 'lead').length
  const therapistCount = activeProfiles.filter((profile) => profile.role === 'therapist').length
  const inactiveCount = allProfiles.length - activeProfiles.length
  const onFmlaCount = allProfiles.filter((profile) => profile.on_fmla === true).length
  const dayShiftCount = activeProfiles.filter((profile) => profile.shift_type !== 'night').length
  const nightShiftCount = activeProfiles.filter((profile) => profile.shift_type === 'night').length

  const summary = {
    totalStaff: allProfiles.length,
    managers: managerCount,
    leadTherapists: leadCount,
    therapists: therapistCount,
    dayShift: dayShiftCount,
    nightShift: nightShiftCount,
    inactive: inactiveCount,
    onFmla: onFmlaCount,
  }

  const feedback = getTeamFeedback(params)
  const initialEditProfileId = getSearchParam(params?.edit_profile) ?? null

  return (
    <div className="max-w-6xl space-y-6 py-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <ManagerWorkspaceHeader
        title="Team"
        subtitle="Staffing, roles, team access, and the signup roster live here — switch tabs to browse vs administer."
        className="px-0"
      />

      <Suspense
        fallback={<div className="h-40 animate-pulse rounded-xl bg-muted/30" aria-hidden />}
      >
        <TeamWorkspace
          summary={summary}
          profiles={allProfiles}
          workPatterns={workPatterns}
          initialEditProfileId={initialEditProfileId}
          roster={employeeRoster}
          archiveTeamMemberAction={archiveTeamMemberAction}
          saveTeamQuickEditAction={saveTeamQuickEditAction}
          upsertEmployeeRosterEntryAction={upsertEmployeeRosterEntryAction}
          bulkUpsertEmployeeRosterAction={bulkUpsertEmployeeRosterAction}
          replaceTherapistRosterAction={replaceTherapistRosterAction}
          deleteEmployeeRosterEntryAction={deleteEmployeeRosterEntryAction}
        />
      </Suspense>
    </div>
  )
}
