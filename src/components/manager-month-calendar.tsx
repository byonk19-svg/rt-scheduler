'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { DragEvent, TouchEvent } from 'react'
import { useRouter } from 'next/navigation'

import { CalendarToolbar } from '@/components/CalendarToolbar'
import { FeedbackToast } from '@/components/feedback-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { summarizeCalendarCell } from '@/lib/calendar-cell'
import { buildTherapistWorkloadCounts, getWeekBoundsForDate } from '@/lib/therapist-picker-metrics'
import { formatEligibilityReason, resolveEligibility } from '@/lib/coverage/resolve-availability'
import type { AvailabilityOverrideRow } from '@/lib/coverage/types'
import { normalizeWorkPattern } from '@/lib/coverage/work-patterns'
import { cn } from '@/lib/utils'
import { MIN_SHIFT_COVERAGE_PER_DAY, MAX_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import {
  dateFromKey,
  toIsoDate as keyFromDate,
  addDays,
  startOfWeek,
  buildCalendarWeeks,
} from '@/lib/calendar-utils'

type Therapist = {
  id: string
  full_name: string
  email?: string | null
  shift_type: 'day' | 'night'
  employment_type?: 'full_time' | 'part_time' | 'prn'
  is_lead_eligible?: boolean
  works_dow: number[]
  offs_dow: number[]
  weekend_rotation: 'none' | 'every_other'
  weekend_anchor_date: string | null
  works_dow_mode: 'hard' | 'soft'
  shift_preference?: 'day' | 'night' | 'either' | null
  on_fmla: boolean
  is_active: boolean
}

const WEEKLY_LIMIT = 3

type Shift = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  unfilled_reason: string | null
  assignment_status: 'scheduled' | 'call_in' | 'cancelled' | 'on_call' | 'left_early'
  status_note: string | null
  left_early_time: string | null
  status_updated_at: string | null
  status_updated_by: string | null
  status_updated_by_name: string | null
  availability_override: boolean
  availability_override_reason: string | null
  availability_override_at: string | null
  availability_override_by: string | null
  availability_override_by_name: string | null
  role: 'lead' | 'staff'
  user_id: string
  full_name: string
  isLeadEligible: boolean
}

type DragPayload =
  | { type: 'therapist'; userId: string; shiftType: 'day' | 'night' }
  | { type: 'shift'; shiftId: string; shiftType: 'day' | 'night' }

type DragActionBody =
  | {
      action: 'assign'
      cycleId: string
      userId: string
      shiftType: 'day' | 'night'
      date: string
      overrideWeeklyRules: boolean
      availabilityOverride?: boolean
      availabilityOverrideReason?: string
    }
  | {
      action: 'move'
      cycleId: string
      shiftId: string
      targetDate: string
      targetShiftType: 'day' | 'night'
      overrideWeeklyRules: boolean
      availabilityOverride?: boolean
      availabilityOverrideReason?: string
    }
  | {
      action: 'remove'
      cycleId: string
      shiftId: string
    }
  | {
      action: 'remove'
      cycleId: string
      userId: string
      date: string
      shiftType: 'day' | 'night'
    }

type SetLeadActionBody = {
  action: 'set_lead'
  cycleId: string
  therapistId: string
  date: string
  shiftType: 'day' | 'night'
  overrideWeeklyRules: boolean
  availabilityOverride?: boolean
  availabilityOverrideReason?: string
}

type DragActionResponse = {
  message?: string
  error?: string
  code?: string
  availability?: {
    therapistId: string
    therapistName: string
    date: string
    shiftType: 'day' | 'night'
    reason: string | null
  }
  undoAction?: DragActionBody
}

type AssignmentStatusResponse = {
  assignment?: {
    id: string
    assignment_status: AssignmentStatus
    status_note: string | null
    left_early_time: string | null
    status_updated_at: string | null
    status_updated_by: string | null
    status_updated_by_name: string | null
  }
  error?: string
}

type AssignmentStatus = 'scheduled' | 'call_in' | 'cancelled' | 'on_call' | 'left_early'

type StatusFilter = 'all' | 'any_non_scheduled' | 'call_in' | 'on_call' | 'cancelled' | 'left_early'

type AssignmentStatusSnapshot = {
  assignmentId: string
  status: AssignmentStatus
  note: string | null
  leftEarlyTime: string | null
}

type StatusLogEntry = {
  from: AssignmentStatus
  to: AssignmentStatus
  therapistName: string
  time: string
}

type StatusPopoverState = {
  assignmentId: string
  userId: string
  date: string
  shiftType: 'day' | 'night'
  therapistName: string
  anchorRect: DOMRect
  snapshot: AssignmentStatusSnapshot
}

type ManagerMonthCalendarProps = {
  cycleId: string
  startDate: string
  endDate: string
  therapists: Therapist[]
  availabilityOverrides: AvailabilityOverrideRow[]
  shifts: Shift[]
  issueFilter?:
    | 'all'
    | 'missing_lead'
    | 'under_coverage'
    | 'over_coverage'
    | 'ineligible_lead'
    | 'multiple_leads'
  focusSlotKey?: string | null
  issueReasonsBySlot?: Record<
    string,
    Array<
      'under_coverage' | 'over_coverage' | 'missing_lead' | 'multiple_leads' | 'ineligible_lead'
    >
  >
  constraintBlockedSlotKeys?: string[]
  defaultShiftType?: 'day' | 'night'
  canManageStaffing?: boolean
  canEditAssignmentStatus?: boolean
  canViewAvailabilityOverride?: boolean
}

function formatCellDate(value: string): string {
  const parsed = dateFromKey(value)
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRangeLabel(startDate: string, endDate: string): string {
  const start = dateFromKey(startDate)
  const end = dateFromKey(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} to ${endDate}`
  }
  const startLabel = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `Cycle range: ${startLabel} to ${endLabel}`
}


function assignmentStatusLabel(status: AssignmentStatus): string {
  if (status === 'call_in') return 'CI'
  if (status === 'cancelled') return 'CX'
  if (status === 'on_call') return 'OC'
  if (status === 'left_early') return 'LE'
  return 'Scheduled'
}

function assignmentStatusDescription(status: AssignmentStatus): string {
  if (status === 'call_in') return 'Call in'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'on_call') return 'On call'
  if (status === 'left_early') return 'Left early'
  return 'Scheduled'
}

function assignmentStatusTone(status: AssignmentStatus): string {
  if (status !== 'scheduled') return 'border-red-300 bg-red-50 text-red-800'
  return 'border-border bg-muted text-muted-foreground'
}

function formatStatusTimestamp(value: string | null): string {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatStatusPopoverHeader(
  date: string,
  shiftType: 'day' | 'night',
  therapistName: string
): string {
  const parsed = dateFromKey(date)
  if (Number.isNaN(parsed.getTime())) {
    return `${date} | ${shiftType === 'day' ? 'Day' : 'Night'} shift | ${therapistName}`
  }
  const dateLabel = parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${dateLabel} | ${shiftType === 'day' ? 'Day' : 'Night'} shift | ${therapistName}`
}

function toTimeInputValue(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 5)
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function firstName(name: string): string {
  return name.split(' ')[0] ?? name
}

function statusMatchesFilter(status: AssignmentStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'any_non_scheduled') return status !== 'scheduled'
  return status === filter
}

function getAvatarTone(status: AssignmentStatus): string {
  if (status === 'cancelled') return 'bg-red-500'
  if (status === 'on_call') return 'bg-orange-600'
  return 'bg-indigo-500'
}

function toStatusButtonLabel(status: AssignmentStatus): string {
  if (status === 'scheduled') return 'Active'
  if (status === 'on_call') return 'On Call'
  if (status === 'left_early') return 'Leave Early'
  return 'Cancelled'
}

function assignmentStatusTooltip(shift: Shift): string | null {
  if (shift.assignment_status === 'scheduled') return null
  const parts = [
    assignmentStatusDescription(shift.assignment_status),
    `Updated by ${shift.status_updated_by_name ?? 'Team member'} - ${formatStatusTimestamp(shift.status_updated_at)}`,
  ]
  if (shift.status_note) parts.push(shift.status_note)
  if (shift.assignment_status === 'left_early' && shift.left_early_time) {
    parts.push(`Left at ${toTimeInputValue(shift.left_early_time)}`)
  }
  return parts.join('\n')
}

function formatOverrideTimestamp(value: string | null): string {
  if (!value) return 'Unknown time'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ManagerMonthCalendar({
  cycleId,
  startDate,
  endDate,
  therapists,
  availabilityOverrides,
  shifts,
  issueFilter = 'all',
  focusSlotKey = null,
  issueReasonsBySlot = {},
  constraintBlockedSlotKeys = [],
  defaultShiftType = 'day',
  canManageStaffing = true,
  canEditAssignmentStatus = false,
  canViewAvailabilityOverride = false,
}: ManagerMonthCalendarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [undoAction, setUndoAction] = useState<DragActionBody | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [overrideWeeklyRules, setOverrideWeeklyRules] = useState(false)
  const [localShifts, setLocalShifts] = useState<Shift[]>(shifts)
  const [selectedShiftType, setSelectedShiftType] = useState<'day' | 'night'>(() => {
    const focusShiftType = focusSlotKey?.split(':')[1]
    if (focusShiftType === 'night') return 'night'
    return defaultShiftType
  })
  const [mobileWeekStart, setMobileWeekStart] = useState(() => {
    const focusedDate = focusSlotKey?.split(':')[0]
    const startKey =
      focusedDate && /^\d{4}-\d{2}-\d{2}$/.test(focusedDate) ? focusedDate : startDate
    return keyFromDate(startOfWeek(dateFromKey(startKey)))
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const focusedDate = focusSlotKey?.split(':')[0]
    if (focusedDate && /^\d{4}-\d{2}-\d{2}$/.test(focusedDate)) return focusedDate
    return startDate
  })
  const [staffingPoolOpen, setStaffingPoolOpen] = useState(false)
  const [drawerSlot, setDrawerSlot] = useState<{ date: string; shiftType: 'day' | 'night' } | null>(
    null
  )
  const [drawerAddTherapistId, setDrawerAddTherapistId] = useState('')
  const [drawerTherapistSearch, setDrawerTherapistSearch] = useState('')
  const [drawerLeadTherapistId, setDrawerLeadTherapistId] = useState('')
  const [availabilityConflictDialog, setAvailabilityConflictDialog] = useState<{
    therapistId: string
    therapistName: string
    date: string
    shiftType: 'day' | 'night'
    reason: string | null
    action: DragActionBody | SetLeadActionBody
  } | null>(null)
  const [availabilityOverrideReasonDraft, setAvailabilityOverrideReasonDraft] = useState('')
  const [statusPopover, setStatusPopover] = useState<StatusPopoverState | null>(null)
  const [statusDraft, setStatusDraft] = useState<{
    status: AssignmentStatus
    note: string
    leftEarlyTime: string
  } | null>(null)
  const [isStatusSaving, setIsStatusSaving] = useState(false)
  const [statusUndoSnapshot, setStatusUndoSnapshot] = useState<AssignmentStatusSnapshot | null>(
    null
  )
  const [toastState, setToastState] = useState<{
    id: number
    message: string
    variant: 'success' | 'error'
  } | null>(null)
  const [statusLogByShift, setStatusLogByShift] = useState<Record<string, StatusLogEntry[]>>({})
  const mobileTouchStartX = useRef<number | null>(null)
  const mobileTouchStartY = useRef<number | null>(null)
  const statusPopoverRef = useRef<HTMLDivElement | null>(null)
  const isStatusSavingRef = useRef(false)

  useEffect(() => {
    setLocalShifts(shifts)
  }, [shifts])

  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(startDate)
      return
    }

    if (selectedDate < startDate || selectedDate > endDate) {
      setSelectedDate(startDate)
    }
  }, [endDate, selectedDate, startDate])

  const rangeLabel = useMemo(() => formatRangeLabel(startDate, endDate), [startDate, endDate])
  const calendarWeeks = useMemo(() => buildCalendarWeeks(startDate, endDate), [startDate, endDate])
  const minMobileWeekStart = useMemo(() => startOfWeek(dateFromKey(startDate)), [startDate])
  const maxMobileWeekStart = useMemo(() => startOfWeek(dateFromKey(endDate)), [endDate])
  const mobileWeekDays = useMemo(() => {
    const base = dateFromKey(mobileWeekStart)
    return Array.from({ length: 7 }, (_, index) => addDays(base, index))
  }, [mobileWeekStart])
  const mobileWeekRangeLabel = useMemo(() => {
    const first = mobileWeekDays[0]
    const last = mobileWeekDays[6]
    if (!first || !last) return ''
    const firstLabel = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const lastLabel = last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${firstLabel} - ${lastLabel}`
  }, [mobileWeekDays])
  const statusPopoverPosition = useMemo(() => {
    if (!statusPopover) return null
    const width = 260
    const estimatedHeight = statusDraft?.status === 'left_early' ? 320 : 280
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight

    let left = statusPopover.anchorRect.left
    let top = statusPopover.anchorRect.bottom + 8

    if (viewportWidth > 0) {
      left = Math.max(8, Math.min(left, viewportWidth - width - 8))
    }
    if (viewportHeight > 0 && top + estimatedHeight > viewportHeight - 8) {
      top = Math.max(8, statusPopover.anchorRect.top - estimatedHeight - 8)
    }

    return { left, top, width }
  }, [statusPopover, statusDraft?.status])
  const constraintBlockedSlotKeySet = useMemo(
    () => new Set(constraintBlockedSlotKeys),
    [constraintBlockedSlotKeys]
  )

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const shift of localShifts) {
      const row = map.get(shift.date) ?? []
      row.push(shift)
      map.set(shift.date, row)
    }
    for (const row of map.values()) {
      row.sort((a, b) => {
        if (a.shift_type === b.shift_type) return a.full_name.localeCompare(b.full_name)
        return a.shift_type === 'day' ? -1 : 1
      })
    }
    return map
  }, [localShifts])

  const availabilityOverridesByTherapist = useMemo(() => {
    const map = new Map<string, AvailabilityOverrideRow[]>()
    for (const entry of availabilityOverrides) {
      const rows = map.get(entry.therapist_id) ?? []
      rows.push(entry)
      map.set(entry.therapist_id, rows)
    }
    return map
  }, [availabilityOverrides])
  const therapistById = useMemo(
    () => new Map(therapists.map((therapist) => [therapist.id, therapist])),
    [therapists]
  )

  const getTherapistAvailabilityState = useCallback(
    (
      therapistId: string,
      date: string,
      shiftType: 'day' | 'night'
    ): {
      blockedByConstraints: boolean
      unavailableReason: string | null
      forceOff: boolean
      forceOn: boolean
      inactiveOrFmla: boolean
      prnNotOffered: boolean
    } => {
      const therapist = therapistById.get(therapistId)
      if (!therapist) {
        return {
          blockedByConstraints: false,
          unavailableReason: null,
          forceOff: false,
          forceOn: false,
          inactiveOrFmla: false,
          prnNotOffered: false,
        }
      }

      const resolution = resolveEligibility({
        therapist: {
          id: therapistId,
          is_active: therapist.is_active,
          on_fmla: therapist.on_fmla,
          employment_type:
            therapist.employment_type === 'prn'
              ? 'prn'
              : therapist.employment_type === 'part_time'
                ? 'part_time'
                : 'full_time',
          pattern: normalizeWorkPattern({
            therapist_id: therapist.id,
            works_dow: therapist.works_dow,
            offs_dow: therapist.offs_dow,
            weekend_rotation: therapist.weekend_rotation,
            weekend_anchor_date: therapist.weekend_anchor_date,
            works_dow_mode: therapist.works_dow_mode,
            shift_preference: therapist.shift_preference,
          }),
        },
        cycleId,
        date,
        shiftType,
        overrides: availabilityOverridesByTherapist.get(therapistId) ?? [],
      })

      const reasonLabel = formatEligibilityReason(resolution.reason)

      return {
        blockedByConstraints: !resolution.allowed,
        unavailableReason: reasonLabel,
        forceOff: resolution.reason === 'override_force_off',
        forceOn: resolution.offeredByOverride,
        inactiveOrFmla: resolution.reason === 'inactive' || resolution.reason === 'on_fmla',
        prnNotOffered: resolution.prnNotOffered,
      }
    },
    [availabilityOverridesByTherapist, cycleId, therapistById]
  )

  const selectedDayShifts = useMemo(() => {
    if (!selectedDate) return []
    return (shiftsByDate.get(selectedDate) ?? [])
      .filter((shift) => shift.shift_type === selectedShiftType)
      .slice()
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === 'lead' ? -1 : 1
        return a.full_name.localeCompare(b.full_name)
      })
  }, [selectedDate, selectedShiftType, shiftsByDate])

  const selectedLeadShift = useMemo(
    () => selectedDayShifts.find((shift) => shift.role === 'lead') ?? null,
    [selectedDayShifts]
  )

  const selectedStaffShifts = useMemo(
    () => selectedDayShifts.filter((shift) => shift.role !== 'lead'),
    [selectedDayShifts]
  )

  const selectedCounts = useMemo(() => {
    return {
      active: selectedDayShifts.filter((shift) => shift.assignment_status !== 'cancelled').length,
      onCall: selectedDayShifts.filter((shift) => shift.assignment_status === 'on_call').length,
      leaveEarly: selectedDayShifts.filter((shift) => shift.assignment_status === 'left_early')
        .length,
      cancelled: selectedDayShifts.filter((shift) => shift.assignment_status === 'cancelled')
        .length,
    }
  }, [selectedDayShifts])

  const selectedDayLogs = useMemo(() => {
    return selectedDayShifts
      .flatMap((shift) =>
        (statusLogByShift[shift.id] ?? []).map((entry, index) => ({
          ...entry,
          key: `${shift.id}-${index}`,
        }))
      )
      .slice(-12)
  }, [selectedDayShifts, statusLogByShift])

  const dayTherapists = useMemo(
    () => therapists.filter((therapist) => therapist.shift_type === 'day'),
    [therapists]
  )
  const nightTherapists = useMemo(
    () => therapists.filter((therapist) => therapist.shift_type === 'night'),
    [therapists]
  )
  const therapistsForPool = selectedShiftType === 'day' ? dayTherapists : nightTherapists
  const therapistsForPoolWithAvailability = useMemo(() => {
    if (!selectedDate) {
      return therapistsForPool.map((therapist) => ({
        therapist,
        blockedByConstraints: false,
        unavailableReason: null as string | null,
        forceOff: false,
        forceOn: false,
        inactiveOrFmla: false,
        prnNotOffered: false,
      }))
    }
    return therapistsForPool.map((therapist) => ({
      therapist,
      ...getTherapistAvailabilityState(therapist.id, selectedDate, selectedShiftType),
    }))
  }, [getTherapistAvailabilityState, selectedDate, selectedShiftType, therapistsForPool])

  const drawerShifts = useMemo(() => {
    if (!drawerSlot) return []
    return (shiftsByDate.get(drawerSlot.date) ?? [])
      .filter((shift) => shift.shift_type === drawerSlot.shiftType)
      .slice()
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === 'lead' ? -1 : 1
        return a.full_name.localeCompare(b.full_name)
      })
  }, [drawerSlot, shiftsByDate])

  const drawerCoverageCount = useMemo(
    () =>
      drawerShifts.filter((shift) => shift.status === 'scheduled' || shift.status === 'on_call')
        .length,
    [drawerShifts]
  )
  const drawerLeadCount = useMemo(
    () => drawerShifts.filter((shift) => shift.role === 'lead').length,
    [drawerShifts]
  )
  const drawerMissingLead = drawerLeadCount === 0
  const drawerUnderCoverage = drawerCoverageCount < MIN_SHIFT_COVERAGE_PER_DAY
  const drawerOverCoverage = drawerCoverageCount > MAX_SHIFT_COVERAGE_PER_DAY

  const drawerAssignedOnDate = useMemo(() => {
    if (!drawerSlot) return new Set<string>()
    return new Set((shiftsByDate.get(drawerSlot.date) ?? []).map((shift) => shift.user_id))
  }, [drawerSlot, shiftsByDate])

  const drawerStaffAddOptions = useMemo(() => {
    if (!drawerSlot) return []
    const currentShiftIds = new Set(drawerShifts.map((shift) => shift.user_id))
    return therapists
      .filter(
        (therapist) =>
          therapist.shift_type === drawerSlot.shiftType &&
          !currentShiftIds.has(therapist.id) &&
          !drawerAssignedOnDate.has(therapist.id)
      )
      .map((therapist) => ({
        therapist,
        ...getTherapistAvailabilityState(therapist.id, drawerSlot.date, drawerSlot.shiftType),
      }))
      .sort((a, b) => a.therapist.full_name.localeCompare(b.therapist.full_name))
  }, [drawerAssignedOnDate, drawerShifts, drawerSlot, getTherapistAvailabilityState, therapists])

  const drawerWeekBounds = useMemo(() => {
    if (!drawerSlot) return null
    return getWeekBoundsForDate(drawerSlot.date)
  }, [drawerSlot])

  const workloadCountsByTherapist = useMemo(() => {
    if (!drawerSlot || !drawerWeekBounds)
      return new Map<string, { weekShiftCount: number; cycleShiftCount: number }>()
    return buildTherapistWorkloadCounts({
      shifts: localShifts.map((shift) => ({
        userId: shift.user_id,
        date: shift.date,
        status: shift.status,
      })),
      weekStart: drawerWeekBounds.weekStart,
      weekEnd: drawerWeekBounds.weekEnd,
      cycleStart: startDate,
      cycleEnd: endDate,
    })
  }, [drawerSlot, drawerWeekBounds, endDate, localShifts, startDate])

  const drawerSmartStaffOptions = useMemo(() => {
    return drawerStaffAddOptions
      .map((option) => {
        const workload = workloadCountsByTherapist.get(option.therapist.id) ?? {
          weekShiftCount: 0,
          cycleShiftCount: 0,
        }
        const atWeeklyLimit = workload.weekShiftCount >= WEEKLY_LIMIT
        const disabledForEligibility = option.prnNotOffered
        const disabledForWeeklyLimit = atWeeklyLimit && !overrideWeeklyRules
        return {
          ...option,
          ...workload,
          atWeeklyLimit,
          disabledForEligibility,
          disabledForWeeklyLimit,
          disabled: disabledForEligibility || disabledForWeeklyLimit,
        }
      })
      .sort(
        (a, b) =>
          a.weekShiftCount - b.weekShiftCount ||
          a.cycleShiftCount - b.cycleShiftCount ||
          a.therapist.full_name.localeCompare(b.therapist.full_name)
      )
  }, [drawerStaffAddOptions, overrideWeeklyRules, workloadCountsByTherapist])

  const drawerVisibleStaffOptions = useMemo(() => {
    const query = drawerTherapistSearch.trim().toLowerCase()
    if (!query) return drawerSmartStaffOptions
    return drawerSmartStaffOptions.filter((option) => {
      const haystack = `${option.therapist.full_name} ${option.therapist.email ?? ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [drawerSmartStaffOptions, drawerTherapistSearch])

  const drawerLeadOptions = useMemo(() => {
    if (!drawerSlot) return []
    const currentShiftIds = new Set(drawerShifts.map((shift) => shift.user_id))
    return therapists
      .filter((therapist) => {
        const leadEligible = Boolean(therapist.is_lead_eligible)
        const sameShiftTeam = therapist.shift_type === drawerSlot.shiftType
        const alreadyInShift = currentShiftIds.has(therapist.id)
        const availableOnDate = !drawerAssignedOnDate.has(therapist.id)
        return leadEligible && sameShiftTeam && (alreadyInShift || availableOnDate)
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [drawerSlot, drawerShifts, therapists, drawerAssignedOnDate])

  useEffect(() => {
    if (!focusSlotKey) return
    const [focusDate, focusShiftType] = focusSlotKey.split(':')
    const targetId = `slot-card-${focusDate}-${focusShiftType}`
    const element = document.getElementById(targetId)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.classList.add('ring-2', 'ring-primary')
    const timer = window.setTimeout(() => {
      element.classList.remove('ring-2', 'ring-primary')
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [focusSlotKey])

  useEffect(() => {
    if (!statusPopover) return

    function onPointerDown(event: MouseEvent) {
      if (!statusPopoverRef.current) return
      if (statusPopoverRef.current.contains(event.target as Node)) return
      setStatusPopover(null)
      setStatusDraft(null)
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setStatusPopover(null)
      setStatusDraft(null)
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [statusPopover])

  function openShiftDrawer(date: string, shiftType: 'day' | 'night') {
    const slotShifts = (shiftsByDate.get(date) ?? []).filter(
      (shift) => shift.shift_type === shiftType
    )
    const currentLead = slotShifts.find((shift) => shift.role === 'lead')
    setDrawerSlot({ date, shiftType })
    setDrawerLeadTherapistId(currentLead?.user_id ?? '')
    setDrawerAddTherapistId('')
    setDrawerTherapistSearch('')
  }

  function onCalendarCellClick(date: string, shiftType: 'day' | 'night') {
    setSelectedDate(date)
    if (shiftType !== selectedShiftType) {
      setSelectedShiftType(shiftType)
    }
  }

  function closeShiftDrawer() {
    setDrawerSlot(null)
    setDrawerAddTherapistId('')
    setDrawerTherapistSearch('')
    setDrawerLeadTherapistId('')
    closeAvailabilityConflictDialog()
    closeStatusPopover()
  }

  function setDragData(event: DragEvent<HTMLElement>, payload: DragPayload) {
    event.dataTransfer.setData('application/json', JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
  }

  function readDragPayload(event: DragEvent<HTMLElement>): DragPayload | null {
    const raw = event.dataTransfer.getData('application/json')
    if (!raw) return null
    let payload: DragPayload
    try {
      payload = JSON.parse(raw) as DragPayload
    } catch {
      setError('Could not read drag data. Please try again.')
      return null
    }
    return payload
  }

  function runDragAction(body: DragActionBody, options?: { isUndo?: boolean }) {
    setError('')
    setSuccess('')
    setStatusUndoSnapshot(null)
    setUndoAction(null)
    startTransition(() => {
      void (async () => {
        const response = await fetch('/api/schedule/drag-drop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const result = (await response.json().catch(() => null)) as DragActionResponse | null

        if (!response.ok) {
          if (result?.code === 'availability_conflict' && result.availability) {
            setAvailabilityConflictDialog({
              therapistId: result.availability.therapistId,
              therapistName: result.availability.therapistName,
              date: result.availability.date,
              shiftType: result.availability.shiftType,
              reason: result.availability.reason,
              action: body,
            })
            setAvailabilityOverrideReasonDraft(
              'availabilityOverrideReason' in body &&
                typeof body.availabilityOverrideReason === 'string'
                ? body.availabilityOverrideReason
                : ''
            )
            return
          }
          setError(result?.error ?? 'Could not update schedule. Please try again.')
          return
        }

        if (body.action === 'assign') {
          const assignedTherapist = therapistById.get(body.userId)
          setLocalShifts((current) => {
            const exists = current.some(
              (shift) =>
                shift.user_id === body.userId &&
                shift.date === body.date &&
                shift.shift_type === body.shiftType
            )
            if (exists) return current

            const optimisticShift: Shift = {
              id: `optimistic-${body.userId}-${body.date}-${body.shiftType}`,
              date: body.date,
              shift_type: body.shiftType,
              status: 'scheduled',
              unfilled_reason: null,
              assignment_status: 'scheduled',
              status_note: null,
              left_early_time: null,
              status_updated_at: null,
              status_updated_by: null,
              status_updated_by_name: null,
              availability_override: false,
              availability_override_reason: null,
              availability_override_at: null,
              availability_override_by: null,
              availability_override_by_name: null,
              role: 'staff',
              user_id: body.userId,
              full_name: assignedTherapist?.full_name ?? 'Therapist',
              isLeadEligible: Boolean(assignedTherapist?.is_lead_eligible),
            }

            return [...current, optimisticShift]
          })
        }

        setSuccess(result?.message ?? (options?.isUndo ? 'Undo complete.' : 'Schedule updated.'))
        setUndoAction(options?.isUndo ? null : (result?.undoAction ?? null))
        router.refresh()
      })()
    })
  }

  function runSetLeadAction(body: SetLeadActionBody) {
    setError('')
    setSuccess('')
    setStatusUndoSnapshot(null)
    startTransition(() => {
      void (async () => {
        const response = await fetch('/api/schedule/drag-drop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const result = (await response.json().catch(() => null)) as DragActionResponse | null

        if (!response.ok) {
          if (result?.code === 'availability_conflict' && result.availability) {
            setAvailabilityConflictDialog({
              therapistId: result.availability.therapistId,
              therapistName: result.availability.therapistName,
              date: result.availability.date,
              shiftType: result.availability.shiftType,
              reason: result.availability.reason,
              action: body,
            })
            setAvailabilityOverrideReasonDraft(
              typeof body.availabilityOverrideReason === 'string'
                ? body.availabilityOverrideReason
                : ''
            )
            return
          }
          setError(result?.error ?? 'Could not update designated lead.')
          return
        }

        setSuccess(result?.message ?? 'Designated lead updated.')
        router.refresh()
      })()
    })
  }

  function closeAvailabilityConflictDialog() {
    setAvailabilityConflictDialog(null)
    setAvailabilityOverrideReasonDraft('')
  }

  function confirmAvailabilityOverride() {
    if (!availabilityConflictDialog) return
    const normalizedReason = availabilityOverrideReasonDraft.trim()
    const actionWithOverride = {
      ...availabilityConflictDialog.action,
      availabilityOverride: true,
      availabilityOverrideReason: normalizedReason || undefined,
    }

    closeAvailabilityConflictDialog()
    if (actionWithOverride.action === 'set_lead') {
      runSetLeadAction(actionWithOverride as SetLeadActionBody)
      return
    }

    runDragAction(actionWithOverride as DragActionBody)
  }

  function runActionWithAvailabilityCheck(action: DragActionBody | SetLeadActionBody) {
    if (action.action === 'remove') {
      runDragAction(action)
      return
    }

    let therapistId = ''
    let date = ''
    let shiftType: 'day' | 'night' = 'day'

    if (action.action === 'assign') {
      therapistId = action.userId
      date = action.date
      shiftType = action.shiftType
    } else if (action.action === 'set_lead') {
      therapistId = action.therapistId
      date = action.date
      shiftType = action.shiftType
    } else if (action.action === 'move') {
      const shift = localShifts.find((row) => row.id === action.shiftId)
      if (!shift) {
        runDragAction(action)
        return
      }
      therapistId = shift.user_id
      date = action.targetDate
      shiftType = action.targetShiftType
    }

    const therapist = therapistById.get(therapistId)
    const availabilityState = getTherapistAvailabilityState(therapistId, date, shiftType)
    if (availabilityState.inactiveOrFmla || availabilityState.prnNotOffered) {
      setError(availabilityState.unavailableReason ?? 'This therapist cannot be assigned.')
      return
    }
    if (availabilityState.blockedByConstraints) {
      setAvailabilityConflictDialog({
        therapistId,
        therapistName: therapist?.full_name ?? 'Therapist',
        date,
        shiftType,
        reason: availabilityState.unavailableReason,
        action,
      })
      setAvailabilityOverrideReasonDraft('')
      return
    }

    if (action.action === 'set_lead') {
      runSetLeadAction(action)
      return
    }

    runDragAction(action)
  }

  function openStatusPopoverForShift(shift: Shift, anchor: HTMLElement) {
    if (!canEditAssignmentStatus) return

    const snapshot: AssignmentStatusSnapshot = {
      assignmentId: shift.id,
      status: shift.assignment_status,
      note: shift.status_note,
      leftEarlyTime: toTimeInputValue(shift.left_early_time),
    }

    setStatusPopover({
      assignmentId: shift.id,
      userId: shift.user_id,
      date: shift.date,
      shiftType: shift.shift_type,
      therapistName: shift.full_name,
      anchorRect: anchor.getBoundingClientRect(),
      snapshot,
    })
    setStatusDraft({
      status: shift.assignment_status,
      note: shift.status_note ?? '',
      leftEarlyTime: toTimeInputValue(shift.left_early_time),
    })
  }

  function closeStatusPopover() {
    setStatusPopover(null)
    setStatusDraft(null)
  }

  function runAssignmentStatusUpdate(
    assignmentId: string,
    payload: { status: AssignmentStatus; note: string; leftEarlyTime: string },
    options?: {
      previous?: AssignmentStatusSnapshot | null
      closePopover?: boolean
      isUndo?: boolean
    }
  ) {
    if (isStatusSavingRef.current) return
    setError('')
    setSuccess('')
    setUndoAction(null)

    const previousShift = localShifts.find((shift) => shift.id === assignmentId) ?? null
    const optimisticStatusNote = payload.note.trim() || null
    const optimisticLeftEarlyTime =
      payload.status === 'left_early' ? payload.leftEarlyTime || null : null

    if (previousShift) {
      setLocalShifts((current) =>
        current.map((shift) =>
          shift.id === assignmentId
            ? {
                ...shift,
                assignment_status: payload.status,
                status_note: optimisticStatusNote,
                left_early_time: optimisticLeftEarlyTime,
                status_updated_at: new Date().toISOString(),
              }
            : shift
        )
      )
    }

    isStatusSavingRef.current = true
    setIsStatusSaving(true)
    startTransition(() => {
      void (async () => {
        try {
          let response: Response
          try {
            response = await fetch('/api/schedule/assignment-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                assignmentId,
                status: payload.status,
                note: payload.note.trim() || null,
                leftEarlyTime:
                  payload.status === 'left_early' ? payload.leftEarlyTime || null : null,
              }),
            })
          } catch {
            if (previousShift) {
              setLocalShifts((current) =>
                current.map((shift) => (shift.id === assignmentId ? previousShift : shift))
              )
            }
            setError('Network error while updating assignment status. Please try again.')
            setToastState({
              id: Date.now(),
              message: 'Could not save status change. Rolled back local update.',
              variant: 'error',
            })
            return
          }

          const isJsonResponse =
            response.headers.get('content-type')?.includes('application/json') === true
          const result = isJsonResponse
            ? ((await response.json().catch(() => null)) as AssignmentStatusResponse | null)
            : null

          if (!response.ok) {
            const fallbackError =
              response.status === 401
                ? 'Your session expired. Sign in again and retry.'
                : 'Could not update assignment status.'
            if (previousShift) {
              setLocalShifts((current) =>
                current.map((shift) => (shift.id === assignmentId ? previousShift : shift))
              )
            }
            setError(result?.error ?? fallbackError)
            setToastState({
              id: Date.now(),
              message: 'Could not save status change. Rolled back local update.',
              variant: 'error',
            })
            return
          }

          if (!result?.assignment) {
            if (previousShift) {
              setLocalShifts((current) =>
                current.map((shift) => (shift.id === assignmentId ? previousShift : shift))
              )
            }
            setError(
              'Status update did not return data. Run the latest migrations and refresh this page.'
            )
            setToastState({
              id: Date.now(),
              message: 'Could not save status change. Rolled back local update.',
              variant: 'error',
            })
            return
          }

          const updated = result.assignment
          setLocalShifts((current) =>
            current.map((shift) =>
              shift.id === assignmentId
                ? {
                    ...shift,
                    assignment_status: updated.assignment_status,
                    status_note: updated.status_note,
                    left_early_time: updated.left_early_time,
                    status_updated_at: updated.status_updated_at,
                    status_updated_by: updated.status_updated_by,
                    status_updated_by_name: updated.status_updated_by_name,
                  }
                : shift
            )
          )
          if (previousShift && previousShift.assignment_status !== updated.assignment_status) {
            const logEntry: StatusLogEntry = {
              from: previousShift.assignment_status,
              to: updated.assignment_status,
              therapistName: previousShift.full_name,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
            setStatusLogByShift((current) => ({
              ...current,
              [assignmentId]: [...(current[assignmentId] ?? []), logEntry],
            }))
          }
          const label = assignmentStatusDescription(updated.assignment_status)
          setSuccess(
            options?.isUndo ? `Reverted status to ${label.toLowerCase()}.` : `Marked ${label}.`
          )

          if (!options?.isUndo && options?.previous) {
            setStatusUndoSnapshot(options.previous)
          } else {
            setStatusUndoSnapshot(null)
          }

          const nextSnapshot: AssignmentStatusSnapshot = {
            assignmentId: updated.id,
            status: updated.assignment_status,
            note: updated.status_note,
            leftEarlyTime: toTimeInputValue(updated.left_early_time),
          }

          setStatusPopover((current) =>
            current && current.assignmentId === assignmentId
              ? { ...current, snapshot: nextSnapshot }
              : current
          )

          setStatusDraft((current) =>
            current
              ? {
                  status: updated.assignment_status,
                  note: updated.status_note ?? '',
                  leftEarlyTime: toTimeInputValue(updated.left_early_time),
                }
              : current
          )

          if (options?.closePopover) {
            closeStatusPopover()
          }

          router.refresh()
        } finally {
          isStatusSavingRef.current = false
          setIsStatusSaving(false)
        }
      })()
    })
  }

  function statusDraftChanged(
    draft: { status: AssignmentStatus; note: string; leftEarlyTime: string },
    snapshot: AssignmentStatusSnapshot
  ): boolean {
    const normalizedDraftNote = draft.note.trim()
    const normalizedSnapshotNote = (snapshot.note ?? '').trim()
    const normalizedDraftLeftTime = draft.status === 'left_early' ? draft.leftEarlyTime.trim() : ''
    const normalizedSnapshotLeftTime =
      snapshot.status === 'left_early' ? (snapshot.leftEarlyTime ?? '').trim() : ''

    return (
      draft.status !== snapshot.status ||
      normalizedDraftNote !== normalizedSnapshotNote ||
      normalizedDraftLeftTime !== normalizedSnapshotLeftTime
    )
  }

  function saveStatusDraft(options?: { closePopover?: boolean; isUndo?: boolean }) {
    if (isStatusSavingRef.current) return
    if (!statusPopover || !statusDraft) return
    if (!statusDraftChanged(statusDraft, statusPopover.snapshot) && !options?.isUndo) {
      if (options?.closePopover) closeStatusPopover()
      return
    }

    runAssignmentStatusUpdate(statusPopover.assignmentId, statusDraft, {
      previous: options?.isUndo ? null : statusPopover.snapshot,
      closePopover: options?.closePopover,
      isUndo: options?.isUndo,
    })
  }

  function handleStatusSelect(nextStatus: AssignmentStatus) {
    if (isStatusSavingRef.current) return
    if (!statusDraft) return

    const nextDraft = {
      ...statusDraft,
      status: nextStatus,
      leftEarlyTime: nextStatus === 'left_early' ? statusDraft.leftEarlyTime : '',
    }
    setStatusDraft(nextDraft)

    if (!statusPopover) return
    runAssignmentStatusUpdate(statusPopover.assignmentId, nextDraft, {
      previous: statusPopover.snapshot,
      closePopover: false,
    })
  }

  function handleResetToScheduled() {
    if (isStatusSavingRef.current) return
    if (!statusPopover || !statusDraft) return

    const resetDraft = {
      status: 'scheduled' as AssignmentStatus,
      note: '',
      leftEarlyTime: '',
    }

    if (!statusDraftChanged(resetDraft, statusPopover.snapshot)) {
      return
    }

    setStatusDraft(resetDraft)
    runAssignmentStatusUpdate(statusPopover.assignmentId, resetDraft, {
      previous: statusPopover.snapshot,
      closePopover: false,
    })
  }

  function runUndoStatusUpdate() {
    if (isStatusSavingRef.current) return
    if (!statusUndoSnapshot) return
    runAssignmentStatusUpdate(
      statusUndoSnapshot.assignmentId,
      {
        status: statusUndoSnapshot.status,
        note: statusUndoSnapshot.note ?? '',
        leftEarlyTime: statusUndoSnapshot.leftEarlyTime ?? '',
      },
      {
        previous: null,
        closePopover: true,
        isUndo: true,
      }
    )
  }

  function handlePanelStatusChange(shift: Shift, nextStatus: AssignmentStatus) {
    if (isStatusSavingRef.current) return
    if (shift.assignment_status === nextStatus) return

    const snapshot: AssignmentStatusSnapshot = {
      assignmentId: shift.id,
      status: shift.assignment_status,
      note: shift.status_note,
      leftEarlyTime: toTimeInputValue(shift.left_early_time),
    }

    runAssignmentStatusUpdate(
      shift.id,
      {
        status: nextStatus,
        note: shift.status_note ?? '',
        leftEarlyTime: nextStatus === 'left_early' ? toTimeInputValue(shift.left_early_time) : '',
      },
      {
        previous: snapshot,
        closePopover: false,
      }
    )
  }

  function allowDrop(event: DragEvent<HTMLElement>) {
    if (!canManageStaffing) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function onDropDate(
    event: DragEvent<HTMLDivElement>,
    date: string,
    targetShiftType: 'day' | 'night'
  ) {
    if (!canManageStaffing) return
    event.preventDefault()

    const payload = readDragPayload(event)
    if (!payload) return

    if (payload.type === 'therapist') {
      runActionWithAvailabilityCheck({
        action: 'assign',
        cycleId,
        userId: payload.userId,
        shiftType: targetShiftType,
        date,
        overrideWeeklyRules,
      })
      return
    }

    runActionWithAvailabilityCheck({
      action: 'move',
      cycleId,
      shiftId: payload.shiftId,
      targetDate: date,
      targetShiftType,
      overrideWeeklyRules,
    })
  }

  function onDropRemove(event: DragEvent<HTMLDivElement>) {
    if (!canManageStaffing) return
    event.preventDefault()
    const payload = readDragPayload(event)
    if (!payload) return

    if (payload.type !== 'shift') {
      setError('Drag an existing shift here to remove it.')
      return
    }

    runActionWithAvailabilityCheck({
      action: 'remove',
      cycleId,
      shiftId: payload.shiftId,
    })
  }

  function shiftMobileWeek(offset: number) {
    setMobileWeekStart((current) => {
      const currentDate = dateFromKey(current)
      const nextDate = addDays(currentDate, offset * 7)
      if (nextDate < minMobileWeekStart) return keyFromDate(minMobileWeekStart)
      if (nextDate > maxMobileWeekStart) return keyFromDate(maxMobileWeekStart)
      return keyFromDate(nextDate)
    })
  }

  function onMobileWeekTouchStart(event: TouchEvent<HTMLDivElement>) {
    mobileTouchStartX.current = event.touches[0]?.clientX ?? null
    mobileTouchStartY.current = event.touches[0]?.clientY ?? null
  }

  function onMobileWeekTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const startX = mobileTouchStartX.current
    const startY = mobileTouchStartY.current
    const endX = event.changedTouches[0]?.clientX ?? null
    const endY = event.changedTouches[0]?.clientY ?? null
    mobileTouchStartX.current = null
    mobileTouchStartY.current = null

    if (startX === null || endX === null || startY === null || endY === null) return
    const deltaX = endX - startX
    const deltaY = endY - startY
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return
    if (deltaX < 0) {
      shiftMobileWeek(1)
    } else {
      shiftMobileWeek(-1)
    }
  }

  function renderShiftDayCell(
    day: Date,
    shiftType: 'day' | 'night',
    options?: { gridColumnStart?: number; showWeekday?: boolean }
  ) {
    const date = keyFromDate(day)
    const inCycle = date >= startDate && date <= endDate
    const dayShifts = inCycle
      ? (shiftsByDate.get(date) ?? []).filter((shift) => shift.shift_type === shiftType)
      : []
    const orderedShifts = dayShifts.slice().sort((a, b) => {
      if (a.role !== b.role) return a.role === 'lead' ? -1 : 1
      return a.full_name.localeCompare(b.full_name)
    })
    const slotKey = `${date}:${shiftType}`
    const cellSummary = summarizeCalendarCell(orderedShifts)
    const coverageCount = cellSummary.coverageCount
    const leadAssignments = orderedShifts.filter((shift) => shift.role === 'lead')
    const hasEligibleCoverage = orderedShifts.some(
      (shift) =>
        (shift.status === 'scheduled' || shift.status === 'on_call') && shift.isLeadEligible
    )
    const missingLead = leadAssignments.length === 0 || !hasEligibleCoverage
    const underCoverage = coverageCount < MIN_SHIFT_COVERAGE_PER_DAY
    const overCoverage = coverageCount > MAX_SHIFT_COVERAGE_PER_DAY
    const multipleLeads = leadAssignments.length > 1
    const ineligibleLead = leadAssignments.some((shift) => !shift.isLeadEligible)
    const derivedReasons: Array<
      'under_coverage' | 'over_coverage' | 'missing_lead' | 'multiple_leads' | 'ineligible_lead'
    > = []
    if (underCoverage) derivedReasons.push('under_coverage')
    if (overCoverage) derivedReasons.push('over_coverage')
    if (missingLead) derivedReasons.push('missing_lead')
    if (multipleLeads) derivedReasons.push('multiple_leads')
    if (ineligibleLead) derivedReasons.push('ineligible_lead')
    const slotReasons = issueReasonsBySlot[slotKey] ?? derivedReasons
    const blockedByConstraints = constraintBlockedSlotKeySet.has(slotKey)
    const filterMatch = !inCycle || issueFilter === 'all' || slotReasons.includes(issueFilter)
    const coverageTone = missingLead
      ? 'text-red-700'
      : underCoverage
        ? 'text-amber-700'
        : overCoverage
          ? 'text-red-700'
          : 'text-emerald-700'
    const statusCounts = {
      call_in: orderedShifts.filter((shift) => shift.assignment_status === 'call_in').length,
      on_call: orderedShifts.filter((shift) => shift.assignment_status === 'on_call').length,
      cancelled: orderedShifts.filter((shift) => shift.assignment_status === 'cancelled').length,
      left_early: orderedShifts.filter((shift) => shift.assignment_status === 'left_early').length,
    }
    const activeCount = orderedShifts.filter(
      (shift) => shift.assignment_status !== 'cancelled'
    ).length
    const totalCount = orderedShifts.length
    const filteredVisibleShifts = orderedShifts.filter((shift) =>
      statusMatchesFilter(shift.assignment_status, statusFilter)
    )
    const isSelected = selectedDate === date && selectedShiftType === shiftType
    const visibleIssueTags = slotReasons
      .filter((reason) => reason === 'ineligible_lead' || reason === 'multiple_leads')
      .slice(0, 2)
    const shiftPalette =
      shiftType === 'day'
        ? {
            border: 'border-sky-200',
            bg: 'bg-sky-50',
            text: 'text-sky-900',
          }
        : {
            border: 'border-indigo-200',
            bg: 'bg-indigo-50',
            text: 'text-indigo-900',
          }
    const previousDay = addDays(day, -1)
    const nextDay = addDays(day, 1)
    const isBoundaryDay =
      inCycle &&
      (previousDay.getMonth() !== day.getMonth() || nextDay.getMonth() !== day.getMonth())
    const dateHeaderLabel = isBoundaryDay
      ? day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : String(day.getDate())

    return (
      <div
        key={`${shiftType}-${date}-${options?.showWeekday ? 'mobile' : 'month'}`}
        style={options?.gridColumnStart ? { gridColumnStart: options.gridColumnStart } : undefined}
        onDragEnter={inCycle ? allowDrop : undefined}
        onDragOver={inCycle ? allowDrop : undefined}
        onDrop={inCycle ? (event) => onDropDate(event, date, shiftType) : undefined}
        onClick={inCycle ? () => onCalendarCellClick(date, shiftType) : undefined}
        id={`slot-card-${date}-${shiftType}`}
        className={cn(
          'min-h-[11.5rem] overflow-hidden rounded-lg border bg-white transition-all',
          isSelected
            ? 'border-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.12)]'
            : 'border-border/80',
          inCycle
            ? 'cursor-pointer hover:border-slate-300 hover:bg-secondary/10'
            : 'cursor-default bg-muted/30',
          issueFilter !== 'all' && !filterMatch ? 'opacity-45' : ''
        )}
        aria-label={
          inCycle
            ? `Open ${shiftType} shift details for ${formatCellDate(date)}`
            : `${formatCellDate(date)} outside cycle`
        }
      >
        <div className={cn('h-1', missingLead ? 'bg-red-500' : 'bg-indigo-500')} />
        <div className="p-2.5">
          {options?.showWeekday && (
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </p>
          )}
          <div className="mb-2 flex items-center justify-between">
            <span
              className={cn('font-semibold text-foreground', isBoundaryDay ? 'text-xs' : 'text-sm')}
            >
              {dateHeaderLabel}
            </span>
            {inCycle ? (
              <div className="flex flex-wrap items-center justify-end gap-1">
                {statusCounts.call_in > 0 && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                    CI {statusCounts.call_in}
                  </span>
                )}
                {statusCounts.on_call > 0 && (
                  <span className="rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[9px] font-bold text-orange-700">
                    OC {statusCounts.on_call}
                  </span>
                )}
                {statusCounts.left_early > 0 && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                    LE {statusCounts.left_early}
                  </span>
                )}
                {statusCounts.cancelled > 0 && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-700">
                    -{statusCounts.cancelled}
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                    coverageTone,
                    missingLead ? 'bg-red-100' : 'bg-emerald-50'
                  )}
                >
                  {activeCount}/{totalCount}
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">-</span>
            )}
          </div>
          {inCycle ? (
            <>
              {visibleIssueTags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {visibleIssueTags.map((reason) => (
                    <span
                      key={`${slotKey}-${reason}`}
                      className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-800"
                    >
                      {reason === 'ineligible_lead' ? 'Ineligible lead' : 'Multiple leads'}
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                {blockedByConstraints && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                    No eligible therapists (constraints)
                  </div>
                )}
                {missingLead && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                    No lead assigned
                  </div>
                )}
                {filteredVisibleShifts.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground">No matching statuses</span>
                ) : (
                  filteredVisibleShifts.map((shift) => (
                    <div
                      key={shift.id}
                      onClick={(event) => event.stopPropagation()}
                      draggable={canManageStaffing}
                      onDragStart={
                        canManageStaffing
                          ? (event) =>
                              setDragData(event, {
                                type: 'shift',
                                shiftId: shift.id,
                                shiftType: shift.shift_type,
                              })
                          : undefined
                      }
                      className={cn(
                        'rounded-md border px-2 py-1',
                        shift.role === 'lead'
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : `${shiftPalette.border} ${shiftPalette.bg} ${shiftPalette.text}`
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        {canEditAssignmentStatus ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openStatusPopoverForShift(shift, event.currentTarget)
                            }}
                            className={cn(
                              'font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              shift.assignment_status === 'cancelled'
                                ? 'text-red-700 line-through'
                                : ''
                            )}
                          >
                            {shift.full_name}
                          </button>
                        ) : (
                          <span
                            className={cn(
                              'font-medium',
                              shift.assignment_status === 'cancelled'
                                ? 'text-red-700 line-through'
                                : ''
                            )}
                          >
                            {shift.full_name}
                          </span>
                        )}
                        {shift.role === 'lead' && (
                          <span className="text-[9px] font-semibold uppercase tracking-wide">
                            Lead
                          </span>
                        )}
                        {shift.assignment_status !== 'scheduled' && (
                          <span
                            className={cn(
                              'inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                              assignmentStatusTone(shift.assignment_status)
                            )}
                            title={assignmentStatusTooltip(shift) ?? undefined}
                          >
                            {assignmentStatusLabel(shift.assignment_status)}
                          </span>
                        )}
                        {canViewAvailabilityOverride && shift.availability_override && (
                          <span
                            className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800"
                            title={`Override by ${shift.availability_override_by_name ?? 'Manager'} - ${formatOverrideTimestamp(shift.availability_override_at)}${
                              shift.availability_override_reason
                                ? `\n${shift.availability_override_reason}`
                                : ''
                            }`}
                          >
                            Override
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {orderedShifts.length === 0 && (
                <div className="text-[11px] text-muted-foreground">No therapists assigned</div>
              )}
            </>
          ) : (
            <div className="text-xs text-muted-foreground">Outside cycle</div>
          )}
        </div>
      </div>
    )
  }

  function renderCalendarForShift(shiftType: 'day' | 'night') {
    return (
      <div className="space-y-2">
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={`continuous-${shiftType}-${day}`}
              className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {calendarWeeks.flatMap((week) => week.map((day) => renderShiftDayCell(day, shiftType)))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {toastState && (
        <FeedbackToast
          key={toastState.id}
          message={toastState.message}
          variant={toastState.variant}
        />
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <span>{success}</span>
          {undoAction && (
            <button
              type="button"
              className="rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              onClick={() => runDragAction(undoAction, { isUndo: true })}
            >
              Undo
            </button>
          )}
          {statusUndoSnapshot && (
            <button
              type="button"
              className="rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              onClick={runUndoStatusUpdate}
              disabled={isStatusSaving}
            >
              Undo
            </button>
          )}
        </div>
      )}

      {canManageStaffing && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStaffingPoolOpen((open) => !open)}
          >
            {staffingPoolOpen ? 'Hide staffing pool' : 'Show staffing pool'}
          </Button>
        </div>
      )}

      <div
        className={cn(
          'grid grid-cols-1 gap-5',
          staffingPoolOpen
            ? 'xl:grid-cols-[250px_minmax(0,1fr)_340px]'
            : 'xl:grid-cols-[minmax(0,1fr)_340px]'
        )}
      >
        {canManageStaffing && staffingPoolOpen && (
          <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">
              Staffing pool ({selectedShiftType})
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag therapists onto the {selectedShiftType} calendar cells.
            </p>

            <div className="mt-3 space-y-2">
              {therapistsForPoolWithAvailability.map((row) => (
                <div
                  key={row.therapist.id}
                  draggable={!row.prnNotOffered}
                  title={row.prnNotOffered ? 'PRN not offered for this date' : undefined}
                  onDragStart={(event) => {
                    if (row.prnNotOffered) {
                      event.preventDefault()
                      return
                    }
                    setDragData(event, {
                      type: 'therapist',
                      userId: row.therapist.id,
                      shiftType: row.therapist.shift_type,
                    })
                  }}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm',
                    row.prnNotOffered
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-grab active:cursor-grabbing',
                    selectedShiftType === 'day'
                      ? 'border-sky-200 bg-sky-50'
                      : 'border-indigo-200 bg-indigo-50'
                  )}
                >
                  <div
                    className={cn(
                      'font-medium',
                      selectedShiftType === 'day' ? 'text-sky-900' : 'text-indigo-900'
                    )}
                  >
                    {row.therapist.full_name}
                  </div>
                  <div
                    className={cn(
                      'text-xs capitalize',
                      selectedShiftType === 'day' ? 'text-sky-700' : 'text-indigo-700'
                    )}
                  >
                    {row.therapist.shift_type} shift
                  </div>
                  {(row.blockedByConstraints || row.forceOn) && selectedDate && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.blockedByConstraints && (
                        <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                          Constraint
                        </span>
                      )}
                      {row.forceOn && (
                        <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          Offered
                        </span>
                      )}
                    </div>
                  )}
                  {row.blockedByConstraints && row.unavailableReason && selectedDate && (
                    <p className="mt-1 text-[10px] text-red-700">{row.unavailableReason}</p>
                  )}
                </div>
              ))}
              {therapistsForPoolWithAvailability.length === 0 && (
                <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  No {selectedShiftType} therapists available.
                </p>
              )}
            </div>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDropRemove}
              className="mt-4 rounded-xl border-2 border-dashed border-red-300 bg-red-50 px-3 py-3"
            >
              <div className="text-sm font-semibold text-red-700">Remove from schedule</div>
              <p className="mt-1 text-xs text-red-600">
                Drag a therapist chip here to remove that assignment.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <CalendarToolbar
            rangeLabel={rangeLabel}
            minCoverage={MIN_SHIFT_COVERAGE_PER_DAY}
            maxCoverage={MAX_SHIFT_COVERAGE_PER_DAY}
            issueFilter={issueFilter}
            selectedShiftType={selectedShiftType}
            statusFilter={statusFilter}
            overrideWeeklyRules={overrideWeeklyRules}
            onShiftTypeChange={setSelectedShiftType}
            onStatusFilterChange={setStatusFilter}
            onOverrideWeeklyRulesChange={setOverrideWeeklyRules}
          />

          <div className="space-y-4 md:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-medium text-muted-foreground">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => shiftMobileWeek(-1)}
                disabled={dateFromKey(mobileWeekStart) <= minMobileWeekStart}
              >
                Previous
              </Button>
              <span>{mobileWeekRangeLabel}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => shiftMobileWeek(1)}
                disabled={dateFromKey(mobileWeekStart) >= maxMobileWeekStart}
              >
                Next
              </Button>
            </div>
            <p className="px-1 text-[11px] text-muted-foreground">
              Swipe left or right to navigate weeks.
            </p>
            <div
              className="space-y-2"
              onTouchStart={onMobileWeekTouchStart}
              onTouchEnd={onMobileWeekTouchEnd}
            >
              {mobileWeekDays.map((day) =>
                renderShiftDayCell(day, selectedShiftType, { showWeekday: true })
              )}
            </div>
          </div>

          <div className="hidden space-y-4 md:block">
            <div className="overflow-x-auto">{renderCalendarForShift(selectedShiftType)}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white shadow-sm xl:sticky xl:top-5 xl:h-fit">
          {selectedDate ? (
            <>
              <div className="border-b border-border bg-slate-50 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {formatCellDate(selectedDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground capitalize">
                      {selectedShiftType} shift
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="text-lg leading-none text-slate-400 hover:text-slate-600"
                    aria-label="Clear selected day"
                  >
                    x
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="text-emerald-700">OK {selectedCounts.active} active</span>
                  <span className="text-orange-700">OC {selectedCounts.onCall}</span>
                  <span className="text-slate-600">LE {selectedCounts.leaveEarly}</span>
                  <span className="text-red-700">X {selectedCounts.cancelled}</span>
                </div>
              </div>

              <div className="max-h-[72vh] space-y-2 overflow-y-auto p-3">
                {selectedLeadShift ? (
                  <div className="rounded-lg border border-border bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold text-white',
                          getAvatarTone(selectedLeadShift.assignment_status)
                        )}
                      >
                        {initials(selectedLeadShift.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm font-semibold',
                            selectedLeadShift.assignment_status === 'cancelled'
                              ? 'text-red-700 line-through'
                              : 'text-slate-900'
                          )}
                        >
                          {selectedLeadShift.full_name}
                        </p>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                          Lead
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(
                        ['scheduled', 'on_call', 'left_early', 'cancelled'] as AssignmentStatus[]
                      ).map((status) => {
                        const active = selectedLeadShift.assignment_status === status
                        return (
                          <button
                            key={`${selectedLeadShift.id}-${status}`}
                            type="button"
                            onClick={() =>
                              canEditAssignmentStatus &&
                              handlePanelStatusChange(selectedLeadShift, status)
                            }
                            disabled={active || isStatusSaving || !canEditAssignmentStatus}
                            className={cn(
                              'rounded-md border px-2 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-60',
                              active
                                ? status === 'cancelled'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : status === 'on_call'
                                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                                    : 'border-slate-300 bg-slate-100 text-slate-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                            )}
                          >
                            {toStatusButtonLabel(status)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                    No lead assigned.
                  </p>
                )}

                {selectedStaffShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="rounded-lg border border-border bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold text-white',
                          getAvatarTone(shift.assignment_status)
                        )}
                      >
                        {initials(shift.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm font-semibold',
                            shift.assignment_status === 'cancelled'
                              ? 'text-red-700 line-through'
                              : 'text-slate-900'
                          )}
                        >
                          {shift.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assignmentStatusDescription(shift.assignment_status)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(
                        ['scheduled', 'on_call', 'left_early', 'cancelled'] as AssignmentStatus[]
                      ).map((status) => {
                        const active = shift.assignment_status === status
                        return (
                          <button
                            key={`${shift.id}-${status}`}
                            type="button"
                            onClick={() =>
                              canEditAssignmentStatus && handlePanelStatusChange(shift, status)
                            }
                            disabled={active || isStatusSaving || !canEditAssignmentStatus}
                            className={cn(
                              'rounded-md border px-2 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-60',
                              active
                                ? status === 'cancelled'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : status === 'on_call'
                                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                                    : 'border-slate-300 bg-slate-100 text-slate-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                            )}
                          >
                            {toStatusButtonLabel(status)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {selectedDayLogs.length > 0 && (
                  <div className="mt-3 rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                      Change log
                    </p>
                    <div className="space-y-1">
                      {selectedDayLogs.map((entry) => (
                        <div
                          key={entry.key}
                          className="flex items-center gap-2 text-[11px] text-slate-600"
                        >
                          <span
                            className={cn(
                              'inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-extrabold text-white',
                              getAvatarTone(entry.to)
                            )}
                          >
                            {initials(entry.therapistName)}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {firstName(entry.therapistName)}
                          </span>
                          <span>{assignmentStatusDescription(entry.from)} -&gt;</span>
                          <span className="font-semibold text-slate-700">
                            {assignmentStatusDescription(entry.to)}
                          </span>
                          <span className="ml-auto text-slate-400">{entry.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {canManageStaffing && (
                <div className="border-t border-border p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openShiftDrawer(selectedDate, selectedShiftType)}
                  >
                    Manage shift staffing
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">Select a day</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">Click any day to edit</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Set therapists to Active, On Call, Leave Early, or Cancelled.
              </p>
            </div>
          )}
        </div>
      </div>

      {statusPopover && statusDraft && statusPopoverPosition && (
        <div
          ref={statusPopoverRef}
          role="dialog"
          aria-label={`Update assignment status for ${statusPopover.therapistName}`}
          className="fixed z-50 rounded-xl border border-border bg-white p-3 shadow-lg"
          style={{
            width: statusPopoverPosition.width,
            left: statusPopoverPosition.left,
            top: statusPopoverPosition.top,
          }}
        >
          <p className="text-xs font-medium text-foreground">
            {formatStatusPopoverHeader(
              statusPopover.date,
              statusPopover.shiftType,
              statusPopover.therapistName
            )}
          </p>

          <div className="mt-2 space-y-1">
            <label
              htmlFor="assignment-status-select"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Status
            </label>
            <select
              id="assignment-status-select"
              value={statusDraft.status}
              onChange={(event) => handleStatusSelect(event.target.value as AssignmentStatus)}
              disabled={isStatusSaving}
              className="h-8 w-full rounded-md border border-border bg-white px-2 text-xs"
            >
              <option value="scheduled">Scheduled</option>
              <option value="call_in">CI - Call in</option>
              <option value="cancelled">CX - Cancelled</option>
              <option value="on_call">OC - On call</option>
              <option value="left_early">LE - Left early</option>
            </select>
          </div>

          <div className="mt-3 space-y-1">
            <label
              htmlFor="assignment-status-note"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Note (optional)
            </label>
            <textarea
              id="assignment-status-note"
              rows={2}
              value={statusDraft.note}
              onChange={(event) =>
                setStatusDraft((current) =>
                  current ? { ...current, note: event.target.value } : current
                )
              }
              onBlur={() => saveStatusDraft({ closePopover: false })}
              disabled={isStatusSaving}
              className="w-full rounded-md border border-border bg-white px-2 py-1 text-xs"
              placeholder="Add context"
            />
          </div>

          {statusDraft.status === 'left_early' && (
            <div className="mt-2 space-y-1">
              <label
                htmlFor="assignment-left-early-time"
                className="text-[11px] font-medium text-muted-foreground"
              >
                Left at (optional)
              </label>
              <input
                id="assignment-left-early-time"
                type="time"
                value={statusDraft.leftEarlyTime}
                onChange={(event) =>
                  setStatusDraft((current) =>
                    current ? { ...current, leftEarlyTime: event.target.value } : current
                  )
                }
                onBlur={() => saveStatusDraft({ closePopover: false })}
                disabled={isStatusSaving}
                className="h-8 w-full rounded-md border border-border bg-white px-2 text-xs"
              />
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
              onClick={handleResetToScheduled}
              disabled={
                isStatusSaving ||
                !statusDraftChanged(
                  { status: 'scheduled', note: '', leftEarlyTime: '' },
                  statusPopover.snapshot
                )
              }
            >
              Reset to Scheduled
            </button>
            {isStatusSaving && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Saving...
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={closeStatusPopover}
              disabled={isStatusSaving}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => saveStatusDraft({ closePopover: true })}
              disabled={isStatusSaving}
            >
              {isStatusSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(availabilityConflictDialog)}
        onOpenChange={(open) => {
          if (!open) closeAvailabilityConflictDialog()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assignment warning</DialogTitle>
            <DialogDescription>
              {availabilityConflictDialog
                ? `${availabilityConflictDialog.therapistName} has a scheduling constraint on ${formatCellDate(
                    availabilityConflictDialog.date
                  )}${
                    availabilityConflictDialog.reason
                      ? ` (${availabilityConflictDialog.reason})`
                      : ''
                  }. Assign anyway?`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="availability-override-reason"
              className="text-xs font-medium text-muted-foreground"
            >
              Override reason (optional)
            </label>
            <textarea
              id="availability-override-reason"
              rows={3}
              value={availabilityOverrideReasonDraft}
              onChange={(event) => setAvailabilityOverrideReasonDraft(event.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Optional context for this override"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAvailabilityConflictDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmAvailabilityOverride}>
              Assign anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(drawerSlot)} onOpenChange={(open) => !open && closeShiftDrawer()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {drawerSlot ? `${drawerSlot.shiftType === 'day' ? 'Day' : 'Night'} Shift` : 'Shift'}
            </DialogTitle>
            <DialogDescription>
              {drawerSlot
                ? `${formatCellDate(drawerSlot.date)} - full roster and lead controls`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {drawerSlot && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={cn(
                    'rounded-md border px-2 py-1',
                    drawerMissingLead
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  )}
                >
                  {drawerMissingLead ? 'Lead missing' : 'Lead assigned'}
                </span>
                <span
                  className={cn(
                    'rounded-md border px-2 py-1',
                    drawerUnderCoverage
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-border bg-muted text-muted-foreground'
                  )}
                >
                  Under coverage: {drawerUnderCoverage ? 'Yes' : 'No'}
                </span>
                <span
                  className={cn(
                    'rounded-md border px-2 py-1',
                    drawerOverCoverage
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : 'border-border bg-muted text-muted-foreground'
                  )}
                >
                  Over coverage: {drawerOverCoverage ? 'Yes' : 'No'}
                </span>
                <span className="rounded-md border border-border bg-muted px-2 py-1 text-muted-foreground">
                  Coverage: {drawerCoverageCount}/{MAX_SHIFT_COVERAGE_PER_DAY}
                </span>
              </div>

              {canManageStaffing && (
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">Designated Lead</p>
                  <p className="text-xs text-muted-foreground">
                    Select one lead-eligible therapist for this shift.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select
                      value={drawerLeadTherapistId}
                      onChange={(event) => setDrawerLeadTherapistId(event.target.value)}
                      className="h-9 min-w-64 rounded-md border border-border bg-white px-3 text-sm"
                    >
                      <option value="">Select designated lead</option>
                      {drawerLeadOptions.map((therapist) => (
                        <option key={therapist.id} value={therapist.id}>
                          {therapist.full_name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!drawerLeadTherapistId || isPending}
                      onClick={() =>
                        runActionWithAvailabilityCheck({
                          action: 'set_lead',
                          cycleId,
                          therapistId: drawerLeadTherapistId,
                          date: drawerSlot.date,
                          shiftType: drawerSlot.shiftType,
                          overrideWeeklyRules,
                        })
                      }
                    >
                      Save lead
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-semibold text-foreground">Staff roster</p>
                <div className="mt-2 space-y-2">
                  {drawerShifts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No therapists assigned yet.</p>
                  )}
                  {drawerShifts.map((shift) => (
                    <Fragment key={shift.id}>
                      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {shift.full_name}
                          </span>
                          {shift.role === 'lead' && (
                            <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              Lead
                            </span>
                          )}
                          {canEditAssignmentStatus ? (
                            <button
                              type="button"
                              className={cn(
                                'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                                assignmentStatusTone(shift.assignment_status)
                              )}
                              title={assignmentStatusTooltip(shift) ?? undefined}
                              onClick={(event) => {
                                event.stopPropagation()
                                openStatusPopoverForShift(shift, event.currentTarget)
                              }}
                            >
                              {assignmentStatusLabel(shift.assignment_status)}
                            </button>
                          ) : (
                            <span
                              className={cn(
                                'rounded border px-1.5 py-0.5 text-[10px] font-medium',
                                assignmentStatusTone(shift.assignment_status)
                              )}
                              title={assignmentStatusTooltip(shift) ?? undefined}
                            >
                              {assignmentStatusLabel(shift.assignment_status)}
                            </span>
                          )}
                          {canViewAvailabilityOverride && shift.availability_override && (
                            <span
                              className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                              title={`Override by ${shift.availability_override_by_name ?? 'Manager'} - ${formatOverrideTimestamp(shift.availability_override_at)}${
                                shift.availability_override_reason
                                  ? `\n${shift.availability_override_reason}`
                                  : ''
                              }`}
                            >
                              Override
                            </span>
                          )}
                        </div>
                        {canManageStaffing && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-[var(--warning-text)]"
                            onClick={() =>
                              runActionWithAvailabilityCheck({
                                action: 'remove',
                                cycleId,
                                shiftId: shift.id,
                              })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      {canViewAvailabilityOverride && shift.availability_override && (
                        <div className="px-3 pb-2 text-[11px] text-amber-800">
                          Override by {shift.availability_override_by_name ?? 'Manager'} on{' '}
                          {formatOverrideTimestamp(shift.availability_override_at)}
                          {shift.availability_override_reason
                            ? ` - ${shift.availability_override_reason}`
                            : ''}
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>

                {canManageStaffing && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="min-w-64 flex-1 space-y-2">
                      <Input
                        value={drawerTherapistSearch}
                        onChange={(event) => setDrawerTherapistSearch(event.target.value)}
                        placeholder="Search therapist"
                        className="h-9"
                      />
                      <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-white p-1">
                        {drawerVisibleStaffOptions.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-muted-foreground">
                            No matching therapists.
                          </p>
                        ) : (
                          drawerVisibleStaffOptions.map((option) => {
                            const selected = drawerAddTherapistId === option.therapist.id
                            return (
                              <button
                                key={option.therapist.id}
                                type="button"
                                disabled={option.disabled}
                                title={
                                  option.disabledForEligibility
                                    ? 'PRN not offered for this date'
                                    : option.disabledForWeeklyLimit
                                      ? `At weekly limit (${WEEKLY_LIMIT}/week)`
                                      : undefined
                                }
                                onClick={() => setDrawerAddTherapistId(option.therapist.id)}
                                className={cn(
                                  'flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-sm',
                                  selected ? 'bg-secondary' : 'hover:bg-muted',
                                  option.disabled && 'cursor-not-allowed opacity-50'
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-foreground">
                                    {option.therapist.full_name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                                    {option.therapist.is_lead_eligible && (
                                      <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700">
                                        Lead eligible
                                      </span>
                                    )}
                                    {option.therapist.employment_type === 'prn' && (
                                      <span className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-medium text-slate-700">
                                        PRN
                                      </span>
                                    )}
                                    {option.blockedByConstraints && (
                                      <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 font-medium text-red-700">
                                        Constraint
                                      </span>
                                    )}
                                    {option.forceOn && (
                                      <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                                        Offered
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap justify-end gap-1 text-[10px]">
                                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-muted-foreground">
                                    Week: {option.weekShiftCount}/{WEEKLY_LIMIT}
                                  </span>
                                  <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-muted-foreground">
                                    Cycle: {option.cycleShiftCount}
                                  </span>
                                  {option.atWeeklyLimit && overrideWeeklyRules && (
                                    <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
                                      Override
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!drawerAddTherapistId || isPending}
                      onClick={() => {
                        runActionWithAvailabilityCheck({
                          action: 'assign',
                          cycleId,
                          userId: drawerAddTherapistId,
                          shiftType: drawerSlot.shiftType,
                          date: drawerSlot.date,
                          overrideWeeklyRules,
                        })
                        setDrawerAddTherapistId('')
                        setDrawerTherapistSearch('')
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeShiftDrawer}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isPending && <p className="text-sm text-muted-foreground">Saving changes...</p>}
    </div>
  )
}
