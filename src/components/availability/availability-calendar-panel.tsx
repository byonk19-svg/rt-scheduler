'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  buildCalendarWeeks,
  formatDateLabel,
  formatMonthLabel,
  toIsoDate,
  toMonthEndKey,
} from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'

type AvailabilityCalendarPanelProps = {
  monthStart: string
  cycleStart: string
  cycleEnd: string
  selectedDates: string[]
  statusByDate?: Record<string, 'selected' | 'saved' | 'blocked'>
  onPreviousMonth: () => void
  onNextMonth: () => void
  onToggleDate: (date: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function AvailabilityCalendarPanel({
  monthStart,
  cycleStart,
  cycleEnd,
  selectedDates,
  statusByDate = {},
  onPreviousMonth,
  onNextMonth,
  onToggleDate,
}: AvailabilityCalendarPanelProps) {
  const calendarWeeks = buildCalendarWeeks(monthStart, toMonthEndKey(monthStart))
  const monthKey = monthStart.slice(0, 7)
  const selectedDateSet = new Set(selectedDates)

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onPreviousMonth}
          aria-label="Previous month"
          className="h-8 w-8 rounded-md border border-slate-200 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-bold tracking-[-0.01em] text-slate-800">
          {formatMonthLabel(monthStart)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onNextMonth}
          aria-label="Next month"
          className="h-8 w-8 rounded-md border border-slate-200 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day) => (
          <p key={day} className="text-center text-[11px] font-medium text-slate-500">
            {day.slice(0, 2)}
          </p>
        ))}
      </div>

      <div className="space-y-1.5">
        {calendarWeeks.map((week, weekIndex) => (
          <div key={`availability-week-${weekIndex}`} className="grid grid-cols-7 gap-1.5">
            {week.map((day) => {
              const dayKey = toIsoDate(day)
              const isCurrentMonth = dayKey.slice(0, 7) === monthKey
              const isInCycle = dayKey >= cycleStart && dayKey <= cycleEnd
              const isSelected = selectedDateSet.has(dayKey)
              const status = statusByDate[dayKey]

              return (
                <button
                  key={dayKey}
                  type="button"
                  aria-label={formatDateLabel(dayKey)}
                  data-selected={isSelected}
                  data-in-cycle={isInCycle}
                  data-status={status ?? 'idle'}
                  disabled={!isInCycle}
                  onClick={() => onToggleDate(dayKey)}
                  className={cn(
                    'flex h-11 items-center justify-center rounded-md text-sm transition-all',
                    !isCurrentMonth && 'text-slate-400',
                    isInCycle && !status && !isSelected && 'text-slate-700 hover:bg-slate-100',
                    !isInCycle && 'cursor-not-allowed text-slate-300 opacity-50',
                    status === 'saved' && 'bg-[#4ade80] font-bold text-white hover:bg-[#4ade80]',
                    status === 'blocked' && 'bg-[#f87171] font-bold text-white hover:bg-[#f87171]',
                    isSelected &&
                      'bg-[#2d5a5a] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
