'use client'

import { useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import type {
  ScheduleCode,
  ScheduleDataset,
  ScheduleDay,
  ScheduleRow,
} from '@/components/schedule-roster/mock-schedule-data'

const THERAPIST_COLUMN_WIDTH = 200
const MIN_DAY_COLUMN_WIDTH = 26
const IDEAL_DAY_COLUMN_WIDTH = 28
const MAX_DAY_COLUMN_WIDTH = 28
const WEEK_HEADER_HEIGHT = 40

type TableSizing = {
  dayColumnWidth: number
  overflowX: 'auto' | 'hidden'
  tableWidth: number
}

const CODE_PILL_CLASS_NAMES: Record<
  Extract<ScheduleCode, 'PTO' | 'OC' | 'CX' | 'CI' | 'LE' | 'N'>,
  string
> = {
  PTO: 'bg-[var(--success-subtle)] text-[var(--success-text)]',
  OC: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
  CX: 'bg-[var(--error-subtle)] text-[var(--error-text)]',
  CI: 'bg-[color:color-mix(in_srgb,var(--attention)_18%,white)] text-[color:color-mix(in_srgb,var(--foreground)_84%,var(--attention))]',
  LE: 'bg-[color:color-mix(in_srgb,var(--attention)_24%,white)] text-[color:color-mix(in_srgb,var(--foreground)_78%,var(--attention))]',
  N: 'bg-[color:color-mix(in_srgb,var(--primary)_14%,white)] text-primary',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function getTableSizing(containerWidth: number, totalDays: number): TableSizing {
  const minTableWidth = THERAPIST_COLUMN_WIDTH + MIN_DAY_COLUMN_WIDTH * totalDays
  const idealTableWidth = THERAPIST_COLUMN_WIDTH + IDEAL_DAY_COLUMN_WIDTH * totalDays

  if (containerWidth <= 0) {
    return {
      dayColumnWidth: IDEAL_DAY_COLUMN_WIDTH,
      overflowX: 'auto',
      tableWidth: idealTableWidth,
    }
  }

  if (containerWidth < minTableWidth) {
    return {
      dayColumnWidth: MIN_DAY_COLUMN_WIDTH,
      overflowX: 'auto',
      tableWidth: minTableWidth,
    }
  }

  const fittedDayWidth = Math.floor((containerWidth - THERAPIST_COLUMN_WIDTH) / totalDays)
  const dayColumnWidth = clamp(fittedDayWidth, MIN_DAY_COLUMN_WIDTH, MAX_DAY_COLUMN_WIDTH)
  const tableWidth = THERAPIST_COLUMN_WIDTH + dayColumnWidth * totalDays

  return {
    dayColumnWidth,
    overflowX: tableWidth > containerWidth ? 'auto' : 'hidden',
    tableWidth,
  }
}

function useAdaptiveTableSizing(totalDays: number) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [sizing, setSizing] = useState<TableSizing>(() =>
    getTableSizing(THERAPIST_COLUMN_WIDTH + IDEAL_DAY_COLUMN_WIDTH * totalDays, totalDays)
  )

  useLayoutEffect(() => {
    const node = scrollerRef.current
    if (!node) return

    const update = () => {
      const next = getTableSizing(Math.floor(node.clientWidth), totalDays)
      setSizing((prev) =>
        prev.dayColumnWidth === next.dayColumnWidth &&
        prev.overflowX === next.overflowX &&
        prev.tableWidth === next.tableWidth
          ? prev
          : next
      )
    }

    update()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => update())
    observer.observe(node)

    return () => observer.disconnect()
  }, [totalDays])

  return { scrollerRef, ...sizing }
}

function cellClass(day: ScheduleDay, emphasis?: 'count'): string {
  return cn(
    'border-b border-r border-border/80 text-center align-middle',
    day.isWeekend && (emphasis === 'count' ? 'bg-muted/22' : 'bg-muted/28'),
    weekDividerClass(day)
  )
}

function weekDividerClass(day: ScheduleDay): string {
  return day.weekIndex > 0 && day.isWeekStart ? 'border-l-2 border-l-border/90' : ''
}

function renderCellContent(code: ScheduleCode) {
  if (!code) {
    return <span className="text-transparent">.</span>
  }

  if (code === '1') {
    return <span className="text-[11px] font-medium text-foreground">1</span>
  }

  if (code === 'OFF') {
    return (
      <span className="text-[10px] font-semibold tracking-[0.01em] text-muted-foreground">OFF</span>
    )
  }

  if (code === '*') {
    return <span className="text-[12px] font-semibold text-foreground">*</span>
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-[18px] items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-semibold leading-none',
        CODE_PILL_CLASS_NAMES[code]
      )}
    >
      {code}
    </span>
  )
}

function renderRow(row: ScheduleRow, days: ScheduleDay[]) {
  return (
    <tr key={row.id} className="bg-white">
      <th
        scope="row"
        className="sticky left-0 z-20 border-b border-r border-border/80 bg-[#fcfbf8] px-4 py-1.5 text-left text-[13px] font-medium text-foreground shadow-[1px_0_0_0_rgba(0,0,0,0.04)]"
      >
        {row.name}
      </th>
      {days.map((day, index) => {
        const code = row.codes[index] ?? ''
        return (
          <td key={`${row.id}-${day.isoDate}`} className={cn(cellClass(day), 'px-0 py-1')}>
            {renderCellContent(code)}
          </td>
        )
      })}
    </tr>
  )
}

function renderCountRow(label: string, counts: number[], days: ScheduleDay[]) {
  return (
    <tr className="bg-white">
      <th className="sticky left-0 z-20 border-b border-r border-border/80 bg-[#fcfbf8] px-4 py-1.5 text-left text-[13px] font-semibold text-primary shadow-[1px_0_0_0_rgba(0,0,0,0.04)]">
        {label}
      </th>
      {counts.map((count, index) => {
        const day = days[index]
        return (
          <td
            key={`${label}-${day?.isoDate ?? index}`}
            className={cn(
              day ? cellClass(day, 'count') : '',
              'px-0 py-1 text-[11px] font-semibold text-foreground'
            )}
          >
            {count}
          </td>
        )
      })}
    </tr>
  )
}

export function PaperScheduleGrid({ dataset }: { dataset: ScheduleDataset }) {
  const days = dataset.weeks.flatMap((week) => week.days)
  const { dayColumnWidth, overflowX, scrollerRef, tableWidth } = useAdaptiveTableSizing(days.length)

  return (
    <div className="overflow-hidden rounded-[22px] border border-border/80 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
      <div ref={scrollerRef} className="overflow-y-hidden" style={{ overflowX }}>
        <table
          className="table-fixed border-separate border-spacing-0"
          style={{ width: tableWidth }}
        >
          <colgroup>
            <col style={{ width: THERAPIST_COLUMN_WIDTH }} />
            {days.map((day) => (
              <col key={`col-${day.isoDate}`} style={{ width: dayColumnWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-50 border-b border-r border-border/80 bg-[#fcfbf8] px-4 text-left text-[13px] font-semibold text-foreground shadow-[1px_0_0_0_rgba(0,0,0,0.04)]"
              >
                Therapist
              </th>
              {dataset.weeks.map((week, weekIndex) => (
                <th
                  key={week.id}
                  colSpan={week.days.length}
                  className={cn(
                    'sticky top-0 z-30 border-b border-r border-border/80 bg-white px-1 py-1.5 text-center text-[11px] font-semibold text-foreground',
                    weekIndex > 0 && 'border-l-2 border-l-border/90'
                  )}
                >
                  {week.label}
                </th>
              ))}
            </tr>
            <tr>
              {days.map((day) => (
                <th
                  key={`day-${day.isoDate}`}
                  style={{ top: WEEK_HEADER_HEIGHT }}
                  className={cn(
                    'sticky z-30 border-b border-r border-border/80 bg-white px-0 py-1 text-center',
                    day.isWeekend && 'bg-muted/30',
                    weekDividerClass(day)
                  )}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {day.dowLabel}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold leading-none text-foreground">
                    {day.dayNumber}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={days.length + 1}
                className="border-b border-border/80 bg-[#f5f2eb] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary/80"
              >
                Core staff
              </td>
            </tr>
            {dataset.coreRows.map((row) => renderRow(row, days))}
            {renderCountRow('Staffing Count', dataset.coreCounts, days)}
            <tr>
              <td colSpan={days.length + 1} className="h-2 bg-[#fbfaf7]" />
            </tr>
            <tr>
              <td
                colSpan={days.length + 1}
                className="border-y border-border/80 bg-[#f5f2eb] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary/80"
              >
                PRN / Extra staff
              </td>
            </tr>
            {dataset.prnRows.map((row) => renderRow(row, days))}
            {renderCountRow('Staffing Count', dataset.prnCounts, days)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
