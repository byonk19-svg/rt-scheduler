import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react'

import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import {
  buildCalendarWeeks,
  formatDateLabel,
  formatMonthLabel,
  shiftMonthKey,
  toIsoDate,
  toMonthEndKey,
  toMonthStartKey,
} from '@/lib/calendar-utils'
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
  role: 'lead' | 'staff'
}

type ShiftAssignment = {
  userId: string | null
  name: string
  role: 'lead' | 'staff'
}

function formatCycleRange(startDate: string, endDate: string) {
  return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`
}

function parseShiftFilter(raw: string | string[] | undefined): 'day' | 'night' {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'night' ? 'night' : 'day'
}

export default async function TherapistSchedulePage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string | string[]; shift?: string | string[] }>
}) {
  const supabase = await createClient()
  const params = searchParams ? await searchParams : undefined
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
          </div>
        </section>
      </div>
    )
  }

  const { data: shiftsData } = await supabase
    .from('shifts')
    .select('id, user_id, date, shift_type, role')
    .eq('cycle_id', activeCycle.id)
    .order('date', { ascending: true })

  const allShifts = (shiftsData ?? []) as ShiftRow[]
  const shiftUserIds = Array.from(
    new Set(
      allShifts.map((shift) => shift.user_id).filter((value): value is string => Boolean(value))
    )
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

  const shiftFilter = parseShiftFilter(params?.shift)
  const requestedMonth = Array.isArray(params?.month) ? params?.month[0] : params?.month
  const cycleStartMonth = toMonthStartKey(activeCycle.start_date)
  const cycleEndMonth = toMonthStartKey(activeCycle.end_date)
  const inferredMonth =
    requestedMonth && /^\d{4}-\d{2}-01$/.test(requestedMonth)
      ? requestedMonth
      : toMonthStartKey(activeCycle.start_date)
  const monthKey =
    inferredMonth < cycleStartMonth
      ? cycleStartMonth
      : inferredMonth > cycleEndMonth
        ? cycleEndMonth
        : inferredMonth
  const monthEndKey = toMonthEndKey(monthKey)
  const monthLabel = formatMonthLabel(monthKey)
  const prevMonth = shiftMonthKey(monthKey, -1)
  const nextMonth = shiftMonthKey(monthKey, 1)
  const canGoPrev = prevMonth >= cycleStartMonth
  const canGoNext = nextMonth <= cycleEndMonth

  const monthAssignments = allShifts
    .filter((shift) => shift.date >= monthKey && shift.date <= monthEndKey)
    .map(
      (
        shift
      ): ShiftAssignment & {
        date: string
        shiftType: 'day' | 'night'
        isCurrentUser: boolean
      } => ({
        userId: shift.user_id,
        name: shift.user_id
          ? (nameByUserId.get(shift.user_id) ?? 'Unknown therapist')
          : 'Open slot',
        role: shift.role,
        date: shift.date,
        shiftType: shift.shift_type,
        isCurrentUser: shift.user_id === user.id,
      })
    )

  const myTotal = monthAssignments.filter((entry) => entry.isCurrentUser).length
  const myDay = monthAssignments.filter(
    (entry) => entry.isCurrentUser && entry.shiftType === 'day'
  ).length
  const myNight = monthAssignments.filter(
    (entry) => entry.isCurrentUser && entry.shiftType === 'night'
  ).length

  const assignmentsByDate = new Map<string, ShiftAssignment[]>()
  for (const assignment of monthAssignments) {
    if (assignment.shiftType !== shiftFilter) continue
    const list = assignmentsByDate.get(assignment.date) ?? []
    list.push({
      userId: assignment.userId,
      name: assignment.name,
      role: assignment.role,
    })
    assignmentsByDate.set(assignment.date, list)
  }
  for (const [date, entries] of assignmentsByDate.entries()) {
    entries.sort((left, right) => {
      if (left.role !== right.role) return left.role === 'lead' ? -1 : 1
      return left.name.localeCompare(right.name)
    })
    assignmentsByDate.set(date, entries)
  }
  const weeks = buildCalendarWeeks(monthKey, monthEndKey)
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_12px_rgba(15,23,42,0.05)]">
        <div className="px-5 py-4">
          <div>
            <h1 className="text-[2rem] font-bold tracking-tight text-foreground">My Schedule</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatCycleRange(activeCycle.start_date, activeCycle.end_date)} | {activeCycle.label}
            </p>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3.5">
          <div className="flex items-center justify-between">
            {canGoPrev ? (
              <Link
                href={`/therapist/schedule?month=${prevMonth}&shift=${shiftFilter}`}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
            ) : (
              <span className="h-7 w-7" />
            )}
            <p className="text-[2rem] font-semibold tracking-tight text-foreground">{monthLabel}</p>
            {canGoNext ? (
              <Link
                href={`/therapist/schedule?month=${nextMonth}&shift=${shiftFilter}`}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </Link>
            ) : (
              <span className="h-7 w-7" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-border px-5 py-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Sun className="h-3.5 w-3.5" />
            </div>
            <p className="mt-1 text-center text-[2rem] font-bold leading-none tracking-tight text-foreground">
              {myTotal}
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">Total Shifts</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Sun className="h-3.5 w-3.5" />
            </div>
            <p className="mt-1 text-center text-[2rem] font-bold leading-none tracking-tight text-foreground">
              {myDay}
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">Day Shifts</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Moon className="h-3.5 w-3.5" />
            </div>
            <p className="mt-1 text-center text-[2rem] font-bold leading-none tracking-tight text-foreground">
              {myNight}
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">Night Shifts</p>
          </div>
        </div>

        <div className="border-t border-border px-5 py-2.5">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
            <Link
              href={`/therapist/schedule?month=${monthKey}&shift=day`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                shiftFilter === 'day'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              Day
            </Link>
            <Link
              href={`/therapist/schedule?month=${monthKey}&shift=night`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                shiftFilter === 'night'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              Night
            </Link>
          </div>
        </div>

        <div className="overflow-hidden border-t border-border">
          <div className="grid grid-cols-7 border-b border-border bg-muted/15">
            {weekDays.map((weekday) => (
              <div
                key={weekday}
                className="border-r border-border px-2 py-2 text-center text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0"
              >
                {weekday}
              </div>
            ))}
          </div>
          {weeks.map((week, weekIndex) => (
            <div
              key={week[0] ? toIsoDate(week[0]) : `week-${String(weekIndex)}`}
              className="grid grid-cols-7"
            >
              {week.map((day) => {
                const dateKey = toIsoDate(day)
                const inMonth = dateKey >= monthKey && dateKey <= monthEndKey
                const inCycle = dateKey >= activeCycle.start_date && dateKey <= activeCycle.end_date
                const assignments = assignmentsByDate.get(dateKey) ?? []
                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'min-h-32 border-r border-b border-border px-2 py-2 align-top last:border-r-0',
                      !inMonth ? 'bg-muted/10 text-muted-foreground/70' : 'bg-card'
                    )}
                  >
                    <p className="text-right text-xs font-semibold text-foreground/90">
                      {day.getDate()}
                    </p>
                    {inMonth && inCycle ? (
                      <div className="mt-2 space-y-1">
                        {assignments.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            No scheduled therapists
                          </p>
                        ) : (
                          assignments.map((assignment, index) => (
                            <p
                              key={`${dateKey}-${assignment.name}-${String(index)}`}
                              className={cn(
                                'truncate text-[11px] font-medium',
                                assignment.role === 'lead'
                                  ? 'text-[var(--warning-text)]'
                                  : 'text-foreground'
                              )}
                            >
                              {assignment.role === 'lead' ? 'Lead: ' : ''}
                              {assignment.name}
                            </p>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
