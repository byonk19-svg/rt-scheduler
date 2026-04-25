'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, Printer, Send, Sparkles } from 'lucide-react'

import { MoreActionsMenu } from '@/components/more-actions-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  applyTemplateAction,
  createCycleAction,
  deleteCycleAction,
  generateDraftScheduleAction,
  resetDraftScheduleAction,
  sendPreliminaryScheduleAction,
  toggleCyclePublishedAction,
} from '@/app/schedule/actions'
import { StatusPill } from '@/components/coverage/AssignmentStatusPopover'
import type {
  CoveragePageSnapshot,
  CycleRow,
  PreliminarySnapshotRow,
  PrintTherapist,
  TherapistOption,
} from '@/app/(app)/coverage/coverage-page-snapshot'
import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'
import { updateCoverageAssignmentStatus } from '@/lib/coverage/updateAssignmentStatus'
import {
  assignCoverageShiftViaApi,
  persistCoverageShiftStatus,
  setCoverageDesignatedLeadViaApi,
  unassignCoverageShiftViaApi,
} from '@/lib/coverage/mutations'
import {
  countActive,
  flatten,
  toUiStatus,
  type DayItem,
  type ShiftItem,
  type ShiftTab,
  type UiStatus,
} from '@/lib/coverage/selectors'
import { getCoverageStatusLabel, toCoverageAssignmentPayload } from '@/lib/coverage/status-ui'
import type { Role } from '@/lib/auth/roles'
import { formatHumanCycleRange, toIsoDate } from '@/lib/calendar-utils'
import { getScheduleFeedback, getWeekBoundsForDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'
import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'
import type { ScheduleSearchParams } from '@/app/schedule/types'
import type { OperationalCode } from '@/lib/operational-codes'
import {
  COVERAGE_SHIFT_QUERY_KEY,
  parseCoverageShiftSearchParam,
  shiftTabToQueryValue,
} from '@/lib/coverage/coverage-shift-tab'

const ClearDraftConfirmDialog = dynamic(() =>
  import('@/components/coverage/ClearDraftConfirmDialog').then(
    (module) => module.ClearDraftConfirmDialog ?? (() => null)
  )
)
const CalendarGrid = dynamic(() =>
  import('@/components/coverage/CalendarGrid').then((module) => module.CalendarGrid ?? (() => null))
)
const RosterScheduleView = dynamic(() =>
  import('@/components/coverage/RosterScheduleView').then(
    (module) => module.RosterScheduleView ?? (() => null)
  )
)
const PreFlightDialog = dynamic(() =>
  import('@/components/coverage/PreFlightDialog').then((module) => module.PreFlightDialog ?? (() => null))
)
const PrintSchedule = dynamic(() =>
  import('@/components/print-schedule').then((module) => module.PrintSchedule ?? (() => null))
)
const SaveAsTemplateDialog = dynamic(() =>
  import('@/components/coverage/SaveAsTemplateDialog').then((module) => module.SaveAsTemplateDialog ?? (() => null))
)
const StartFromTemplateDialog = dynamic(() =>
  import('@/components/coverage/StartFromTemplateDialog').then(
    (module) => module.StartFromTemplateDialog ?? (() => null)
  )
)
const CycleManagementDialog = dynamic(() =>
  import('@/components/coverage/CycleManagementDialog').then(
    (module) => module.CycleManagementDialog ?? (() => null)
  )
)
const ShiftEditorDialog = dynamic(() =>
  import('@/components/coverage/ShiftEditorDialog').then(
    (module) => module.ShiftEditorDialog ?? (() => null)
  )
)

type DayStatus = DayItem['dayStatus']

type CoverageViewMode = 'week' | 'calendar' | 'roster'
type RenderedCoverageViewMode = 'week' | 'roster'
const VIEW_OPTIONS = [
  { value: 'week', label: 'Grid' },
  { value: 'roster', label: 'Roster' },
] as const

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function toRenderedCoverageViewMode(viewMode: CoverageViewMode): RenderedCoverageViewMode {
  return viewMode === 'roster' ? 'roster' : 'week'
}

type WorkspaceMetricTone = 'neutral' | 'success' | 'warning' | 'critical'

function CoverageMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  tone?: WorkspaceMetricTone
}) {
  const toneClasses: Record<WorkspaceMetricTone, string> = {
    neutral: 'border-border/70 bg-card text-foreground',
    success: 'border-[var(--success-border)]/55 bg-[var(--success-subtle)]/28 text-[var(--success-text)]',
    warning: 'border-[var(--warning-border)]/60 bg-[var(--warning-subtle)]/25 text-[var(--warning-text)]',
    critical: 'border-[var(--error-border)]/60 bg-[var(--error-subtle)]/28 text-[var(--error-text)]',
  }

  return (
    <div className={cn('rounded-lg border px-3 py-2.5 shadow-sm', toneClasses[tone])}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 flex items-end justify-between gap-3">
        <span className="text-[1.6rem] font-semibold tracking-[-0.04em]">{value}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{detail}</span>
      </div>
    </div>
  )
}

function CoverageSurfaceBanner({
  tone = 'neutral',
  title,
  description,
  actions,
}: {
  tone?: WorkspaceMetricTone
  title: string
  description: string
  actions?: ReactNode
}) {
  const toneClasses: Record<WorkspaceMetricTone, string> = {
    neutral: 'border-border/70 bg-muted/15',
    success: 'border-[var(--success-border)]/65 bg-[var(--success-subtle)]/28',
    warning: 'border-[var(--warning-border)]/70 bg-[var(--warning-subtle)]/28',
    critical: 'border-[var(--error-border)]/70 bg-[var(--error-subtle)]/28',
  }

  return (
    <section className={cn('rounded-lg border px-3.5 py-2.5', toneClasses[tone])}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

function CoverageSegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  testIdPrefix,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (nextValue: T) => void
  testIdPrefix?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="inline-flex overflow-hidden rounded-lg border border-border/70 bg-background">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={testIdPrefix ? `${testIdPrefix}-${option.value.toLowerCase()}` : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CoverageClientPage({
  initialShiftTab,
  shiftTabLockedFromUrl,
  initialViewMode,
  initialSnapshot,
}: {
  initialShiftTab: ShiftTab
  shiftTabLockedFromUrl: boolean
  initialViewMode: CoverageViewMode
  initialSnapshot: CoveragePageSnapshot
}) {
  const search = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const successParam = search.get('success')
  const errorParam = search.get('error')
  const autoParam = search.get('auto')
  const draftParam = search.get('draft')
  const overrideWeeklyRulesParam = search.get('override_weekly_rules')
  const overrideShiftRulesParam = search.get('override_shift_rules')
  const supabase = useMemo(() => createClient(), [])
  const therapistOptionsByShift = initialSnapshot.allTherapistsByShift
  const rosterProfilesByShift = initialSnapshot.rosterProfilesByShift
  const urlShiftTab = useMemo(
    () => parseCoverageShiftSearchParam(search.get(COVERAGE_SHIFT_QUERY_KEY)),
    [search]
  )
  const [shiftTab, setShiftTab] = useState<ShiftTab>(() => initialShiftTab)
  const [viewMode, setViewMode] = useState<CoverageViewMode>(() => initialViewMode)
  const profileDefaultAppliedRef = useRef(shiftTabLockedFromUrl)
  const [dayDays, setDayDays] = useState<DayItem[]>(() => initialSnapshot.dayDays)
  const [nightDays, setNightDays] = useState<DayItem[]>(() => initialSnapshot.nightDays)
  const [activeCycleId, setActiveCycleId] = useState<string | null>(() => initialSnapshot.activeCycleId)
  const [activeCyclePublished, setActiveCyclePublished] = useState(
    () => initialSnapshot.activeCyclePublished
  )
  const [activePreliminarySnapshot, setActivePreliminarySnapshot] =
    useState<PreliminarySnapshotRow | null>(() => initialSnapshot.activePreliminarySnapshot)
  const [availableCycles, setAvailableCycles] = useState<CycleRow[]>(() => initialSnapshot.availableCycles)
  const [printCycle, setPrintCycle] = useState<{ label: string; start_date: string; end_date: string } | null>(
    () => initialSnapshot.printCycle
  )
  const [printCycleDates, setPrintCycleDates] = useState<string[]>(() => initialSnapshot.printCycleDates)
  const [printDayTeam, setPrintDayTeam] = useState<PrintTherapist[]>(() => initialSnapshot.printDayTeam)
  const [printNightTeam, setPrintNightTeam] = useState<PrintTherapist[]>(() => initialSnapshot.printNightTeam)
  const [printUsers, setPrintUsers] = useState<PrintTherapist[]>(() => initialSnapshot.printUsers)
  const [printShiftByUserDate, setPrintShiftByUserDate] = useState<Record<string, ShiftStatus>>(
    () => initialSnapshot.printShiftByUserDate
  )
  const [allTherapists, setAllTherapists] = useState<TherapistOption[]>(() => initialSnapshot.allTherapists)
  const [rosterProfiles, setRosterProfiles] = useState<RosterMemberRow[]>(() => initialSnapshot.rosterProfiles)
  const [activeOpCodes, setActiveOpCodes] = useState<Map<string, string>>(
    () => new Map(Object.entries(initialSnapshot.activeOpCodes))
  )
  const [assigning, setAssigning] = useState(false)
  const [unassigningShiftId, setUnassigningShiftId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState<number>(0)
  const [selectedCycleHasShiftRows, setSelectedCycleHasShiftRows] = useState(
    () => initialSnapshot.selectedCycleHasShiftRows
  )
  const [preFlightDialogOpen, setPreFlightDialogOpen] = useState(false)
  const [clearDraftDialogOpen, setClearDraftDialogOpen] = useState(false)
  const [saveAsTemplateDialogOpen, setSaveAsTemplateDialogOpen] = useState(false)
  const [templateTarget, setTemplateTarget] = useState<{ cycleId: string; startDate: string } | null>(
    null
  )
  const [cycleDialogOpen, setCycleDialogOpen] = useState(false)
  const [showPlanningDetails, setShowPlanningDetails] = useState(false)
  const [error, setError] = useState<string>(() => initialSnapshot.error)
  const [assignError, setAssignError] = useState<string>('')
  const [rosterCellError, setRosterCellError] = useState<{
    dayId: string
    memberId: string
    message: string
  } | null>(null)
  const [canManageCoverage, setCanManageCoverage] = useState(() => initialSnapshot.canManageCoverage)
  const [canUpdateAssignmentStatus, setCanUpdateAssignmentStatus] = useState(
    () => initialSnapshot.canUpdateAssignmentStatus
  )
  const [actorRole, setActorRole] = useState<Role | null>(() => initialSnapshot.actorRole)
  const autoDraftFormRef = useRef<HTMLFormElement>(null)
  const clearDraftFormRef = useRef<HTMLFormElement>(null)
  const deferredSelectedId = useDeferredValue(selectedId)
  const days = shiftTab === 'Day' ? dayDays : nightDays
  const setDays = shiftTab === 'Day' ? setDayDays : setNightDays
  const totalWeeks = Math.max(Math.ceil(days.length / 7), 1)
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

  const syncOperationalCodeState = useCallback((shiftId: string, nextStatus: UiStatus) => {
    const assignmentStatus = toCoverageAssignmentPayload(nextStatus).assignment_status

    setActiveOpCodes((current) => {
      const next = new Map(current)
      if (assignmentStatus === 'scheduled') {
        next.delete(shiftId)
      } else {
        next.set(shiftId, assignmentStatus as OperationalCode)
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (urlShiftTab != null) {
      setShiftTab(urlShiftTab)
      profileDefaultAppliedRef.current = true
    }
  }, [urlShiftTab])

  useEffect(() => {
    setViewMode(initialViewMode)
  }, [initialViewMode])

  useEffect(() => {
    profileDefaultAppliedRef.current = shiftTabLockedFromUrl
    setShiftTab(initialShiftTab)
    setDayDays(initialSnapshot.dayDays)
    setNightDays(initialSnapshot.nightDays)
    setActiveCycleId(initialSnapshot.activeCycleId)
    setActiveCyclePublished(initialSnapshot.activeCyclePublished)
    setActivePreliminarySnapshot(initialSnapshot.activePreliminarySnapshot)
    setAvailableCycles(initialSnapshot.availableCycles)
    setPrintCycle(initialSnapshot.printCycle)
    setPrintCycleDates(initialSnapshot.printCycleDates)
    setPrintDayTeam(initialSnapshot.printDayTeam)
    setPrintNightTeam(initialSnapshot.printNightTeam)
    setPrintUsers(initialSnapshot.printUsers)
    setPrintShiftByUserDate(initialSnapshot.printShiftByUserDate)
    setAllTherapists(initialSnapshot.allTherapists)
    setRosterProfiles(initialSnapshot.rosterProfiles)
    setActiveOpCodes(new Map(Object.entries(initialSnapshot.activeOpCodes)))
    setLoading(false)
    setSelectedId(null)
    setWeekOffset(0)
    setSelectedCycleHasShiftRows(initialSnapshot.selectedCycleHasShiftRows)
    setError(initialSnapshot.error)
    setAssignError('')
    setRosterCellError(null)
    setCanManageCoverage(initialSnapshot.canManageCoverage)
    setCanUpdateAssignmentStatus(initialSnapshot.canUpdateAssignmentStatus)
    setActorRole(initialSnapshot.actorRole)
  }, [initialShiftTab, shiftTabLockedFromUrl, initialSnapshot])

  useEffect(() => {
    setWeekOffset(0)
  }, [activeCycleId])

  useEffect(() => {
    setWeekOffset((current) => Math.min(current, Math.max(totalWeeks - 1, 0)))
  }, [totalWeeks])

  useEffect(() => {
    const shiftType = shiftTab === 'Day' ? 'day' : 'night'
    setAllTherapists(therapistOptionsByShift[shiftType] ?? [])
    setRosterProfiles(rosterProfilesByShift[shiftType] ?? [])
  }, [rosterProfilesByShift, shiftTab, therapistOptionsByShift])

  const weekRosterHref = useMemo(() => {
    const params = new URLSearchParams()
    if (activeCycleId) params.set('cycle', activeCycleId)
    params.set('view', viewMode)
    params.set(COVERAGE_SHIFT_QUERY_KEY, shiftTabToQueryValue(shiftTab))
    return `/coverage?${params.toString()}`
  }, [activeCycleId, shiftTab, viewMode])
  const renderedViewMode = useMemo(
    () => toRenderedCoverageViewMode(viewMode),
    [viewMode]
  )
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

  const showFullPrintRoster = canManageCoverage || actorRole === 'lead'
  const rosterMembers = useMemo<RosterMemberRow[]>(
    () => rosterProfiles,
    [rosterProfiles]
  )
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
  const proactiveCoverageRisk = initialSnapshot.proactiveCoverageRisk
  const today = toIsoDate(new Date())
  const isPastDate = selectedDay !== null && selectedDay.isoDate < today
  const selectedDayShiftIds = [
    ...(selectedDay?.leadShift ? [selectedDay.leadShift.id] : []),
    ...(selectedDay?.staffShifts.map((shift) => shift.id) ?? []),
  ]
  const hasOperationalEntries = selectedDayShiftIds.some((id) => activeOpCodes.has(id))
  const cycleRangeLabel = printCycle
    ? formatHumanCycleRange(printCycle.start_date, printCycle.end_date)
    : 'No open 6-week block'
  const workspaceStatusTone: WorkspaceMetricTone = noCycleSelected
    ? 'neutral'
    : activeCyclePublished
      ? 'success'
      : showEmptyDraftState
        ? 'warning'
        : 'neutral'
  const workspaceStatusLabel = noCycleSelected
    ? 'No active cycle'
    : activeCyclePublished
      ? 'Published'
      : showEmptyDraftState
        ? 'Setup required'
        : 'Draft'
  const coverageSummary = useMemo(() => {
    const missingLeadDays = days.filter((day) => !day.leadShift).length
    const unassignedDays = days.filter((day) => flatten(day).length === 0).length
    const priorityGapDays = days.filter(
      (day) => day.constraintBlocked || !day.leadShift || countActive(day) < 3
    ).length
    const staffedDays = days.filter((day) => day.leadShift && countActive(day) >= 4).length

    return {
      missingLeadDays,
      unassignedDays,
      priorityGapDays,
      staffedDays,
    }
  }, [days])
  const hasSchedulingContent = selectedCycleHasShiftRows && days.length > 0
  const canRunAutoDraft = Boolean(activeCycleId) && !activeCyclePublished
  const canSendPreliminary = Boolean(activeCycleId) && !activeCyclePublished && selectedCycleHasShiftRows
  const canPublishCycle = Boolean(activeCycleId) && selectedCycleHasShiftRows
  const nextActionLabel = noCycleSelected
    ? canManageCoverage
      ? 'Create a 6-week block to start planning.'
      : 'Wait for a manager to open the next cycle.'
    : showEmptyDraftState
      ? canManageCoverage
        ? 'Run Auto-draft or open a day to add the first assignments.'
        : 'Staffing is being prepared for this cycle.'
      : activeCyclePublished
        ? canManageCoverage
          ? 'Review live staffing and handle exceptions.'
          : 'View live staffing and operational status.'
        : canManageCoverage
          ? 'Finish draft checks, send preliminary if needed, then publish.'
          : 'Draft staffing is in progress.'
  const planningNotices = [
    proactiveCoverageRisk?.notice ?? null,
    successParam === 'cycle_published' ? 'Published - visible to employees.' : null,
    successParam === 'preliminary_sent'
      ? 'Preliminary schedule sent. Therapists can now review it in the app.'
      : null,
    successParam === 'preliminary_refreshed'
      ? 'Preliminary schedule refreshed with the latest staffing draft.'
      : null,
    successParam === 'cycle_unpublished' ? 'Cycle unpublished.' : null,
    successParam === 'cycle_deleted' ? 'Cycle deleted.' : null,
    errorParam === 'delete_cycle_published' ? 'Cannot delete a live cycle. Unpublish it first.' : null,
    successParam === 'shift_added' ? 'Shift assigned.' : null,
    autoDraftFeedback?.message ?? null,
    publishErrorMessage,
    errorParam === 'preliminary_cycle_published'
      ? 'Preliminary schedules can only be sent while the cycle is still a draft.'
      : null,
    errorParam === 'preliminary_send_failed'
      ? 'Could not send the preliminary schedule. Please try again.'
      : null,
    error || null,
  ].filter((notice): notice is string => Boolean(notice))

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
    setRosterCellError(null)
    const params = new URLSearchParams(search.toString())
    params.set(COVERAGE_SHIFT_QUERY_KEY, shiftTabToQueryValue(tab))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleViewModeChange = (nextViewMode: 'week' | 'roster') => {
    setViewMode(nextViewMode)
    setSelectedId(null)
    setAssignError('')
    setRosterCellError(null)
    const params = new URLSearchParams(search.toString())
    params.set('view', nextViewMode)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleSelect = useCallback((id: string) => {
    window.requestAnimationFrame(() => {
      setSelectedId((prev) => (prev === id ? null : id))
    })
    setAssignError('')
    setRosterCellError(null)
  }, [])
  const handleClose = () => {
    setSelectedId(null)
    setAssigning(false)
    setAssignError('')
    setRosterCellError(null)
  }

  const assignTherapistToDay = useCallback(
    async (dayId: string, userId: string, role: 'lead' | 'staff', options?: { inline?: boolean }) => {
      const targetDay = days.find((day) => day.id === dayId)
      if (!targetDay || !userId || !activeCycleId) return

      setAssigning(true)
      setError('')
      if (options?.inline) {
        setRosterCellError(null)
      }

      const selectedTherapist = allTherapists.find((t) => t.id === userId) ?? null
      const shiftType = shiftTab === 'Day' ? 'day' : 'night'

      const failAssign = (message: string) => {
        if (options?.inline) {
          setRosterCellError({
            dayId,
            memberId: userId,
            message,
          })
        } else {
          setAssignError(message)
        }
        setAssigning(false)
      }

      if (role === 'lead') {
        const existingLead = targetDay.leadShift
        const staffShift = targetDay.staffShifts.find((s) => s.userId === userId)

        if (existingLead?.userId === userId) {
          setAssigning(false)
          return
        }

        const needsDesignatedLeadChange =
          Boolean(staffShift) && (existingLead ? existingLead.userId !== userId : true)

        if (needsDesignatedLeadChange) {
          const { error: leadError } = await setCoverageDesignatedLeadViaApi({
            cycleId: activeCycleId,
            therapistId: userId,
            isoDate: targetDay.isoDate,
            shiftType,
          })
          if (leadError) {
            console.error('Set designated lead failed:', leadError)
            failAssign(
              leadError.message ?? 'Could not update designated lead. Please try again.'
            )
            return
          }
          setAssignError('')
          setRosterCellError(null)
          router.refresh()
          setAssigning(false)
          return
        }

        if (existingLead && existingLead.userId !== userId) {
          const { data: inserted, error: insertError } = await assignCoverageShiftViaApi({
            cycleId: activeCycleId,
            userId,
            isoDate: targetDay.isoDate,
            shiftType,
            role: 'staff',
          })

          if (insertError || !inserted) {
            console.error('Assign failed:', insertError)
            const message =
              insertError?.code === '23505'
                ? `${selectedTherapist?.full_name ?? 'This therapist'} is already assigned on this day.`
                : insertError?.message ?? 'Could not assign therapist. Please try again.'
            failAssign(message)
            return
          }

          setAssignError('')
          setRosterCellError(null)
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
          setDays((current) =>
            current.map((day) => {
              if (day.id !== targetDay.id) return day
              return {
                ...day,
                staffShifts: [...day.staffShifts, nextShift].sort((a, b) =>
                  a.name.localeCompare(b.name)
                ),
              }
            })
          )
          setAssigning(false)
          return
        }
      }

      const { data: inserted, error: insertError } = await assignCoverageShiftViaApi({
        cycleId: activeCycleId,
        userId,
        isoDate: targetDay.isoDate,
        shiftType,
        role,
      })

      if (insertError || !inserted) {
        console.error('Assign failed:', insertError)
        const message =
          insertError?.code === '23505'
            ? `${selectedTherapist?.full_name ?? 'This therapist'} is already assigned on this day.`
            : insertError?.message ?? 'Could not assign therapist. Please try again.'
        failAssign(message)
        return
      }

      setAssignError('')
      setRosterCellError(null)
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
            if (day.id !== targetDay.id) return day
            return { ...day, leadShift: nextShift, dayStatus: 'published' as DayStatus }
          })
        )
      } else {
        setDays((current) =>
          current.map((day) => {
            if (day.id !== targetDay.id) return day
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
    [activeCycleId, allTherapists, days, router, setDays, shiftTab]
  )

  const handleAssignTherapist = useCallback(
    async (userId: string, role: 'lead' | 'staff') => {
      if (!selectedDay) return
      await assignTherapistToDay(selectedDay.id, userId, role)
    },
    [assignTherapistToDay, selectedDay]
  )

  const handleRosterOpenEditor = useCallback(
    (dayId: string) => {
      handleSelect(dayId)
    },
    [handleSelect]
  )

  const handleRosterQuickAssign = useCallback(
    (date: string, memberId: string, role: 'lead' | 'staff') => {
      void assignTherapistToDay(date, memberId, role, { inline: true })
    },
    [assignTherapistToDay]
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

      const updated = await updateCoverageAssignmentStatus({
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

      if (updated) {
        syncOperationalCodeState(targetShift.id, nextStatus)
      }
    },
    [canUpdateAssignmentStatus, days, setDays, shiftTab, supabase, syncOperationalCodeState]
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
    [activeCycleId, days, setDays, unassigningShiftId]
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print">
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

        <header className="border-b border-border/70 bg-card/80 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-[1.35rem] font-semibold tracking-tight text-foreground">
                  Schedule
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                    workspaceStatusTone === 'success' &&
                      'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
                    workspaceStatusTone === 'warning' &&
                      'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
                    workspaceStatusTone === 'neutral' &&
                      'border-border/70 bg-background text-muted-foreground'
                  )}
                >
                  {workspaceStatusLabel}
                </Badge>
                {preliminaryLive && !activeCyclePublished ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]"
                  >
                    Preliminary live
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm font-medium text-foreground/85">{cycleRangeLabel}</p>
              <div className="text-xs text-muted-foreground">
                {noCycleSelected ? (
                  canManageCoverage
                    ? 'No open 6-week block — create a new draft block to start staffing.'
                    : 'No published schedule is available right now.'
                ) : showEmptyDraftState ? (
                  canManageCoverage
                    ? 'No staffing drafted yet. Auto-draft or open a day to assign the first shifts.'
                    : 'No staffing published yet.'
                ) : canManageCoverage ? (
                  'Compact planning workspace for staffing, lead coverage, and publish readiness.'
                ) : canUpdateAssignmentStatus ? (
                  'View staffing and assignment status — click a therapist token to update status.'
                ) : (
                  'View staffing and assignment status.'
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManageCoverage ? (
                noCycleSelected ? (
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
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link href="/publish">Publish history</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant={showEmptyDraftState ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={!canRunAutoDraft}
                      onClick={() => setPreFlightDialogOpen(true)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Auto-draft
                    </Button>
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
                          variant={showEmptyDraftState ? 'outline' : 'default'}
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={!canPublishCycle}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Publish
                        </Button>
                      </form>
                    )}
                    <MoreActionsMenu triggerClassName="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:bg-secondary">
                      <form action={sendPreliminaryScheduleAction}>
                        <input type="hidden" name="cycle_id" value={activeCycleId ?? ''} />
                        <input type="hidden" name="view" value="week" />
                        <input type="hidden" name="show_unavailable" value="false" />
                        <input type="hidden" name="return_to" value="coverage" />
                        <button
                          type="submit"
                          disabled={!canSendPreliminary}
                          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {preliminaryLive ? 'Refresh preliminary' : 'Send preliminary'}
                        </button>
                      </form>
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
                      {activeCyclePublished && activeCycleId ? (
                        <button
                          type="button"
                          onClick={() => setSaveAsTemplateDialogOpen(true)}
                          className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                        >
                          Save as template
                        </button>
                      ) : null}
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
                )
              ) : !noCycleSelected ? (
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
              ) : null}
            </div>
          </div>
        </header>
      </div>

      <div className="no-print px-5 py-4">
        <div className="space-y-4">
          {!noCycleSelected ? (
            <section className="rounded-xl border border-border/70 bg-card/70 px-3 py-2.5">
              <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Cycle
                    </p>
                    <span className="text-[10px] text-muted-foreground">Switch block</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {availableCycles.map((cycle) => {
                      const isActive = cycle.id === activeCycleId
                      const rangeLabel = formatHumanCycleRange(cycle.start_date, cycle.end_date)
                      return (
                        <Link
                          key={cycle.id}
                          href={`/coverage?cycle=${cycle.id}&view=${viewMode}&${COVERAGE_SHIFT_QUERY_KEY}=${shiftTabToQueryValue(shiftTab)}`}
                          title={cycle.label}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                            isActive
                              ? 'border-primary bg-primary/12 font-semibold text-foreground ring-1 ring-primary/20'
                              : 'border-border/70 bg-background font-medium text-muted-foreground hover:bg-muted/35 hover:text-foreground'
                          )}
                        >
                          <span>{rangeLabel}</span>
                          {cycle.published && !isActive ? (
                            <span className="ml-1 text-[10px] text-muted-foreground">• Live</span>
                          ) : null}
                        </Link>
                      )
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <CoverageSegmentedControl
                    label="Layout"
                    value={renderedViewMode}
                    options={VIEW_OPTIONS}
                    onChange={handleViewModeChange}
                  />
                  <CoverageSegmentedControl
                    label="Shift"
                    value={shiftTab}
                    options={[
                      { value: 'Day', label: 'Day shift' },
                      { value: 'Night', label: 'Night shift' },
                    ]}
                    onChange={handleTabSwitch}
                    testIdPrefix="coverage-shift-tab"
                  />
                </div>
              </div>
            </section>
          ) : null}

          {!noCycleSelected ? (
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <CoverageMetric
                label="Active staff"
                value={String(rosterMembers.length)}
                detail={`${shiftTab.toLowerCase()} shift roster`}
              />
              <CoverageMetric
                label="Priority gaps"
                value={String(coverageSummary.priorityGapDays)}
                detail="critical days"
                tone={coverageSummary.priorityGapDays > 0 ? 'critical' : 'success'}
              />
              <CoverageMetric
                label="Days missing lead"
                value={String(issueCount)}
                detail="lead coverage"
                tone={issueCount > 0 ? 'warning' : 'success'}
              />
              <CoverageMetric
                label="Unassigned days"
                value={String(coverageSummary.unassignedDays)}
                detail={`${coverageSummary.staffedDays} fully staffed`}
                tone={coverageSummary.unassignedDays > 0 ? 'warning' : 'neutral'}
              />
            </section>
          ) : null}

          <div className="space-y-2">
            {!noCycleSelected ? (
              proactiveCoverageRisk && canManageCoverage && !activeCyclePublished ? (
                <CoverageSurfaceBanner
                  tone={proactiveCoverageRisk.tone}
                  title={proactiveCoverageRisk.title}
                  description={proactiveCoverageRisk.description}
                  actions={
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPreFlightDialogOpen(true)}
                    >
                      Review pre-flight
                    </Button>
                  }
                />
              ) : null
            ) : null}
            {!noCycleSelected ? (
              <CoverageSurfaceBanner
                tone={workspaceStatusTone}
                title="Next step"
                description={nextActionLabel}
                actions={
                  planningNotices.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPlanningDetails((current) => !current)}
                    >
                      {showPlanningDetails ? 'Hide details' : `Show details (${planningNotices.length})`}
                    </Button>
                  ) : undefined
                }
              />
            ) : null}
            {activeCyclePublished ? (
              <>
                <CoverageSurfaceBanner
                  tone="success"
                  title="Live schedule"
                  description="Staff see operational status updates as you save. Operational updates visible to everyone: on-call, leave early, cancelled, and call-in."
                  actions={
                    <Link
                      href={weekRosterHref}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[var(--success-text)] underline-offset-2 transition-colors hover:underline"
                    >
                      View published schedule
                      <ChevronRight className="h-3.5 w-3.5 opacity-90" aria-hidden />
                    </Link>
                  }
                />
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Operational updates visible to everyone:
                  </span>
                  <StatusPill status="oncall" />
                  <StatusPill status="leave_early" />
                  <StatusPill status="cancelled" />
                  <StatusPill status="call_in" />
                </div>
              </>
            ) : null}

            {showPlanningDetails && planningNotices.length > 0 ? (
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <ul className="space-y-1 text-xs text-foreground/85">
                  {planningNotices.map((notice) => (
                    <li key={notice} className="leading-5">
                      {notice}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {canManageCoverage && publishOverrideConfig && !activeCyclePublished ? (
              <CoverageSurfaceBanner
                tone="warning"
                title="Override publish block"
                description={publishOverrideConfig.description}
                actions={
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
                }
              />
            ) : null}
            {preliminaryLive && !activeCyclePublished ? (
              <CoverageSurfaceBanner
                tone="neutral"
                title={`Preliminary schedule is live${preliminarySentLabel ? ` as of ${preliminarySentLabel}` : ''}.`}
                description="Therapists can review tentative shifts, claim open help-needed slots, and send change requests while you keep approval control."
              />
            ) : null}
          </div>

          {noCycleSelected ? (
            <CoverageSurfaceBanner
              title={canManageCoverage ? 'Ready to build your first cycle' : 'No schedule available yet'}
              description={
                canManageCoverage
                  ? '6-week cycles are your scheduling windows. Create one to open the planning surface and start staffing.'
                  : 'A manager has not created a schedule block yet. Check back after the next cycle is set up.'
              }
              actions={
                canManageCoverage ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setCycleDialogOpen(true)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      New 6-week block
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/publish">Publish history</Link>
                    </Button>
                  </>
                ) : undefined
              }
            />
          ) : showEmptyDraftState ? (
            <CoverageSurfaceBanner
              tone="warning"
              title={canManageCoverage ? 'No shifts assigned yet' : 'No staffing published yet'}
              description={
                canManageCoverage
                  ? renderedViewMode === 'roster'
                    ? 'No shifts assigned yet. Run Auto-draft or open the first day to assign.'
                    : 'No shifts assigned yet. Run Auto-draft or click a day to assign manually.'
                  : 'This schedule block exists, but no staffing has been published yet.'
              }
              actions={
                canManageCoverage ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={!canRunAutoDraft}
                      onClick={() => setPreFlightDialogOpen(true)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Auto-draft
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        const first = days[0]
                        if (first) handleSelect(first.id)
                      }}
                    >
                      {renderedViewMode === 'roster' ? 'Open first day' : 'Assign manually'}
                    </Button>
                    {activeCycleId && printCycle ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          setTemplateTarget({
                            cycleId: activeCycleId,
                            startDate: printCycle.start_date,
                          })
                        }
                      >
                        Start from template
                      </Button>
                    ) : null}
                  </>
                ) : undefined
              }
            />
          ) : null}

          {!noCycleSelected ? (
            <section className="rounded-2xl border border-border/70 bg-card/70 p-3 md:p-4">
              {renderedViewMode === 'roster' ? (
                <RosterScheduleView
                  title={`Respiratory Therapy ${shiftTab} Shift`}
                  cycleLabel={hasSchedulingContent ? cycleRangeLabel : null}
                  cycleDates={printCycleDates}
                  members={rosterMembers}
                  days={days}
                  canManageCoverage={canManageCoverage}
                  canUpdateAssignmentStatus={canUpdateAssignmentStatus && !canManageCoverage}
                  selectedDayId={deferredSelectedId}
                  cellError={rosterCellError}
                  onOpenEditor={handleRosterOpenEditor}
                  onQuickAssign={handleRosterQuickAssign}
                  onChangeStatus={handleChangeStatus}
                />
              ) : (
                <CalendarGrid
                  days={days}
                  loading={loading}
                  selectedId={selectedId}
                  weekOffset={weekOffset}
                  schedulingViewOnly={!canManageCoverage}
                  allowAssignmentStatusEdits={canUpdateAssignmentStatus}
                  onSwipeLeft={() => setWeekOffset((w) => Math.min(w + 1, totalWeeks - 1))}
                  onSwipeRight={() => setWeekOffset((w) => Math.max(w - 1, 0))}
                  onSelect={handleSelect}
                  onChangeStatus={handleChangeStatus}
                />
              )}
            </section>
          ) : null}
        </div>
      </div>

      {selectedDay ? (
        <ShiftEditorDialog
          open
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
      ) : null}
      {preFlightDialogOpen ? (
        <PreFlightDialog
          open
          onClose={() => setPreFlightDialogOpen(false)}
          cycleId={activeCycleId ?? ''}
          onConfirm={() => autoDraftFormRef.current?.requestSubmit()}
        />
      ) : null}
      {clearDraftDialogOpen ? (
        <ClearDraftConfirmDialog
          open
          onOpenChange={setClearDraftDialogOpen}
          applyFormRef={clearDraftFormRef}
          cycleId={activeCycleId ?? ''}
          cycleLabel={printCycle?.label ?? null}
          isPublished={activeCyclePublished}
        />
      ) : null}
      {saveAsTemplateDialogOpen && activeCycleId ? (
        <SaveAsTemplateDialog
          open
          onClose={() => setSaveAsTemplateDialogOpen(false)}
          cycleId={activeCycleId}
        />
      ) : null}
      {templateTarget ? (
        <StartFromTemplateDialog
          open
          onClose={() => setTemplateTarget(null)}
          newCycleId={templateTarget.cycleId}
          newCycleStartDate={templateTarget.startDate}
          applyTemplateAction={applyTemplateAction}
        />
      ) : null}
      {cycleDialogOpen ? (
        <CycleManagementDialog
          key={`cycle-dialog-${cycleDialogOpen ? 'open' : 'closed'}-${availableCycles[0]?.end_date ?? 'none'}`}
          cycles={availableCycles}
          open
          onOpenChange={setCycleDialogOpen}
          createCycleAction={createCycleAction}
          deleteCycleAction={deleteCycleAction}
          onStartFromTemplate={(cycleId, startDate) =>
            setTemplateTarget({ cycleId, startDate })
          }
        />
      ) : null}
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
