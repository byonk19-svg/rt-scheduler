'use client'

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'

import {
  buildMissingAvailabilityRows,
  filterEmployeeDirectoryRecords,
  formatEmployeeDate,
  isDateWithinCycle,
  isFmlaReturnDateEnabled,
  normalizeFmlaReturnDate,
  type EmployeeDirectoryRecord,
  type EmployeeDirectoryTab,
} from '@/lib/employee-directory'
import {
  buildCalendarWeeks,
  formatMonthLabel,
  shiftMonthKey,
  toIsoDate,
  toMonthEndKey,
  toMonthStartKey,
} from '@/lib/calendar-utils'
import { EMPLOYEE_META_BADGE_CLASS, LEAD_ELIGIBLE_BADGE_CLASS } from '@/lib/employee-tag-badges'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormSubmitButton } from '@/components/form-submit-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type EmployeeDirectoryProps = {
  employees: EmployeeDirectoryRecord[]
  cycles: Array<{
    id: string
    label: string
    start_date: string
    end_date: string
    published: boolean
  }>
  dateOverrides: Array<{
    id: string
    therapist_id: string
    cycle_id: string
    date: string
    shift_type: 'day' | 'night' | 'both'
    override_type: 'force_off' | 'force_on'
    note: string | null
    created_at: string
    source: 'therapist' | 'manager'
  }>
  initialEditEmployeeId?: string | null
  initialFocusAvailability?: boolean
  initialOverrideCycleId?: string | null
  saveEmployeeAction: (formData: FormData) => void | Promise<void>
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
  saveEmployeeDateOverrideAction: (formData: FormData) => void | Promise<void>
  deleteEmployeeDateOverrideAction: (formData: FormData) => void | Promise<void>
  copyEmployeeShiftsAction: (formData: FormData) => void | Promise<void>
}

type DirectorySortKey = 'employee' | 'shift' | 'type' | 'tags'
type SortDirection = 'asc' | 'desc'
type SortColumnLabel = 'Employee' | 'Shift/Team' | 'Type' | 'Tags'

const TABS: Array<{ value: EmployeeDirectoryTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
]
const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

function employmentLabel(value: EmployeeDirectoryRecord['employment_type']): string {
  if (value === 'part_time') return 'Part-time'
  if (value === 'prn') return 'PRN'
  return 'Full-time'
}

function weekdayLabel(values: number[]): string {
  if (values.length === 0) return 'Any day'
  const byValue = new Map(WEEKDAY_OPTIONS.map((option) => [option.value, option.label]))
  return values
    .filter((value) => byValue.has(value))
    .map((value) => byValue.get(value) ?? '')
    .filter((value) => value.length > 0)
    .join(', ')
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
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

function ShiftBadge({ shiftType }: { shiftType: EmployeeDirectoryRecord['shift_type'] }) {
  return (
    <Badge variant="outline" className={cn('capitalize', EMPLOYEE_META_BADGE_CLASS)}>
      {shiftType}
    </Badge>
  )
}

function SortHeaderButton({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: SortColumnLabel
  column: DirectorySortKey
  sortKey: DirectorySortKey
  sortDirection: SortDirection
  onSort: (key: DirectorySortKey) => void
}) {
  const isActive = sortKey === column

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition-colors',
        isActive
          ? 'bg-secondary text-foreground shadow-[inset_0_0_0_1px_var(--border)]'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label} ${isActive ? `(currently ${sortDirection})` : ''}`}
    >
      <span>{label}</span>
      {isActive ? (
        sortDirection === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-primary" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
      )}
    </button>
  )
}

function EmployeeActionsMenu({
  employee,
  onEdit,
  onDeactivate,
  setEmployeeActiveAction,
}: {
  employee: EmployeeDirectoryRecord
  onEdit: () => void
  onDeactivate: () => void
  setEmployeeActiveAction: (formData: FormData) => void | Promise<void>
}) {
  return (
    <details className="relative" onClick={(event) => event.stopPropagation()}>
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-white text-sm hover:bg-secondary">
        ...
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-border bg-white p-1 shadow-sm">
        <button
          type="button"
          className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
          onClick={(event) => {
            event.preventDefault()
            onEdit()
          }}
        >
          Edit
        </button>
        {employee.is_active ? (
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-[var(--warning-text)] hover:bg-secondary"
            onClick={(event) => {
              event.preventDefault()
              onDeactivate()
            }}
          >
            Deactivate
          </button>
        ) : (
          <form action={setEmployeeActiveAction}>
            <input type="hidden" name="profile_id" value={employee.id} />
            <input type="hidden" name="set_active" value="true" />
            <FormSubmitButton
              type="submit"
              variant="ghost"
              size="sm"
              pendingText="Reactivating..."
              className="block w-full justify-start rounded px-2 py-1.5 text-left text-sm text-[var(--success-text)] hover:bg-secondary"
            >
              Reactivate
            </FormSubmitButton>
          </form>
        )}
        <div className="my-1 h-px bg-border" />
        <span className="block px-2 py-1 text-xs text-muted-foreground">
          Delete is replaced by deactivate.
        </span>
      </div>
    </details>
  )
}

export function EmployeeDirectory({
  employees,
  cycles,
  dateOverrides,
  initialEditEmployeeId = null,
  initialFocusAvailability = false,
  initialOverrideCycleId = null,
  saveEmployeeAction,
  setEmployeeActiveAction,
  saveEmployeeDateOverrideAction,
  deleteEmployeeDateOverrideAction,
  copyEmployeeShiftsAction,
}: EmployeeDirectoryProps) {
  const initialCycleId =
    initialOverrideCycleId && cycles.some((cycle) => cycle.id === initialOverrideCycleId)
      ? initialOverrideCycleId
      : (cycles[0]?.id ?? '')
  const [tab, setTab] = useState<EmployeeDirectoryTab>('all')
  const [searchText, setSearchText] = useState('')
  const [leadOnly, setLeadOnly] = useState(false)
  const [fmlaOnly, setFmlaOnly] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [sortKey, setSortKey] = useState<DirectorySortKey>('employee')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [availabilityCycleId, setAvailabilityCycleId] = useState<string>('')
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
  const [collapsedMissing, setCollapsedMissing] = useState(false)
  const [editState, setEditState] = useState<{
    employeeId: string
    onFmla: boolean
    weekendRotation: 'none' | 'every_other'
    worksDowMode: 'hard' | 'soft'
  } | null>(() => {
    if (!initialEditEmployeeId) return null
    const employee = employees.find((row) => row.id === initialEditEmployeeId)
    if (!employee) return null
    return {
      employeeId: employee.id,
      onFmla: employee.on_fmla,
      weekendRotation: employee.weekend_rotation,
      worksDowMode: employee.works_dow_mode,
    }
  })
  const [deactivateEmployeeId, setDeactivateEmployeeId] = useState<string | null>(null)
  const [overrideDateError, setOverrideDateError] = useState<string | null>(null)
  const availabilitySectionRef = useRef<HTMLDivElement | null>(null)
  const calendarRef = useRef<HTMLDivElement | null>(null)
  const selectedAvailabilityCycleId = availabilityCycleId || cycles[0]?.id || ''

  const filteredEmployees = useMemo(
    () =>
      filterEmployeeDirectoryRecords(employees, {
        tab,
        searchText,
        leadOnly,
        fmlaOnly,
        includeInactive,
      }),
    [employees, tab, searchText, leadOnly, fmlaOnly, includeInactive]
  )

  const sortedEmployees = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    const shiftRank = (value: EmployeeDirectoryRecord['shift_type']) => (value === 'day' ? 0 : 1)
    const typeRank = (value: EmployeeDirectoryRecord['employment_type']) => {
      if (value === 'full_time') return 0
      if (value === 'part_time') return 1
      return 2
    }
    const tagsRank = (employee: EmployeeDirectoryRecord) => {
      const hasLead = employee.is_lead_eligible ? 1 : 0
      const hasFmla = employee.on_fmla ? 1 : 0
      const isInactive = employee.is_active ? 0 : 1
      return hasLead * 4 + hasFmla * 2 + isInactive
    }

    return filteredEmployees.slice().sort((a, b) => {
      let result = 0
      if (sortKey === 'employee') {
        result = a.full_name.localeCompare(b.full_name) || a.email.localeCompare(b.email)
      } else if (sortKey === 'shift') {
        result =
          shiftRank(a.shift_type) - shiftRank(b.shift_type) ||
          a.full_name.localeCompare(b.full_name)
      } else if (sortKey === 'type') {
        result =
          typeRank(a.employment_type) - typeRank(b.employment_type) ||
          a.full_name.localeCompare(b.full_name)
      } else {
        result = tagsRank(a) - tagsRank(b) || a.full_name.localeCompare(b.full_name)
      }
      return result * direction
    })
  }, [filteredEmployees, sortDirection, sortKey])

  function handleSort(nextKey: DirectorySortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection('asc')
  }

  const openEditForEmployee = useCallback(
    (employeeId: string, options?: { focusAvailability?: boolean; cycleId?: string }) => {
      const employee = employees.find((row) => row.id === employeeId)
      if (!employee) return
      setEditState({
        employeeId: employee.id,
        onFmla: employee.on_fmla,
        weekendRotation: employee.weekend_rotation,
        worksDowMode: employee.works_dow_mode,
      })
      setOverrideDateDraft('')
      setOverrideDatesDraft([])
      setOverrideDateError(null)
      setIsCalendarDragging(false)
      setCalendarDragMode(null)
      calendarDragSeenRef.current.clear()
      setFocusAvailabilitySection(Boolean(options?.focusAvailability))
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
    },
    [employees, selectedAvailabilityCycleId, cycles]
  )

  const editEmployee = useMemo(
    () => employees.find((employee) => employee.id === editState?.employeeId) ?? null,
    [employees, editState?.employeeId]
  )
  const onFmlaDraft = editState?.onFmla ?? false
  const weekendRotationDraft = editState?.weekendRotation ?? 'none'
  const worksDowModeDraft = editState?.worksDowMode ?? 'hard'

  const deactivateEmployee = useMemo(
    () => employees.find((employee) => employee.id === deactivateEmployeeId) ?? null,
    [employees, deactivateEmployeeId]
  )
  const cycleLabelById = useMemo(
    () =>
      new Map(
        cycles.map((cycle) => [
          cycle.id,
          `${cycle.label} (${formatEmployeeDate(cycle.start_date)} to ${formatEmployeeDate(cycle.end_date)})`,
        ])
      ),
    [cycles]
  )
  const editEmployeeDateOverrides = useMemo(() => {
    if (!editEmployee) return []
    return dateOverrides
      .filter((row) => row.therapist_id === editEmployee.id)
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        if (a.shift_type !== b.shift_type) return a.shift_type.localeCompare(b.shift_type)
        return a.cycle_id.localeCompare(b.cycle_id)
      })
  }, [dateOverrides, editEmployee])
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
  const missingAvailabilityRows = useMemo(
    () => buildMissingAvailabilityRows(employees, dateOverrides, selectedAvailabilityCycleId),
    [dateOverrides, employees, selectedAvailabilityCycleId]
  )

  useEffect(() => {
    if (!editEmployee || !focusAvailabilitySection) return
    availabilitySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editEmployee, focusAvailabilitySection])

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

  const applyDateInBatch = useCallback(
    (dateValue: string, mode: 'add' | 'remove') => {
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
    },
    [setOverrideDatesDraft]
  )

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
  }, [isCalendarDragging, calendarDragMode, selectedOverrideCycle, applyDateInBatch])

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
    [selectedOverrideCycle, selectedOverrideDatesSet, applyDateInBatch]
  )

  const handleCalendarDayMouseEnter = useCallback(
    (dateValue: string) => {
      if (!isCalendarDragging || !calendarDragMode) return
      if (!isDateWithinCycle(dateValue, selectedOverrideCycle)) return
      if (calendarDragSeenRef.current.has(dateValue)) return
      calendarDragSeenRef.current.add(dateValue)
      applyDateInBatch(dateValue, calendarDragMode)
    },
    [isCalendarDragging, calendarDragMode, selectedOverrideCycle, applyDateInBatch]
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
    [selectedOverrideCycle, selectedOverrideDatesSet, applyDateInBatch]
  )

  function addDateToOverrideBatch() {
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
  }

  return (
    <Card id="employee-directory">
      <CardHeader>
        <CardTitle>Employee Directory</CardTitle>
        <CardDescription>
          Search, filter, and maintain active staffing profiles in one place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTab(item.value)}
              className={
                tab === item.value
                  ? 'border-[#fde68a] bg-[#fffbeb] text-[#b45309] hover:bg-[#fffbeb] hover:text-[#b45309]'
                  : ''
              }
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search name or email"
            className="w-full"
          />
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={leadOnly}
                onChange={(event) => setLeadOnly(event.target.checked)}
              />
              Lead
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fmlaOnly}
                onChange={(event) => setFmlaOnly(event.target.checked)}
              />
              FMLA
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
              />
              Include inactive
            </label>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{sortedEmployees.length} employee(s)</p>

        <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCollapsedMissing((prev) => !prev)}
                className="text-sm font-semibold text-foreground hover:text-muted-foreground"
              >
                {collapsedMissing ? '▸' : '▾'} Missing availability (
                {missingAvailabilityRows.length})
              </button>
              {collapsedMissing && (
                <span className="text-xs text-muted-foreground">
                  {missingAvailabilityRows.filter((r) => !r.submitted).length} not submitted
                </span>
              )}
            </div>
            {!collapsedMissing && (
              <div className="w-full md:w-72">
                <Label htmlFor="missing_cycle_id" className="text-xs">
                  Selected cycle
                </Label>
                <select
                  id="missing_cycle_id"
                  className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={selectedAvailabilityCycleId}
                  onChange={(event) => setAvailabilityCycleId(event.target.value)}
                >
                  {cycles.map((cycle) => (
                    <option key={`missing-cycle-${cycle.id}`} value={cycle.id}>
                      {cycle.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {!collapsedMissing && (
            <div className="overflow-x-auto rounded-md border border-border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Therapist</TableHead>
                    <TableHead>Overrides</TableHead>
                    <TableHead>Last updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingAvailabilityRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No therapists available for this cycle.
                      </TableCell>
                    </TableRow>
                  ) : (
                    missingAvailabilityRows.map((row) => (
                      <TableRow key={`missing-${row.therapistId}`}>
                        <TableCell className="font-medium">{row.therapistName}</TableCell>
                        <TableCell>{row.overridesCount}</TableCell>
                        <TableCell>{formatDateTime(row.lastUpdatedAt)}</TableCell>
                        <TableCell>
                          <Badge variant={row.submitted ? 'outline' : 'destructive'}>
                            {row.submitted ? 'Submitted' : 'Not submitted'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openEditForEmployee(row.therapistId, {
                                focusAvailability: true,
                                cycleId: selectedAvailabilityCycleId,
                              })
                            }
                          >
                            Enter availability
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="hidden rounded-md border border-border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeaderButton
                    label="Employee"
                    column="employee"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeaderButton
                    label="Shift/Team"
                    column="shift"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeaderButton
                    label="Type"
                    column="type"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeaderButton
                    label="Tags"
                    column="tags"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="w-[64px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No employees match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                sortedEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    onClick={() => openEditForEmployee(employee.id)}
                    className="cursor-pointer hover:bg-secondary/50"
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{employee.full_name}</div>
                      <div className="text-xs text-muted-foreground">{employee.email}</div>
                    </TableCell>
                    <TableCell>
                      <ShiftBadge shiftType={employee.shift_type} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={EMPLOYEE_META_BADGE_CLASS}>
                        {employmentLabel(employee.employment_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {employee.is_lead_eligible ||
                      employee.on_fmla ||
                      employee.works_dow.length > 0 ||
                      employee.offs_dow.length > 0 ||
                      employee.weekend_rotation === 'every_other' ||
                      (includeInactive && !employee.is_active) ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1.5">
                            {employee.is_lead_eligible && (
                              <Badge className={LEAD_ELIGIBLE_BADGE_CLASS}>Lead</Badge>
                            )}
                            {employee.on_fmla && (
                              <Badge
                                variant="outline"
                                title={
                                  employee.fmla_return_date
                                    ? `Potential return: ${formatEmployeeDate(employee.fmla_return_date)}`
                                    : undefined
                                }
                              >
                                FMLA
                              </Badge>
                            )}
                            {employee.works_dow.length > 0 && (
                              <Badge variant="outline" title={weekdayLabel(employee.works_dow)}>
                                Works: {weekdayLabel(employee.works_dow)}
                              </Badge>
                            )}
                            {employee.offs_dow.length > 0 && (
                              <Badge variant="outline" title={weekdayLabel(employee.offs_dow)}>
                                Never: {weekdayLabel(employee.offs_dow)}
                              </Badge>
                            )}
                            {employee.weekend_rotation === 'every_other' && (
                              <Badge
                                variant="outline"
                                title={
                                  employee.weekend_anchor_date
                                    ? `Anchor weekend: ${formatEmployeeDate(employee.weekend_anchor_date)}`
                                    : undefined
                                }
                              >
                                Alt weekend
                              </Badge>
                            )}
                            {employee.works_dow.length > 0 && (
                              <Badge variant="outline">
                                Works days: {employee.works_dow_mode === 'hard' ? 'Hard' : 'Soft'}
                              </Badge>
                            )}
                            {includeInactive && !employee.is_active && (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </div>
                          {employee.on_fmla && employee.fmla_return_date && (
                            <p className="text-xs text-muted-foreground">
                              Return: {formatEmployeeDate(employee.fmla_return_date)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <EmployeeActionsMenu
                        employee={employee}
                        onEdit={() => openEditForEmployee(employee.id)}
                        onDeactivate={() => setDeactivateEmployeeId(employee.id)}
                        setEmployeeActiveAction={setEmployeeActiveAction}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 md:hidden">
          {sortedEmployees.length === 0 ? (
            <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
              No employees match the current filters.
            </p>
          ) : (
            sortedEmployees.map((employee) => (
              <div
                key={employee.id}
                className="rounded-md border border-border p-3"
                onClick={() => openEditForEmployee(employee.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{employee.full_name}</p>
                    <p className="text-xs text-muted-foreground">{employee.email}</p>
                  </div>
                  <EmployeeActionsMenu
                    employee={employee}
                    onEdit={() => openEditForEmployee(employee.id)}
                    onDeactivate={() => setDeactivateEmployeeId(employee.id)}
                    setEmployeeActiveAction={setEmployeeActiveAction}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <ShiftBadge shiftType={employee.shift_type} />
                  <Badge variant="outline" className={EMPLOYEE_META_BADGE_CLASS}>
                    {employmentLabel(employee.employment_type)}
                  </Badge>
                  {employee.is_lead_eligible && (
                    <Badge className={LEAD_ELIGIBLE_BADGE_CLASS}>Lead</Badge>
                  )}
                  {includeInactive && !employee.is_active && (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                  {employee.on_fmla && <Badge variant="outline">FMLA</Badge>}
                  {employee.works_dow.length > 0 && (
                    <Badge variant="outline">Works: {weekdayLabel(employee.works_dow)}</Badge>
                  )}
                  {employee.offs_dow.length > 0 && (
                    <Badge variant="outline">Never: {weekdayLabel(employee.offs_dow)}</Badge>
                  )}
                  {employee.weekend_rotation === 'every_other' && (
                    <Badge variant="outline">Alt weekend</Badge>
                  )}
                  {employee.works_dow.length > 0 && (
                    <Badge variant="outline">
                      Works days: {employee.works_dow_mode === 'hard' ? 'Hard' : 'Soft'}
                    </Badge>
                  )}
                </div>
                {employee.on_fmla && employee.fmla_return_date && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Return: {formatEmployeeDate(employee.fmla_return_date)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog
        open={Boolean(editEmployee)}
        onOpenChange={(open) => {
          if (open) return
          setEditState(null)
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
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription>
              Update profile details and scheduling eligibility settings.
            </DialogDescription>
          </DialogHeader>
          {editEmployee && (
            <div className="space-y-3">
              <form key={editEmployee.id} action={saveEmployeeAction} className="space-y-3">
                <input type="hidden" name="profile_id" value={editEmployee.id} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit_name">Name</Label>
                    <Input
                      id="edit_name"
                      name="full_name"
                      defaultValue={editEmployee.full_name}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit_email">Email</Label>
                    <Input
                      id="edit_email"
                      name="email"
                      type="email"
                      defaultValue={editEmployee.email}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit_phone">Phone</Label>
                  <Input
                    id="edit_phone"
                    name="phone_number"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    defaultValue={editEmployee.phone_number ?? ''}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="edit_shift">Shift/Team</Label>
                    <select
                      id="edit_shift"
                      name="shift_type"
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                      defaultValue={editEmployee.shift_type}
                    >
                      <option value="day">Day</option>
                      <option value="night">Night</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit_employment">Employment</Label>
                    <select
                      id="edit_employment"
                      name="employment_type"
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                      defaultValue={editEmployee.employment_type}
                    >
                      <option value="full_time">Full-time</option>
                      <option value="part_time">Part-time</option>
                      <option value="prn">PRN</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit_max_week">Max shifts/week</Label>
                    <select
                      id="edit_max_week"
                      name="max_work_days_per_week"
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                      defaultValue={String(editEmployee.max_work_days_per_week)}
                    >
                      {Array.from({ length: 7 }, (_, index) => index + 1).map((value) => (
                        <option key={`max-${value}`} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
                  <Label className="text-sm font-semibold">Works weekdays</Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-generate uses these as preferred or required depending on the Hard/Soft
                    rule.
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <label
                        key={`preferred-day-${day.value}`}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          name="works_dow"
                          value={String(day.value)}
                          defaultChecked={editEmployee.works_dow.includes(day.value)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
                  <Label className="text-sm font-semibold">
                    Absolutely cannot work these weekdays
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Auto-generate will never assign this therapist on checked weekdays.
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {WEEKDAY_OPTIONS.map((day) => (
                      <label
                        key={`blocked-day-${day.value}`}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          name="offs_dow"
                          value={String(day.value)}
                          defaultChecked={editEmployee.offs_dow.includes(day.value)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-3">
                  <Label className="text-sm font-semibold">Works days rule</Label>
                  <p className="text-xs text-muted-foreground">
                    Hard: only works days are allowed. Soft: works days are preferred but other days
                    are allowed.
                  </p>
                  <div className="inline-flex rounded-md border border-border bg-background p-1">
                    <label className="cursor-pointer">
                      <input
                        className="sr-only"
                        type="radio"
                        name="works_dow_mode"
                        value="hard"
                        checked={worksDowModeDraft === 'hard'}
                        onChange={() =>
                          setEditState((current) =>
                            current
                              ? {
                                  ...current,
                                  worksDowMode: 'hard',
                                }
                              : current
                          )
                        }
                      />
                      <span
                        className={cn(
                          'rounded px-3 py-1.5 text-sm',
                          worksDowModeDraft === 'hard'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        Hard
                      </span>
                    </label>
                    <label className="cursor-pointer">
                      <input
                        className="sr-only"
                        type="radio"
                        name="works_dow_mode"
                        value="soft"
                        checked={worksDowModeDraft === 'soft'}
                        onChange={() =>
                          setEditState((current) =>
                            current
                              ? {
                                  ...current,
                                  worksDowMode: 'soft',
                                }
                              : current
                          )
                        }
                      />
                      <span
                        className={cn(
                          'rounded px-3 py-1.5 text-sm',
                          worksDowModeDraft === 'soft'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        Soft
                      </span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="is_lead_eligible"
                      defaultChecked={editEmployee.is_lead_eligible}
                    />
                    Lead
                  </label>
                  <fieldset className="space-y-1">
                    <legend className="text-sm">Weekend rotation</legend>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="weekend_rotation"
                        value="none"
                        checked={weekendRotationDraft === 'none'}
                        onChange={() =>
                          setEditState((current) =>
                            current
                              ? {
                                  ...current,
                                  weekendRotation: 'none',
                                }
                              : current
                          )
                        }
                      />
                      None
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="weekend_rotation"
                        value="every_other"
                        checked={weekendRotationDraft === 'every_other'}
                        onChange={() =>
                          setEditState((current) =>
                            current
                              ? {
                                  ...current,
                                  weekendRotation: 'every_other',
                                }
                              : current
                          )
                        }
                      />
                      Every other weekend
                    </label>
                  </fieldset>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="on_fmla"
                      checked={onFmlaDraft}
                      onChange={(event) =>
                        setEditState((current) =>
                          current
                            ? {
                                ...current,
                                onFmla: event.target.checked,
                              }
                            : current
                        )
                      }
                    />
                    On FMLA
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={editEmployee.is_active}
                    />
                    Active
                  </label>
                </div>

                {weekendRotationDraft === 'every_other' && (
                  <div className="space-y-1">
                    <Label htmlFor="edit_weekend_anchor">Weekend anchor date (Saturday)</Label>
                    <Input
                      id="edit_weekend_anchor"
                      name="weekend_anchor_date"
                      type="date"
                      defaultValue={editEmployee.weekend_anchor_date ?? ''}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-generate assigns this therapist on alternating weekends from this anchor
                      Saturday.
                    </p>
                  </div>
                )}

                {isFmlaReturnDateEnabled(onFmlaDraft) && (
                  <div className="space-y-1">
                    <Label htmlFor="edit_fmla_return">Potential return date</Label>
                    <Input
                      id="edit_fmla_return"
                      name="fmla_return_date"
                      type="date"
                      defaultValue={
                        normalizeFmlaReturnDate(editEmployee.fmla_return_date ?? '', true) ?? ''
                      }
                    />
                  </div>
                )}

                <DialogFooter>
                  <FormSubmitButton type="submit" pendingText="Saving...">
                    Save
                  </FormSubmitButton>
                  <FormSubmitButton
                    type="submit"
                    variant="outline"
                    name="realign_future_shifts"
                    value="true"
                    pendingText="Saving..."
                  >
                    Save + realign shifts
                  </FormSubmitButton>
                </DialogFooter>
              </form>

              <div
                ref={availabilitySectionRef}
                className={cn(
                  'space-y-3 rounded-md border border-border bg-secondary/20 p-3',
                  focusAvailabilitySection ? 'ring-2 ring-primary/40' : ''
                )}
              >
                <div>
                  <p className="text-sm font-semibold">Date Overrides (Manager)</p>
                  <p className="text-xs text-muted-foreground">
                    Add or update cycle-specific dates for this therapist. Same cycle/date/shift
                    updates existing entry.
                  </p>
                </div>

                <form
                  action={saveEmployeeDateOverrideAction}
                  className="grid grid-cols-1 gap-2 md:grid-cols-12"
                  onSubmit={(event) => {
                    const textDate = overrideDateDraft.trim()
                    const targetDates = Array.from(
                      new Set([...overrideDatesDraft, ...(textDate ? [textDate] : [])])
                    ).sort()
                    if (targetDates.length === 0) {
                      event.preventDefault()
                      setOverrideDateError('Select at least one date.')
                      return
                    }

                    const outOfRangeDate = targetDates.find(
                      (candidate) => !isDateWithinCycle(candidate, selectedOverrideCycle)
                    )
                    if (outOfRangeDate) {
                      event.preventDefault()
                      const label = selectedOverrideCycle
                        ? `${formatEmployeeDate(selectedOverrideCycle.start_date)} to ${formatEmployeeDate(selectedOverrideCycle.end_date)}`
                        : ''
                      setOverrideDateError(
                        selectedOverrideCycle
                          ? `Date must be within the selected cycle (${label}).`
                          : 'Date is outside the selected cycle.'
                      )
                      return
                    }

                    setOverrideDateError(null)
                  }}
                >
                  <input type="hidden" name="profile_id" value={editEmployee.id} />
                  {overrideDatesDraft.map((dateValue) => (
                    <input
                      key={`override-date-${dateValue}`}
                      type="hidden"
                      name="dates"
                      value={dateValue}
                    />
                  ))}
                  {overrideDateDraft && (
                    <input type="hidden" name="date" value={overrideDateDraft} />
                  )}
                  <div className="space-y-1 md:col-span-3">
                    <Label htmlFor="override_date">Date</Label>
                    <div className="flex gap-2">
                      <Input
                        id="override_date"
                        type="date"
                        value={overrideDateDraft}
                        onChange={(event) => {
                          setOverrideDateDraft(event.target.value)
                          setOverrideDateError(null)
                        }}
                      />
                      <Button type="button" variant="outline" onClick={addDateToOverrideBatch}>
                        Add
                      </Button>
                    </div>
                    {overrideDatesDraft.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {overrideDatesDraft.map((dateValue) => (
                          <button
                            key={`override-chip-${dateValue}`}
                            type="button"
                            className="rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-secondary"
                            onClick={() =>
                              setOverrideDatesDraft((current) =>
                                current.filter((value) => value !== dateValue)
                              )
                            }
                            title="Remove date"
                          >
                            {formatEmployeeDate(dateValue)} x
                          </button>
                        ))}
                      </div>
                    )}
                    {overrideDateError && (
                      <p className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
                        {overrideDateError}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 md:col-span-7">
                    <Label htmlFor="override_cycle_id">Cycle</Label>
                    <select
                      id="override_cycle_id"
                      name="cycle_id"
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                      value={overrideCycleIdDraft}
                      onChange={(event) => {
                        const nextCycleId = event.target.value
                        setOverrideCycleIdDraft(nextCycleId)
                        const nextCycle = cycles.find((cycle) => cycle.id === nextCycleId) ?? null
                        if (nextCycle) {
                          setOverrideCalendarMonthStart(toMonthStartKey(nextCycle.start_date))
                        }
                        setOverrideDatesDraft((current) => {
                          if (!nextCycle) return current
                          return current.filter((dateValue) =>
                            isDateWithinCycle(dateValue, nextCycle)
                          )
                        })
                        setOverrideDateError(null)
                      }}
                      required
                    >
                      <option value="" disabled>
                        Select cycle
                      </option>
                      {cycles.map((cycle) => (
                        <option key={`cycle-${cycle.id}`} value={cycle.id}>
                          {cycle.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-5">
                    <Label htmlFor="override_type">Override</Label>
                    <select
                      id="override_type"
                      name="override_type"
                      className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                      defaultValue="force_off"
                      required
                    >
                      <option value="force_off">Need off</option>
                      <option value="force_on">Available to work</option>
                    </select>
                  </div>
                  <input type="hidden" name="shift_type" value={editEmployee.shift_type} />
                  <div className="space-y-2 md:col-span-12">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Calendar multi-select</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOverrideDatesDraft([])
                          setOverrideDateError(null)
                        }}
                        disabled={overrideDatesDraft.length === 0}
                      >
                        Clear selected
                      </Button>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canGoPrevMonth}
                          onClick={() =>
                            setOverrideCalendarMonthStart((current) => shiftMonthKey(current, -1))
                          }
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <p className="text-sm font-medium">{overrideCalendarTitle}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canGoNextMonth}
                          onClick={() =>
                            setOverrideCalendarMonthStart((current) => shiftMonthKey(current, 1))
                          }
                          aria-label="Next month"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mb-1 grid grid-cols-7 gap-1">
                        {WEEKDAY_OPTIONS.map((day) => (
                          <p
                            key={`override-weekday-${day.value}`}
                            className="text-center text-[11px] font-medium text-muted-foreground"
                          >
                            {day.label}
                          </p>
                        ))}
                      </div>
                      <div className="touch-none space-y-1" ref={calendarRef}>
                        {overrideCalendarWeeks.map((week, weekIndex) => (
                          <div
                            key={`override-week-${weekIndex}`}
                            className="grid grid-cols-7 gap-1"
                          >
                            {week.map((day) => {
                              const dayKey = toIsoDate(day)
                              const isCurrentMonth = dayKey.slice(0, 7) === overrideCalendarMonthKey
                              const isInCycle = isDateWithinCycle(dayKey, selectedOverrideCycle)
                              const isSelected = selectedOverrideDatesSet.has(dayKey)
                              return (
                                <button
                                  key={dayKey}
                                  type="button"
                                  data-date={dayKey}
                                  disabled={!isInCycle}
                                  onMouseDown={(event) => handleCalendarDayMouseDown(event, dayKey)}
                                  onMouseEnter={() => handleCalendarDayMouseEnter(dayKey)}
                                  onTouchStart={(e) => {
                                    e.preventDefault()
                                    handleCalendarDayTouchStart(dayKey)
                                  }}
                                  className={cn(
                                    'h-8 rounded-md text-xs transition-colors',
                                    isSelected
                                      ? 'bg-[#d97706] font-semibold text-white hover:bg-[#b45309]'
                                      : 'bg-background',
                                    !isSelected && isInCycle && 'hover:bg-secondary',
                                    !isCurrentMonth && !isSelected && 'text-muted-foreground',
                                    !isInCycle && 'cursor-not-allowed opacity-35'
                                  )}
                                  title={
                                    isInCycle
                                      ? formatEmployeeDate(dayKey)
                                      : 'Outside selected cycle'
                                  }
                                >
                                  {day.getDate()}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click days to toggle selection. Click and drag across days to select quickly.
                    </p>
                  </div>
                  <div className="space-y-1 md:col-span-9">
                    <Label htmlFor="override_note">Note (optional)</Label>
                    <Input id="override_note" name="note" placeholder="Vacation, training, etc." />
                  </div>
                  <div className="flex items-end md:col-span-3">
                    <FormSubmitButton type="submit" pendingText="Saving..." className="w-full">
                      Save date override
                    </FormSubmitButton>
                  </div>
                </form>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Current overrides
                  </p>
                  {editEmployeeDateOverrides.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No date overrides for this therapist yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {editEmployeeDateOverrides.map((row) => (
                        <div
                          key={row.id}
                          className="flex flex-col gap-2 rounded-md border border-border bg-background p-2 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">
                              {formatEmployeeDate(row.date)} —{' '}
                              {row.override_type === 'force_on' ? 'Available to work' : 'Need off'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs text-muted-foreground">
                                {cycleLabelById.get(row.cycle_id) ?? row.cycle_id}
                                {row.note ? ` | ${row.note}` : ''}
                              </p>
                              <Badge variant="outline" className="text-[10px]">
                                {row.source === 'manager'
                                  ? 'Entered by manager'
                                  : 'Entered by therapist'}
                              </Badge>
                            </div>
                          </div>
                          <form action={deleteEmployeeDateOverrideAction}>
                            <input type="hidden" name="override_id" value={row.id} />
                            <input type="hidden" name="profile_id" value={editEmployee.id} />
                            <input type="hidden" name="cycle_id" value={row.cycle_id} />
                            <FormSubmitButton
                              type="submit"
                              variant="ghost"
                              size="sm"
                              pendingText="Deleting..."
                            >
                              Delete
                            </FormSubmitButton>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-border bg-secondary/20 p-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Copy shift pattern
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Copy this employee&apos;s scheduled shifts from one cycle to another. Shifts
                  already in the target cycle are kept.
                </p>
                <form action={copyEmployeeShiftsAction} className="mt-3 space-y-2">
                  <input type="hidden" name="employee_id" value={editEmployee.id} />
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-600">
                      From cycle
                      <select
                        name="source_cycle_id"
                        value={copySourceCycleId}
                        onChange={(e) => setCopySourceCycleId(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                      >
                        {cycles.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      To cycle
                      <select
                        name="target_cycle_id"
                        value={copyTargetCycleId}
                        onChange={(e) => setCopyTargetCycleId(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                      >
                        {cycles.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <FormSubmitButton
                    type="submit"
                    size="sm"
                    disabled={
                      !copySourceCycleId ||
                      !copyTargetCycleId ||
                      copySourceCycleId === copyTargetCycleId
                    }
                    pendingText="Copying..."
                  >
                    Copy shifts
                  </FormSubmitButton>
                </form>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deactivateEmployee)}
        onOpenChange={(open) => !open && setDeactivateEmployeeId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate employee</DialogTitle>
            <DialogDescription>
              {deactivateEmployee
                ? `${deactivateEmployee.full_name} will be marked inactive and hidden by default.`
                : 'Confirm deactivation.'}
            </DialogDescription>
          </DialogHeader>
          {deactivateEmployee && (
            <form action={setEmployeeActiveAction}>
              <input type="hidden" name="profile_id" value={deactivateEmployee.id} />
              <input type="hidden" name="set_active" value="false" />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeactivateEmployeeId(null)}
                >
                  Cancel
                </Button>
                <FormSubmitButton type="submit" variant="destructive" pendingText="Deactivating...">
                  Deactivate
                </FormSubmitButton>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
