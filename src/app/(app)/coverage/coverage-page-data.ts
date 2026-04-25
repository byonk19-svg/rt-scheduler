import 'server-only'

import { redirect } from 'next/navigation'

import type {
  AutoScheduleShiftRow,
  AvailabilityOverrideRow,
  ShiftLimitRow,
  Therapist,
} from '@/app/schedule/types'
import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { dateRange } from '@/lib/calendar-utils'
import {
  defaultCoverageShiftTabFromProfileShift,
  normalizeActorShiftType,
  parseCoverageShiftSearchParam,
} from '@/lib/coverage/coverage-shift-tab'
import { generateDraftForCycle } from '@/lib/coverage/generate-draft'
import { buildCoverageRiskAlert } from '@/lib/coverage/proactive-risk'
import { resolveCoverageCycle } from '@/lib/coverage/active-cycle'
import { fetchScheduleCyclesForCoverage } from '@/lib/coverage/fetch-schedule-cycles'
import {
  buildDayItems,
  type BuildDayRowInput,
  type DayItem,
} from '@/lib/coverage/selectors'
import { normalizeWorkPattern } from '@/lib/coverage/work-patterns'
import {
  fetchActiveOperationalCodeMap,
  toLegacyShiftStatusFromOperationalCode,
} from '@/lib/operational-codes'
import {
  getWeekBoundsForDate,
  normalizeDefaultScheduleView,
  normalizeViewMode,
} from '@/lib/schedule-helpers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/lib/shift-types'

import type {
  CoveragePageServerData,
  CoveragePageSnapshot,
  PreliminarySnapshotRow,
  PrintTherapist,
  TherapistOption,
} from '@/app/(app)/coverage/coverage-page-snapshot'

type ShiftRow = {
  id: string
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus
  unfilled_reason: string | null
  role: ShiftRole
  profiles:
    | {
        full_name: string
        role?: 'therapist' | 'lead' | null
        employment_type: 'full_time' | 'part_time' | 'prn' | null
      }
    | {
        full_name: string
        role?: 'therapist' | 'lead' | null
        employment_type: 'full_time' | 'part_time' | 'prn' | null
      }[]
    | null
}

type AssignedShiftRow = Omit<ShiftRow, 'user_id'> & { user_id: string }

type ProfileNameRow = {
  id: string
  full_name: string | null
}

type ManagerTherapistRow = {
  id: string
  full_name: string
  role?: 'therapist' | 'lead'
  shift_type: 'day' | 'night'
  is_lead_eligible: boolean | null
  employment_type: 'full_time' | 'part_time' | 'prn' | null
  max_work_days_per_week: number | null
  on_fmla: boolean | null
  fmla_return_date: string | null
  is_active: boolean | null
}

type WorkPatternRow = {
  therapist_id: string
  works_dow: number[] | null
  offs_dow: number[] | null
  weekend_rotation: 'none' | 'every_other' | null
  weekend_anchor_date: string | null
  works_dow_mode: 'hard' | 'soft' | null
  shift_preference: 'day' | 'night' | 'either' | null
}

const NO_ELIGIBLE_CONSTRAINT_REASON = 'no_eligible_candidates_due_to_constraints'

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function buildEmptyCoverageDays(cycleStartDate: string, cycleEndDate: string): DayItem[] {
  return dateRange(cycleStartDate, cycleEndDate).map((isoDate) => {
    const date = new Date(`${isoDate}T00:00:00`)
    return {
      id: isoDate,
      isoDate,
      date: date.getDate(),
      label: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      dayStatus: 'draft',
      constraintBlocked: false,
      leadShift: null,
      staffShifts: [],
    } satisfies DayItem
  })
}

function buildPreFlightTherapists(
  rawTherapists: ManagerTherapistRow[],
  workPatterns: WorkPatternRow[]
): Therapist[] {
  const patternByTherapist = new Map(
    workPatterns.map((row) => [
      row.therapist_id,
      normalizeWorkPattern({
        therapist_id: row.therapist_id,
        works_dow: row.works_dow ?? [],
        offs_dow: row.offs_dow ?? [],
        weekend_rotation: row.weekend_rotation ?? 'none',
        weekend_anchor_date: row.weekend_anchor_date,
        works_dow_mode: row.works_dow_mode ?? 'hard',
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
      shift_preference: pattern.shift_preference,
      on_fmla: therapist.on_fmla ?? false,
      fmla_return_date: therapist.fmla_return_date,
      is_active: therapist.is_active !== false,
    } satisfies Therapist
  })
}

async function getCoverageNamesByUserId(cycleId: string): Promise<Record<string, string>> {
  const admin = createAdminClient()
  const { data: shifts, error: shiftError } = await admin
    .from('shifts')
    .select('user_id')
    .eq('cycle_id', cycleId)
    .not('user_id', 'is', null)

  if (shiftError) {
    console.error('Failed to load coverage names from shifts:', shiftError)
    return {}
  }

  const userIds = [
    ...new Set(
      ((shifts ?? []) as Array<{ user_id: string | null }>)
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  if (userIds.length === 0) {
    return {}
  }

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)

  if (profileError) {
    console.error('Failed to load coverage names from profiles:', profileError)
    return {}
  }

  return Object.fromEntries(
    ((profiles ?? []) as ProfileNameRow[])
      .filter((row) => row.id && row.full_name)
      .map((row) => [row.id, row.full_name as string])
  )
}

function createEmptySnapshot(): CoveragePageSnapshot {
  return {
    actorScheduleShift: { resolved: true, type: null },
    activeCycleId: null,
    activeCyclePublished: false,
    activePreliminarySnapshot: null,
    availableCycles: [],
    printCycle: null,
    printCycleDates: [],
    printDayTeam: [],
    printNightTeam: [],
    printUsers: [],
    printShiftByUserDate: {},
    allTherapists: [],
    allTherapistsByShift: { day: [], night: [] },
    rosterProfiles: [],
    rosterProfilesByShift: { day: [], night: [] },
    activeOpCodes: {},
    dayDays: [],
    nightDays: [],
    proactiveCoverageRisk: null,
    selectedCycleHasShiftRows: false,
    canManageCoverage: false,
    canUpdateAssignmentStatus: false,
    actorRole: null,
    error: '',
  }
}

export async function getCoveragePageServerData({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}): Promise<CoveragePageServerData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const shiftRaw = firstSearchParam(searchParams.shift)
  const viewRaw = firstSearchParam(searchParams.view)
  const cycleIdFromUrl = firstSearchParam(searchParams.cycle) ?? null
  const urlShiftTab = parseCoverageShiftSearchParam(shiftRaw ?? null)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, archived_at, shift_type, default_schedule_view')
    .eq('id', user.id)
    .maybeSingle()

  const actorRole = parseRole(profile?.role)
  const permContext = {
    isActive: profile?.is_active !== false,
    archivedAt: profile?.archived_at ?? null,
  }
  const actorScheduleShift = normalizeActorShiftType(profile?.shift_type)
  const initialViewMode = viewRaw
    ? normalizeViewMode(viewRaw)
    : normalizeDefaultScheduleView(
        (profile as { default_schedule_view?: string | null } | null)?.default_schedule_view ??
          undefined
      )
  const initialShiftTab = urlShiftTab ?? defaultCoverageShiftTabFromProfileShift(actorScheduleShift)
  const shiftTabLockedFromUrl = urlShiftTab != null
  const initialShiftType = initialShiftTab === 'Night' ? 'night' : 'day'

  const snapshot = createEmptySnapshot()
  snapshot.actorScheduleShift = { resolved: true, type: actorScheduleShift }
  snapshot.actorRole = actorRole
  snapshot.canManageCoverage = can(actorRole, 'manage_coverage', permContext)
  snapshot.canUpdateAssignmentStatus = can(actorRole, 'update_assignment_status', permContext)

  const todayKey = toIsoDate(new Date())
  const { data: cycles, error: cyclesError } = await fetchScheduleCyclesForCoverage(supabase)

  if (cyclesError) {
    console.error(
      `Could not load cycles for coverage: ${cyclesError.message}${
        cyclesError.code ? ` (code ${cyclesError.code})` : ''
      }`
    )
    snapshot.error = 'Could not load schedule blocks.'
    return {
      initialShiftTab,
      shiftTabLockedFromUrl,
      initialViewMode: initialViewMode as 'week' | 'calendar' | 'roster',
      initialSnapshot: snapshot,
    }
  }

  const availableCycles = cycles ?? []
  snapshot.availableCycles = availableCycles

  const selectedCycle = resolveCoverageCycle({
    cycles: availableCycles,
    cycleIdFromUrl,
    role: actorRole,
    todayKey,
  })

  snapshot.activeCycleId = selectedCycle?.id ?? null
  snapshot.activeCyclePublished = Boolean(selectedCycle?.published)
  snapshot.printCycle = selectedCycle
    ? {
        label: selectedCycle.label,
        start_date: selectedCycle.start_date,
        end_date: selectedCycle.end_date,
      }
    : null
  snapshot.printCycleDates = selectedCycle
    ? dateRange(selectedCycle.start_date, selectedCycle.end_date)
    : []

  if (!selectedCycle) {
    return {
      initialShiftTab,
      shiftTabLockedFromUrl,
      initialViewMode: initialViewMode as 'week' | 'calendar' | 'roster',
      initialSnapshot: snapshot,
    }
  }

  const therapistOptionsQuery = snapshot.canManageCoverage
    ? supabase
        .from('profiles')
        .select(
          'id, full_name, role, shift_type, is_lead_eligible, employment_type, max_work_days_per_week, on_fmla, fmla_return_date, is_active'
        )
        .eq('is_active', true)
        .eq('on_fmla', false)
        .in('role', ['therapist', 'lead'])
        .order('full_name', { ascending: true })
    : Promise.resolve({ data: [], error: null })

  const [preliminaryResult, shiftsResult, therapistOptionsResult, rosterProfilesResult] =
    await Promise.all([
      supabase
        .from('preliminary_snapshots')
        .select('id, sent_at')
        .eq('cycle_id', selectedCycle.id)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('shifts')
        .select(
          'id,user_id,date,shift_type,status,assignment_status,unfilled_reason,role,profiles:profiles!shifts_user_id_fkey(full_name,role,employment_type)'
        )
        .gte('date', selectedCycle.start_date)
        .lte('date', selectedCycle.end_date)
        .order('date', { ascending: true })
        .eq('cycle_id', selectedCycle.id),
      therapistOptionsQuery,
      supabase
        .from('profiles')
        .select('id, full_name, role, shift_type, employment_type')
        .eq('is_active', true)
        .in('role', ['therapist', 'lead'])
        .order('full_name', { ascending: true }),
    ])

  if (preliminaryResult.error) {
    console.error('Could not load preliminary schedule state:', preliminaryResult.error)
  }
  if (shiftsResult.error) {
    console.error('Could not load coverage schedule:', shiftsResult.error)
    snapshot.error = shiftsResult.error.message || 'Could not load coverage schedule.'
    return {
      initialShiftTab,
      shiftTabLockedFromUrl,
      initialViewMode: initialViewMode as 'week' | 'calendar' | 'roster',
      initialSnapshot: snapshot,
    }
  }
  if (therapistOptionsResult.error) {
    console.error('Could not load available therapists for assignment:', therapistOptionsResult.error)
  }
  if (rosterProfilesResult.error) {
    console.error('Could not load roster profiles for schedule view:', rosterProfilesResult.error)
  }

  snapshot.activePreliminarySnapshot =
    (preliminaryResult.data ?? null) as PreliminarySnapshotRow | null
  const managerTherapistRows = ((therapistOptionsResult.data ?? []) as ManagerTherapistRow[]) ?? []
  const allTherapists = managerTherapistRows.map<TherapistOption>((row) => ({
    id: row.id,
    full_name: row.full_name,
    role: row.role,
    shift_type: row.shift_type,
    isLeadEligible: row.is_lead_eligible ?? false,
    employment_type: row.employment_type ?? null,
    max_work_days_per_week: row.max_work_days_per_week ?? null,
  }))
  snapshot.allTherapistsByShift = {
    day: allTherapists.filter((row) => row.shift_type === 'day'),
    night: allTherapists.filter((row) => row.shift_type === 'night'),
  }
  snapshot.allTherapists = snapshot.allTherapistsByShift[initialShiftType]

  const rosterProfileRows = ((rosterProfilesResult.data ?? []) as Array<{
    id: string
    full_name: string
    role: 'therapist' | 'lead'
    shift_type: 'day' | 'night'
    employment_type: 'full_time' | 'part_time' | 'prn' | null
  }>) ?? []
  snapshot.rosterProfilesByShift = {
    day: rosterProfileRows
      .filter((row) => row.shift_type === 'day')
      .map<RosterMemberRow>((row) => ({
        id: row.id,
        full_name: row.full_name,
        role: row.role,
        employment_type: row.employment_type ?? 'full_time',
      })),
    night: rosterProfileRows
      .filter((row) => row.shift_type === 'night')
      .map<RosterMemberRow>((row) => ({
        id: row.id,
        full_name: row.full_name,
        role: row.role,
        employment_type: row.employment_type ?? 'full_time',
      })),
  }
  snapshot.rosterProfiles = snapshot.rosterProfilesByShift[initialShiftType]

  const rows = (shiftsResult.data ?? []) as ShiftRow[]
  snapshot.selectedCycleHasShiftRows = rows.length > 0

  if (snapshot.canManageCoverage && !selectedCycle.published) {
    const firstWeekBounds = getWeekBoundsForDate(selectedCycle.start_date)
    const lastWeekBounds = getWeekBoundsForDate(selectedCycle.end_date)

    if (!firstWeekBounds || !lastWeekBounds) {
      console.error('Could not resolve coverage week bounds for proactive risk alert.')
    } else {
      const therapistIds = managerTherapistRows.map((therapist) => therapist.id)
      const [workPatternsResult, cycleOverridesResult, weeklyShiftsResult] = await Promise.all([
        therapistIds.length > 0
          ? supabase
              .from('work_patterns')
              .select(
                'therapist_id, works_dow, offs_dow, weekend_rotation, weekend_anchor_date, works_dow_mode, shift_preference'
              )
              .in('therapist_id', therapistIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('availability_overrides')
          .select('therapist_id, cycle_id, date, shift_type, override_type, note, source')
          .eq('cycle_id', selectedCycle.id)
          .gte('date', selectedCycle.start_date)
          .lte('date', selectedCycle.end_date),
        therapistIds.length > 0
          ? supabase
              .from('shifts')
              .select('user_id, date, status')
              .in('user_id', therapistIds)
              .gte('date', firstWeekBounds.weekStart)
              .lte('date', lastWeekBounds.weekEnd)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (workPatternsResult.error || cycleOverridesResult.error || weeklyShiftsResult.error) {
        console.error('Could not compute proactive coverage risk alert:', {
          workPatternsError: workPatternsResult.error,
          cycleOverridesError: cycleOverridesResult.error,
          weeklyShiftsError: weeklyShiftsResult.error,
        })
      } else {
        const preFlightResult = generateDraftForCycle({
          cycleId: selectedCycle.id,
          cycleStartDate: selectedCycle.start_date,
          cycleEndDate: selectedCycle.end_date,
          therapists: buildPreFlightTherapists(
            managerTherapistRows,
            (workPatternsResult.data ?? []) as WorkPatternRow[]
          ),
          existingShifts: rows
            .filter(
              (row): row is ShiftRow & { user_id: string } => Boolean(row.user_id) && !row.unfilled_reason
            )
            .map<AutoScheduleShiftRow>((row) => ({
              user_id: row.user_id,
              date: row.date,
              shift_type: row.shift_type,
              status: row.status,
              role: row.role,
            })),
          allAvailabilityOverrides: (cycleOverridesResult.data ?? []) as AvailabilityOverrideRow[],
          weeklyShifts: (weeklyShiftsResult.data ?? []) as ShiftLimitRow[],
        })
        snapshot.proactiveCoverageRisk = buildCoverageRiskAlert(preFlightResult)
      }
    }
  }

  if (rows.length === 0) {
    snapshot.dayDays = buildEmptyCoverageDays(selectedCycle.start_date, selectedCycle.end_date)
    snapshot.nightDays = buildEmptyCoverageDays(selectedCycle.start_date, selectedCycle.end_date)
    return {
      initialShiftTab,
      shiftTabLockedFromUrl,
      initialViewMode: initialViewMode as 'week' | 'calendar' | 'roster',
      initialSnapshot: snapshot,
    }
  }

  let namesByUserId: Record<string, string> = {}
  if (rows.some((row) => row.user_id && !getOne(row.profiles)?.full_name)) {
    namesByUserId = await getCoverageNamesByUserId(selectedCycle.id)
  }

  const assignmentRows: AssignedShiftRow[] = []
  const constraintBlockedSlotKeys = new Set<string>()
  const assignedSlotKeys = new Set<string>()
  for (const row of rows) {
    if (!row.user_id) {
      if (row.unfilled_reason === NO_ELIGIBLE_CONSTRAINT_REASON) {
        constraintBlockedSlotKeys.add(`${row.date}:${row.shift_type}`)
      }
      continue
    }
    assignedSlotKeys.add(`${row.date}:${row.shift_type}`)
    assignmentRows.push({ ...row, user_id: row.user_id })
  }

  for (const key of assignedSlotKeys) {
    constraintBlockedSlotKeys.delete(key)
  }

  const activeOperationalCodesByShiftId = await fetchActiveOperationalCodeMap(
    supabase,
    assignmentRows.map((row) => row.id)
  )
  snapshot.activeOpCodes = Object.fromEntries(activeOperationalCodesByShiftId.entries())

  const therapistTallies = new Map<
    string,
    {
      id: string
      full_name: string
      day: number
      night: number
      role?: 'therapist' | 'lead'
      employment_type?: 'full_time' | 'part_time' | 'prn'
    }
  >()
  const printShiftByUserDate: Record<string, ShiftStatus> = {}

  for (const row of assignmentRows) {
    const profileRow = getOne(row.profiles)
    const fullName = profileRow?.full_name ?? namesByUserId[row.user_id] ?? 'Unknown'
    const current = therapistTallies.get(row.user_id) ?? {
      id: row.user_id,
      full_name: fullName,
      day: 0,
      night: 0,
      role: profileRow?.role === 'lead' ? 'lead' : 'therapist',
      employment_type:
        profileRow?.employment_type === 'part_time' || profileRow?.employment_type === 'prn'
          ? profileRow.employment_type
          : 'full_time',
    }
    if (row.shift_type === 'night') current.night += 1
    else current.day += 1
    if (profileRow?.employment_type === 'part_time' || profileRow?.employment_type === 'prn') {
      current.employment_type = profileRow.employment_type
    }
    if (profileRow?.role === 'lead') {
      current.role = 'lead'
    }
    therapistTallies.set(row.user_id, current)
    printShiftByUserDate[`${row.user_id}:${row.date}`] = toLegacyShiftStatusFromOperationalCode(
      activeOperationalCodesByShiftId.get(row.id) ?? null,
      row.status
    )
  }

  const printUsers = Array.from(therapistTallies.values())
    .map<PrintTherapist>((row) => ({
      id: row.id,
      full_name: row.full_name,
      role: row.role,
      shift_type: row.night > row.day ? 'night' : 'day',
      employment_type: row.employment_type ?? 'full_time',
    }))
    .sort((a, b) => {
      if (a.shift_type === b.shift_type) return a.full_name.localeCompare(b.full_name)
      return a.shift_type === 'day' ? -1 : 1
    })

  snapshot.printUsers = printUsers
  snapshot.printDayTeam = printUsers.filter((user) => user.shift_type === 'day')
  snapshot.printNightTeam = printUsers.filter((user) => user.shift_type === 'night')
  snapshot.printShiftByUserDate = printShiftByUserDate

  const resolvedRows: BuildDayRowInput[] = assignmentRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    date: row.date,
    shift_type: row.shift_type,
    role: row.role,
    status: row.status,
    assignment_status: activeOperationalCodesByShiftId.get(row.id) ?? row.assignment_status ?? null,
    name: getOne(row.profiles)?.full_name ?? namesByUserId[row.user_id] ?? 'Unknown',
  }))

  snapshot.dayDays = buildDayItems(
    'day',
    resolvedRows,
    selectedCycle.start_date,
    selectedCycle.end_date,
    constraintBlockedSlotKeys
  )
  snapshot.nightDays = buildDayItems(
    'night',
    resolvedRows,
    selectedCycle.start_date,
    selectedCycle.end_date,
    constraintBlockedSlotKeys
  )

  return {
    initialShiftTab,
    shiftTabLockedFromUrl,
    initialViewMode: initialViewMode as 'week' | 'calendar' | 'roster',
    initialSnapshot: snapshot,
  }
}
