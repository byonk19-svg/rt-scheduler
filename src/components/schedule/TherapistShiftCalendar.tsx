'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
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
}: {
  day: TherapistShiftDay
  visibleMemberIds: Set<string>
}) {
  const visibleTeam = day.team.filter((member) => visibleMemberIds.has(member.id))
  const assignment = assignmentLabel(day.userShift?.assignmentStatus ?? null)

  return (
    <article
      className={cn(
        'flex min-h-[13rem] flex-col rounded-md border border-border/80 bg-card p-3 shadow-tw-2xs',
        day.isWeekend && !day.userShift && 'bg-muted/20'
      )}
      aria-label={`${day.weekdayLabel} ${day.dayLabel}`}
    >
      <div className="mb-2 flex min-h-5 flex-wrap items-center gap-1.5">
        {day.userShift ? (
          <>
            <Chip tone="day">{day.userShift.shiftType}</Chip>
            {day.userShift.role === 'lead' ? <Chip tone="lead">Lead</Chip> : null}
            {assignment ? <Chip>{assignment}</Chip> : null}
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
          <p className="mt-3 text-xs font-medium text-muted-foreground">Enjoy your day!</p>
        </div>
      )}
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
              ['week', 'Week'],
              ['two', '2 Weeks'],
              ['month', 'Month'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setViewMode(key as 'week' | 'two' | 'month')}
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
              <Chip tone="day">{primaryShiftLabel.split(' ')[0]}</Chip>
              <span>{primaryShiftLabel}</span>
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

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-3 shadow-tw-sm">
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Filters
            </p>
            <div className="space-y-1">
              {FILTERS.map((item) => {
                const Icon = item.icon
                const label =
                  item.key === 'working' ? `${primaryShiftLabel.split(' ')[0]} shifts` : item.label
                const count = item.key === 'working' ? primaryShiftCount : summary[item.countKey]
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

          <section className="rounded-lg border border-border bg-card p-3 shadow-tw-sm">
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
                <div className="grid min-w-[58rem] grid-cols-7 gap-2 overflow-x-auto p-2">
                  {week.days.map((day) => (
                    <div key={day.isoDate} className="min-w-0">
                      <p className="mb-2 text-center text-xs font-bold text-foreground">
                        {day.weekdayLabel} {day.dayLabel}
                      </p>
                      <DayCard day={day} visibleMemberIds={visibleMemberIds} />
                    </div>
                  ))}
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
