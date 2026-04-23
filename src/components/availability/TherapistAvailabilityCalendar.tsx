'use client'

import type { RefObject } from 'react'

import { TherapistAvailabilityWeekSection } from '@/components/availability/TherapistAvailabilityWeekSection'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
type DayStatus = 'none' | 'force_on' | 'force_off'

export function therapistDayStatusLabel(status: DayStatus): string {
  if (status === 'force_off') return 'Need Off'
  if (status === 'force_on') return 'Request to Work'
  return 'Available'
}

export function TherapistAvailabilityCalendar({
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
  weeks,
}: {
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
  weeks: string[][]
}) {
  return (
    <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
      <div className="grid grid-cols-7 gap-3 border-y border-border/80 py-2.5">
        {DOW.map((dow) => (
          <p
            key={dow}
            className="text-center text-[0.68rem] font-semibold tracking-[0.1em] text-muted-foreground"
          >
            {dow}
          </p>
        ))}
      </div>

      {weeks.map((week, idx) => (
        <TherapistAvailabilityWeekSection
          key={`week-${idx}`}
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
          week={week}
          weekIndex={idx}
        />
      ))}
    </div>
  )
}
