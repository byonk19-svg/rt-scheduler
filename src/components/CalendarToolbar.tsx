'use client'

import { useState } from 'react'
import { Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CalendarToolbarProps = {
  rangeLabel: string
  minCoverage: number
  maxCoverage: number
  showDayTeam: boolean
  showNightTeam: boolean
  overrideWeeklyRules: boolean
  onToggleDayTeam: () => void
  onToggleNightTeam: () => void
  onOverrideWeeklyRulesChange: (next: boolean) => void
}

function filterButtonClass(isActive: boolean): string {
  return isActive ? 'bg-primary text-primary-foreground hover:bg-[var(--tw-deep-blue)]' : ''
}

function legendChipClass(tone: 'draft' | 'published' | 'override'): string {
  if (tone === 'published') {
    return 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
  }
  if (tone === 'override') {
    return 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
  }
  return 'border-border bg-muted text-muted-foreground'
}

export function CalendarToolbar({
  rangeLabel,
  minCoverage,
  maxCoverage,
  showDayTeam,
  showNightTeam,
  overrideWeeklyRules,
  onToggleDayTeam,
  onToggleNightTeam,
  onOverrideWeeklyRulesChange,
}: CalendarToolbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="sticky top-0 z-20 rounded-xl border border-border bg-white/95 p-3 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Target: {minCoverage}-{maxCoverage} per shift</p>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="md:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      <div className={cn('mt-3 space-y-3', mobileOpen ? 'block' : 'hidden md:block')}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={filterButtonClass(showDayTeam)}
            onClick={onToggleDayTeam}
          >
            Day team
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={filterButtonClass(showNightTeam)}
            onClick={onToggleNightTeam}
          >
            Night team
          </Button>
          <label className="ml-0 flex items-center gap-2 text-xs text-muted-foreground md:ml-2">
            <input
              type="checkbox"
              checked={overrideWeeklyRules}
              onChange={(event) => onOverrideWeeklyRulesChange(event.target.checked)}
            />
            Override drag limits
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legend</span>
          <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', legendChipClass('draft'))}>
            Draft
          </span>
          <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', legendChipClass('published'))}>
            Published
          </span>
          <span className={cn('rounded-md border px-2 py-0.5 text-xs font-medium', legendChipClass('override'))}>
            Override
          </span>
        </div>
      </div>
    </div>
  )
}
