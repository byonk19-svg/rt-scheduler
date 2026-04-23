'use client'

import type { MouseEvent, RefObject } from 'react'

import { EmployeeOverrideCalendar } from '@/components/EmployeeOverrideCalendar'
import {
  formatEmployeeDate,
  isDateWithinCycle,
  type EmployeeDirectoryRecord,
} from '@/lib/employee-directory'
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

export function EmployeeOverrideFormPanel({
  calendarRef,
  canGoNextMonth,
  canGoPrevMonth,
  cycles,
  editEmployee,
  focusAvailabilitySection,
  onAddDateToOverrideBatch,
  onCalendarDayMouseDown,
  onCalendarDayMouseEnter,
  onCalendarDayTouchStart,
  onOverrideCycleChange,
  onOverrideDateDraftChange,
  onOverrideDateErrorChange,
  onOverrideDatesClear,
  onOverrideDateRemove,
  onShowNextMonth,
  onShowPreviousMonth,
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
  weekdayOptions,
}: {
  calendarRef: RefObject<HTMLDivElement | null>
  canGoNextMonth: boolean
  canGoPrevMonth: boolean
  cycles: EmployeeCycle[]
  editEmployee: EmployeeDirectoryRecord
  focusAvailabilitySection: boolean
  onAddDateToOverrideBatch: () => void
  onCalendarDayMouseDown: (event: MouseEvent<HTMLButtonElement>, dateValue: string) => void
  onCalendarDayMouseEnter: (dateValue: string) => void
  onCalendarDayTouchStart: (dateValue: string) => void
  onOverrideCycleChange: (value: string) => void
  onOverrideDateDraftChange: (value: string) => void
  onOverrideDateErrorChange: (value: string | null) => void
  onOverrideDatesClear: () => void
  onOverrideDateRemove: (value: string) => void
  onShowNextMonth: () => void
  onShowPreviousMonth: () => void
  overrideCalendarMonthKey: string
  overrideCalendarTitle: string
  overrideCalendarWeeks: Date[][]
  overrideCycleIdDraft: string
  overrideDateDraft: string
  overrideDateError: string | null
  overrideDatesDraft: string[]
  overrideFormAction: (formData: FormData) => void
  overrideFormState: { error: string } | null
  selectedOverrideCycle: EmployeeCycle | null
  selectedOverrideDatesSet: Set<string>
  weekdayOptions: Array<{ value: number; label: string }>
}) {
  return (
    <div
      className={[
        'space-y-3 rounded-md border border-border bg-secondary/20 p-3',
        focusAvailabilitySection ? 'ring-2 ring-primary/40' : '',
      ].join(' ')}
    >
      <div>
        <p className="text-sm font-semibold">Date Overrides (Manager)</p>
        <p className="text-xs text-muted-foreground">
          Availability is now the primary manager planner. Use this drawer only for quick exceptions
          when you do not want to leave Team.
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
            onOverrideDateErrorChange('Select at least one date.')
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
            onOverrideDateErrorChange(
              selectedOverrideCycle
                ? `Date must be within the selected cycle (${label}).`
                : 'Date is outside the selected cycle.'
            )
            return
          }

          onOverrideDateErrorChange(null)
        }}
      >
        <input type="hidden" name="profile_id" value={editEmployee.id} />
        {overrideDatesDraft.map((dateValue) => (
          <input key={`override-date-${dateValue}`} type="hidden" name="dates" value={dateValue} />
        ))}
        {overrideDateDraft ? <input type="hidden" name="date" value={overrideDateDraft} /> : null}
        <div className="space-y-1 md:col-span-3">
          <Label htmlFor="override_date">Date</Label>
          <div className="flex gap-2">
            <Input
              id="override_date"
              type="date"
              value={overrideDateDraft}
              onChange={(event) => onOverrideDateDraftChange(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={onAddDateToOverrideBatch}>
              Add
            </Button>
          </div>
          {overrideDatesDraft.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {overrideDatesDraft.map((dateValue) => (
                <button
                  key={`override-chip-${dateValue}`}
                  type="button"
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-xs hover:bg-secondary"
                  onClick={() => onOverrideDateRemove(dateValue)}
                  title="Remove date"
                >
                  {formatEmployeeDate(dateValue)} x
                </button>
              ))}
            </div>
          ) : null}
          {overrideDateError ? (
            <p className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error-text)]">
              {overrideDateError}
            </p>
          ) : null}
        </div>
        <div className="space-y-1 md:col-span-7">
          <Label htmlFor="override_cycle_id">Cycle</Label>
          <select
            id="override_cycle_id"
            name="cycle_id"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            value={overrideCycleIdDraft}
            onChange={(event) => onOverrideCycleChange(event.target.value)}
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
        <EmployeeOverrideCalendar
          calendarRef={calendarRef}
          canGoNextMonth={canGoNextMonth}
          canGoPrevMonth={canGoPrevMonth}
          onCalendarDayMouseDown={onCalendarDayMouseDown}
          onCalendarDayMouseEnter={onCalendarDayMouseEnter}
          onCalendarDayTouchStart={onCalendarDayTouchStart}
          onClearSelectedDates={onOverrideDatesClear}
          onShowNextMonth={onShowNextMonth}
          onShowPreviousMonth={onShowPreviousMonth}
          overrideCalendarMonthKey={overrideCalendarMonthKey}
          overrideCalendarTitle={overrideCalendarTitle}
          overrideCalendarWeeks={overrideCalendarWeeks}
          overrideDatesDraft={overrideDatesDraft}
          selectedOverrideCycle={selectedOverrideCycle}
          selectedOverrideDatesSet={selectedOverrideDatesSet}
          weekdayOptions={weekdayOptions}
        />
        <div className="space-y-1 md:col-span-9">
          <Label htmlFor="override_note">Note (optional)</Label>
          <Input id="override_note" name="note" placeholder="Vacation, training, etc." />
        </div>
        {overrideFormState?.error ? (
          <p
            role="alert"
            className="rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs font-medium text-[var(--error-text)] md:col-span-12"
          >
            {overrideFormState.error}
          </p>
        ) : null}
        <div className="flex items-end md:col-span-3">
          <FormSubmitButton type="submit" pendingText="Saving..." className="w-full">
            Save date override
          </FormSubmitButton>
        </div>
      </form>
    </div>
  )
}
