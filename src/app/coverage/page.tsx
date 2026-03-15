'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Printer, Send, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'

import {
  generateDraftScheduleAction,
  resetDraftScheduleAction,
  toggleCyclePublishedAction,
} from '@/app/schedule/actions'
import { CalendarGrid } from '@/components/coverage/CalendarGrid'
import { ShiftEditorDialog } from '@/components/coverage/ShiftEditorDialog'
import { PrintSchedule } from '@/components/print-schedule'
import { updateCoverageAssignmentStatus } from '@/lib/coverage/updateAssignmentStatus'
import {
  assignCoverageShift,
  persistCoverageShiftStatus,
  unassignCoverageShift,
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
import { getCoverageStatusLabel } from '@/lib/coverage/status-ui'
import { addDays, dateRange, formatDateLabel, toIsoDate } from '@/lib/calendar-utils'
import { getOne, getScheduleFeedback, getWeekBoundsForDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'
import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/lib/shift-types'
import type { ScheduleSearchParams } from '@/app/schedule/types'

type DayStatus = DayItem['dayStatus']

type CycleRow = { id: string; label: string; start_date: string; end_date: string; published: boolean }
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
  unfilled_reason: string | null
  assignment_status: AssignmentStatus | null
  role: ShiftRole
  profiles:
    | { full_name: string; employment_type: 'full_time' | 'part_time' | 'prn' | null }
    | { full_name: string; employment_type: 'full_time' | 'part_time' | 'prn' | null }[]
    | null
}
type AssignedShiftRow = Omit<ShiftRow, 'user_id'> & { user_id: string }

const NO_ELIGIBLE_CONSTRAINT_REASON = 'no_eligible_candidates_due_to_constraints'

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function CoveragePageContent() {
  const search = useSearchParams()
  const cycleFromUrl = search.get('cycle')
  const successParam = search.get('success')
  const errorParam = search.get('error')
  const autoParam = search.get('auto')
  const draftParam = search.get('draft')
  const supabase = useMemo(() => createClient(), [])
  const [shiftTab, setShiftTab] = useState<ShiftTab>('Day')
  const [dayDays, setDayDays] = useState<DayItem[]>([])
  const [nightDays, setNightDays] = useState<DayItem[]>([])
  const [activeCycleId, setActiveCycleId] = useState<string | null>(cycleFromUrl)
  const [activeCyclePublished, setActiveCyclePublished] = useState(false)
  const [printCycle, setPrintCycle] = useState<{ label: string; start_date: string; end_date: string } | null>(null)
  const [printCycleDates, setPrintCycleDates] = useState<string[]>([])
  const [printDayTeam, setPrintDayTeam] = useState<PrintTherapist[]>([])
  const [printNightTeam, setPrintNightTeam] = useState<PrintTherapist[]>([])
  const [printUsers, setPrintUsers] = useState<PrintTherapist[]>([])
  const [printShiftByUserDate, setPrintShiftByUserDate] = useState<Record<string, ShiftStatus>>({})
  const [allTherapists, setAllTherapists] = useState<TherapistOption[]>([])
  const [assigning, setAssigning] = useState(false)
  const [unassigningShiftId, setUnassigningShiftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [assignError, setAssignError] = useState<string>('')
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
  const issueCount = useMemo(
    () => days.filter((d) => d.dayStatus === 'missing_lead').length,
    [days]
  )

  const weekRosterHref = activeCycleId
    ? `/coverage?cycle=${activeCycleId}&view=week`
    : '/coverage?view=week'
  const cycleSummaryLabel = useMemo(() => {
    if (!printCycle) return 'Current 6-week window - Click a day to edit'
    const totalWeeks = Math.max(1, Math.round((printCycleDates.length || 42) / 7))
    return `${formatDateLabel(printCycle.start_date)} - ${formatDateLabel(printCycle.end_date)} · ${totalWeeks} weeks · Click a day to edit`
  }, [printCycle, printCycleDates.length])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')

      try {
        const today = new Date()
        const fallbackStartDate = toIsoDate(today)
        const fallbackEndDate = toIsoDate(addDays(today, 42))
        let cycleStartDate = fallbackStartDate
        let cycleEndDate = fallbackEndDate
        let cycleId: string | null = null
        let selectedCycle: CycleRow | null = null

        const { data: cyclesData, error: cyclesError } = await supabase
          .from('schedule_cycles')
          .select('id, label, start_date, end_date, published')
          .order('start_date', { ascending: false })

        if (!active) return
        if (cyclesError) {
          console.error('Could not load cycles for coverage; falling back to a 6-week window:', cyclesError)
        } else {
          const cycles = (cyclesData ?? []) as CycleRow[]
          const todayKey = toIsoDate(today)
          const cycle =
            cycles.find((row) => row.id === cycleFromUrl) ??
            cycles.find((row) => row.start_date <= todayKey && row.end_date >= todayKey) ??
            cycles[0] ??
            null
          if (cycle) {
            selectedCycle = cycle
            cycleId = cycle.id
            cycleStartDate = cycle.start_date
            cycleEndDate = cycle.end_date
          }
        }
        if (active) {
          setActiveCycleId(cycleId)
          setActiveCyclePublished(Boolean(selectedCycle?.published))
          setPrintCycle(
            selectedCycle
              ? {
                  label: selectedCycle.label,
                  start_date: selectedCycle.start_date,
                  end_date: selectedCycle.end_date,
                }
              : {
                  label: 'Coverage schedule',
                  start_date: cycleStartDate,
                  end_date: cycleEndDate,
                }
          )
          setPrintCycleDates(dateRange(cycleStartDate, cycleEndDate))
        }

        let shiftsQuery = supabase
          .from('shifts')
          .select(
            'id,user_id,date,shift_type,status,unfilled_reason,assignment_status,role,profiles:profiles!shifts_user_id_fkey(full_name,employment_type)'
          )
          .gte('date', cycleStartDate)
          .lte('date', cycleEndDate)
          .order('date', { ascending: true })

        if (cycleId) {
          shiftsQuery = shiftsQuery.eq('cycle_id', cycleId)
        }

        const { data: shiftsData, error: shiftsError } = await shiftsQuery

        if (!active) return
        if (shiftsError) {
          setError(shiftsError.message || 'Could not load shifts.')
          setDayDays([])
          setNightDays([])
          setPrintUsers([])
          setPrintDayTeam([])
          setPrintNightTeam([])
          setPrintShiftByUserDate({})
          return
        }

        const rows = (shiftsData ?? []) as ShiftRow[]
        const assignmentRows: AssignedShiftRow[] = []
        const constraintBlockedSlotKeys = new Set<string>()
        for (const row of rows) {
          if (!row.user_id) {
            if (row.unfilled_reason === NO_ELIGIBLE_CONSTRAINT_REASON) {
              constraintBlockedSlotKeys.add(`${row.date}:${row.shift_type}`)
            }
            continue
          }
          assignmentRows.push({ ...row, user_id: row.user_id })
        }
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
          const fullName = profile?.full_name ?? 'Unknown'
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
          nextShiftByUserDate[`${row.user_id}:${row.date}`] = row.status
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
          assignment_status: row.assignment_status,
          name: getOne(row.profiles)?.full_name ?? 'Unknown',
        }))

        setDayDays(buildDayItems('day', resolvedRows, cycleStartDate, cycleEndDate, constraintBlockedSlotKeys))
        setNightDays(buildDayItems('night', resolvedRows, cycleStartDate, cycleEndDate, constraintBlockedSlotKeys))
      } catch (loadError) {
        console.error('Could not load coverage calendar data:', loadError)
        setError('Could not load coverage schedule.')
        setDayDays([])
        setNightDays([])
        setPrintUsers([])
        setPrintDayTeam([])
        setPrintNightTeam([])
        setPrintShiftByUserDate({})
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [cycleFromUrl, supabase])

  // Fetch full therapist list once per shift type — not per day click.
  useEffect(() => {
    let active = true
    const shiftType = shiftTab === 'Day' ? 'day' : 'night'

    void (async () => {
      const { data, error: loadError } = await supabase
        .from('profiles')
        .select('id, full_name, shift_type, is_lead_eligible, employment_type, max_work_days_per_week')
        .eq('shift_type', shiftType)
        .eq('is_active', true)
        .eq('on_fmla', false)
        .in('role', ['therapist', 'staff'])
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
  }, [shiftTab, supabase])

  const selectedDayBase = useMemo(
    () => days.find((row) => row.id === selectedId) ?? null,
    [days, selectedId]
  )
  const selectedDay = useMemo(
    () => (selectedDayBase ? { ...selectedDayBase, shiftType: shiftTab } : null),
    [selectedDayBase, shiftTab]
  )

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
    setSelectedId(null)
    setAssignError('')
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

      const { data: inserted, error: insertError } = await assignCoverageShift(supabase, {
        cycleId: activeCycleId,
        userId,
        isoDate: selectedDay.isoDate,
        shiftType,
        role,
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
    [activeCycleId, allTherapists, selectedDay, setDays, supabase]
  )

  const handleChangeStatus = useCallback(
    async (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => {
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
    [days, setDays, shiftTab, supabase]
  )

  const handleUnassign = useCallback(
    async (dayId: string, shiftId: string, isLead: boolean) => {
      if (!shiftId || unassigningShiftId) return

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

      const { error: deleteError } = await unassignCoverageShift(supabase, shiftId)

      if (!deleteError) {
        setUnassigningShiftId(null)
        return
      }

      console.error('Failed to unassign therapist from shift:', deleteError)
      setDays(previousDays)
      setError('Could not unassign therapist. Changes were rolled back.')
      setUnassigningShiftId(null)
    },
    [days, setDays, supabase, unassigningShiftId]
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print border-b border-border bg-card px-6 pb-4 pt-5 lg:px-8 lg:pb-5 lg:pt-5.5">
        {/* Title row */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-heading text-[1.52rem] font-bold tracking-[-0.04em] text-foreground lg:text-[1.65rem]">
              Coverage
            </h1>
            <p className="mt-1 max-w-3xl text-[0.9rem] leading-7 text-muted-foreground lg:text-[0.94rem] lg:leading-7">
              {cycleSummaryLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-2xl px-4 text-[0.86rem] font-medium"
              onClick={() => window.print()}
            >
              <Printer className="h-3.25 w-3.25" />
              Print
            </Button>
            <form action={generateDraftScheduleAction}>
              <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
              <input type="hidden" name="view" value="week" />
              <input type="hidden" name="show_unavailable" value="false" />
              <input type="hidden" name="return_to" value="coverage" />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-9 rounded-2xl px-4 text-[0.86rem] font-medium"
                disabled={!activeCycleId || activeCyclePublished}
              >
                <Sparkles className="h-3.25 w-3.25" />
                Auto-draft
              </Button>
            </form>
            <form action={resetDraftScheduleAction}>
              <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
              <input type="hidden" name="view" value="week" />
              <input type="hidden" name="show_unavailable" value="false" />
              <input type="hidden" name="return_to" value="coverage" />
              <button
                type="submit"
                disabled={!activeCycleId || activeCyclePublished}
                className="inline-flex h-9 items-center gap-1.5 rounded-2xl border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 text-[0.86rem] font-medium text-[var(--error-text)] transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                Clear draft
              </button>
            </form>
            <form action={toggleCyclePublishedAction}>
              <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
              <input type="hidden" name="view" value="week" />
              <input type="hidden" name="show_unavailable" value="false" />
              <input
                type="hidden"
                name="currently_published"
                value={activeCyclePublished ? 'true' : 'false'}
              />
              <input type="hidden" name="override_weekly_rules" value="false" />
              <input type="hidden" name="override_shift_rules" value="false" />
              <input type="hidden" name="return_to" value="coverage" />
              <Button
                type="submit"
                size="sm"
                className="h-9 rounded-2xl px-4 text-[0.86rem] font-medium"
                disabled={!activeCycleId || activeCyclePublished}
              >
                <Send className="h-3.25 w-3.25" />
                {activeCyclePublished ? 'Published' : 'Publish'}
              </Button>
            </form>
          </div>
        </div>

        {/* Controls row: Day/Night tabs + issue count + published badge */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <div className="inline-flex overflow-hidden rounded-2xl border border-border">
            {(['Day', 'Night'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabSwitch(tab)}
                data-testid={`coverage-shift-tab-${tab.toLowerCase()}`}
                className={cn(
                  'px-4.5 py-2 text-[0.88rem] font-medium transition-colors',
                  shiftTab === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                {tab} Shift
              </button>
            ))}
          </div>

          {!loading && issueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-1.5 text-[0.84rem] font-medium text-[var(--warning-text)]">
              <AlertTriangle className="h-3.25 w-3.25" />
              {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
            </span>
          )}

          {activeCyclePublished && (
            <StatusBadge variant="success" dot={false}>
              Published
            </StatusBadge>
          )}
        </div>
      </div>

      <div className="no-print px-6 py-4 lg:px-8">
        {activeCyclePublished && (
          <div className="mb-4 rounded-[24px] border border-[var(--success-border)] bg-[var(--success-subtle)] px-5 py-4">
            <p className="text-[0.9rem] font-semibold text-[var(--success-text)]">
              This cycle is published and visible to employees.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href={weekRosterHref}
                className="rounded-2xl border border-[var(--success-border)] bg-card px-4 py-2 text-[0.84rem] font-semibold text-[var(--success-text)] transition-colors hover:bg-[var(--success-subtle)]"
              >
                View published schedule
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-2xl border border-[var(--success-border)] bg-card px-4 py-2 text-[0.84rem] font-semibold text-[var(--success-text)] transition-colors hover:bg-[var(--success-subtle)]"
              >
                Print published schedule
              </button>
            </div>
          </div>
        )}
        {successParam === 'cycle_published' && (
          <p className="mb-3 rounded-md border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-2 text-xs font-semibold text-[var(--success-text)]">
            Published - visible to employees.
          </p>
        )}
        {successParam === 'cycle_unpublished' && (
          <p className="mb-3 rounded-md border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2 text-xs font-semibold text-[var(--warning-text)]">
            Cycle unpublished.
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
        {error && (
          <p className="mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs text-[var(--error-text)]">
            {error}
          </p>
        )}
        <CalendarGrid
          days={days}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          onChangeStatus={handleChangeStatus}
        />
      </div>

      <ShiftEditorDialog
        open={Boolean(selectedDay)}
        selectedDay={selectedDay}
        therapists={allTherapists}
        canEdit={Boolean(activeCycleId)}
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
      <PrintSchedule
        activeCycle={printCycle}
        cycleDates={printCycleDates}
        dayTeam={printDayTeam}
        nightTeam={printNightTeam}
        printUsers={printUsers}
        shiftByUserDate={printShiftByUserDate}
        isManager
      />
    </div>
  )
}

export default function CoveragePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <CoveragePageContent />
    </Suspense>
  )
}
