'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { can } from '@/lib/auth/can'
import { MANAGED_TEAM_ROLE_VALUES, parseRole } from '@/lib/auth/roles'
import { writeAuditLog } from '@/lib/audit-log'
import { normalizeRosterFullName, parseBulkEmployeeRosterText } from '@/lib/employee-roster-bulk'
import { parseTeamQuickEditFormData } from '@/lib/team-quick-edit'
import { parseTherapistRosterSource } from '@/lib/therapist-roster-source'
import { createClient } from '@/lib/supabase/server'

type ManagedRole = 'manager' | 'therapist' | 'lead'
type ShiftType = 'day' | 'night'
type EmploymentType = 'full_time' | 'part_time' | 'prn'
type EmployeeRosterSnapshotRow = {
  id?: string
  full_name?: string | null
  normalized_full_name?: string | null
  phone_number?: string | null
  role?: ManagedRole | null
  shift_type?: ShiftType | null
  employment_type?: EmploymentType | null
  max_work_days_per_week?: number | null
  is_lead_eligible?: boolean | null
  is_active?: boolean | null
  matched_profile_id?: string | null
  matched_email?: string | null
  matched_at?: string | null
  created_by?: string | null
  updated_by?: string | null
}

function buildTeamUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    search.set(key, value)
  }
  const query = search.toString()
  return query.length > 0 ? `/team?${query}` : '/team'
}

function buildRosterAdminUrl(params: Record<string, string | undefined>): string {
  return buildTeamUrl({ ...params, tab: 'roster' })
}

function buildWorkPatternsUrl(params: Record<string, string | undefined> = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    search.set(key, value)
  }
  const query = search.toString()
  return query.length > 0 ? `/team/work-patterns?${query}` : '/team/work-patterns'
}

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_directory', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    redirect('/dashboard/staff')
  }

  return { supabase, userId: user.id }
}

function getTodayKey(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function realignFutureDraftShiftsForEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string
): Promise<void> {
  const { data: draftCycles, error: draftCyclesError } = await supabase
    .from('schedule_cycles')
    .select('id')
    .eq('published', false)

  if (draftCyclesError) {
    console.error('Failed to load draft cycles for team quick edit realignment:', draftCyclesError)
    return
  }

  const cycleIds = (draftCycles ?? [])
    .map((row) => String((row as { id?: string }).id ?? ''))
    .filter((id) => id.length > 0)

  if (cycleIds.length === 0) return

  const { error: deleteError } = await supabase
    .from('shifts')
    .delete()
    .eq('user_id', employeeId)
    .gte('date', getTodayKey())
    .in('cycle_id', cycleIds)

  if (deleteError) {
    console.error('Failed to realign future draft shifts from team quick edit:', deleteError)
  }
}

export async function saveTeamQuickEditAction(formData: FormData) {
  const parsed = parseTeamQuickEditFormData(formData)

  if (!parsed.ok) {
    redirect(
      buildTeamUrl({
        error: parsed.error,
        edit_profile: parsed.profileId,
      })
    )
  }

  const { supabase, userId } = await requireManager()
  const input = parsed.value

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, archived_at')
    .eq('id', input.profileId)
    .maybeSingle()

  if (profileError || !existingProfile || existingProfile.archived_at) {
    console.error('Failed to load team quick edit profile:', profileError)
    redirect(buildTeamUrl({ error: 'missing_profile' }))
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName,
      role: input.role,
      shift_type: input.shiftType,
      employment_type: input.employmentType,
      is_lead_eligible: input.isLeadEligible,
      on_fmla: input.onFmla,
      fmla_return_date: input.fmlaReturnDate,
      is_active: input.isActive,
    })
    .eq('id', input.profileId)

  if (updateError) {
    console.error('Failed to save team quick edit profile:', updateError)
    redirect(
      buildTeamUrl({
        error: 'update_failed',
        edit_profile: input.profileId,
      })
    )
  }

  if (!input.isActive || input.onFmla || input.role === 'manager') {
    await realignFutureDraftShiftsForEmployee(supabase, input.profileId)
  }

  await writeAuditLog(supabase, {
    userId,
    action: 'team_profile_updated',
    targetType: 'profile',
    targetId: input.profileId,
  })

  // Upsert or clear the recurring work pattern
  if (input.workPattern.hasPattern) {
    const { error: patternError } = await supabase.from('work_patterns').upsert(
      {
        therapist_id: input.profileId,
        works_dow: input.workPattern.worksDow,
        offs_dow: input.workPattern.offsDow,
        works_dow_mode: input.workPattern.worksDowMode,
        weekend_rotation: input.workPattern.weekendRotation,
        weekend_anchor_date: input.workPattern.weekendAnchorDate,
        shift_preference: 'either',
      },
      { onConflict: 'therapist_id' }
    )
    if (patternError) {
      console.error('Failed to save work pattern:', patternError)
    }
  } else {
    await supabase.from('work_patterns').delete().eq('therapist_id', input.profileId)
  }

  revalidatePath('/team')
  revalidatePath('/availability')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/dashboard/manager')

  redirect(buildTeamUrl({ success: 'profile_saved' }))
}

function parseDowValues(values: FormDataEntryValue[]): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    )
  ).sort((a, b) => a - b)
}

function isSaturdayDate(value: string): boolean {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getDay() === 6
}

export async function saveWorkPatternAction(formData: FormData) {
  const { supabase } = await requireManager()

  const therapistId = String(formData.get('therapist_id') ?? '').trim()
  if (!therapistId) {
    redirect(buildWorkPatternsUrl({ error: 'missing_profile' }))
  }

  const worksDow = parseDowValues(formData.getAll('works_dow'))
  const offsDow = parseDowValues(formData.getAll('offs_dow'))
  const worksDowModeRaw = String(formData.get('works_dow_mode') ?? 'hard').trim()
  const worksDowMode: 'hard' | 'soft' = worksDowModeRaw === 'soft' ? 'soft' : 'hard'
  const weekendRotationRaw = String(formData.get('weekend_rotation') ?? 'none').trim()
  const weekendRotation: 'none' | 'every_other' =
    weekendRotationRaw === 'every_other' ? 'every_other' : 'none'
  const weekendAnchorDateRaw = String(formData.get('weekend_anchor_date') ?? '').trim()
  const weekendAnchorDate =
    weekendRotation === 'every_other' && weekendAnchorDateRaw ? weekendAnchorDateRaw : null

  if (weekendAnchorDate && !isSaturdayDate(weekendAnchorDate)) {
    redirect(
      buildWorkPatternsUrl({
        error: 'invalid_weekend_anchor',
        edit_profile: therapistId,
      })
    )
  }

  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_active, archived_at')
    .eq('id', therapistId)
    .maybeSingle()

  if (
    profileError ||
    !existingProfile ||
    existingProfile.archived_at ||
    existingProfile.is_active === false ||
    (existingProfile.role !== 'therapist' && existingProfile.role !== 'lead')
  ) {
    console.error('Failed to load work-pattern profile:', profileError)
    redirect(buildWorkPatternsUrl({ error: 'missing_profile' }))
  }

  const shouldDeletePattern =
    worksDow.length === 0 &&
    offsDow.length === 0 &&
    weekendRotation === 'none' &&
    !weekendAnchorDate

  if (shouldDeletePattern) {
    const { error: deleteError } = await supabase
      .from('work_patterns')
      .delete()
      .eq('therapist_id', therapistId)

    if (deleteError) {
      console.error('Failed to delete work pattern:', deleteError)
      redirect(
        buildWorkPatternsUrl({
          error: 'work_pattern_save_failed',
          edit_profile: therapistId,
        })
      )
    }
  } else {
    const { error: patternError } = await supabase.from('work_patterns').upsert(
      {
        therapist_id: therapistId,
        works_dow: worksDow,
        offs_dow: offsDow,
        works_dow_mode: worksDowMode,
        weekend_rotation: weekendRotation,
        weekend_anchor_date: weekendAnchorDate,
        shift_preference: 'either',
      },
      { onConflict: 'therapist_id' }
    )

    if (patternError) {
      console.error('Failed to save isolated work pattern:', patternError)
      redirect(
        buildWorkPatternsUrl({
          error: 'work_pattern_save_failed',
          edit_profile: therapistId,
        })
      )
    }
  }

  revalidatePath('/team/work-patterns')
  revalidatePath('/team')
  revalidatePath('/availability')
  revalidatePath('/coverage')
  revalidatePath('/schedule')

  redirect('/team/work-patterns?success=work_pattern_saved')
}

export async function bulkUpdateTeamMembersAction(formData: FormData) {
  const { supabase } = await requireManager()

  const rawIds = formData
    .getAll('profile_ids')
    .map((v) => String(v ?? '').trim())
    .filter((id) => id.length > 0)
  const profileIds = [...new Set(rawIds)]

  if (profileIds.length === 0) {
    redirect(buildTeamUrl({ error: 'bulk_empty' }))
  }

  const action = String(formData.get('bulk_action') ?? '').trim()
  const bulkValueRaw = formData.get('bulk_value')
  const bulkValue = bulkValueRaw != null ? String(bulkValueRaw).trim() : ''

  const { data: rows, error: loadError } = await supabase
    .from('profiles')
    .select('id, role, archived_at')
    .in('id', profileIds)

  if (loadError || !rows || rows.length !== profileIds.length) {
    console.error('Bulk team update: profile lookup failed', loadError)
    redirect(buildTeamUrl({ error: 'bulk_invalid_profiles' }))
  }

  for (const row of rows) {
    if (row.archived_at) {
      redirect(buildTeamUrl({ error: 'bulk_invalid_profiles' }))
    }
    const role = row.role as string | null
    if (!role || !(MANAGED_TEAM_ROLE_VALUES as readonly string[]).includes(role)) {
      redirect(buildTeamUrl({ error: 'bulk_invalid_profiles' }))
    }
  }

  type ProfilesPatch = {
    on_fmla?: boolean
    is_active?: boolean
    employment_type?: EmploymentType
  }

  let patch: ProfilesPatch | null = null

  switch (action) {
    case 'set_fmla_on':
      patch = { on_fmla: true }
      break
    case 'set_fmla_off':
      patch = { on_fmla: false }
      break
    case 'set_inactive':
      patch = { is_active: false }
      break
    case 'set_active':
      patch = { is_active: true }
      break
    case 'set_employment_type': {
      const et = parseEmploymentType(bulkValue)
      if (!et) {
        redirect(buildTeamUrl({ error: 'bulk_invalid_employment' }))
      }
      patch = { employment_type: et }
      break
    }
    default:
      redirect(buildTeamUrl({ error: 'bulk_invalid_action' }))
  }

  const { error: updateError } = await supabase.from('profiles').update(patch).in('id', profileIds)

  if (updateError) {
    console.error('Bulk team update failed:', updateError)
    redirect(buildTeamUrl({ error: 'bulk_update_failed' }))
  }

  if (action === 'set_inactive' || action === 'set_fmla_on') {
    for (const id of profileIds) {
      await realignFutureDraftShiftsForEmployee(supabase, id)
    }
  }

  revalidatePath('/team')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/dashboard/manager')

  redirect(
    buildTeamUrl({
      success: 'bulk_updated',
      bulk_count: String(profileIds.length),
    })
  )
}

export async function archiveTeamMemberAction(formData: FormData) {
  const profileId = String(formData.get('profile_id') ?? '').trim()
  if (!profileId) {
    redirect(buildTeamUrl({ error: 'missing_profile' }))
  }

  const { supabase, userId } = await requireManager()
  const { data: existingProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, is_active, archived_at')
    .eq('id', profileId)
    .maybeSingle()

  if (profileError || !existingProfile || existingProfile.archived_at) {
    console.error('Failed to load team member for archive:', profileError)
    redirect(buildTeamUrl({ error: 'missing_profile' }))
  }

  if (existingProfile.is_active !== false) {
    redirect(buildTeamUrl({ error: 'archive_requires_inactive', edit_profile: profileId }))
  }

  const archivedAt = new Date().toISOString()
  const { error: archiveError } = await supabase
    .from('profiles')
    .update({
      archived_at: archivedAt,
      archived_by: userId,
      is_active: false,
    })
    .eq('id', profileId)

  if (archiveError) {
    console.error('Failed to archive team member:', archiveError)
    redirect(buildTeamUrl({ error: 'archive_failed', edit_profile: profileId }))
  }

  await realignFutureDraftShiftsForEmployee(supabase, profileId)

  revalidatePath('/team')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/dashboard/manager')

  redirect(buildTeamUrl({ success: 'profile_archived' }))
}

function parseManagedRole(value: FormDataEntryValue | null): ManagedRole | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'manager' || raw === 'therapist' || raw === 'lead') return raw
  return null
}

function parseShiftType(value: FormDataEntryValue | null): ShiftType | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'day' || raw === 'night') return raw
  return null
}

function parseEmploymentType(value: FormDataEntryValue | null): EmploymentType | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'full_time' || raw === 'part_time' || raw === 'prn') return raw
  return null
}

function mapRosterSnapshotForRestore(row: EmployeeRosterSnapshotRow) {
  return {
    id: String(row.id ?? ''),
    full_name: String(row.full_name ?? ''),
    normalized_full_name: String(row.normalized_full_name ?? ''),
    phone_number: row.phone_number ?? null,
    role: (row.role ?? 'therapist') as ManagedRole,
    shift_type: (row.shift_type ?? 'day') as ShiftType,
    employment_type: (row.employment_type ?? 'full_time') as EmploymentType,
    max_work_days_per_week: Number(row.max_work_days_per_week ?? 3),
    is_lead_eligible: row.is_lead_eligible === true,
    is_active: row.is_active !== false,
    matched_profile_id: row.matched_profile_id ?? null,
    matched_email: row.matched_email ?? null,
    matched_at: row.matched_at ?? null,
    created_by: row.created_by ?? null,
    updated_by: row.updated_by ?? null,
  }
}

export async function upsertEmployeeRosterEntryAction(formData: FormData) {
  const { supabase, userId } = await requireManager()

  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) {
    redirect(buildRosterAdminUrl({ error: 'roster_missing_name' }))
  }

  const role = parseManagedRole(formData.get('role'))
  if (!role) {
    redirect(buildRosterAdminUrl({ error: 'roster_invalid_role' }))
  }

  const shiftType = parseShiftType(formData.get('shift_type'))
  if (!shiftType) {
    redirect(buildRosterAdminUrl({ error: 'roster_invalid_shift' }))
  }

  const employmentType = parseEmploymentType(formData.get('employment_type'))
  if (!employmentType) {
    redirect(buildRosterAdminUrl({ error: 'roster_invalid_employment' }))
  }

  const maxDays = Number(formData.get('max_work_days_per_week') ?? 3)
  if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 7) {
    redirect(buildRosterAdminUrl({ error: 'roster_invalid_max_days' }))
  }

  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const isLeadEligible = formData.get('is_lead_eligible') === 'on'

  const { error } = await supabase.from('employee_roster').upsert(
    {
      full_name: fullName,
      normalized_full_name: normalizeRosterFullName(fullName),
      phone_number: phoneNumber || null,
      role,
      shift_type: shiftType,
      employment_type: employmentType,
      max_work_days_per_week: maxDays,
      is_lead_eligible: isLeadEligible,
      is_active: true,
      updated_by: userId,
      created_by: userId,
    },
    { onConflict: 'normalized_full_name' }
  )

  if (error) {
    console.error('Failed to upsert employee roster entry:', error)
    redirect(buildRosterAdminUrl({ error: 'roster_save_failed' }))
  }

  revalidatePath('/team')
  redirect(buildRosterAdminUrl({ success: 'roster_saved' }))
}

export async function bulkUpsertEmployeeRosterAction(formData: FormData) {
  const { supabase, userId } = await requireManager()
  const text = String(formData.get('bulk_roster_text') ?? '')
  const parsed = parseBulkEmployeeRosterText(text)
  if (!parsed.ok) {
    console.error('Bulk roster parse error:', parsed.message)
    redirect(
      buildRosterAdminUrl({
        error: 'roster_bulk_invalid',
        bulk_line: String(parsed.line),
      })
    )
  }
  if (parsed.rows.length === 0) {
    redirect(buildRosterAdminUrl({ error: 'roster_bulk_empty' }))
  }

  const payload = parsed.rows.map((row) => ({
    ...row,
    updated_by: userId,
    created_by: userId,
  }))

  const { error } = await supabase.from('employee_roster').upsert(payload, {
    onConflict: 'normalized_full_name',
  })

  if (error) {
    console.error('Failed bulk upsert employee roster:', error)
    redirect(buildRosterAdminUrl({ error: 'roster_bulk_save_failed' }))
  }

  revalidatePath('/team')
  redirect(
    buildRosterAdminUrl({
      success: 'roster_bulk_saved',
      roster_bulk_count: String(payload.length),
    })
  )
}

export async function replaceTherapistRosterAction(formData: FormData) {
  const { supabase, userId } = await requireManager()
  const text = String(formData.get('therapist_roster_source') ?? '')
  const parsed = parseTherapistRosterSource(text)

  if (!parsed.ok) {
    console.error('Therapist roster source parse error:', parsed.message)
    redirect(
      buildRosterAdminUrl({
        error: 'therapist_roster_invalid',
        bulk_line: String(parsed.line),
      })
    )
  }

  if (parsed.rows.length === 0) {
    redirect(buildRosterAdminUrl({ error: 'therapist_roster_empty' }))
  }

  const payload = parsed.rows.map((row) => ({
    ...row,
    created_by: userId,
    updated_by: userId,
  }))
  const normalizedNames = new Set(payload.map((row) => row.normalized_full_name))
  const { data: existingTherapistLeadRows, error: existingTherapistLeadError } = await supabase
    .from('employee_roster')
    .select(
      'id, full_name, normalized_full_name, phone_number, role, shift_type, employment_type, max_work_days_per_week, is_lead_eligible, is_active, matched_profile_id, matched_email, matched_at, created_by, updated_by'
    )
    .in('role', ['therapist', 'lead'])

  if (existingTherapistLeadError) {
    console.error('Failed to load current therapist roster rows:', existingTherapistLeadError)
    redirect(buildRosterAdminUrl({ error: 'therapist_roster_replace_failed' }))
  }

  const priorSnapshot = (existingTherapistLeadRows ?? []) as EmployeeRosterSnapshotRow[]
  const priorSnapshotPayload = priorSnapshot.map(mapRosterSnapshotForRestore)
  const priorNormalizedNames = new Set(priorSnapshotPayload.map((row) => row.normalized_full_name))
  const replacementOnlyNames = payload
    .map((row) => row.normalized_full_name)
    .filter((name) => !priorNormalizedNames.has(name))

  async function rollbackRosterSnapshot() {
    if (priorSnapshotPayload.length > 0) {
      const { error: restoreError } = await supabase
        .from('employee_roster')
        .upsert(priorSnapshotPayload, { onConflict: 'normalized_full_name' })

      if (restoreError) {
        console.error('Failed to restore prior therapist roster snapshot:', restoreError)
      }
    }

    if (replacementOnlyNames.length > 0) {
      const { error: cleanupError } = await supabase
        .from('employee_roster')
        .delete()
        .in('normalized_full_name', replacementOnlyNames)
        .in('role', ['therapist', 'lead'])

      if (cleanupError) {
        console.error('Failed to remove replacement-only therapist roster rows:', cleanupError)
      }
    }
  }

  const { data: conflictingRosterRows, error: conflictingRosterError } = await supabase
    .from('employee_roster')
    .select('id, normalized_full_name, role')
    .in(
      'normalized_full_name',
      payload.map((row) => row.normalized_full_name)
    )

  if (conflictingRosterError) {
    console.error('Failed to check therapist roster conflicts:', conflictingRosterError)
    redirect(buildRosterAdminUrl({ error: 'therapist_roster_replace_failed' }))
  }

  const managerConflict = (conflictingRosterRows ?? []).some(
    (row) => (row as { role?: string | null }).role === 'manager'
  )
  if (managerConflict) {
    console.error('Therapist roster replacement conflicts with manager roster entries')
    redirect(buildRosterAdminUrl({ error: 'therapist_roster_replace_failed' }))
  }

  const { error: upsertError } = await supabase.from('employee_roster').upsert(payload, {
    onConflict: 'normalized_full_name',
  })

  if (upsertError) {
    console.error('Failed to stage therapist roster replacement rows:', upsertError)
    redirect(buildRosterAdminUrl({ error: 'therapist_roster_replace_failed' }))
  }

  const staleRosterIds = (existingTherapistLeadRows ?? [])
    .filter(
      (row) =>
        !normalizedNames.has(
          String((row as { normalized_full_name?: string }).normalized_full_name ?? '')
        )
    )
    .map((row) => String((row as { id?: string }).id ?? ''))
    .filter((id) => id.length > 0)

  const preservedLinkedProfileIds = new Set(
    (existingTherapistLeadRows ?? [])
      .filter((row) =>
        normalizedNames.has(
          String((row as { normalized_full_name?: string }).normalized_full_name ?? '')
        )
      )
      .map((row) =>
        String((row as { matched_profile_id?: string | null }).matched_profile_id ?? '')
      )
      .filter((id) => id.length > 0)
  )

  const staleLinkedProfileIds = new Set(
    (existingTherapistLeadRows ?? [])
      .filter(
        (row) =>
          !normalizedNames.has(
            String((row as { normalized_full_name?: string }).normalized_full_name ?? '')
          )
      )
      .map((row) =>
        String((row as { matched_profile_id?: string | null }).matched_profile_id ?? '')
      )
      .filter((id) => id.length > 0 && !preservedLinkedProfileIds.has(id))
  )

  if (staleRosterIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('employee_roster')
      .delete()
      .in('id', staleRosterIds)

    if (deleteError) {
      console.error('Failed to clear stale therapist roster rows:', deleteError)
      await rollbackRosterSnapshot()
      redirect(buildRosterAdminUrl({ error: 'therapist_roster_replace_failed' }))
    }
  }

  const { data: activeTherapistLeadProfiles, error: activeProfilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['therapist', 'lead'])
    .eq('is_active', true)
    .is('archived_at', null)

  if (activeProfilesError) {
    console.error('Failed to load active therapist roster profiles:', activeProfilesError)
    await rollbackRosterSnapshot()
    redirect(buildRosterAdminUrl({ error: 'therapist_roster_replace_failed' }))
  }

  const staleProfileIds = (activeTherapistLeadProfiles ?? [])
    .filter((profile) => {
      const profileId = String((profile as { id?: string }).id ?? '')
      if (!profileId) return false
      if (preservedLinkedProfileIds.has(profileId)) return false
      if (staleLinkedProfileIds.has(profileId)) return true
      const normalized = normalizeRosterFullName(
        String((profile as { full_name?: string | null }).full_name ?? '')
      )
      return normalized.length > 0 && !normalizedNames.has(normalized)
    })
    .map((profile) => String((profile as { id?: string }).id ?? ''))
    .filter((id) => id.length > 0)

  if (staleProfileIds.length > 0) {
    const archivedAt = new Date().toISOString()
    const { error: archiveError } = await supabase
      .from('profiles')
      .update({
        archived_at: archivedAt,
        archived_by: userId,
        is_active: false,
      })
      .in('id', staleProfileIds)

    if (archiveError) {
      console.error('Failed to archive stale therapist roster profiles:', archiveError)
      await rollbackRosterSnapshot()
      redirect(buildRosterAdminUrl({ error: 'therapist_roster_replace_failed' }))
    }

    for (const profileId of staleProfileIds) {
      await realignFutureDraftShiftsForEmployee(supabase, profileId)
    }
  }

  revalidatePath('/team')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/dashboard/manager')
  revalidatePath('/availability')

  redirect(
    buildRosterAdminUrl({
      success: 'therapist_roster_replaced',
      roster_bulk_count: String(payload.length),
    })
  )
}

export async function deleteEmployeeRosterEntryAction(formData: FormData) {
  const { supabase } = await requireManager()
  const rosterId = String(formData.get('roster_id') ?? '').trim()
  if (!rosterId) {
    redirect(buildRosterAdminUrl({ error: 'roster_missing_entry' }))
  }

  const { error } = await supabase.from('employee_roster').delete().eq('id', rosterId)
  if (error) {
    console.error('Failed to delete employee roster entry:', error)
    redirect(buildRosterAdminUrl({ error: 'roster_delete_failed' }))
  }

  revalidatePath('/team')
  redirect(buildRosterAdminUrl({ success: 'roster_deleted' }))
}
