import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import { ThemePreferenceControl } from '@/components/ThemeProvider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { can } from '@/lib/auth/can'
import { toUiRole } from '@/lib/auth/roles'
import { EMPLOYEE_META_BADGE_CLASS, LEAD_ELIGIBLE_BADGE_CLASS } from '@/lib/employee-tag-badges'
import { normalizeDefaultScheduleView } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

type ProfileSearchParams = {
  success?: string | string[]
  error?: string | string[]
}

type WeekdayOption = {
  value: number
  label: string
}

const WEEKDAY_OPTIONS: WeekdayOption[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function normalizePreferredWorkDays(rawValues: FormDataEntryValue[]): number[] {
  const days = rawValues
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
  return Array.from(new Set(days)).sort((a, b) => a - b)
}

function getFeedback(
  searchParams?: ProfileSearchParams
): { message: string; variant: 'success' | 'error' } | null {
  const success = getSearchParam(searchParams?.success)
  const error = getSearchParam(searchParams?.error)

  if (success === 'preferred_days_saved') {
    return { message: 'Preferred work days saved.', variant: 'success' }
  }
  if (success === 'preferences_saved') {
    return { message: 'Preferences saved.', variant: 'success' }
  }

  if (error === 'preferred_days_failed') {
    return { message: 'Could not save preferred work days. Please try again.', variant: 'error' }
  }
  if (error === 'preferences_failed') {
    return { message: 'Could not save preferences. Please try again.', variant: 'error' }
  }

  return null
}

async function savePreferredWorkDaysAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const preferredDays = normalizePreferredWorkDays(formData.getAll('preferred_work_days'))

  const { error } = await supabase
    .from('profiles')
    .update({
      preferred_work_days: preferredDays,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update preferred work days:', error)
    redirect('/profile?error=preferred_days_failed')
  }

  revalidatePath('/profile')
  revalidatePath('/schedule')
  redirect('/profile?success=preferred_days_saved')
}

async function savePreferencesAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const defaultCalendarView = String(formData.get('default_calendar_view') ?? '').trim()
  const defaultScheduleView = String(formData.get('default_schedule_view') ?? '').trim()
  const defaultLandingPage = String(formData.get('default_landing_page') ?? '').trim()

  if (
    (defaultCalendarView !== 'day' && defaultCalendarView !== 'night') ||
    (defaultScheduleView !== 'week' && defaultScheduleView !== 'roster') ||
    (defaultLandingPage !== 'dashboard' && defaultLandingPage !== 'coverage')
  ) {
    redirect('/profile?error=preferences_failed')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      default_calendar_view: defaultCalendarView,
      default_schedule_view: defaultScheduleView,
      default_landing_page: defaultLandingPage,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update profile preferences:', error)
    redirect('/profile?error=preferences_failed')
  }

  revalidatePath('/profile')
  revalidatePath('/dashboard')
  revalidatePath('/schedule')
  revalidatePath('/coverage')
  redirect('/profile?success=preferences_saved')
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<ProfileSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const feedback = getFeedback(resolvedSearchParams)

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, email, role, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, preferred_work_days, default_calendar_view, default_schedule_view, default_landing_page'
    )
    .eq('id', user.id)
    .maybeSingle()

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Team member'
  const email = profile?.email ?? user.email ?? 'No email on file'
  const role = toUiRole(profile?.role)
  const canAccessManagerUi = can(role, 'access_manager_ui')
  const isTherapist = !canAccessManagerUi
  const shiftType = profile?.shift_type === 'night' ? 'night' : 'day'
  const employmentType =
    profile?.employment_type === 'part_time' || profile?.employment_type === 'prn'
      ? profile.employment_type
      : 'full_time'
  const weeklyLimit =
    typeof profile?.max_work_days_per_week === 'number' ? profile.max_work_days_per_week : 3
  const preferredWorkDays = Array.isArray(profile?.preferred_work_days)
    ? profile.preferred_work_days
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : []
  const preferredDayLabels = WEEKDAY_OPTIONS.filter((option) =>
    preferredWorkDays.includes(option.value)
  ).map((option) => option.label)
  const defaultCalendarView = profile?.default_calendar_view === 'night' ? 'night' : 'day'
  const defaultScheduleView = normalizeDefaultScheduleView(
    (profile as { default_schedule_view?: string | null } | null)?.default_schedule_view ??
      undefined
  )
  const defaultLandingPage = profile?.default_landing_page === 'coverage' ? 'coverage' : 'dashboard'

  return (
    <div className="space-y-6">
      {feedback?.variant === 'success' && (
        <FeedbackToast message={feedback.message} variant={feedback.variant} />
      )}

      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <div className="mb-3">
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">Profile</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Your account details and role configuration.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="neutral" className="capitalize">
            {role}
          </StatusBadge>
          <StatusBadge variant="neutral" className="capitalize">
            {shiftType} shift
          </StatusBadge>
          <StatusBadge variant="neutral" className="capitalize">
            {employmentType.replace('_', ' ')}
          </StatusBadge>
          {isTherapist && <StatusBadge variant="neutral">Max {weeklyLimit}/week</StatusBadge>}
        </div>
      </div>

      {feedback?.variant === 'error' && (
        <p className="inline-flex items-center gap-2 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {feedback.message}
        </p>
      )}

      <Card className="border-border/90">
        <CardHeader>
          <CardTitle>{fullName}</CardTitle>
          <CardDescription>
            Account and staffing metadata used across scheduling tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">{email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                canAccessManagerUi
                  ? cn(
                      'capitalize',
                      'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                    )
                  : 'capitalize'
              }
            >
              {role}
            </Badge>
            <Badge variant="outline" className={cn('capitalize', EMPLOYEE_META_BADGE_CLASS)}>
              {shiftType} shift
            </Badge>
            <Badge variant="outline" className={cn('capitalize', EMPLOYEE_META_BADGE_CLASS)}>
              {employmentType.replace('_', ' ')}
            </Badge>
            {isTherapist && (
              <Badge
                variant={profile?.is_lead_eligible ? 'default' : 'outline'}
                className={profile?.is_lead_eligible ? LEAD_ELIGIBLE_BADGE_CLASS : undefined}
              >
                {profile?.is_lead_eligible ? 'Lead' : 'Staff only'}
              </Badge>
            )}
            {isTherapist && <Badge variant="outline">Max {weeklyLimit}/week</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/90">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Set your default calendar view and where you land after sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={savePreferencesAction} className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label
                  htmlFor="default_calendar_view"
                  className="text-sm font-medium text-foreground"
                >
                  Default calendar view
                </label>
                <select
                  id="default_calendar_view"
                  name="default_calendar_view"
                  defaultValue={defaultCalendarView}
                  className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Default Day/Night tab when you open Coverage. Does not change your profile shift
                  assignment.
                </p>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="default_schedule_view"
                  className="text-sm font-medium text-foreground"
                >
                  Default schedule layout
                </label>
                <select
                  id="default_schedule_view"
                  name="default_schedule_view"
                  defaultValue={defaultScheduleView}
                  className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="week">Grid</option>
                  <option value="roster">Roster</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Grid vs roster view on Coverage only. Other pages (for example My shifts) are
                  unchanged.
                </p>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="default_landing_page"
                  className="text-sm font-medium text-foreground"
                >
                  Default landing page
                </label>
                <select
                  id="default_landing_page"
                  name="default_landing_page"
                  defaultValue={defaultLandingPage}
                  className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="coverage">Coverage</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  First screen after sign-in. Managers and therapists both use this; it does not
                  grant extra permissions.
                </p>
              </div>
            </div>
            <FormSubmitButton type="submit" pendingText="Saving...">
              Save preferences
            </FormSubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/90">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose your preferred theme or follow the system setting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreferenceControl />
        </CardContent>
      </Card>

      {isTherapist && (
        <Card className="border-border/90">
          <CardHeader>
            <CardTitle>Preferred Work Days</CardTitle>
            <CardDescription>
              Auto-generate will prioritize these weekdays when possible. Leave all unchecked if you
              have no day-of-week preference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={savePreferredWorkDaysAction} className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEEKDAY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary/25"
                  >
                    <input
                      type="checkbox"
                      name="preferred_work_days"
                      value={option.value}
                      className="h-4 w-4 accent-[var(--primary)]"
                      defaultChecked={preferredWorkDays.includes(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FormSubmitButton type="submit" pendingText="Saving...">
                  Save preferred days
                </FormSubmitButton>
                <p className="text-xs font-medium text-muted-foreground">
                  Current:{' '}
                  {preferredDayLabels.length > 0 ? preferredDayLabels.join(', ') : 'None selected'}
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
