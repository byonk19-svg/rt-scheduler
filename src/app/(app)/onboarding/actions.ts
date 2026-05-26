import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { WorkPattern } from '@/lib/coverage/work-patterns'
import {
  getStaffOnboardingStatus,
  type PreferredWorkDaysMode,
  type StaffOnboardingStatus,
} from '@/lib/staff-onboarding'
import { normalizeWorkPattern } from '@/lib/coverage/work-patterns'
import { parsePreferredWorkDaysSelection } from '@/lib/preferred-work-days'
import {
  resolveTherapistAvailabilityCycleId,
  type TherapistWorkflowCycle,
  type TherapistWorkflowPreliminarySnapshot,
} from '@/lib/therapist-workflow'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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
  role: string | null
  max_consecutive_days: number | null
  preferred_work_days: number[] | null
  preferred_work_days_mode: PreferredWorkDaysMode | null
  staff_onboarding_required: boolean | null
  staff_onboarding_preferences_confirmed_at: string | null
  staff_onboarding_theme_confirmed_at: string | null
  staff_onboarding_completed_at: string | null
  work_patterns: WorkPatternRow | WorkPatternRow[] | null
}

type StaffOnboardingContext = {
  profile: ProfileRow
  status: StaffOnboardingStatus
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string }
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getTodayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function normalizePreferredWorkDaysMode(
  value: PreferredWorkDaysMode | null
): PreferredWorkDaysMode {
  return value === 'specific_days' || value === 'no_preference' ? value : 'unset'
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

function toOnboardingWorkPattern(
  value: ProfileRow['work_patterns']
): Pick<WorkPattern, 'pattern_type'> | null {
  const row = getOne(value)

  if (!row?.pattern_type) {
    return null
  }

  return { pattern_type: row.pattern_type }
}

function buildOnboardingStatus(
  profile: ProfileRow,
  hasActionableAvailabilityCycle: boolean
): StaffOnboardingStatus {
  return getStaffOnboardingStatus({
    role: profile.role,
    onboardingRequired: profile.staff_onboarding_required === true,
    preferredWorkDaysMode: normalizePreferredWorkDaysMode(profile.preferred_work_days_mode),
    preferencesConfirmedAt: profile.staff_onboarding_preferences_confirmed_at,
    themeConfirmedAt: profile.staff_onboarding_theme_confirmed_at,
    completedAt: profile.staff_onboarding_completed_at,
    workPattern: toOnboardingWorkPattern(profile.work_patterns),
    hasActionableAvailabilityCycle,
  })
}

async function loadBaseStaffOnboardingContext(): Promise<StaffOnboardingContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, role, max_consecutive_days, preferred_work_days, preferred_work_days_mode, staff_onboarding_required, staff_onboarding_preferences_confirmed_at, staff_onboarding_theme_confirmed_at, staff_onboarding_completed_at, work_patterns(pattern_type, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, weekly_weekdays, weekend_rule, cycle_anchor_date, cycle_segments, shift_preference)'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    redirect('/login')
  }

  return {
    profile: profile as ProfileRow,
    status: buildOnboardingStatus(profile as ProfileRow, false),
    supabase,
    user: { id: user.id },
  }
}

async function loadHasActionableAvailabilityCycle(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const admin = createAdminClient()
  const todayKey = getTodayKey()

  const { data: cyclesData } = await admin
    .from('schedule_cycles')
    .select('id, label, start_date, end_date, published, availability_due_at')
    .is('archived_at', null)
    .eq('published', false)
    .gte('end_date', todayKey)
    .order('start_date', { ascending: true })

  const cycles = (cyclesData ?? []) as TherapistWorkflowCycle[]
  if (cycles.length === 0) {
    return false
  }

  const { data: preliminarySnapshotsData } = await supabase
    .from('preliminary_snapshots')
    .select('cycle_id, status')
    .eq('status', 'active')
    .in(
      'cycle_id',
      cycles.map((cycle) => cycle.id)
    )

  return Boolean(
    resolveTherapistAvailabilityCycleId({
      todayKey,
      cycles,
      preliminarySnapshots:
        ((preliminarySnapshotsData ?? []) as TherapistWorkflowPreliminarySnapshot[]) ?? [],
    })
  )
}

export async function loadMutableStaffOnboardingContext() {
  return loadBaseStaffOnboardingContext()
}

export async function loadStaffOnboardingContext() {
  const context = await loadBaseStaffOnboardingContext()

  if (
    !context.status.isRequired ||
    context.status.hasRecordedCompletion ||
    !context.status.isComplete
  ) {
    return context
  }

  const hasActionableAvailabilityCycle = await loadHasActionableAvailabilityCycle(context.supabase)

  return {
    ...context,
    status: buildOnboardingStatus(context.profile, hasActionableAvailabilityCycle),
  }
}

export async function completeStaffOnboardingAction() {
  'use server'

  const context = await loadMutableStaffOnboardingContext()

  if (!context.status.isRequired) {
    redirect('/dashboard')
  }

  if (context.status.hasRecordedCompletion) {
    redirect('/dashboard?success=onboarding_complete')
  }

  if (!context.status.isComplete) {
    redirect('/onboarding?error=incomplete')
  }

  const { error } = await context.supabase
    .from('profiles')
    .update({ staff_onboarding_completed_at: new Date().toISOString() })
    .eq('id', context.user.id)

  if (error) {
    console.error('Failed to complete staff onboarding:', error)
    redirect('/onboarding?error=complete_failed')
  }

  revalidatePath('/onboarding')
  revalidatePath('/dashboard')

  redirect('/dashboard?success=onboarding_complete')
}

export async function completeScheduleSetupOnboardingAction(formData: FormData) {
  'use server'

  const context = await loadMutableStaffOnboardingContext()

  if (!context.status.isRequired) {
    redirect('/dashboard')
  }

  if (context.status.hasRecordedCompletion) {
    redirect('/onboarding?success=setup_complete')
  }

  const patternType = String(
    formData.get('pattern_type') ?? 'weekly_fixed'
  ).trim() as WorkPattern['pattern_type']
  const weekendRule = String(
    formData.get('weekend_rule') ?? 'none'
  ).trim() as WorkPattern['weekend_rule']
  const worksDowModeRaw = String(formData.get('works_dow_mode') ?? 'hard').trim()
  const worksDowMode: WorkPattern['works_dow_mode'] =
    patternType === 'weekly_with_weekend_rotation' && worksDowModeRaw === 'soft' ? 'soft' : 'hard'
  const weekendAnchorDate = String(formData.get('weekend_anchor_date') ?? '').trim() || null
  const cycleAnchorDate = String(formData.get('cycle_anchor_date') ?? '').trim() || null
  const weeklyWeekdays = parseDowValues(formData.getAll('weekly_weekdays'))
  const neverWorkDays = parseDowValues(formData.getAll('offs_dow'))
  const hasFixedNeverAvailableConflict =
    (patternType === 'weekly_fixed' ||
      (patternType === 'weekly_with_weekend_rotation' && worksDowMode !== 'soft')) &&
    weeklyWeekdays.some((day) => neverWorkDays.includes(day))
  const cycleSegmentsJson = String(formData.get('cycle_segments_json') ?? '[]').trim()
  const preferredWorkDays = parsePreferredWorkDaysSelection(formData)
  const safePreferredWorkDays = {
    mode: preferredWorkDays.mode,
    days: preferredWorkDays.days.filter((day) => !neverWorkDays.includes(day)),
  }
  if (safePreferredWorkDays.mode === 'specific_days' && safePreferredWorkDays.days.length === 0) {
    safePreferredWorkDays.mode = 'no_preference'
  }
  const maxConsecutiveDays = Number.parseInt(String(formData.get('max_consecutive_days') ?? ''), 10)

  let cycleSegments: WorkPattern['cycle_segments'] = []
  try {
    const parsed = JSON.parse(cycleSegmentsJson) as unknown
    cycleSegments = Array.isArray(parsed) ? (parsed as WorkPattern['cycle_segments']) : []
  } catch {
    redirect('/onboarding?error=incomplete')
  }

  const normalized = normalizeWorkPattern({
    therapist_id: context.user.id,
    pattern_type: patternType,
    works_dow_mode: worksDowMode,
    offs_dow: neverWorkDays,
    weekly_weekdays:
      patternType === 'repeating_cycle' ||
      patternType === 'none' ||
      (patternType === 'weekly_with_weekend_rotation' && worksDowMode === 'soft')
        ? []
        : weeklyWeekdays,
    weekend_rule: patternType === 'weekly_with_weekend_rotation' ? weekendRule : 'none',
    weekend_anchor_date:
      patternType === 'weekly_with_weekend_rotation' && weekendRule === 'every_other_weekend'
        ? weekendAnchorDate
        : null,
    cycle_anchor_date: patternType === 'repeating_cycle' ? cycleAnchorDate : null,
    cycle_segments: patternType === 'repeating_cycle' ? cycleSegments : [],
  })

  const invalidWeeklyPattern =
    normalized.pattern_type === 'weekly_fixed'
      ? normalized.weekly_weekdays.length === 0
      : normalized.pattern_type === 'weekly_with_weekend_rotation' &&
        normalized.works_dow_mode !== 'soft' &&
        normalized.weekly_weekdays.length === 0
  const invalidWeekendPattern =
    normalized.pattern_type === 'weekly_with_weekend_rotation' &&
    normalized.weekend_rule === 'every_other_weekend' &&
    !normalized.weekend_anchor_date
  const invalidCyclePattern =
    normalized.pattern_type === 'repeating_cycle' &&
    (!normalized.cycle_anchor_date || normalized.cycle_segments.length === 0)
  const invalidPreferences =
    !Number.isInteger(maxConsecutiveDays) ||
    maxConsecutiveDays < 1 ||
    maxConsecutiveDays > 7 ||
    safePreferredWorkDays.mode === 'unset' ||
    (safePreferredWorkDays.mode === 'specific_days' && safePreferredWorkDays.days.length === 0)

  if (
    hasFixedNeverAvailableConflict ||
    invalidWeeklyPattern ||
    invalidWeekendPattern ||
    invalidCyclePattern ||
    invalidPreferences
  ) {
    redirect('/onboarding?error=incomplete')
  }

  const { error: patternError } = await context.supabase.from('work_patterns').upsert(
    {
      therapist_id: context.user.id,
      pattern_type: normalized.pattern_type,
      works_dow: normalized.works_dow,
      offs_dow: normalized.offs_dow,
      weekend_rotation: normalized.weekend_rotation,
      weekend_anchor_date: normalized.weekend_anchor_date,
      works_dow_mode: normalized.works_dow_mode,
      shift_preference: normalized.shift_preference ?? 'either',
      weekly_weekdays: normalized.weekly_weekdays,
      weekend_rule: normalized.weekend_rule,
      cycle_anchor_date: normalized.cycle_anchor_date,
      cycle_segments: normalized.cycle_segments,
    },
    { onConflict: 'therapist_id' }
  )

  if (patternError) {
    console.error('Failed to save onboarding schedule setup:', patternError)
    redirect('/onboarding?error=complete_failed')
  }

  const confirmedAt = new Date().toISOString()
  const { error: profileError } = await context.supabase
    .from('profiles')
    .update({
      preferred_work_days: safePreferredWorkDays.days,
      preferred_work_days_mode: safePreferredWorkDays.mode,
      max_consecutive_days: maxConsecutiveDays,
      staff_onboarding_preferences_confirmed_at:
        context.profile.staff_onboarding_preferences_confirmed_at ?? confirmedAt,
      staff_onboarding_theme_confirmed_at:
        context.profile.staff_onboarding_theme_confirmed_at ?? confirmedAt,
      staff_onboarding_completed_at: confirmedAt,
    })
    .eq('id', context.user.id)

  if (profileError) {
    console.error('Failed to complete onboarding schedule setup:', profileError)
    redirect('/onboarding?error=complete_failed')
  }

  revalidatePath('/onboarding')
  revalidatePath('/dashboard')
  revalidatePath('/therapist/recurring-pattern')
  revalidatePath('/therapist/settings')
  revalidatePath('/therapist/availability')

  redirect('/onboarding?success=setup_complete')
}
