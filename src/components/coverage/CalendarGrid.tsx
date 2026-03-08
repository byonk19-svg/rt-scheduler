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
      ? 'bg-[var(--error)]'
      : status === 'oncall'
        ? 'bg-[var(--warning)]'
        : 'bg-[var(--attention)]'

  return (
    <span
      title={name}
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded-full font-extrabold text-white',
        bgClass,
        'h-4 w-4 text-[7px]'
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
            data-testid={`coverage-shift-tab-${tab.toLowerCase()}`}
            className={cn(
              'cursor-pointer rounded-[7px] border px-5 py-1.5 text-xs font-bold transition-all',
              shiftTab === tab
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground'
            )}
          >
            {tab} Shift
          </button>
        ))}
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[760px]">
          <div className="mb-1 grid grid-cols-7 gap-1.5">
            {DOW.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-extrabold tracking-[0.06em] text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="rounded-lg border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
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
                    data-testid={`coverage-day-cell-${day.id}`}
                    className={cn(
                      'rounded-lg border border-border bg-card p-2.5 text-left hover:border-primary',
                      selectedId === day.id &&
                        'border-primary shadow-[0_0_0_3px_rgba(6,103,169,0.15)]'
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-foreground">{day.date}</span>
                        {showMonthTag && (
                          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
                            {formatMonthShort(day.isoDate)}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-xs font-bold',
                          missingLead
                            ? 'bg-[var(--error-subtle)] text-[var(--error-text)]'
                            : 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                        )}
                      >
                        {activeCount}/{totalCount}
                      </span>
                    </div>

                    <div
                      className="mb-1.5 rounded border px-2 py-1 text-xs font-semibold"
                      style={{
                        borderColor: 'var(--warning-border)',
                        backgroundColor: 'var(--warning-subtle)',
                        color: 'var(--warning-text)',
                      }}
                    >
                      {day.leadShift ? `Lead: ${day.leadShift.name.split(' ')[0]}` : 'No lead'}
                    </div>

                    {day.constraintBlocked && (
                      <div
                        className="mb-1.5 rounded border px-2 py-1 text-xs font-medium"
                        style={{
                          borderColor: 'var(--error-border)',
                          backgroundColor: 'var(--error-subtle)',
                          color: 'var(--error-text)',
                        }}
                      >
                        No eligible therapists (constraints)
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {day.staffShifts.map((shift) => {
                        const tone =
                          shift.status === 'cancelled'
                            ? '[border-color:var(--error-border)] [background-color:var(--error-subtle)] [color:var(--error-text)]'
                            : shift.status === 'oncall'
                              ? '[border-color:var(--warning-border)] [background-color:var(--warning-subtle)] [color:var(--warning-text)]'
                              : shift.status === 'leave_early'
                                ? '[border-color:var(--info-border)] [background-color:var(--info-subtle)] [color:var(--info-text)]'
                                : 'border-border bg-muted text-foreground'

                        return (
                          <span
                            key={shift.id}
                            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-semibold ${tone}`}
                          >
                            <Avatar name={shift.name} status={shift.status} />
                            <span className={shift.status === 'cancelled' ? 'line-through' : ''}>
                              {shift.name.split(' ')[0]}
                            </span>
                            {shift.status === 'oncall' && <span className="font-extrabold">OC</span>}
                            {shift.status === 'leave_early' && (
                              <span className="font-extrabold">LE</span>
                            )}
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
        </div>
      </div>
    </>
  )
}
