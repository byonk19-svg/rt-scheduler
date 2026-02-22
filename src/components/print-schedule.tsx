'use client'

import { useSyncExternalStore } from 'react'
import type { ShiftStatus } from '@/app/schedule/types'
import { formatDayNumber, formatWeekdayShort, getPrintShiftCode } from '@/lib/schedule-helpers'

type Therapist = {
  id: string
  full_name: string
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
  coverageTotalsByDate: Record<string, number>
  isManager: boolean
}

export function PrintSchedule({
  activeCycle,
  cycleDates,
  dayTeam,
  nightTeam,
  printUsers,
  shiftByUserDate,
  coverageTotalsByDate,
  isManager,
}: PrintScheduleProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted) return null

  return (
    <div className="print-only print-page">
      {activeCycle ? (
        <div className="space-y-2">
          <div className="text-center">
            <h1 className="text-xl font-bold">Teamwise Scheduling</h1>
            <p className="text-sm">
              Final Schedule: {activeCycle.label} ({activeCycle.start_date} to {activeCycle.end_date})
            </p>
          </div>

          <table className="print-matrix">
            <thead>
              <tr>
                <th>Name</th>
                {cycleDates.map((date) => (
                  <th key={`day-number-${date}`}>{formatDayNumber(date)}</th>
                ))}
              </tr>
              <tr>
                <th>Shift</th>
                {cycleDates.map((date) => (
                  <th key={`day-week-${date}`}>{formatWeekdayShort(date)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isManager && dayTeam.length > 0 && (
                <tr className="print-shift-header">
                  <td colSpan={cycleDates.length + 1}>Day Shift Team</td>
                </tr>
              )}
              {(isManager ? dayTeam : printUsers).map((member) => (
                <tr key={`day-${member.id}`}>
                  <td>{member.full_name}</td>
                  {cycleDates.map((date) => {
                    const status = shiftByUserDate[`${member.id}:${date}`]
                    return <td key={`${member.id}-${date}`}>{status ? getPrintShiftCode(status) : ''}</td>
                  })}
                </tr>
              ))}

              {isManager && nightTeam.length > 0 && (
                <tr className="print-shift-header">
                  <td colSpan={cycleDates.length + 1}>Night Shift Team</td>
                </tr>
              )}
              {isManager &&
                nightTeam.map((member) => (
                  <tr key={`night-${member.id}`}>
                    <td>{member.full_name}</td>
                    {cycleDates.map((date) => {
                      const status = shiftByUserDate[`${member.id}:${date}`]
                      return <td key={`${member.id}-${date}`}>{status ? getPrintShiftCode(status) : ''}</td>
                    })}
                  </tr>
                ))}

              {isManager && (
                <tr>
                  <td>Total Coverage</td>
                  {cycleDates.map((date) => (
                    <td key={`total-${date}`}>{coverageTotalsByDate[date] ?? 0}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>

          <p className="text-center text-xs">Codes: 1 = scheduled, OC = on call, S = sick, OFF = called off</p>
        </div>
      ) : (
        <p>No schedule cycle selected for printing.</p>
      )}
    </div>
  )
}
