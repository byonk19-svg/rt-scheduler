import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { WorkPattern } from '@/lib/coverage/work-patterns'
import {
  getStaffOnboardingStatus,
  type PreferredWorkDaysMode,
  type StaffOnboardingStatus,
} from '@/lib/staff-onboarding'
import {
  resolveTherapistAvailabilityCycleId,
  type TherapistWorkflowCycle,
  type TherapistWorkflowPreliminarySnapshot,
} from '@/lib/therapist-workflow'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type WorkPatternRow = {
  pattern_type: WorkPattern['pattern_type'] | null
}

type ProfileRow = {
  id: string
  role: string | null
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
      'id, role, preferred_work_days_mode, staff_onboarding_required, staff_onboarding_preferences_confirmed_at, staff_onboarding_theme_confirmed_at, staff_onboarding_completed_at, work_patterns(pattern_type)'
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
