import { NextResponse } from 'next/server'

import type {
  AutoScheduleShiftRow,
  AvailabilityOverrideRow,
  ShiftLimitRow,
  Therapist,
} from '@/app/schedule/types'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { runPreFlight, summarizePreFlight } from '@/lib/coverage/pre-flight'
import { normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'
import { getWeekBoundsForDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/server'

type CycleRow = {
  id: string
  start_date: string
  end_date: string
  published: boolean
}

type WorkPatternRow = {
  therapist_id: string
  pattern_type: WorkPattern['pattern_type'] | null
  works_dow: number[] | null
  offs_dow: number[] | null
  weekend_rotation: 'none' | 'every_other' | null
  weekend_anchor_date: string | null
  works_dow_mode: 'hard' | 'soft' | null
  weekly_weekdays: number[] | null
  weekend_rule: WorkPattern['weekend_rule'] | null
  cycle_anchor_date: string | null
  cycle_segments: WorkPattern['cycle_segments'] | null
  shift_preference: 'day' | 'night' | 'either' | null
}

type TherapistRow = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  is_lead_eligible: boolean
  employment_type: 'full_time' | 'part_time' | 'prn'
  max_work_days_per_week: number
  on_fmla: boolean
  fmla_return_date: string | null
  is_active: boolean
}

type ExistingShiftRow = AutoScheduleShiftRow & {
  user_id: string | null
  unfilled_reason?: string | null
}

function buildTherapists(
  rawTherapists: TherapistRow[],
  workPatterns: WorkPatternRow[]
): Therapist[] {
  const patternByTherapist = new Map(
    workPatterns.map((row) => [
      row.therapist_id,
      normalizeWorkPattern({
        therapist_id: row.therapist_id,
        pattern_type: row.pattern_type ?? undefined,
        works_dow: row.works_dow ?? [],
        offs_dow: row.offs_dow ?? [],
        weekend_rotation: row.weekend_rotation ?? undefined,
        weekend_anchor_date: row.weekend_anchor_date,
        works_dow_mode: row.works_dow_mode ?? undefined,
        weekly_weekdays: row.weekly_weekdays ?? row.works_dow ?? [],
        weekend_rule: row.weekend_rule ?? undefined,
        cycle_anchor_date: row.cycle_anchor_date ?? null,
        cycle_segments: row.cycle_segments ?? [],
        shift_preference: row.shift_preference ?? 'either',
      }),
    ])
  )

  return rawTherapists.map((therapist) => {
    const pattern =
      patternByTherapist.get(therapist.id) ??
      normalizeWorkPattern({
        therapist_id: therapist.id,
        works_dow: [0, 1, 2, 3, 4, 5, 6],
        offs_dow: [],
        weekend_rotation: 'none',
        weekend_anchor_date: null,
        works_dow_mode: 'hard',
        shift_preference: 'either',
      })
    return {
      ...therapist,
      works_dow: [0, 1, 2, 3, 4, 5, 6],
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'hard',
      pattern,
      shift_preference: pattern.shift_preference,
    }
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (
    !can(parseRole(profile?.role), 'manage_schedule', {
      isActive: profile?.is_active !== false,
      archivedAt: profile?.archived_at ?? null,
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as { cycleId?: string }
  const cycleId = String(body.cycleId ?? '').trim()
  if (!cycleId) {
    return NextResponse.json({ error: 'cycleId is required' }, { status: 400 })
  }

  const { data: cycle, error: cycleError } = await supabase
    .from('schedule_cycles')
    .select('id, start_date, end_date, published')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  const cycleRow = cycle as CycleRow

  const { data: therapistsData, error: therapistsError } = await supabase
    .from('profiles')
    .select(
      'id, full_name, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, on_fmla, fmla_return_date, is_active'
    )
    .eq('is_active', true)
    .eq('on_fmla', false)
    .in('role', ['therapist', 'lead'])
    .order('full_name', { ascending: true })

  if (therapistsError) {
    return NextResponse.json({ error: 'Could not load therapists' }, { status: 500 })
  }

  const rawTherapists = (therapistsData ?? []) as TherapistRow[]
  const therapistIds = rawTherapists.map((therapist) => therapist.id)
  const firstWeekBounds = getWeekBoundsForDate(cycleRow.start_date)
  const lastWeekBounds = getWeekBoundsForDate(cycleRow.end_date)
  if (!firstWeekBounds || !lastWeekBounds) {
    return NextResponse.json({ error: 'Could not resolve cycle week bounds' }, { status: 500 })
  }

  const [workPatternsResult, existingShiftsResult, overridesResult, weeklyShiftsResult] =
    await Promise.all([
      therapistIds.length > 0
        ? supabase
            .from('work_patterns')
            .select(
              'therapist_id, pattern_type, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, weekly_weekdays, weekend_rule, cycle_anchor_date, cycle_segments, shift_preference'
            )
            .in('therapist_id', therapistIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('shifts')
        .select('user_id, date, shift_type, status, role, unfilled_reason')
        .eq('cycle_id', cycleId),
      supabase
        .from('availability_overrides')
        .select('therapist_id, cycle_id, date, shift_type, override_type, note, source')
        .eq('cycle_id', cycleId)
        .gte('date', cycleRow.start_date)
        .lte('date', cycleRow.end_date),
      supabase
        .from('shifts')
        .select('user_id, date, status')
        .in('user_id', therapistIds)
        .gte('date', firstWeekBounds.weekStart)
        .lte('date', lastWeekBounds.weekEnd),
    ])

  if (
    workPatternsResult.error ||
    existingShiftsResult.error ||
    overridesResult.error ||
    weeklyShiftsResult.error
  ) {
    return NextResponse.json({ error: 'Could not load pre-flight data' }, { status: 500 })
  }

  const therapists = buildTherapists(
    rawTherapists,
    (workPatternsResult.data ?? []) as WorkPatternRow[]
  )
  const existingShifts = ((existingShiftsResult.data ?? []) as ExistingShiftRow[]).filter(
    (row) => Boolean(row.user_id) && !row.unfilled_reason
  ) as AutoScheduleShiftRow[]
  const allAvailabilityOverrides = (overridesResult.data ?? []) as AvailabilityOverrideRow[]
  const weeklyShifts = (weeklyShiftsResult.data ?? []) as ShiftLimitRow[]

  const result = runPreFlight({
    cycleId,
    cycleStartDate: cycleRow.start_date,
    cycleEndDate: cycleRow.end_date,
    therapists,
    existingShifts,
    allAvailabilityOverrides,
    weeklyShifts,
  })
  const summary = summarizePreFlight(result)

  return NextResponse.json({
    unfilledSlots: summary.unfilledSlots,
    missingLeadSlots: summary.missingLeadSlots,
    forcedMustWorkMisses: summary.forcedMustWorkMisses,
    details: summary.details.map((detail) => ({
      date: detail.date,
      shiftType: detail.shiftType,
    })),
  })
}
