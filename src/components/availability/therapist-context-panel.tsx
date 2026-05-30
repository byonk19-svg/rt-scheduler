'use client'

import { useMemo, useState } from 'react'

import { CalendarDays, ChevronDown } from 'lucide-react'

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
  managerEnteredCount?: number
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

function submissionLabel(status: SubmissionStatus | null) {
  if (!status?.submitted) return 'Not submitted'
  if ((status.managerEnteredCount ?? 0) > 0 && status.overridesCount > 0) {
    return 'Submitted + manager-entered'
  }
  if ((status.managerEnteredCount ?? 0) > 0) return 'Manager-entered'
  return status.overridesCount > 0 ? 'Submitted with requests' : 'Submitted no requests'
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
    <section className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/45 text-base font-semibold text-foreground">
            {initialsForName(therapist.full_name)}
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground">
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
                {submissionLabel(submissionStatus)}
              </Badge>
              <Badge variant="outline">{shiftLabel(therapist.shift_type)}</Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {employmentLabel(therapist.employment_type)}
              </Badge>
            </div>
            <p className="text-[0.88rem] text-muted-foreground">{cycleLabel}</p>
          </div>
        </div>

        <div className="flex min-w-[7rem] flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-9 rounded-md text-sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[0.8rem] border border-border/60 bg-background/80 px-3 py-2 text-sm">
        <div>
          <span className="text-xs font-medium text-muted-foreground">Need Off</span>
          <span className="ml-2 font-semibold text-[var(--warning-text)]">{needOffCount}</span>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">Need to Work</span>
          <span className="ml-2 font-semibold text-[var(--info-text)]">{requestToWorkCount}</span>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">Planning assumptions</span>
          <span className="ml-2 font-semibold text-[var(--success-text)]">{savedPlannerCount}</span>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">Last activity</span>
          <span className="ml-2 font-semibold text-foreground">
            {formatDateTime(latestActivity)}
          </span>
        </div>
      </div>

      {visibleRequests.length > 0 ? (
        <section className="rounded-[0.8rem] border border-border/60 bg-background/85 px-3 py-2.5">
          <h3 className="text-[0.95rem] font-semibold tracking-[-0.02em] text-foreground">
            Requests on file
          </h3>
          <div className="mt-3 space-y-1.5">
            {visibleRequests.map((row) => {
              const isManagerEdited = row.createdById && row.createdById !== therapist.id
              return (
                <div
                  key={row.id}
                  className="rounded-md border border-border/60 bg-muted/10 px-3 py-2"
                >
                  <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)_12rem] md:items-center">
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
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground md:text-right">
                    {formatDateTime(row.updatedAt ?? row.createdAt)}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-[0.75rem] border border-dashed border-border/60 bg-muted/[0.04] px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Requests on file:</span>{' '}
          <span>None for this Schedule Block.</span>
        </div>
      )}

      {visibleRequests.length > 0 && requestRows.length > 3 ? (
        <div className="flex justify-center">
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
