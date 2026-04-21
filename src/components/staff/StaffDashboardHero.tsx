'use client'

import Link from 'next/link'
import { Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UpcomingShiftRoster = {
  date: string
  label: string
  shiftType: string
  myRole: string
  colleagues: Array<{ name: string; isLead: boolean }>
}

export function StaffDashboardHero({
  activeCyclePublished,
  availabilitySubmitted,
  cycleRangeLabel,
  firstName,
  pendingPostCount,
  upcomingCount,
  upcomingRoster,
}: {
  activeCyclePublished: boolean
  availabilitySubmitted: boolean
  cycleRangeLabel: string | null
  firstName: string
  pendingPostCount: number
  upcomingCount: number
  upcomingRoster: UpcomingShiftRoster[]
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-tw-float-lg">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome, {firstName}
          </h1>
          {cycleRangeLabel ? (
            <>
              <p className="mt-2 text-sm font-medium text-foreground">Cycle: {cycleRangeLabel}</p>
              {activeCyclePublished ? (
                <p className="mt-0.5 text-xs text-muted-foreground">Published schedule is live.</p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No active scheduling cycle yet.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                'rounded-full border px-2 py-0.5',
                availabilitySubmitted
                  ? 'border-border/70 bg-muted/20'
                  : 'border-[var(--warning-border)] bg-[var(--warning-subtle)]/50 text-[var(--warning-text)]'
              )}
            >
              {availabilitySubmitted ? 'Availability: Submitted' : 'Availability: Not submitted'}
            </span>
            <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
              {upcomingCount} upcoming shifts
            </span>
            <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5">
              {pendingPostCount} requests awaiting action
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!availabilitySubmitted ? (
            <>
              <Button asChild size="sm">
                <Link href="/therapist/availability">
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Submit availability
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/shift-board">Browse open shifts</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="sm">
                <Link href="/shift-board">Browse open shifts</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/therapist/availability">Edit availability</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="px-4 py-3.5">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Upcoming Shifts
        </p>
        {upcomingRoster.length > 0 ? (
          <div className="divide-y divide-border">
            {upcomingRoster.map((shift) => (
              <div key={shift.date} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="w-[96px] shrink-0">
                  <p className="text-xs font-semibold text-foreground">{shift.label}</p>
                  <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                    {shift.shiftType} shift
                  </p>
                  {shift.myRole === 'lead' ? (
                    <span
                      className="mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        borderColor: 'var(--warning-border)',
                        backgroundColor: 'var(--warning-subtle)',
                        color: 'var(--warning-text)',
                      }}
                    >
                      Lead
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {shift.colleagues.length > 0 ? (
                    shift.colleagues.map((colleague, index) => (
                      <span
                        key={index}
                        className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        style={
                          colleague.isLead
                            ? {
                                borderColor: 'var(--warning-border)',
                                backgroundColor: 'var(--warning-subtle)',
                                color: 'var(--warning-text)',
                              }
                            : {
                                borderColor: 'var(--border)',
                                backgroundColor: 'var(--muted)',
                                color: 'var(--muted-foreground)',
                              }
                        }
                      >
                        {colleague.isLead ? 'Lead: ' : ''}
                        {colleague.name.split(' ')[0]}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No colleagues assigned yet.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">
              No draft assignments on this cycle yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The schedule is still being filled. Use the buttons above for your next step, or see
              published shifts on{' '}
              <Link
                href="/staff/my-schedule"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                My shifts
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
