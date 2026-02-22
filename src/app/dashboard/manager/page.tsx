import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { EmployeeDirectory } from '@/components/EmployeeDirectory'
import { FeedbackToast } from '@/components/feedback-toast'
import { ManagerAttentionPanel } from '@/components/ManagerAttentionPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  normalizeEmploymentType,
  normalizeFmlaReturnDate,
  normalizeShiftType,
  normalizeActiveValue,
  type EmployeeDirectoryRecord,
} from '@/lib/employee-directory'
import { getManagerAttentionSnapshot } from '@/lib/manager-workflow'
import { getDefaultWeeklyLimitForEmploymentType, sanitizeWeeklyLimit } from '@/lib/scheduling-constants'
import { createClient } from '@/lib/supabase/server'

type ManagerDashboardSearchParams = {
  success?: string | string[]
  error?: string | string[]
  realigned?: string | string[]
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

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getFeedback(params?: ManagerDashboardSearchParams): { message: string; variant: 'success' | 'error' } | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)
  const realignedRaw = getSearchParam(params?.realigned)
  const realignedCount = Number.parseInt(realignedRaw ?? '', 10)

  if (success === 'employee_updated') {
    return { message: 'Employee directory updated.', variant: 'success' }
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
    redirect('/dashboard/manager?error=employee_contact_unauthorized')
  }

  return { supabase, user }
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
  const realignFutureShifts = String(formData.get('realign_future_shifts') ?? '').trim() === 'true'
  const employmentTypeRaw = String(formData.get('employment_type') ?? '').trim()
  const maxWorkDaysRaw = Number.parseInt(String(formData.get('max_work_days_per_week') ?? '').trim(), 10)
  const isLeadEligible = String(formData.get('is_lead_eligible') ?? '').trim() === 'on'
  const onFmla = String(formData.get('on_fmla') ?? '').trim() === 'on'
  const isActive = String(formData.get('is_active') ?? '').trim() === 'on'
  const fmlaReturnDateRaw = String(formData.get('fmla_return_date') ?? '').trim()

  if (!profileId || !fullName || !email) {
    redirect('/dashboard/manager?error=employee_contact_validation#employee-directory')
  }
  if (shiftTypeRaw !== 'day' && shiftTypeRaw !== 'night') {
    redirect('/dashboard/manager?error=employee_contact_shift_invalid#employee-directory')
  }
  if (!['full_time', 'part_time', 'prn'].includes(employmentTypeRaw)) {
    redirect('/dashboard/manager?error=employee_contact_employment_invalid#employee-directory')
  }

  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)
  if (normalizedPhoneNumber === 'INVALID') {
    redirect('/dashboard/manager?error=employee_contact_phone_invalid#employee-directory')
  }

  if (onFmla && fmlaReturnDateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(fmlaReturnDateRaw)) {
    redirect('/dashboard/manager?error=employee_fmla_return_date_invalid#employee-directory')
  }

  const employmentType = normalizeEmploymentType(employmentTypeRaw)
  const normalizedShiftType = normalizeShiftType(shiftTypeRaw)
  const weeklyLimit = sanitizeWeeklyLimit(maxWorkDaysRaw, getDefaultWeeklyLimitForEmploymentType(employmentType))
  if (!Number.isFinite(maxWorkDaysRaw) || maxWorkDaysRaw < 1 || maxWorkDaysRaw > 7) {
    redirect('/dashboard/manager?error=employee_contact_weekly_limit_invalid#employee-directory')
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('shift_type')
    .eq('id', profileId)
    .eq('role', 'therapist')
    .maybeSingle()

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
    redirect('/dashboard/manager?error=employee_update_failed#employee-directory')
  }

  let realignedCount = 0
  const previousShiftType = currentProfile?.shift_type === 'night' ? 'night' : 'day'
  if (realignFutureShifts && previousShiftType !== normalizedShiftType) {
    const now = new Date()
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const { data: futureShifts, error: futureShiftsError } = await supabase
      .from('shifts')
      .select('id, shift_type, date, schedule_cycles(published)')
      .eq('user_id', profileId)
      .gte('date', todayKey)

    if (futureShiftsError) {
      console.error('Failed to load future shifts for realignment:', futureShiftsError)
      redirect('/dashboard/manager?error=employee_realign_failed#employee-directory')
    }

    const shiftsToRealign = (futureShifts ?? []).filter((row) => {
      const cycle = Array.isArray(row.schedule_cycles) ? row.schedule_cycles[0] : row.schedule_cycles
      if (cycle?.published) return false
      return row.shift_type !== normalizedShiftType
    })

    if (shiftsToRealign.length > 0) {
      const { error: realignError } = await supabase
        .from('shifts')
        .update({ shift_type: normalizedShiftType })
        .in('id', shiftsToRealign.map((row) => row.id))

      if (realignError) {
        console.error('Failed to realign draft shifts:', realignError)
        redirect('/dashboard/manager?error=employee_realign_failed#employee-directory')
      }

      realignedCount = shiftsToRealign.length
    }
  }

  if (realignedCount > 0) {
    revalidatePath('/dashboard/manager')
    revalidatePath('/schedule')
    redirect(`/dashboard/manager?success=employee_updated_and_realigned&realigned=${realignedCount}#employee-directory`)
  }

  revalidatePath('/dashboard/manager')
  revalidatePath('/schedule')
  redirect('/dashboard/manager?success=employee_updated#employee-directory')
}

async function setEmployeeActiveAction(formData: FormData) {
  'use server'

  const { supabase } = await assertManagerSession()

  const profileId = String(formData.get('profile_id') ?? '').trim()
  const setActiveRaw = String(formData.get('set_active') ?? '').trim()

  if (!profileId || (setActiveRaw !== 'true' && setActiveRaw !== 'false')) {
    redirect('/dashboard/manager?error=employee_status_update_failed#employee-directory')
  }

  const targetActive = normalizeActiveValue(setActiveRaw)

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: targetActive })
    .eq('id', profileId)
    .eq('role', 'therapist')

  if (error) {
    console.error('Failed to update employee active status:', error)
    redirect('/dashboard/manager?error=employee_status_update_failed#employee-directory')
  }

  revalidatePath('/dashboard/manager')
  revalidatePath('/schedule')
  redirect(`/dashboard/manager?success=${targetActive ? 'employee_reactivated' : 'employee_deactivated'}#employee-directory`)
}

function checklistItem(label: string, passed: boolean, detail: string) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-foreground">{label}</span>
      <span className={passed ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'}>
        {passed ? `\u2705 ${detail}` : `\u274c ${detail}`}
      </span>
    </div>
  )
}

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<ManagerDashboardSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const params = searchParams ? await searchParams : undefined
  const feedback = getFeedback(params)

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle()

  const isManager = profile?.role === 'manager' || user.user_metadata?.role === 'manager'
  if (!isManager) {
    redirect('/dashboard/staff')
  }

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
  const summary = await getManagerAttentionSnapshot(supabase)
  const cycleBadgeLabel = summary.activeCycle ? `Cycle: ${summary.activeCycle.label}` : 'Cycle: Not set'
  const publishBlocked = !summary.publishReady
  const approvalsClear = summary.pendingApprovals === 0
  const coverageClear = summary.coverageIssues === 0
  const leadClear = summary.missingLeadShifts === 0

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div className="teamwise-surface rounded-2xl border border-border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <h1 className="app-page-title">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome, {fullName}. Fix blockers, then publish confidently.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{cycleBadgeLabel}</Badge>
        </div>
      </div>

      <ManagerAttentionPanel snapshot={summary} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
            <CardDescription>
              {summary.pendingApprovals === 0
                ? 'No approvals waiting.'
                : `${summary.pendingApprovals} requests awaiting review.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={summary.links.approvalsPending}>Open approvals</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
            <CardDescription>Resolve lead and staffing gaps before publishing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Missing lead: {summary.missingLeadShifts}</p>
            <p className="text-sm text-muted-foreground">Under coverage: {summary.underCoverageSlots}</p>
            <p className="text-sm text-muted-foreground">Over coverage: {summary.overCoverageSlots}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={summary.links.coverageNeedsAttention}>Go to coverage</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Publish</CardTitle>
            <CardDescription>Checklist must be clear before publish.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklistItem('Approvals', approvalsClear, approvalsClear ? 'clear' : `${summary.pendingApprovals} pending`)}
            {checklistItem(
              'Coverage',
              coverageClear,
              coverageClear ? 'clear' : `${summary.coverageIssues} issues (includes lead)`
            )}
            {checklistItem('Lead', leadClear, leadClear ? 'clear' : `${summary.missingLeadShifts} shifts missing lead`)}

            {publishBlocked ? (
              <Button asChild size="sm">
                <Link href={summary.resolveBlockersLink}>Resolve blockers</Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={summary.links.publish}>Publish cycle</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h3 className="app-section-title">Quick actions</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={summary.links.approvalsPending}>Review approvals</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={summary.links.fixCoverage}>Assign coverage</Link>
            </Button>
            {publishBlocked ? (
              <span title="Publishing is blocked until approvals and coverage issues are resolved.">
                <Button variant="outline" disabled>
                  Publish cycle
                </Button>
              </span>
            ) : (
              <Button asChild>
                <Link href={summary.links.publish}>Publish cycle</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <EmployeeDirectory
        employees={therapists}
        saveEmployeeAction={saveEmployeeDirectoryAction}
        setEmployeeActiveAction={setEmployeeActiveAction}
      />
    </div>
  )
}
