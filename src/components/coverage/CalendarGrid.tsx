'use client'

import { AlertTriangle } from 'lucide-react'

import {
  AssignmentStatusPopover,
  StatusPill,
} from '@/components/coverage/AssignmentStatusPopover'
import type { DayItem, UiStatus } from '@/lib/coverage/selectors'
import { countActive, flatten, headcountThreshold, shouldShowMonthTag } from '@/lib/coverage/selectors'
import { cn } from '@/lib/utils'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

type CalendarGridProps = {
  days: DayItem[]
  loading: boolean
  selectedId: string | null
  /** When false, day cell uses a "view" aria label (no staffing edits). */
  schedulingViewOnly?: boolean
  /** When false, assignment status chips are display-only (no status popover). */
  allowAssignmentStatusEdits?: boolean
  onSelect: (id: string) => void
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}

function formatMonthShort(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short' })
}

function compactName(value: string): string {
  return value.trim().split(/\s+/)[0] ?? value
}

function chunkWeeks(days: DayItem[]): DayItem[][] {
  const weeks: DayItem[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }
  return weeks
}

function isUnavailableStatus(status: UiStatus): boolean {
  return status === 'cancelled' || status === 'call_in'
}

export function CalendarGrid({
  days,
  loading,
  selectedId,
  schedulingViewOnly = false,
  allowAssignmentStatusEdits = true,
  onSelect,
  onChangeStatus,
}: CalendarGridProps) {
  const weeks = chunkWeeks(days)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[980px]">
        <div className="mb-2.5 grid grid-cols-7 gap-3 border-y border-border/80 py-2.25">
          {DOW.map((day) => (
            <div
              key={day}
              className="text-center text-[0.68rem] font-semibold tracking-[0.1em] text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            Loading schedule...
          </div>
        ) : (
          <div className="space-y-4.5">
            {weeks.map((week, weekIndex) => (
              <section key={`week-${weekIndex}`} className="space-y-1.75">
                <div className="flex items-center gap-2">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                    WEEK {weekIndex + 1}
                  </p>
                  <div className="h-px flex-1 bg-border/90" />
                </div>

                <div className="grid grid-cols-7 gap-2.5">
                  {week.map((day, dayOffset) => {
                    const absoluteIndex = weekIndex * 7 + dayOffset
                    const activeCount = countActive(day)
                    const threshold = headcountThreshold(activeCount)
                    const totalCount = flatten(day).length
                    const showMonthTag = shouldShowMonthTag(absoluteIndex, day.isoDate)
                    const missingLead = !day.leadShift
                    const hasCoverageIssue = missingLead || day.constraintBlocked

                    return (
                      <article
                        key={day.id}
                        data-testid={`coverage-day-panel-${day.id}`}
                        className={cn(
                          'relative min-h-[156px] rounded-[20px] border border-border/80 bg-card px-2.75 py-2.25 text-left shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-[border-color,box-shadow,transform] duration-200',
                          'hover:-translate-y-px hover:border-primary/35 hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.42)]',
                          hasCoverageIssue &&
                            'border-[var(--warning-border)] bg-[var(--warning-subtle)]/35 shadow-[0_1px_0_rgba(15,23,42,0.02),0_0_0_1px_var(--warning-border)]',
                          selectedId === day.id &&
                            'border-primary/60 shadow-[0_0_0_1px_rgba(6,103,169,0.3),0_18px_36px_-30px_rgba(6,103,169,0.4)]'
                        )}
                      >
                        <button
                          type="button"
                          tabIndex={0}
                          data-testid={`coverage-day-cell-button-${day.id}`}
                          aria-label={`${schedulingViewOnly ? 'View' : 'Edit'} ${day.label}`}
                          className="absolute inset-0 rounded-[20px]"
                          onClick={() => onSelect(day.id)}
                        />

                        <div className="pointer-events-none relative z-10">
                        <div className="flex items-start justify-between gap-2">
                          <div className="inline-flex items-center gap-2">
                            <span className="text-[1.26rem] font-bold leading-none tracking-[-0.04em] text-foreground">
                              {day.date}
                            </span>
                            {showMonthTag && (
                              <span className="rounded-xl border border-border bg-muted px-1.75 py-0.5 text-[0.58rem] font-semibold text-muted-foreground">
                                {formatMonthShort(day.isoDate)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[0.62rem] font-bold leading-none',
                                threshold === 'red'    && 'bg-[var(--error-subtle)] text-[var(--error-text)]',
                                threshold === 'yellow' && 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
                                threshold === 'green'  && 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                              )}
                            >
                              {activeCount}/{totalCount}
                            </span>
                            {hasCoverageIssue && (
                              <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[0.54rem] font-semibold uppercase tracking-[0.08em] text-[var(--warning-text)]">
                                Needs attention
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          className={cn(
                            'mt-1.75 rounded-[16px] border px-2.75 py-1.5',
                            day.leadShift
                              ? 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
                              : 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
                          )}
                        >
                          <p className="text-[0.52rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                            LEAD
                          </p>
                          {day.leadShift ? (
                            allowAssignmentStatusEdits ? (
                              <AssignmentStatusPopover
                                therapistName={day.leadShift.name}
                                currentStatus={day.leadShift.status}
                                isLead
                                triggerTestId={`coverage-assignment-trigger-${day.id}-${day.leadShift.userId}`}
                                onChangeStatus={(nextStatus) =>
                                  onChangeStatus(day.id, day.leadShift!.id, true, nextStatus)
                                }
                              >
                                <span
                                  className={cn(
                                    'mt-0.5 inline-flex items-center gap-1.25 text-[0.68rem] font-semibold leading-tight',
                                    isUnavailableStatus(day.leadShift.status) &&
                                      'line-through decoration-[var(--error-text)]/50'
                                  )}
                                >
                                  <span>{compactName(day.leadShift.name)}</span>
                                  <StatusPill status={day.leadShift.status} />
                                </span>
                              </AssignmentStatusPopover>
                            ) : (
                              <span
                                className={cn(
                                  'pointer-events-auto mt-0.5 inline-flex items-center gap-1.25 text-[0.68rem] font-semibold leading-tight',
                                  isUnavailableStatus(day.leadShift.status) &&
                                    'line-through decoration-[var(--error-text)]/50'
                                )}
                              >
                                <span>{compactName(day.leadShift.name)}</span>
                                <StatusPill status={day.leadShift.status} />
                              </span>
                            )
                          ) : (
                            <p className="mt-0.5 text-[0.68rem] font-semibold leading-tight">
                              No lead assigned
                            </p>
                          )}
                        </div>

                        {day.constraintBlocked && (
                          <div className="mt-1.75 rounded-[16px] border border-[var(--error-border)] bg-[var(--error-subtle)] px-2.75 py-1.5 text-[0.64rem] leading-tight text-[var(--error-text)]">
                            No eligible therapists (constraints)
                          </div>
                        )}

                        <div className="mt-2 space-y-1">
                          {day.staffShifts.map((shift) => (
                            <div key={shift.id} className="flex items-center gap-1 text-[0.66rem]">
                              {allowAssignmentStatusEdits ? (
                                <AssignmentStatusPopover
                                  therapistName={shift.name}
                                  currentStatus={shift.status}
                                  triggerTestId={`coverage-assignment-trigger-${day.id}-${shift.userId}`}
                                  onChangeStatus={(nextStatus) =>
                                    onChangeStatus(day.id, shift.id, false, nextStatus)
                                  }
                                >
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 text-[0.66rem] text-muted-foreground/90',
                                      isUnavailableStatus(shift.status) &&
                                        'line-through decoration-[var(--error-text)]/50'
                                    )}
                                  >
                                    <span>{compactName(shift.name)}</span>
                                    <StatusPill status={shift.status} />
                                  </span>
                                </AssignmentStatusPopover>
                              ) : (
                                <span
                                  className={cn(
                                    'pointer-events-auto inline-flex items-center gap-1 text-[0.66rem] text-muted-foreground/90',
                                    isUnavailableStatus(shift.status) &&
                                      'line-through decoration-[var(--error-text)]/50'
                                  )}
                                >
                                  <span>{compactName(shift.name)}</span>
                                  <StatusPill status={shift.status} />
                                </span>
                              )}
                              {shift.status === 'leave_early' && (
                                <AlertTriangle className="h-4 w-4 text-[var(--warning-text)]" aria-hidden="true" />
                              )}
                            </div>
                          ))}
                        </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
