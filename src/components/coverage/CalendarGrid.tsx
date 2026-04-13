'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
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
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'

const STAFF_PREVIEW_NARROW = 2

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
  const isNarrowViewport = useMediaQuery('(max-width: 767px)')
  const [expandedStaffByDay, setExpandedStaffByDay] = useState<Record<string, boolean>>({})
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const focusCell = useCallback((id: string) => {
    cellRefs.current.get(id)?.focus()
  }, [])
  const flatDayIds = useMemo(() => days.map((day) => day.id), [days])

  return (
    <div className="overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch]">
      <p className="mb-2 text-xs text-muted-foreground md:hidden" aria-hidden="true">
        Swipe sideways to see the full week row.
      </p>
      <div role="grid" aria-label="Coverage calendar" className="min-w-[980px]">
        <div className="mb-2 grid grid-cols-7 gap-3 border-y border-border bg-muted/25 py-2">
          {DOW.map((day) => (
            <div
              key={day}
              className="text-center text-[0.78rem] font-bold tracking-[0.12em] text-foreground/70 sm:text-[0.72rem]"
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
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground sm:text-[0.68rem]">
                    WEEK {weekIndex + 1}
                  </p>
                  <div className="h-px flex-1 bg-border/90" />
                </div>

                <div role="row" className="grid grid-cols-7 gap-2 sm:gap-2.5">
                  {week.map((day, dayOffset) => {
                    const absoluteIndex = weekIndex * 7 + dayOffset
                    const activeCount = countActive(day)
                    const threshold = headcountThreshold(activeCount)
                    const totalCount = flatten(day).length
                    const showMonthTag = shouldShowMonthTag(absoluteIndex, day.isoDate)
                    const cardTone = staffingCardTone(day, activeCount)
                    const showAttentionBadge = day.constraintBlocked
                    const staffShifts = day.staffShifts
                    const staffCollapsed =
                      isNarrowViewport &&
                      staffShifts.length > STAFF_PREVIEW_NARROW &&
                      !expandedStaffByDay[day.id]
                    const visibleStaff = staffCollapsed
                      ? staffShifts.slice(0, STAFF_PREVIEW_NARROW)
                      : staffShifts
                    const staffOverflow = staffShifts.length - STAFF_PREVIEW_NARROW

                    return (
                      <article
                        key={day.id}
                        role="gridcell"
                        data-testid={`coverage-day-panel-${day.id}`}
                        className={cn(
                          'relative min-h-[168px] rounded-[20px] border bg-card px-2.75 py-2.25 text-left shadow-tw-2xs transition-[border-color,box-shadow,transform] duration-200 sm:min-h-[156px]',
                          'hover:-translate-y-px hover:border-primary/35 hover:shadow-tw-day-hover',
                          cardTone === 'constraint' &&
                            'border-[var(--warning-border)] bg-[var(--warning-subtle)]/55 shadow-tw-day-warning',
                          cardTone === 'missing_lead' &&
                            'border-[var(--warning-border)]/85 bg-[var(--warning-subtle)]/42 shadow-tw-ring-attention',
                          cardTone === 'under' &&
                            'border-[var(--error-border)]/80 bg-[var(--error-subtle)]/45 shadow-tw-ring-error-soft',
                          cardTone === 'partial' &&
                            'border-[var(--warning-border)]/55 bg-[var(--warning-subtle)]/30',
                          cardTone === 'full' &&
                            'border-[var(--success-border)]/45 bg-[var(--success-subtle)]/35',
                          selectedId === day.id &&
                            'border-primary/60 shadow-tw-day-selected'
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
                          className="absolute inset-0 z-0 touch-manipulation rounded-[20px]"
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
                              <span className="rounded-xl border border-border bg-muted px-1.75 py-0.5 text-[0.62rem] font-semibold text-muted-foreground sm:text-[0.58rem]">
                                {formatMonthShort(day.isoDate)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={cn(
                                'min-w-[2.85rem] rounded-full px-2.5 py-1.5 text-center text-[0.74rem] font-extrabold leading-none tabular-nums shadow-tw-pill sm:text-[0.7rem]',
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
                              <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em] text-[var(--warning-text)] sm:text-[0.54rem]">
                                Needs attention
                              </span>
                            )}
                            {!day.constraintBlocked && !day.leadShift && (
                              <span className="rounded-full border border-[var(--warning-border)]/70 bg-[var(--warning-subtle)]/50 px-2 py-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.07em] text-[var(--warning-text)] sm:text-[0.52rem]">
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
                          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground/75 sm:text-[0.5rem]">
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
                                    'mt-0.5 inline-flex items-center gap-1.25 text-[0.72rem] font-semibold leading-tight sm:text-[0.68rem]',
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
                                  'pointer-events-auto mt-0.5 inline-flex items-center gap-1.25 text-[0.72rem] font-semibold leading-tight sm:text-[0.68rem]',
                                  isUnavailableStatus(day.leadShift.status) &&
                                    'line-through decoration-[var(--error-text)]/50'
                                )}
                              >
                                <span>{compactName(day.leadShift.name)}</span>
                                <StatusPill status={day.leadShift.status} />
                              </span>
                            )
                          ) : (
                            <p className="mt-0.5 text-[0.72rem] font-medium leading-tight text-[var(--warning-text)]/60 sm:text-[0.68rem]">
                              &mdash;
                            </p>
                          )}
                        </div>

                        {day.constraintBlocked && (
                          <div className="mt-1.75 rounded-[16px] border border-[var(--error-border)] bg-[var(--error-subtle)] px-2.75 py-1.5 text-[0.68rem] leading-tight text-[var(--error-text)] sm:text-[0.64rem]">
                            No eligible therapists (constraints)
                          </div>
                        )}

                        <div
                          className={cn(
                            'mt-1.5 space-y-0.5 border-t border-border/45 pt-1.5',
                            staffShifts.length > 0 &&
                              allowAssignmentStatusEdits &&
                              'pointer-events-auto'
                          )}
                        >
                          {visibleStaff.map((shift) => (
                            <div key={shift.id} className="flex items-center gap-1 text-[0.66rem] leading-snug sm:text-[0.62rem]">
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
                                      'inline-flex items-center gap-1 text-[0.66rem] text-muted-foreground/78 sm:text-[0.62rem]',
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
                                    'pointer-events-auto inline-flex items-center gap-1 text-[0.66rem] text-muted-foreground/78 sm:text-[0.62rem]',
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
                          {staffCollapsed && staffOverflow > 0 ? (
                            <button
                              type="button"
                              className="pointer-events-auto text-left text-[0.66rem] font-medium text-primary underline-offset-2 hover:underline sm:text-[0.62rem]"
                              aria-label={`Show ${staffOverflow} more staff on ${day.label}`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                setExpandedStaffByDay((prev) => ({ ...prev, [day.id]: true }))
                              }}
                            >
                              +{staffOverflow} more
                            </button>
                          ) : null}
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
