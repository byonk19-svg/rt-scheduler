'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Clock3,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Moon,
  Search,
  Settings,
  Star,
  Sun,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { ScheduleContextBar } from '@/components/schedule/ScheduleContextBar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type TherapistShiftMember = {
  id: string
  name: string
  shortName: string
  initials: string
  colorClass: string
  isLead: boolean
  isYou: boolean
}

export type TherapistShiftDay = {
  isoDate: string
  weekdayLabel: string
  dayLabel: string
  isWeekend: boolean
  userShift: {
    id: string
    shiftType: 'day' | 'night'
    role: string | null
    assignmentStatus: string | null
    status: string
  } | null
  team: TherapistShiftMember[]
}

export type TherapistShiftWeek = {
  id: string
  label: string
  rangeLabel: string
  days: TherapistShiftDay[]
}

export type TherapistShiftCalendarProps = {
  title: string
  subtitle: string
  periodLabel: string
  previousHref: string
  nextHref: string
  weeks: TherapistShiftWeek[]
  teammates: TherapistShiftMember[]
  defaultShiftLabel: 'Day shift' | 'Night shift'
  scheduleContext: {
    rangeLabel: string
    cadenceLabel: string
    shiftLabel: string
    stateLabel: string
    permissionLabel: string
  }
  summary: {
    shiftCount: number
    leadCount: number
    dayShiftCount: number
    nightShiftCount: number
    dayOffCount: number
    totalHours: number
  }
  todayIso: string
  backHref: string
}

type FilterKey = 'all' | 'lead' | 'working' | 'off'

const FILTERS: Array<{
  key: FilterKey
  label: string
  icon: LucideIcon
  countKey: keyof TherapistShiftCalendarProps['summary']
}> = [
  { key: 'all', label: 'Full block', icon: CalendarDays, countKey: 'shiftCount' },
  { key: 'lead', label: 'Lead days', icon: Star, countKey: 'leadCount' },
  { key: 'working', label: 'Working days', icon: UserCheck, countKey: 'shiftCount' },
  { key: 'off', label: 'Days off', icon: CalendarDays, countKey: 'dayOffCount' },
]

function labelFromValue(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function assignmentLabel(value: string | null) {
  switch (value) {
    case 'call_in':
      return 'Call In'
    case 'on_call':
      return 'On Call'
    case 'left_early':
      return 'Left Early'
    case 'cancelled':
      return 'Cancelled'
    case 'called_off':
    case 'sick':
      return 'Cancelled'
    case 'scheduled':
      return 'Scheduled'
    default:
      return value ? labelFromValue(value) : null
  }
}

function scheduleStatusLabel(day: TherapistShiftDay) {
  if (!day.userShift) return 'Not scheduled'
  const preferredStatus =
    day.userShift.assignmentStatus && day.userShift.assignmentStatus !== 'scheduled'
      ? day.userShift.assignmentStatus
      : day.userShift.status
  return assignmentLabel(preferredStatus) ?? 'Scheduled'
}

function activeWorkStatusLabel(day: TherapistShiftDay) {
  const status = scheduleStatusLabel(day)
  if (status === 'Cancelled') return 'Cancelled'
  if (status === 'Call In') return 'Call In'
  if (status === 'On Call') return 'On Call'
  if (status === 'Left Early') return 'Left Early'
  return 'Working shift'
}

function shiftName(shiftType: 'day' | 'night') {
  return shiftType === 'night' ? 'Night shift' : 'Day shift'
}

function shiftTimeLabel(shiftType: 'day' | 'night') {
  return shiftType === 'night' ? '7:00 PM - 7:00 AM' : '7:00 AM - 7:00 PM'
}

function buildShiftRequestHref(shiftId: string, requestType: 'swap' | 'pickup') {
  const params = new URLSearchParams({ new: '1', shiftId, type: requestType })
  return `/requests/new?${params.toString()}`
}

function formatSelectedDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCompactDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function matchesFilter(day: TherapistShiftDay, filter: FilterKey) {
  if (filter === 'all') return true
  if (filter === 'lead') return day.userShift?.role === 'lead'
  if (filter === 'working') return Boolean(day.userShift)
  return !day.userShift
}

function Chip({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: 'day' | 'lead' | 'muted'
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold uppercase leading-none tracking-[0.04em]',
        tone === 'day' &&
          'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]',
        tone === 'lead' &&
          'border-[color:color-mix(in_srgb,var(--attention)_65%,white)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
        tone === 'muted' && 'border-border bg-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}

function MemberAvatar({ member }: { member: TherapistShiftMember }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-white/80',
        member.colorClass
      )}
      aria-hidden="true"
    >
      {member.initials}
    </span>
  )
}

function DayCard({
  day,
  visibleMemberIds,
  isSelected,
  isHighlighted,
  onSelect,
}: {
  day: TherapistShiftDay
  visibleMemberIds: Set<string>
  isSelected: boolean
  isHighlighted: boolean
  onSelect: () => void
}) {
  const visibleTeam = day.team.filter((member) => visibleMemberIds.has(member.id))
  const status = scheduleStatusLabel(day)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-[13rem] w-full flex-col rounded-md border border-border/80 bg-card p-3 text-left shadow-tw-2xs transition',
        day.isWeekend && !day.userShift && 'bg-muted/20',
        day.userShift && 'border-primary/60 bg-[var(--info-subtle)]/45 ring-1 ring-primary/20',
        isSelected && 'border-primary bg-[var(--info-subtle)] ring-2 ring-primary/70',
        !isHighlighted && 'opacity-55 hover:opacity-90',
        isHighlighted && 'hover:border-primary/80 hover:ring-1 hover:ring-primary/50'
      )}
      aria-label={`${day.weekdayLabel} ${day.dayLabel}`}
      aria-pressed={isSelected}
    >
      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-1.5">
        {day.userShift ? (
          <>
            <Chip tone="day">{shiftName(day.userShift.shiftType)}</Chip>
            <Chip>You work</Chip>
            {day.userShift.role === 'lead' ? <Chip tone="lead">Lead</Chip> : null}
            <Chip>{status}</Chip>
          </>
        ) : (
          <Chip>Day off</Chip>
        )}
      </div>

      {day.userShift ? (
        <>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-foreground">
              {shiftTimeLabel(day.userShift.shiftType)}
            </p>
            <p className="text-xs font-medium text-muted-foreground">12h</p>
          </div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Team</p>
          <div className="space-y-2">
            {visibleTeam.length > 0 ? (
              visibleTeam.map((member) => (
                <div key={member.id} className="flex min-w-0 items-center gap-2">
                  <MemberAvatar member={member} />
                  <span
                    className={cn(
                      'min-w-0 truncate text-xs font-semibold text-foreground',
                      member.isYou && 'text-primary'
                    )}
                  >
                    {member.shortName}
                    {member.isYou ? ' (You)' : ''}
                  </span>
                  {member.isLead ? <Chip tone="lead">Lead</Chip> : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No selected teammates</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground/70" aria-hidden="true" />
          <p className="mt-3 text-xs font-medium text-muted-foreground">Not scheduled</p>
        </div>
      )}
    </button>
  )
}

export function TherapistShiftCalendar({
  title,
  subtitle,
  periodLabel,
  previousHref,
  nextHref,
  weeks,
  teammates,
  defaultShiftLabel,
  scheduleContext,
  summary,
  todayIso,
  backHref,
}: TherapistShiftCalendarProps) {
  const allDays = useMemo(() => weeks.flatMap((week) => week.days), [weeks])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(
    () => new Set(teammates.map((member) => member.id))
  )
  const [teammateQuery, setTeammateQuery] = useState('')
  const [viewMode, setViewMode] = useState<'block' | 'two' | 'month'>('block')
  const [selectedDayIso, setSelectedDayIso] = useState(
    () => allDays.find((day) => day.userShift)?.isoDate ?? allDays[0]?.isoDate ?? ''
  )
  const selectedDay = allDays.find((day) => day.isoDate === selectedDayIso) ?? allDays[0] ?? null
  const selectedCoworkers = selectedDay?.team.filter((member) => !member.isYou) ?? []
  const selectedLead = selectedDay?.team.find((member) => member.isLead) ?? null
  const canRequestSelectedShift =
    selectedDay?.userShift && scheduleStatusLabel(selectedDay) === 'Scheduled'
  const upcomingShiftDays = useMemo(
    () =>
      allDays
        .filter((day) => day.userShift && day.isoDate >= todayIso)
        .sort((left, right) => left.isoDate.localeCompare(right.isoDate))
        .slice(0, 4),
    [allDays, todayIso]
  )
  const nextShift = upcomingShiftDays[0] ?? null

  const visibleWeeks = useMemo(() => {
    const maxWeeks = viewMode === 'two' ? 2 : viewMode === 'month' ? 4 : weeks.length
    return weeks.slice(0, maxWeeks).map((week) => ({
      ...week,
    }))
  }, [viewMode, weeks])

  const filteredTeammates = useMemo(() => {
    const query = teammateQuery.trim().toLowerCase()
    if (!query) return teammates
    return teammates.filter((member) => member.name.toLowerCase().includes(query))
  }, [teammateQuery, teammates])

  function toggleMember(id: string) {
    setVisibleMemberIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-5 px-4 py-5 md:px-8 md:py-7">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card shadow-tw-2xs">
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="rounded-none border-r border-border"
            >
              <Link href={previousHref} aria-label="Previous schedule window">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="inline-flex min-h-11 items-center gap-2 px-4 text-sm font-bold text-foreground">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {periodLabel}
            </div>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="rounded-none border-l border-border"
            >
              <Link href={nextHref} aria-label="Next schedule window">
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="inline-flex overflow-hidden rounded-lg border border-border bg-card shadow-tw-2xs">
            {[
              ['block', '6 Weeks'],
              ['two', '2 Weeks'],
              ['month', '4 Weeks'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewMode(key as 'block' | 'two' | 'month')}
                className={cn(
                  'min-h-11 border-r border-border px-5 text-sm font-semibold last:border-r-0',
                  viewMode === key
                    ? 'bg-[var(--info-subtle)] text-primary ring-1 ring-inset ring-primary/70'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <Button asChild variant="outline" size="icon" aria-label="Schedule settings">
            <Link href="/therapist/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <ScheduleContextBar
        {...scheduleContext}
        className="sticky top-2 z-20 bg-card/95 backdrop-blur md:static md:bg-card md:backdrop-blur-none"
      />

      <section className="rounded-lg border border-border bg-card px-4 py-3 shadow-tw-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--info-subtle)] text-primary">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-bold text-foreground">
              {summary.shiftCount} shift{summary.shiftCount === 1 ? '' : 's'}{' '}
              <span className="text-muted-foreground">-</span> {summary.totalHours}h total
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm">
            <span className="inline-flex items-center gap-2">
              {defaultShiftLabel === 'Night shift' ? (
                <Moon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span>{defaultShiftLabel}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Chip tone="lead">Lead</Chip>
              <span>Lead</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Chip>Off</Chip>
              <span>Day off</span>
            </span>
          </div>

          <Button variant="outline" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Export schedule
          </Button>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <article className="rounded-lg border border-border bg-card p-4 shadow-tw-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Next shift
              </p>
              {nextShift ? (
                <h2 className="mt-1 text-lg font-bold text-foreground">
                  {formatSelectedDate(nextShift.isoDate)}
                </h2>
              ) : (
                <h2 className="mt-1 text-lg font-bold text-foreground">
                  No remaining shifts in this Schedule Block
                </h2>
              )}
            </div>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--info-subtle)] text-primary">
              <Clock3 className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          {nextShift?.userShift ? (
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Shift</p>
                <p className="font-semibold text-foreground">
                  {shiftName(nextShift.userShift.shiftType)} ·{' '}
                  {shiftTimeLabel(nextShift.userShift.shiftType)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Status</p>
                <p className="font-semibold text-foreground">{activeWorkStatusLabel(nextShift)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Lead</p>
                <p className="font-semibold text-foreground">
                  {nextShift.team.find((member) => member.isLead)?.shortName ?? 'No lead listed'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Coworkers</p>
                <p className="font-semibold text-foreground">
                  {Math.max(nextShift.team.filter((member) => !member.isYou).length, 0)} listed
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Use the full block below to review past shifts and team context.
            </p>
          )}
        </article>

        <article className="rounded-lg border border-border bg-card p-4 shadow-tw-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Upcoming personal shifts
              </p>
              <h2 className="mt-1 text-lg font-bold text-foreground">
                {upcomingShiftDays.length} in this Schedule Block
              </h2>
            </div>
            <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>

          {upcomingShiftDays.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {upcomingShiftDays.map((day) => (
                <button
                  key={day.isoDate}
                  type="button"
                  onClick={() => setSelectedDayIso(day.isoDate)}
                  className={cn(
                    'min-h-16 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:border-primary/70 hover:bg-[var(--info-subtle)]',
                    selectedDay?.isoDate === day.isoDate &&
                      'border-primary bg-[var(--info-subtle)] ring-1 ring-primary/60'
                  )}
                >
                  <p className="text-sm font-bold text-foreground">
                    {formatCompactDate(day.isoDate)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {day.userShift ? shiftName(day.userShift.shiftType) : defaultShiftLabel} ·{' '}
                    {scheduleStatusLabel(day)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No future assigned shifts are listed in this block.
            </p>
          )}
        </article>
      </section>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <section className="order-2 rounded-lg border border-border bg-card p-3 shadow-tw-sm lg:order-1">
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Highlights
            </p>
            <div className="space-y-1">
              {FILTERS.map((item) => {
                const Icon = item.icon
                const label = item.key === 'working' ? `${defaultShiftLabel} days` : item.label
                const count = item.key === 'all' ? allDays.length : summary[item.countKey]
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={cn(
                      'flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold',
                      filter === item.key
                        ? 'bg-[var(--info-subtle)] text-primary'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {selectedDay ? (
            <section className="order-1 rounded-lg border border-border bg-card p-4 shadow-tw-sm lg:order-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Selected day
              </p>
              <h2 className="mt-1 text-base font-bold text-foreground">
                {formatSelectedDate(selectedDay.isoDate)}
              </h2>

              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Shift</span>
                  <span className="font-semibold text-foreground">
                    {selectedDay.userShift
                      ? shiftName(selectedDay.userShift.shiftType)
                      : defaultShiftLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Your status</span>
                  <span className="font-semibold text-foreground">
                    {selectedDay.userShift ? 'You work this day' : 'You are not scheduled'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Schedule status</span>
                  <Chip>{scheduleStatusLabel(selectedDay)}</Chip>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Lead</span>
                  <span className="font-semibold text-foreground">
                    {selectedLead ? selectedLead.shortName : 'No lead listed'}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-bold text-muted-foreground">Coworkers</p>
                {selectedCoworkers.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCoworkers.map((member) => (
                      <div key={member.id} className="flex min-w-0 items-center gap-2">
                        <MemberAvatar member={member} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                          {member.shortName}
                        </span>
                        {member.isLead ? <Chip tone="lead">Lead</Chip> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No coworkers are listed for this shift.
                  </p>
                )}
              </div>

              {canRequestSelectedShift ? (
                <div className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
                  <Button asChild variant="outline" size="sm" className="min-h-10">
                    <Link href={buildShiftRequestHref(selectedDay.userShift!.id, 'pickup')}>
                      Give up shift
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="min-h-10">
                    <Link href={buildShiftRequestHref(selectedDay.userShift!.id, 'swap')}>
                      Trade shift
                    </Link>
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="order-3 rounded-lg border border-border bg-card p-3 shadow-tw-sm">
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Teammates
            </p>
            <label className="mb-3 flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Search teammates</span>
              <input
                value={teammateQuery}
                onChange={(event) => setTeammateQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search teammates..."
              />
            </label>

            <div className="max-h-[22rem] space-y-1 overflow-y-auto pr-1">
              {filteredTeammates.map((member) => {
                const selected = visibleMemberIds.has(member.id)
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className="flex min-h-9 w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-muted"
                  >
                    <MemberAvatar member={member} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {member.shortName}
                      {member.isYou ? ' (You)' : ''}
                    </span>
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded text-white',
                        selected ? 'bg-primary' : 'bg-muted text-transparent'
                      )}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                )
              })}
            </div>

            <Button asChild variant="ghost" size="sm" className="mt-3 w-full justify-start">
              <Link href={backHref}>Back to dashboard</Link>
            </Button>
          </section>
        </aside>

        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-tw-sm">
          {visibleWeeks.map((week, index) => (
            <div key={week.id} className={cn(index > 0 && 'border-t border-border')}>
              <div className="flex min-h-11 items-center justify-between border-b border-border bg-muted/30 px-4">
                <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {week.label} <span className="text-foreground">{week.rangeLabel}</span>
                </h2>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              {week.days.length > 0 ? (
                <div className="overflow-x-auto p-2">
                  <div className="grid min-w-[58rem] grid-cols-7 gap-2">
                    {week.days.map((day) => (
                      <div key={day.isoDate} className="min-w-0">
                        <p className="mb-2 text-center text-xs font-bold text-foreground">
                          {day.weekdayLabel} {day.dayLabel}
                        </p>
                        <DayCard
                          day={day}
                          visibleMemberIds={visibleMemberIds}
                          isSelected={day.isoDate === selectedDay?.isoDate}
                          isHighlighted={matchesFilter(day, filter)}
                          onSelect={() => setSelectedDayIso(day.isoDate)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="px-4 py-8 text-sm text-muted-foreground">
                  No days match this filter in this week.
                </p>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
