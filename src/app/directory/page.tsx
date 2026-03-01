import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { EmployeeDirectory } from '@/components/EmployeeDirectory'
import { FeedbackToast } from '@/components/feedback-toast'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import {
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'
import {
  buildManagerOverrideInput,
  normalizeEmploymentType,
  normalizeFmlaReturnDate,
  normalizeShiftType,
  type EmployeeDirectoryRecord,
} from '@/lib/employee-directory'
import { dateRange } from '@/lib/calendar-utils'
import { createClient } from '@/lib/supabase/server'

type DirectorySearchParams = {
  error?: string | string[]
  success?: string | string[]
  realigned?: string | string[]
  override_count?: string | string[]
  edit_profile?: string | string[]
  focus?: string | string[]
  override_cycle_id?: string | string[]
  copied?: string | string[]
  skipped?: string | string[]
}

type DirectoryProfileRow = {
  id: string
  role: 'manager' | 'therapist' | null
  full_name: string | null
  email: string | null
  phone_number: string | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  max_work_days_per_week: number | null
  is_lead_eligible: boolean | null
  on_fmla: boolean | null
  fmla_return_date: string | null
  is_active: boolean | null
}

type WorkPatternRow = {
  therapist_id: string
  works_dow: number[] | null
  offs_dow: number[] | null
  weekend_rotation: 'none' | 'every_other' | null
  weekend_anchor_date: string | null
  works_dow_mode: 'hard' | 'soft' | null
  shift_preference: 'day' | 'night' | 'either' | null
}

type ScheduleCycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type AvailabilityOverrideRow = {
  id: string
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
  source: 'therapist' | 'manager'
}

type EmployeeDateOverrideRecord = {
  id: string
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
  source: 'therapist' | 'manager'
}

type EmployeeCycleRecord = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type ToastVariant = 'success' | 'error'

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function isMissingWorkPatternsSchema(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }
  const text = [maybeError.code, maybeError.message, maybeError.details, maybeError.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase()

  return (
    maybeError.code === '42P01' ||
    maybeError.code === '42703' ||
    (text.includes('work_patterns') &&
      (text.includes('does not exist') || text.includes('relation') || text.includes('column')))
  )
}

function isMissingAvailabilityOverridesSchema(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }
  const text = [maybeError.code, maybeError.message, maybeError.details, maybeError.hint]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase()

  return (
    maybeError.code === '42P01' ||
    maybeError.code === '42703' ||
    (text.includes('availability_overrides') &&
      (text.includes('does not exist') || text.includes('relation') || text.includes('column')))
  )
}

function getTodayKey(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDirectoryFeedback(params?: DirectorySearchParams): {
  message: string
  variant: ToastVariant
} | null {
  const error = getSearchParam(params?.error)
  const success = getSearchParam(params?.success)
  const realigned = Number.parseInt(getSearchParam(params?.realigned) ?? '0', 10)
  const overrideCountParam = Number.parseInt(getSearchParam(params?.override_count) ?? '0', 10)
  const realignedCount = Number.isFinite(realigned) && realigned >= 0 ? realigned : 0
  const overrideCount =
    Number.isFinite(overrideCountParam) && overrideCountParam >= 0 ? overrideCountParam : 0
  const copiedCount = Number.parseInt(getSearchParam(params?.copied) ?? '0', 10)
  const skippedCount = Number.parseInt(getSearchParam(params?.skipped) ?? '0', 10)

  if (error === 'missing_profile') {
    return { message: 'Select an employee first.', variant: 'error' }
  }

  if (error === 'update_failed') {
    return { message: 'Could not update employee profile. Please try again.', variant: 'error' }
  }

  if (error === 'active_update_failed') {
    return { message: 'Could not update employee status. Please try again.', variant: 'error' }
  }

  if (error === 'weekend_anchor_required') {
    return {
      message: 'Set a weekend anchor date (Sat/Sun) for every-other-weekend scheduling.',
      variant: 'error',
    }
  }

  if (error === 'weekend_anchor_invalid') {
    return { message: 'Weekend anchor date must be a Saturday.', variant: 'error' }
  }

  if (error === 'override_missing_fields') {
    return {
      message: 'Date override requires cycle, date, shift, and override type.',
      variant: 'error',
    }
  }

  if (error === 'override_failed') {
    return { message: 'Could not save date override. Please try again.', variant: 'error' }
  }

  if (error === 'override_delete_failed') {
    return { message: 'Could not delete date override. Please try again.', variant: 'error' }
  }

  if (error === 'override_schema_missing') {
    return {
      message: 'Date override schema is not available yet. Run latest migration.',
      variant: 'error',
    }
  }

  if (error === 'override_date_out_of_range') {
    return {
      message: "Date is outside the selected cycle's date range.",
      variant: 'error',
    }
  }

  if (success === 'profile_saved') {
    if (realignedCount > 0) {
      return {
        message: `Employee updated. Realigned ${realignedCount} future draft shift assignment${realignedCount === 1 ? '' : 's'}.`,
        variant: 'success',
      }
    }
    return { message: 'Employee updated.', variant: 'success' }
  }

  if (success === 'employee_deactivated') {
    return { message: 'Employee deactivated.', variant: 'success' }
  }

  if (success === 'employee_reactivated') {
    return { message: 'Employee reactivated.', variant: 'success' }
  }

  if (success === 'override_saved') {
    if (overrideCount > 1) {
      return {
        message: `Saved ${overrideCount} date overrides.`,
        variant: 'success',
      }
    }
    return { message: 'Date override saved.', variant: 'success' }
  }

  if (success === 'override_deleted') {
    return { message: 'Date override deleted.', variant: 'success' }
  }

  if (success === 'shifts_copied') {
    const safeCount = Number.isFinite(copiedCount) && copiedCount >= 0 ? copiedCount : 0
    const safeSkipped = Number.isFinite(skippedCount) && skippedCount >= 0 ? skippedCount : 0
    const skippedNote = safeSkipped > 0 ? ` (${safeSkipped} already existed)` : ''
    return {
      message: `Copied ${safeCount} shift${safeCount === 1 ? '' : 's'} to new cycle.${skippedNote}`,
      variant: 'success',
    }
  }

  if (error === 'no_source_shifts') {
    return {
      message: 'No scheduled shifts found for this employee in the selected source cycle.',
      variant: 'error',
    }
  }

  if (error === 'copy_failed') {
    return { message: 'Failed to copy shifts. Please try again.', variant: 'error' }
  }

  if (error === 'copy_invalid_params') {
    return {
      message: 'Invalid copy request — check that source and target cycles are different.',
      variant: 'error',
    }
  }

  return null
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!can(parseRole(profile?.role), 'manage_directory')) {
    redirect('/dashboard/staff')
  }

  return { supabase, managerId: user.id }
}

function buildDirectoryUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue
    search.set(key, value)
  }
  const query = search.toString()
  return query.length > 0 ? `/directory?${query}` : '/directory'
}

function getOpenAvailabilityParams(input: {
  profileId: string
  cycleId?: string
}): Record<string, string> {
  const params: Record<string, string> = {
    edit_profile: input.profileId,
    focus: 'availability',
  }
  if (input.cycleId) {
    params.override_cycle_id = input.cycleId
  }
  return params
}

function isSaturdayDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getDay() === 6
}

async function realignFutureDraftShiftsForEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string
): Promise<number> {
  const { data: draftCycles, error: draftCyclesError } = await supabase
    .from('schedule_cycles')
    .select('id')
    .eq('published', false)

  if (draftCyclesError) {
    console.error('Failed to load draft cycles for employee realignment:', draftCyclesError)
    return 0
  }

  const cycleIds = (draftCycles ?? [])
    .map((row) => String((row as { id?: string }).id ?? ''))
    .filter((id) => id.length > 0)

  if (cycleIds.length === 0) {
    return 0
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from('shifts')
    .delete()
    .eq('user_id', employeeId)
    .gte('date', getTodayKey())
    .in('cycle_id', cycleIds)
    .select('id')

  if (deleteError) {
    console.error('Failed to realign future draft shifts for employee:', deleteError)
    return 0
  }

  return deletedRows?.length ?? 0
}

async function saveEmployeeAction(formData: FormData) {
  'use server'

  const { supabase } = await requireManager()
  const profileId = String(formData.get('profile_id') ?? '').trim()

  if (!profileId) {
    redirect('/directory?error=missing_profile')
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from('profiles')
    .select('id, role, shift_type, employment_type')
    .eq('id', profileId)
    .maybeSingle()

  if (targetProfileError || !targetProfile || targetProfile.role !== 'therapist') {
    console.error('Could not load therapist profile for update:', targetProfileError)
    redirect('/directory?error=update_failed')
  }

  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const phoneNumberRaw = String(formData.get('phone_number') ?? '').trim()
  const shiftType = normalizeShiftType(String(formData.get('shift_type') ?? '').trim())
  const employmentType = normalizeEmploymentType(
    String(formData.get('employment_type') ?? '').trim()
  )
  const weeklyLimitInput = Number.parseInt(String(formData.get('max_work_days_per_week') ?? ''), 10)
  const weeklyLimit = sanitizeWeeklyLimit(
    Number.isFinite(weeklyLimitInput) ? weeklyLimitInput : null,
    getDefaultWeeklyLimitForEmploymentType(employmentType)
  )
  const worksDow = Array.from(
    new Set(
      formData
        .getAll('works_dow')
        .map((value) => Number.parseInt(String(value), 10))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ).sort((a, b) => a - b)
  const offsDow = Array.from(
    new Set(
      formData
        .getAll('offs_dow')
        .map((value) => Number.parseInt(String(value), 10))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ).sort((a, b) => a - b)
  const weekendRotationRaw = String(formData.get('weekend_rotation') ?? 'none').trim()
  const weekendRotation = weekendRotationRaw === 'every_other' ? 'every_other' : 'none'
  const weekendAnchorRaw = String(formData.get('weekend_anchor_date') ?? '').trim()
  const weekendAnchorDate = weekendRotation === 'every_other' ? weekendAnchorRaw || null : null
  const worksDowModeRaw = String(formData.get('works_dow_mode') ?? 'hard').trim()
  const worksDowMode = worksDowModeRaw === 'soft' ? 'soft' : 'hard'

  if (weekendRotation === 'every_other' && !weekendAnchorDate) {
    redirect('/directory?error=weekend_anchor_required')
  }

  if (weekendAnchorDate && !isSaturdayDate(weekendAnchorDate)) {
    redirect('/directory?error=weekend_anchor_invalid')
  }

  const isLeadEligible = formData.get('is_lead_eligible') === 'on'
  const onFmla = formData.get('on_fmla') === 'on'
  const isActive = formData.get('is_active') === 'on'
  const fmlaReturnDate = normalizeFmlaReturnDate(
    String(formData.get('fmla_return_date') ?? ''),
    onFmla
  )
  const phoneNumber = phoneNumberRaw.length > 0 ? phoneNumberRaw : null
  const shouldRealignFutureShifts = formData.get('realign_future_shifts') === 'true'

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      phone_number: phoneNumber,
      shift_type: shiftType,
      employment_type: employmentType,
      max_work_days_per_week: weeklyLimit,
      is_lead_eligible: isLeadEligible,
      on_fmla: onFmla,
      fmla_return_date: fmlaReturnDate,
      is_active: isActive,
    })
    .eq('id', profileId)
    .eq('role', 'therapist')

  if (updateError) {
    console.error('Failed to save employee directory profile:', updateError)
    redirect('/directory?error=update_failed')
  }

  const { error: workPatternError } = await supabase.from('work_patterns').upsert(
    {
      therapist_id: profileId,
      works_dow: worksDow,
      offs_dow: offsDow,
      weekend_rotation: weekendRotation,
      weekend_anchor_date: weekendAnchorDate,
      works_dow_mode: worksDowMode,
      shift_preference: 'either',
    },
    { onConflict: 'therapist_id' }
  )

  if (workPatternError) {
    if (isMissingWorkPatternsSchema(workPatternError)) {
      console.warn('Skipping work pattern save because work_patterns schema is not available yet.')
    } else {
      console.error('Failed to save work pattern:', workPatternError)
      redirect('/directory?error=update_failed')
    }
  }

  const shouldAutoRealign = !isActive || onFmla
  let realignedCount = 0

  if (shouldRealignFutureShifts || shouldAutoRealign) {
    realignedCount = await realignFutureDraftShiftsForEmployee(supabase, profileId)
  }

  revalidatePath('/directory')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/dashboard/manager')

  const search = new URLSearchParams({
    success: 'profile_saved',
    realigned: String(realignedCount),
  })
  redirect(`/directory?${search.toString()}`)
}

async function setEmployeeActiveAction(formData: FormData) {
  'use server'

  const { supabase } = await requireManager()
  const profileId = String(formData.get('profile_id') ?? '').trim()
  const setActive = String(formData.get('set_active') ?? '').trim() === 'true'

  if (!profileId) {
    redirect('/directory?error=missing_profile')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: setActive })
    .eq('id', profileId)
    .eq('role', 'therapist')

  if (error) {
    console.error('Failed to update employee active status:', error)
    redirect('/directory?error=active_update_failed')
  }

  if (!setActive) {
    await realignFutureDraftShiftsForEmployee(supabase, profileId)
  }

  revalidatePath('/directory')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/dashboard/manager')

  redirect(`/directory?success=${setActive ? 'employee_reactivated' : 'employee_deactivated'}`)
}

async function saveEmployeeDateOverrideAction(formData: FormData) {
  'use server'

  const { supabase, managerId } = await requireManager()
  const profileId = String(formData.get('profile_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const date = String(formData.get('date') ?? '').trim()
  const dates = Array.from(
    new Set(
      formData
        .getAll('dates')
        .map((value) => String(value ?? '').trim())
        .filter((value) => value.length > 0)
    )
  )
  const shiftTypeRaw = String(formData.get('shift_type') ?? '').trim()
  const overrideTypeRaw = String(formData.get('override_type') ?? '').trim()
  const noteRaw = String(formData.get('note') ?? '').trim()
  const shiftType =
    shiftTypeRaw === 'day' || shiftTypeRaw === 'night' || shiftTypeRaw === 'both'
      ? shiftTypeRaw
      : ''
  const overrideType =
    overrideTypeRaw === 'force_off' || overrideTypeRaw === 'force_on' ? overrideTypeRaw : ''
  const targetDates = Array.from(new Set([...dates, ...(date ? [date] : [])]))
  const openAvailabilityParams = getOpenAvailabilityParams({ profileId, cycleId })

  if (!profileId || !cycleId || targetDates.length === 0 || !shiftType || !overrideType) {
    redirect(buildDirectoryUrl({ error: 'override_missing_fields', ...openAvailabilityParams }))
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', profileId)
    .maybeSingle()

  if (targetProfileError || !targetProfile || targetProfile.role !== 'therapist') {
    console.error('Could not load therapist profile for date override update:', targetProfileError)
    redirect(buildDirectoryUrl({ error: 'override_failed', ...openAvailabilityParams }))
  }

  // Validate date is within the selected cycle's date range.
  const { data: targetCycle, error: targetCycleError } = await supabase
    .from('schedule_cycles')
    .select('start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (targetCycleError || !targetCycle) {
    console.error('Could not load cycle for date override validation:', targetCycleError)
    redirect(buildDirectoryUrl({ error: 'override_failed', ...openAvailabilityParams }))
  }

  for (const targetDate of targetDates) {
    if (targetDate < targetCycle.start_date || targetDate > targetCycle.end_date) {
      redirect(
        buildDirectoryUrl({ error: 'override_date_out_of_range', ...openAvailabilityParams })
      )
    }
  }

  const upsertRows = targetDates.map((targetDate) =>
    buildManagerOverrideInput({
      cycleId,
      therapistId: profileId,
      date: targetDate,
      shiftType,
      overrideType,
      note: noteRaw,
      managerId,
    })
  )

  const { error: overrideError } = await supabase
    .from('availability_overrides')
    .upsert(upsertRows, { onConflict: 'cycle_id,therapist_id,date,shift_type' })

  if (overrideError) {
    if (isMissingAvailabilityOverridesSchema(overrideError)) {
      redirect(buildDirectoryUrl({ error: 'override_schema_missing', ...openAvailabilityParams }))
    }
    console.error('Failed to save employee date override:', overrideError)
    redirect(buildDirectoryUrl({ error: 'override_failed', ...openAvailabilityParams }))
  }

  revalidatePath('/directory')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/availability')

  redirect(
    buildDirectoryUrl({
      success: 'override_saved',
      override_count: String(targetDates.length),
      ...openAvailabilityParams,
    })
  )
}

async function deleteEmployeeDateOverrideAction(formData: FormData) {
  'use server'

  const { supabase } = await requireManager()
  const overrideId = String(formData.get('override_id') ?? '').trim()
  const profileId = String(formData.get('profile_id') ?? '').trim()
  const cycleId = String(formData.get('cycle_id') ?? '').trim()
  const openAvailabilityParams = getOpenAvailabilityParams({ profileId, cycleId })

  if (!overrideId || !profileId) {
    redirect(buildDirectoryUrl({ error: 'override_missing_fields', ...openAvailabilityParams }))
  }

  const { error: deleteError } = await supabase
    .from('availability_overrides')
    .delete()
    .eq('id', overrideId)
    .eq('therapist_id', profileId)

  if (deleteError) {
    if (isMissingAvailabilityOverridesSchema(deleteError)) {
      redirect(buildDirectoryUrl({ error: 'override_schema_missing', ...openAvailabilityParams }))
    }
    console.error('Failed to delete employee date override:', deleteError)
    redirect(buildDirectoryUrl({ error: 'override_delete_failed', ...openAvailabilityParams }))
  }

  revalidatePath('/directory')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  revalidatePath('/availability')

  redirect(buildDirectoryUrl({ success: 'override_deleted', ...openAvailabilityParams }))
}

async function copyEmployeeShiftsAction(formData: FormData) {
  'use server'

  const { supabase } = await requireManager()
  const employeeId = String(formData.get('employee_id') ?? '').trim()
  const sourceCycleId = String(formData.get('source_cycle_id') ?? '').trim()
  const targetCycleId = String(formData.get('target_cycle_id') ?? '').trim()

  if (!employeeId || !sourceCycleId || !targetCycleId || sourceCycleId === targetCycleId) {
    redirect(
      buildDirectoryUrl({ error: 'copy_invalid_params', edit_profile: employeeId || undefined })
    )
  }

  // Fetch both cycles
  const { data: cycles } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date')
    .in('id', [sourceCycleId, targetCycleId])
  const sourceCycle = cycles?.find((c) => c.id === sourceCycleId)
  const targetCycle = cycles?.find((c) => c.id === targetCycleId)
  if (!sourceCycle || !targetCycle) {
    redirect(buildDirectoryUrl({ error: 'copy_invalid_params', edit_profile: employeeId }))
  }

  // Fetch source shifts for this employee
  const { data: sourceShifts } = await supabase
    .from('shifts')
    .select('date, shift_type, role')
    .eq('cycle_id', sourceCycleId)
    .eq('user_id', employeeId)
    .eq('status', 'scheduled')
    .is('unfilled_reason', null)

  if (!sourceShifts || sourceShifts.length === 0) {
    redirect(buildDirectoryUrl({ error: 'no_source_shifts', edit_profile: employeeId }))
  }

  // Build day-offset map (same pattern as createCycleAction)
  const sourceDates = dateRange(sourceCycle.start_date, sourceCycle.end_date)
  const targetDates = dateRange(targetCycle.start_date, targetCycle.end_date)
  const sourceIndexByDate = new Map(sourceDates.map((d, i) => [d, i]))

  const shiftsToInsert = sourceShifts.flatMap((shift) => {
    const idx = sourceIndexByDate.get(shift.date)
    if (idx === undefined) return []
    const targetDate = targetDates[idx]
    if (!targetDate) return [] // beyond target cycle end — silently skip
    return [
      {
        cycle_id: targetCycleId,
        user_id: employeeId,
        date: targetDate,
        shift_type: shift.shift_type as 'day' | 'night',
        status: 'scheduled' as const,
        role: shift.role as 'lead' | 'staff',
      },
    ]
  })

  if (shiftsToInsert.length === 0) {
    redirect(buildDirectoryUrl({ error: 'no_source_shifts', edit_profile: employeeId }))
  }

  const { data: inserted, error } = await supabase
    .from('shifts')
    .upsert(shiftsToInsert, { onConflict: 'cycle_id,user_id,date', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('Failed to copy employee shifts:', error)
    redirect(buildDirectoryUrl({ error: 'copy_failed', edit_profile: employeeId }))
  }

  revalidatePath('/coverage')
  revalidatePath('/schedule')

  const copied = String(inserted?.length ?? 0)
  const skipped = String(shiftsToInsert.length - (inserted?.length ?? 0))
  redirect(
    buildDirectoryUrl({ success: 'shifts_copied', copied, skipped, edit_profile: employeeId })
  )
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<DirectorySearchParams>
}) {
  const { supabase } = await requireManager()
  const params = searchParams ? await searchParams : undefined
  const feedback = getDirectoryFeedback(params)
  const initialEditEmployeeId = getSearchParam(params?.edit_profile) ?? null
  const initialFocusAvailability = getSearchParam(params?.focus) === 'availability'
  const initialOverrideCycleId = getSearchParam(params?.override_cycle_id) ?? null

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, role, full_name, email, phone_number, shift_type, employment_type, max_work_days_per_week, is_lead_eligible, on_fmla, fmla_return_date, is_active'
    )
    .eq('role', 'therapist')
    .order('shift_type', { ascending: true })
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Failed to load employee directory data:', error)
  }

  const profileRows = ((data ?? []) as DirectoryProfileRow[]).filter((row) => row.id.length > 0)
  const therapistIds = profileRows.map((row) => row.id)
  const workPatternsByTherapistId = new Map<string, WorkPatternRow>()
  let cycles: EmployeeCycleRecord[] = []
  let dateOverrides: EmployeeDateOverrideRecord[] = []

  if (therapistIds.length > 0) {
    const { data: workPatternsData, error: workPatternsError } = await supabase
      .from('work_patterns')
      .select(
        'therapist_id, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, shift_preference'
      )
      .in('therapist_id', therapistIds)

    if (workPatternsError) {
      if (!isMissingWorkPatternsSchema(workPatternsError)) {
        console.warn('Failed to load work patterns for employee directory:', workPatternsError)
      }
    } else {
      for (const row of (workPatternsData ?? []) as WorkPatternRow[]) {
        workPatternsByTherapistId.set(row.therapist_id, row)
      }
    }
  }

  const { data: cyclesData, error: cyclesError } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published')
    .order('start_date', { ascending: false })

  if (cyclesError) {
    console.warn('Failed to load schedule cycles for employee date overrides:', cyclesError)
  } else {
    cycles = ((cyclesData ?? []) as ScheduleCycleRow[]).map((row) => ({
      id: row.id,
      label: row.label,
      start_date: row.start_date,
      end_date: row.end_date,
      published: row.published,
    }))
  }

  if (therapistIds.length > 0) {
    const { data: dateOverridesData, error: dateOverridesError } = await supabase
      .from('availability_overrides')
      .select(
        'id, therapist_id, cycle_id, date, shift_type, override_type, note, created_at, source'
      )
      .in('therapist_id', therapistIds)
      .order('date', { ascending: true })

    if (dateOverridesError) {
      if (!isMissingAvailabilityOverridesSchema(dateOverridesError)) {
        console.warn('Failed to load employee date overrides for directory:', dateOverridesError)
      }
    } else {
      dateOverrides = ((dateOverridesData ?? []) as AvailabilityOverrideRow[]).map((row) => ({
        id: row.id,
        therapist_id: row.therapist_id,
        cycle_id: row.cycle_id,
        date: row.date,
        shift_type: row.shift_type,
        override_type: row.override_type,
        note: row.note,
        created_at: row.created_at,
        source: row.source === 'manager' ? 'manager' : 'therapist',
      }))
    }
  }

  const employees: EmployeeDirectoryRecord[] = profileRows.map((row) => {
    const employmentType = normalizeEmploymentType(row.employment_type ?? 'full_time')
    const weeklyLimit = sanitizeWeeklyLimit(
      row.max_work_days_per_week,
      getDefaultWeeklyLimitForEmploymentType(employmentType)
    )
    const pattern = workPatternsByTherapistId.get(row.id)
    const worksDow = Array.isArray(pattern?.works_dow)
      ? pattern.works_dow
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          .sort((a, b) => a - b)
      : []
    const offsDow = Array.isArray(pattern?.offs_dow)
      ? pattern.offs_dow
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
          .sort((a, b) => a - b)
      : []

    return {
      id: row.id,
      full_name: row.full_name?.trim() || row.email?.trim() || 'Unknown employee',
      email: row.email?.trim() || 'no-email@teamwise.local',
      phone_number: row.phone_number,
      shift_type: normalizeShiftType(row.shift_type ?? 'day'),
      employment_type: employmentType,
      max_work_days_per_week: weeklyLimit,
      works_dow: worksDow,
      offs_dow: offsDow,
      weekend_rotation: pattern?.weekend_rotation === 'every_other' ? 'every_other' : 'none',
      weekend_anchor_date: pattern?.weekend_anchor_date ?? null,
      works_dow_mode: pattern?.works_dow_mode === 'soft' ? 'soft' : 'hard',
      is_lead_eligible: row.is_lead_eligible === true,
      on_fmla: row.on_fmla === true,
      fmla_return_date: row.fmla_return_date,
      is_active: row.is_active !== false,
    }
  })

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div>
        <h1 className="app-page-title">Team Directory</h1>
        <p className="text-muted-foreground">Manage staffing details for your team.</p>
      </div>

      <EmployeeDirectory
        employees={employees}
        cycles={cycles}
        dateOverrides={dateOverrides}
        initialEditEmployeeId={initialEditEmployeeId}
        initialFocusAvailability={initialFocusAvailability}
        initialOverrideCycleId={initialOverrideCycleId}
        saveEmployeeAction={saveEmployeeAction}
        setEmployeeActiveAction={setEmployeeActiveAction}
        saveEmployeeDateOverrideAction={saveEmployeeDateOverrideAction}
        deleteEmployeeDateOverrideAction={deleteEmployeeDateOverrideAction}
        copyEmployeeShiftsAction={copyEmployeeShiftsAction}
      />
    </div>
  )
}
