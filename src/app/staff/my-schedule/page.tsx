import Link from 'next/link'
import { redirect } from 'next/navigation'

import { WorkspaceHero } from '@/components/shell/WorkspaceHero'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { fetchMyPublishedUpcomingShifts, type MyScheduleShiftRow } from '@/lib/staff-my-schedule'
import { createClient } from '@/lib/supabase/server'

const NUM_WEEKS = 6
const NUM_DAYS = NUM_WEEKS * 7
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

function startOfWeek(value: Date): Date {
  const next = new Date(value)
  const day = next.getDay()
  next.setDate(next.getDate() - day)
  next.setHours(12, 0, 0, 0)
  return next
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateNumber(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return String(parsed.getDate())
}

function buildCycleDays(anchorDate: Date): string[] {
  const start = startOfWeek(anchorDate)
  return Array.from({ length: NUM_DAYS }, (_, index) => {
    const next = new Date(start)
    next.setDate(start.getDate() + index)
    return toIsoDate(next)
  })
}

function partitionWeeks(days: string[]): string[][] {
  const weeks: string[][] = []
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7))
  return weeks
}

function buildShiftByDate(shifts: MyScheduleShiftRow[]): Map<string, MyScheduleShiftRow> {
  const next = new Map<string, MyScheduleShiftRow>()
  for (const shift of shifts) {
    if (!next.has(shift.date)) next.set(shift.date, shift)
  }
  return next
}

export default async function StaffMySchedulePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, max_work_days_per_week')
    .eq('id', user.id)
    .maybeSingle()

  if (can(parseRole(profile?.role), 'access_manager_ui')) {
    redirect('/dashboard/manager')
  }

  const weeklyCap = Math.max(1, profile?.max_work_days_per_week ?? 5)
  const shifts = await fetchMyPublishedUpcomingShifts(supabase, user.id, NUM_DAYS)

  const anchorDate = shifts.length > 0 ? new Date(`${shifts[0]!.date}T12:00:00`) : new Date()
  const cycleDays = buildCycleDays(anchorDate)
  const weeks = partitionWeeks(cycleDays)
  const shiftByDate = buildShiftByDate(shifts)
  const totalShiftCount = cycleDays.filter((date) => shiftByDate.has(date)).length
  const firstWeekCount = weeks[0]?.filter((date) => shiftByDate.has(date)).length ?? 0
  const rangeLabel =
    cycleDays.length > 0
      ? formatHumanCycleRange(cycleDays[0]!, cycleDays[cycleDays.length - 1]!)
      : 'Upcoming schedule'

  return (
    <div className="space-y-4 px-4 py-5 md:px-6">
      <WorkspaceHero
        eyebrow={`Day shift · ${rangeLabel}`}
        title="My Shifts"
        metrics={[
          { label: 'Total shifts', value: totalShiftCount },
          { label: 'This week', value: firstWeekCount, accentClassName: 'text-[var(--attention)]' },
        ]}
        actions={
          <>
            <ButtonLink href="/shift-board" label="Request swap" accent />
            <ButtonLink href="/dashboard/staff" label="Back to dashboard" />
          </>
        }
      />

      <section className="overflow-x-auto rounded-[22px] border border-border/70 bg-card shadow-tw-panel-inner-soft">
        <div className="min-w-[58rem]">
          <div className="flex border-b border-border/70 bg-muted/25 px-4 pb-2 pt-3">
            <div className="w-32 shrink-0" />
            {weeks.map((week, index) => (
              <div
                key={`week-${index + 1}`}
                className="flex w-[210px] shrink-0 flex-col items-center border-r border-border/70 last:border-r-0"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Week {index + 1} · {formatShortDate(week[0] ?? '')}
                </span>
              </div>
            ))}
          </div>

          <div className="flex border-b border-border/70 bg-muted/20 px-4 py-2">
            <div className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Shift
            </div>
            {cycleDays.map((date) => {
              const parsed = new Date(`${date}T12:00:00`)
              return (
                <div key={`head-${date}`} className="flex w-[30px] shrink-0 flex-col items-center">
                  <span className="text-[8.5px] font-semibold text-muted-foreground">
                    {DAY_LETTERS[parsed.getDay()] ?? ''}
                  </span>
                  <span className="mt-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] text-muted-foreground">
                    {formatDateNumber(date)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-0 py-2">
              <div className="flex w-32 shrink-0 items-center gap-3 px-2">
                <div className="h-8 w-1.5 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">My schedule</p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    RT Staff
                  </p>
                </div>
              </div>
              {cycleDays.map((date) => {
                const shift = shiftByDate.get(date)
                return (
                  <div key={date} className="flex w-[30px] shrink-0 items-center justify-center">
                    {shift ? (
                      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px] bg-primary">
                        <span className="text-[9px] font-bold text-primary-foreground">1</span>
                      </div>
                    ) : (
                      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[4px]">
                        <span className="text-[9px] text-border">·</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-border/70 bg-card px-5 py-4 shadow-tw-float-tight">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <LegendSwatch className="bg-primary" label="Scheduled shift" />
          <span>{weeklyCap} day weekly cap used for staffing context.</span>
          <span>Published schedules only are shown here.</span>
        </div>
      </section>
    </div>
  )
}

function ButtonLink({
  href,
  label,
  accent = false,
}: {
  href: string
  label: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        accent
          ? 'inline-flex min-h-11 items-center rounded-md bg-[var(--attention)] px-4 text-sm font-semibold text-[var(--sidebar)] hover:no-underline hover:brightness-105'
          : 'inline-flex min-h-11 items-center rounded-md border border-white/18 bg-white/8 px-4 text-sm font-medium text-sidebar-primary hover:bg-white/12 hover:no-underline'
      }
    >
      {label}
    </Link>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-[3px] ${className}`} />
      <span>{label}</span>
    </span>
  )
}
