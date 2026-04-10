'use client'

import { useCallback, useMemo, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

import {
  AssignmentStatusPopover,
  StatusPill,
} from '@/components/coverage/AssignmentStatusPopover'
import type { DayItem, UiStatus } from '@/lib/coverage/selectors'
import {
  countActive,
  flatten,
  headcountThreshold,
  shouldShowMonthTag,
} from '@/lib/coverage/selectors'
import { cn } from '@/lib/utils'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function nextIndex(current: number, key: string, total: number): number {
  const cols = 7

  switch (key) {
    case 'ArrowRight':
      return Math.min(current + 1, total - 1)
    case 'ArrowLeft':
      return Math.max(current - 1, 0)
    case 'ArrowDown':
      return Math.min(current + cols, total - 1)
    case 'ArrowUp':
      return Math.max(current - cols, 0)
    default:
      return current
  }
}

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

type StaffingCardTone = 'constraint' | 'missing_lead' | 'under' | 'partial' | 'full'

function staffingCardTone(day: DayItem, activeCount: number): StaffingCardTone {
  if (day.constraintBlocked) return 'constraint'
  if (!day.leadShift) return 'missing_lead'
  const t = headcountThreshold(activeCount)
  if (t === 'red') return 'under'
  if (t === 'yellow') return 'partial'
  return 'full'
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
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const focusCell = useCallback((id: string) => {
    cellRefs.current.get(id)?.focus()
  }, [])
  const flatDayIds = useMemo(() => days.map((day) => day.id), [days])

  return (
    <div role="grid" aria-label="Coverage calendar" className="overflow-x-auto pb-2">
      <div className="min-w-[980px]">
        <div className="mb-2 grid grid-cols-7 gap-3 border-y border-border bg-muted/25 py-2">
          {DOW.map((day) => (
            <div
              key={day}
              className="text-center text-[0.72rem] font-bold tracking-[0.12em] text-foreground/70"
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

                <div role="row" className="grid grid-cols-7 gap-2.5">
                  {week.map((day, dayOffset) => {
                    const absoluteIndex = weekIndex * 7 + dayOffset
                    const activeCount = countActive(day)
                    const threshold = headcountThreshold(activeCount)
                    const totalCount = flatten(day).length
                    const showMonthTag = shouldShowMonthTag(absoluteIndex, day.isoDate)
                    const cardTone = staffingCardTone(day, activeCount)
                    const showAttentionBadge = day.constraintBlocked

                    return (
                      <article
                        key={day.id}
                        role="gridcell"
                        data-testid={`coverage-day-panel-${day.id}`}
                        className={cn(
                          'relative min-h-[156px] rounded-[20px] border bg-card px-2.75 py-2.25 text-left shadow-[0_1px_0_rgba(15,23,42,0.02)] transition-[border-color,box-shadow,transform] duration-200',
                          'hover:-translate-y-px hover:border-primary/35 hover:shadow-[0_18px_36px_-28px_rgba(15,23,42,0.42)]',
                          cardTone === 'constraint' &&
                            'border-[var(--warning-border)] bg-[var(--warning-subtle)]/35 shadow-[0_1px_0_rgba(15,23,42,0.02),0_0_0_1px_var(--warning-border)]',
                          cardTone === 'missing_lead' &&
                            'border-[var(--warning-border)]/85 bg-[var(--warning-subtle)]/28 shadow-[0_0_0_1px_rgba(217,119,6,0.12)]',
                          cardTone === 'under' &&
                            'border-[var(--error-border)]/80 bg-[var(--error-subtle)]/25 shadow-[0_0_0_1px_rgba(220,38,38,0.08)]',
                          cardTone === 'partial' &&
                            'border-[var(--warning-border)]/55 bg-[var(--warning-subtle)]/16',
                          cardTone === 'full' &&
                            'border-[var(--success-border)]/45 bg-[var(--success-subtle)]/14',
                          selectedId === day.id &&
                            'border-primary/60 shadow-[0_0_0_1px_rgba(6,103,169,0.3),0_18px_36px_-30px_rgba(6,103,169,0.4)]'
                        )}
                      >
                        <button
                          type="button"
                          ref={(element) => {
                            if (element) {
                              cellRefs.current.set(day.id, element)
                              return
                            }
                            cellRefs.current.delete(day.id)
                          }}
                          tabIndex={absoluteIndex === 0 ? 0 : -1}
                          data-testid={`coverage-day-cell-button-${day.id}`}
                          aria-label={`${schedulingViewOnly ? 'View' : 'Edit'} ${day.label}`}
                          className="absolute inset-0 z-0 rounded-[20px]"
                          onClick={() => onSelect(day.id)}
                          onKeyDown={(event) => {
                            if (
                              !['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(
                                event.key
                              )
                            ) {
                              return
                            }
                            event.preventDefault()
                            const next = nextIndex(absoluteIndex, event.key, flatDayIds.length)
                            focusCell(flatDayIds[next])
                          }}
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
                                'min-w-[2.85rem] rounded-full px-2.5 py-1.5 text-center text-[0.7rem] font-extrabold leading-none tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
                                threshold === 'red' &&
                                  'bg-[var(--error-subtle)] text-[var(--error-text)] ring-2 ring-[var(--error-border)]/50',
                                threshold === 'yellow' &&
                                  'bg-[var(--warning-subtle)] text-[var(--warning-text)] ring-2 ring-[var(--warning-border)]/55',
                                threshold === 'green' &&
                                  'bg-[var(--success-subtle)]/95 text-[var(--success-text)] ring-2 ring-[var(--success-border)]/50'
                              )}
                            >
                              {activeCount}/{totalCount}
                            </span>
                            {showAttentionBadge && (
                              <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[0.54rem] font-semibold uppercase tracking-[0.08em] text-[var(--warning-text)]">
                                Needs attention
                              </span>
                            )}
                            {!day.constraintBlocked && !day.leadShift && (
                              <span className="rounded-full border border-[var(--warning-border)]/70 bg-[var(--warning-subtle)]/50 px-2 py-0.5 text-[0.52rem] font-semibold uppercase tracking-[0.07em] text-[var(--warning-text)]">
                                No lead
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          className={cn(
                            'mt-1.5 rounded-xl border px-1.75 py-1',
                            day.leadShift && allowAssignmentStatusEdits && 'pointer-events-auto',
                            day.leadShift
                              ? 'border-[var(--info-border)]/40 bg-[var(--info-subtle)]/22 text-[var(--info-text)]'
                              : 'border-[var(--warning-border)]/55 bg-[var(--warning-subtle)]/18 text-[var(--warning-text)]'
                          )}
                        >
                          <p className="text-[0.5rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground/75">
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
                            <p className="mt-0.5 text-[0.68rem] font-medium leading-tight text-[var(--warning-text)]/60">
                              &mdash;
                            </p>
                          )}
                        </div>

                        {day.constraintBlocked && (
                          <div className="mt-1.75 rounded-[16px] border border-[var(--error-border)] bg-[var(--error-subtle)] px-2.75 py-1.5 text-[0.64rem] leading-tight text-[var(--error-text)]">
                            No eligible therapists (constraints)
                          </div>
                        )}

                        <div
                          className={cn(
                            'mt-1.5 space-y-0.5 border-t border-border/45 pt-1.5',
                            day.staffShifts.length > 0 &&
                              allowAssignmentStatusEdits &&
                              'pointer-events-auto'
                          )}
                        >
                          {day.staffShifts.map((shift) => (
                            <div key={shift.id} className="flex items-center gap-1 text-[0.62rem] leading-snug">
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
                                      'inline-flex items-center gap-1 text-[0.62rem] text-muted-foreground/78',
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
                                    'pointer-events-auto inline-flex items-center gap-1 text-[0.62rem] text-muted-foreground/78',
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
