'use client'

import type { MouseEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import {
  formatEmployeeDate,
  isDateWithinCycle,
  type EmployeeDirectoryRecord,
} from '@/lib/employee-directory'
import { shiftMonthKey, toIsoDate, type buildCalendarWeeks } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

type EmployeeOverridesPanelProps = {
  availabilitySectionRef: React.RefObject<HTMLDivElement | null>
  calendarRef: React.RefObject<HTMLDivElement | null>
  canGoNextMonth: boolean
  canGoPrevMonth: boolean
  copyShiftsFormAction: (payload: FormData) => void
  copyShiftsFormState: { error: string; employeeId: string } | null
  copySourceCycleId: string
  copyTargetCycleId: string
  cycleLabelById: Map<string, string>
  cycles: EmployeeCycle[]
  dateOverrides: EmployeeDateOverride[]
  deleteOverrideFormAction: (payload: FormData) => void
  deleteOverrideFormState: { error: string; profileId: string } | null
  editEmployee: EmployeeDirectoryRecord
  editEmployeeDateOverrides: EmployeeDateOverride[]
  focusAvailabilitySection: boolean
  overrideCalendarMonthKey: string
  overrideCalendarTitle: string
  overrideCalendarWeeks: ReturnType<typeof buildCalendarWeeks>
  overrideCycleIdDraft: string
  overrideDateDraft: string
  overrideDateError: string | null
  overrideDatesDraft: string[]
  overrideFormAction: (payload: FormData) => void
  overrideFormState: { error: string } | null
  selectedOverrideCycle: EmployeeCycle | null
  selectedOverrideDatesSet: Set<string>
  setCopySourceCycleId: (value: string) => void
  setCopyTargetCycleId: (value: string) => void
  setOverrideCalendarMonthStart: (value: string | ((current: string) => string)) => void
  setOverrideCycleIdDraft: (value: string) => void
  setOverrideDateDraft: (value: string) => void
  setOverrideDateError: (value: string | null) => void
  setOverrideDatesDraft: (value: string[] | ((current: string[]) => string[])) => void
  addDateToOverrideBatch: () => void
  handleCalendarDayMouseDown: (event: MouseEvent<HTMLButtonElement>, dateValue: string) => void
  handleCalendarDayMouseEnter: (dateValue: string) => void
  handleCalendarDayTouchStart: (dateValue: string) => void
}

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

export function EmployeeOverridesPanel({
  availabilitySectionRef,
  calendarRef,
  canGoNextMonth,
  canGoPrevMonth,
  copyShiftsFormAction,
  copyShiftsFormState,
  copySourceCycleId,
  copyTargetCycleId,
  cycleLabelById,
  cycles,
  dateOverrides,
  deleteOverrideFormAction,
  deleteOverrideFormState,
  editEmployee,
  editEmployeeDateOverrides,
  focusAvailabilitySection,
  overrideCalendarMonthKey,
  overrideCalendarTitle,
  overrideCalendarWeeks,
  overrideCycleIdDraft,
  overrideDateDraft,
  overrideDateError,
  overrideDatesDraft,
  overrideFormAction,
  overrideFormState,
  selectedOverrideCycle,
  selectedOverrideDatesSet,
  setCopySourceCycleId,
  setCopyTargetCycleId,
  setOverrideCalendarMonthStart,
  setOverrideCycleIdDraft,
  setOverrideDateDraft,
  setOverrideDateError,
  setOverrideDatesDraft,
  addDateToOverrideBatch,
  handleCalendarDayMouseDown,
  handleCalendarDayMouseEnter,
  handleCalendarDayTouchStart,
}: EmployeeOverridesPanelProps) {
  return (
    <div ref={availabilitySectionRef} className="space-y-3 px-6 py-4">
      <div
        className={cn(
          'space-y-3 rounded-md border border-border bg-secondary/20 p-3',
          focusAvailabilitySection ? 'ring-2 ring-primary/40' : ''
        )}
      >
        <div>
          <p className="text-sm font-semibold">Date Overrides (Manager)</p>
          <p className="text-xs text-muted-foreground">
            Availability is now the primary manager planner. Use this drawer only for quick
            exceptions when you do not want to leave Team.
          </p>
        </div>

        <form
          key={`${editEmployee.id}-${overrideCycleIdDraft}`}
          action={overrideFormAction}
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
          {overrideDateDraft && <input type="hidden" name="date" value={overrideDateDraft} />}
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
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={overrideCycleIdDraft}
              onChange={(event) => {
                const nextCycleId = event.target.value
                setOverrideCycleIdDraft(nextCycleId)
                const nextCycle = cycles.find((cycle) => cycle.id === nextCycleId) ?? null
                if (nextCycle) {
                  setOverrideCalendarMonthStart(nextCycle.start_date.slice(0, 7) + '-01')
                }
                setOverrideDatesDraft(
                  dateOverrides
                    .filter(
                      (row) => row.therapist_id === editEmployee.id && row.cycle_id === nextCycleId
                    )
                    .map((row) => row.date)
                    .sort((a, b) => a.localeCompare(b))
                )
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
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
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
                  <div key={`override-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
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
                          onTouchStart={(event) => {
                            event.preventDefault()
                            handleCalendarDayTouchStart(dayKey)
                          }}
                          className={cn(
                            'h-8 rounded-md text-xs transition-colors',
                            isSelected
                              ? 'bg-[var(--warning)] font-semibold text-foreground hover:bg-[var(--warning-text)] hover:text-primary-foreground'
                              : 'bg-background',
                            !isSelected && isInCycle && 'hover:bg-secondary',
                            !isCurrentMonth && !isSelected && 'text-muted-foreground',
                            !isInCycle && 'cursor-not-allowed opacity-35'
                          )}
                          title={isInCycle ? formatEmployeeDate(dayKey) : 'Outside selected cycle'}
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
          {overrideFormState?.error && (
            <p
              role="alert"
              className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-medium text-[var(--error-text)] md:col-span-12"
            >
              {overrideFormState.error}
            </p>
          )}
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
          {deleteOverrideFormState?.error &&
            deleteOverrideFormState.profileId === editEmployee.id && (
              <p
                role="alert"
                className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-medium text-[var(--error-text)]"
              >
                {deleteOverrideFormState.error}
              </p>
            )}
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
                      {formatEmployeeDate(row.date)} -{' '}
                      {row.override_type === 'force_on' ? 'Available to work' : 'Need off'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {cycleLabelById.get(row.cycle_id) ?? row.cycle_id}
                        {row.note ? ` | ${row.note}` : ''}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {row.source === 'manager' ? 'Entered by manager' : 'Entered by therapist'}
                      </Badge>
                    </div>
                  </div>
                  <form action={deleteOverrideFormAction}>
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
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Copy shift pattern
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Copy this employee&apos;s scheduled shifts from one cycle to another. Shifts already in
          the target cycle are kept.
        </p>
        <form action={copyShiftsFormAction} className="mt-3 space-y-2">
          <input type="hidden" name="employee_id" value={editEmployee.id} />
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground">
              From cycle
              <select
                name="source_cycle_id"
                value={copySourceCycleId}
                onChange={(event) => setCopySourceCycleId(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              To cycle
              <select
                name="target_cycle_id"
                value={copyTargetCycleId}
                onChange={(event) => setCopyTargetCycleId(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground"
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FormSubmitButton
            type="submit"
            size="sm"
            disabled={
              !copySourceCycleId || !copyTargetCycleId || copySourceCycleId === copyTargetCycleId
            }
            pendingText="Copying..."
          >
            Copy shifts
          </FormSubmitButton>
          {copyShiftsFormState?.error && copyShiftsFormState.employeeId === editEmployee.id && (
            <p
              role="alert"
              className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-medium text-[var(--error-text)]"
            >
              {copyShiftsFormState.error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
