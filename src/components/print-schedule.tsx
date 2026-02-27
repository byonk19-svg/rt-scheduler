'use client'

import { useSyncExternalStore } from 'react'
import type { ShiftStatus } from '@/app/schedule/types'
import { formatDayNumber, formatWeekdayShort } from '@/lib/schedule-helpers'

type Therapist = {
  id: string
  full_name: string
  shift_type?: 'day' | 'night'
  employment_type?: 'full_time' | 'part_time' | 'prn'
}

type PrintScheduleProps = {
  activeCycle: {
    label: string
    start_date: string
    end_date: string
  } | null
  cycleDates: string[]
  dayTeam: Therapist[]
  nightTeam: Therapist[]
  printUsers: Therapist[]
  shiftByUserDate: Record<string, ShiftStatus>
  isManager: boolean
}

const PRINT_SYMBOL_BY_STATUS: Record<ShiftStatus, string> = {
  scheduled: '1',
  on_call: '*',
  sick: 'S',
  called_off: 'X',
}

function formatRangeDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatMonthSpan(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Cycle'
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  return startMonth === endMonth ? startMonth : `${startMonth}-${endMonth}`
}

function getWeekBoundaryClass(index: number, total: number): string {
  if (index % 7 === 6 && index < total - 1) return 'print-lottery-week-end'
  return ''
}

function getPrintSymbol(
  shiftByUserDate: Record<string, ShiftStatus>,
  userId: string,
  date: string
): string {
  const status = shiftByUserDate[`${userId}:${date}`]
  if (!status) return ''
  return PRINT_SYMBOL_BY_STATUS[status] ?? ''
}

function countCoveredMembers(
  members: Therapist[],
  date: string,
  shiftByUserDate: Record<string, ShiftStatus>
): string {
  let count = 0
  for (const member of members) {
    const status = shiftByUserDate[`${member.id}:${date}`]
    if (status === 'scheduled' || status === 'on_call') {
      count += 1
    }
  }
  return count > 0 ? String(count) : ''
}

function ScheduleSection({
  label,
  members,
  cycleDates,
  shiftByUserDate,
  monthSpanLabel,
  dateRangeLabel,
}: {
  label: 'Days' | 'Nights'
  members: Therapist[]
  cycleDates: string[]
  shiftByUserDate: Record<string, ShiftStatus>
  monthSpanLabel: string
  dateRangeLabel: string
}) {
  const regularMembers = members.filter((member) => member.employment_type !== 'prn')
  const prnMembers = members.filter((member) => member.employment_type === 'prn')
  const tableMembers = [...regularMembers, ...prnMembers]
  if (tableMembers.length === 0) return null

  return (
    <section className="print-shift-sheet print-lottery-section">
      <header className="print-lottery-header print-lottery-shift-header">
        <h1>Respiratory Therapy {label} Shift</h1>
        <p>{dateRangeLabel}</p>
      </header>
      <table className="print-lottery-table">
        <thead>
          <tr className="print-lottery-header-row">
            <th className="print-lottery-name-col print-lottery-section-cell"></th>
            {cycleDates.map((date, index) => (
              <th
                key={`${label}-weekday-${date}`}
                className={getWeekBoundaryClass(index, cycleDates.length)}
              >
                {formatWeekdayShort(date)}
              </th>
            ))}
          </tr>
          <tr className="print-lottery-header-row">
            <th className="print-lottery-name-col print-lottery-month-cell">{monthSpanLabel}</th>
            {cycleDates.map((date, index) => (
              <th
                key={`${label}-daynum-${date}`}
                className={getWeekBoundaryClass(index, cycleDates.length)}
              >
                {formatDayNumber(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {regularMembers.map((member) => (
            <tr key={`${label}-${member.id}`}>
              <td className="print-lottery-name-col">{member.full_name}</td>
              {cycleDates.map((date, index) => (
                <td
                  key={`${label}-${member.id}-${date}`}
                  className={getWeekBoundaryClass(index, cycleDates.length)}
                >
                  {getPrintSymbol(shiftByUserDate, member.id, date)}
                </td>
              ))}
            </tr>
          ))}
          {prnMembers.length > 0 && (
            <tr className="print-prn-divider-row">
              <td className="print-lottery-name-col print-prn-divider-label">PRN</td>
              {cycleDates.map((date, index) => (
                <td key={`${label}-prn-divider-${date}`} className={getWeekBoundaryClass(index, cycleDates.length)} />
              ))}
            </tr>
          )}
          {prnMembers.map((member) => (
            <tr key={`${label}-${member.id}`}>
              <td className="print-lottery-name-col">{member.full_name}</td>
              {cycleDates.map((date, index) => (
                <td
                  key={`${label}-${member.id}-${date}`}
                  className={getWeekBoundaryClass(index, cycleDates.length)}
                >
                  {getPrintSymbol(shiftByUserDate, member.id, date)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="print-lottery-total-row">
            <td className="print-lottery-name-col">Total</td>
            {cycleDates.map((date, index) => (
              <td key={`${label}-total-${date}`} className={getWeekBoundaryClass(index, cycleDates.length)}>
                {countCoveredMembers(tableMembers, date, shiftByUserDate)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  )
}

export function PrintSchedule({
  activeCycle,
  cycleDates,
  dayTeam,
  nightTeam,
  printUsers,
  shiftByUserDate,
  isManager,
}: PrintScheduleProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted) return null

  const printDayTeam = isManager ? dayTeam : printUsers.filter((member) => member.shift_type === 'day')
  const printNightTeam = isManager ? nightTeam : printUsers.filter((member) => member.shift_type === 'night')
  const dateRangeLabel = activeCycle
    ? `${formatRangeDate(activeCycle.start_date)} - ${formatRangeDate(activeCycle.end_date)}`
    : ''

  return (
    <div className="print-only print-page print-lottery-page">
      {activeCycle ? (
        <>
          <div className="print-lottery-sections">
            <ScheduleSection
              label="Days"
              members={printDayTeam}
              cycleDates={cycleDates}
              shiftByUserDate={shiftByUserDate}
              monthSpanLabel={formatMonthSpan(activeCycle.start_date, activeCycle.end_date)}
              dateRangeLabel={dateRangeLabel}
            />
            <ScheduleSection
              label="Nights"
              members={printNightTeam}
              cycleDates={cycleDates}
              shiftByUserDate={shiftByUserDate}
              monthSpanLabel={formatMonthSpan(activeCycle.start_date, activeCycle.end_date)}
              dateRangeLabel={dateRangeLabel}
            />
          </div>

          <p className="print-lottery-legend">
            {dateRangeLabel} | Legend: 1 = scheduled, * = on call, S = sick, X = called off
          </p>
        </>
      ) : (
        <p>No schedule cycle selected for printing.</p>
      )}
    </div>
  )
}
