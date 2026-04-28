'use client'

import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { ScheduleRosterLivePayload } from '@/app/(app)/schedule/schedule-roster-live-data'
import {
  getMockScheduleDataset,
  SCHEDULE_LEGEND,
  type ScheduleCode,
} from '@/components/schedule-roster/mock-schedule-data'
import { PaperScheduleGrid } from '@/components/schedule-roster/PaperScheduleGrid'
import { Button } from '@/components/ui/button'
import type { ShiftType } from '@/lib/mock-coverage-roster'
import { cn } from '@/lib/utils'

export type ScheduleRosterScreenProps = {
  live?: ScheduleRosterLivePayload
}

const CODE_BADGE_CLASS: Record<Exclude<ScheduleCode, ''>, string> = {
  '1': 'border border-border bg-background text-foreground',
  OFF: 'bg-muted text-muted-foreground',
  PTO: 'bg-[var(--success-subtle)] text-[var(--success-text)]',
  OC: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
  CX: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
  CI: 'bg-[color:color-mix(in_srgb,var(--attention)_18%,white)] text-[color:color-mix(in_srgb,var(--foreground)_84%,var(--attention))]',
  LE: 'bg-[color:color-mix(in_srgb,var(--attention)_24%,white)] text-[color:color-mix(in_srgb,var(--foreground)_78%,var(--attention))]',
  N: 'bg-[color:color-mix(in_srgb,var(--primary)_14%,white)] text-primary',
  '*': 'bg-background text-foreground',
}

const SHIFT_OPTIONS: Array<{ value: ShiftType; label: string }> = [
  { value: 'day', label: 'Day Shift' },
  { value: 'night', label: 'Night Shift' },
]

export function ScheduleRosterScreen({ live: _live }: ScheduleRosterScreenProps) {
  void _live
  const [selectedShift, setSelectedShift] = useState<ShiftType>('day')
  const dataset = useMemo(() => getMockScheduleDataset(selectedShift), [selectedShift])

  return (
    <div className="mx-auto flex w-full max-w-[1580px] flex-col px-2 py-2 sm:px-3 lg:px-5">
      <section className="overflow-hidden rounded-[26px] border border-border/70 bg-card shadow-[0_24px_64px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1.5">
              <h1 className="font-heading text-[1.75rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.9rem]">
                Respiratory Therapy - {selectedShift === 'day' ? 'Day' : 'Night'} Shift
              </h1>
              <p className="text-[13px] text-muted-foreground">{dataset.cycleLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <span className="inline-flex h-9 items-center rounded-lg bg-[color:color-mix(in_srgb,var(--attention)_14%,white)] px-2.5 text-[12px] font-semibold text-foreground">
                DRAFT
              </span>
              <span className="text-[13px] text-muted-foreground">Last saved: 2:04 PM</span>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 rounded-lg px-3 text-[14px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 rounded-lg px-3 text-[14px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                type="button"
                className="h-11 rounded-lg px-3.5 text-[14px] shadow-[0_1px_2px_rgba(15,23,42,0.16)]"
              >
                Publish
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 pt-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex h-12 items-center rounded-lg border border-border/70 bg-muted/35 p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-10 rounded-r-none border-r border-border/70 px-0 text-foreground/85"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 rounded-none px-3.5 text-[14px]"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-10 rounded-l-none border-l border-border/70 px-0 text-foreground/85"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 gap-2 rounded-lg px-3 text-[14px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                <CalendarDays className="h-4 w-4" />
                Go to Date
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 min-w-[124px] justify-between gap-2 rounded-lg px-3 text-[14px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              >
                6 Weeks
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            <div className="inline-flex h-[52px] items-center rounded-lg border border-border/70 bg-muted/35 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              {SHIFT_OPTIONS.map((option) => {
                const isActive = option.value === selectedShift
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedShift(option.value)}
                    className={cn(
                      'h-11 rounded-md px-3 text-[14px] font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(15,23,42,0.18)]'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <PaperScheduleGrid dataset={dataset} />

            <section
              id="schedule-legend"
              className="rounded-[16px] border border-border/75 bg-card px-3.5 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {SCHEDULE_LEGEND.map((item) => (
                    <div
                      key={item.code}
                      className="inline-flex items-center gap-1.5 text-[11px] text-foreground"
                    >
                      <span
                        className={cn(
                          'inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                          CODE_BADGE_CLASS[item.code]
                        )}
                      >
                        {item.code}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground xl:justify-end">
                  <span>* Click any cell to edit</span>
                  <span>Bold vertical lines separate weeks</span>
                  <span>Weekends shaded</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
