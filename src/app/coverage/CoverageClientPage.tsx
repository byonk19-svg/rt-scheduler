'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Printer, Send, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

import { AutoDraftConfirmDialog } from '@/components/coverage/AutoDraftConfirmDialog'
import { ClearDraftConfirmDialog } from '@/components/coverage/ClearDraftConfirmDialog'
import { CycleManagementDialog } from '@/components/coverage/CycleManagementDialog'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { MoreActionsMenu } from '@/components/more-actions-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  createCycleAction,
  deleteCycleAction,
  generateDraftScheduleAction,
  resetDraftScheduleAction,
  sendPreliminaryScheduleAction,
  toggleCyclePublishedAction,
} from '@/app/schedule/actions'
import { CalendarGrid } from '@/components/coverage/CalendarGrid'
import { ShiftEditorDialog } from '@/components/coverage/ShiftEditorDialog'
import { PrintSchedule } from '@/components/print-schedule'
import { updateCoverageAssignmentStatus } from '@/lib/coverage/updateAssignmentStatus'
import {
  assignCoverageShiftViaApi,
  persistCoverageShiftStatus,
  unassignCoverageShiftViaApi,
} from '@/lib/coverage/mutations'
import {
  buildDayItems,
  toUiStatus,
  type BuildDayRowInput,
  type DayItem,
  type ShiftItem,
  type ShiftTab,
  type UiStatus,
} from '@/lib/coverage/selectors'
import { resolveCoverageCycle } from '@/lib/coverage/active-cycle'
import {
  fetchScheduleCyclesForCoverage,
  type CoverageScheduleCycleRow,
} from '@/lib/coverage/fetch-schedule-cycles'
import { getCoverageStatusLabel } from '@/lib/coverage/status-ui'
import { can } from '@/lib/auth/can'
import { parseRole, type Role } from '@/lib/auth/roles'
import { dateRange, formatHumanCycleRange, toIsoDate } from '@/lib/calendar-utils'
import { getOne, getScheduleFeedback, getWeekBoundsForDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'
import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/lib/shift-types'
import type { ScheduleSearchParams } from '@/app/schedule/types'
import {
  fetchActiveOperationalCodeMap,
  toLegacyShiftStatusFromOperationalCode,
} from '@/lib/operational-codes'
import {
  COVERAGE_SHIFT_QUERY_KEY,
  defaultCoverageShiftTabFromProfileShift,
  normalizeActorShiftType,
  parseCoverageShiftSearchParam,
  shiftTabToQueryValue,
} from '@/lib/coverage/coverage-shift-tab'

type DayStatus = DayItem['dayStatus']

type CycleRow = CoverageScheduleCycleRow
type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  isLeadEligible: boolean
  employment_type: string | null
  max_work_days_per_week: number | null
}
type PrintTherapist = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type?: 'full_time' | 'part_time' | 'prn'
}
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
    | { full_name: string; employment_type: 'full_time' | 'part_time' | 'prn' | null }
    | { full_name: string; employment_type: 'full_time' | 'part_time' | 'prn' | null }[]
    | null
}
type AssignedShiftRow = Omit<ShiftRow, 'user_id'> & { user_id: string }
type PreliminarySnapshotRow = {
  id: string
  sent_at: string
}

const NO_ELIGIBLE_CONSTRAINT_REASON = 'no_eligible_candidates_due_to_constraints'

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4 },
  }),
}

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function buildEmptyCoverageDays(
  cycleStartDate: string,
  cycleEndDate: string
): DayItem[] {
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

async function fetchCoverageNamesByUserId(cycleId: string): Promise<Record<string, string>> {
  const response = await fetch(`/api/schedule/coverage-names?cycle_id=${encodeURIComponent(cycleId)}`, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`coverage names request failed with ${response.status}`)
  }

  const payload = (await response.json()) as { namesById?: Record<string, string> }
  return payload.namesById ?? {}
}

export function CoverageClientPage({
  initialShiftTab,
  shiftTabLockedFromUrl,
}: {
  initialShiftTab: ShiftTab
  shiftTabLockedFromUrl: boolean
}) {
  const search = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const cycleFromUrl = search.get('cycle')
  const successParam = search.get('success')
  const errorParam = search.get('error')
  const autoParam = search.get('auto')
  const draftParam = search.get('draft')
  const overrideWeeklyRulesParam = search.get('override_weekly_rules')
  const overrideShiftRulesParam = search.get('override_shift_rules')
  const supabase = useMemo(() => createClient(), [])
  const urlShiftTab = useMemo(
    () => parseCoverageShiftSearchParam(search.get(COVERAGE_SHIFT_QUERY_KEY)),
    [search]
  )
  const [shiftTab, setShiftTab] = useState<ShiftTab>(() => initialShiftTab)
  const [actorScheduleShift, setActorScheduleShift] = useState<{
    resolved: boolean
    type: 'day' | 'night' | null
  }>({ resolved: false, type: null })
  const profileDefaultAppliedRef = useRef(shiftTabLockedFromUrl)
  const [dayDays, setDayDays] = useState<DayItem[]>([])
  const [nightDays, setNightDays] = useState<DayItem[]>([])
  const [activeCycleId, setActiveCycleId] = useState<string | null>(cycleFromUrl)
  const [activeCyclePublished, setActiveCyclePublished] = useState(false)
  const [activePreliminarySnapshot, setActivePreliminarySnapshot] =
    useState<PreliminarySnapshotRow | null>(null)
  const [availableCycles, setAvailableCycles] = useState<CycleRow[]>([])
  const [printCycle, setPrintCycle] = useState<{ label: string; start_date: string; end_date: string } | null>(null)
  const [printCycleDates, setPrintCycleDates] = useState<string[]>([])
  const [printDayTeam, setPrintDayTeam] = useState<PrintTherapist[]>([])
  const [printNightTeam, setPrintNightTeam] = useState<PrintTherapist[]>([])
  const [printUsers, setPrintUsers] = useState<PrintTherapist[]>([])
  const [printShiftByUserDate, setPrintShiftByUserDate] = useState<Record<string, ShiftStatus>>({})
  const [allTherapists, setAllTherapists] = useState<TherapistOption[]>([])
  const [activeOpCodes, setActiveOpCodes] = useState<Map<string, string>>(new Map())
  const [assigning, setAssigning] = useState(false)
  const [unassigningShiftId, setUnassigningShiftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedCycleHasShiftRows, setSelectedCycleHasShiftRows] = useState(false)
  const [autoDraftDialogOpen, setAutoDraftDialogOpen] = useState(false)
  const [clearDraftDialogOpen, setClearDraftDialogOpen] = useState(false)
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false)
  const [error, setError] = useState<string>('')
  const [assignError, setAssignError] = useState<string>('')
  const [canManageCoverage, setCanManageCoverage] = useState(false)
  const [canUpdateAssignmentStatus, setCanUpdateAssignmentStatus] = useState(false)
  const [actorRole, setActorRole] = useState<Role | null>(null)
  const autoDraftFormRef = useRef<HTMLFormElement>(null)
  const clearDraftFormRef = useRef<HTMLFormElement>(null)
  const days = shiftTab === 'Day' ? dayDays : nightDays
  const setDays = shiftTab === 'Day' ? setDayDays : setNightDays
  const scheduleFeedbackParams = useMemo<ScheduleSearchParams>(
    () => ({
      success: successParam ?? undefined,
      error: errorParam ?? undefined,
      auto: autoParam ?? undefined,
      draft: draftParam ?? undefined,
      added: search.get('added') ?? undefined,
      unfilled: search.get('unfilled') ?? undefined,
      constraints_unfilled: search.get('constraints_unfilled') ?? undefined,
      dropped: search.get('dropped') ?? undefined,
      removed: search.get('removed') ?? undefined,
      week_start: search.get('week_start') ?? undefined,
      week_end: search.get('week_end') ?? undefined,
      violations: search.get('violations') ?? undefined,
      under: search.get('under') ?? undefined,
      over: search.get('over') ?? undefined,
      under_coverage: search.get('under_coverage') ?? undefined,
      over_coverage: search.get('over_coverage') ?? undefined,
      lead_missing: search.get('lead_missing') ?? undefined,
      lead_multiple: search.get('lead_multiple') ?? undefined,
      lead_ineligible: search.get('lead_ineligible') ?? undefined,
    }),
    [autoParam, draftParam, errorParam, search, successParam]
  )
  const publishErrorMessage = useMemo(() => {
    if (!errorParam) return null
    const feedback = getScheduleFeedback(scheduleFeedbackParams)
    if (feedback?.variant === 'error') return feedback.message
    return `Publish blocked: ${errorParam.replaceAll('_', ' ')}.`
  }, [errorParam, scheduleFeedbackParams])
  const autoDraftFeedback = useMemo(() => {
    if (!autoParam && !draftParam) return null
    return getScheduleFeedback(scheduleFeedbackParams)
  }, [autoParam, draftParam, scheduleFeedbackParams])
  const publishOverrideConfig = useMemo(() => {
    if (errorParam === 'publish_weekly_rule_violation') {
      return {
        weekly: 'true',
        shift: overrideShiftRulesParam === 'true' ? 'true' : 'false',
        label: 'Publish with weekly override',
        description: 'Bypass weekly workload validation for this publish only.',
      }
    }

    if (errorParam === 'publish_shift_rule_violation') {
      return {
        weekly: overrideWeeklyRulesParam === 'true' ? 'true' : 'false',
        shift: 'true',
        label: 'Publish with shift override',
        description: 'Bypass shift coverage and lead validation for this publish only.',
      }
    }

    return null
  }, [errorParam, overrideShiftRulesParam, overrideWeeklyRulesParam])
  const issueCount = useMemo(
    () => days.filter((d) => d.dayStatus === 'missing_lead').length,
    [days]
  )

  useEffect(() => {
    if (urlShiftTab != null) {
      setShiftTab(urlShiftTab)
      profileDefaultAppliedRef.current = true
    }
  }, [urlShiftTab])

  useEffect(() => {
    if (urlShiftTab != null) return
    if (!actorScheduleShift.resolved) return
    if (profileDefaultAppliedRef.current) return
    setShiftTab(defaultCoverageShiftTabFromProfileShift(actorScheduleShift.type))
    profileDefaultAppliedRef.current = true
  }, [urlShiftTab, actorScheduleShift])

  const weekRosterHref = useMemo(() => {
    const params = new URLSearchParams()
    if (activeCycleId) params.set('cycle', activeCycleId)
    params.set('view', 'week')
    params.set(COVERAGE_SHIFT_QUERY_KEY, shiftTabToQueryValue(shiftTab))
    return `/coverage?${params.toString()}`
  }, [activeCycleId, shiftTab])
  const preliminaryLive = Boolean(activePreliminarySnapshot)
  const preliminarySentLabel = useMemo(() => {
    if (!activePreliminarySnapshot) return null
    return new Date(activePreliminarySnapshot.sent_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [activePreliminarySnapshot])
  const scheduleSubtitle = useMemo(() => {
    const editHint = canManageCoverage
      ? 'View staffing and assignment status — click a day to edit.'
      : canUpdateAssignmentStatus
        ? 'View staffing and assignment status — click a therapist name to update status.'
        : 'View staffing and assignment status.'
    if (!printCycle) {
      return canManageCoverage
        ? 'No open 6-week block — create a new draft block to start staffing.'
        : 'No published schedule is available right now.'
    }
    const range = formatHumanCycleRange(printCycle.start_date, printCycle.end_date)
    const statusChip = activeCyclePublished ? (
      <span className="font-medium text-[var(--success-text)]"> · Live</span>
    ) : (
      <span className="font-medium text-muted-foreground"> · Draft</span>
    )
    if (!selectedCycleHasShiftRows) {
      return (
        <>
          <span className="block text-sm font-medium text-foreground/90">
            {range}
            {statusChip}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {canManageCoverage ? 'No staffing drafted yet.' : 'No staffing published yet.'}
          </span>
        </>
      )
    }
    return (
      <>
        <span className="block text-sm font-medium text-foreground/90">
          {range}
          {statusChip}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{editHint}</span>
      </>
    )
  }, [
    printCycle,
    canManageCoverage,
    canUpdateAssignmentStatus,
    selectedCycleHasShiftRows,
    activeCyclePublished,
  ])

  const showFullPrintRoster = canManageCoverage || actorRole === 'lead'
  const clearLoadedScheduleState = useCallback(() => {
    setDayDays([])
    setNightDays([])
    setPrintUsers([])
    setPrintDayTeam([])
    setPrintNightTeam([])
    setPrintShiftByUserDate({})
    setActiveOpCodes(new Map())
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')

      try {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) {
          if (active) {
            setActorScheduleShift({ resolved: true, type: null })
          }
          return
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('role, is_active, archived_at, shift_type')
          .eq('id', uid)
          .maybeSingle()

        if (!active) return

        if (active) {
          setActorScheduleShift({
            resolved: true,
            type: normalizeActorShiftType(prof?.shift_type),
          })
        }

        const role = parseRole(prof?.role)
        const permContext = {
          isActive: prof?.is_active !== false,
          archivedAt: prof?.archived_at ?? null,
        }
        setActorRole(role)
        setCanManageCoverage(can(role, 'manage_coverage', permContext))
        setCanUpdateAssignmentStatus(can(role, 'update_assignment_status', permContext))

        const today = new Date()
        let cycleId: string | null = null
        let selectedCycle: CycleRow | null = null
        let cycles: CycleRow[] = []

        const { data: cyclesData, error: cyclesError } =
          await fetchScheduleCyclesForCoverage(supabase)

        if (!active) return
        if (cyclesError) {
          console.error(
            `Could not load cycles for coverage: ${cyclesError.message}${
              cyclesError.code ? ` (code ${cyclesError.code})` : ''
            }`
          )
          setError('Could not load schedule blocks.')
        } else {
          cycles = cyclesData ?? []
          const todayKey = toIsoDate(today)
          const cycle = resolveCoverageCycle({
            cycles,
            cycleIdFromUrl: cycleFromUrl,
            role,
            todayKey,
          })
          if (cycle) {
            selectedCycle = cycle
            cycleId = cycle.id
          }
        }
        if (active) {
          setAvailableCycles(cycles)
          setActiveCycleId(cycleId)
          setActiveCyclePublished(Boolean(selectedCycle?.published))
          setSelectedCycleHasShiftRows(false)
          setActivePreliminarySnapshot(null)
          setPrintCycle(
            selectedCycle
              ? {
                  label: selectedCycle.label,
                  start_date: selectedCycle.start_date,
                  end_date: selectedCycle.end_date,
                }
              : null
          )
          setPrintCycleDates(
            selectedCycle ? dateRange(selectedCycle.start_date, selectedCycle.end_date) : []
          )
        }

        if (!cycleId || !selectedCycle) {
          clearLoadedScheduleState()
          return
        }

        const { data: preliminaryData, error: preliminaryError } = await supabase
          .from('preliminary_snapshots')
          .select('id, sent_at')
          .eq('cycle_id', cycleId)
          .eq('status', 'active')
          .maybeSingle()

        if (!active) return
        if (preliminaryError) {
          console.error('Could not load preliminary schedule state:', preliminaryError)
          setActivePreliminarySnapshot(null)
        } else {
          setActivePreliminarySnapshot((preliminaryData ?? null) as PreliminarySnapshotRow | null)
        }

        const shiftsQuery = supabase
          .from('shifts')
          .select(
            'id,user_id,date,shift_type,status,assignment_status,unfilled_reason,role,profiles:profiles!shifts_user_id_fkey(full_name,employment_type)'
          )
          .gte('date', selectedCycle.start_date)
          .lte('date', selectedCycle.end_date)
          .order('date', { ascending: true })
          .eq('cycle_id', cycleId)

        const { data: shiftsData, error: shiftsError } = await shiftsQuery

        if (!active) return
        if (shiftsError) {
          setError(shiftsError.message || 'Could not load shifts.')
          clearLoadedScheduleState()
          return
        }

        const rows = (shiftsData ?? []) as ShiftRow[]
        setSelectedCycleHasShiftRows(rows.length > 0)
        if (rows.length === 0) {
          clearLoadedScheduleState()
          setDayDays(buildEmptyCoverageDays(selectedCycle.start_date, selectedCycle.end_date))
          setNightDays(buildEmptyCoverageDays(selectedCycle.start_date, selectedCycle.end_date))
          return
        }
        let namesByUserId: Record<string, string> = {}
        if (rows.some((row) => row.user_id && !getOne(row.profiles)?.full_name)) {
          try {
            namesByUserId = await fetchCoverageNamesByUserId(cycleId)
          } catch (nameError) {
            console.error('Could not load coverage display names:', nameError)
          }
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
        setActiveOpCodes(new Map(activeOperationalCodesByShiftId))

        const therapistTallies = new Map<
          string,
          {
            id: string
            full_name: string
            day: number
            night: number
            employment_type?: 'full_time' | 'part_time' | 'prn'
          }
        >()
        const nextShiftByUserDate: Record<string, ShiftStatus> = {}

        for (const row of assignmentRows) {
          const profile = getOne(row.profiles)
          const fullName = profile?.full_name ?? namesByUserId[row.user_id] ?? 'Unknown'
          const current = therapistTallies.get(row.user_id) ?? {
            id: row.user_id,
            full_name: fullName,
            day: 0,
            night: 0,
            employment_type:
              profile?.employment_type === 'part_time' || profile?.employment_type === 'prn'
                ? profile.employment_type
                : 'full_time',
          }
          if (row.shift_type === 'night') current.night += 1
          else current.day += 1
          if (profile?.employment_type === 'part_time' || profile?.employment_type === 'prn') {
            current.employment_type = profile.employment_type
          }
          therapistTallies.set(row.user_id, current)
          nextShiftByUserDate[`${row.user_id}:${row.date}`] = toLegacyShiftStatusFromOperationalCode(
            activeOperationalCodesByShiftId.get(row.id) ?? null,
            row.status
          )
        }

        const nextPrintUsers: PrintTherapist[] = Array.from(therapistTallies.values())
          .map<PrintTherapist>((row) => ({
            id: row.id,
            full_name: row.full_name,
            shift_type: row.night > row.day ? 'night' : 'day',
            employment_type: row.employment_type ?? 'full_time',
          }))
          .sort((a, b) => {
            if (a.shift_type === b.shift_type) return a.full_name.localeCompare(b.full_name)
            return a.shift_type === 'day' ? -1 : 1
          })

        if (active) {
          setPrintUsers(nextPrintUsers)
          setPrintDayTeam(nextPrintUsers.filter((user) => user.shift_type === 'day'))
          setPrintNightTeam(nextPrintUsers.filter((user) => user.shift_type === 'night'))
          setPrintShiftByUserDate(nextShiftByUserDate)
        }

        const resolvedRows: BuildDayRowInput[] = assignmentRows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          date: row.date,
          shift_type: row.shift_type,
          role: row.role,
          status: row.status,
          assignment_status:
            activeOperationalCodesByShiftId.get(row.id) ?? row.assignment_status ?? null,
          name: getOne(row.profiles)?.full_name ?? namesByUserId[row.user_id] ?? 'Unknown',
        }))

        setDayDays(
          buildDayItems(
            'day',
            resolvedRows,
            selectedCycle.start_date,
            selectedCycle.end_date,
            constraintBlockedSlotKeys
          )
        )
        setNightDays(
          buildDayItems(
            'night',
            resolvedRows,
            selectedCycle.start_date,
            selectedCycle.end_date,
            constraintBlockedSlotKeys
          )
        )
      } catch (loadError) {
        console.error('Could not load coverage calendar data:', loadError)
        setError('Could not load coverage schedule.')
        clearLoadedScheduleState()
      } finally {
        if (active) {
          setLoading(false)
          setActorScheduleShift((prev) =>
            prev.resolved ? prev : { resolved: true, type: null }
          )
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [cycleFromUrl, supabase, clearLoadedScheduleState])

  // Fetch full therapist list once per shift type — not per day click (managers only).
  useEffect(() => {
    let active = true
    if (!canManageCoverage) {
      setAllTherapists([])
      return
    }
    const shiftType = shiftTab === 'Day' ? 'day' : 'night'

    void (async () => {
      const { data, error: loadError } = await supabase
        .from('profiles')
        .select('id, full_name, shift_type, is_lead_eligible, employment_type, max_work_days_per_week')
        .eq('shift_type', shiftType)
        .eq('is_active', true)
        .eq('on_fmla', false)
        .in('role', ['therapist', 'lead'])
        .order('full_name', { ascending: true })

      if (!active) return
      if (loadError) {
        console.error('Could not load available therapists for assignment:', loadError)
        setAllTherapists([])
        return
      }
      setAllTherapists(
        (
          (data ?? []) as Array<{
            id: string
            full_name: string
            shift_type: 'day' | 'night'
            is_lead_eligible: boolean | null
            employment_type: string | null
            max_work_days_per_week: number | null
          }>
        ).map((row) => ({
          id: row.id,
          full_name: row.full_name,
          shift_type: row.shift_type,
          isLeadEligible: row.is_lead_eligible ?? false,
          employment_type: row.employment_type ?? null,
          max_work_days_per_week: row.max_work_days_per_week ?? null,
        }))
      )
    })()

    return () => {
      active = false
    }
  }, [shiftTab, supabase, canManageCoverage])

  const selectedDayBase = useMemo(
    () => days.find((row) => row.id === selectedId) ?? null,
    [days, selectedId]
  )
  const selectedDay = useMemo(
    () => (selectedDayBase ? { ...selectedDayBase, shiftType: shiftTab } : null),
    [selectedDayBase, shiftTab]
  )
  const noCycleSelected = !loading && !activeCycleId
  const showEmptyDraftState = !loading && Boolean(activeCycleId) && !selectedCycleHasShiftRows
  const today = toIsoDate(new Date())
  const isPastDate = selectedDay !== null && selectedDay.isoDate < today
  const selectedDayShiftIds = [
    ...(selectedDay?.leadShift ? [selectedDay.leadShift.id] : []),
    ...(selectedDay?.staffShifts.map((shift) => shift.id) ?? []),
  ]
  const hasOperationalEntries = selectedDayShiftIds.some((id) => activeOpCodes.has(id))
  const isPostPublishModification = isPastDate || hasOperationalEntries

  // Compute how many shifts each therapist is working in the week that contains the selected day.
  // Used in the assign dropdown so managers can avoid overscheduling within a single week.
  const weeklyTherapistCounts = useMemo((): Map<string, number> => {
    if (!selectedId) return new Map()
    const bounds = getWeekBoundsForDate(selectedId)
    if (!bounds) return new Map()
    const { weekStart, weekEnd } = bounds
    const counts = new Map<string, number>()
    for (const item of [...dayDays, ...nightDays]) {
      if (item.isoDate < weekStart || item.isoDate > weekEnd) continue
      const shifts = [...(item.leadShift ? [item.leadShift] : []), ...item.staffShifts]
      for (const shift of shifts) {
        counts.set(shift.userId, (counts.get(shift.userId) ?? 0) + 1)
      }
    }
    return counts
  }, [selectedId, dayDays, nightDays])


  const handleTabSwitch = (tab: ShiftTab) => {
    setShiftTab(tab)
    profileDefaultAppliedRef.current = true
    setSelectedId(null)
    setAssignError('')
    const params = new URLSearchParams(search.toString())
    params.set(COVERAGE_SHIFT_QUERY_KEY, shiftTabToQueryValue(tab))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleSelect = (id: string) => {
    window.requestAnimationFrame(() => {
      setSelectedId((prev) => (prev === id ? null : id))
    })
    setAssignError('')
  }
  const handleClose = () => {
    setSelectedId(null)
    setAssigning(false)
    setAssignError('')
  }

  const handleAssignTherapist = useCallback(
    async (userId: string, role: 'lead' | 'staff') => {
      if (!selectedDay || !userId || !activeCycleId) return

      setAssigning(true)
      setError('')

      const selectedTherapist = allTherapists.find((t) => t.id === userId) ?? null
      const shiftType = selectedDay.shiftType === 'Day' ? 'day' : 'night'

      const { data: inserted, error: insertError } = await assignCoverageShiftViaApi({
        cycleId: activeCycleId,
        userId,
        isoDate: selectedDay.isoDate,
        shiftType,
        role,
        isPostPublishModification,
      })

      if (insertError || !inserted) {
        console.error('Assign failed:', insertError)
        if (insertError?.code === '23505') {
          setAssignError(`${selectedTherapist?.full_name ?? 'This therapist'} is already assigned on this day.`)
        } else {
          setAssignError('Could not assign therapist. Please try again.')
        }
        setAssigning(false)
        return
      }

      setAssignError('')
      const insertedRow = inserted as {
        id: string
        user_id: string
        status: ShiftStatus
        assignment_status: AssignmentStatus | null
      }
      const name = selectedTherapist?.full_name ?? 'Unknown'
      const nextShift: ShiftItem = {
        id: insertedRow.id,
        userId: insertedRow.user_id,
        name,
        status: toUiStatus(insertedRow.assignment_status, insertedRow.status),
        log: [],
      }

      if (role === 'lead') {
        setDays((current) =>
          current.map((day) => {
            if (day.id !== selectedDay.id) return day
            return { ...day, leadShift: nextShift, dayStatus: 'published' as DayStatus }
          })
        )
      } else {
        setDays((current) =>
          current.map((day) => {
            if (day.id !== selectedDay.id) return day
            return {
              ...day,
              staffShifts: [...day.staffShifts, nextShift].sort((a, b) =>
                a.name.localeCompare(b.name)
              ),
            }
          })
        )
      }

      setAssigning(false)
    },
    [activeCycleId, allTherapists, isPostPublishModification, selectedDay, setDays]
  )

  const handleChangeStatus = useCallback(
    async (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => {
      if (!canUpdateAssignmentStatus) return
      // Keep callback aligned with the active shift tab setter.
      void shiftTab
      const targetDay = days.find((day) => day.id === dayId)
      const targetShift = isLead
        ? targetDay?.leadShift
        : targetDay?.staffShifts.find((shift) => shift.id === shiftId)

      if (!targetShift?.id) {
        console.error('Could not find shift row id for status update.', { dayId, shiftId, isLead })
        return
      }

      if (targetShift.status === nextStatus) {
        return
      }

      const previousStatus = targetShift.status
      const changeTime = timestamp()
      const optimisticFromLabel = getCoverageStatusLabel(previousStatus)
      const optimisticToLabel = getCoverageStatusLabel(nextStatus)

      const applyShiftStatus = (
        shift: ShiftItem | null,
        mode: 'optimistic' | 'rollback'
      ): ShiftItem | null => {
        if (!shift || shift.id !== shiftId) return shift

        if (mode === 'optimistic') {
          if (shift.status === nextStatus) return shift
          return {
            ...shift,
            status: nextStatus,
            log: [
              ...shift.log,
              {
                from: optimisticFromLabel,
                to: nextStatus,
                toLabel: optimisticToLabel,
                time: changeTime,
              },
            ],
          }
        }

        const lastLog = shift.log[shift.log.length - 1]
        const isMatchingOptimisticLog =
          Boolean(lastLog) &&
          lastLog.from === optimisticFromLabel &&
          lastLog.to === nextStatus &&
          lastLog.toLabel === optimisticToLabel &&
          lastLog.time === changeTime

        if (!isMatchingOptimisticLog || shift.status !== nextStatus) {
          return shift
        }

        return {
          ...shift,
          status: previousStatus,
          log: shift.log.slice(0, -1),
        }
      }

      const buildStatusUpdater =
        (mode: 'optimistic' | 'rollback') =>
        (current: DayItem[]): DayItem[] =>
          current.map((day) => {
            if (day.id !== dayId) return day
            return {
              ...day,
              leadShift: isLead ? applyShiftStatus(day.leadShift, mode) : day.leadShift,
              staffShifts: isLead
                ? day.staffShifts
                : day.staffShifts.map((shift) => applyShiftStatus(shift, mode) as ShiftItem),
            }
          })

      await updateCoverageAssignmentStatus({
        shiftId: targetShift.id,
        nextStatus,
        setState: setDays,
        clearError: () => setError(''),
        showError: (message) => setError(message),
        applyOptimisticUpdate: buildStatusUpdater('optimistic'),
        rollbackOptimisticUpdate: buildStatusUpdater('rollback'),
        persistAssignmentStatus: async (id, payload) =>
          await persistCoverageShiftStatus(supabase, id, payload),
        logError: (message, error) => {
          console.error(message, error)
        },
      })
    },
    [canUpdateAssignmentStatus, days, setDays, shiftTab, supabase]
  )

  const handleUnassign = useCallback(
    async (dayId: string, shiftId: string, isLead: boolean) => {
      if (!shiftId || !activeCycleId || unassigningShiftId) return

      const previousDays = days
      setError('')
      setUnassigningShiftId(shiftId)

      setDays((current) =>
        current.map((day) => {
          if (day.id !== dayId) return day
          if (isLead) {
            return { ...day, leadShift: null }
          }
          return {
            ...day,
            staffShifts: day.staffShifts.filter((shift) => shift.id !== shiftId),
          }
        })
      )

      const { error: deleteError } = await unassignCoverageShiftViaApi({
        cycleId: activeCycleId ?? '',
        shiftId,
        isPostPublishModification,
      })

      if (!deleteError) {
        setUnassigningShiftId(null)
        return
      }

      console.error('Failed to unassign therapist from shift:', deleteError)
      setDays(previousDays)
      setError('Could not unassign therapist. Changes were rolled back.')
      setUnassigningShiftId(null)
    },
    [activeCycleId, days, isPostPublishModification, setDays, unassigningShiftId]
  )

  return (
    <div className="min-h-screen bg-background">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={0}
        className="no-print"
      >
        <ManagerWorkspaceHeader
          title="Schedule"
          subtitle={scheduleSubtitle}
          summary={
            <>
              {noCycleSelected ? (
                <>
                  <span className="rounded-md border border-border/60 bg-muted/25 px-2 py-0.5 text-[11px] font-medium text-foreground/85">
                    No active cycle
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {canManageCoverage
                      ? 'Create a block to begin staffing.'
                      : 'Waiting for the next published schedule.'}
                  </span>
                </>
              ) : showEmptyDraftState ? (
                <span className="text-[11px] text-muted-foreground">
                  {canManageCoverage
                    ? 'Auto-draft or open a day to assign the first shifts.'
                    : 'No staffing rows in this block yet.'}
                </span>
              ) : (
                <>
                  {issueCount > 0 && (
                    <span className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-subtle)]/45 px-2 py-0.5 text-[11px] font-medium text-[var(--warning-text)]">
                      {issueCount} {issueCount === 1 ? 'day' : 'days'} missing a lead
                    </span>
                  )}
                  {preliminaryLive && (
                    <span className="text-[11px] text-muted-foreground/90">
                      Preliminary active
                      {preliminarySentLabel ? ` · ${preliminarySentLabel}` : ''}
                    </span>
                  )}
                  {issueCount === 0 && !preliminaryLive && !activeCyclePublished && (
                    <span className="text-[11px] text-muted-foreground/75">
                      Draft — not visible to staff until published.
                    </span>
                  )}
                </>
              )}
            </>
          }
          actions={
            canManageCoverage ? (
              <>
                <form
                  ref={autoDraftFormRef}
                  action={generateDraftScheduleAction}
                  className="hidden"
                  aria-hidden="true"
                >
                  <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                  <input type="hidden" name="view" value="week" />
                  <input type="hidden" name="show_unavailable" value="false" />
                  <input type="hidden" name="return_to" value="coverage" />
                </form>
                <form
                  ref={clearDraftFormRef}
                  action={resetDraftScheduleAction}
                  className="hidden"
                  aria-hidden="true"
                >
                  <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                  <input type="hidden" name="view" value="week" />
                  <input type="hidden" name="show_unavailable" value="false" />
                  <input type="hidden" name="return_to" value="coverage" />
                </form>
                {noCycleSelected ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => setCycleDialogOpen(true)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      New 6-week block
                    </Button>
                    <Link
                      href="/publish"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Publish history
                    </Link>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={!activeCycleId || activeCyclePublished}
                      onClick={() => setAutoDraftDialogOpen(true)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Auto-draft
                    </Button>
                    <form action={sendPreliminaryScheduleAction}>
                      <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                      <input type="hidden" name="view" value="week" />
                      <input type="hidden" name="show_unavailable" value="false" />
                      <input type="hidden" name="return_to" value="coverage" />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={!activeCycleId || activeCyclePublished}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {preliminaryLive ? 'Refresh preliminary' : 'Send preliminary'}
                      </Button>
                    </form>
                    {activeCyclePublished ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-1 text-xs font-medium text-[var(--success-text)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-text)]" />
                        Published
                      </span>
                    ) : (
                      <form action={toggleCyclePublishedAction}>
                        <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                        <input type="hidden" name="view" value="week" />
                        <input type="hidden" name="show_unavailable" value="false" />
                        <input type="hidden" name="currently_published" value="false" />
                        <input type="hidden" name="override_weekly_rules" value="false" />
                        <input type="hidden" name="override_shift_rules" value="false" />
                        <input type="hidden" name="return_to" value="coverage" />
                        <Button
                          type="submit"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={!activeCycleId}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Publish
                        </Button>
                      </form>
                    )}
                    <MoreActionsMenu>
                      <button
                        type="button"
                        onClick={() => setCycleDialogOpen(true)}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        New 6-week block
                      </button>
                      <button
                        type="button"
                        disabled={!activeCycleId || activeCyclePublished}
                        onClick={() => setClearDraftDialogOpen(true)}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                      >
                        Clear draft
                      </button>
                      <Link
                        href="/publish"
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        Publish history
                      </Link>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                      </button>
                    </MoreActionsMenu>
                  </>
                )}
              </>
            ) : (
              !noCycleSelected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
                  onClick={() => window.print()}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Button>
              )
            )
          }
        />

        <div className="px-6 pb-2 pt-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
                Schedule cycle
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {availableCycles.slice(0, 4).map((cycle) => {
                  const isActive = cycle.id === activeCycleId
                  const rangeLabel = formatHumanCycleRange(cycle.start_date, cycle.end_date)
                  return (
                    <Link
                      key={cycle.id}
                      href={`/coverage?cycle=${cycle.id}&view=week&${COVERAGE_SHIFT_QUERY_KEY}=${shiftTabToQueryValue(shiftTab)}`}
                      title={cycle.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition-colors',
                        isActive
                          ? 'border-primary bg-primary/14 font-semibold text-foreground shadow-sm ring-1 ring-primary/25'
                          : 'border-border/70 bg-card font-medium text-muted-foreground hover:bg-muted/35 hover:text-foreground'
                      )}
                    >
                      <span>{rangeLabel}</span>
                      {cycle.published && !isActive ? (
                        <span className="ml-1 text-[0.65rem] font-normal text-muted-foreground">
                          · Live
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </div>

            {!noCycleSelected && (
              <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-border">
                {(['Day', 'Night'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTabSwitch(tab)}
                    data-testid={`coverage-shift-tab-${tab.toLowerCase()}`}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium transition-colors',
                      shiftTab === tab
                        ? 'bg-primary/90 text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                    )}
                  >
                    {tab} Shift
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="no-print px-6 py-4"
      >
        {/* Future: quick exception filters (understaffed, open slots, missing lead, conflicts). */}
        {activeCyclePublished && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-[var(--success-border)]/85 bg-[var(--success-subtle)]/80 px-3 py-2">
            <span className="text-xs leading-snug text-[var(--success-text)]">
              Live schedule — staff see updates as you save.
            </span>
            <Link
              href={weekRosterHref}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[var(--success-text)] underline-offset-2 ring-offset-background transition-colors hover:bg-[var(--success-subtle)]/90 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--success-border)]/60 focus-visible:ring-offset-2"
            >
              View published schedule
              <ChevronRight className="h-3.5 w-3.5 opacity-90" aria-hidden />
            </Link>
          </div>
        )}
        {successParam === 'cycle_published' && (
          <p className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-xs font-semibold text-[var(--success-text)]">
            Published - visible to employees.
          </p>
        )}
        {successParam === 'preliminary_sent' && (
          <p className="mb-3 rounded-md border border-[var(--info-border)] bg-[var(--info-subtle)] px-3 py-2 text-xs font-semibold text-[var(--info-text)]">
            Preliminary schedule sent. Therapists can now review it in the app.
          </p>
        )}
        {successParam === 'preliminary_refreshed' && (
          <p className="mb-3 rounded-md border border-[var(--info-border)] bg-[var(--info-subtle)] px-3 py-2 text-xs font-semibold text-[var(--info-text)]">
            Preliminary schedule refreshed with the latest staffing draft.
          </p>
        )}
        {successParam === 'cycle_unpublished' && (
          <p className="mb-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2 text-xs font-semibold text-[var(--warning-text)]">
            Cycle unpublished.
          </p>
        )}
        {successParam === 'cycle_deleted' && (
          <p className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-xs font-semibold text-[var(--success-text)]">
            Cycle deleted.
          </p>
        )}
        {errorParam === 'delete_cycle_published' && (
          <p className="mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-semibold text-[var(--error-text)]">
            Cannot delete a live cycle. Unpublish it first.
          </p>
        )}
        {successParam === 'shift_added' && (
          <p className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-xs font-semibold text-[var(--success-text)]">
            Shift assigned.
          </p>
        )}
        {autoDraftFeedback && (
          <p
            className={`mb-3 rounded-md px-3 py-2 text-xs font-semibold ${
              autoDraftFeedback.variant === 'error'
                ? 'border border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
                : 'border border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
            }`}
          >
            {autoDraftFeedback.message}
          </p>
        )}
        {publishErrorMessage && (
          <p className="mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-semibold text-[var(--error-text)]">
            {publishErrorMessage}
          </p>
        )}
        {canManageCoverage && publishOverrideConfig && !activeCyclePublished && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-[var(--warning-text)]">
                Override publish block
              </p>
              <p className="mt-1 text-xs text-[var(--warning-text)]/85">
                {publishOverrideConfig.description}
              </p>
            </div>
            <form action={toggleCyclePublishedAction}>
              <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
              <input type="hidden" name="view" value="week" />
              <input type="hidden" name="show_unavailable" value="false" />
              <input
                type="hidden"
                name="currently_published"
                value={activeCyclePublished ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="override_weekly_rules"
                value={publishOverrideConfig.weekly}
              />
              <input
                type="hidden"
                name="override_shift_rules"
                value={publishOverrideConfig.shift}
              />
              <input type="hidden" name="return_to" value="coverage" />
              <Button type="submit" size="sm" className="gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" />
                {publishOverrideConfig.label}
              </Button>
            </form>
          </div>
        )}
        {errorParam === 'preliminary_cycle_published' && (
          <p className="mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-semibold text-[var(--error-text)]">
            Preliminary schedules can only be sent while the cycle is still a draft.
          </p>
        )}
        {errorParam === 'preliminary_send_failed' && (
          <p className="mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-semibold text-[var(--error-text)]">
            Could not send the preliminary schedule. Please try again.
          </p>
        )}
        {error && (
          <p className="mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs text-[var(--error-text)]">
            {error}
          </p>
        )}
        {preliminaryLive && !activeCyclePublished && (
          <div className="mb-3 rounded-lg border border-[var(--info-border)] bg-[var(--info-subtle)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--info-text)]">
              Preliminary schedule is live{preliminarySentLabel ? ` as of ${preliminarySentLabel}` : ''}.
            </p>
            <p className="mt-1 text-xs text-[var(--info-text)]/85">
              Therapists can review tentative shifts, claim open help-needed slots, and send change requests while you keep approval control.
            </p>
          </div>
        )}
        {noCycleSelected ? (
          <section className="rounded-[1.75rem] border border-border/70 bg-card px-6 py-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <h2 className="text-lg font-semibold text-foreground">
              {canManageCoverage ? 'No open 6-week block' : 'No schedule available'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {canManageCoverage
                ? 'Create the next 6-week block to start staffing this calendar. Once a block exists, the day and night schedule grids will appear here.'
                : 'A manager has not published the next schedule block yet. Check back after the next cycle is created and published.'}
            </p>
            {canManageCoverage && (
              <Button
                type="button"
                size="sm"
                className="mt-4 gap-1.5 text-xs"
                onClick={() => setCycleDialogOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                New 6-week block
              </Button>
            )}
          </section>
        ) : (
          <>
            {showEmptyDraftState && (
              <section className="mb-3 rounded-[1.75rem] border border-border/70 bg-card px-6 py-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <h2 className="text-lg font-semibold text-foreground">
                  {canManageCoverage ? 'No staffing drafted yet' : 'No staffing published yet'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {canManageCoverage
                    ? 'This block exists, but it does not have any shift rows yet. Auto-draft it or click a day to start assigning the first shifts manually.'
                    : 'This schedule block exists, but no staffing has been published into it yet. Check another cycle pill or come back after the schedule is drafted.'}
                </p>
                {canManageCoverage && (
                  <div className="mt-4">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={!activeCycleId || activeCyclePublished}
                      onClick={() => setAutoDraftDialogOpen(true)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Auto-draft
                    </Button>
                  </div>
                )}
              </section>
            )}
          <CalendarGrid
            days={days}
            loading={loading}
            selectedId={selectedId}
            schedulingViewOnly={!canManageCoverage}
            allowAssignmentStatusEdits={canUpdateAssignmentStatus}
            onSelect={handleSelect}
            onChangeStatus={handleChangeStatus}
          />
          </>
        )}
      </motion.div>

      <ShiftEditorDialog
        open={Boolean(selectedDay)}
        selectedDay={selectedDay}
        therapists={allTherapists}
        canEdit={Boolean(canManageCoverage && activeCycleId)}
        coverageCycleId={activeCycleId}
        isPastDate={isPastDate}
        hasOperationalEntries={hasOperationalEntries}
        assigning={assigning}
        unassigningShiftId={unassigningShiftId}
        weeklyTherapistCounts={weeklyTherapistCounts}
        onOpenChange={(open) => {
          if (!open) handleClose()
        }}
        onAssignTherapist={handleAssignTherapist}
        assignError={assignError}
        onUnassign={handleUnassign}
      />
      <AutoDraftConfirmDialog
        open={autoDraftDialogOpen}
        onOpenChange={setAutoDraftDialogOpen}
        applyFormRef={autoDraftFormRef}
        cycleId={activeCycleId ?? ''}
        isPublished={activeCyclePublished}
      />
      <ClearDraftConfirmDialog
        open={clearDraftDialogOpen}
        onOpenChange={setClearDraftDialogOpen}
        applyFormRef={clearDraftFormRef}
        cycleId={activeCycleId ?? ''}
        cycleLabel={printCycle?.label ?? null}
        isPublished={activeCyclePublished}
      />
      <CycleManagementDialog
        key={`cycle-dialog-${cycleDialogOpen ? 'open' : 'closed'}-${availableCycles[0]?.end_date ?? 'none'}`}
        cycles={availableCycles}
        open={cycleDialogOpen}
        onOpenChange={setCycleDialogOpen}
        createCycleAction={createCycleAction}
        deleteCycleAction={deleteCycleAction}
      />
      <PrintSchedule
        activeCycle={printCycle}
        cycleDates={printCycleDates}
        dayTeam={printDayTeam}
        nightTeam={printNightTeam}
        printUsers={printUsers}
        shiftByUserDate={printShiftByUserDate}
        isManager={showFullPrintRoster}
      />
    </div>
  )
}

