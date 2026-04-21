'use client'

import type { EmployeeDirectoryRecord } from '@/lib/employee-directory'
import { cn } from '@/lib/utils'
import { EmployeeDrawerTabs } from '@/components/EmployeeDrawerTabs'
import { EmployeeEditOverridesPanel } from '@/components/EmployeeEditOverridesPanel'
import { EmployeeEditProfilePanel } from '@/components/EmployeeEditProfilePanel'
import { EmployeeEditSchedulingPanel } from '@/components/EmployeeEditSchedulingPanel'
import { FormSubmitButton } from '@/components/form-submit-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type DrawerTab = 'profile' | 'scheduling' | 'overrides'

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

export function EmployeeEditDialog({
  cycleLabelById,
  cycles,
  dayOptions,
  drawerTab,
  editEmployee,
  editEmployeeDateOverrides,
  focusAvailabilitySection,
  onClose,
  onDrawerTabChange,
  onFmlaDraft,
  onFmlaDraftChange,
  onWeekendRotationChange,
  onWorksDowModeChange,
  overrideActions,
  saveEmployeeAction,
  weekendRotationDraft,
  worksDowModeDraft,
}: {
  cycleLabelById: Map<string, string>
  cycles: EmployeeCycle[]
  dayOptions: Array<{ value: number; label: string }>
  drawerTab: DrawerTab
  editEmployee: EmployeeDirectoryRecord | null
  editEmployeeDateOverrides: EmployeeDateOverride[]
  focusAvailabilitySection: boolean
  onClose: () => void
  onDrawerTabChange: (value: DrawerTab) => void
  onFmlaDraft: boolean
  onFmlaDraftChange: (checked: boolean) => void
  onWeekendRotationChange: (value: 'none' | 'every_other') => void
  onWorksDowModeChange: (value: 'hard' | 'soft') => void
  overrideActions: {
    availabilitySectionRef: React.RefObject<HTMLDivElement | null>
    calendarRef: React.RefObject<HTMLDivElement | null>
    canGoNextMonth: boolean
    canGoPrevMonth: boolean
    copyShiftsFormAction: (formData: FormData) => void
    copyShiftsFormState: { error: string; employeeId: string } | null
    copySourceCycleId: string
    copyTargetCycleId: string
    deleteOverrideFormAction: (formData: FormData) => void
    deleteOverrideFormState: { error: string; profileId: string } | null
    onAddDateToOverrideBatch: () => void
    onCalendarDayMouseDown: (event: React.MouseEvent<HTMLButtonElement>, dateValue: string) => void
    onCalendarDayMouseEnter: (dateValue: string) => void
    onCalendarDayTouchStart: (dateValue: string) => void
    onCopySourceCycleIdChange: (value: string) => void
    onCopyTargetCycleIdChange: (value: string) => void
    onOverrideCycleChange: (nextCycleId: string) => void
    onOverrideDateDraftChange: (value: string) => void
    onOverrideDateErrorChange: (value: string | null) => void
    onOverrideDatesClear: () => void
    onOverrideDateRemove: (dateValue: string) => void
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
  }
  saveEmployeeAction: (formData: FormData) => void | Promise<void>
  weekendRotationDraft: 'none' | 'every_other'
  worksDowModeDraft: 'hard' | 'soft'
}) {
  return (
    <Dialog open={Boolean(editEmployee)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>
            Update profile details and scheduling eligibility settings.
          </DialogDescription>
        </DialogHeader>
        {editEmployee ? (
          <>
            <EmployeeDrawerTabs drawerTab={drawerTab} onChange={onDrawerTabChange} />

            <form
              key={editEmployee.id}
              action={saveEmployeeAction}
              className={cn(drawerTab === 'overrides' && 'hidden')}
            >
              <input type="hidden" name="profile_id" value={editEmployee.id} />

              <div className={cn(drawerTab !== 'profile' && 'hidden')}>
                <EmployeeEditProfilePanel
                  editEmployee={editEmployee}
                  onFmlaDraft={onFmlaDraft}
                  setOnFmlaDraft={onFmlaDraftChange}
                />
              </div>

              <div className={cn(drawerTab !== 'scheduling' && 'hidden')}>
                <EmployeeEditSchedulingPanel
                  dayOptions={dayOptions}
                  editEmployee={editEmployee}
                  onWeekendRotationChange={onWeekendRotationChange}
                  onWorksDowModeChange={onWorksDowModeChange}
                  weekendRotationDraft={weekendRotationDraft}
                  worksDowModeDraft={worksDowModeDraft}
                />
              </div>

              <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-border bg-card px-6 py-3">
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
              </div>
            </form>

            {drawerTab === 'overrides' ? (
              <EmployeeEditOverridesPanel
                availabilitySectionRef={overrideActions.availabilitySectionRef}
                calendarRef={overrideActions.calendarRef}
                canGoNextMonth={overrideActions.canGoNextMonth}
                canGoPrevMonth={overrideActions.canGoPrevMonth}
                copyShiftsFormAction={overrideActions.copyShiftsFormAction}
                copyShiftsFormState={overrideActions.copyShiftsFormState}
                copySourceCycleId={overrideActions.copySourceCycleId}
                copyTargetCycleId={overrideActions.copyTargetCycleId}
                cycleLabelById={cycleLabelById}
                cycles={cycles}
                deleteOverrideFormAction={overrideActions.deleteOverrideFormAction}
                deleteOverrideFormState={overrideActions.deleteOverrideFormState}
                editEmployee={editEmployee}
                editEmployeeDateOverrides={editEmployeeDateOverrides}
                focusAvailabilitySection={focusAvailabilitySection}
                onAddDateToOverrideBatch={overrideActions.onAddDateToOverrideBatch}
                onCalendarDayMouseDown={overrideActions.onCalendarDayMouseDown}
                onCalendarDayMouseEnter={overrideActions.onCalendarDayMouseEnter}
                onCalendarDayTouchStart={overrideActions.onCalendarDayTouchStart}
                onCopySourceCycleIdChange={overrideActions.onCopySourceCycleIdChange}
                onCopyTargetCycleIdChange={overrideActions.onCopyTargetCycleIdChange}
                onOverrideCycleChange={overrideActions.onOverrideCycleChange}
                onOverrideDateDraftChange={overrideActions.onOverrideDateDraftChange}
                onOverrideDateErrorChange={overrideActions.onOverrideDateErrorChange}
                onOverrideDatesClear={overrideActions.onOverrideDatesClear}
                onOverrideDateRemove={overrideActions.onOverrideDateRemove}
                onShowNextMonth={overrideActions.onShowNextMonth}
                onShowPreviousMonth={overrideActions.onShowPreviousMonth}
                overrideCalendarMonthKey={overrideActions.overrideCalendarMonthKey}
                overrideCalendarTitle={overrideActions.overrideCalendarTitle}
                overrideCalendarWeeks={overrideActions.overrideCalendarWeeks}
                overrideCycleIdDraft={overrideActions.overrideCycleIdDraft}
                overrideDateDraft={overrideActions.overrideDateDraft}
                overrideDateError={overrideActions.overrideDateError}
                overrideDatesDraft={overrideActions.overrideDatesDraft}
                overrideFormAction={overrideActions.overrideFormAction}
                overrideFormState={overrideActions.overrideFormState}
                selectedOverrideCycle={overrideActions.selectedOverrideCycle}
                selectedOverrideDatesSet={overrideActions.selectedOverrideDatesSet}
                weekdayOptions={dayOptions}
              />
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
