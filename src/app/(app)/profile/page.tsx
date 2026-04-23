import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { ProfileSummaryCard } from '@/components/profile/ProfileSummaryCard'
import { PreferredWorkDaysCard } from '@/components/profile/PreferredWorkDaysCard'
import { ProfilePreferencesCard } from '@/components/profile/ProfilePreferencesCard'
import { ThemePreferenceControl } from '@/components/ThemeProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { can } from '@/lib/auth/can'
import { toUiRole } from '@/lib/auth/roles'
import { normalizeDefaultScheduleView } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'

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

      {feedback?.variant === 'error' && (
        <p className="inline-flex items-center gap-2 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {feedback.message}
        </p>
      )}

      <ProfileSummaryCard
        canAccessManagerUi={canAccessManagerUi}
        email={email}
        employmentType={employmentType}
        fullName={fullName}
        isTherapist={isTherapist}
        leadEligible={Boolean(profile?.is_lead_eligible)}
        role={role}
        shiftType={shiftType}
        weeklyLimit={weeklyLimit}
      />

      <ProfilePreferencesCard
        defaultCalendarView={defaultCalendarView}
        defaultLandingPage={defaultLandingPage}
        defaultScheduleView={defaultScheduleView}
        savePreferencesAction={savePreferencesAction}
      />

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

      {isTherapist ? (
        <PreferredWorkDaysCard
          preferredDayLabels={preferredDayLabels}
          preferredWorkDays={preferredWorkDays}
          savePreferredWorkDaysAction={savePreferredWorkDaysAction}
          weekdayOptions={WEEKDAY_OPTIONS}
        />
      ) : null}
    </div>
  )
}
