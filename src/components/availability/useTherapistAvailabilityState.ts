'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'
import {
  buildCanWorkDates,
  buildCannotWorkDates,
  buildCycleDays,
  buildDaysWithNoteText,
  buildInitialNotesByDate,
  buildInitialStatusByDate,
  buildNotesPayload,
  chunkCycleWeeks,
  countAvailableDays,
  hasDraftAvailabilityChanges,
} from '@/lib/therapist-availability-draft'
import {
  buildTherapistSubmissionUiState,
  resolveTherapistDeadlinePresentation,
} from '@/lib/therapist-availability-submission'
import { formatDateLabel, formatHumanCycleRange } from '@/lib/calendar-utils'

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  availability_due_at?: string | null
}

type DayStatus = 'none' | 'force_on' | 'force_off'

export function useTherapistAvailabilityState({
  availabilityRows,
  cycles,
  initialCycleId,
  submissionsByCycleId,
}: {
  availabilityRows: AvailabilityEntryTableRow[]
  cycles: Cycle[]
  initialCycleId: string
  submissionsByCycleId: Record<string, { submittedAt: string; lastEditedAt: string }>
}) {
  const [selectedCycleId, setSelectedCycleId] = useState(initialCycleId || cycles[0]?.id || '')

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  )

  const cycleRows = useMemo(
    () => availabilityRows.filter((row) => row.cycleId === selectedCycleId),
    [availabilityRows, selectedCycleId]
  )

  const initialStatusByDate = useMemo(() => buildInitialStatusByDate(cycleRows), [cycleRows])
  const initialNotesByDate = useMemo(() => buildInitialNotesByDate(cycleRows), [cycleRows])
  const [draftStatusByDate, setDraftStatusByDate] =
    useState<Record<string, DayStatus>>(initialStatusByDate)
  const [draftNotesByDate, setDraftNotesByDate] =
    useState<Record<string, string>>(initialNotesByDate)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const selectedDayEditorRef = useRef<HTMLDivElement>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
    setSelectedDate(null)
    const nextRows = availabilityRows.filter((row) => row.cycleId === nextCycleId)
    setDraftStatusByDate(buildInitialStatusByDate(nextRows))
    setDraftNotesByDate(buildInitialNotesByDate(nextRows))
  }

  const cycleDays = useMemo(() => buildCycleDays(selectedCycle), [selectedCycle])
  const weeks = useMemo(() => chunkCycleWeeks(cycleDays), [cycleDays])
  const canWorkDates = useMemo(() => buildCanWorkDates(draftStatusByDate), [draftStatusByDate])
  const cannotWorkDates = useMemo(
    () => buildCannotWorkDates(draftStatusByDate),
    [draftStatusByDate]
  )
  const daysWithNoteText = useMemo(
    () => buildDaysWithNoteText({ cycleDays, draftNotesByDate, draftStatusByDate }),
    [cycleDays, draftNotesByDate, draftStatusByDate]
  )
  const notesPayload = useMemo(
    () => buildNotesPayload({ draftNotesByDate, draftStatusByDate }),
    [draftNotesByDate, draftStatusByDate]
  )
  const availableCount = useMemo(
    () => countAvailableDays({ cycleDays, draftStatusByDate, selectedCycle }),
    [cycleDays, draftStatusByDate, selectedCycle]
  )
  const requestToWorkCount = canWorkDates.length

  const serverSubmission = submissionsByCycleId[selectedCycleId]
  const submissionUi = useMemo(
    () =>
      buildTherapistSubmissionUiState(
        serverSubmission
          ? {
              schedule_cycle_id: selectedCycleId,
              submitted_at: serverSubmission.submittedAt,
              last_edited_at: serverSubmission.lastEditedAt,
            }
          : null
      ),
    [selectedCycleId, serverSubmission]
  )

  const deadlinePresentation = useMemo(() => {
    if (!selectedCycle) return null
    return resolveTherapistDeadlinePresentation(
      {
        start_date: selectedCycle.start_date,
        availability_due_at: selectedCycle.availability_due_at ?? null,
      },
      submissionUi
    )
  }, [selectedCycle, submissionUi])

  const hasUnsavedChanges = useMemo(
    () =>
      hasDraftAvailabilityChanges({
        initialStatusByDate,
        draftStatusByDate,
        initialNotesByDate,
        draftNotesByDate,
      }),
    [draftNotesByDate, draftStatusByDate, initialNotesByDate, initialStatusByDate]
  )

  const submissionPrimaryLabel = submissionUi.isSubmitted ? 'Submitted' : 'Not submitted'

  const cyclePageSubtitle = useMemo(() => {
    if (!selectedCycle) return 'Select a cycle to enter availability.'
    const range = `Cycle: ${formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)}`
    if (selectedCycle.published) {
      return `${range} · Published ${formatDateLabel(selectedCycle.start_date)}`
    }
    return range
  }, [selectedCycle])

  function toggleDate(date: string) {
    if (!selectedCycle) return
    setDraftStatusByDate((current) => {
      const status = current[date] ?? 'none'
      const next: DayStatus =
        status === 'none' ? 'force_off' : status === 'force_off' ? 'force_on' : 'none'
      const prev = { ...current }
      if (next === 'none') {
        delete prev[date]
        setDraftNotesByDate((currentNotes) => {
          const nextNotes = { ...currentNotes }
          delete nextNotes[date]
          return nextNotes
        })
        return prev
      }
      return { ...prev, [date]: next }
    })
  }

  function updateDateNote(date: string, note: string) {
    setDraftNotesByDate((current) => ({
      ...current,
      [date]: note,
    }))
  }

  function handleDayClick(date: string) {
    setSelectedDate(date)
    toggleDate(date)
  }

  function clearSelectedDay() {
    if (!selectedDate) return
    const date = selectedDate
    setDraftStatusByDate((current) => {
      const next = { ...current }
      delete next[date]
      return next
    })
    setDraftNotesByDate((currentNotes) => {
      const next = { ...currentNotes }
      delete next[date]
      return next
    })
  }

  const selectedDayNeedsClear = Boolean(
    selectedDate &&
    ((draftStatusByDate[selectedDate] ?? 'none') !== 'none' ||
      (draftNotesByDate[selectedDate] ?? '').trim().length > 0)
  )

  useEffect(() => {
    if (!selectedDate || !selectedDayEditorRef.current) return
    selectedDayEditorRef.current.scrollIntoView({ block: 'nearest' })
  }, [selectedDate])

  const selectedDayStatus = selectedDate
    ? (draftStatusByDate[selectedDate] ?? 'none')
    : ('none' as DayStatus)

  useEffect(() => {
    if (!selectedDate) return
    if (selectedDayStatus !== 'force_off' && selectedDayStatus !== 'force_on') return
    const id = requestAnimationFrame(() => {
      noteTextareaRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [selectedDate, selectedDayStatus])

  return {
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
    selectedDayStatus,
    setSelectedDate,
    submissionPrimaryLabel,
    submissionUi,
    updateDateNote,
    weeks,
  }
}
