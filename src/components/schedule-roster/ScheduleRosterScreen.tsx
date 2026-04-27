'use client'

import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useRef, useState, useTransition } from 'react'

import type { ScheduleRosterLivePayload } from '@/app/(app)/schedule/schedule-roster-live-data'
import { RosterTable } from '@/components/schedule-roster/RosterTable'
import { ScheduleCycleSelect } from '@/components/schedule-roster/ScheduleCycleSelect'
import { buildRosterWeeks, type ShiftType } from '@/lib/mock-coverage-roster'
import { splitStaffByRosterAndShift } from '@/lib/schedule-roster-data'
import { cn } from '@/lib/utils'

export type ScheduleRosterScreenProps = {
  live: ScheduleRosterLivePayload
}

const LEGEND: Array<{ code: string; label: string }> = [
  { code: '1', label: 'Working' },
  { code: 'OFF', label: 'Off' },
  { code: 'OC', label: 'On Call' },
  { code: 'CX', label: 'Cancelled' },
  { code: 'LE', label: 'Left Early' },
  { code: 'CI', label: 'Call In' },
]

const CELL_LEGEND_CLASS: Record<string, string> = {
  '1': 'border border-border/60 bg-background text-foreground',
  OFF: 'border border-border/60 bg-background text-muted-foreground',
  OC: 'bg-[var(--primary)] text-white',
  CX: 'bg-[var(--error-subtle)] text-[var(--error-text)] border border-[var(--error-border)]',
  LE: 'bg-[var(--warning-subtle)] text-[var(--warning-text)] border border-[var(--warning-border)]',
  CI: 'bg-[var(--info-subtle)] text-[var(--info-text)] border border-[var(--info-border)]',
}

export function ScheduleRosterScreen({ live }: ScheduleRosterScreenProps) {
  const [selectedShift, setSelectedShift] = useState<ShiftType>('day')
  const [, startTransition] = useTransition()
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const weeks = useMemo(() => buildRosterWeeks(live.startDate, live.endDate), [live])
  const sections = useMemo(
    () => splitStaffByRosterAndShift(live.staff, selectedShift),
    [live.staff, selectedShift]
  )

  const flatDays = useMemo(() => weeks.flatMap((w) => w.days), [weeks])

  const scrollToWeekIndex = (idx: number) => {
    const el = tableScrollRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(idx, weeks.length - 1))
    const daysBefore = weeks.slice(0, clamped).reduce((sum, w) => sum + w.days.length, 0)
    const cellWidth = el.scrollWidth / (flatDays.length + 1)
    el.scrollLeft = daysBefore * cellWidth
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const currentWeekIndex = weeks.findIndex(
    (w) =>
      w.days.some((d) => d.isoDate === todayIso) ||
      (w.startDate <= todayIso && (w.days[w.days.length - 1]?.isoDate ?? '') >= todayIso)
  )

  const [activeWeekIdx, setActiveWeekIdx] = useState(() =>
    currentWeekIndex >= 0 ? currentWeekIndex : 0
  )

  const handleToday = () => {
    const idx = currentWeekIndex >= 0 ? currentWeekIndex : 0
    setActiveWeekIdx(idx)
    scrollToWeekIndex(idx)
  }

  const handlePrev = () => {
    const next = Math.max(0, activeWeekIdx - 1)
    setActiveWeekIdx(next)
    scrollToWeekIndex(next)
  }

  const handleNext = () => {
    const next = Math.min(weeks.length - 1, activeWeekIdx + 1)
    setActiveWeekIdx(next)
    scrollToWeekIndex(next)
  }

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-0 px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Title bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 rounded-t-2xl border border-b-0 border-border/80 bg-card px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground leading-snug">
              Respiratory Therapy –{' '}
              <span className="text-muted-foreground font-medium">
                {selectedShift === 'day' ? 'Day' : 'Night'} Shift
              </span>
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {live.shortLabel} ({weeks.length} Weeks)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Read Only
            </span>
            <Link
              href="/coverage"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted/50 hover:no-underline transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Coverage
            </Link>
          </div>
        </div>
      </div>

      {/* ── Navigation bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-b-0 border-border/80 bg-background/80 px-5 py-2.5 sm:px-6">
        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="h-7 rounded-full border border-border/80 bg-background px-3 text-[12px] font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <span className="ml-2 h-7 rounded-full border border-border/80 bg-background px-3 flex items-center text-[12px] font-medium text-muted-foreground">
            {weeks.length} Weeks
          </span>

          <div className="ml-2">
            <ScheduleCycleSelect cycles={live.availableCycles} activeCycleId={live.cycleId} />
          </div>
        </div>

        {/* Shift tabs */}
        <div className="flex items-center gap-0 rounded-full border border-border/80 bg-muted/40 p-0.5">
          {(['day', 'night'] as const).map((shift) => (
            <button
              key={shift}
              type="button"
              onClick={() => startTransition(() => setSelectedShift(shift))}
              className={cn(
                'h-6 rounded-full px-3 text-[12px] font-medium transition-colors',
                selectedShift === shift
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {shift === 'day' ? 'Day Shift' : 'Night Shift'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Roster matrix ─────────────────────────────────────────── */}
      <div
        ref={tableScrollRef}
        className="overflow-x-auto border border-b-0 border-border/80 bg-background"
      >
        {/* Sticky column header: name column + day/week headers */}
        <div className="flex min-w-max sticky top-0 z-20 bg-card border-b border-border/80">
          {/* Name col header */}
          <div className="sticky left-0 z-30 min-w-[130px] w-[130px] shrink-0 border-r border-border/80 bg-card px-2.5 py-2 flex items-end">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Therapist
            </span>
          </div>

          {/* Week group headers */}
          <div className="flex flex-1">
            {weeks.map((week) => (
              <div
                key={week.id}
                style={{ flex: week.days.length }}
                className="border-l-2 border-border/70 flex flex-col"
              >
                {/* Week date range */}
                <div className="px-1 py-1 border-b border-border/60">
                  <span className="text-[9px] font-semibold text-muted-foreground whitespace-nowrap">
                    {week.label}
                  </span>
                </div>

                {/* Day letters + numbers */}
                <div className="flex">
                  {week.days.map((day) => (
                    <div
                      key={day.isoDate}
                      className={cn(
                        'min-w-[26px] flex-1 flex flex-col items-center justify-center py-1',
                        day.isWeekend && 'bg-muted/40',
                        day.isoDate === todayIso && 'bg-[var(--primary)]/10'
                      )}
                    >
                      <span className="text-[9px] font-semibold uppercase text-muted-foreground">
                        {day.dayLabel}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-semibold mt-0.5',
                          day.isoDate === todayIso ? 'text-[var(--primary)]' : 'text-foreground'
                        )}
                      >
                        {day.dayNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body: core + PRN sections */}
        <div className="min-w-max">
          {sections.core.length > 0 && (
            <RosterTable
              groupLabel="Core Staff"
              staff={sections.core}
              weeks={weeks}
              assignments={live.assignments}
              availabilityApprovals={live.availabilityApprovals}
              selectedShift={selectedShift}
            />
          )}
          {sections.prn.length > 0 && (
            <RosterTable
              groupLabel="PRN / Extra Staff"
              staff={sections.prn}
              weeks={weeks}
              assignments={live.assignments}
              availabilityApprovals={live.availabilityApprovals}
              selectedShift={selectedShift}
            />
          )}
          {sections.core.length === 0 && sections.prn.length === 0 && (
            <div className="px-5 py-8 text-sm text-muted-foreground">
              No staff assigned to this shift in the selected cycle.
            </div>
          )}
        </div>
      </div>

      {/* ── Legend bar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-b-2xl border border-border/80 bg-muted/30 px-5 py-2.5 sm:px-6">
        {LEGEND.map(({ code, label }) => (
          <span key={code} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                'inline-flex h-4 min-w-[20px] items-center justify-center rounded px-1 text-[9px] font-bold',
                CELL_LEGEND_CLASS[code] ?? 'bg-muted text-muted-foreground'
              )}
            >
              {code}
            </span>
            {label}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground italic hidden sm:block">
          Click any cell to edit in Coverage
        </span>
      </div>
    </div>
  )
}
