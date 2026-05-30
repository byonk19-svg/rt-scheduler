import { redirect } from 'next/navigation'

import {
  completeScheduleSetupOnboardingAction,
  loadStaffOnboardingContext,
} from '@/app/(app)/onboarding/actions'
import { OnboardingScheduleSetup } from '@/app/(app)/onboarding/OnboardingScheduleSetup'
import { FeedbackToast } from '@/components/feedback-toast'
import { normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'
import type { PreferredWorkDaysMode } from '@/lib/staff-onboarding'

type OnboardingSearchParams = Record<string, string | string[] | undefined>

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

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizePreferredDays(value: number[] | null | undefined): number[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ).sort((left, right) => left - right)
}

function normalizePreferredWorkDaysMode(value: string | null | undefined): PreferredWorkDaysMode {
  return value === 'specific_days' || value === 'no_preference' ? value : 'unset'
}

function toPatternRecord(
  therapistId: string,
  value: WorkPatternRow | WorkPatternRow[] | null
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

function getOnboardingFeedback(
  params?: OnboardingSearchParams
): { message: string; variant: 'error' | 'success' } | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'setup_complete') {
    return {
      message: 'Schedule setup complete.',
      variant: 'success',
    }
  }

  if (error === 'incomplete') {
    return {
      message: 'Finish setup after choosing a valid schedule and preferences.',
      variant: 'error',
    }
  }

  if (error === 'complete_failed') {
    return {
      message: 'We could not finish setup. Please try again.',
      variant: 'error',
    }
  }

  return null
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<OnboardingSearchParams>
}) {
  const context = await loadStaffOnboardingContext()
  const params = searchParams ? await searchParams : undefined
  const feedback = getOnboardingFeedback(params)
  const success = getSearchParam(params?.success)

  if (success === 'setup_complete') {
    redirect('/schedule?setup=complete')
  }

  if (!context.status.isRequired) {
    redirect('/dashboard')
  }

  if (context.status.hasRecordedCompletion) {
    redirect('/dashboard?success=onboarding_complete')
  }

  const initialPattern = toPatternRecord(
    context.profile.id,
    context.profile.work_patterns as WorkPatternRow | WorkPatternRow[] | null
  )
  const initialPreferredDays = normalizePreferredDays(context.profile.preferred_work_days)
  const initialPreferredWorkDaysMode = normalizePreferredWorkDaysMode(
    context.profile.preferred_work_days_mode
  )
  const initialMaxConsecutiveDays =
    typeof context.profile.max_consecutive_days === 'number'
      ? Math.min(7, Math.max(1, context.profile.max_consecutive_days))
      : 3

  return (
    <div className="space-y-6">
      {feedback && <FeedbackToast message={feedback.message} variant={feedback.variant} />}

      <OnboardingScheduleSetup
        initialPattern={initialPattern}
        initialMaxConsecutiveDays={initialMaxConsecutiveDays}
        initialPreferredWorkDays={initialPreferredDays}
        initialPreferredWorkDaysMode={initialPreferredWorkDaysMode}
        saveAction={completeScheduleSetupOnboardingAction}
      />
    </div>
  )
}
