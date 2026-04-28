import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays } from 'lucide-react'

import { MyScheduleCard } from '@/components/schedule/MyScheduleCard'
import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import {
  fetchMyPublishedUpcomingShifts,
  weekBucketFromIsoDate,
  type MyScheduleShiftRow,
} from '@/lib/staff-my-schedule'
import { createClient } from '@/lib/supabase/server'

function formatShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function weekRangeLabel(shifts: MyScheduleShiftRow[]): string {
  const dates = shifts.map((shift) => shift.date).sort()
  if (dates.length === 0) return ''
  const first = dates[0]!
  const last = dates[dates.length - 1]!
  if (first === last) return formatShortDate(first)
  return `${formatShortDate(first)} - ${formatShortDate(last)}`
}

export async function PublishedSchedulePage({
  title = 'My Shifts',
  backHref = '/dashboard/staff',
}: {
  title?: string
  backHref?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, max_work_days_per_week')
    .eq('id', user.id)
    .maybeSingle()

  if (can(parseRole(profile?.role), 'access_manager_ui')) {
    redirect('/dashboard/manager')
  }

  const weeklyCap = profile?.max_work_days_per_week ?? 5
  const safeCap = Math.max(1, weeklyCap)
  const shifts = await fetchMyPublishedUpcomingShifts(supabase, user.id, 30)

  const byWeek = new Map<number, MyScheduleShiftRow[]>()
  for (const row of shifts) {
    const weekBucket = weekBucketFromIsoDate(row.date)
    const rows = byWeek.get(weekBucket) ?? []
    rows.push(row)
    byWeek.set(weekBucket, rows)
  }

  const weekKeys = Array.from(byWeek.keys()).sort((left, right) => left - right)

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="rounded-2xl border border-border/70 bg-card px-6 pb-4 pt-5 shadow-tw-float">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Upcoming shifts from published schedules only ({shifts.length} shown, next 30 max).
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href={backHref}>Back to dashboard</Link>
          </Button>
        </div>
      </div>

      {weekKeys.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground" />
          <p className="text-base font-semibold text-foreground">No published shifts yet</p>
          <Button asChild variant="default">
            <Link href="/therapist/swaps">Browse open pickups</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {weekKeys.map((weekKey) => {
            const weekShifts = byWeek.get(weekKey) ?? []
            weekShifts.sort((left, right) => left.date.localeCompare(right.date))
            const shiftCount = weekShifts.length
            const progressPercent = Math.min(100, Math.round((shiftCount / safeCap) * 100))

            return (
              <section key={weekKey} className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                      Week - {weekRangeLabel(weekShifts)}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {shiftCount} shift{shiftCount === 1 ? '' : 's'} this week - cap {safeCap} days
                      / week
                    </p>
                  </div>
                  <div className="w-full max-w-md sm:w-56">
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-muted ring-1 ring-border/50"
                      role="progressbar"
                      aria-valuenow={progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Shifts this week versus weekly cap"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {weekShifts.map((row) => (
                    <MyScheduleCard
                      key={row.id}
                      date={row.date}
                      shiftType={row.shift_type === 'night' ? 'night' : 'day'}
                      role={row.role ?? 'staff'}
                      status={row.status}
                      assignmentStatus={row.assignment_status}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
