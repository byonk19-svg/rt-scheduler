'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { DragEvent, TouchEvent } from 'react'
import { useRouter } from 'next/navigation'

import { CalendarToolbar } from '@/components/CalendarToolbar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { summarizeCalendarCell } from '@/lib/calendar-cell'
import { cn } from '@/lib/utils'
import { MIN_SHIFT_COVERAGE_PER_DAY, MAX_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'

type Therapist = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  is_lead_eligible?: boolean
}

type Shift = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  assignment_status: 'scheduled' | 'call_in' | 'cancelled' | 'on_call' | 'left_early'
  status_note: string | null
  left_early_time: string | null
  status_updated_at: string | null
  status_updated_by: string | null
  status_updated_by_name: string | null
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
    }
  | {
      action: 'move'
      cycleId: string
      shiftId: string
      targetDate: string
      targetShiftType: 'day' | 'night'
      overrideWeeklyRules: boolean
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
}

type DragActionResponse = {
  message?: string
  error?: string
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

type AssignmentStatus =
  | 'scheduled'
  | 'call_in'
  | 'cancelled'
  | 'on_call'
  | 'left_early'

type StatusFilter =
  | 'all'
  | 'any_non_scheduled'
  | 'call_in'
  | 'on_call'
  | 'cancelled'
  | 'left_early'

type AssignmentStatusSnapshot = {
  assignmentId: string
  status: AssignmentStatus
  note: string | null
  leftEarlyTime: string | null
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
    Array<'under_coverage' | 'over_coverage' | 'missing_lead' | 'multiple_leads' | 'ineligible_lead'>
  >
  defaultShiftType?: 'day' | 'night'
  canManageStaffing?: boolean
  canEditAssignmentStatus?: boolean
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function keyFromDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: Date, amount: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(value: Date): Date {
  const next = new Date(value)
  next.setDate(next.getDate() - next.getDay())
  return next
}

function endOfWeek(value: Date): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + (6 - next.getDay()))
  return next
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
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `Cycle range: ${startLabel} to ${endLabel}`
}

function buildCalendarWeeks(startDate: string, endDate: string): Date[][] {
  const start = dateFromKey(startDate)
  const end = dateFromKey(endDate)
  const weeks: Date[][] = []
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return weeks
  }

  const gridStart = startOfWeek(start)
  const gridEnd = endOfWeek(end)
  const cursor = new Date(gridStart)

  while (cursor <= gridEnd) {
    const week: Date[] = []
    for (let index = 0; index < 7; index += 1) {
      week.push(addDays(cursor, index))
    }
    weeks.push(week)
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
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

function formatStatusPopoverHeader(date: string, shiftType: 'day' | 'night', therapistName: string): string {
  const parsed = dateFromKey(date)
  if (Number.isNaN(parsed.getTime())) {
    return `${date} · ${shiftType === 'day' ? 'Day' : 'Night'} shift · ${therapistName}`
  }
  const dateLabel = parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${dateLabel} · ${shiftType === 'day' ? 'Day' : 'Night'} shift · ${therapistName}`
}

function toTimeInputValue(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 5)
}

function statusMatchesFilter(status: AssignmentStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'any_non_scheduled') return status !== 'scheduled'
  return status === filter
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

export function ManagerMonthCalendar({
  cycleId,
  startDate,
  endDate,
  therapists,
  shifts,
  issueFilter = 'all',
  focusSlotKey = null,
  issueReasonsBySlot = {},
  defaultShiftType = 'day',
  canManageStaffing = true,
  canEditAssignmentStatus = false,
}: ManagerMonthCalendarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [undoAction, setUndoAction] = useState<DragActionBody | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [overrideWeeklyRules, setOverrideWeeklyRules] = useState(false)
  const [selectedShiftType, setSelectedShiftType] = useState<'day' | 'night'>(() => {
    const focusShiftType = focusSlotKey?.split(':')[1]
    if (focusShiftType === 'night') return 'night'
    return defaultShiftType
  })
  const [mobileWeekStart, setMobileWeekStart] = useState(() => {
    const focusedDate = focusSlotKey?.split(':')[0]
    const startKey = focusedDate && /^\d{4}-\d{2}-\d{2}$/.test(focusedDate) ? focusedDate : startDate
    return keyFromDate(startOfWeek(dateFromKey(startKey)))
  })
  const [staffingPoolOpen, setStaffingPoolOpen] = useState(false)
  const [drawerSlot, setDrawerSlot] = useState<{ date: string; shiftType: 'day' | 'night' } | null>(null)
  const [drawerAddTherapistId, setDrawerAddTherapistId] = useState('')
  const [drawerLeadTherapistId, setDrawerLeadTherapistId] = useState('')
  const [statusPopover, setStatusPopover] = useState<StatusPopoverState | null>(null)
  const [statusDraft, setStatusDraft] = useState<{
    status: AssignmentStatus
    note: string
    leftEarlyTime: string
  } | null>(null)
  const [isStatusSaving, setIsStatusSaving] = useState(false)
  const [statusUndoSnapshot, setStatusUndoSnapshot] = useState<AssignmentStatusSnapshot | null>(null)
  const mobileTouchStartX = useRef<number | null>(null)
  const mobileTouchStartY = useRef<number | null>(null)
  const statusPopoverRef = useRef<HTMLDivElement | null>(null)
  const isStatusSavingRef = useRef(false)

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

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>()
    for (const shift of shifts) {
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
  }, [shifts])

  const dayTherapists = useMemo(
    () => therapists.filter((therapist) => therapist.shift_type === 'day'),
    [therapists]
  )
  const nightTherapists = useMemo(
    () => therapists.filter((therapist) => therapist.shift_type === 'night'),
    [therapists]
  )
  const therapistsForPool = selectedShiftType === 'day' ? dayTherapists : nightTherapists

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
    () => drawerShifts.filter((shift) => shift.status === 'scheduled' || shift.status === 'on_call').length,
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
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [drawerSlot, drawerShifts, therapists, drawerAssignedOnDate])

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
    const slotShifts = (shiftsByDate.get(date) ?? []).filter((shift) => shift.shift_type === shiftType)
    const currentLead = slotShifts.find((shift) => shift.role === 'lead')
    setDrawerSlot({ date, shiftType })
    setDrawerLeadTherapistId(currentLead?.user_id ?? '')
    setDrawerAddTherapistId('')
  }

  function onCalendarCellClick(date: string, shiftType: 'day' | 'night') {
    openShiftDrawer(date, shiftType)
  }

  function closeShiftDrawer() {
    setDrawerSlot(null)
    setDrawerAddTherapistId('')
    setDrawerLeadTherapistId('')
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
          setError(result?.error ?? 'Could not update schedule. Please try again.')
          return
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
          setError(result?.error ?? 'Could not update designated lead.')
          return
        }

        setSuccess(result?.message ?? 'Designated lead updated.')
        router.refresh()
      })()
    })
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
                leftEarlyTime: payload.status === 'left_early' ? payload.leftEarlyTime || null : null,
              }),
            })
          } catch {
            setError('Network error while updating assignment status. Please try again.')
            return
          }

          const isJsonResponse = response.headers.get('content-type')?.includes('application/json') === true
          const result = isJsonResponse
            ? ((await response.json().catch(() => null)) as AssignmentStatusResponse | null)
            : null

          if (!response.ok) {
            const fallbackError =
              response.status === 401
                ? 'Your session expired. Sign in again and retry.'
                : 'Could not update assignment status.'
            setError(result?.error ?? fallbackError)
            return
          }

          if (!result?.assignment) {
            setError(
              'Status update did not return data. Run the latest migrations and refresh this page.'
            )
            return
          }

          const updated = result.assignment
          const label = assignmentStatusDescription(updated.assignment_status)
          setSuccess(
            options?.isUndo
              ? `Reverted status to ${label.toLowerCase()}.`
              : `Marked ${label}.`
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
    const normalizedDraftLeftTime =
      draft.status === 'left_early' ? draft.leftEarlyTime.trim() : ''
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

    runAssignmentStatusUpdate(
      statusPopover.assignmentId,
      statusDraft,
      {
        previous: options?.isUndo ? null : statusPopover.snapshot,
        closePopover: options?.closePopover,
        isUndo: options?.isUndo,
      }
    )
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

  function allowDrop(event: DragEvent<HTMLElement>) {
    if (!canManageStaffing) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function onDropDate(event: DragEvent<HTMLDivElement>, date: string, targetShiftType: 'day' | 'night') {
    if (!canManageStaffing) return
    event.preventDefault()

    const payload = readDragPayload(event)
    if (!payload) return

    if (payload.type === 'therapist') {
      runDragAction({
        action: 'assign',
        cycleId,
        userId: payload.userId,
        shiftType: targetShiftType,
        date,
        overrideWeeklyRules,
      })
      return
    }

    runDragAction({
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

    runDragAction({
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
    const slotKey = `${date}:${shiftType}`
    const cellSummary = summarizeCalendarCell(dayShifts)
    const coverageCount = cellSummary.coverageCount
    const leadShift = dayShifts.find((shift) => shift.role === 'lead') ?? null
    const leadAssignments = dayShifts.filter((shift) => shift.role === 'lead')
    const hasEligibleCoverage = dayShifts.some(
      (shift) => (shift.status === 'scheduled' || shift.status === 'on_call') && shift.isLeadEligible
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
    const filterMatch = !inCycle || issueFilter === 'all' || slotReasons.includes(issueFilter)
    const coverageTone = underCoverage ? 'text-amber-700' : overCoverage ? 'text-red-700' : 'text-emerald-700'
    const filteredStatusStaffShifts = dayShifts
      .filter(
        (shift) =>
          shift.role !== 'lead' && statusMatchesFilter(shift.assignment_status, statusFilter)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
    const leadVisible = Boolean(
      leadShift && statusMatchesFilter(leadShift.assignment_status, statusFilter)
    )
    const hasStatusMatchInSlot = dayShifts.some((shift) =>
      statusMatchesFilter(shift.assignment_status, statusFilter)
    )
    const maxVisibleStaff = leadVisible ? 2 : 3
    const visibleShifts = filteredStatusStaffShifts.slice(0, maxVisibleStaff)
    const hiddenCount = Math.max(filteredStatusStaffShifts.length - maxVisibleStaff, 0)
    const visibleIssueTags = slotReasons
      .filter((reason) => reason === 'ineligible_lead' || reason === 'multiple_leads')
      .slice(0, 2)
    const previousDay = addDays(day, -1)
    const nextDay = addDays(day, 1)
    const isBoundaryDay =
      inCycle &&
      (previousDay.getMonth() !== day.getMonth() || nextDay.getMonth() !== day.getMonth())
    const dateHeaderLabel = isBoundaryDay
      ? day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : String(day.getDate())
    const palette =
      shiftType === 'day'
        ? {
            border: 'border-sky-200',
            bg: 'bg-sky-50',
            text: 'text-sky-800',
          }
        : {
            border: 'border-indigo-200',
            bg: 'bg-indigo-50',
            text: 'text-indigo-800',
          }
    const leadPalette = {
      border: 'border-amber-300',
      bg: 'bg-amber-50',
      text: 'text-amber-900',
    }

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
          'min-h-36 rounded-xl border border-border bg-white p-2 transition-colors',
          inCycle ? 'cursor-pointer hover:bg-secondary/20' : 'cursor-default bg-muted/40',
          issueFilter !== 'all' && !filterMatch ? 'opacity-45' : ''
        )}
        aria-label={inCycle ? `Open ${shiftType} shift details for ${formatCellDate(date)}` : `${formatCellDate(date)} outside cycle`}
      >
        {options?.showWeekday && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {day.toLocaleDateString('en-US', { weekday: 'short' })}
          </p>
        )}
        <div className="mb-2 flex items-center justify-between">
          <span className={cn('font-semibold text-foreground', isBoundaryDay ? 'text-xs' : 'text-sm')}>
            {dateHeaderLabel}
          </span>
          {inCycle ? (
            <span className={cn('text-[10px] font-semibold uppercase', coverageTone)}>
              {coverageCount}/{MAX_SHIFT_COVERAGE_PER_DAY}
            </span>
          ) : (
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">-</span>
          )}
        </div>
        {inCycle ? (
          <>
            {missingLead && (
              <div className="mb-2 text-[11px] font-medium text-[var(--warning-text)]">Lead missing</div>
            )}
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
              {leadVisible && leadShift && (
                <div
                  key={`lead-${leadShift.id}`}
                  onClick={(event) => event.stopPropagation()}
                  draggable={canManageStaffing}
                  onDragStart={
                    canManageStaffing
                      ? (event) =>
                          setDragData(event, {
                            type: 'shift',
                            shiftId: leadShift.id,
                            shiftType: leadShift.shift_type,
                          })
                      : undefined
                  }
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs',
                    canManageStaffing ? 'cursor-grab active:cursor-grabbing' : '',
                    leadPalette.border,
                    leadPalette.bg,
                    leadPalette.text
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {canEditAssignmentStatus ? (
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={(event) => {
                          event.stopPropagation()
                          openStatusPopoverForShift(leadShift, event.currentTarget)
                        }}
                      >
                        {leadShift.full_name}
                      </button>
                    ) : (
                      <span className="font-medium">{leadShift.full_name}</span>
                    )}
                    {leadShift.assignment_status !== 'scheduled' && (
                      <span className="group relative inline-flex items-center">
                        <span
                          className={cn(
                            'inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                            assignmentStatusTone(leadShift.assignment_status)
                          )}
                        >
                          {assignmentStatusLabel(leadShift.assignment_status)}
                        </span>
                        <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-56 rounded-md border border-border bg-white p-2 text-[10px] text-foreground shadow-md group-hover:block group-focus-within:block">
                          <span className="block font-semibold">
                            {assignmentStatusDescription(leadShift.assignment_status)}
                          </span>
                          <span className="block text-muted-foreground">
                            Updated by {leadShift.status_updated_by_name ?? 'Team member'} - {formatStatusTimestamp(leadShift.status_updated_at)}
                          </span>
                          {leadShift.status_note && (
                            <span className="block truncate text-muted-foreground">{leadShift.status_note}</span>
                          )}
                          {leadShift.assignment_status === 'left_early' && leadShift.left_early_time && (
                            <span className="block text-muted-foreground">Left at {toTimeInputValue(leadShift.left_early_time)}</span>
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )}
              {visibleShifts.map((shift) => (
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
                    'rounded-md border px-2 py-1 text-xs',
                    canManageStaffing ? 'cursor-grab active:cursor-grabbing' : '',
                    palette.border,
                    palette.bg,
                    palette.text
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {canEditAssignmentStatus ? (
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={(event) => {
                          event.stopPropagation()
                          openStatusPopoverForShift(shift, event.currentTarget)
                        }}
                      >
                        {shift.full_name}
                      </button>
                    ) : (
                      <span className="font-medium">{shift.full_name}</span>
                    )}
                    {shift.assignment_status !== 'scheduled' && (
                      <span className="group relative inline-flex items-center">
                        <span
                          className={cn(
                            'inline-flex items-center rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                            assignmentStatusTone(shift.assignment_status)
                          )}
                        >
                          {assignmentStatusLabel(shift.assignment_status)}
                        </span>
                        <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-56 rounded-md border border-border bg-white p-2 text-[10px] text-foreground shadow-md group-hover:block group-focus-within:block">
                          <span className="block font-semibold">
                            {assignmentStatusDescription(shift.assignment_status)}
                          </span>
                          <span className="block text-muted-foreground">
                            Updated by {shift.status_updated_by_name ?? 'Team member'} - {formatStatusTimestamp(shift.status_updated_at)}
                          </span>
                          {shift.status_note && (
                            <span className="block truncate text-muted-foreground">{shift.status_note}</span>
                          )}
                          {shift.assignment_status === 'left_early' && shift.left_early_time && (
                            <span className="block text-muted-foreground">Left at {toTimeInputValue(shift.left_early_time)}</span>
                          )}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    openShiftDrawer(date, shiftType)
                  }}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
                >
                  +{hiddenCount} more
                </button>
              )}
              {dayShifts.length === 0 && <div className="text-xs text-muted-foreground">No therapists assigned</div>}
              {dayShifts.length > 0 && !hasStatusMatchInSlot && (
                <div className="text-xs text-muted-foreground">No matching statuses</div>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Outside cycle</div>
        )}
      </div>
    )
  }

  function renderCalendarForShift(shiftType: 'day' | 'night') {
    return (
      <div className="space-y-2">
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={`continuous-${shiftType}-${day}`} className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </div>
          ))}
          {calendarWeeks.flatMap((week) =>
            week.map((day) => renderShiftDayCell(day, shiftType))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
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
          <Button type="button" size="sm" variant="outline" onClick={() => setStaffingPoolOpen((open) => !open)}>
            {staffingPoolOpen ? 'Hide staffing pool' : 'Show staffing pool'}
          </Button>
        </div>
      )}

      <div className={cn('grid grid-cols-1 gap-4', staffingPoolOpen ? 'xl:grid-cols-[250px_1fr]' : 'xl:grid-cols-1')}>
        {canManageStaffing && staffingPoolOpen && (
          <div className="rounded-2xl border-2 border-border bg-card p-3">
            <h3 className="text-sm font-semibold text-foreground">Staffing pool ({selectedShiftType})</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag therapists onto the {selectedShiftType} calendar cells.
            </p>

            <div className="mt-3 space-y-2">
              {therapistsForPool.map((therapist) => (
                <div
                  key={therapist.id}
                  draggable
                  onDragStart={(event) =>
                    setDragData(event, {
                      type: 'therapist',
                      userId: therapist.id,
                      shiftType: therapist.shift_type,
                    })
                  }
                  className={cn(
                    'cursor-grab rounded-xl border px-3 py-2 text-sm active:cursor-grabbing',
                    selectedShiftType === 'day' ? 'border-sky-200 bg-sky-50' : 'border-indigo-200 bg-indigo-50'
                  )}
                >
                  <div
                    className={cn(
                      'font-medium',
                      selectedShiftType === 'day' ? 'text-sky-900' : 'text-indigo-900'
                    )}
                  >
                    {therapist.full_name}
                  </div>
                  <div
                    className={cn(
                      'text-xs capitalize',
                      selectedShiftType === 'day' ? 'text-sky-700' : 'text-indigo-700'
                    )}
                  >
                    {therapist.shift_type} shift
                  </div>
                </div>
              ))}
              {therapistsForPool.length === 0 && (
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

        <div className="space-y-4 rounded-2xl border-2 border-border bg-card p-2">
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
            <p className="px-1 text-[11px] text-muted-foreground">Swipe left or right to navigate weeks.</p>
            <div
              className="space-y-2"
              onTouchStart={onMobileWeekTouchStart}
              onTouchEnd={onMobileWeekTouchEnd}
            >
              {mobileWeekDays.map((day) => renderShiftDayCell(day, selectedShiftType, { showWeekday: true }))}
            </div>
          </div>

          <div className="hidden space-y-4 md:block">
            <div className="overflow-x-auto">
              {renderCalendarForShift(selectedShiftType)}
            </div>
          </div>
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
            <label htmlFor="assignment-status-select" className="text-[11px] font-medium text-muted-foreground">
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
            <label htmlFor="assignment-status-note" className="text-[11px] font-medium text-muted-foreground">
              Note (optional)
            </label>
            <textarea
              id="assignment-status-note"
              rows={2}
              value={statusDraft.note}
              onChange={(event) =>
                setStatusDraft((current) => (current ? { ...current, note: event.target.value } : current))
              }
              onBlur={() => saveStatusDraft({ closePopover: false })}
              disabled={isStatusSaving}
              className="w-full rounded-md border border-border bg-white px-2 py-1 text-xs"
              placeholder="Add context"
            />
          </div>

          {statusDraft.status === 'left_early' && (
            <div className="mt-2 space-y-1">
              <label htmlFor="assignment-left-early-time" className="text-[11px] font-medium text-muted-foreground">
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
            <Button type="button" size="sm" variant="outline" onClick={closeStatusPopover} disabled={isStatusSaving}>
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

      <Dialog open={Boolean(drawerSlot)} onOpenChange={(open) => !open && closeShiftDrawer()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {drawerSlot ? `${drawerSlot.shiftType === 'day' ? 'Day' : 'Night'} Shift` : 'Shift'}
            </DialogTitle>
            <DialogDescription>
              {drawerSlot ? `${formatCellDate(drawerSlot.date)} - full roster and lead controls` : ''}
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
                        runSetLeadAction({
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
                    <div
                      key={shift.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{shift.full_name}</span>
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
                      </div>
                      {canManageStaffing && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-[var(--warning-text)]"
                          onClick={() =>
                            runDragAction({
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
                  ))}
                </div>

                {canManageStaffing && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <select
                      value={drawerAddTherapistId}
                      onChange={(event) => setDrawerAddTherapistId(event.target.value)}
                      className="h-9 min-w-64 rounded-md border border-border bg-white px-3 text-sm"
                    >
                      <option value="">Add therapist</option>
                      {drawerStaffAddOptions.map((therapist) => (
                        <option key={therapist.id} value={therapist.id}>
                          {therapist.full_name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!drawerAddTherapistId || isPending}
                      onClick={() => {
                        runDragAction({
                          action: 'assign',
                          cycleId,
                          userId: drawerAddTherapistId,
                          shiftType: drawerSlot.shiftType,
                          date: drawerSlot.date,
                          overrideWeeklyRules,
                        })
                        setDrawerAddTherapistId('')
                      }}
                    >
                      Add staff
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
