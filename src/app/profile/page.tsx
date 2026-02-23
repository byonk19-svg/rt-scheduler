import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  EMPLOYEE_META_BADGE_CLASS,
  LEAD_ELIGIBLE_BADGE_CLASS,
  MANAGER_ROLE_BADGE_CLASS,
} from '@/lib/employee-tag-badges'
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

function getFeedback(searchParams?: ProfileSearchParams): { message: string; variant: 'success' | 'error' } | null {
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
  const defaultLandingPage = String(formData.get('default_landing_page') ?? '').trim()

  if (
    (defaultCalendarView !== 'day' && defaultCalendarView !== 'night') ||
    (defaultLandingPage !== 'dashboard' && defaultLandingPage !== 'coverage')
  ) {
    redirect('/profile?error=preferences_failed')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      default_calendar_view: defaultCalendarView,
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
      'full_name, email, role, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, preferred_work_days, default_calendar_view, default_landing_page'
    )
    .eq('id', user.id)
    .maybeSingle()

  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? 'Team member'
  const email = profile?.email ?? user.email ?? 'No email on file'
  const role = profile?.role === 'manager' ? 'manager' : 'therapist'
  const shiftType = profile?.shift_type === 'night' ? 'night' : 'day'
  const employmentType =
    profile?.employment_type === 'part_time' || profile?.employment_type === 'prn'
      ? profile.employment_type
      : 'full_time'
  const weeklyLimit = typeof profile?.max_work_days_per_week === 'number' ? profile.max_work_days_per_week : 3
  const preferredWorkDays = Array.isArray(profile?.preferred_work_days)
    ? profile.preferred_work_days
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : []
  const preferredDayLabels = WEEKDAY_OPTIONS.filter((option) => preferredWorkDays.includes(option.value)).map(
    (option) => option.label
  )
  const defaultCalendarView = profile?.default_calendar_view === 'night' ? 'night' : 'day'
  const defaultLandingPage = profile?.default_landing_page === 'coverage' ? 'coverage' : 'dashboard'

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <div>
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground">Your account details and role configuration.</p>
        {feedback?.variant === 'error' && (
          <p className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
            {feedback.message}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{fullName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium text-foreground">{email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={role === 'manager' ? cn('capitalize', MANAGER_ROLE_BADGE_CLASS) : 'capitalize'}>
              {role}
            </Badge>
            <Badge variant="outline" className={cn('capitalize', EMPLOYEE_META_BADGE_CLASS)}>
              {shiftType} shift
            </Badge>
            <Badge variant="outline" className={cn('capitalize', EMPLOYEE_META_BADGE_CLASS)}>
              {employmentType.replace('_', ' ')}
            </Badge>
            {role === 'therapist' && (
              <Badge variant={profile?.is_lead_eligible ? 'default' : 'outline'} className={profile?.is_lead_eligible ? LEAD_ELIGIBLE_BADGE_CLASS : undefined}>
                {profile?.is_lead_eligible ? 'Lead eligible' : 'Staff only'}
              </Badge>
            )}
            {role === 'therapist' && <Badge variant="outline">Max {weeklyLimit}/week</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Set your default calendar view and where you land after sign-in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={savePreferencesAction} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="default_calendar_view" className="text-sm font-medium text-foreground">
                  Default calendar view
                </label>
                <select
                  id="default_calendar_view"
                  name="default_calendar_view"
                  defaultValue={defaultCalendarView}
                  className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="default_landing_page" className="text-sm font-medium text-foreground">
                  Default landing page
                </label>
                <select
                  id="default_landing_page"
                  name="default_landing_page"
                  defaultValue={defaultLandingPage}
                  className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="coverage">Coverage</option>
                </select>
              </div>
            </div>
            <FormSubmitButton type="submit" pendingText="Saving...">Save preferences</FormSubmitButton>
          </form>
        </CardContent>
      </Card>

      {role === 'therapist' && (
        <Card>
          <CardHeader>
            <CardTitle>Preferred Work Days</CardTitle>
            <CardDescription>
              Auto-generate will prioritize these weekdays when possible. Leave all unchecked if you have no
              day-of-week preference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={savePreferredWorkDaysAction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEEKDAY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="preferred_work_days"
                      value={option.value}
                      defaultChecked={preferredWorkDays.includes(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FormSubmitButton type="submit" pendingText="Saving...">Save preferred days</FormSubmitButton>
                <p className="text-xs text-muted-foreground">
                  Current: {preferredDayLabels.length > 0 ? preferredDayLabels.join(', ') : 'No preference'}
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
