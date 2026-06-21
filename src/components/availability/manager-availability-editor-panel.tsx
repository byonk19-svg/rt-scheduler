'use client'

import type { MouseEvent } from 'react'

import { AvailabilityCalendarPanel } from '@/components/availability/availability-calendar-panel'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import {
  CLEAR_AVAILABILITY_CONFIRMATION,
  COPY_PREVIOUS_AVAILABILITY_CONFIRMATION,
  confirmAvailabilityDestructiveAction,
} from '@/lib/availability-destructive-confirmation'
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
  group: 'Availability' | 'Planning assumptions'
  tone: string
}> = [
  {
    value: 'will_work',
    label: 'Available',
    group: 'Planning assumptions',
    tone: 'data-[active=true]:bg-[var(--success-subtle)] data-[active=true]:text-[var(--success-text)]',
  },
  {
    value: 'cannot_work',
    label: 'Unavailable',
    group: 'Planning assumptions',
    tone: 'data-[active=true]:bg-[var(--error-subtle)] data-[active=true]:text-[var(--error-text)]',
  },
  {
    value: 'need_off',
    label: 'Need Off',
    group: 'Availability',
    tone: 'data-[active=true]:bg-[var(--warning-subtle)] data-[active=true]:text-[var(--warning-text)]',
  },
  {
    value: 'request_to_work',
    label: 'Need to Work',
    group: 'Availability',
    tone: 'data-[active=true]:bg-[var(--info-subtle)] data-[active=true]:text-[var(--info-text)]',
  },
]

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? 'therapist'
}

function saveLabel(therapistName: string) {
  return `Save for ${firstName(therapistName)}`
}

function modeLabel(mode: AvailabilityEditorMode) {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? 'selected state'
}

export function ManagerAvailabilityEditorPanel({
  therapist,
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
  const hasExistingSelections = Object.values(dayStates).some(
    (state) => state.draftSelection || state.savedPlanner || (state.requestTypes?.length ?? 0) > 0
  )
  const selectedDatesHaveSelections = selectedDates.some((date) => {
    const state = dayStates[date]
    return Boolean(
      state?.draftSelection || state?.savedPlanner || (state?.requestTypes?.length ?? 0) > 0
    )
  })

  function handleCopyPreviousBlockClick(event: MouseEvent<HTMLButtonElement>) {
    if (
      !confirmAvailabilityDestructiveAction({
        hasUnsavedChanges,
        hasExistingSelections,
        message: COPY_PREVIOUS_AVAILABILITY_CONFIRMATION,
        confirm: (message) => window.confirm(message),
      })
    ) {
      event.preventDefault()
    }
  }

  function handleClearSelectedDates() {
    if (
      !confirmAvailabilityDestructiveAction({
        hasUnsavedChanges,
        hasExistingSelections: selectedDatesHaveSelections,
        message: CLEAR_AVAILABILITY_CONFIRMATION,
        confirm: (message) => window.confirm(message),
      })
    ) {
      return
    }
    onClearSelectedDates()
  }

  return (
    <section
      data-availability-editor
      className="rounded-[1rem] border border-border/70 bg-card px-3 py-3 shadow-tw-sm sm:px-4"
    >
      <form action={saveAction} className="space-y-2.5">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-foreground">
                Availability editor
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Select dates, then choose what to save for {therapist.full_name}.
              </p>
            </div>

            <button
              type="submit"
              formAction={copyAvailabilityFromPreviousCycleAction}
              onClick={handleCopyPreviousBlockClick}
              className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Copy previous block
            </button>
          </div>
          <p className="max-w-3xl text-xs text-muted-foreground">
            Use Need Off or Need to Work for availability exceptions. Planning assumptions are
            optional manager-only draft notes.
          </p>
        </div>

        <fieldset className="rounded-[0.8rem] border border-border/60 bg-muted/[0.04] px-2.5 py-2">
          <legend className="px-1 text-[11px] font-semibold uppercase text-muted-foreground">
            Availability exceptions
          </legend>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            {MODE_OPTIONS.filter((option) => option.group === 'Availability').map((option) => (
              <button
                key={option.value}
                type="button"
                data-active={mode === option.value && selectedDates.length > 0}
                className={cn(
                  'min-h-9 rounded-md border border-border/70 px-3 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground',
                  option.tone,
                  mode === option.value &&
                    selectedDates.length > 0 &&
                    'border-transparent shadow-tw-inset-highlight-soft'
                )}
                onClick={() => onModeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <details className="rounded-[0.8rem] border border-border/60 bg-muted/[0.03] px-2.5 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            Planning assumptions
          </summary>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {MODE_OPTIONS.filter((option) => option.group === 'Planning assumptions').map(
              (option) => (
                <button
                  key={option.value}
                  type="button"
                  data-active={mode === option.value && selectedDates.length > 0}
                  className={cn(
                    'min-h-9 rounded-md border border-border/70 px-3 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:text-foreground',
                    option.tone,
                    mode === option.value &&
                      selectedDates.length > 0 &&
                      'border-transparent shadow-tw-inset-highlight-soft'
                  )}
                  onClick={() => onModeChange(option.value)}
                >
                  {option.label}
                </button>
              )
            )}
          </div>
        </details>

        <section className="rounded-[0.9rem] border border-border/60 bg-background/80 px-2.5 py-2.5 sm:px-3">
          <AvailabilityCalendarPanel
            cycleStart={cycleStart}
            cycleEnd={cycleEnd}
            dayStates={dayStates}
            onToggleDate={onToggleDate}
          />
        </section>

        <section className="rounded-[0.95rem] border border-dashed border-border/70 bg-muted/[0.08] px-3 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">
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
              onClick={handleClearSelectedDates}
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
          <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
            {selectedDates.length > 0
              ? `${selectedDates.length} selected - Apply: ${modeLabel(mode)}`
              : hasUnsavedChanges
                ? 'Draft changes ready to save.'
                : 'No unsaved changes.'}
          </p>
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
