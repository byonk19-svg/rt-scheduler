'use client'

import { useMemo, useState } from 'react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  employment_type: 'full_time' | 'part_time' | 'prn'
}

type PlannerOverrideRecord = {
  id: string
  date: string
  override_type: 'force_off' | 'force_on'
}

type AvailabilityEntryRow = {
  id: string
  date: string
  entryType: 'force_off' | 'force_on'
  reason: string | null
  createdAt: string
  updatedAt?: string
}

type SubmissionStatus = {
  submitted: boolean
  overridesCount: number
  lastUpdatedAt: string | null
}

type TherapistContextPanelProps = {
  therapist: TherapistOption | null
  cycleLabel: string
  requestRows: AvailabilityEntryRow[]
  savedPlannerRows: PlannerOverrideRecord[]
  submissionStatus: SubmissionStatus | null
  deleteManagerPlannerDateAction: (formData: FormData) => void | Promise<void>
  selectedCycleId: string
  selectedTherapistId: string
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

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shiftLabel(shiftType: TherapistOption['shift_type']) {
  return shiftType === 'night' ? 'Night shift' : 'Day shift'
}

function employmentLabel(employmentType: TherapistOption['employment_type']) {
  if (employmentType === 'part_time') return 'Part-time'
  if (employmentType === 'prn') return 'PRN'
  return 'Full-time'
}

export function TherapistContextPanel({
  therapist,
  cycleLabel,
  requestRows,
  savedPlannerRows,
  submissionStatus,
  deleteManagerPlannerDateAction,
  selectedCycleId,
  selectedTherapistId,
}: TherapistContextPanelProps) {
  const [tab, setTab] = useState<'context' | 'saved'>('context')

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
  const recentRequests = useMemo(
    () =>
      requestRows
        .slice()
        .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
        .slice(0, 4),
    [requestRows]
  )

  return (
    <section className="flex h-full flex-col" aria-labelledby="therapist-context-heading">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Therapist context
            </p>
            <h2 id="therapist-context-heading" className="text-base font-semibold text-foreground">
              {therapist?.full_name ?? 'Select a therapist'}
            </h2>
            <p className="text-sm text-muted-foreground">{cycleLabel}</p>
          </div>
          {therapist ? (
            <Badge
              variant="outline"
              className={cn(
                'font-medium',
                submissionStatus?.submitted
                  ? 'border-[var(--success-border)] text-[var(--success-text)]'
                  : 'border-[var(--warning-border)] text-[var(--warning-text)]'
              )}
            >
              {submissionStatus?.submitted ? 'Submitted' : 'Not submitted'}
            </Badge>
          ) : null}
        </div>

        {therapist ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{shiftLabel(therapist.shift_type)}</Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {employmentLabel(therapist.employment_type)}
            </Badge>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-border/70 px-4 py-2.5">
        <div className="rounded-[1rem] border border-border/60 bg-muted/15 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Request summary
          </p>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Need off</span>
              <span className="font-semibold text-foreground">{needOffCount}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Request to work</span>
              <span className="font-semibold text-foreground">{requestToWorkCount}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Saved plan</span>
              <span className="font-semibold text-foreground">{savedPlannerRows.length}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1rem] border border-border/60 bg-muted/15 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Latest activity
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {formatDateTime(latestActivity)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {submissionStatus?.submitted
              ? `${submissionStatus.overridesCount} submitted request${submissionStatus.overridesCount === 1 ? '' : 's'} in this cycle`
              : 'No official submission recorded for this cycle'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border/70 px-4 py-2">
        <button
          type="button"
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            tab === 'context'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          onClick={() => setTab('context')}
        >
          Recent requests
        </button>
        <button
          type="button"
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            tab === 'saved'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          onClick={() => setTab('saved')}
        >
          Saved planner dates
        </button>
      </div>

      <div className="max-h-[280px] overflow-y-auto px-4 py-2.5">
        {tab === 'context' ? (
          recentRequests.length > 0 ? (
            <div className="space-y-1.5">
              {recentRequests.map((row) => (
                <div
                  key={row.id}
                  className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {formatDateLabel(row.date)}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        row.entryType === 'force_off'
                          ? 'border-[var(--warning-border)] text-[var(--warning-text)]'
                          : 'border-[var(--info-border)] text-[var(--info-text)]'
                      )}
                    >
                      {row.entryType === 'force_off' ? 'Need off' : 'Request to work'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.reason?.trim() || 'No note attached'}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Updated {formatDateTime(row.updatedAt ?? row.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No therapist requests are saved for this cycle yet.
            </p>
          )
        ) : savedPlannerRows.length > 0 ? (
          <div className="space-y-1.5">
            {savedPlannerRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/60 bg-background/80 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDateLabel(row.date)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.override_type === 'force_on' ? 'Will work' : 'Cannot work'}
                  </p>
                </div>
                <form action={deleteManagerPlannerDateAction}>
                  <input type="hidden" name="override_id" value={row.id} />
                  <input type="hidden" name="cycle_id" value={selectedCycleId} />
                  <input type="hidden" name="therapist_id" value={selectedTherapistId} />
                  <FormSubmitButton
                    type="submit"
                    variant="ghost"
                    size="sm"
                    pendingText="Removing..."
                    className="text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    Remove
                  </FormSubmitButton>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved planner dates for this therapist and cycle.
          </p>
        )}
      </div>
    </section>
  )
}
