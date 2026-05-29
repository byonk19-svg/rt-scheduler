'use client'

import {
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  Moon,
  Printer,
  Send,
  Sun,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ScheduleInteractionMode } from './schedule-grid-types'

type ScheduleGridToolbarProps = {
  cycleId: string
  cycleDateRangeLabel: string
  availableCycles: Array<{ id: string; label: string }>
  isPublished: boolean
  cycleStatus: 'draft' | 'preliminary' | 'final' | 'offline' | 'archived' | null
  shiftTab: 'Day' | 'Night'
  isPending: boolean
  interactionMode: ScheduleInteractionMode
  onCycleChange: (cycleId: string) => void
  onShiftTabChange: (tab: 'Day' | 'Night') => void
  onAutoDraft?: () => void
  onPreFlight?: () => void
  onSendPreliminary?: () => void
  onPrint: () => void
  onPublish?: () => void
  publishLabel?: string
}

export function ScheduleGridToolbar({
  cycleId,
  cycleDateRangeLabel,
  availableCycles,
  isPublished,
  cycleStatus,
  shiftTab,
  isPending,
  interactionMode,
  onCycleChange,
  onShiftTabChange,
  onAutoDraft,
  onPreFlight,
  onSendPreliminary,
  onPrint,
  onPublish,
  publishLabel = 'Publish',
}: ScheduleGridToolbarProps) {
  const preliminaryLabel =
    cycleStatus === 'preliminary' ? 'Refresh preliminary' : 'Send preliminary'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/95 px-3 py-2 shadow-tw-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="schedule-cycle">
          Schedule Block
        </label>
        <div className="flex min-w-[14rem] items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 shadow-tw-2xs">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <select
            id="schedule-cycle"
            value={cycleId}
            disabled={isPending}
            onChange={(event) => onCycleChange(event.target.value)}
            className="h-6 min-w-0 flex-1 bg-transparent text-xs font-bold text-foreground outline-none disabled:opacity-60"
            aria-label="Schedule Block"
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
        </div>
        <span
          className={cn(
            'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-black',
            isPublished
              ? 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
              : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
          )}
        >
          {isPublished ? 'Published' : 'Draft'}
        </span>
        <div className="flex h-7 gap-1 rounded-md border border-border bg-background p-0.5 shadow-tw-2xs">
          {(['Day', 'Night'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={shiftTab === tab}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-black transition-colors',
                shiftTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
              onClick={() => onShiftTabChange(tab)}
              disabled={isPending}
              aria-label={`${tab} shift`}
            >
              {tab === 'Day' ? (
                <Sun className="h-3 w-3" aria-hidden />
              ) : (
                <Moon className="h-3 w-3" aria-hidden />
              )}
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {interactionMode.canUseManagerToolbar && !isPublished ? (
          <>
            {onAutoDraft ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-muted-foreground"
                onClick={onAutoDraft}
              >
                <Zap className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Auto-draft
              </Button>
            ) : null}
            {onPreFlight ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-muted-foreground"
                onClick={onPreFlight}
              >
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Pre-flight
              </Button>
            ) : null}
            {onSendPreliminary ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-muted-foreground"
                onClick={onSendPreliminary}
              >
                <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {preliminaryLabel}
              </Button>
            ) : null}
          </>
        ) : null}
        <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={onPrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Print
        </Button>
        {interactionMode.canUseManagerToolbar && !isPublished && onPublish ? (
          <Button size="sm" className="h-8 px-3 font-bold shadow-tw-sm" onClick={onPublish}>
            <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {publishLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
