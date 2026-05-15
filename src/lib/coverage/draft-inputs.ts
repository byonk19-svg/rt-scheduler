import type {
  AutoScheduleShiftRow,
  AvailabilityOverrideRow,
  ShiftLimitRow,
  Therapist,
} from '@/app/schedule/types'
import type { GenerateDraftInput } from '@/lib/coverage/generate-draft'
import { normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'
import { getWeekBoundsForDate } from '@/lib/schedule-helpers'

export const DRAFT_THERAPIST_COLUMNS =
  'id, full_name, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, on_fmla, fmla_return_date, is_active'

export const DRAFT_WORK_PATTERN_COLUMNS =
  'therapist_id, pattern_type, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, weekly_weekdays, weekend_rule, cycle_anchor_date, cycle_segments, shift_preference'

export const DRAFT_EXISTING_SHIFT_COLUMNS =
  'user_id, date, shift_type, status, role, unfilled_reason'

export const DRAFT_AVAILABILITY_OVERRIDE_COLUMNS =
  'therapist_id, cycle_id, date, shift_type, override_type, note, source'

export const DRAFT_WEEKLY_SHIFT_COLUMNS = 'user_id, date, status'

export type DraftTherapistRow = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  is_lead_eligible: boolean | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  max_work_days_per_week: number | null
  on_fmla: boolean | null
  fmla_return_date: string | null
  is_active: boolean | null
}

export type DraftWorkPatternRow = {
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

export type DraftExistingShiftRow = Omit<AutoScheduleShiftRow, 'user_id'> & {
  user_id: string | null
  unfilled_reason?: string | null
}

export type DraftInputSupabaseClient = {
  from: (table: string) => DraftInputTableBuilder
}

export function toDraftInputSupabaseClient(client: unknown): DraftInputSupabaseClient {
  return client as DraftInputSupabaseClient
}

type DraftInputTableBuilder = {
  select: (columns: string) => DraftInputFilterBuilder
}

type DraftInputFilterBuilder = PromiseLike<{ data: unknown; error: unknown }> & {
  in: (column: string, values: unknown[]) => DraftInputFilterBuilder
  order: (column: string, options?: Record<string, unknown>) => DraftInputFilterBuilder
  eq: (column: string, value: unknown) => DraftInputFilterBuilder
  gte: (column: string, value: unknown) => DraftInputFilterBuilder
  lte: (column: string, value: unknown) => DraftInputFilterBuilder
}

type DraftInputCycle = {
  id: string
  start_date: string
  end_date: string
  site_id?: string | null
}

export type DraftTherapistScope = 'all-schedule-candidates' | 'active-non-fmla'

export type LoadDraftInputsOptions = {
  cycle: DraftInputCycle
  therapistScope?: DraftTherapistScope
  therapistRows?: DraftTherapistRow[]
  existingShiftRows?: DraftExistingShiftRow[]
}

export type LoadDraftInputsResult =
  | { data: GenerateDraftInput; error: null }
  | {
      data: null
      error: {
        message: string
        therapistsError?: unknown
        workPatternsError?: unknown
        existingShiftsError?: unknown
        availabilityOverridesError?: unknown
        weeklyShiftsError?: unknown
        weekBoundsError?: true
      }
    }

export function buildDraftTherapists(
  rawTherapists: DraftTherapistRow[],
  workPatterns: DraftWorkPatternRow[]
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
        pattern_type: therapist.employment_type === 'prn' ? 'none' : undefined,
        works_dow: therapist.employment_type === 'prn' ? [] : [0, 1, 2, 3, 4, 5, 6],
        offs_dow: [],
        weekend_rotation: 'none',
        weekend_anchor_date: null,
        works_dow_mode: 'hard',
        shift_preference: 'either',
      })

    return {
      id: therapist.id,
      full_name: therapist.full_name,
      shift_type: therapist.shift_type,
      is_lead_eligible: therapist.is_lead_eligible ?? false,
      employment_type: therapist.employment_type ?? 'full_time',
      max_work_days_per_week: therapist.max_work_days_per_week ?? 0,
      works_dow: [0, 1, 2, 3, 4, 5, 6],
      offs_dow: [],
      weekend_rotation: 'none',
      weekend_anchor_date: null,
      works_dow_mode: 'hard',
      pattern,
      shift_preference: pattern.shift_preference,
      on_fmla: therapist.on_fmla ?? false,
      fmla_return_date: therapist.fmla_return_date,
      is_active: therapist.is_active ?? true,
    }
  })
}

export function toDraftExistingShifts(rows: DraftExistingShiftRow[]): AutoScheduleShiftRow[] {
  return rows.filter((row): row is AutoScheduleShiftRow => Boolean(row.user_id) && !row.unfilled_reason)
}

export async function loadDraftInputsForCycle(
  client: DraftInputSupabaseClient,
  options: LoadDraftInputsOptions
): Promise<LoadDraftInputsResult> {
  const { cycle, therapistRows, existingShiftRows } = options
  const firstWeekBounds = getWeekBoundsForDate(cycle.start_date)
  const lastWeekBounds = getWeekBoundsForDate(cycle.end_date)

  if (!firstWeekBounds || !lastWeekBounds) {
    return {
      data: null,
      error: { message: 'Could not resolve Schedule Block week bounds.', weekBoundsError: true },
    }
  }

  const loadedTherapistsResult =
    therapistRows == null
      ? await loadTherapistsForDraft(client, cycle.site_id, options.therapistScope)
      : { data: therapistRows, error: null }

  if (loadedTherapistsResult.error) {
    return {
      data: null,
      error: {
        message: 'Could not load therapists for draft generation.',
        therapistsError: loadedTherapistsResult.error,
      },
    }
  }

  const rawTherapists = (loadedTherapistsResult.data ?? []) as DraftTherapistRow[]
  const therapistIds = rawTherapists.map((therapist) => therapist.id)

  const [workPatternsResult, loadedExistingShiftsResult, availabilityOverridesResult, weeklyShiftsResult] =
    await Promise.all([
      therapistIds.length > 0
        ? client
            .from('work_patterns')
            .select(DRAFT_WORK_PATTERN_COLUMNS)
            .in('therapist_id', therapistIds)
        : Promise.resolve({ data: [], error: null }),
      existingShiftRows == null
        ? client
            .from('shifts')
            .select(DRAFT_EXISTING_SHIFT_COLUMNS)
            .eq('cycle_id', cycle.id)
        : Promise.resolve({ data: existingShiftRows, error: null }),
      client
        .from('availability_overrides')
        .select(DRAFT_AVAILABILITY_OVERRIDE_COLUMNS)
        .eq('cycle_id', cycle.id)
        .gte('date', cycle.start_date)
        .lte('date', cycle.end_date),
      therapistIds.length > 0
        ? client
            .from('shifts')
            .select(DRAFT_WEEKLY_SHIFT_COLUMNS)
            .in('user_id', therapistIds)
            .gte('date', firstWeekBounds.weekStart)
            .lte('date', lastWeekBounds.weekEnd)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (
    workPatternsResult.error ||
    loadedExistingShiftsResult.error ||
    availabilityOverridesResult.error ||
    weeklyShiftsResult.error
  ) {
    return {
      data: null,
      error: {
        message: 'Could not load scheduling data for draft generation.',
        workPatternsError: workPatternsResult.error,
        existingShiftsError: loadedExistingShiftsResult.error,
        availabilityOverridesError: availabilityOverridesResult.error,
        weeklyShiftsError: weeklyShiftsResult.error,
      },
    }
  }

  return {
    data: {
      cycleId: cycle.id,
      cycleStartDate: cycle.start_date,
      cycleEndDate: cycle.end_date,
      therapists: buildDraftTherapists(
        rawTherapists,
        (workPatternsResult.data ?? []) as DraftWorkPatternRow[]
      ),
      existingShifts: toDraftExistingShifts(
        (loadedExistingShiftsResult.data ?? []) as DraftExistingShiftRow[]
      ),
      allAvailabilityOverrides: (availabilityOverridesResult.data ?? []) as AvailabilityOverrideRow[],
      weeklyShifts: (weeklyShiftsResult.data ?? []) as ShiftLimitRow[],
    },
    error: null,
  }
}

function applyTherapistScope(query: DraftInputFilterBuilder, scope: DraftTherapistScope) {
  if (scope !== 'active-non-fmla') return query
  return query.eq('is_active', true).eq('on_fmla', false)
}

function loadTherapistsForDraft(
  client: DraftInputSupabaseClient,
  siteId: string | null | undefined,
  scope: DraftTherapistScope | undefined
) {
  const query = client
    .from('profiles')
    .select(DRAFT_THERAPIST_COLUMNS)
    .in('role', ['therapist', 'lead'])
    .order('full_name', { ascending: true })

  if (siteId) {
    query.eq('site_id', siteId)
  }

  return applyTherapistScope(query, scope ?? 'all-schedule-candidates')
}
