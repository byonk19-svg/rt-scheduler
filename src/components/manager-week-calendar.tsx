'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FeedbackToast } from '@/components/feedback-toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MAX_SHIFT_COVERAGE_PER_DAY, MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'
import type { CalendarShift } from '@/app/schedule/types'

type IssueFilter =
  | 'all'
  | 'missing_lead'
  | 'under_coverage'
  | 'over_coverage'
  | 'ineligible_lead'
  | 'multiple_leads'

type AssignmentStatus = CalendarShift['assignment_status']

type AssignmentStatusSnapshot = {
  assignmentId: string
  status: AssignmentStatus
  note: string | null
  leftEarlyTime: string | null
}

type StatusPopoverState = {
  assignmentId: string
  date: string
  shiftType: 'day' | 'night'
  therapistName: string
  anchorRect: DOMRect
  snapshot: AssignmentStatusSnapshot
}

type ManagerWeekCalendarProps = {
  cycleId: string
  startDate: string
  endDate: string
  shifts: CalendarShift[]
  issueFilter?: IssueFilter
  focusSlotKey?: string | null
  issueReasonsBySlot?: Record<
    string,
    Array<
      'under_coverage' | 'over_coverage' | 'missing_lead' | 'multiple_leads' | 'ineligible_lead'
    >
  >
  defaultShiftType?: 'day' | 'night'
  canEditAssignmentStatus?: boolean
  canViewAvailabilityOverride?: boolean
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

function buildCalendarWeeks(startDate: string, endDate: string): Date[][] {
  const start = dateFromKey(startDate)
  const end = dateFromKey(endDate)
  const weeks: Date[][] = []
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return weeks

  const gridStart = startOfWeek(start)
  const gridEnd = endOfWeek(end)
  const cursor = new Date(gridStart)

  while (cursor <= gridEnd) {
    const week: Date[] = []
    for (let index = 0; index < 7; index += 1) week.push(addDays(cursor, index))
    weeks.push(week)
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

function formatWeekRange(week: Date[]): string {
  const start = week[0]
  const end = week[6]
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' }
  )}`
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
  if (Number.isNaN(parsed.getTime()))
    return `${date} · ${shiftType === 'day' ? 'Day' : 'Night'} shift · ${therapistName}`
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

function countsTowardCoverage(status: CalendarShift['status']): boolean {
  return status === 'scheduled' || status === 'on_call'
}

function statusDraftChanged(
  draft: { status: AssignmentStatus; note: string; leftEarlyTime: string },
  snapshot: AssignmentStatusSnapshot
): boolean {
  const draftNote = draft.note.trim()
  const snapshotNote = (snapshot.note ?? '').trim()
  const draftTime = draft.status === 'left_early' ? draft.leftEarlyTime.trim() : ''
  const snapshotTime = snapshot.status === 'left_early' ? (snapshot.leftEarlyTime ?? '').trim() : ''
  return (
    draft.status !== snapshot.status || draftNote !== snapshotNote || draftTime !== snapshotTime
  )
}

function assignmentStatusTooltip(shift: CalendarShift): string | null {
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

export function ManagerWeekCalendar({
  cycleId,
  startDate,
  endDate,
  shifts,
  issueFilter = 'all',
  focusSlotKey = null,
  issueReasonsBySlot = {},
  defaultShiftType = 'day',
  canEditAssignmentStatus = false,
  canViewAvailabilityOverride = false,
}: ManagerWeekCalendarProps) {
  const [selectedShiftType, setSelectedShiftType] = useState<'day' | 'night'>(() => {
    const focusShiftType = focusSlotKey?.split(':')[1]
    if (focusShiftType === 'night') return 'night'
    return defaultShiftType
  })
  const [localShifts, setLocalShifts] = useState(shifts)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusUndoSnapshot, setStatusUndoSnapshot] = useState<AssignmentStatusSnapshot | null>(
    null
  )
  const [toastState, setToastState] = useState<{
    id: number
    message: string
    variant: 'success' | 'error'
  } | null>(null)
  const [statusPopover, setStatusPopover] = useState<StatusPopoverState | null>(null)
  const [statusDraft, setStatusDraft] = useState<{
    status: AssignmentStatus
    note: string
    leftEarlyTime: string
  } | null>(null)
  const [isStatusSaving, setIsStatusSaving] = useState(false)
  const isStatusSavingRef = useRef(false)
  const statusPopoverRef = useRef<HTMLDivElement | null>(null)
  const [statusPopoverPosition, setStatusPopoverPosition] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const calendarWeeks = useMemo(() => buildCalendarWeeks(startDate, endDate), [startDate, endDate])
  const weekStartKeys = useMemo(
    () =>
      calendarWeeks
        .map((week) => keyFromDate(week[0]))
        .filter((value, index, list) => list.indexOf(value) === index),
    [calendarWeeks]
  )

  const initialWeekStart = useMemo(() => {
    const focusDate = focusSlotKey?.split(':')[0]
    if (focusDate && /^\d{4}-\d{2}-\d{2}$/.test(focusDate)) {
      return keyFromDate(startOfWeek(dateFromKey(focusDate)))
    }
    const today = keyFromDate(new Date())
    if (today >= startDate && today <= endDate) return keyFromDate(startOfWeek(dateFromKey(today)))
    return weekStartKeys[0] ?? keyFromDate(startOfWeek(dateFromKey(startDate)))
  }, [endDate, focusSlotKey, startDate, weekStartKeys])

  const [selectedWeekStart, setSelectedWeekStart] = useState(initialWeekStart)

  useEffect(() => {
    setLocalShifts(shifts)
  }, [shifts])

  useEffect(() => {
    if (!weekStartKeys.includes(selectedWeekStart)) {
      setSelectedWeekStart(weekStartKeys[0] ?? initialWeekStart)
    }
  }, [initialWeekStart, selectedWeekStart, weekStartKeys])

  useEffect(() => {
    if (!focusSlotKey) return
    const [focusDate, focusShiftType] = focusSlotKey.split(':')
    if (!focusDate || (focusShiftType !== 'day' && focusShiftType !== 'night')) return
    setSelectedShiftType(focusShiftType)
    setSelectedWeekStart(keyFromDate(startOfWeek(dateFromKey(focusDate))))
  }, [focusSlotKey])

  const selectedWeekIndex = Math.max(weekStartKeys.indexOf(selectedWeekStart), 0)
  const selectedWeek = calendarWeeks[selectedWeekIndex] ?? calendarWeeks[0] ?? []

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, CalendarShift[]>()
    for (const shift of localShifts) {
      const list = map.get(shift.date) ?? []
      list.push(shift)
      map.set(shift.date, list)
    }
    return map
  }, [localShifts])

  useEffect(() => {
    if (!statusPopover) {
      setStatusPopoverPosition(null)
      return
    }

    const updatePosition = () => {
      const viewportPadding = 12
      const estimatedWidth = 280
      const estimatedHeight = statusDraft?.status === 'left_early' ? 320 : 280
      const top = statusPopover.anchorRect.bottom + 8
      const maxLeft = window.innerWidth - estimatedWidth - viewportPadding
      const left = Math.min(Math.max(statusPopover.anchorRect.left, viewportPadding), maxLeft)
      const safeTop =
        top + estimatedHeight > window.innerHeight - viewportPadding
          ? Math.max(viewportPadding, statusPopover.anchorRect.top - estimatedHeight - 8)
          : top
      setStatusPopoverPosition({ top: safeTop, left, width: estimatedWidth })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [statusDraft?.status, statusPopover])

  useEffect(() => {
    if (!statusPopover) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (statusPopoverRef.current?.contains(target)) return
      setStatusPopover(null)
      setStatusDraft(null)
    }
    const onEscape = (event: KeyboardEvent) => {
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

  useEffect(() => {
    if (!focusSlotKey) return
    const [focusDate, focusShiftType] = focusSlotKey.split(':')
    if (!focusDate || (focusShiftType !== 'day' && focusShiftType !== 'night')) return
    if (focusShiftType !== selectedShiftType) return
    const element = document.getElementById(`week-slot-card-${focusDate}-${focusShiftType}`)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.classList.add('ring-2', 'ring-primary')
    const timeout = window.setTimeout(() => {
      element.classList.remove('ring-2', 'ring-primary')
    }, 1800)
    return () => window.clearTimeout(timeout)
  }, [focusSlotKey, selectedShiftType, selectedWeekStart])

  function openStatusPopoverForShift(shift: CalendarShift, anchor: HTMLElement) {
    if (!canEditAssignmentStatus) return
    setStatusPopover({
      assignmentId: shift.id,
      date: shift.date,
      shiftType: shift.shift_type,
      therapistName: shift.full_name,
      anchorRect: anchor.getBoundingClientRect(),
      snapshot: {
        assignmentId: shift.id,
        status: shift.assignment_status,
        note: shift.status_note,
        leftEarlyTime: toTimeInputValue(shift.left_early_time),
      },
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
    setStatusPopoverPosition(null)
  }

  async function runStatusUpdate(
    payload: { status: AssignmentStatus; note: string; leftEarlyTime: string },
    options?: { closePopover?: boolean; captureUndo?: boolean }
  ) {
    if (!statusPopover) return
    if (isStatusSavingRef.current) return

    const previous = statusPopover.snapshot
    const previousShift =
      localShifts.find((shift) => shift.id === statusPopover.assignmentId) ?? null
    const optimisticNote = payload.note.trim() || null
    const optimisticLeftEarlyTime =
      payload.status === 'left_early' ? payload.leftEarlyTime || null : null

    if (previousShift) {
      setLocalShifts((current) =>
        current.map((shift) =>
          shift.id === statusPopover.assignmentId
            ? {
                ...shift,
                assignment_status: payload.status,
                status_note: optimisticNote,
                left_early_time: optimisticLeftEarlyTime,
                status_updated_at: new Date().toISOString(),
              }
            : shift
        )
      )
    }

    isStatusSavingRef.current = true
    setIsStatusSaving(true)
    setError('')
    try {
      const response = await fetch('/api/schedule/assignment-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: statusPopover.assignmentId,
          status: payload.status,
          note: payload.note.trim() || null,
          leftEarlyTime: payload.status === 'left_early' ? payload.leftEarlyTime || null : null,
        }),
      })

      const responseText = await response.text()
      let responseBody: { assignment?: CalendarShift; error?: string } = {}
      if (responseText.trim()) {
        try {
          responseBody = JSON.parse(responseText) as { assignment?: CalendarShift; error?: string }
        } catch {
          responseBody = { error: responseText.slice(0, 200) }
        }
      }

      if (!response.ok || !responseBody.assignment) {
        throw new Error(responseBody.error || 'Could not save assignment status.')
      }

      const updated = responseBody.assignment
      setLocalShifts((current) =>
        current.map((shift) =>
          shift.id === statusPopover.assignmentId
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

      if (options?.captureUndo !== false) {
        setStatusUndoSnapshot(previous)
      }
      setSuccess(`Marked ${assignmentStatusDescription(updated.assignment_status)}.`)
      setStatusPopover((current) =>
        current
          ? {
              ...current,
              snapshot: {
                assignmentId: current.assignmentId,
                status: updated.assignment_status,
                note: updated.status_note,
                leftEarlyTime: toTimeInputValue(updated.left_early_time),
              },
            }
          : current
      )
      setStatusDraft({
        status: updated.assignment_status,
        note: updated.status_note ?? '',
        leftEarlyTime: toTimeInputValue(updated.left_early_time),
      })

      if (options?.closePopover ?? true) {
        closeStatusPopover()
      }
    } catch (statusError) {
      if (previousShift) {
        setLocalShifts((current) =>
          current.map((shift) => (shift.id === statusPopover.assignmentId ? previousShift : shift))
        )
      }
      setError(
        statusError instanceof Error ? statusError.message : 'Could not save assignment status.'
      )
      setToastState({
        id: Date.now(),
        message: 'Could not save status change. Rolled back local update.',
        variant: 'error',
      })
    } finally {
      isStatusSavingRef.current = false
      setIsStatusSaving(false)
    }
  }

  async function saveStatusDraft(options?: { closePopover?: boolean }) {
    if (!statusPopover || !statusDraft) return
    if (!statusDraftChanged(statusDraft, statusPopover.snapshot)) {
      if (options?.closePopover ?? true) closeStatusPopover()
      return
    }
    await runStatusUpdate(statusDraft, { closePopover: options?.closePopover ?? true })
  }

  async function handleStatusSelect(nextStatus: AssignmentStatus) {
    if (!statusPopover || !statusDraft) return
    const nextDraft = {
      status: nextStatus,
      note: statusDraft.note,
      leftEarlyTime: nextStatus === 'left_early' ? statusDraft.leftEarlyTime : '',
    }
    setStatusDraft(nextDraft)
    await runStatusUpdate(nextDraft, { closePopover: false })
  }

  async function handleResetToScheduled() {
    if (!statusPopover) return
    await runStatusUpdate(
      {
        status: 'scheduled',
        note: '',
        leftEarlyTime: '',
      },
      { closePopover: false }
    )
  }

  async function runUndoStatusUpdate() {
    if (!statusUndoSnapshot) return
    await runStatusUpdate(
      {
        status: statusUndoSnapshot.status,
        note: statusUndoSnapshot.note ?? '',
        leftEarlyTime: statusUndoSnapshot.leftEarlyTime ?? '',
      },
      { closePopover: false, captureUndo: false }
    )
    setStatusUndoSnapshot(null)
  }

  const shiftPalette =
    selectedShiftType === 'day'
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

  const canGoPrev = selectedWeekIndex > 0
  const canGoNext = selectedWeekIndex < weekStartKeys.length - 1

  return (
    <div className="space-y-4">
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

      <div className="space-y-4 rounded-2xl border-2 border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={selectedShiftType === 'day' ? 'bg-primary text-primary-foreground' : ''}
              onClick={() => setSelectedShiftType('day')}
            >
              Day
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={selectedShiftType === 'night' ? 'bg-primary text-primary-foreground' : ''}
              onClick={() => setSelectedShiftType('night')}
            >
              Night
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canGoPrev}
              onClick={() =>
                setSelectedWeekStart(weekStartKeys[selectedWeekIndex - 1] ?? selectedWeekStart)
              }
            >
              Previous week
            </Button>
            <span>
              {selectedWeek.length > 0 ? formatWeekRange(selectedWeek) : 'No week selected'}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canGoNext}
              onClick={() =>
                setSelectedWeekStart(weekStartKeys[selectedWeekIndex + 1] ?? selectedWeekStart)
              }
            >
              Next week
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 gap-2">
            {selectedWeek.map((day) => {
              const date = keyFromDate(day)
              const inCycle = date >= startDate && date <= endDate
              const dayShifts = inCycle
                ? (shiftsByDate.get(date) ?? [])
                    .filter((shift) => shift.shift_type === selectedShiftType)
                    .sort((a, b) => {
                      if (a.role !== b.role) return a.role === 'lead' ? -1 : 1
                      return a.full_name.localeCompare(b.full_name)
                    })
                : []
              const lead = dayShifts.find((shift) => shift.role === 'lead') ?? null
              const coverageCount = dayShifts.filter((shift) =>
                countsTowardCoverage(shift.status)
              ).length
              const hasEligibleCoverage = dayShifts.some(
                (shift) => countsTowardCoverage(shift.status) && shift.isLeadEligible
              )
              const missingLead = !lead || !hasEligibleCoverage
              const underCoverage = coverageCount < MIN_SHIFT_COVERAGE_PER_DAY
              const overCoverage = coverageCount > MAX_SHIFT_COVERAGE_PER_DAY
              const slotKey = `${date}:${selectedShiftType}`
              const derivedReasons: Array<
                | 'under_coverage'
                | 'over_coverage'
                | 'missing_lead'
                | 'multiple_leads'
                | 'ineligible_lead'
              > = []
              if (underCoverage) derivedReasons.push('under_coverage')
              if (overCoverage) derivedReasons.push('over_coverage')
              if (missingLead) derivedReasons.push('missing_lead')
              const reasons = issueReasonsBySlot[slotKey] ?? derivedReasons
              const filterMatch = !inCycle || issueFilter === 'all' || reasons.includes(issueFilter)
              const isFocused = focusSlotKey === slotKey
              const weekDayLabel = day.toLocaleDateString('en-US', { weekday: 'short' })
              const dayLabel = day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

              return (
                <div
                  key={`${slotKey}-week`}
                  id={`week-slot-card-${date}-${selectedShiftType}`}
                  className={cn(
                    'min-h-[280px] rounded-xl border border-border bg-white p-2 text-xs',
                    !inCycle ? 'bg-muted/40 text-muted-foreground' : '',
                    issueFilter !== 'all' && !filterMatch ? 'opacity-45' : '',
                    isFocused ? 'ring-2 ring-primary' : ''
                  )}
                >
                  <div className="mb-2 border-b border-border pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {weekDayLabel}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{dayLabel}</p>
                    {inCycle ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span
                          className={cn(
                            'rounded border px-1 py-0.5 text-[10px] font-semibold',
                            underCoverage
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : overCoverage
                                ? 'border-red-300 bg-red-50 text-red-800'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          )}
                        >
                          {coverageCount}/{MAX_SHIFT_COVERAGE_PER_DAY}
                        </span>
                        <span
                          className={cn(
                            'rounded border px-1 py-0.5 text-[10px] font-semibold',
                            missingLead
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          )}
                        >
                          {missingLead ? 'Lead missing' : 'Lead set'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Outside cycle</span>
                    )}
                  </div>

                  {inCycle && (
                    <div className="space-y-1">
                      {dayShifts.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No therapists assigned</p>
                      ) : (
                        dayShifts.map((shift) => {
                          const chipTone =
                            shift.role === 'lead'
                              ? 'border-amber-300 bg-amber-50 text-amber-900'
                              : `${shiftPalette.border} ${shiftPalette.bg} ${shiftPalette.text}`

                          return (
                            <div
                              key={shift.id}
                              className={cn('rounded-md border px-2 py-1', chipTone)}
                            >
                              <div className="flex items-center gap-1.5">
                                {canEditAssignmentStatus ? (
                                  <button
                                    type="button"
                                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    onClick={(event) =>
                                      openStatusPopoverForShift(shift, event.currentTarget)
                                    }
                                  >
                                    {shift.full_name}
                                  </button>
                                ) : (
                                  <span className="font-medium">{shift.full_name}</span>
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
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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
            <label
              htmlFor={`week-assignment-status-select-${cycleId}`}
              className="text-[11px] font-medium text-muted-foreground"
            >
              Status
            </label>
            <select
              id={`week-assignment-status-select-${cycleId}`}
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
              htmlFor={`week-assignment-status-note-${cycleId}`}
              className="text-[11px] font-medium text-muted-foreground"
            >
              Note (optional)
            </label>
            <textarea
              id={`week-assignment-status-note-${cycleId}`}
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
                htmlFor={`week-assignment-left-early-time-${cycleId}`}
                className="text-[11px] font-medium text-muted-foreground"
              >
                Left at (optional)
              </label>
              <input
                id={`week-assignment-left-early-time-${cycleId}`}
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
    </div>
  )
}
