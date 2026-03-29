import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeftRight, CalendarDays, Clock3, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { formatDateLabel } from '@/lib/calendar-utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

type PublishedCycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
}

type TherapistScheduleProfileRow = {
  id: string
  full_name: string | null
}

type ShiftRow = {
  id: string
  user_id: string | null
  date: string
  shift_type: 'day' | 'night'
  status: string
  role: 'lead' | 'staff'
}

type DaySchedule = {
  date: string
  day: ShiftAssignment[]
  night: ShiftAssignment[]
}

type ShiftAssignment = {
  id: string
  userId: string | null
  name: string
  role: 'lead' | 'staff'
  shiftType: 'day' | 'night'
  isCurrentUser: boolean
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatCycleRange(startDate: string, endDate: string) {
  return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`
}

function buildDaySchedules(
  rows: ShiftRow[],
  currentUserId: string,
  nameByUserId: Map<string, string>
): DaySchedule[] {
  const byDate = new Map<string, DaySchedule>()

  for (const row of rows) {
    const bucket = byDate.get(row.date) ?? {
      date: row.date,
      day: [],
      night: [],
    }

    const assignment: ShiftAssignment = {
      id: row.id,
      userId: row.user_id,
      name: row.user_id ? (nameByUserId.get(row.user_id) ?? 'Unknown therapist') : 'Open slot',
      role: row.role,
      shiftType: row.shift_type,
      isCurrentUser: row.user_id === currentUserId,
    }

    if (row.shift_type === 'night') bucket.night.push(assignment)
    else bucket.day.push(assignment)
    byDate.set(row.date, bucket)
  }

  const sortAssignments = (assignments: ShiftAssignment[]) =>
    assignments.sort((left, right) => {
      if (left.role !== right.role) return left.role === 'lead' ? -1 : 1
      if (left.isCurrentUser !== right.isCurrentUser) return left.isCurrentUser ? -1 : 1
      return left.name.localeCompare(right.name)
    })

  return Array.from(byDate.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => ({
      ...day,
      day: sortAssignments(day.day),
      night: sortAssignments(day.night),
    }))
}

function countMyAssignments(days: DaySchedule[]) {
  return days.reduce(
    (count, day) =>
      count +
      day.day.filter((assignment) => assignment.isCurrentUser).length +
      day.night.filter((assignment) => assignment.isCurrentUser).length,
    0
  )
}

function getNextShift(days: DaySchedule[]) {
  const upcoming = days
    .flatMap((day) =>
      [...day.day, ...day.night].map((assignment) => ({ ...assignment, date: day.date }))
    )
    .filter((assignment) => assignment.isCurrentUser)
    .sort((left, right) => {
      if (left.date !== right.date) return left.date.localeCompare(right.date)
      return left.shiftType.localeCompare(right.shiftType)
    })

  return upcoming[0] ?? null
}

function ShiftGroup({
  label,
  assignments,
}: {
  label: 'Day' | 'Night'
  assignments: ShiftAssignment[]
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label} Shift
        </p>
        <p className="text-[11px] text-muted-foreground">{assignments.length} assigned</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {assignments.length === 0 ? (
          <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground">
            No one assigned
          </span>
        ) : (
          assignments.map((assignment) => (
            <span
              key={assignment.id}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                assignment.isCurrentUser
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground',
                assignment.role === 'lead' && !assignment.isCurrentUser
                  ? 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                  : null
              )}
            >
              {assignment.role === 'lead' ? 'Lead: ' : ''}
              {assignment.name}
              {assignment.isCurrentUser ? ' (You)' : ''}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

export default async function TherapistSchedulePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_active, archived_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_active || profile.archived_at) {
    redirect('/?error=account_inactive')
  }

  if (can(parseRole(profile.role), 'access_manager_ui')) {
    redirect('/coverage?view=week')
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: publishedCyclesData } = await supabase
    .from('schedule_cycles')
    .select('id, label, start_date, end_date')
    .eq('published', true)
    .order('start_date', { ascending: true })

  const publishedCycles = (publishedCyclesData ?? []) as PublishedCycleRow[]
  const activeCycle =
    publishedCycles.find((cycle) => cycle.start_date <= today && cycle.end_date >= today) ??
    publishedCycles.find((cycle) => cycle.end_date >= today) ??
    publishedCycles[publishedCycles.length - 1] ??
    null

  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_18px_rgba(15,23,42,0.06)]">
          <div className="border-b border-border px-5 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              My Schedule
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Published Schedule
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              No published cycle is available right now.
            </p>
          </div>
          <div className="space-y-3 px-5 py-5">
            <p className="text-sm text-muted-foreground">
              When managers publish a cycle, the full team schedule will show up here.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/preliminary">Open preliminary</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/therapist/availability">Future availability</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const { data: shiftsData } = await supabase
    .from('shifts')
    .select('id, user_id, date, shift_type, status, role')
    .eq('cycle_id', activeCycle.id)
    .in('status', ['scheduled', 'on_call'])
    .order('date', { ascending: true })

  const shifts = (shiftsData ?? []) as ShiftRow[]
  const shiftUserIds = Array.from(
    new Set(shifts.map((shift) => shift.user_id).filter((value): value is string => Boolean(value)))
  )
  const adminSupabase = createAdminClient()
  const { data: shiftProfilesData } =
    shiftUserIds.length > 0
      ? await adminSupabase.from('profiles').select('id, full_name').in('id', shiftUserIds)
      : { data: [] }

  const nameByUserId = new Map(
    ((shiftProfilesData ?? []) as TherapistScheduleProfileRow[]).map((row) => [
      row.id,
      row.full_name ?? 'Unknown therapist',
    ])
  )
  const days = buildDaySchedules(shifts, user.id, nameByUserId)
  const myAssignmentCount = countMyAssignments(days)
  const nextShift = getNextShift(days)
  const visibleCoworkerCount = new Set(
    days.flatMap((day) =>
      [...day.day, ...day.night]
        .filter((assignment) => assignment.userId && !assignment.isCurrentUser)
        .map((assignment) => assignment.userId as string)
    )
  ).size

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_2px_18px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              My Schedule
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Published Schedule
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCycle.label} | {formatCycleRange(activeCycle.start_date, activeCycle.end_date)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Full team view for the published cycle. Your own shifts are highlighted.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/preliminary">Preliminary</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/therapist/availability">Future availability</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/shift-board">Shift swaps</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>My published shifts</span>
              <CalendarDays className="h-3.5 w-3.5" />
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              {myAssignmentCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Across this published cycle</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Next shift</span>
              <Clock3 className="h-3.5 w-3.5" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-foreground">
              {nextShift ? `${formatShortDate(nextShift.date)} · ${nextShift.shiftType}` : '--'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {nextShift?.role === 'lead' ? 'Lead assignment' : 'Next published assignment'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Visible coworkers</span>
              <Users className="h-3.5 w-3.5" />
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
              {visibleCoworkerCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">People shown across the cycle</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cycle View
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">
              Entire published schedule
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">Browse every day, even when you are off.</p>
        </div>

        <div className="mt-4 space-y-3">
          {days.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                No published shifts are available for this cycle yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                If the cycle was just published, refresh in a moment and try again.
              </p>
            </div>
          ) : (
            days.map((day) => {
              const amWorking = [...day.day, ...day.night].some(
                (assignment) => assignment.isCurrentUser
              )

              return (
                <article
                  key={day.date}
                  className={cn(
                    'rounded-2xl border px-4 py-4',
                    amWorking ? 'border-primary/35 bg-primary/5' : 'border-border bg-card'
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {formatShortDate(day.date)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {amWorking ? 'You are scheduled on this date.' : 'You are off this date.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {amWorking && (
                        <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          Your shift day
                        </span>
                      )}
                      <Button asChild size="sm" variant="outline" className="h-8">
                        <Link href="/shift-board">
                          <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                          Shift board
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <ShiftGroup label="Day" assignments={day.day} />
                    <ShiftGroup label="Night" assignments={day.night} />
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
