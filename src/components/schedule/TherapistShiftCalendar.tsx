'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Moon,
  Search,
  Settings,
  Star,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react'

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
  summary: {
    shiftCount: number
    leadCount: number
    dayShiftCount: number
    nightShiftCount: number
    dayOffCount: number
    totalHours: number
  }
  backHref: string
}

type FilterKey = 'all' | 'lead' | 'working' | 'off'

const FILTERS: Array<{
  key: FilterKey
  label: string
  icon: LucideIcon
  countKey: keyof TherapistShiftCalendarProps['summary']
}> = [
  { key: 'all', label: 'All shifts', icon: CalendarDays, countKey: 'shiftCount' },
  { key: 'lead', label: 'Lead shifts', icon: Star, countKey: 'leadCount' },
  { key: 'working', label: 'Day shifts', icon: Sun, countKey: 'dayShiftCount' },
  { key: 'off', label: 'Days off', icon: CalendarDays, countKey: 'dayOffCount' },
]

function assignmentLabel(value: string | null) {
  switch (value) {
    case 'call_in':
      return 'Call in'
    case 'on_call':
      return 'On call'
    case 'left_early':
      return 'Left early'
    default:
      return null
  }
}

function shiftTimeLabel(shiftType: 'day' | 'night') {
  return shiftType === 'night' ? '7:00 PM - 7:00 AM' : '7:00 AM - 7:00 PM'
}

function matchesFilter(day: TherapistShiftDay, filter: FilterKey) {
  if (filter === 'all') return true
  if (filter === 'lead') return day.userShift?.role === 'lead'
  if (filter === 'working') return Boolean(day.userShift)
  return !day.userShift
}

function ShiftBadge({
  children,
  variant = 'muted',
}: {
  children: ReactNode
  variant?: 'day' | 'night' | 'lead' | 'muted'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
        variant === 'day' && 'bg-[var(--info-subtle)] text-[var(--info-text)]',
        variant === 'night' && 'bg-[var(--night-subtle)] text-[var(--night-text)]',
        variant === 'lead' && 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
        variant === 'muted' && 'bg-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}

function MemberAvatar({ member, size = 'sm' }: { member: TherapistShiftMember; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-card',
        size === 'sm' && 'h-6 w-6 text-[10px]',
        size === 'md' && 'h-8 w-8 text-xs',
        member.colorClass
      )}
      aria-hidden="true"
    >
      {member.initials}
    </span>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3',
        accent
          ? 'border-primary/20 bg-primary/5'
          : 'border-border bg-card'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          accent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function DayCard({
  day,
  visibleMemberIds,
}: {
  day: TherapistShiftDay
  visibleMemberIds: Set<string>
}) {
  const visibleTeam = day.team.filter((member) => visibleMemberIds.has(member.id))
  const assignment = assignmentLabel(day.userShift?.assignmentStatus ?? null)
  const isNightShift = day.userShift?.shiftType === 'night'

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-xl border bg-card transition-all duration-200',
        day.userShift
          ? isNightShift
            ? 'border-[var(--night-border)]/50 hover:border-[var(--night-border)] hover:shadow-tw-md'
            : 'border-[var(--info-border)]/50 hover:border-[var(--info-border)] hover:shadow-tw-md'
          : 'border-border/60 bg-muted/30 hover:bg-muted/50'
      )}
      aria-label={`${day.weekdayLabel} ${day.dayLabel}`}
    >
      {/* Shift type indicator bar */}
      {day.userShift && (
        <div
          className={cn(
            'h-1 w-full rounded-t-xl',
            isNightShift ? 'bg-[var(--night)]' : 'bg-[var(--info)]'
          )}
        />
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* Header with badges */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {day.userShift ? (
            <>
              <ShiftBadge variant={isNightShift ? 'night' : 'day'}>
                {isNightShift ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                {day.userShift.shiftType}
              </ShiftBadge>
              {day.userShift.role === 'lead' && (
                <ShiftBadge variant="lead">
                  <Star className="h-3 w-3" />
                  Lead
                </ShiftBadge>
              )}
              {assignment && <ShiftBadge>{assignment}</ShiftBadge>}
            </>
          ) : (
            <ShiftBadge>Off</ShiftBadge>
          )}
        </div>

        {day.userShift ? (
          <>
            {/* Time info */}
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {shiftTimeLabel(day.userShift.shiftType)}
              </p>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                12h
              </span>
            </div>

            {/* Team section */}
            <div className="mt-auto">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3 w-3" />
                Team
              </p>
              <div className="space-y-2">
                {visibleTeam.length > 0 ? (
                  visibleTeam.slice(0, 4).map((member) => (
                    <div key={member.id} className="flex min-w-0 items-center gap-2">
                      <MemberAvatar member={member} />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm font-medium',
                          member.isYou ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        {member.shortName}
                        {member.isYou && ' (You)'}
                      </span>
                      {member.isLead && (
                        <Star className="h-3.5 w-3.5 fill-[var(--attention)] text-[var(--attention)]" />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No teammates selected</p>
                )}
                {visibleTeam.length > 4 && (
                  <p className="text-xs font-medium text-muted-foreground">
                    +{visibleTeam.length - 4} more
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Day off</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Enjoy your rest!</p>
          </div>
        )}
      </div>
    </article>
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
  summary,
  backHref,
}: TherapistShiftCalendarProps) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(
    () => new Set(teammates.map((member) => member.id))
  )
  const [teammateQuery, setTeammateQuery] = useState('')
  const [viewMode, setViewMode] = useState<'week' | 'two' | 'month'>('week')
  const primaryShiftLabel =
    summary.nightShiftCount > summary.dayShiftCount ? 'Night shift' : 'Day shift'
  const primaryShiftCount =
    summary.nightShiftCount > summary.dayShiftCount
      ? summary.nightShiftCount
      : summary.dayShiftCount

  const visibleWeeks = useMemo(() => {
    const maxWeeks = viewMode === 'two' ? 2 : viewMode === 'month' ? 4 : weeks.length
    return weeks.slice(0, maxWeeks).map((week) => ({
      ...week,
      days: week.days.filter((day) => matchesFilter(day, filter)),
    }))
  }, [filter, viewMode, weeks])

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
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Period Navigator */}
              <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-background shadow-tw-sm">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-none border-r border-border hover:bg-muted"
                >
                  <Link href={previousHref} aria-label="Previous schedule window">
                    <ChevronLeft className="h-5 w-5" />
                  </Link>
                </Button>
                <div className="flex min-h-11 items-center gap-2 px-5 text-sm font-semibold text-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                  {periodLabel}
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-none border-l border-border hover:bg-muted"
                >
                  <Link href={nextHref} aria-label="Next schedule window">
                    <ChevronRight className="h-5 w-5" />
                  </Link>
                </Button>
              </div>

              {/* View Mode Toggle */}
              <div className="inline-flex overflow-hidden rounded-xl border border-border bg-background shadow-tw-sm">
                {[
                  ['week', 'Week'],
                  ['two', '2 Weeks'],
                  ['month', 'Month'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setViewMode(key as 'week' | 'two' | 'month')}
                    className={cn(
                      'min-h-11 border-r border-border px-5 text-sm font-medium transition-colors last:border-r-0',
                      viewMode === key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-muted'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => window.print()} className="gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <Button asChild variant="outline" size="icon" aria-label="Schedule settings">
                  <Link href="/therapist/settings">
                    <Settings className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Summary */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <StatCard
              label="Total Shifts"
              value={summary.shiftCount}
              icon={CalendarDays}
              accent
            />
            <StatCard label="Day Shifts" value={summary.dayShiftCount} icon={Sun} />
            <StatCard label="Night Shifts" value={summary.nightShiftCount} icon={Moon} />
            <StatCard label="Lead Shifts" value={summary.leadCount} icon={Star} />
            <div className="col-span-2 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:col-span-4 lg:col-span-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {summary.totalHours}h
                </p>
                <p className="text-xs font-medium text-muted-foreground">Total Hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Filters */}
            <section className="rounded-xl border border-border bg-card p-4 shadow-tw-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Filter Shifts
              </h3>
              <div className="space-y-1">
                {FILTERS.map((item) => {
                  const Icon = item.icon
                  const label =
                    item.key === 'working'
                      ? `${primaryShiftLabel.split(' ')[0]} shifts`
                      : item.label
                  const count = item.key === 'working' ? primaryShiftCount : summary[item.countKey]
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                        filter === item.key
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          filter === item.key
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Teammates */}
            <section className="rounded-xl border border-border bg-card p-4 shadow-tw-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Teammates
              </h3>
              <label className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/30">
                <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">Search teammates</span>
                <input
                  value={teammateQuery}
                  onChange={(event) => setTeammateQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search..."
                />
              </label>

              <div className="max-h-[320px] space-y-1 overflow-y-auto">
                {filteredTeammates.map((member) => {
                  const selected = visibleMemberIds.has(member.id)
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleMember(member.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                        selected ? 'bg-muted/50' : 'hover:bg-muted/30'
                      )}
                    >
                      <MemberAvatar member={member} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {member.shortName}
                        {member.isYou && (
                          <span className="ml-1 text-primary">(You)</span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background'
                        )}
                      >
                        {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
                  <Link href={backHref}>
                    <ChevronLeft className="h-4 w-4" />
                    Back to dashboard
                  </Link>
                </Button>
              </div>
            </section>
          </aside>

          {/* Calendar Grid */}
          <section className="space-y-6">
            {visibleWeeks.map((week) => (
              <div
                key={week.id}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-tw-sm"
              >
                {/* Week Header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    <span className="text-muted-foreground">{week.label}</span>{' '}
                    {week.rangeLabel}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {week.days.length} day{week.days.length !== 1 && 's'}
                  </span>
                </div>

                {/* Days Grid */}
                {week.days.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[900px] grid-cols-7 gap-3 p-4">
                      {week.days.map((day) => (
                        <div key={day.isoDate} className="min-w-0">
                          <p
                            className={cn(
                              'mb-2 text-center text-xs font-semibold',
                              day.isWeekend ? 'text-muted-foreground' : 'text-foreground'
                            )}
                          >
                            {day.weekdayLabel}{' '}
                            <span className="font-bold">{day.dayLabel}</span>
                          </p>
                          <DayCard day={day} visibleMemberIds={visibleMemberIds} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <CalendarDays className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      No days match this filter
                    </p>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
