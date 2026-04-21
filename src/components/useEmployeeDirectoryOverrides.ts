'use client'

import {
  type MouseEvent,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  buildCalendarWeeks,
  formatMonthLabel,
  shiftMonthKey,
  toIsoDate,
  toMonthEndKey,
  toMonthStartKey,
} from '@/lib/calendar-utils'
import { formatEmployeeDate, isDateWithinCycle } from '@/lib/employee-directory'

type EmployeeCycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

type EmployeeDateOverride = {
  id: string
  therapist_id: string
  cycle_id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
  source: 'therapist' | 'manager'
}

export function useEmployeeDirectoryOverrides({
  copyEmployeeShiftsAction,
  currentEmployeeId,
  cycles,
  dateOverrides,
  deleteEmployeeDateOverrideAction,
  initialEditEmployeeId,
  initialFocusAvailability,
  initialOverrideCycleId,
  saveEmployeeDateOverrideAction,
  selectedAvailabilityCycleId,
}: {
  copyEmployeeShiftsAction: (
    prevState: { error: string; employeeId: string } | null,
    formData: FormData
  ) => Promise<{ error: string; employeeId: string } | null>
  currentEmployeeId: string | null
  cycles: EmployeeCycle[]
  dateOverrides: EmployeeDateOverride[]
  deleteEmployeeDateOverrideAction: (
    prevState: { error: string; profileId: string } | null,
    formData: FormData
  ) => Promise<{ error: string; profileId: string } | null>
  initialEditEmployeeId?: string | null
  initialFocusAvailability?: boolean
  initialOverrideCycleId?: string | null
  saveEmployeeDateOverrideAction: (
    prevState: { error: string } | null,
    formData: FormData
  ) => Promise<{ error: string } | null>
  selectedAvailabilityCycleId: string
}) {
  const initialCycleId =
    initialOverrideCycleId && cycles.some((cycle) => cycle.id === initialOverrideCycleId)
      ? initialOverrideCycleId
      : (cycles[0]?.id ?? '')

  const [overrideCycleIdDraft, setOverrideCycleIdDraft] = useState<string>(initialCycleId)
  const [overrideCalendarMonthStart, setOverrideCalendarMonthStart] = useState<string>(() => {
    const initialCycle = cycles.find((cycle) => cycle.id === initialCycleId)
    const baseDate = initialCycle?.start_date ?? toIsoDate(new Date())
    return toMonthStartKey(baseDate)
  })
  const [overrideDateDraft, setOverrideDateDraft] = useState<string>('')
  const [overrideDatesDraft, setOverrideDatesDraft] = useState<string[]>([])
  const [copySourceCycleId, setCopySourceCycleId] = useState<string>(
    cycles[1]?.id ?? cycles[0]?.id ?? ''
  )
  const [copyTargetCycleId, setCopyTargetCycleId] = useState<string>(cycles[0]?.id ?? '')
  const [isCalendarDragging, setIsCalendarDragging] = useState(false)
  const [calendarDragMode, setCalendarDragMode] = useState<'add' | 'remove' | null>(null)
  const calendarDragSeenRef = useRef<Set<string>>(new Set())
  const [focusAvailabilitySection, setFocusAvailabilitySection] = useState(
    Boolean(initialEditEmployeeId && initialFocusAvailability)
  )
  const [overrideDateError, setOverrideDateError] = useState<string | null>(null)
  const [overrideFormState, overrideFormAction] = useActionState(
    saveEmployeeDateOverrideAction,
    null
  )
  const [deleteOverrideFormState, deleteOverrideFormAction] = useActionState(
    deleteEmployeeDateOverrideAction,
    null
  )
  const [copyShiftsFormState, copyShiftsFormAction] = useActionState(copyEmployeeShiftsAction, null)
  const availabilitySectionRef = useRef<HTMLDivElement | null>(null)
  const calendarRef = useRef<HTMLDivElement | null>(null)

  const editEmployeeDateOverrides = useMemo(() => {
    if (!currentEmployeeId) return []
    return dateOverrides
      .filter((row) => row.therapist_id === currentEmployeeId)
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        if (a.shift_type !== b.shift_type) return a.shift_type.localeCompare(b.shift_type)
        return a.cycle_id.localeCompare(b.cycle_id)
      })
  }, [currentEmployeeId, dateOverrides])

  const selectedOverrideCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === overrideCycleIdDraft) ?? null,
    [cycles, overrideCycleIdDraft]
  )
  const overrideCalendarTitle = useMemo(
    () => formatMonthLabel(overrideCalendarMonthStart),
    [overrideCalendarMonthStart]
  )
  const overrideCalendarMonthKey = useMemo(
    () => overrideCalendarMonthStart.slice(0, 7),
    [overrideCalendarMonthStart]
  )
  const overrideCalendarWeeks = useMemo(
    () => buildCalendarWeeks(overrideCalendarMonthStart, toMonthEndKey(overrideCalendarMonthStart)),
    [overrideCalendarMonthStart]
  )
  const selectedOverrideDatesSet = useMemo(() => new Set(overrideDatesDraft), [overrideDatesDraft])
  const canGoPrevMonth = useMemo(() => {
    if (!selectedOverrideCycle) return false
    const prevMonthEnd = toMonthEndKey(shiftMonthKey(overrideCalendarMonthStart, -1))
    return prevMonthEnd >= selectedOverrideCycle.start_date
  }, [selectedOverrideCycle, overrideCalendarMonthStart])
  const canGoNextMonth = useMemo(() => {
    if (!selectedOverrideCycle) return false
    const nextMonthStart = shiftMonthKey(overrideCalendarMonthStart, 1)
    return nextMonthStart <= selectedOverrideCycle.end_date
  }, [selectedOverrideCycle, overrideCalendarMonthStart])

  useEffect(() => {
    if (!currentEmployeeId || !focusAvailabilitySection) return
    availabilitySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentEmployeeId, focusAvailabilitySection])

  useEffect(() => {
    if (!isCalendarDragging) return

    const stopDragging = () => {
      setIsCalendarDragging(false)
      setCalendarDragMode(null)
      calendarDragSeenRef.current.clear()
    }

    window.addEventListener('mouseup', stopDragging)
    window.addEventListener('touchend', stopDragging)
    window.addEventListener('touchcancel', stopDragging)
    return () => {
      window.removeEventListener('mouseup', stopDragging)
      window.removeEventListener('touchend', stopDragging)
      window.removeEventListener('touchcancel', stopDragging)
    }
  }, [isCalendarDragging])

  const applyDateInBatch = useCallback((dateValue: string, mode: 'add' | 'remove') => {
    setOverrideDatesDraft((current) => {
      const alreadyIncluded = current.includes(dateValue)
      if (mode === 'add') {
        if (alreadyIncluded) return current
        const next = [...current, dateValue]
        next.sort((a, b) => a.localeCompare(b))
        return next
      }
      if (!alreadyIncluded) return current
      return current.filter((value) => value !== dateValue)
    })
  }, [])

  useEffect(() => {
    const container = calendarRef.current
    if (!container) return

    const handleTouchMove = (event: TouchEvent) => {
      if (!isCalendarDragging || !calendarDragMode) return
      const touch = event.touches[0]
      if (!touch) return
      event.preventDefault()
      const el = document.elementFromPoint(touch.clientX, touch.clientY)
      const btn = el?.closest('[data-date]') as HTMLElement | null
      const dateValue = btn?.dataset.date
      if (!dateValue) return
      if (!isDateWithinCycle(dateValue, selectedOverrideCycle)) return
      if (calendarDragSeenRef.current.has(dateValue)) return
      calendarDragSeenRef.current.add(dateValue)
      applyDateInBatch(dateValue, calendarDragMode)
    }

    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => container.removeEventListener('touchmove', handleTouchMove)
  }, [applyDateInBatch, calendarDragMode, isCalendarDragging, selectedOverrideCycle])

  const handleCalendarDayMouseDown = useCallback(
    (event: MouseEvent<HTMLButtonElement>, dateValue: string) => {
      if (!isDateWithinCycle(dateValue, selectedOverrideCycle)) return
      event.preventDefault()
      setOverrideDateError(null)
      const mode: 'add' | 'remove' = selectedOverrideDatesSet.has(dateValue) ? 'remove' : 'add'
      setIsCalendarDragging(true)
      setCalendarDragMode(mode)
      calendarDragSeenRef.current = new Set([dateValue])
      applyDateInBatch(dateValue, mode)
    },
    [applyDateInBatch, selectedOverrideCycle, selectedOverrideDatesSet]
  )

  const handleCalendarDayMouseEnter = useCallback(
    (dateValue: string) => {
      if (!isCalendarDragging || !calendarDragMode) return
      if (!isDateWithinCycle(dateValue, selectedOverrideCycle)) return
      if (calendarDragSeenRef.current.has(dateValue)) return
      calendarDragSeenRef.current.add(dateValue)
      applyDateInBatch(dateValue, calendarDragMode)
    },
    [applyDateInBatch, calendarDragMode, isCalendarDragging, selectedOverrideCycle]
  )

  const handleCalendarDayTouchStart = useCallback(
    (dateValue: string) => {
      if (!isDateWithinCycle(dateValue, selectedOverrideCycle)) return
      setOverrideDateError(null)
      const mode: 'add' | 'remove' = selectedOverrideDatesSet.has(dateValue) ? 'remove' : 'add'
      setIsCalendarDragging(true)
      setCalendarDragMode(mode)
      calendarDragSeenRef.current = new Set([dateValue])
      applyDateInBatch(dateValue, mode)
    },
    [applyDateInBatch, selectedOverrideCycle, selectedOverrideDatesSet]
  )

  const addDateToOverrideBatch = useCallback(() => {
    const dateValue = overrideDateDraft.trim()
    if (!dateValue) {
      setOverrideDateError('Choose a date first.')
      return
    }

    if (!isDateWithinCycle(dateValue, selectedOverrideCycle)) {
      const label = selectedOverrideCycle
        ? `${formatEmployeeDate(selectedOverrideCycle.start_date)} to ${formatEmployeeDate(selectedOverrideCycle.end_date)}`
        : ''
      setOverrideDateError(
        selectedOverrideCycle
          ? `Date must be within the selected cycle (${label}).`
          : 'Invalid date.'
      )
      return
    }

    setOverrideDatesDraft((current) => {
      if (current.includes(dateValue)) {
        setOverrideDateError('That date is already in the batch.')
        return current
      }
      const next = [...current, dateValue]
      next.sort((a, b) => a.localeCompare(b))
      return next
    })
    setOverrideDateDraft('')
    setOverrideDateError(null)
  }, [overrideDateDraft, selectedOverrideCycle])

  const openOverridesForEmployee = useCallback(
    (employeeId: string, options?: { focusAvailability?: boolean; cycleId?: string }) => {
      const shouldFocusAvailability = Boolean(options?.focusAvailability)
      setFocusAvailabilitySection(shouldFocusAvailability)
      setOverrideDateDraft('')
      setOverrideDateError(null)
      setIsCalendarDragging(false)
      setCalendarDragMode(null)
      calendarDragSeenRef.current.clear()
      const resolvedCycleId = options?.cycleId ?? selectedAvailabilityCycleId ?? cycles[0]?.id ?? ''
      if (options?.cycleId) {
        setOverrideCycleIdDraft(options.cycleId)
        const selectedCycle = cycles.find((cycle) => cycle.id === options.cycleId)
        if (selectedCycle) {
          setOverrideCalendarMonthStart(toMonthStartKey(selectedCycle.start_date))
        }
      } else {
        const nextCycleId = selectedAvailabilityCycleId || cycles[0]?.id || ''
        setOverrideCycleIdDraft((current) => current || nextCycleId)
        const selectedCycle = cycles.find((cycle) => cycle.id === nextCycleId)
        if (selectedCycle) {
          setOverrideCalendarMonthStart(toMonthStartKey(selectedCycle.start_date))
        }
      }
      setOverrideDatesDraft(
        dateOverrides
          .filter((row) => row.therapist_id === employeeId && row.cycle_id === resolvedCycleId)
          .map((row) => row.date)
          .sort((a, b) => a.localeCompare(b))
      )
    },
    [cycles, dateOverrides, selectedAvailabilityCycleId]
  )

  const resetOverridesState = useCallback(() => {
    setFocusAvailabilitySection(false)
    const resetCycleId = selectedAvailabilityCycleId
    setOverrideCycleIdDraft(resetCycleId)
    const resetCycle = cycles.find((cycle) => cycle.id === resetCycleId)
    if (resetCycle) {
      setOverrideCalendarMonthStart(toMonthStartKey(resetCycle.start_date))
    }
    setOverrideDateDraft('')
    setOverrideDatesDraft([])
    setOverrideDateError(null)
    setIsCalendarDragging(false)
    setCalendarDragMode(null)
    calendarDragSeenRef.current.clear()
  }, [cycles, selectedAvailabilityCycleId])

  const handleOverrideCycleChange = useCallback(
    (employeeId: string, nextCycleId: string) => {
      setOverrideCycleIdDraft(nextCycleId)
      const nextCycle = cycles.find((cycle) => cycle.id === nextCycleId) ?? null
      if (nextCycle) {
        setOverrideCalendarMonthStart(toMonthStartKey(nextCycle.start_date))
      }
      setOverrideDatesDraft(
        dateOverrides
          .filter((row) => row.therapist_id === employeeId && row.cycle_id === nextCycleId)
          .map((row) => row.date)
          .sort((a, b) => a.localeCompare(b))
      )
      setOverrideDateError(null)
    },
    [cycles, dateOverrides]
  )

  return {
    addDateToOverrideBatch,
    availabilitySectionRef,
    calendarRef,
    canGoNextMonth,
    canGoPrevMonth,
    copyShiftsFormAction,
    copyShiftsFormState,
    copySourceCycleId,
    copyTargetCycleId,
    deleteOverrideFormAction,
    deleteOverrideFormState,
    editEmployeeDateOverrides,
    focusAvailabilitySection,
    handleCalendarDayMouseDown,
    handleCalendarDayMouseEnter,
    handleCalendarDayTouchStart,
    handleOverrideCycleChange,
    openOverridesForEmployee,
    overrideCalendarMonthKey,
    overrideCalendarTitle,
    overrideCalendarWeeks,
    overrideCycleIdDraft,
    overrideDateDraft,
    overrideDateError,
    overrideDatesDraft,
    overrideFormAction,
    overrideFormState,
    resetOverridesState,
    selectedOverrideCycle,
    selectedOverrideDatesSet,
    setCopySourceCycleId,
    setCopyTargetCycleId,
    setOverrideCalendarMonthStart,
    setOverrideDateDraft,
    setOverrideDateError,
    setOverrideDatesDraft,
  }
}
