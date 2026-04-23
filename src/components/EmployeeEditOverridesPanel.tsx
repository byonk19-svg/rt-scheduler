'use client'

import type { MouseEvent, RefObject } from 'react'

import { EmployeeCopyShiftPatternPanel } from '@/components/EmployeeCopyShiftPatternPanel'
import { EmployeeOverrideFormPanel } from '@/components/EmployeeOverrideFormPanel'
import { EmployeeOverrideHistoryPanel } from '@/components/EmployeeOverrideHistoryPanel'
import { type EmployeeDirectoryRecord } from '@/lib/employee-directory'

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

export function EmployeeEditOverridesPanel({
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
  deleteOverrideFormAction,
  deleteOverrideFormState,
  editEmployee,
  editEmployeeDateOverrides,
  focusAvailabilitySection,
  onAddDateToOverrideBatch,
  onCalendarDayMouseDown,
  onCalendarDayMouseEnter,
  onCalendarDayTouchStart,
  onCopySourceCycleIdChange,
  onCopyTargetCycleIdChange,
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
  availabilitySectionRef: RefObject<HTMLDivElement | null>
  calendarRef: RefObject<HTMLDivElement | null>
  canGoNextMonth: boolean
  canGoPrevMonth: boolean
  copyShiftsFormAction: (formData: FormData) => void
  copyShiftsFormState: { error: string; employeeId: string } | null
  copySourceCycleId: string
  copyTargetCycleId: string
  cycleLabelById: Map<string, string>
  cycles: EmployeeCycle[]
  deleteOverrideFormAction: (formData: FormData) => void
  deleteOverrideFormState: { error: string; profileId: string } | null
  editEmployee: EmployeeDirectoryRecord
  editEmployeeDateOverrides: EmployeeDateOverride[]
  focusAvailabilitySection: boolean
  onAddDateToOverrideBatch: () => void
  onCalendarDayMouseDown: (event: MouseEvent<HTMLButtonElement>, dateValue: string) => void
  onCalendarDayMouseEnter: (dateValue: string) => void
  onCalendarDayTouchStart: (dateValue: string) => void
  onCopySourceCycleIdChange: (value: string) => void
  onCopyTargetCycleIdChange: (value: string) => void
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
    <div ref={availabilitySectionRef} className="space-y-3 px-6 py-4">
      <EmployeeOverrideFormPanel
        calendarRef={calendarRef}
        canGoNextMonth={canGoNextMonth}
        canGoPrevMonth={canGoPrevMonth}
        cycles={cycles}
        editEmployee={editEmployee}
        focusAvailabilitySection={focusAvailabilitySection}
        onAddDateToOverrideBatch={onAddDateToOverrideBatch}
        onCalendarDayMouseDown={onCalendarDayMouseDown}
        onCalendarDayMouseEnter={onCalendarDayMouseEnter}
        onCalendarDayTouchStart={onCalendarDayTouchStart}
        onOverrideCycleChange={onOverrideCycleChange}
        onOverrideDateDraftChange={onOverrideDateDraftChange}
        onOverrideDateErrorChange={onOverrideDateErrorChange}
        onOverrideDatesClear={onOverrideDatesClear}
        onOverrideDateRemove={onOverrideDateRemove}
        onShowNextMonth={onShowNextMonth}
        onShowPreviousMonth={onShowPreviousMonth}
        overrideCalendarMonthKey={overrideCalendarMonthKey}
        overrideCalendarTitle={overrideCalendarTitle}
        overrideCalendarWeeks={overrideCalendarWeeks}
        overrideCycleIdDraft={overrideCycleIdDraft}
        overrideDateDraft={overrideDateDraft}
        overrideDateError={overrideDateError}
        overrideDatesDraft={overrideDatesDraft}
        overrideFormAction={overrideFormAction}
        overrideFormState={overrideFormState}
        selectedOverrideCycle={selectedOverrideCycle}
        selectedOverrideDatesSet={selectedOverrideDatesSet}
        weekdayOptions={weekdayOptions}
      />
      <EmployeeOverrideHistoryPanel
        cycleLabelById={cycleLabelById}
        deleteOverrideFormAction={deleteOverrideFormAction}
        deleteOverrideFormState={deleteOverrideFormState}
        editEmployeeDateOverrides={editEmployeeDateOverrides}
        employeeId={editEmployee.id}
      />
      <EmployeeCopyShiftPatternPanel
        copyShiftsFormAction={copyShiftsFormAction}
        copyShiftsFormState={copyShiftsFormState}
        copySourceCycleId={copySourceCycleId}
        copyTargetCycleId={copyTargetCycleId}
        cycles={cycles}
        employeeId={editEmployee.id}
        onCopySourceCycleIdChange={onCopySourceCycleIdChange}
        onCopyTargetCycleIdChange={onCopyTargetCycleIdChange}
      />
    </div>
  )
}
