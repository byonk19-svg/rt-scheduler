import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { RecurringPatternEditor } from '@/components/availability/RecurringPatternEditor'
import { FeedbackToast } from '@/components/feedback-toast'
import { Button } from '@/components/ui/button'
import { normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'
import { can } from '@/lib/auth/can'
import { toUiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'

type SearchParams = {
  success?: string | string[]
  error?: string | string[]
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

function getSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getFeedback(
  params?: SearchParams
): { message: string; variant: 'success' | 'error' } | null {
  const success = getSearchParam(params?.success)
  const error = getSearchParam(params?.error)

  if (success === 'work_pattern_saved') {
    return { message: 'Recurring pattern saved.', variant: 'success' }
  }
  if (error === 'invalid_pattern') {
    return {
      message: 'Complete the required recurring-pattern fields before saving.',
      variant: 'error',
    }
  }
  if (error === 'save_failed') {
    return { message: 'Could not save recurring pattern. Please try again.', variant: 'error' }
  }

  return null
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

async function saveRecurringPatternAction(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const patternType = String(
    formData.get('pattern_type') ?? 'weekly_fixed'
  ).trim() as WorkPattern['pattern_type']
  const worksDowMode = String(
    formData.get('works_dow_mode') ?? 'hard'
  ).trim() as WorkPattern['works_dow_mode']
  const weekendRule = String(
    formData.get('weekend_rule') ?? 'none'
  ).trim() as WorkPattern['weekend_rule']
  const weekendAnchorDate = String(formData.get('weekend_anchor_date') ?? '').trim() || null
  const cycleAnchorDate = String(formData.get('cycle_anchor_date') ?? '').trim() || null
  const weeklyWeekdays = parseDowValues(formData.getAll('weekly_weekdays'))
  const cycleSegmentsJson = String(formData.get('cycle_segments_json') ?? '[]').trim()

  let cycleSegments: WorkPattern['cycle_segments'] = []
  try {
    const parsed = JSON.parse(cycleSegmentsJson) as unknown
    cycleSegments = Array.isArray(parsed) ? (parsed as WorkPattern['cycle_segments']) : []
  } catch {
    redirect('/therapist/recurring-pattern?error=invalid_pattern')
  }

  const normalized = normalizeWorkPattern({
    therapist_id: user.id,
    pattern_type: patternType,
    works_dow_mode: worksDowMode,
    weekly_weekdays:
      patternType === 'repeating_cycle' || patternType === 'none' ? [] : weeklyWeekdays,
    weekend_rule: patternType === 'weekly_with_weekend_rotation' ? weekendRule : 'none',
    weekend_anchor_date:
      patternType === 'weekly_with_weekend_rotation' && weekendRule === 'every_other_weekend'
        ? weekendAnchorDate
        : null,
    cycle_anchor_date: patternType === 'repeating_cycle' ? cycleAnchorDate : null,
    cycle_segments: patternType === 'repeating_cycle' ? cycleSegments : [],
  })

  const invalidWeeklyPattern =
    (normalized.pattern_type === 'weekly_fixed' ||
      normalized.pattern_type === 'weekly_with_weekend_rotation') &&
    normalized.weekly_weekdays.length === 0
  const invalidWeekendPattern =
    normalized.pattern_type === 'weekly_with_weekend_rotation' &&
    normalized.weekend_rule === 'every_other_weekend' &&
    !normalized.weekend_anchor_date
  const invalidCyclePattern =
    normalized.pattern_type === 'repeating_cycle' &&
    (!normalized.cycle_anchor_date || normalized.cycle_segments.length === 0)

  if (invalidWeeklyPattern || invalidWeekendPattern || invalidCyclePattern) {
    redirect('/therapist/recurring-pattern?error=invalid_pattern')
  }

  const { error } = await supabase.from('work_patterns').upsert(
    {
      therapist_id: user.id,
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

  if (error) {
    console.error('Failed to save recurring pattern:', error)
    redirect('/therapist/recurring-pattern?error=save_failed')
  }

  revalidatePath('/therapist/recurring-pattern')
  revalidatePath('/therapist/settings')
  revalidatePath('/therapist/availability')
  redirect('/therapist/recurring-pattern?success=work_pattern_saved')
}

export default async function TherapistRecurringPatternPage({
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
      'id, full_name, role, work_patterns(pattern_type, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, weekly_weekdays, weekend_rule, cycle_anchor_date, cycle_segments, shift_preference)'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) redirect('/login')

  const role = toUiRole(profile.role)
  if (can(role, 'access_manager_ui')) {
    redirect('/profile')
  }

  const patternRow = getOne(profile.work_patterns as WorkPatternRow | WorkPatternRow[] | null)
  const pattern = patternRow
    ? normalizeWorkPattern({
        therapist_id: profile.id,
        pattern_type: patternRow.pattern_type ?? undefined,
        works_dow: patternRow.works_dow ?? [],
        offs_dow: patternRow.offs_dow ?? [],
        weekend_rotation: patternRow.weekend_rotation === 'every_other' ? 'every_other' : undefined,
        weekend_anchor_date: patternRow.weekend_anchor_date ?? null,
        works_dow_mode: patternRow.works_dow_mode === 'soft' ? 'soft' : undefined,
        weekly_weekdays: patternRow.weekly_weekdays ?? patternRow.works_dow ?? [],
        weekend_rule: patternRow.weekend_rule ?? undefined,
        cycle_anchor_date: patternRow.cycle_anchor_date ?? null,
        cycle_segments: patternRow.cycle_segments ?? [],
        shift_preference: patternRow.shift_preference ?? 'either',
      })
    : null

  return (
    <div className="space-y-6">
      {feedback ? <FeedbackToast message={feedback.message} variant={feedback.variant} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-6 pb-4 pt-5">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Recurring Work Pattern
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define the default schedule template that future availability cycles will use first.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/therapist/settings">Back to settings</Link>
        </Button>
      </div>

      <RecurringPatternEditor initialPattern={pattern} saveAction={saveRecurringPatternAction} />
    </div>
  )
}
