import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import { PreferredWorkDaysFieldset } from '@/components/PreferredWorkDaysFieldset'
import { ThemePreferenceControl } from '@/components/ThemeProvider'
import { WorkPatternCard } from '@/components/team/WorkPatternCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { can } from '@/lib/auth/can'
import { toUiRole } from '@/lib/auth/roles'
import {
  describeWorkPatternSummary,
  normalizeWorkPattern,
  type WorkPattern,
} from '@/lib/coverage/work-patterns'
import {
  parsePreferredWorkDaysSelection,
  resolvePreferredWorkDaysMode,
} from '@/lib/preferred-work-days'
import { normalizeDefaultScheduleView } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'
import { isTheme } from '@/lib/theme'

type SearchParams = {
  success?: string | string[]
  error?: string | string[]
  return_to?: string | string[]
  setup?: string | string[]
}

type WorkPatternRow = {
  pattern_type: WorkPattern['pattern_type'] | null
  works_dow: number[] | null
  offs_dow: number[] | null
  weekend_rotation: string | null
  weekend_anchor_date: string | null
  works_dow_mode: string | null
  weekly_weekdays: number[] | null
  weekend_rule: WorkPattern['weekend_rule'] | null
  cycle_anchor_date: string | null
  cycle_segments: WorkPattern['cycle_segments'] | null
  shift_preference: WorkPattern['shift_preference'] | null
}

type ProfileRow = {
  id: string
  full_name: string | null
  role: string | null
  shift_type: 'day' | 'night' | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  is_lead_eligible: boolean | null
  max_work_days_per_week: number | null
  max_consecutive_days: number | null
  preferred_work_days: number[] | null
  preferred_work_days_mode: string | null
  staff_onboarding_preferences_confirmed_at: string | null
  staff_onboarding_theme_confirmed_at: string | null
  default_calendar_view: string | null
  default_schedule_view: string | null
  default_landing_page: string | null
  notification_in_app_enabled: boolean | null
  notification_email_enabled: boolean | null
  work_patterns: WorkPatternRow | WorkPatternRow[] | null
}

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function sanitizeInternalReturnTo(value: string | null | undefined): '/onboarding' | null {
  return value === '/onboarding' ? '/onboarding' : null
}

function sanitizeSetupScope(
  value: string | null | undefined
): 'preferences' | 'notifications' | null {
  return value === 'preferences' || value === 'notifications' ? value : null
}

function buildSettingsRedirectPath(
  result: 'success' | 'error',
  value: 'settings_saved' | 'settings_failed',
  returnTo: '/onboarding' | null,
  setupScope: 'preferences' | 'notifications' | null
) {
  if (result === 'success' && returnTo) {
    return `${returnTo}?${result}=${value}`
  }

  const query = new URLSearchParams([[result, value]])
  if (returnTo) {
    query.set('return_to', returnTo)
  }
  if (setupScope) {
    query.set('setup', setupScope)
  }

  if (returnTo) {
    return `/therapist/settings?${query.toString()}`
  }

  return `/therapist/settings?${query.toString()}`
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toPatternRecord(
  therapistId: string,
  value: ProfileRow['work_patterns']
): WorkPattern | null {
  const row = getOne(value)
  if (!row) return null

  return normalizeWorkPattern({
    therapist_id: therapistId,
    pattern_type: row.pattern_type ?? undefined,
    works_dow: row.works_dow ?? [],
    offs_dow: row.offs_dow ?? [],
    weekend_rotation: row.weekend_rotation === 'every_other' ? 'every_other' : undefined,
    weekend_anchor_date: row.weekend_anchor_date ?? null,
    works_dow_mode: row.works_dow_mode === 'soft' ? 'soft' : undefined,
    weekly_weekdays: row.weekly_weekdays ?? row.works_dow ?? [],
    weekend_rule: row.weekend_rule ?? undefined,
    cycle_anchor_date: row.cycle_anchor_date ?? null,
    cycle_segments: row.cycle_segments ?? [],
    shift_preference: row.shift_preference ?? 'either',
  })
}

function getFeedback(
  params?: SearchParams
): { message: string; variant: 'success' | 'error' } | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'settings_saved') {
    return { message: 'Settings saved.', variant: 'success' }
  }
  if (success === 'work_pattern_saved') {
    return { message: 'Recurring pattern saved.', variant: 'success' }
  }
  if (error === 'settings_failed') {
    return { message: 'Could not save settings. Please try again.', variant: 'error' }
  }
  if (error === 'work_pattern_save_failed') {
    return { message: 'Could not save recurring pattern. Please try again.', variant: 'error' }
  }
  if (error === 'invalid_weekend_anchor') {
    return { message: 'Weekend anchor date must be a Saturday.', variant: 'error' }
  }

  return null
}

async function saveTherapistSettingsAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const preferredWorkDays = parsePreferredWorkDaysSelection(formData)
  const maxConsecutiveDays = Number.parseInt(String(formData.get('max_consecutive_days') ?? ''), 10)
  const defaultCalendarView = String(formData.get('default_calendar_view') ?? '').trim()
  const defaultScheduleView = String(formData.get('default_schedule_view') ?? '').trim()
  const defaultLandingPage = String(formData.get('default_landing_page') ?? '').trim()
  const notificationInAppEnabled = formData.get('notification_in_app_enabled') === 'on'
  const notificationEmailEnabled = formData.get('notification_email_enabled') === 'on'
  const selectedTheme = String(formData.get('theme_preference') ?? '').trim()
  const returnTo = sanitizeInternalReturnTo(String(formData.get('return_to') ?? '').trim())
  const setupScope = sanitizeSetupScope(String(formData.get('setup_scope') ?? '').trim())

  if (
    preferredWorkDays.mode === 'unset' ||
    (preferredWorkDays.mode === 'specific_days' && preferredWorkDays.days.length === 0) ||
    !Number.isInteger(maxConsecutiveDays) ||
    maxConsecutiveDays < 1 ||
    maxConsecutiveDays > 7 ||
    (defaultCalendarView !== 'day' && defaultCalendarView !== 'night') ||
    (defaultScheduleView !== 'week' && defaultScheduleView !== 'roster') ||
    (defaultLandingPage !== 'dashboard' && defaultLandingPage !== 'coverage') ||
    !isTheme(selectedTheme)
  ) {
    redirect(buildSettingsRedirectPath('error', 'settings_failed', returnTo, setupScope))
  }

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('staff_onboarding_preferences_confirmed_at, staff_onboarding_theme_confirmed_at')
    .eq('id', user.id)
    .maybeSingle()

  if (existingProfileError || !existingProfile) {
    console.error(
      'Failed to load existing therapist settings confirmation state:',
      existingProfileError
    )
    redirect(buildSettingsRedirectPath('error', 'settings_failed', returnTo, setupScope))
  }

  const confirmedAt = new Date().toISOString()
  const nextPreferencesConfirmedAt =
    setupScope === 'preferences'
      ? (existingProfile.staff_onboarding_preferences_confirmed_at ?? confirmedAt)
      : existingProfile.staff_onboarding_preferences_confirmed_at
  const nextThemeConfirmedAt =
    setupScope === 'notifications'
      ? (existingProfile.staff_onboarding_theme_confirmed_at ?? confirmedAt)
      : existingProfile.staff_onboarding_theme_confirmed_at
  const { error } = await supabase
    .from('profiles')
    .update({
      preferred_work_days: preferredWorkDays.days,
      preferred_work_days_mode: preferredWorkDays.mode,
      max_consecutive_days: maxConsecutiveDays,
      default_calendar_view: defaultCalendarView,
      default_schedule_view: defaultScheduleView,
      default_landing_page: defaultLandingPage,
      notification_in_app_enabled: notificationInAppEnabled,
      notification_email_enabled: notificationEmailEnabled,
      staff_onboarding_preferences_confirmed_at: nextPreferencesConfirmedAt,
      staff_onboarding_theme_confirmed_at: nextThemeConfirmedAt,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update therapist settings:', error)
    redirect(buildSettingsRedirectPath('error', 'settings_failed', returnTo, setupScope))
  }

  revalidatePath('/therapist/settings')
  revalidatePath('/profile')
  revalidatePath('/onboarding')
  redirect(buildSettingsRedirectPath('success', 'settings_saved', returnTo, setupScope))
}

export default async function TherapistSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const params = searchParams ? await searchParams : undefined
  const feedback = getFeedback(params)
  const returnTo = sanitizeInternalReturnTo(getSearchParam(params?.return_to))
  const setupScope = sanitizeSetupScope(getSearchParam(params?.setup))

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, shift_type, employment_type, is_lead_eligible, max_work_days_per_week, max_consecutive_days, preferred_work_days, preferred_work_days_mode, staff_onboarding_preferences_confirmed_at, staff_onboarding_theme_confirmed_at, default_calendar_view, default_schedule_view, default_landing_page, notification_in_app_enabled, notification_email_enabled, work_patterns(pattern_type, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, weekly_weekdays, weekend_rule, cycle_anchor_date, cycle_segments, shift_preference)'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/login')

  const role = toUiRole(profile.role)
  if (can(role, 'access_manager_ui')) {
    redirect('/profile')
  }

  const preferredWorkDays = Array.isArray(profile.preferred_work_days)
    ? profile.preferred_work_days
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    : []
  const preferredWorkDaysMode = resolvePreferredWorkDaysMode(
    profile.preferred_work_days_mode,
    preferredWorkDays
  )
  const defaultCalendarView = profile.default_calendar_view === 'night' ? 'night' : 'day'
  const defaultScheduleView = normalizeDefaultScheduleView(
    profile.default_schedule_view ?? undefined
  )
  const defaultLandingPage = profile.default_landing_page === 'coverage' ? 'coverage' : 'dashboard'
  const pattern = toPatternRecord(profile.id, profile.work_patterns)
  const patternSummary = describeWorkPatternSummary(pattern)
  const hasRecurringPattern = Boolean(pattern && pattern.pattern_type !== 'none')
  const recurringPatternHref = returnTo
    ? `/therapist/recurring-pattern?return_to=${encodeURIComponent(returnTo)}`
    : '/therapist/recurring-pattern'

  return (
    <div className="space-y-6">
      {feedback ? <FeedbackToast message={feedback.message} variant={feedback.variant} /> : null}

      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          My Schedule Preferences
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your normal schedule, schedule preferences, and notification settings.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {profile.shift_type === 'night' ? 'Night shift' : 'Day shift'}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {(profile.employment_type ?? 'full_time').replace('_', ' ')}
          </Badge>
          <Badge variant="outline">Max {profile.max_work_days_per_week ?? 3}/week</Badge>
        </div>
      </div>

      {feedback?.variant === 'error' ? (
        <p className="inline-flex items-center gap-2 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {feedback.message}
        </p>
      ) : null}

      <Card className="border-border/90">
        <CardHeader>
          <CardTitle>Recurring Work Pattern</CardTitle>
          <CardDescription>
            This is your normal repeating schedule. Future Availability starts here and lets you
            make cycle-only changes separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <WorkPatternCard pattern={pattern} />
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3.5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {hasRecurringPattern ? 'What this controls' : 'What happens next'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasRecurringPattern
                  ? patternSummary
                  : 'Future Availability will start blank until you save a normal schedule.'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Editing future availability will not change this recurring pattern.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={recurringPatternHref}>
              {hasRecurringPattern ? 'Edit normal schedule' : 'Set normal schedule'}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <form action={saveTherapistSettingsAction} className="space-y-6">
        {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
        {setupScope ? <input type="hidden" name="setup_scope" value={setupScope} /> : null}

        <Card className="border-border/90">
          <CardHeader>
            <CardTitle>Schedule Preferences</CardTitle>
            <CardDescription>
              Set your preferred days, viewing defaults, and your maximum consecutive-day
              preference.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max_consecutive_days">Max consecutive days</Label>
                <select
                  id="max_consecutive_days"
                  name="max_consecutive_days"
                  defaultValue={String(profile.max_consecutive_days ?? 3)}
                  className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                    <option key={value} value={value}>
                      {value} day{value === 1 ? '' : 's'}
                    </option>
                  ))}
                </select>
              </div>
              <PreferredWorkDaysFieldset
                legend="Preferred work days"
                description="Choose specific weekdays or tell us you have no day-of-week preference."
                initialMode={preferredWorkDaysMode}
                initialSelectedDays={preferredWorkDays}
                weekdayOptions={WEEKDAY_OPTIONS}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-card px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Notification preferences</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Global channel controls for schedule and request updates.
                </p>
              </div>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="notification_in_app_enabled"
                  className="h-4 w-4 accent-[var(--primary)]"
                  defaultChecked={profile.notification_in_app_enabled !== false}
                />
                In-app notifications
              </label>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="notification_email_enabled"
                  className="h-4 w-4 accent-[var(--primary)]"
                  defaultChecked={profile.notification_email_enabled !== false}
                />
                Email notifications
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/90">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Choose your preferred theme or follow the system setting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ThemePreferenceControl />
            <FormSubmitButton type="submit" pendingText="Saving...">
              Save settings
            </FormSubmitButton>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
