'use client'

import { useMemo, useState } from 'react'

import { CalendarDays, ChevronDown, Info, MoreHorizontal } from 'lucide-react'

import { ManagerAvailabilityEditorPanel } from '@/components/availability/manager-availability-editor-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatEmployeeDate } from '@/lib/employee-directory'
import { cn } from '@/lib/utils'

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
}

type AvailabilityEntryRow = {
  id: string
  date: string
  entryType: 'force_off' | 'force_on'
  reason: string | null
  createdById?: string
  createdAt: string
  updatedAt?: string
}

type SubmissionStatus = {
  submitted: boolean
  overridesCount: number
  lastUpdatedAt: string | null
}

type AvailabilityEditorMode = 'will_work' | 'cannot_work' | 'need_off' | 'request_to_work'

type DayState = {
  draftSelection?: AvailabilityEditorMode
  savedPlanner?: 'will_work' | 'cannot_work'
  requestTypes?: Array<'need_off' | 'request_to_work'>
}

type TherapistContextPanelProps = {
  therapist: TherapistOption | null
  cycleLabel: string
  requestRows: AvailabilityEntryRow[]
  submissionStatus: SubmissionStatus | null
  savedPlannerCount: number
  onClose: () => void
  mode: AvailabilityEditorMode
  selectedDates: string[]
  dayStates: Record<string, DayState>
  hasUnsavedChanges: boolean
  cycleStart: string
  cycleEnd: string
  selectedCycleId: string
  selectedTherapistId: string
  onModeChange: (mode: AvailabilityEditorMode) => void
  onToggleDate: (date: string) => void
  onClearSelectedDates: () => void
  onRemoveSelectedDate: (date: string) => void
  saveManagerPlannerDatesAction: (formData: FormData) => void | Promise<void>
  saveManagerAvailabilityRequestsAction: (formData: FormData) => void | Promise<void>
  copyAvailabilityFromPreviousCycleAction: (formData: FormData) => void | Promise<void>
}

function formatDateTime(value: string | null) {
  if (!value) return 'No recent activity'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function shiftLabel(shiftType: TherapistOption['shift_type']) {
  return shiftType === 'night' ? 'Night shift' : 'Day shift'
}

function employmentLabel(employmentType: TherapistOption['employment_type']) {
  if (employmentType === 'part_time') return 'Part-time'
  if (employmentType === 'prn') return 'PRN'
  return 'Full-time'
}

function initialsForName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function TherapistContextPanel({
  therapist,
  cycleLabel,
  requestRows,
  submissionStatus,
  savedPlannerCount,
  onClose,
  mode,
  selectedDates,
  dayStates,
  hasUnsavedChanges,
  cycleStart,
  cycleEnd,
  selectedCycleId,
  selectedTherapistId,
  onModeChange,
  onToggleDate,
  onClearSelectedDates,
  onRemoveSelectedDate,
  saveManagerPlannerDatesAction,
  saveManagerAvailabilityRequestsAction,
  copyAvailabilityFromPreviousCycleAction,
}: TherapistContextPanelProps) {
  const [expandedRequests, setExpandedRequests] = useState(false)

  const needOffCount = useMemo(
    () => requestRows.filter((row) => row.entryType === 'force_off').length,
    [requestRows]
  )
  const requestToWorkCount = useMemo(
    () => requestRows.filter((row) => row.entryType === 'force_on').length,
    [requestRows]
  )
  const latestActivity = useMemo(() => {
    const timestamps = [
      ...requestRows.map((row) => row.updatedAt ?? row.createdAt),
      submissionStatus?.lastUpdatedAt ?? '',
    ].filter(Boolean)
    return timestamps.sort((a, b) => b.localeCompare(a))[0] ?? null
  }, [requestRows, submissionStatus?.lastUpdatedAt])

  const visibleRequests = expandedRequests ? requestRows : requestRows.slice(0, 3)

  if (!therapist) {
    return (
      <section className="flex h-full items-center justify-center rounded-[1.5rem] border border-border/70 bg-card px-6 py-10 shadow-tw-sm">
        <div className="max-w-sm text-center">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
            Select a therapist
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Review a response and edit availability inline from the work queue.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted/45 text-[1.35rem] font-semibold tracking-[-0.03em] text-foreground">
            {initialsForName(therapist.full_name)}
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-[1.65rem] font-semibold tracking-[-0.03em] text-foreground">
              {therapist.full_name}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  submissionStatus?.submitted
                    ? 'border-[var(--success-border)] text-[var(--success-text)]'
                    : 'border-[var(--warning-border)] text-[var(--warning-text)]'
                )}
              >
                {submissionStatus?.submitted ? 'Submitted' : 'Not submitted'}
              </Badge>
              <Badge variant="outline">{shiftLabel(therapist.shift_type)}</Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {employmentLabel(therapist.employment_type)}
              </Badge>
            </div>
            <p className="text-[0.88rem] text-muted-foreground">{cycleLabel}</p>
            {!submissionStatus?.submitted ? (
              <p className="text-sm text-muted-foreground">
                No official submission yet. Review requests here or enter dates on their behalf.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-[10.5rem] flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl text-[0.95rem]"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1rem] border border-border/60 bg-background/80 px-4 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Need Off</p>
          <p className="mt-3 text-[1.35rem] font-semibold tracking-[-0.02em] text-[var(--warning-text)]">
            {needOffCount}
          </p>
        </div>

        <div className="rounded-[1rem] border border-border/60 bg-background/80 px-4 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Need to Work</p>
          <p className="mt-3 text-[1.35rem] font-semibold tracking-[-0.02em] text-[color:#7c3aed]">
            {requestToWorkCount}
          </p>
        </div>

        <div className="rounded-[1rem] border border-border/60 bg-background/80 px-4 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Manager plan dates</p>
          <p className="mt-3 text-[1.35rem] font-semibold tracking-[-0.02em] text-[var(--success-text)]">
            {savedPlannerCount}
          </p>
        </div>

        <div className="rounded-[1rem] border border-border/60 bg-background/80 px-4 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Latest activity</p>
          <p className="mt-3 text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
            {formatDateTime(latestActivity)}
          </p>
        </div>
      </div>

      <section className="rounded-[1.1rem] border border-border/60 bg-background/85 px-5 py-4">
        <h3 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-foreground">
          Requests on file
        </h3>
        {visibleRequests.length > 0 ? (
          <div className="mt-4 space-y-2">
            {visibleRequests.map((row) => {
              const isManagerEdited = row.createdById && row.createdById !== therapist.id
              return (
                <div
                  key={row.id}
                  className="rounded-[0.95rem] border border-border/60 bg-muted/10 px-4 py-3"
                >
                  <div className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)_7rem_1.5rem] md:items-center">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span>{formatEmployeeDate(row.date)}</span>
                    </div>
                    <div className="min-w-0">
                      {row.reason?.trim() ? (
                        <p className="truncate text-sm text-foreground">{row.reason.trim()}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No note attached</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-1.5 md:justify-end">
                      <Badge
                        variant="outline"
                        className={cn(
                          row.entryType === 'force_off'
                            ? 'border-[var(--warning-border)] text-[var(--warning-text)]'
                            : 'border-[var(--info-border)] text-[var(--info-text)]'
                        )}
                      >
                        {row.entryType === 'force_off' ? 'Need Off' : 'Need to Work'}
                      </Badge>
                      {isManagerEdited ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          Manager edited
                        </Badge>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Request actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground md:text-right">
                    {formatDateTime(row.updatedAt ?? row.createdAt)}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No therapist requests are on file for this Schedule Block.
          </p>
        )}

        {requestRows.length > 3 ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              onClick={() => setExpandedRequests((value) => !value)}
            >
              {expandedRequests ? 'Show fewer requests' : `View all ${requestRows.length} requests`}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expandedRequests ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-[1.1rem] border border-[color:rgba(59,130,246,0.18)] bg-[color:rgba(239,246,255,0.7)] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:rgba(59,130,246,0.3)] bg-white text-[color:#2563eb]">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Manager note</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              The grid below keeps therapist requests, saved manager plan dates, and your draft
              changes visible in one place.
            </p>
          </div>
        </div>
      </section>

      <ManagerAvailabilityEditorPanel
        therapist={therapist}
        cycleLabel={cycleLabel}
        cycleStart={cycleStart}
        cycleEnd={cycleEnd}
        mode={mode}
        selectedDates={selectedDates}
        dayStates={dayStates}
        hasUnsavedChanges={hasUnsavedChanges}
        onModeChange={onModeChange}
        onToggleDate={onToggleDate}
        onClearSelectedDates={onClearSelectedDates}
        onRemoveSelectedDate={onRemoveSelectedDate}
        saveManagerPlannerDatesAction={saveManagerPlannerDatesAction}
        saveManagerAvailabilityRequestsAction={saveManagerAvailabilityRequestsAction}
        copyAvailabilityFromPreviousCycleAction={copyAvailabilityFromPreviousCycleAction}
        selectedCycleId={selectedCycleId}
        selectedTherapistId={selectedTherapistId}
      />
    </section>
  )
}
