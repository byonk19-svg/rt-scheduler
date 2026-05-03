'use client'

import { AvailabilityCalendarPanel } from '@/components/availability/availability-calendar-panel'
import { FormSubmitButton } from '@/components/form-submit-button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

type ManagerAvailabilityEditorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  therapist: TherapistOption | null
  cycleLabel: string
  cycleStart: string
  cycleEnd: string
  mode: AvailabilityEditorMode
  selectedDates: string[]
  dayStates: Record<string, DayState>
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
    label: 'Need off',
    tone: 'data-[active=true]:bg-[var(--warning-subtle)] data-[active=true]:text-[var(--warning-text)]',
  },
  {
    value: 'request_to_work',
    label: 'Request to work',
    tone: 'data-[active=true]:bg-[var(--info-subtle)] data-[active=true]:text-[var(--info-text)]',
  },
]

function firstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] ?? 'therapist'
}

function saveLabel(therapistName: string | null) {
  return `Save for ${firstName(therapistName)}`
}

export function ManagerAvailabilityEditorDialog({
  open,
  onOpenChange,
  therapist,
  cycleLabel,
  cycleStart,
  cycleEnd,
  mode,
  selectedDates,
  dayStates,
  onModeChange,
  onToggleDate,
  onClearSelectedDates,
  onRemoveSelectedDate,
  saveManagerPlannerDatesAction,
  saveManagerAvailabilityRequestsAction,
  copyAvailabilityFromPreviousCycleAction,
  selectedCycleId,
  selectedTherapistId,
}: ManagerAvailabilityEditorDialogProps) {
  if (!therapist) return null

  const isPlannerMode = mode === 'will_work' || mode === 'cannot_work'
  const saveAction = isPlannerMode
    ? saveManagerPlannerDatesAction
    : saveManagerAvailabilityRequestsAction

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[100dvh] w-screen max-w-none translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-none border-border/80 bg-card p-0 shadow-tw-modal lg:h-[min(92vh,58rem)] lg:w-[min(96vw,76rem)] lg:max-w-[76rem] lg:rounded-[1.4rem]"
      >
        <form action={saveAction} className="flex h-full min-h-0 flex-col">
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

          <DialogHeader className="border-b border-border/70 px-4 py-4 text-left sm:px-6">
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-foreground">
              Edit availability for {firstName(therapist.full_name)}
            </DialogTitle>
            <DialogDescription className="max-w-[44rem] text-sm leading-relaxed text-muted-foreground">
              You are entering availability on behalf of {therapist.full_name}. Select dates in the
              6-week cycle grid, choose the state to apply, and save when ready.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-muted/10 px-3 py-1">
                  {cycleLabel}
                </span>
                <span className="rounded-full border border-border/70 bg-muted/10 px-3 py-1">
                  {therapist.shift_type === 'night' ? 'Night shift' : 'Day shift'}
                </span>
                <button
                  type="submit"
                  formAction={copyAvailabilityFromPreviousCycleAction}
                  className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Copy previous
                </button>
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
                    Select dates in the cycle grid to enable saving.
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
            </div>
          </div>

          <DialogFooter className="border-t border-border/70 bg-card px-4 py-4 sm:px-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <FormSubmitButton
              type="submit"
              pendingText="Saving..."
              disabled={selectedDates.length === 0}
              className="min-h-11 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
            >
              {saveLabel(therapist.full_name)}
            </FormSubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
