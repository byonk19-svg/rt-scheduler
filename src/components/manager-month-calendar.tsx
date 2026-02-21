'use client'

import { useMemo, useState, useTransition } from 'react'
import type { DragEvent } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

type Therapist = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
}

type Shift = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  user_id: string
  full_name: string
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

const MIN_SHIFT_COVERAGE_PER_DAY = 3
const MAX_SHIFT_COVERAGE_PER_DAY = 5

type DragActionResponse = {
  message?: string
  error?: string
  undoAction?: DragActionBody
}

type ManagerMonthCalendarProps = {
  cycleId: string
  startDate: string
  endDate: string
  therapists: Therapist[]
  shifts: Shift[]
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

function monthKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function monthLabel(value: string): string {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function buildMonthOptions(startDate: string, endDate: string): string[] {
  const start = dateFromKey(startDate)
  const end = dateFromKey(endDate)
  const options: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cursor <= last) {
    options.push(monthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return options
}

function buildCalendarGrid(month: string): Date[] {
  const [year, rawMonth] = month.split('-').map(Number)
  const firstDay = new Date(year, rawMonth - 1, 1)
  const lastDay = new Date(year, rawMonth, 0)

  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstDay.getDay())

  const gridEnd = new Date(lastDay)
  gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()))

  const days: Date[] = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function ManagerMonthCalendar({
  cycleId,
  startDate,
  endDate,
  therapists,
  shifts,
}: ManagerMonthCalendarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [undoAction, setUndoAction] = useState<DragActionBody | null>(null)
  const [overrideWeeklyRules, setOverrideWeeklyRules] = useState(false)

  const monthOptions = useMemo(() => buildMonthOptions(startDate, endDate), [startDate, endDate])
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0] ?? monthKey(new Date()))

  const days = useMemo(() => buildCalendarGrid(selectedMonth), [selectedMonth])
  const selectedMonthDate = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    return new Date(year, month - 1, 1)
  }, [selectedMonth])

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

  const isInCycle = (date: string): boolean => date >= startDate && date <= endDate
  const countsTowardCoverage = (status: Shift['status']): boolean =>
    status === 'scheduled' || status === 'on_call'

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

  function allowDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function onDropDate(event: DragEvent<HTMLDivElement>, date: string, targetShiftType: 'day' | 'night') {
    event.preventDefault()
    if (!isInCycle(date)) {
      setError('That date is outside the selected schedule cycle.')
      return
    }

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

  function renderCalendarForShift(shiftType: 'day' | 'night') {
    const palette =
      shiftType === 'day'
        ? {
            border: 'border-sky-200',
            bg: 'bg-sky-50',
            text: 'text-sky-800',
            heading: 'text-sky-900',
          }
        : {
            border: 'border-indigo-200',
            bg: 'bg-indigo-50',
            text: 'text-indigo-800',
            heading: 'text-indigo-900',
          }

    return (
      <div className="space-y-2">
        <div className={cn('px-2 text-sm font-semibold capitalize', palette.heading)}>
          {shiftType} Shift Calendar
        </div>
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={`${shiftType}-${day}`} className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const date = keyFromDate(day)
            const dayShifts = (shiftsByDate.get(date) ?? []).filter((shift) => shift.shift_type === shiftType)
            const coverageCount = dayShifts.filter((shift) => countsTowardCoverage(shift.status)).length
            const inSelectedMonth = day.getMonth() === selectedMonthDate.getMonth()
            const inCycle = isInCycle(date)
            const shouldRenderDate = inSelectedMonth && inCycle
            const coverageTone =
              coverageCount < MIN_SHIFT_COVERAGE_PER_DAY
                ? 'text-amber-700'
                : coverageCount > MAX_SHIFT_COVERAGE_PER_DAY
                ? 'text-red-700'
                : 'text-emerald-700'

            if (!shouldRenderDate) {
              return <div key={`${shiftType}-${date}`} className="min-h-40" aria-hidden="true" />
            }

            return (
              <div
                key={`${shiftType}-${date}`}
                onDragEnter={allowDrop}
                onDragOver={allowDrop}
                onDrop={(event) => onDropDate(event, date, shiftType)}
                className={cn(
                  'min-h-40 rounded-xl border border-border bg-white p-2'
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{day.getDate()}</span>
                  <span className={cn('text-[10px] font-semibold uppercase', coverageTone)}>
                    {coverageCount}/{MIN_SHIFT_COVERAGE_PER_DAY}-{MAX_SHIFT_COVERAGE_PER_DAY}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      draggable
                      onDragStart={(event) =>
                        setDragData(event, {
                          type: 'shift',
                          shiftId: shift.id,
                          shiftType: shift.shift_type,
                        })
                      }
                      className={cn(
                        'cursor-grab rounded-lg border px-2 py-1 text-xs active:cursor-grabbing',
                        palette.border,
                        palette.bg,
                        palette.text
                      )}
                    >
                      <div className="font-medium">{shift.full_name}</div>
                      <div className="capitalize opacity-80">
                        {shift.shift_type} - {shift.status}
                      </div>
                    </div>
                  ))}
                  {dayShifts.length === 0 && (
                    <div className="text-xs text-muted-foreground">No {shiftType} shifts</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="month-select" className="text-sm font-medium text-foreground">
            Month
          </label>
          <select
            id="month-select"
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={overrideWeeklyRules}
            onChange={(event) => setOverrideWeeklyRules(event.target.checked)}
          />
          Override scheduling limits while dragging
        </label>
      </div>

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
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[250px_1fr]">
        <div className="rounded-2xl border-2 border-border bg-card p-3">
          <h3 className="text-sm font-semibold text-foreground">Drag therapists onto calendars</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Drop any therapist onto either calendar to schedule or switch shifts.
          </p>

          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Day Team</p>
            <div className="space-y-2">
              {dayTherapists.map((therapist) => (
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
                  className="cursor-grab rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm active:cursor-grabbing"
                >
                  <div className="font-medium text-sky-900">{therapist.full_name}</div>
                  <div className="text-xs capitalize text-sky-700">{therapist.shift_type} shift</div>
                </div>
              ))}
              {dayTherapists.length === 0 && (
                <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  No day therapists available.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Night Team</p>
            <div className="space-y-2">
              {nightTherapists.map((therapist) => (
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
                  className="cursor-grab rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm active:cursor-grabbing"
                >
                  <div className="font-medium text-indigo-900">{therapist.full_name}</div>
                  <div className="text-xs capitalize text-indigo-700">{therapist.shift_type} shift</div>
                </div>
              ))}
              {nightTherapists.length === 0 && (
                <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  No night therapists available.
                </p>
              )}
            </div>
          </div>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDropRemove}
            className="mt-4 rounded-xl border-2 border-dashed border-red-300 bg-red-50 px-3 py-3"
          >
            <div className="text-sm font-semibold text-red-700">Remove from day</div>
            <p className="mt-1 text-xs text-red-600">
              Drag a shift card here to pull that employee off that day.
            </p>
          </div>
        </div>

        <div className="space-y-4 overflow-auto rounded-2xl border-2 border-border bg-card p-2">
          <div className="px-2 text-sm font-semibold text-foreground">
            {selectedMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>

          {renderCalendarForShift('day')}
          {renderCalendarForShift('night')}
        </div>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Saving changes...</p>}
    </div>
  )
}
