'use client'

import { AvailabilityCalendarPanel } from '@/components/availability/availability-calendar-panel'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import { formatEmployeeDate } from '@/lib/employee-directory'
import { cn } from '@/lib/utils'

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
}

type AvailabilityEditorMode = 'will_work' | 'cannot_work' | 'need_off' | 'request_to_work'

type DayState = {
  draftSelection?: AvailabilityEditorMode
  savedPlanner?: 'will_work' | 'cannot_work'
  requestTypes?: Array<'need_off' | 'request_to_work'>
}

type ManagerAvailabilityEditorPanelProps = {
  therapist: TherapistOption
  cycleLabel: string
  cycleStart: string
  cycleEnd: string
  mode: AvailabilityEditorMode
  selectedDates: string[]
  dayStates: Record<string, DayState>
  hasUnsavedChanges: boolean
  onModeChange: (mode: AvailabilityEditorMode) => void
  onToggleDate: (date: string) => void
  onClearSelectedDates: () => void
  onRemoveSelectedDate: (date: string) => void
  saveManagerPlannerDatesAction: (formData: FormData) => void | Promise<void>
  saveManagerAvailabilityRequestsAction: (formData: FormData) => void | Promise<void>
  copyAvailabilityFromPreviousCycleAction: (formData: FormData) => void | Promise<void>
  selectedCycleId: string
  selectedTherapistId: string
}

const MODE_OPTIONS: Array<{
  value: AvailabilityEditorMode
  label: string
  tone: string
}> = [
  {
    value: 'will_work',
    label: 'Will work',
    tone: 'data-[active=true]:bg-[var(--success-subtle)] data-[active=true]:text-[var(--success-text)]',
  },
  {
    value: 'cannot_work',
    label: 'Cannot work',
    tone: 'data-[active=true]:bg-[var(--error-subtle)] data-[active=true]:text-[var(--error-text)]',
  },
  {
    value: 'need_off',
    label: 'Need Off',
    tone: 'data-[active=true]:bg-[var(--warning-subtle)] data-[active=true]:text-[var(--warning-text)]',
  },
  {
    value: 'request_to_work',
    label: 'Need to Work',
    tone: 'data-[active=true]:bg-[var(--info-subtle)] data-[active=true]:text-[var(--info-text)]',
  },
]

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? 'therapist'
}

function saveLabel(therapistName: string) {
  return `Save for ${firstName(therapistName)}`
}

export function ManagerAvailabilityEditorPanel({
  therapist,
  cycleLabel,
  cycleStart,
  cycleEnd,
  mode,
  selectedDates,
  dayStates,
  hasUnsavedChanges,
  onModeChange,
  onToggleDate,
  onClearSelectedDates,
  onRemoveSelectedDate,
  saveManagerPlannerDatesAction,
  saveManagerAvailabilityRequestsAction,
  copyAvailabilityFromPreviousCycleAction,
  selectedCycleId,
  selectedTherapistId,
}: ManagerAvailabilityEditorPanelProps) {
  const isPlannerMode = mode === 'will_work' || mode === 'cannot_work'
  const saveAction = isPlannerMode
    ? saveManagerPlannerDatesAction
    : saveManagerAvailabilityRequestsAction

  return (
    <section
      data-availability-editor
      className="rounded-[1.2rem] border border-border/70 bg-card px-4 py-4 shadow-tw-sm sm:px-5"
    >
      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="cycle_id" value={selectedCycleId} />
        <input type="hidden" name="therapist_id" value={selectedTherapistId} />
        <input
          type="hidden"
          name="shift_type"
          value={isPlannerMode ? therapist.shift_type : 'both'}
        />
        <input type="hidden" name="mode" value={mode} />
        {selectedDates.map((date) => (
          <input key={`selected-date-${date}`} type="hidden" name="dates" value={date} />
        ))}

        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-foreground">
                Edit availability
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                You are entering availability on behalf of {therapist.full_name}. Select dates in
                the Schedule Block grid, choose the state to apply, and save when ready.
              </p>
            </div>

            <button
              type="submit"
              formAction={copyAvailabilityFromPreviousCycleAction}
              className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Copy previous
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-muted/10 px-3 py-1">
              {cycleLabel}
            </span>
            <span className="rounded-full border border-border/70 bg-muted/10 px-3 py-1">
              {therapist.shift_type === 'night' ? 'Night shift' : 'Day shift'}
            </span>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              data-active={mode === option.value}
              className={cn(
                'min-h-11 rounded-xl border border-border/70 px-3 py-3 text-left text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground',
                option.tone,
                mode === option.value && 'border-transparent shadow-tw-inset-highlight-soft'
              )}
              onClick={() => onModeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <section className="rounded-[1.15rem] border border-dashed border-border/70 bg-muted/[0.08] px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Selected dates
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
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
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  className="inline-flex min-h-10 items-center rounded-full border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  onClick={() => onRemoveSelectedDate(date)}
                >
                  {formatEmployeeDate(date)} x
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Select dates in the Schedule Block grid to start editing.
            </p>
          )}
        </section>

        <section className="rounded-[1.2rem] border border-border/60 bg-background/80 px-3 py-3 sm:px-4 sm:py-4">
          <AvailabilityCalendarPanel
            cycleStart={cycleStart}
            cycleEnd={cycleEnd}
            dayStates={dayStates}
            onToggleDate={onToggleDate}
          />
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/70 pt-4">
          <FormSubmitButton
            type="submit"
            pendingText="Saving..."
            disabled={!hasUnsavedChanges}
            className="min-h-11 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
          >
            {saveLabel(therapist.full_name)}
          </FormSubmitButton>
        </div>
      </form>
    </section>
  )
}
