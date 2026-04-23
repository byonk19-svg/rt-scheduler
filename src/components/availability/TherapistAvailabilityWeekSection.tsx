'use client'

import type { RefObject } from 'react'

import { TherapistAvailabilitySelectedDayEditor } from '@/components/availability/TherapistAvailabilitySelectedDayEditor'
import { cn } from '@/lib/utils'
import { formatDateLabel } from '@/lib/calendar-utils'

type DayStatus = 'none' | 'force_on' | 'force_off'

function therapistDayStatusLabel(status: DayStatus): string {
  if (status === 'force_off') return 'Need Off'
  if (status === 'force_on') return 'Request to Work'
  return 'Available'
}

function monthRibbonLabel(isoDate: string, previousIsoDate: string | null): string | null {
  const d = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  if (!previousIsoDate) {
    return d.toLocaleDateString('en-US', { month: 'short' })
  }
  const p = new Date(`${previousIsoDate}T12:00:00`)
  if (Number.isNaN(p.getTime())) return d.toLocaleDateString('en-US', { month: 'short' })
  if (d.getFullYear() !== p.getFullYear() || d.getMonth() !== p.getMonth()) {
    return d.toLocaleDateString('en-US', { month: 'short' })
  }
  return null
}

type TherapistAvailabilityWeekSectionProps = {
  clearSelectedDay: () => void
  cycleDays: string[]
  draftNotesByDate: Record<string, string>
  draftStatusByDate: Record<string, DayStatus>
  handleDayClick: (date: string) => void
  noteTextareaRef: RefObject<HTMLTextAreaElement | null>
  selectedDate: string | null
  selectedDayEditorRef: RefObject<HTMLDivElement | null>
  selectedDayNeedsClear: boolean
  updateDateNote: (date: string, note: string) => void
  week: string[]
  weekIndex: number
}

export function TherapistAvailabilityWeekSection({
  clearSelectedDay,
  cycleDays,
  draftNotesByDate,
  draftStatusByDate,
  handleDayClick,
  noteTextareaRef,
  selectedDate,
  selectedDayEditorRef,
  selectedDayNeedsClear,
  updateDateNote,
  week,
  weekIndex,
}: TherapistAvailabilityWeekSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          Week {weekIndex + 1}
        </p>
        <div className="h-px flex-1 bg-border/90" />
      </div>
      <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
        {week.map((date) => {
          const status = draftStatusByDate[date] ?? 'none'
          const dayIndex = cycleDays.indexOf(date)
          const prevInCycle = dayIndex > 0 ? cycleDays[dayIndex - 1] : null
          const monthRibbon = monthRibbonLabel(date, prevInCycle)
          return (
            <button
              key={date}
              type="button"
              onClick={() => handleDayClick(date)}
              className={cn(
                'relative flex min-h-[5.75rem] flex-col items-center justify-center rounded-[20px] border px-1 py-2 text-center shadow-tw-2xs transition-[border-color,box-shadow,transform,background-color] duration-200',
                'hover:-translate-y-px focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                status === 'none' &&
                  'border-border/25 bg-muted/10 text-muted-foreground/85 shadow-none hover:border-primary/15 hover:bg-muted/18',
                status === 'force_off' &&
                  'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)] shadow-tw-cell-error ring-1 ring-[var(--error-border)]/35',
                status === 'force_on' &&
                  'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)] shadow-tw-cell-info ring-1 ring-[var(--info-border)]/40',
                selectedDate === date &&
                  'z-[1] ring-1 ring-primary/70 ring-offset-1 ring-offset-card'
              )}
              aria-pressed={selectedDate === date}
              aria-label={`${formatDateLabel(date)}: ${therapistDayStatusLabel(status)}`}
            >
              {monthRibbon ? (
                <span
                  className={cn(
                    'mb-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em]',
                    status === 'none' && 'text-muted-foreground/65',
                    status === 'force_on' && 'text-[var(--info-text)]/90',
                    status === 'force_off' && 'text-[var(--error-text)]/90'
                  )}
                >
                  {monthRibbon}
                </span>
              ) : (
                <span className="mb-0.5 h-[0.58rem]" aria-hidden />
              )}
              <span
                className={cn(
                  'text-[1.2rem] leading-none tracking-[-0.03em]',
                  status === 'none'
                    ? 'font-medium text-muted-foreground/75'
                    : 'font-bold text-foreground'
                )}
              >
                {new Date(`${date}T00:00:00`).getDate()}
              </span>
              <span
                className={cn(
                  'mt-1.5 block max-w-full px-0.5 text-[0.62rem] leading-snug',
                  status === 'none' && 'font-medium text-muted-foreground/75',
                  status === 'force_off' && 'font-semibold',
                  status === 'force_on' && 'font-semibold'
                )}
              >
                {therapistDayStatusLabel(status)}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDate && week.includes(selectedDate) ? (
        <TherapistAvailabilitySelectedDayEditor
          clearSelectedDay={clearSelectedDay}
          draftNotesByDate={draftNotesByDate}
          draftStatusByDate={draftStatusByDate}
          noteTextareaRef={noteTextareaRef}
          selectedDate={selectedDate}
          selectedDayEditorRef={selectedDayEditorRef}
          selectedDayNeedsClear={selectedDayNeedsClear}
          updateDateNote={updateDateNote}
        />
      ) : null}
    </div>
  )
}
