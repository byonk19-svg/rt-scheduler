import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import type { PlannerMode } from '@/lib/availability-planner'
import { formatEmployeeDate } from '@/lib/employee-directory'

type PlannerSelectedDatesFormProps = {
  selectedCycleId: string
  selectedTherapistId: string
  selectedTherapistShiftType: 'day' | 'night'
  mode: PlannerMode
  selectedDates: string[]
  onClearSelectedDates: () => void
  onRemoveSelectedDate: (date: string) => void
  saveAction: (formData: FormData) => void | Promise<void>
}

function buildSaveLabel(mode: PlannerMode, count: number) {
  if (count === 0) return 'Select dates to save'
  if (mode === 'will_work') {
    return `Save ${count} will-work date${count === 1 ? '' : 's'}`
  }
  return `Save ${count} blocked date${count === 1 ? '' : 's'}`
}

export function PlannerSelectedDatesForm({
  selectedCycleId,
  selectedTherapistId,
  selectedTherapistShiftType,
  mode,
  selectedDates,
  onClearSelectedDates,
  onRemoveSelectedDate,
  saveAction,
}: PlannerSelectedDatesFormProps) {
  return (
    <form action={saveAction} className="space-y-2.5">
      <input type="hidden" name="cycle_id" value={selectedCycleId} />
      <input type="hidden" name="therapist_id" value={selectedTherapistId} />
      <input type="hidden" name="shift_type" value={selectedTherapistShiftType} />
      <input type="hidden" name="mode" value={mode} />
      {selectedDates.map((date) => (
        <input key={`selected-date-${date}`} type="hidden" name="dates" value={date} />
      ))}

      <div className="rounded-[1.1rem] border border-dashed border-border/70 bg-background/75 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Selected dates
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {selectedDates.length} selected
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClearSelectedDates}
            disabled={selectedDates.length === 0}
          >
            Clear selected dates
          </Button>
        </div>

        {selectedDates.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {selectedDates.map((date) => (
              <button
                key={date}
                type="button"
                className="inline-flex min-h-11 items-center rounded-full border border-border/70 bg-muted/25 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:min-h-10 sm:px-2.5 sm:py-1 sm:text-[11px]"
                onClick={() => onRemoveSelectedDate(date)}
              >
                {formatEmployeeDate(date)} x
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2.5 text-sm text-muted-foreground">
            Select dates on the calendar, then save this mode.
          </p>
        )}
      </div>

      <FormSubmitButton
        type="submit"
        pendingText="Saving..."
        disabled={!selectedCycleId || !selectedTherapistId || selectedDates.length === 0}
        className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {buildSaveLabel(mode, selectedDates.length)}
      </FormSubmitButton>
    </form>
  )
}
