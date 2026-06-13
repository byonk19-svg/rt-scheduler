'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useAvailabilityPlannerFocus } from '@/components/availability/availability-planner-focus-context'
import type {
  AvailabilityRosterFilter,
  AvailabilityStatusSummaryRow,
} from '@/components/availability/AvailabilityStatusSummary'
import type { PlannerMode, PlannerOverrideRow } from '@/lib/availability-planner'
import { splitPlannerDatesByMode } from '@/lib/availability-planner'
import { sendAvailabilityRemindersAction } from '@/app/(app)/availability/manager-planner-actions'
import type { AvailabilityWindowState } from '@/lib/availability-window'
import { formatDateLabel, formatHumanCycleRange } from '@/lib/calendar-utils'
import { isDateWithinCycle } from '@/lib/employee-directory'
import { availabilityDueDateKey } from '@/lib/schedule-block-planning'
import { cn } from '@/lib/utils'

const AvailabilityStatusSummary = dynamic(() =>
  import('@/components/availability/AvailabilityStatusSummary').then(
    (module) => module.AvailabilityStatusSummary ?? (() => null)
  )
)
const TherapistContextPanel = dynamic(() =>
  import('@/components/availability/therapist-context-panel').then(
    (module) => module.TherapistContextPanel ?? (() => null)
  )
)

type Cycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  availability_due_at?: string | null
  availability_closed_at?: string | null
  availability_reopened_at?: string | null
  status?: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
}

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
}

type PlannerOverrideRecord = PlannerOverrideRow & {
  therapist_id: string
  cycle_id: string
  intent?: string | null
}

type AvailabilityEntryRow = {
  id: string
  therapistId: string
  cycleId: string
  date: string
  reason: string | null
  createdById?: string
  createdAt: string
  updatedAt?: string
  requestedBy: string
  entryType: 'force_off' | 'force_on'
  shiftType: 'day' | 'night' | 'both'
  source: 'manager' | 'therapist'
  intent?: string | null
}

type AvailabilityEditorMode = PlannerMode | 'need_off' | 'request_to_work'

type Props = {
  cycles: Cycle[]
  therapists: TherapistOption[]
  overrides: PlannerOverrideRecord[]
  availabilityEntries: AvailabilityEntryRow[]
  initialCycleId: string
  initialTherapistId: string
  submittedRows: AvailabilityStatusSummaryRow[]
  missingRows: AvailabilityStatusSummaryRow[]
  initialRosterFilter?: AvailabilityRosterFilter
  saveManagerPlannerDatesAction: (formData: FormData) => void | Promise<void>
  saveManagerAvailabilityRequestsAction: (formData: FormData) => void | Promise<void>
  copyAvailabilityFromPreviousCycleAction: (formData: FormData) => void | Promise<void>
  availabilityWindow?: AvailabilityWindowState
  toolbarUtilities?: ReactNode
}

type QueueRow = AvailabilityStatusSummaryRow & {
  submitted: boolean
  shiftType: TherapistOption['shift_type']
  employmentType: TherapistOption['employment_type']
}

const REQUEST_MODE_TO_ENTRY_TYPE = {
  need_off: 'force_off',
  request_to_work: 'force_on',
} as const

function getSavedBucketsForSelection(
  overrides: PlannerOverrideRecord[],
  cycleId: string,
  therapistId: string
) {
  return splitPlannerDatesByMode(
    overrides.filter(
      (row) =>
        row.cycle_id === cycleId &&
        row.therapist_id === therapistId &&
        isManagerPlanIntent(row.intent)
    ),
    { source: 'manager' }
  )
}

function isManagerPlanIntent(intent: string | null | undefined) {
  return intent === 'manager_block' || intent === 'manager_force'
}

function isTherapistAvailabilityIntent(row: {
  source: 'manager' | 'therapist'
  intent?: string | null
}) {
  return (
    row.source === 'therapist' ||
    row.intent === 'therapist_need_off' ||
    row.intent === 'therapist_wants_work' ||
    row.intent === 'email_intake'
  )
}

function uniqueSortedDates(dates: string[]) {
  return [...new Set(dates)].sort((a, b) => a.localeCompare(b))
}

function wasAvailabilityReopened(cycle: Cycle | null) {
  const closedAt = cycle?.availability_closed_at
    ? new Date(cycle.availability_closed_at).getTime()
    : null
  const reopenedAt = cycle?.availability_reopened_at
    ? new Date(cycle.availability_reopened_at).getTime()
    : null

  return closedAt !== null && reopenedAt !== null && reopenedAt > closedAt
}

function availabilityWindowStatusSummary(
  cycle: Cycle | null,
  availabilityWindow?: AvailabilityWindowState
): {
  label: string
  detail: string
  tone: 'visible' | 'draft' | 'locked'
} | null {
  if (!cycle) return null
  if (cycle.published || cycle.status === 'final' || cycle.status === 'offline') {
    return {
      label: 'Schedule posted',
      detail: 'Schedule has been posted.',
      tone: 'locked',
    }
  }

  if (availabilityWindow?.locked) {
    return {
      label: 'Availability locked',
      detail:
        availabilityWindow.reason === 'schedule_building_started'
          ? 'Schedule building has started. Staff edits are locked.'
          : 'Availability collection is locked to staff.',
      tone: 'locked',
    }
  }

  if (wasAvailabilityReopened(cycle)) {
    return {
      label: 'Availability reopened',
      detail: 'Availability was reopened for late changes.',
      tone: 'visible',
    }
  }

  const dueDate = availabilityDueDateKey(cycle.availability_due_at)
  if (!dueDate) {
    return {
      label: 'Manager draft',
      detail: 'Hidden from therapists until planning dates are set.',
      tone: 'draft',
    }
  }

  return {
    label: 'Availability open',
    detail: `Availability collection is open to staff. Due ${formatDateLabel(dueDate)}.`,
    tone: 'visible',
  }
}

export function ManagerSchedulingInputs({
  cycles,
  therapists,
  overrides,
  availabilityEntries,
  initialCycleId,
  initialTherapistId,
  submittedRows,
  missingRows,
  initialRosterFilter = 'missing',
  saveManagerPlannerDatesAction,
  saveManagerAvailabilityRequestsAction,
  copyAvailabilityFromPreviousCycleAction,
  availabilityWindow,
  toolbarUtilities,
}: Props) {
  const plannerFocus = useAvailabilityPlannerFocus()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const latestQueryRef = useRef(searchParams.toString())

  const initialSelectedCycleId = initialCycleId || cycles[0]?.id || ''
  const initialSelectedTherapistId = initialTherapistId || therapists[0]?.id || ''
  const initialTherapist =
    therapists.find((therapist) => therapist.id === initialSelectedTherapistId) ??
    therapists[0] ??
    null

  const [selectedCycleId, setSelectedCycleId] = useState(initialSelectedCycleId)
  const [selectedTherapistId, setSelectedTherapistId] = useState(initialSelectedTherapistId)
  const [activeRosterFilter, setActiveRosterFilter] =
    useState<AvailabilityRosterFilter>(initialRosterFilter)
  const [activeShift, setActiveShift] = useState<TherapistOption['shift_type']>(
    initialTherapist?.shift_type ?? 'day'
  )
  const [therapistSearch, setTherapistSearch] = useState('')
  const [mode, setMode] = useState<AvailabilityEditorMode>('need_off')
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    return uniqueSortedDates(
      availabilityEntries
        .filter(
          (row) =>
            row.cycleId === initialSelectedCycleId &&
            row.therapistId === initialSelectedTherapistId &&
            isTherapistAvailabilityIntent(row) &&
            row.entryType === 'force_off'
        )
        .map((row) => row.date)
    )
  })

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  )
  const selectedCycleVisibility = availabilityWindowStatusSummary(selectedCycle, availabilityWindow)
  const selectedTherapist = useMemo(
    () => therapists.find((therapist) => therapist.id === selectedTherapistId) ?? null,
    [selectedTherapistId, therapists]
  )

  const shiftOptions = useMemo(
    () => Array.from(new Set(therapists.map((therapist) => therapist.shift_type))),
    [therapists]
  )

  const queueRows = useMemo<QueueRow[]>(() => {
    const therapistById = new Map(
      therapists.map((therapist) => [
        therapist.id,
        {
          shiftType: therapist.shift_type,
          employmentType: therapist.employment_type,
        },
      ])
    )

    return [...missingRows, ...submittedRows]
      .map((row) => {
        const meta = therapistById.get(row.therapistId)
        return {
          ...row,
          submitted: submittedRows.some(
            (submittedRow) => submittedRow.therapistId === row.therapistId
          ),
          shiftType: meta?.shiftType ?? 'day',
          employmentType: meta?.employmentType ?? 'full_time',
        }
      })
      .sort((a, b) => {
        if (a.submitted !== b.submitted) return a.submitted ? 1 : -1
        if (a.overridesCount !== b.overridesCount) return b.overridesCount - a.overridesCount
        return a.therapistName.localeCompare(b.therapistName)
      })
  }, [missingRows, submittedRows, therapists])

  const filteredQueueRows = useMemo(() => {
    const search = therapistSearch.trim().toLowerCase()
    return queueRows.filter((row) => {
      if (row.shiftType !== activeShift) return false
      if (!search) return true
      const haystack = `${row.therapistName} ${row.employmentType}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [activeShift, queueRows, therapistSearch])

  const savedOverrides = useMemo(
    () =>
      overrides
        .filter(
          (row) => row.cycle_id === selectedCycleId && row.therapist_id === selectedTherapistId
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [overrides, selectedCycleId, selectedTherapistId]
  )

  const savedBuckets = useMemo(
    () =>
      splitPlannerDatesByMode(
        savedOverrides.filter((row) => isManagerPlanIntent(row.intent)),
        { source: 'manager' }
      ),
    [savedOverrides]
  )

  const therapistRequestRows = useMemo(
    () =>
      availabilityEntries
        .filter(
          (row) =>
            row.cycleId === selectedCycleId &&
            row.therapistId === selectedTherapistId &&
            isTherapistAvailabilityIntent(row)
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [availabilityEntries, selectedCycleId, selectedTherapistId]
  )

  const rosterRow = queueRows.find((row) => row.therapistId === selectedTherapistId) ?? null

  const submissionStatus = rosterRow
    ? {
        submitted: rosterRow.submitted,
        overridesCount: rosterRow.overridesCount,
        managerEnteredCount: rosterRow.managerEnteredCount ?? 0,
        lastUpdatedAt: rosterRow.lastUpdatedAt,
      }
    : null

  function getDatesForMode(nextMode: AvailabilityEditorMode, cycleId: string, therapistId: string) {
    if (nextMode === 'will_work' || nextMode === 'cannot_work') {
      const nextBuckets = getSavedBucketsForSelection(overrides, cycleId, therapistId)
      return nextMode === 'will_work' ? nextBuckets.willWork : nextBuckets.cannotWork
    }

    const entryType = REQUEST_MODE_TO_ENTRY_TYPE[nextMode]
    return uniqueSortedDates(
      availabilityEntries
        .filter(
          (row) =>
            row.cycleId === cycleId &&
            row.therapistId === therapistId &&
            isTherapistAvailabilityIntent(row) &&
            row.entryType === entryType
        )
        .map((row) => row.date)
    )
  }

  function syncSelection(nextMode: AvailabilityEditorMode, cycleId: string, therapistId: string) {
    setSelectedDates(getDatesForMode(nextMode, cycleId, therapistId))
  }

  function replacePlannerQuery(
    nextCycleId: string,
    nextTherapistId: string,
    mode: 'navigate' | 'shallow' = 'navigate'
  ) {
    const currentSearch =
      typeof window === 'undefined' ? latestQueryRef.current : window.location.search
    const params = new URLSearchParams(currentSearch)
    params.set('tab', 'planner')
    if (nextCycleId) {
      params.set('cycle', nextCycleId)
    } else {
      params.delete('cycle')
    }
    if (nextTherapistId) {
      params.set('therapist', nextTherapistId)
    } else {
      params.delete('therapist')
    }
    const query = params.toString()
    latestQueryRef.current = query
    const nextUrl = query ? `${pathname}?${query}` : pathname
    if (mode === 'shallow' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', nextUrl)
      return
    }
    router.replace(nextUrl, { scroll: false })
  }

  function applyTherapistSelection(nextTherapistId: string) {
    const nextTherapist = therapists.find((therapist) => therapist.id === nextTherapistId) ?? null
    if (!nextTherapist) return

    setSelectedTherapistId(nextTherapistId)
    setActiveShift(nextTherapist.shift_type)
    plannerFocus?.setFocusedTherapistName(nextTherapist.full_name)
    syncSelection(mode, selectedCycleId, nextTherapistId)
    replacePlannerQuery(selectedCycleId, nextTherapistId, 'shallow')
  }

  function reviewTherapist(nextTherapistId: string) {
    applyTherapistSelection(nextTherapistId)
  }

  function clearSelectedTherapist() {
    setSelectedTherapistId('')
    plannerFocus?.setFocusedTherapistName(null)
    replacePlannerQuery(selectedCycleId, '', 'shallow')
  }

  function handleCycleChange(nextCycleId: string) {
    setSelectedCycleId(nextCycleId)
    syncSelection(mode, nextCycleId, selectedTherapistId)
    replacePlannerQuery(nextCycleId, selectedTherapistId)
  }

  function handleShiftChange(nextShift: TherapistOption['shift_type']) {
    setActiveShift(nextShift)
    if (selectedTherapist?.shift_type === nextShift) return
    const nextTherapist = therapists.find((therapist) => therapist.shift_type === nextShift) ?? null
    if (nextTherapist) {
      applyTherapistSelection(nextTherapist.id)
    }
  }

  function handleModeChange(nextMode: AvailabilityEditorMode) {
    setMode(nextMode)
    syncSelection(nextMode, selectedCycleId, selectedTherapistId)
  }

  function toggleDate(date: string) {
    if (!selectedCycle || !isDateWithinCycle(date, selectedCycle)) return
    setSelectedDates((current) =>
      current.includes(date)
        ? current.filter((value) => value !== date)
        : uniqueSortedDates([...current, date])
    )
  }

  const dayStates = useMemo(() => {
    const next: Record<
      string,
      {
        draftSelection?: AvailabilityEditorMode
        savedPlanner?: PlannerMode
        requestTypes?: Array<'need_off' | 'request_to_work'>
      }
    > = {}

    for (const date of savedBuckets.willWork) {
      next[date] = { ...(next[date] ?? {}), savedPlanner: 'will_work' }
    }
    for (const date of savedBuckets.cannotWork) {
      next[date] = { ...(next[date] ?? {}), savedPlanner: 'cannot_work' }
    }
    for (const row of therapistRequestRows) {
      const requestType = row.entryType === 'force_off' ? 'need_off' : 'request_to_work'
      const currentRequestTypes = next[row.date]?.requestTypes ?? []
      next[row.date] = {
        ...(next[row.date] ?? {}),
        requestTypes: currentRequestTypes.includes(requestType)
          ? currentRequestTypes
          : [...currentRequestTypes, requestType],
      }
    }
    for (const date of selectedDates) {
      next[date] = { ...(next[date] ?? {}), draftSelection: mode }
    }

    return next
  }, [mode, savedBuckets.cannotWork, savedBuckets.willWork, selectedDates, therapistRequestRows])

  const baselineDates = getDatesForMode(mode, selectedCycleId, selectedTherapistId)
  const hasUnsavedChanges =
    baselineDates.length !== selectedDates.length ||
    baselineDates.some((date, index) => date !== selectedDates[index])
  const selectedTherapistName = selectedTherapist?.full_name ?? 'No therapist selected'
  const missingSubmissionLabel = `${missingRows.length} therapist${missingRows.length === 1 ? '' : 's'} missing`
  const submittedSubmissionLabel = `${submittedRows.length} submitted`

  if (cycles.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-border/70 bg-card px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground">Availability Manager</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No Schedule Block is ready for availability. Create or plan a Schedule Block before
          requesting or reviewing therapist availability.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/schedule/planning"
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground no-underline hover:bg-primary/90 hover:no-underline"
          >
            Plan Schedule Block
          </Link>
          <Link
            href="/schedule"
            className="inline-flex min-h-10 items-center rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground no-underline hover:bg-muted hover:no-underline"
          >
            Open Team Schedule
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Manager action required: planning dates must exist before availability can be collected.
        </p>
      </section>
    )
  }

  if (therapists.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-border/70 bg-card px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground">Availability Manager</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No active therapists are available to review right now. Check Team roster settings before
          sending reminders or editing availability.
        </p>
      </section>
    )
  }

  return (
    <section id="staff-scheduling-inputs" className="space-y-4">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="whitespace-nowrap text-[2rem] font-semibold tracking-[-0.03em] text-foreground">
            Availability Manager
          </h1>
          {selectedCycleVisibility ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 font-semibold',
                  selectedCycleVisibility.tone === 'visible'
                    ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                    : selectedCycleVisibility.tone === 'draft'
                      ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                      : 'border-border bg-muted text-muted-foreground'
                )}
              >
                {selectedCycleVisibility.label}
              </span>
              <span className="font-medium text-muted-foreground">
                {selectedCycleVisibility.detail}
              </span>
              {selectedCycleVisibility.tone === 'draft' && selectedCycle ? (
                <Link
                  href={`/schedule/planning?cycle=${selectedCycle.id}`}
                  className="font-semibold text-primary hover:underline"
                >
                  Plan dates
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 xl:flex-nowrap">
          <label className="space-y-1.5">
            <span className="sr-only">Schedule Block</span>
            <select
              id="planner_cycle_id"
              className="min-h-11 min-w-[16rem] rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={selectedCycleId}
              onChange={(event) => handleCycleChange(event.target.value)}
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {formatHumanCycleRange(cycle.start_date, cycle.end_date)}
                </option>
              ))}
            </select>
          </label>

          {shiftOptions.length > 1 ? (
            <div className="space-y-1.5">
              <span className="sr-only">Shift</span>
              <div className="inline-flex min-h-11 rounded-full border border-border/70 bg-muted/[0.08] p-1">
                {shiftOptions.map((shiftType) => (
                  <button
                    key={shiftType}
                    type="button"
                    className={cn(
                      'rounded-full px-3 py-2 text-sm font-semibold transition-colors',
                      activeShift === shiftType
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => handleShiftChange(shiftType)}
                  >
                    {shiftType === 'night' ? 'Night shift' : 'Day shift'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="space-y-1.5">
            <span className="sr-only">Therapist search</span>
            <input
              type="search"
              value={therapistSearch}
              onChange={(event) => setTherapistSearch(event.target.value)}
              placeholder="Search therapists..."
              className="min-h-11 min-w-[15rem] rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </label>

          <div className="flex items-end">{toolbarUtilities}</div>
        </div>
      </div>

      <section
        aria-label="Availability manager checklist"
        className="rounded-[1.25rem] border border-border/70 bg-card px-4 py-4 shadow-tw-sm"
      >
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Availability checklist</h2>
            <p className="text-sm text-muted-foreground">
              Work left to right: collect responses, review requests, then edit only what needs a
              manager decision.
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {missingSubmissionLabel} | {submittedSubmissionLabel}
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-md border border-border/70 bg-background px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              1. Collect
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Follow up on missing submissions.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Use reminders for the full Schedule Block, even when the queue is filtered.
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              2. Review
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Open each therapist with requests.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Check submitted availability before adding manager-entered changes.
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              3. Edit
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{selectedTherapistName}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Save manager edits only after the selected dates look right.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(28rem,0.8fr)_minmax(48rem,1.4fr)]">
        <div id="availability-work-queue" className="min-h-0">
          <AvailabilityStatusSummary
            submittedRows={filteredQueueRows.filter((row) => row.submitted)}
            missingRows={filteredQueueRows.filter((row) => !row.submitted)}
            initialFilter={initialRosterFilter}
            activeFilter={activeRosterFilter}
            selectedTherapistId={selectedTherapistId}
            onPickTherapist={applyTherapistSelection}
            onReviewTherapist={reviewTherapist}
            onFilterChange={setActiveRosterFilter}
            embedded
            activeShift={activeShift}
            searchTerm={therapistSearch}
            cycleId={selectedCycleId}
            reminderMissingCount={missingRows.length}
            onSendReminders={
              selectedCycleId ? () => sendAvailabilityRemindersAction(selectedCycleId) : undefined
            }
          />
        </div>
        <div className="min-h-0 rounded-[1.25rem] border border-border/70 bg-card px-4 py-4 shadow-tw-sm">
          <TherapistContextPanel
            therapist={selectedTherapist}
            cycleLabel={
              selectedCycle
                ? formatHumanCycleRange(selectedCycle.start_date, selectedCycle.end_date)
                : 'No Schedule Block selected'
            }
            requestRows={therapistRequestRows}
            submissionStatus={submissionStatus}
            savedPlannerCount={savedOverrides.length}
            onClose={clearSelectedTherapist}
            mode={mode}
            selectedDates={selectedDates}
            dayStates={dayStates}
            hasUnsavedChanges={hasUnsavedChanges}
            cycleStart={selectedCycle?.start_date ?? ''}
            cycleEnd={selectedCycle?.end_date ?? ''}
            selectedCycleId={selectedCycleId}
            selectedTherapistId={selectedTherapistId}
            onModeChange={handleModeChange}
            onToggleDate={toggleDate}
            onClearSelectedDates={() => setSelectedDates([])}
            onRemoveSelectedDate={(date) =>
              setSelectedDates((current) => current.filter((value) => value !== date))
            }
            saveManagerPlannerDatesAction={saveManagerPlannerDatesAction}
            saveManagerAvailabilityRequestsAction={saveManagerAvailabilityRequestsAction}
            copyAvailabilityFromPreviousCycleAction={copyAvailabilityFromPreviousCycleAction}
          />
        </div>
      </div>
    </section>
  )
}
