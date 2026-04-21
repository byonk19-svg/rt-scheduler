'use client'

import type { MouseEvent, RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { formatEmployeeDate, isDateWithinCycle } from '@/lib/employee-directory'
import { toIsoDate } from '@/lib/calendar-utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type EmployeeCycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
}

export function EmployeeOverrideCalendar({
  calendarRef,
  canGoNextMonth,
  canGoPrevMonth,
  onCalendarDayMouseDown,
  onCalendarDayMouseEnter,
  onCalendarDayTouchStart,
  onClearSelectedDates,
  onShowNextMonth,
  onShowPreviousMonth,
  overrideCalendarMonthKey,
  overrideCalendarTitle,
  overrideCalendarWeeks,
  overrideDatesDraft,
  selectedOverrideCycle,
  selectedOverrideDatesSet,
  weekdayOptions,
}: {
  calendarRef: RefObject<HTMLDivElement | null>
  canGoNextMonth: boolean
  canGoPrevMonth: boolean
  onCalendarDayMouseDown: (event: MouseEvent<HTMLButtonElement>, dateValue: string) => void
  onCalendarDayMouseEnter: (dateValue: string) => void
  onCalendarDayTouchStart: (dateValue: string) => void
  onClearSelectedDates: () => void
  onShowNextMonth: () => void
  onShowPreviousMonth: () => void
  overrideCalendarMonthKey: string
  overrideCalendarTitle: string
  overrideCalendarWeeks: Date[][]
  overrideDatesDraft: string[]
  selectedOverrideCycle: EmployeeCycle | null
  selectedOverrideDatesSet: Set<string>
  weekdayOptions: Array<{ value: number; label: string }>
}) {
  return (
    <div className="space-y-2 md:col-span-12">
      <div className="flex items-center justify-between gap-2">
        <Label>Calendar multi-select</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelectedDates}
          disabled={overrideDatesDraft.length === 0}
        >
          Clear selected
        </Button>
      </div>
      <div className="rounded-md border border-border bg-background p-2">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canGoPrevMonth}
            onClick={onShowPreviousMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium">{overrideCalendarTitle}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canGoNextMonth}
            onClick={onShowNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {weekdayOptions.map((day) => (
            <p
              key={`override-weekday-${day.value}`}
              className="text-center text-[11px] font-medium text-muted-foreground"
            >
              {day.label}
            </p>
          ))}
        </div>
        <div className="touch-none space-y-1" ref={calendarRef}>
          {overrideCalendarWeeks.map((week, weekIndex) => (
            <div key={`override-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const dayKey = toIsoDate(day)
                const isCurrentMonth = dayKey.slice(0, 7) === overrideCalendarMonthKey
                const isInCycle = isDateWithinCycle(dayKey, selectedOverrideCycle)
                const isSelected = selectedOverrideDatesSet.has(dayKey)
                return (
                  <button
                    key={dayKey}
                    type="button"
                    data-date={dayKey}
                    disabled={!isInCycle}
                    onMouseDown={(event) => onCalendarDayMouseDown(event, dayKey)}
                    onMouseEnter={() => onCalendarDayMouseEnter(dayKey)}
                    onTouchStart={(event) => {
                      event.preventDefault()
                      onCalendarDayTouchStart(dayKey)
                    }}
                    className={cn(
                      'h-8 rounded-md text-xs transition-colors',
                      isSelected
                        ? 'bg-[var(--warning)] font-semibold text-foreground hover:bg-[var(--warning-text)] hover:text-primary-foreground'
                        : 'bg-background',
                      !isSelected && isInCycle && 'hover:bg-secondary',
                      !isCurrentMonth && !isSelected && 'text-muted-foreground',
                      !isInCycle && 'cursor-not-allowed opacity-35'
                    )}
                    title={isInCycle ? formatEmployeeDate(dayKey) : 'Outside selected cycle'}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Click days to toggle selection. Click and drag across days to select quickly.
      </p>
    </div>
  )
}
