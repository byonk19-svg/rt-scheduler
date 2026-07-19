import Link from 'next/link'
import { ArrowRightLeft, CalendarDays, Crown, Printer, Users } from 'lucide-react'

import type { StaffScheduleBlockView } from '@/lib/staff-my-schedule'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type StaffScheduleBlockPanelProps = {
  schedule: StaffScheduleBlockView | null
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDayNumber(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date.slice(-2)
  return String(parsed.getDate())
}

function formatFullDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function statusLabel(value: string | null): string | null {
  switch (value) {
    case 'on_call':
      return 'On Call'
    case 'cancelled':
      return 'Cancelled'
    case 'call_in':
      return 'Call In'
    case 'left_early':
      return 'Left Early'
    default:
      return null
  }
}

function shiftLabel(value: 'day' | 'night'): string {
  return value === 'day' ? 'Day' : 'Night'
}

function coworkerLine(names: string[], count: number): string | null {
  if (count === 0) return null
  if (names.length === 0) return `With ${count} coworker${count === 1 ? '' : 's'}`
  const suffix = count > names.length ? ` +${count - names.length}` : ''
  return `With ${names.join(', ')}${suffix}`
}

function requestHref(shiftId: string, type: 'pickup' | 'swap'): string {
  return `/therapist/swaps?new=1&shiftId=${encodeURIComponent(shiftId)}&type=${type}`
}

export function StaffScheduleBlockPanel({ schedule }: StaffScheduleBlockPanelProps) {
  if (!schedule) {
    return (
      <section className="rounded-2xl border border-border bg-card px-5 py-6 shadow-tw-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          My Shifts
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          No schedule block is visible yet
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          When a manager sends a preliminary schedule or publishes the final schedule, your full
          six-week view will appear here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/schedule">Open Team Schedule</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/availability">Check Availability</Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card px-4 py-5 shadow-tw-float-lg sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            My Shifts
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Your six-week schedule
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {schedule.title} - {schedule.dateRangeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-semibold',
              schedule.lifecycleLabel.startsWith('Preliminary')
                ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                : schedule.lifecycleLabel.startsWith('Final')
                  ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
                  : 'border-border bg-muted text-muted-foreground'
            )}
          >
            {schedule.lifecycleLabel}
          </span>
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {schedule.assignedCount} assigned day{schedule.assignedCount === 1 ? '' : 's'}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href={`/schedule?cycle=${schedule.cycleId}`}>View Team Schedule</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link className="gap-1.5" href={`/schedule?cycle=${schedule.cycleId}`}>
              <Printer className="h-4 w-4" />
              Print from Team Schedule
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="min-w-[52rem]" role="table" aria-label="Six-week schedule">
          <div
            className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            role="row"
          >
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1" role="columnheader">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1" role="rowgroup">
            {schedule.days.map((day) => {
              const assignment = day.assignment
              const label = statusLabel(assignment?.assignmentStatus ?? null)
              const coworkers = assignment
                ? coworkerLine(assignment.coworkerNames, assignment.coworkerCount)
                : null

              return (
                <div
                  key={day.date}
                  role="cell"
                  aria-label={`${formatFullDate(day.date)}: ${
                    assignment
                      ? `${shiftLabel(assignment.shiftType)} shift${
                          label ? `, ${label}` : ''
                        }${assignment.leadName ? `, lead ${assignment.leadName}` : ''}${
                          coworkers ? `, ${coworkers}` : ''
                        }`
                      : 'not scheduled'
                  }`}
                  className={cn(
                    'min-h-[6.5rem] rounded-lg border p-2 text-left transition-colors',
                    day.isWeekend ? 'bg-muted/45' : 'bg-background',
                    assignment
                      ? 'border-primary/35 shadow-tw-sm ring-1 ring-primary/15'
                      : 'border-border/70',
                    day.isToday && 'outline outline-2 outline-offset-1 outline-[var(--ring)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {formatFullDate(day.date)}
                      </p>
                      <p className="mt-1 text-lg font-bold leading-none text-foreground">
                        {formatDayNumber(day.date)}
                      </p>
                    </div>
                    {day.isWeekend ? (
                      <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Wknd
                      </span>
                    ) : null}
                  </div>

                  {assignment ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          {shiftLabel(assignment.shiftType)}
                        </span>
                        {assignment.isLead ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning-text)]">
                            <Crown className="h-3 w-3" />
                            Lead
                          </span>
                        ) : null}
                        {label ? (
                          <span className="rounded-full border border-[var(--info-border)] bg-[var(--info-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--info-text)]">
                            {label}
                          </span>
                        ) : null}
                      </div>
                      {assignment.leadName ? (
                        <p className="text-xs font-medium text-foreground">
                          Lead: {assignment.leadName}
                        </p>
                      ) : null}
                      {coworkers ? (
                        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                          <Users className="mr-1 inline h-3 w-3 align-[-2px]" />
                          {coworkers}
                        </p>
                      ) : null}
                      {assignment.canRequestChange ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-[11px]"
                          >
                            <Link href={requestHref(assignment.id, 'pickup')}>
                              Need coverage
                              <span className="sr-only">
                                {' '}
                                for {formatFullDate(day.date)} {shiftLabel(assignment.shiftType)}{' '}
                                shift
                              </span>
                            </Link>
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-[11px]"
                          >
                            <Link className="gap-1" href={requestHref(assignment.id, 'swap')}>
                              <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                              Trade shift
                              <span className="sr-only">
                                {' '}
                                for {formatFullDate(day.date)} {shiftLabel(assignment.shiftType)}{' '}
                                shift
                              </span>
                            </Link>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-5 text-xs text-muted-foreground">Not scheduled</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
