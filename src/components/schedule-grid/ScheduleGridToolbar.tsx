'use client'

import { CheckCircle, Printer, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ScheduleGridToolbarProps = {
  cycleId: string
  cycleDateRangeLabel: string
  availableCycles: Array<{ id: string; label: string }>
  isPublished: boolean
  shiftTab: 'Day' | 'Night'
  canManageCoverage: boolean
  onCycleChange: (cycleId: string) => void
  onShiftTabChange: (tab: 'Day' | 'Night') => void
  onAutoDraft?: () => void
  onPreFlight?: () => void
  onPrint: () => void
  onPublish?: () => void
}

export function ScheduleGridToolbar({
  cycleId,
  cycleDateRangeLabel,
  availableCycles,
  isPublished,
  shiftTab,
  canManageCoverage,
  onCycleChange,
  onShiftTabChange,
  onAutoDraft,
  onPreFlight,
  onPrint,
  onPublish,
}: ScheduleGridToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="schedule-cycle">
          Schedule cycle
        </label>
        <select
          id="schedule-cycle"
          value={cycleId}
          onChange={(event) => onCycleChange(event.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-sm font-semibold text-foreground"
          aria-label="Schedule cycle"
        >
          {availableCycles.length > 0 ? (
            availableCycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.label}
              </option>
            ))
          ) : (
            <option value={cycleId}>{cycleDateRangeLabel}</option>
          )}
        </select>
        <span
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium',
            isPublished
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-yellow-200 bg-yellow-50 text-yellow-700'
          )}
        >
          {isPublished ? 'Published' : 'Draft'}
        </span>
        <div className="flex gap-1 rounded-md border border-border bg-card p-0.5">
          {(['Day', 'Night'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                shiftTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              onClick={() => onShiftTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canManageCoverage && !isPublished ? (
          <>
            {onAutoDraft ? (
              <Button size="sm" variant="outline" onClick={onAutoDraft}>
                <Zap className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Auto-draft
              </Button>
            ) : null}
            {onPreFlight ? (
              <Button size="sm" variant="outline" onClick={onPreFlight}>
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Pre-flight
              </Button>
            ) : null}
          </>
        ) : null}
        <Button size="sm" variant="outline" onClick={onPrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Print
        </Button>
        {canManageCoverage && !isPublished && onPublish ? (
          <Button size="sm" onClick={onPublish}>
            Publish -&gt;
          </Button>
        ) : null}
      </div>
    </div>
  )
}
