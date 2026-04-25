import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

import { FeedbackToast } from '@/components/feedback-toast'
import { FormSubmitButton } from '@/components/form-submit-button'
import { ThemePreferenceControl } from '@/components/ThemeProvider'
import { WorkPatternCard } from '@/components/team/WorkPatternCard'
import {
  validateWeekendAnchorDate,
  WorkPatternEditDialog,
} from '@/components/team/WorkPatternEditDialog'
import type { WorkPatternRecord } from '@/components/team/team-directory-model'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { can } from '@/lib/auth/can'
import { toUiRole } from '@/lib/auth/roles'
import { normalizeDefaultScheduleView } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'

type SearchParams = {
  success?: string | string[]
  error?: string | string[]
}

type WorkPatternRow = {
  works_dow: number[] | null
  offs_dow: number[] | null
  weekend_rotation: string | null
  weekend_anchor_date: string | null
  works_dow_mode: string | null
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

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function parseDowValues(values: FormDataEntryValue[]): number[] {
  return Array.from(
    new Set(
      values
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    )
  ).sort((left, right) => left - right)
}

function toPatternRecord(value: ProfileRow['work_patterns']): WorkPatternRecord | null {
  const row = getOne(value)
  if (!row) return null

  const worksDow = row.works_dow ?? []
  const offsDow = row.offs_dow ?? []
  const weekendRotation = row.weekend_rotation === 'every_other' ? 'every_other' : 'none'
  const worksDowMode = row.works_dow_mode === 'soft' ? 'soft' : 'hard'

  if (worksDow.length === 0 && offsDow.length === 0 && weekendRotation === 'none') return null

  return {
    works_dow: worksDow,
    offs_dow: offsDow,
    weekend_rotation: weekendRotation,
    weekend_anchor_date: row.weekend_anchor_date ?? null,
    works_dow_mode: worksDowMode,
  }
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

  const preferredWorkDays = parseDowValues(formData.getAll('preferred_work_days'))
  const maxConsecutiveDays = Number.parseInt(String(formData.get('max_consecutive_days') ?? ''), 10)
  const defaultCalendarView = String(formData.get('default_calendar_view') ?? '').trim()
  const defaultScheduleView = String(formData.get('default_schedule_view') ?? '').trim()
  const defaultLandingPage = String(formData.get('default_landing_page') ?? '').trim()
  const notificationInAppEnabled = formData.get('notification_in_app_enabled') === 'on'
  const notificationEmailEnabled = formData.get('notification_email_enabled') === 'on'

  if (
    !Number.isInteger(maxConsecutiveDays) ||
    maxConsecutiveDays < 1 ||
    maxConsecutiveDays > 7 ||
    (defaultCalendarView !== 'day' && defaultCalendarView !== 'night') ||
    (defaultScheduleView !== 'week' && defaultScheduleView !== 'roster') ||
    (defaultLandingPage !== 'dashboard' && defaultLandingPage !== 'coverage')
  ) {
    redirect('/therapist/settings?error=settings_failed')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      preferred_work_days: preferredWorkDays,
      max_consecutive_days: maxConsecutiveDays,
      default_calendar_view: defaultCalendarView,
      default_schedule_view: defaultScheduleView,
      default_landing_page: defaultLandingPage,
      notification_in_app_enabled: notificationInAppEnabled,
      notification_email_enabled: notificationEmailEnabled,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update therapist settings:', error)
    redirect('/therapist/settings?error=settings_failed')
  }

  revalidatePath('/therapist/settings')
  revalidatePath('/profile')
  redirect('/therapist/settings?success=settings_saved')
}

async function saveOwnWorkPatternAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  if (weekendAnchorDate && validateWeekendAnchorDate(weekendAnchorDate)) {
    redirect('/therapist/settings?error=invalid_weekend_anchor')
  }

  const shouldDeletePattern =
    worksDow.length === 0 &&
    offsDow.length === 0 &&
    weekendRotation === 'none' &&
    !weekendAnchorDate

  if (shouldDeletePattern) {
    const { error } = await supabase.from('work_patterns').delete().eq('therapist_id', user.id)
    if (error) {
      console.error('Failed to delete own work pattern:', error)
      redirect('/therapist/settings?error=work_pattern_save_failed')
    }
  } else {
    const { error } = await supabase.from('work_patterns').upsert(
      {
        therapist_id: user.id,
        works_dow: worksDow,
        offs_dow: offsDow,
        works_dow_mode: worksDowMode,
        weekend_rotation: weekendRotation,
        weekend_anchor_date: weekendAnchorDate,
        shift_preference: 'either',
      },
      { onConflict: 'therapist_id' }
    )

    if (error) {
      console.error('Failed to save own work pattern:', error)
      redirect('/therapist/settings?error=work_pattern_save_failed')
    }
  }

  revalidatePath('/therapist/settings')
  revalidatePath('/profile')
  redirect('/therapist/settings?success=work_pattern_saved')
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

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, role, shift_type, employment_type, is_lead_eligible, max_work_days_per_week, max_consecutive_days, preferred_work_days, default_calendar_view, default_schedule_view, default_landing_page, notification_in_app_enabled, notification_email_enabled, work_patterns(works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode)'
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
  const defaultCalendarView = profile.default_calendar_view === 'night' ? 'night' : 'day'
  const defaultScheduleView = normalizeDefaultScheduleView(
    profile.default_schedule_view ?? undefined
  )
  const defaultLandingPage = profile.default_landing_page === 'coverage' ? 'coverage' : 'dashboard'
  const pattern = toPatternRecord(profile.work_patterns)
  const fullName = profile.full_name ?? 'Therapist'

  return (
    <div className="space-y-6">
      {feedback ? <FeedbackToast message={feedback.message} variant={feedback.variant} /> : null}

      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Preferences / Work Rules
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your recurring pattern, work rules, and notification preferences.
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
          <CardTitle>Recurring Pattern</CardTitle>
          <CardDescription>
            Update the work pattern that carries into future availability and scheduling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            {pattern ? (
              <WorkPatternCard
                worksDow={pattern.works_dow}
                offsDow={pattern.offs_dow}
                weekendRotation={pattern.weekend_rotation}
                worksDowMode={pattern.works_dow_mode}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No recurring pattern saved yet.</p>
            )}
          </div>
          <WorkPatternEditDialog
            therapistId={profile.id}
            therapistName={fullName}
            initialPattern={pattern}
            saveWorkPatternAction={saveOwnWorkPatternAction}
          />
        </CardContent>
      </Card>

      <Card className="border-border/90">
        <CardHeader>
          <CardTitle>Work Rules</CardTitle>
          <CardDescription>
            Set the days you prefer to work and your maximum consecutive-day preference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveTherapistSettingsAction} className="space-y-5">
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
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Preferred work days</p>
                <div className="grid grid-cols-2 gap-2">
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
              </div>
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

            <FormSubmitButton type="submit" pendingText="Saving...">
              Save settings
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
    </div>
  )
}
