'use client'

import type { RefObject } from 'react'

import { Label } from '@/components/ui/label'
import { formatDateLabel } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

type DayStatus = 'none' | 'force_on' | 'force_off'

function therapistDayStatusLabel(status: DayStatus): string {
  if (status === 'force_off') return 'Need Off'
  if (status === 'force_on') return 'Request to Work'
  return 'Available'
}

type TherapistAvailabilitySelectedDayEditorProps = {
  clearSelectedDay: () => void
  draftNotesByDate: Record<string, string>
  draftStatusByDate: Record<string, DayStatus>
  noteTextareaRef: RefObject<HTMLTextAreaElement | null>
  selectedDate: string
  selectedDayEditorRef: RefObject<HTMLDivElement | null>
  selectedDayNeedsClear: boolean
  updateDateNote: (date: string, note: string) => void
}

export function TherapistAvailabilitySelectedDayEditor({
  clearSelectedDay,
  draftNotesByDate,
  draftStatusByDate,
  noteTextareaRef,
  selectedDate,
  selectedDayEditorRef,
  selectedDayNeedsClear,
  updateDateNote,
}: TherapistAvailabilitySelectedDayEditorProps) {
  const selectedStatus = draftStatusByDate[selectedDate] ?? 'none'

  return (
    <div
      ref={selectedDayEditorRef}
      className="rounded-xl border border-border/60 bg-muted/10 px-3 py-1.5 sm:px-3.5"
    >
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Selected Day
      </p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <p className="text-sm font-semibold leading-tight text-foreground">
          {formatDateLabel(selectedDate)}
        </p>
        <span
          className={cn(
            'inline-flex w-fit items-center rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-[0.06em]',
            selectedStatus === 'none' && 'border-border/80 bg-muted/30 text-muted-foreground',
            selectedStatus === 'force_off' &&
              'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]',
            selectedStatus === 'force_on' &&
              'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
          )}
        >
          {therapistDayStatusLabel(selectedStatus)}
        </span>
      </div>

      {selectedStatus === 'none' ? (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Notes are only saved for Need Off or Request to Work days.
        </p>
      ) : (
        <div className="mt-1.5 space-y-0.5">
          <Label
            htmlFor={`therapist-day-note-${selectedDate}`}
            className="text-[11px] font-medium text-foreground"
          >
            Optional note
          </Label>
          <p className="text-[10px] leading-snug text-muted-foreground">
            Add context only if it would help with scheduling.
          </p>
          <textarea
            id={`therapist-day-note-${selectedDate}`}
            ref={noteTextareaRef}
            value={draftNotesByDate[selectedDate] ?? ''}
            onChange={(event) => updateDateNote(selectedDate, event.target.value)}
            placeholder={
              selectedStatus === 'force_off'
                ? 'Optional: why you need this day off'
                : 'Optional: anything the scheduler should know'
            }
            className="min-h-[56px] w-full rounded-lg border border-border/15 bg-background px-2.5 py-1.5 text-sm text-foreground shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/45 focus-visible:border-ring focus-visible:shadow-sm focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      )}

      {selectedDayNeedsClear ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/25 pt-1.5">
          <button
            type="button"
            className="inline-flex h-7 shrink-0 items-center rounded-md border border-transparent px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            onClick={clearSelectedDay}
          >
            Clear day
          </button>
          {(draftNotesByDate[selectedDate] ?? '').trim().length > 0 ? (
            <button
              type="button"
              className="text-[11px] font-medium text-muted-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => updateDateNote(selectedDate, '')}
            >
              Clear note
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
