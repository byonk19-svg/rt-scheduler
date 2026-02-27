'use client'

import { cn } from '@/lib/utils'
import {
  countActive,
  flatten,
  shouldShowMonthTag,
  type DayItem,
  type ShiftTab,
  type UiStatus,
} from '@/lib/coverage/selectors'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

type CalendarGridProps = {
  days: DayItem[]
  loading: boolean
  selectedId: string | null
  shiftTab: ShiftTab
  onTabSwitch: (tab: ShiftTab) => void
  onSelect: (id: string) => void
}

function formatMonthShort(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short' })
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ name, status }: { name: string; status: UiStatus }) {
  const bgClass =
    status === 'cancelled'
      ? 'bg-[#ef4444]'
      : status === 'oncall'
        ? 'bg-[#ea580c]'
        : 'bg-[#d97706]'

  return (
    <span
      title={name}
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded-full font-extrabold text-white',
        bgClass,
        'h-[14px] w-[14px] text-[5px]'
      )}
    >
      {initials(name)}
    </span>
  )
}

export function CalendarGrid({
  days,
  loading,
  selectedId,
  shiftTab,
  onTabSwitch,
  onSelect,
}: CalendarGridProps) {
  return (
    <>
      <div className="mb-4 flex gap-1">
        {(['Day', 'Night'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabSwitch(tab)}
            className={cn(
              'cursor-pointer rounded-[7px] border px-5 py-1.5 text-xs font-bold transition-all',
              shiftTab === tab
                ? 'border-[#d97706] bg-[#d97706] text-white'
                : 'border-[#e5e7eb] bg-white text-[#64748b]'
            )}
          >
            {tab} Shift
          </button>
        ))}
        <span className="ml-2 self-center text-xs font-medium text-[#9ca3af]">
          {shiftTab === 'Day' ? 'Day shift staff' : 'Night shift staff'}
        </span>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {DOW.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-extrabold tracking-[0.07em] text-slate-400"
          >
            {day}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">
          Loading schedule...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, index) => {
            const activeCount = countActive(day)
            const totalCount = flatten(day).length
            const missingLead = !day.leadShift
            const showMonthTag = shouldShowMonthTag(index, day.isoDate)

            return (
              <button
                key={day.id}
                type="button"
                onClick={() => onSelect(day.id)}
                className={cn(
                  'rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-amber-600',
                  selectedId === day.id &&
                    'border-[#d97706] shadow-[0_0_0_3px_rgba(217,119,6,0.15)]'
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-slate-900">{day.date}</span>
                    {showMonthTag && (
                      <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {formatMonthShort(day.isoDate)}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      missingLead
                        ? 'bg-[#fee2e2] text-[#dc2626]'
                        : 'bg-[#ecfdf5] text-[#047857]'
                    )}
                  >
                    {activeCount}/{totalCount}
                  </span>
                </div>

                <div className="mb-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                  {day.leadShift ? `Lead: ${day.leadShift.name.split(' ')[0]}` : 'No lead'}
                </div>

                {day.constraintBlocked && (
                  <div className="mb-1.5 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700">
                    No eligible therapists (constraints)
                  </div>
                )}

                <div className="flex flex-wrap gap-1">
                  {day.staffShifts.map((shift) => {
                    const tone =
                      shift.status === 'cancelled'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : shift.status === 'oncall'
                          ? 'border-orange-200 bg-orange-50 text-orange-700'
                          : shift.status === 'leave_early'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700'

                    return (
                      <span
                        key={shift.id}
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}
                      >
                        <Avatar name={shift.name} status={shift.status} />
                        <span className={shift.status === 'cancelled' ? 'line-through' : ''}>
                          {shift.name.split(' ')[0]}
                        </span>
                        {shift.status === 'oncall' && <span className="font-extrabold">OC</span>}
                        {shift.status === 'leave_early' && <span className="font-extrabold">LE</span>}
                        {shift.status === 'cancelled' && <span className="font-extrabold">X</span>}
                      </span>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
