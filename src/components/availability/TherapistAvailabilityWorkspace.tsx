'use client'

import Link from 'next/link'
import { Send } from 'lucide-react'

import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import { TherapistAvailabilityCalendar } from '@/components/availability/TherapistAvailabilityCalendar'
import { TherapistAvailabilityHeader } from '@/components/availability/TherapistAvailabilityHeader'
import { TherapistAvailabilityNotesSummary } from '@/components/availability/TherapistAvailabilityNotesSummary'
import { useTherapistAvailabilityState } from '@/components/availability/useTherapistAvailabilityState'
import { ScheduledConflictBanner } from '@/components/availability/ScheduledConflictBanner'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { ConflictItem } from '@/lib/availability-scheduled-conflict'
import { formatHumanCycleRange } from '@/lib/calendar-utils'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  availability_due_at?: string | null
}

type Props = {
  cycles: Cycle[]
  availabilityRows: AvailabilityEntryTableRow[]
  conflicts?: ConflictItem[]
  initialCycleId: string
  submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }>
  submitTherapistAvailabilityGridAction: (formData: FormData) => void | Promise<void>
  returnToPath?: '/availability' | '/therapist/availability'
}

export function TherapistAvailabilityWorkspace({
  cycles,
  availabilityRows,
  conflicts = [],
  initialCycleId,
  submissionsByCycleId,
  submitTherapistAvailabilityGridAction,
  returnToPath = '/availability',
}: Props) {
  const {
    availableCount,
    canWorkDates,
    cannotWorkDates,
    clearSelectedDay,
    cycleDays,
    cyclePageSubtitle,
    daysWithNoteText,
    deadlinePresentation,
    draftNotesByDate,
    draftStatusByDate,
    handleCycleChange,
    handleDayClick,
    hasUnsavedChanges,
    notesPayload,
    noteTextareaRef,
    requestToWorkCount,
    selectedCycle,
    selectedCycleId,
    selectedDate,
    selectedDayEditorRef,
    selectedDayNeedsClear,
    submissionPrimaryLabel,
    submissionUi,
    updateDateNote,
    weeks,
  } = useTherapistAvailabilityState({
    availabilityRows,
    cycles,
    initialCycleId,
    submissionsByCycleId,
  })

  const actionButtons = (
    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
      {!submissionUi.isSubmitted ? (
        <>
          <FormSubmitButton
            type="submit"
            name="workflow"
            value="draft"
            variant="outline"
            size="sm"
            pendingText="Saving..."
            className="min-h-11 shrink-0 px-4 font-semibold sm:min-w-[8.5rem]"
          >
            Save progress
          </FormSubmitButton>
          <FormSubmitButton
            type="submit"
            name="workflow"
            value="submit"
            size="sm"
            pendingText="Saving..."
            className="min-h-11 shrink-0 gap-2 px-5 font-semibold shadow-sm sm:min-w-[10.5rem]"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            Submit availability
          </FormSubmitButton>
        </>
      ) : (
        <FormSubmitButton
          type="submit"
          name="workflow"
          value="submit"
          size="sm"
          pendingText="Saving..."
          className="min-h-11 shrink-0 gap-2 px-5 font-semibold shadow-sm"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Save changes
        </FormSubmitButton>
      )}
    </div>
  )

  if (cycles.length === 0) {
    return (
      <section id="therapist-availability-workspace" className="space-y-4">
        <header className="border-b border-border/70 pb-4">
          <h1 className="font-heading text-[1.4rem] font-semibold leading-tight tracking-tight text-foreground">
            Availability for This Cycle
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No scheduling block is open for availability yet. Your account is fine - managers create
            cycles; when one opens, you can submit your availability here.
          </p>
        </header>
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5">
          <p className="text-sm text-muted-foreground">
            Until then, use the dashboard for a quick overview, check your published shifts, or
            browse open swap and pickup posts.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard/staff">Dashboard</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/shift-board">Open shifts</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/staff/my-schedule">My shifts</Link>
            </Button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="therapist-availability-workspace" className="space-y-5">
      <TherapistAvailabilityHeader
        actionButtons={null}
        availableCount={availableCount}
        cannotWorkCount={cannotWorkDates.length}
        cyclePageSubtitle={cyclePageSubtitle}
        deadlinePresentation={deadlinePresentation}
        hasUnsavedChanges={hasUnsavedChanges}
        requestToWorkCount={requestToWorkCount}
        submissionPrimaryLabel={submissionPrimaryLabel}
        submitted={submissionUi.isSubmitted}
      />

      {conflicts.length > 0 ? (
        <ScheduledConflictBanner conflicts={conflicts} onDismiss={() => {}} />
      ) : null}

      <form
        action={submitTherapistAvailabilityGridAction}
        className="overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-tw-2xs-soft"
      >
        <input type="hidden" name="cycle_id" value={selectedCycleId} />
        <input type="hidden" name="return_to" value={returnToPath} />
        <input type="hidden" name="notes_json" value={notesPayload} />
        {canWorkDates.map((date) => (
          <input key={`can-${date}`} type="hidden" name="can_work_dates" value={date} />
        ))}
        {cannotWorkDates.map((date) => (
          <input key={`cannot-${date}`} type="hidden" name="cannot_work_dates" value={date} />
        ))}

        <div className="flex flex-col gap-2 border-b border-border/80 px-5 py-3 sm:px-6">
          <div className="w-full max-w-[15rem] space-y-1 sm:max-w-[17.5rem]">
            <Label
              htmlFor="therapist_cycle_id"
              className="text-[0.6rem] font-medium uppercase tracking-[0.08em] text-muted-foreground/75"
            >
              Cycle
            </Label>
            <select
              id="therapist_cycle_id"
              title={
                selectedCycle
                  ? `${selectedCycle.label} · ${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)}`
                  : undefined
              }
              className="h-10 w-full max-w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={selectedCycleId}
              onChange={(event) => handleCycleChange(event.target.value)}
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-b border-[var(--info-border)] bg-[var(--info-subtle)] px-5 py-2 sm:px-6">
          <p className="text-xs font-medium leading-snug text-[var(--info-text)]">
            Tap a day to switch between Available, Need Off, and Request to Work. Notes (Need Off /
            Request to Work only) appear below the selected week when needed.
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--info-text)]/95">
            Available = I can work · Need Off = I&apos;m requesting the day off · Request to Work =
            Please consider me for a shift
          </p>
        </div>

        <TherapistAvailabilityCalendar
          clearSelectedDay={clearSelectedDay}
          cycleDays={cycleDays}
          draftNotesByDate={draftNotesByDate}
          draftStatusByDate={draftStatusByDate}
          handleDayClick={handleDayClick}
          noteTextareaRef={noteTextareaRef}
          selectedDate={selectedDate}
          selectedDayEditorRef={selectedDayEditorRef}
          selectedDayNeedsClear={selectedDayNeedsClear}
          updateDateNote={updateDateNote}
          weeks={weeks}
        />

        <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <p className="text-xs text-muted-foreground sm:mr-auto">
            Save progress keeps a draft. Submit availability marks this cycle as officially
            submitted.
          </p>
          {actionButtons}
        </div>

        <TherapistAvailabilityNotesSummary
          daysWithNoteText={daysWithNoteText}
          draftNotesByDate={draftNotesByDate}
          draftStatusByDate={draftStatusByDate}
        />
      </form>
    </section>
  )
}
