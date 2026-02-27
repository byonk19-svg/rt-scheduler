'use client'

import { useState } from 'react'
import { Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CalendarToolbarProps = {
  rangeLabel: string
  minCoverage: number
  maxCoverage: number
  issueFilter:
    | 'all'
    | 'missing_lead'
    | 'under_coverage'
    | 'over_coverage'
    | 'ineligible_lead'
    | 'multiple_leads'
  selectedShiftType: 'day' | 'night'
  statusFilter: 'all' | 'any_non_scheduled' | 'call_in' | 'on_call' | 'cancelled' | 'left_early'
  overrideWeeklyRules: boolean
  onShiftTypeChange: (shiftType: 'day' | 'night') => void
  onStatusFilterChange: (
    value: 'all' | 'any_non_scheduled' | 'call_in' | 'on_call' | 'cancelled' | 'left_early'
  ) => void
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
  issueFilter,
  selectedShiftType,
  statusFilter,
  overrideWeeklyRules,
  onShiftTypeChange,
  onStatusFilterChange,
  onOverrideWeeklyRulesChange,
}: CalendarToolbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-white/95 p-3 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Target: {minCoverage}-{maxCoverage} per shift
          </p>
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
          <span className="text-xs font-medium text-muted-foreground">
            Filter:{' '}
            {issueFilter === 'missing_lead'
              ? 'Missing lead'
              : issueFilter === 'under_coverage'
                ? 'Under coverage'
                : issueFilter === 'over_coverage'
                  ? 'Over coverage'
                  : issueFilter === 'ineligible_lead'
                    ? 'Ineligible lead'
                    : issueFilter === 'multiple_leads'
                      ? 'Multiple leads'
                      : 'All'}
          </span>
          <span className="text-xs font-medium text-muted-foreground">View:</span>
          <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={filterButtonClass(selectedShiftType === 'day')}
              onClick={() => onShiftTypeChange('day')}
            >
              Day
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={filterButtonClass(selectedShiftType === 'night')}
              onClick={() => onShiftTypeChange('night')}
            >
              Night
            </Button>
          </div>
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
          <span className="text-xs font-medium text-muted-foreground">Status:</span>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => onStatusFilterChange('all')}
          >
            All
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'any_non_scheduled' ? 'default' : 'outline'}
            onClick={() => onStatusFilterChange('any_non_scheduled')}
          >
            Any non-scheduled
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'call_in' ? 'default' : 'outline'}
            onClick={() => onStatusFilterChange('call_in')}
            title="Call in"
            aria-label="Filter call in"
          >
            CI
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'on_call' ? 'default' : 'outline'}
            onClick={() => onStatusFilterChange('on_call')}
            title="On call"
            aria-label="Filter on call"
          >
            OC
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
            onClick={() => onStatusFilterChange('cancelled')}
            title="Cancelled"
            aria-label="Filter cancelled"
          >
            CX
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === 'left_early' ? 'default' : 'outline'}
            onClick={() => onStatusFilterChange('left_early')}
            title="Left early"
            aria-label="Filter left early"
          >
            LE
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Legend
          </span>
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs font-medium',
              legendChipClass('draft')
            )}
          >
            Draft
          </span>
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs font-medium',
              legendChipClass('published')
            )}
          >
            Published
          </span>
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs font-medium',
              legendChipClass('override')
            )}
          >
            Override
          </span>
        </div>
      </div>
    </div>
  )
}
