'use client'

import Link from 'next/link'
import { ArrowLeftRight, CheckCircle2, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'

export function StaffDashboardSummaryCards({
  availabilityDueLine,
  availabilitySubmitted,
  nextShiftLabel,
  nextShiftTypeLabel,
  pendingPostCount,
  submittedAtDisplay,
  lastEditedDisplay,
}: {
  availabilityDueLine: string | null
  availabilitySubmitted: boolean
  nextShiftLabel: string | null
  nextShiftTypeLabel: string | null
  pendingPostCount: number
  submittedAtDisplay: string | null
  lastEditedDisplay: string | null
}) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Next Shift</span>
          <Clock className="h-3.5 w-3.5" />
        </div>
        {nextShiftLabel ? (
          <>
            <p className="mt-1.5 text-lg font-semibold tracking-tight text-foreground">
              {nextShiftLabel}
            </p>
            {nextShiftTypeLabel ? (
              <p className="mt-0.5 text-sm font-medium capitalize text-foreground">
                {nextShiftTypeLabel}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              Your next shift in this published schedule
            </p>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-sm font-medium text-foreground">No shift scheduled yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <Link
                href="/staff/my-schedule"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                My shifts
              </Link>{' '}
              lists published assignments.
            </p>
          </>
        )}
      </div>
      <div
        className={cn(
          'rounded-xl border px-3 py-2.5',
          availabilitySubmitted
            ? 'border-border bg-muted/30'
            : 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/40'
        )}
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Availability for This Cycle</span>
          <CheckCircle2
            className={cn(
              'h-3.5 w-3.5',
              availabilitySubmitted ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'
            )}
          />
        </div>
        <p
          className={cn(
            'mt-1.5 text-lg font-semibold tracking-tight',
            availabilitySubmitted ? 'text-[var(--success-text)]' : 'text-[var(--warning-text)]'
          )}
        >
          {availabilitySubmitted ? 'Submitted' : 'Not submitted'}
        </p>
        {availabilitySubmitted && submittedAtDisplay ? (
          <p className="mt-1 text-xs text-muted-foreground">Submitted {submittedAtDisplay}</p>
        ) : null}
        {availabilitySubmitted && lastEditedDisplay ? (
          <p className="mt-1 text-xs text-muted-foreground">Last edited {lastEditedDisplay}</p>
        ) : null}
        {!availabilitySubmitted && availabilityDueLine ? (
          <p className="mt-2 text-xs font-medium leading-snug text-foreground/90">
            {availabilityDueLine}
          </p>
        ) : null}
        {!availabilitySubmitted ? (
          <Link
            href="/therapist/availability"
            className="mt-2.5 inline-block text-xs font-medium text-primary hover:underline"
          >
            Submit availability &rarr;
          </Link>
        ) : (
          <Link
            href="/therapist/availability"
            className="mt-2.5 inline-block text-xs font-medium text-primary hover:underline"
          >
            Edit availability &rarr;
          </Link>
        )}
      </div>
      <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Requests Awaiting Action</span>
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </div>
        <p className="mt-1.5 text-lg font-semibold tracking-tight text-foreground">
          {pendingPostCount}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Swap or pickup requests that need your response
        </p>
      </div>
    </section>
  )
}
