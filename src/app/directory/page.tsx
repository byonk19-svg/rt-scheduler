import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { EmployeeDirectory } from '@/components/EmployeeDirectory'
import { FeedbackToast } from '@/components/feedback-toast'
import {
  normalizeEmploymentType,
  normalizeFmlaReturnDate,
  normalizeShiftType,
  normalizeActiveValue,
  type EmployeeDirectoryRecord,
} from '@/lib/employee-directory'
import { getDefaultWeeklyLimitForEmploymentType, sanitizeWeeklyLimit } from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/server'

type DirectorySearchParams = {
  success?: string | string[]
  error?: string | string[]
  realigned?: string | string[]
  removed?: string | string[]
  demoted?: string | string[]
}

type ProfileRoleRow = { role: 'manager' | 'therapist' }

type DirectoryProfileRow = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  shift_type: string
  is_lead_eligible: boolean | null
  employment_type: string | null
  max_work_days_per_week: number | null
  on_fmla: boolean | null
  fmla_return_date: string | null
  is_active: boolean | null
}

type FutureDraftShiftRow = {
  id: string
  shift_type: 'day' | 'night'
  role: 'lead' | 'staff'
  schedule_cycles: { published: boolean } | { published: boolean }[] | null
}

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getFeedback(params?: DirectorySearchParams): { message: string; variant: 'success' | 'error' } | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)
  const realignedRaw = getSearchParam(params?.realigned)
  const removedRaw = getSearchParam(params?.removed)
  const demotedRaw = getSearchParam(params?.demoted)
  const realignedCount = Number.parseInt(realignedRaw ?? '', 10)
  const removedCount = Number.parseInt(removedRaw ?? '', 10)
  const demotedCount = Number.parseInt(demotedRaw ?? '', 10)

  if (success === 'employee_updated') {
    return { message: 'Employee directory updated.', variant: 'success' }
  }
  if (success === 'employee_updated_schedule_synced') {
    const safeRealigned = Number.isFinite(realignedCount) && realignedCount > 0 ? realignedCount : 0
    const safeRemoved = Number.isFinite(removedCount) && removedCount > 0 ? removedCount : 0
    const safeDemoted = Number.isFinite(demotedCount) && demotedCount > 0 ? demotedCount : 0
    const parts = [
      safeRemoved > 0 ? `${safeRemoved} future draft shift(s) removed` : null,
      safeRealigned > 0 ? `${safeRealigned} future draft shift(s) moved to updated team` : null,
      safeDemoted > 0 ? `${safeDemoted} lead assignment(s) demoted to staff` : null,
    ].filter(Boolean)
    if (parts.length === 0) {
      return { message: 'Employee directory updated and schedule synchronized.', variant: 'success' }
    }
    return { message: `Employee updated. ${parts.join(', ')}.`, variant: 'success' }
  }
  if (success === 'employee_updated_and_realigned') {
    const safeCount = Number.isFinite(realignedCount) && realignedCount > 0 ? realignedCount : 0
    return {
      message:
        safeCount > 0
          ? `Employee updated. ${safeCount} future draft shift(s) realigned to the selected team.`
          : 'Employee updated and draft shifts realigned.',
      variant: 'success',
    }
  }
  if (success === 'employee_deactivated') {
    const safeRemoved = Number.isFinite(removedCount) && removedCount > 0 ? removedCount : 0
    if (safeRemoved > 0) {
      return {
        message: `Employee deactivated. Removed ${safeRemoved} future draft shift assignment(s).`,
        variant: 'success',
      }
    }
    return { message: 'Employee deactivated.', variant: 'success' }
  }
  if (success === 'employee_reactivated') {
    return { message: 'Employee reactivated.', variant: 'success' }
  }

  if (error === 'employee_update_failed') {
    return { message: 'Could not update employee profile.', variant: 'error' }
  }
  if (error === 'employee_status_update_failed') {
    return { message: 'Could not update employee status.', variant: 'error' }
  }
  if (error === 'employee_contact_validation') {
    return { message: 'Name and email are required.', variant: 'error' }
  }
  if (error === 'employee_contact_unauthorized') {
    return { message: 'Manager access is required to edit employee profiles.', variant: 'error' }
  }
  if (error === 'employee_contact_phone_invalid') {
    return { message: 'Phone number must be 10 digits (US format).', variant: 'error' }
  }
  if (error === 'employee_contact_shift_invalid') {
    return { message: 'Shift type must be day or night.', variant: 'error' }
  }
  if (error === 'employee_contact_employment_invalid') {
    return { message: 'Employment type must be full-time, part-time, or PRN.', variant: 'error' }
  }
  if (error === 'employee_contact_weekly_limit_invalid') {
    return { message: 'Weekly shift limit must be between 1 and 7.', variant: 'error' }
  }
  if (error === 'employee_fmla_return_date_invalid') {
    return { message: 'Potential return date must be a valid date.', variant: 'error' }
  }
  if (error === 'employee_realign_failed') {
    return { message: 'Employee saved, but future draft shifts could not be realigned.', variant: 'error' }
  }

  return null
}

function normalizePhoneNumber(raw: string): string | null {
  const digitsOnly = raw.replace(/\D/g, '')
  if (!digitsOnly) return null

  const normalizedDigits =
    digitsOnly.length === 11 && digitsOnly.startsWith('1') ? digitsOnly.slice(1) : digitsOnly

  if (normalizedDigits.length !== 10) {
    return 'INVALID'
  }

  return `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3, 6)}-${normalizedDigits.slice(6)}`
}

async function assertManagerSession() {
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

  if ((profile as ProfileRoleRow | null)?.role !== 'manager') {
    redirect('/dashboard/staff')
  }

  return { supabase }
}

function getTodayDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function isPublishedCycle(
  relation: FutureDraftShiftRow['schedule_cycles']
): boolean {
  const cycle = Array.isArray(relation) ? relation[0] : relation
  return Boolean(cycle?.published)
}

async function reconcileFutureDraftShiftsForEmployee({
  supabase,
  profileId,
  shiftType,
  isLeadEligible,
  onFmla,
  isActive,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  profileId: string
  shiftType: 'day' | 'night'
  isLeadEligible: boolean
  onFmla: boolean
  isActive: boolean
}): Promise<{ removed: number; realigned: number; demoted: number }> {
  const todayKey = getTodayDateKey()
  const { data: futureShifts, error: futureShiftsError } = await supabase
    .from('shifts')
    .select('id, shift_type, role, schedule_cycles(published)')
    .eq('user_id', profileId)
    .gte('date', todayKey)

  if (futureShiftsError) {
    throw futureShiftsError
  }

  const draftFutureShifts = ((futureShifts ?? []) as FutureDraftShiftRow[]).filter(
    (row) => !isPublishedCycle(row.schedule_cycles)
  )
  if (draftFutureShifts.length === 0) {
    return { removed: 0, realigned: 0, demoted: 0 }
  }

  if (!isActive || onFmla) {
    const ids = draftFutureShifts.map((row) => row.id)
    if (ids.length === 0) {
      return { removed: 0, realigned: 0, demoted: 0 }
    }

    const { error: removeError } = await supabase.from('shifts').delete().in('id', ids)
    if (removeError) throw removeError
    return { removed: ids.length, realigned: 0, demoted: 0 }
  }

  const shiftsToRealign = draftFutureShifts.filter((row) => row.shift_type !== shiftType).map((row) => row.id)
  const leadShiftsToDemote = !isLeadEligible
    ? draftFutureShifts.filter((row) => row.role === 'lead').map((row) => row.id)
    : []

  if (shiftsToRealign.length > 0) {
    const { error: realignError } = await supabase
      .from('shifts')
      .update({ shift_type: shiftType })
      .in('id', shiftsToRealign)
    if (realignError) throw realignError
  }

  if (leadShiftsToDemote.length > 0) {
    const { error: demoteError } = await supabase
      .from('shifts')
      .update({ role: 'staff' })
      .in('id', leadShiftsToDemote)
    if (demoteError) throw demoteError
  }

  return {
    removed: 0,
    realigned: shiftsToRealign.length,
    demoted: leadShiftsToDemote.length,
  }
}

async function saveEmployeeDirectoryAction(formData: FormData) {
  'use server'

  const { supabase } = await assertManagerSession()

  const profileId = String(formData.get('profile_id') ?? '').trim()
  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const phoneNumber = String(formData.get('phone_number') ?? '').trim()
  const shiftTypeRaw = String(formData.get('shift_type') ?? '').trim()
  const employmentTypeRaw = String(formData.get('employment_type') ?? '').trim()
  const maxWorkDaysRaw = Number.parseInt(String(formData.get('max_work_days_per_week') ?? '').trim(), 10)
  const isLeadEligible = String(formData.get('is_lead_eligible') ?? '').trim() === 'on'
  const onFmla = String(formData.get('on_fmla') ?? '').trim() === 'on'
  const isActive = String(formData.get('is_active') ?? '').trim() === 'on'
  const fmlaReturnDateRaw = String(formData.get('fmla_return_date') ?? '').trim()

  if (!profileId || !fullName || !email) {
    redirect('/directory?error=employee_contact_validation#employee-directory')
  }
  if (shiftTypeRaw !== 'day' && shiftTypeRaw !== 'night') {
    redirect('/directory?error=employee_contact_shift_invalid#employee-directory')
  }
  if (!['full_time', 'part_time', 'prn'].includes(employmentTypeRaw)) {
    redirect('/directory?error=employee_contact_employment_invalid#employee-directory')
  }

  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)
  if (normalizedPhoneNumber === 'INVALID') {
    redirect('/directory?error=employee_contact_phone_invalid#employee-directory')
  }

  if (onFmla && fmlaReturnDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(fmlaReturnDateRaw)) {
    redirect('/directory?error=employee_fmla_return_date_invalid#employee-directory')
  }

  const employmentType = normalizeEmploymentType(employmentTypeRaw)
  const normalizedShiftType = normalizeShiftType(shiftTypeRaw)
  const weeklyLimit = sanitizeWeeklyLimit(maxWorkDaysRaw, getDefaultWeeklyLimitForEmploymentType(employmentType))
  if (!Number.isFinite(maxWorkDaysRaw) || maxWorkDaysRaw < 1 || maxWorkDaysRaw > 7) {
    redirect('/directory?error=employee_contact_weekly_limit_invalid#employee-directory')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      email,
      phone_number: normalizedPhoneNumber,
      shift_type: normalizedShiftType,
      employment_type: employmentType,
      max_work_days_per_week: weeklyLimit,
      is_lead_eligible: isLeadEligible,
      on_fmla: onFmla,
      fmla_return_date: normalizeFmlaReturnDate(fmlaReturnDateRaw, onFmla),
      is_active: isActive,
    })
    .eq('id', profileId)
    .eq('role', 'therapist')

  if (error) {
    console.error('Failed to update employee profile:', error)
    redirect('/directory?error=employee_update_failed#employee-directory')
  }

  let syncCounts = { removed: 0, realigned: 0, demoted: 0 }
  try {
    syncCounts = await reconcileFutureDraftShiftsForEmployee({
      supabase,
      profileId,
      shiftType: normalizedShiftType,
      isLeadEligible,
      onFmla,
      isActive,
    })
  } catch (syncError) {
    console.error('Failed to synchronize future draft shifts after employee update:', syncError)
    redirect('/directory?error=employee_realign_failed#employee-directory')
  }

  revalidatePath('/directory')
  revalidatePath('/dashboard/manager')
  revalidatePath('/schedule')
  revalidatePath('/coverage')

  if (syncCounts.removed > 0 || syncCounts.realigned > 0 || syncCounts.demoted > 0) {
    redirect(
      `/directory?success=employee_updated_schedule_synced&removed=${syncCounts.removed}&realigned=${syncCounts.realigned}&demoted=${syncCounts.demoted}#employee-directory`
    )
  }

  redirect('/directory?success=employee_updated#employee-directory')
}

async function setEmployeeActiveAction(formData: FormData) {
  'use server'

  const { supabase } = await assertManagerSession()

  const profileId = String(formData.get('profile_id') ?? '').trim()
  const setActiveRaw = String(formData.get('set_active') ?? '').trim()

  if (!profileId || (setActiveRaw !== 'true' && setActiveRaw !== 'false')) {
    redirect('/directory?error=employee_status_update_failed#employee-directory')
  }

  const targetActive = normalizeActiveValue(setActiveRaw)

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: targetActive })
    .eq('id', profileId)
    .eq('role', 'therapist')

  if (error) {
    console.error('Failed to update employee active status:', error)
    redirect('/directory?error=employee_status_update_failed#employee-directory')
  }

  const { data: updatedProfile, error: updatedProfileError } = await supabase
    .from('profiles')
    .select('shift_type, is_lead_eligible, on_fmla, is_active')
    .eq('id', profileId)
    .eq('role', 'therapist')
    .maybeSingle()

  if (updatedProfileError || !updatedProfile) {
    console.error('Failed to load updated employee profile after active toggle:', updatedProfileError)
    redirect('/directory?error=employee_status_update_failed#employee-directory')
  }

  let syncCounts = { removed: 0, realigned: 0, demoted: 0 }
  try {
    syncCounts = await reconcileFutureDraftShiftsForEmployee({
      supabase,
      profileId,
      shiftType: normalizeShiftType(updatedProfile.shift_type),
      isLeadEligible: Boolean(updatedProfile.is_lead_eligible),
      onFmla: Boolean(updatedProfile.on_fmla),
      isActive: updatedProfile.is_active !== false,
    })
  } catch (syncError) {
    console.error('Failed to synchronize future draft shifts after active toggle:', syncError)
    redirect('/directory?error=employee_status_update_failed#employee-directory')
  }

  revalidatePath('/directory')
  revalidatePath('/dashboard/manager')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  redirect(
    `/directory?success=${targetActive ? 'employee_reactivated' : 'employee_deactivated'}&removed=${syncCounts.removed}&realigned=${syncCounts.realigned}&demoted=${syncCounts.demoted}#employee-directory`
  )
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams?: Promise<DirectorySearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = profile?.role === 'manager'
  if (!isManager) {
    redirect('/dashboard/staff')
  }

  const params = searchParams ? await searchParams : undefined
  const feedback = getFeedback(params)

  const { data: therapistsData } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, phone_number, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, on_fmla, fmla_return_date, is_active'
    )
    .eq('role', 'therapist')
    .order('shift_type', { ascending: true })
    .order('full_name', { ascending: true })

  const therapists = ((therapistsData ?? []) as DirectoryProfileRow[]).map((row) => {
    const employmentType = normalizeEmploymentType(String(row.employment_type ?? ''))
    return {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone_number: row.phone_number,
      shift_type: normalizeShiftType(row.shift_type),
      employment_type: employmentType,
      max_work_days_per_week: sanitizeWeeklyLimit(
        row.max_work_days_per_week,
        getDefaultWeeklyLimitForEmploymentType(employmentType)
      ),
      is_lead_eligible: Boolean(row.is_lead_eligible),
      on_fmla: Boolean(row.on_fmla),
      fmla_return_date: row.fmla_return_date,
      is_active: row.is_active !== false,
    } satisfies EmployeeDirectoryRecord
  })

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Manager'

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div className="teamwise-surface rounded-2xl border border-border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="app-page-title">Team Directory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage staffing details for {fullName}&apos;s team.</p>
        {feedback?.variant === 'error' && (
          <p className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
            {feedback.message}
          </p>
        )}
      </div>

      <EmployeeDirectory
        employees={therapists}
        saveEmployeeAction={saveEmployeeDirectoryAction}
        setEmployeeActiveAction={setEmployeeActiveAction}
      />
    </div>
  )
}
