import type { TableToolbarFilters } from '@/components/TableToolbar'
import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import {
  type AvailabilityCycle,
  mapAvailabilityRowsToTableRows,
  selectAvailabilityCycle,
  type AvailabilityOverrideRow,
} from '@/lib/availability-page-data'
import { getSearchParam } from '@/lib/availability-page-helpers'
import {
  fetchAvailabilityCycles,
  fetchAvailabilityEntries,
  fetchAvailabilitySubmissionRows,
  fetchManagerPlannerOverrides,
} from '@/lib/availability-server-data'
import {
  buildAvailabilitySubmissionMap,
  buildManagerAvailabilityRosterViewModel,
  getTodayKey,
} from '@/lib/availability-page-view-model'
import { normalizeWorkPattern, type WorkPattern } from '@/lib/coverage/work-patterns'

type SupabaseLike = {
  from: (table: string) => {
    select: (selection: string, options?: Record<string, unknown>) => SupabaseQueryLike
  }
}

type SupabaseQueryLike = PromiseLike<{ data?: unknown; count?: number | null }> & {
  eq: (column: string, value: unknown) => SupabaseQueryLike
  in: (column: string, values: unknown[]) => SupabaseQueryLike
  is: (column: string, value: unknown) => SupabaseQueryLike
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryLike
}

type AvailabilityPageSearchParams = {
  cycle?: string | string[]
  search?: string | string[]
  therapist?: string | string[]
  roster?: string | string[]
  status?: string | string[]
  startDate?: string | string[]
  endDate?: string | string[]
  sort?: string | string[]
}

type ManagerPlannerTherapistRow = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
}

type ManagerPlannerOverrideRow = {
  id: string
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  source: 'manager' | 'therapist'
}

type WorkPatternRow = {
  therapist_id: string
  works_dow: number[] | null
  offs_dow: number[] | null
  weekend_rotation: 'none' | 'every_other' | null
  weekend_anchor_date: string | null
  works_dow_mode: 'hard' | 'soft' | null
  shift_preference?: 'day' | 'night' | 'either' | null
}

export async function loadTherapistAvailabilityPageData(params: {
  supabase: SupabaseLike
  userId: string
  searchParams?: AvailabilityPageSearchParams
}) {
  const todayKey = getTodayKey()
  const cycles = (await fetchAvailabilityCycles(
    params.supabase as never,
    todayKey
  )) as AvailabilityCycle[]
  const selectedCycleIdFromParams = getSearchParam(params.searchParams?.cycle)
  const selectedCycle = selectAvailabilityCycle(cycles, selectedCycleIdFromParams)
  const selectedCycleId = selectedCycle?.id ?? ''
  const activeCycle =
    cycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ?? null

  const submissionRowsData = await fetchAvailabilitySubmissionRows({
    supabase: params.supabase as never,
    therapistId: params.userId,
    cycleIds: cycles.map((cycle) => cycle.id),
  })

  const submissionsByCycleId = buildAvailabilitySubmissionMap(submissionRowsData)
  const entries = (await fetchAvailabilityEntries({
    supabase: params.supabase as never,
    selectedCycleId,
    therapistId: params.userId,
  })) as AvailabilityOverrideRow[]
  const availabilityRows = mapAvailabilityRowsToTableRows(entries)

  const initialStatus = getSearchParam(params.searchParams?.status)
  const initialSort = getSearchParam(params.searchParams?.sort)
  const initialFilters: Partial<TableToolbarFilters> = {
    search: getSearchParam(params.searchParams?.search) ?? '',
    status: initialStatus ?? undefined,
    startDate: getSearchParam(params.searchParams?.startDate) ?? '',
    endDate: getSearchParam(params.searchParams?.endDate) ?? '',
    sort: initialSort === 'oldest' ? 'oldest' : 'newest',
  }

  return {
    todayKey,
    cycles,
    selectedCycle,
    selectedCycleId,
    activeCycle,
    submissionsByCycleId,
    entries,
    availabilityRows,
    initialFilters,
  }
}

export async function loadManagerAvailabilityPageData(params: {
  supabase: SupabaseLike
  userId: string
  searchParams?: AvailabilityPageSearchParams
}) {
  const todayKey = getTodayKey()
  const cycles = (await fetchAvailabilityCycles(
    params.supabase as never,
    todayKey
  )) as AvailabilityCycle[]
  const selectedCycleIdFromParams = getSearchParam(params.searchParams?.cycle)
  const selectedTherapistIdFromParams = getSearchParam(params.searchParams?.therapist)
  const selectedCycle = selectAvailabilityCycle(cycles, selectedCycleIdFromParams)
  const selectedCycleId = selectedCycle?.id ?? ''

  const entries = (await fetchAvailabilityEntries({
    supabase: params.supabase as never,
    selectedCycleId,
  })) as AvailabilityOverrideRow[]
  const availabilityRows = mapAvailabilityRowsToTableRows(entries).map((row) => ({
    ...row,
    canDelete: row.therapistId === params.userId,
  })) as AvailabilityEntryTableRow[]

  const [{ count: teamCount }, { count: intakeReviewCount }, plannerTherapistsResult] =
    await Promise.all([
      params.supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['therapist', 'lead'])
        .eq('is_active', true),
      params.supabase
        .from('availability_email_intake_items')
        .select('id', { count: 'exact', head: true })
        .eq('parse_status', 'needs_review'),
      params.supabase
        .from('profiles')
        .select('id, full_name, shift_type, employment_type')
        .in('role', ['therapist', 'lead'])
        .eq('is_active', true)
        .is('archived_at', null)
        .order('full_name', { ascending: true }),
    ])

  const plannerTherapists = (plannerTherapistsResult.data ?? []) as ManagerPlannerTherapistRow[]
  const plannerOverrides = (await fetchManagerPlannerOverrides(
    params.supabase as never,
    cycles.map((cycle) => cycle.id)
  )) as ManagerPlannerOverrideRow[]

  const plannerWorkPatternsResult =
    plannerTherapists.length > 0
      ? await params.supabase
          .from('work_patterns')
          .select(
            'therapist_id, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, shift_preference'
          )
          .in(
            'therapist_id',
            plannerTherapists.map((therapist) => therapist.id)
          )
      : { data: [] }

  const plannerWorkPatterns = new Map<string, WorkPattern>()
  for (const row of (plannerWorkPatternsResult.data ?? []) as WorkPatternRow[]) {
    plannerWorkPatterns.set(
      row.therapist_id,
      normalizeWorkPattern({
        therapist_id: row.therapist_id,
        works_dow: row.works_dow ?? undefined,
        offs_dow: row.offs_dow ?? undefined,
        weekend_rotation: row.weekend_rotation ?? undefined,
        weekend_anchor_date: row.weekend_anchor_date,
        works_dow_mode: row.works_dow_mode ?? undefined,
        shift_preference: row.shift_preference,
      })
    )
  }

  const selectedPlannerTherapistId =
    plannerTherapists.find((therapist) => therapist.id === selectedTherapistIdFromParams)?.id ??
    plannerTherapists[0]?.id ??
    ''

  const officialSubmissionRows = selectedCycleId
    ? await params.supabase
        .from('therapist_availability_submissions')
        .select('therapist_id')
        .eq('schedule_cycle_id', selectedCycleId)
    : { data: [] }

  const officialSubmissionTherapistIds = new Set(
    ((officialSubmissionRows.data ?? []) as Array<{ therapist_id: string }>).map(
      (row) => row.therapist_id
    )
  )

  const rosterViewModel = buildManagerAvailabilityRosterViewModel({
    therapists: plannerTherapists,
    entries,
    selectedCycleId,
    officialSubmissionTherapistIds,
  })

  const initialStatus = getSearchParam(params.searchParams?.status)
  const initialSort = getSearchParam(params.searchParams?.sort)
  const searchFromUrl = getSearchParam(params.searchParams?.search) ?? ''
  const initialRoster = getSearchParam(params.searchParams?.roster)
  const plannerTherapistNameForDefault = selectedPlannerTherapistId
    ? (plannerTherapists.find((t) => t.id === selectedPlannerTherapistId)?.full_name ?? null)
    : null
  const mergedSearchForTable =
    searchFromUrl.trim() !== '' ? searchFromUrl : (plannerTherapistNameForDefault ?? '')

  const initialFilters: Partial<TableToolbarFilters> = {
    search: mergedSearchForTable,
    status: initialStatus ?? undefined,
    startDate: getSearchParam(params.searchParams?.startDate) ?? '',
    endDate: getSearchParam(params.searchParams?.endDate) ?? '',
    sort: initialSort === 'oldest' ? 'oldest' : 'newest',
  }

  const defaultSecondaryTab =
    initialStatus ||
    searchFromUrl.trim() !== '' ||
    initialFilters.startDate ||
    initialFilters.endDate
      ? ('inbox' as const)
      : ('roster' as const)
  const defaultSecondaryOpen = Boolean(
    initialStatus ||
    searchFromUrl.trim() !== '' ||
    initialFilters.startDate ||
    initialFilters.endDate ||
    initialRoster
  )

  return {
    todayKey,
    cycles,
    selectedCycle,
    selectedCycleId,
    activeTeamCount: teamCount ?? null,
    intakeNeedsReviewCount: intakeReviewCount ?? 0,
    entries,
    availabilityRows,
    plannerTherapists,
    plannerOverrides,
    plannerWorkPatterns,
    selectedPlannerTherapistId,
    initialRoster,
    initialStatus,
    initialFilters,
    defaultSecondaryTab,
    defaultSecondaryOpen,
    plannerTherapistNameForDefault,
    ...rosterViewModel,
  }
}
