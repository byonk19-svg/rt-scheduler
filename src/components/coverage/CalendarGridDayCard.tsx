'use client'

import { AlertTriangle, ArrowUpRight } from 'lucide-react'

import {
  AssignmentStatusPopover,
  StatusPill,
} from '@/components/coverage/AssignmentStatusPopover'
import type { DayItem, ShiftItem, UiStatus } from '@/lib/coverage/selectors'
import { countActive, headcountThreshold, shouldShowMonthTag } from '@/lib/coverage/selectors'
import { cn } from '@/lib/utils'

const TARGET_HEADCOUNT = 4

const STATUS_TOKEN_BY_UI_STATUS: Record<UiStatus, string> = {
  active: '1',
  oncall: 'OC',
  leave_early: 'LE',
  cancelled: 'CX',
  call_in: 'CI',
}

type CellTone = 'critical' | 'warning' | 'healthy' | 'empty'

function formatMonthShort(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short' })
}

function compactName(value: string): string {
  return value.trim().split(/\s+/)[0] ?? value
}

function statusToken(status: UiStatus | undefined): string {
  if (!status) return ''
  return STATUS_TOKEN_BY_UI_STATUS[status]
}

function isUnavailableStatus(status: UiStatus): boolean {
  return status === 'cancelled' || status === 'call_in'
}

function resolveCellTone(day: DayItem, activeCount: number): CellTone {
  if (day.constraintBlocked) return 'critical'
  if (!day.leadShift) return activeCount > 0 ? 'warning' : 'critical'
  const threshold = headcountThreshold(activeCount)
  if (threshold === 'green') return 'healthy'
  if (threshold === 'yellow') return 'warning'
  return activeCount === 0 ? 'empty' : 'critical'
}

function buildCoverageLabel(day: DayItem, activeCount: number): string {
  if (day.constraintBlocked) return 'No eligible therapists'
  if (!day.leadShift) return 'No lead'
  if (activeCount === 0) return 'Untouched'

  const openSlots = Math.max(TARGET_HEADCOUNT - activeCount, 0)
  if (openSlots > 0) {
    return `${openSlots} ${openSlots === 1 ? 'gap' : 'gaps'}`
  }

  return 'Set'
}

function cellToneClassName(tone: CellTone): string {
  switch (tone) {
    case 'critical':
      return 'border-[var(--error-border)]/75 bg-[var(--error-subtle)]/40'
    case 'warning':
      return 'border-[var(--warning-border)]/70 bg-[var(--warning-subtle)]/28'
    case 'healthy':
      return 'border-[var(--success-border)]/50 bg-[var(--success-subtle)]/30'
    case 'empty':
    default:
      return 'border-border/70 bg-card'
  }
}

function badgeToneClassName(tone: CellTone): string {
  switch (tone) {
    case 'critical':
      return 'bg-[var(--error-subtle)] text-[var(--error-text)]'
    case 'warning':
      return 'bg-[var(--warning-subtle)] text-[var(--warning-text)]'
    case 'healthy':
      return 'bg-[var(--success-subtle)] text-[var(--success-text)]'
    case 'empty':
    default:
      return 'bg-muted/60 text-foreground/75'
  }
}

function renderShiftPill(
  dayId: string,
  shift: ShiftItem,
  isLead: boolean,
  allowAssignmentStatusEdits: boolean,
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/95 px-2 py-1 text-[10px] font-medium text-foreground/85',
        isUnavailableStatus(shift.status) &&
          'border-[var(--error-border)]/55 text-[var(--error-text)] line-through decoration-[var(--error-text)]/50'
      )}
    >
      <span>{compactName(shift.name)}</span>
      <StatusPill status={shift.status} />
    </span>
  )

  if (!allowAssignmentStatusEdits) {
    return <span className="pointer-events-auto">{content}</span>
  }

  return (
    <AssignmentStatusPopover
      therapistName={shift.name}
      currentStatus={shift.status}
      isLead={isLead}
      triggerTestId={`coverage-assignment-trigger-${dayId}-${shift.userId}`}
      onChangeStatus={(nextStatus) => onChangeStatus(dayId, shift.id, isLead, nextStatus)}
    >
      {content}
    </AssignmentStatusPopover>
  )
}

export function CalendarGridDayCard({
  absoluteIndex,
  allowAssignmentStatusEdits,
  day,
  flatDayIds,
  focusCell,
  onChangeStatus,
  onSelect,
  schedulingViewOnly,
  selectedId,
}: {
  absoluteIndex: number
  allowAssignmentStatusEdits: boolean
  day: DayItem
  flatDayIds: string[]
  focusCell: (id: string) => void
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
  onSelect: (id: string) => void
  schedulingViewOnly: boolean
  selectedId: string | null
}) {
  const activeCount = countActive(day)
  const tone = resolveCellTone(day, activeCount)
  const showMonthTag = shouldShowMonthTag(absoluteIndex, day.isoDate)
  const visibleStaff = day.staffShifts.slice(0, 2)
  const extraStaffCount = Math.max(day.staffShifts.length - visibleStaff.length, 0)

  return (
    <article
      role="gridcell"
      data-testid={`coverage-day-panel-${day.id}`}
      className={cn(
        'relative min-h-[108px] rounded-xl border px-2.5 py-2.5 shadow-sm transition-[border-color,box-shadow,transform] duration-150',
        'hover:-translate-y-px hover:shadow-md',
        cellToneClassName(tone),
        selectedId === day.id && 'border-primary/65 ring-2 ring-primary/15',
        'coverage-calendar-mobile-day'
      )}
    >
      <button
        type="button"
        tabIndex={absoluteIndex === 0 ? 0 : -1}
        data-testid={`coverage-day-cell-button-${day.id}`}
        aria-label={`${schedulingViewOnly ? 'View' : 'Edit'} ${day.label}`}
        className="absolute inset-0 z-0 rounded-xl"
        onClick={() => onSelect(day.id)}
        onKeyDown={(event) => {
          if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            return
          }
          event.preventDefault()
          const cols = 7
          let next = absoluteIndex
          switch (event.key) {
            case 'ArrowRight':
              next = Math.min(absoluteIndex + 1, flatDayIds.length - 1)
              break
            case 'ArrowLeft':
              next = Math.max(absoluteIndex - 1, 0)
              break
            case 'ArrowDown':
              next = Math.min(absoluteIndex + cols, flatDayIds.length - 1)
              break
            case 'ArrowUp':
              next = Math.max(absoluteIndex - cols, 0)
              break
          }
          focusCell(flatDayIds[next])
        }}
      />

      <div className="pointer-events-none relative z-10 flex h-full flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[1.15rem] font-semibold leading-none tracking-[-0.04em] text-foreground">
              {day.date}
            </span>
            {showMonthTag ? (
              <span className="rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {formatMonthShort(day.isoDate)}
              </span>
            ) : null}
          </div>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              badgeToneClassName(tone)
            )}
          >
            {activeCount}/{TARGET_HEADCOUNT} staffed
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="pointer-events-auto">
            {day.leadShift ? (
              renderShiftPill(
                day.id,
                day.leadShift,
                true,
                allowAssignmentStatusEdits,
                onChangeStatus
              )
            ) : (
              <span className="rounded-full border border-dashed border-[var(--warning-border)]/70 px-2 py-0.5 text-[10px] font-medium text-[var(--warning-text)]">
                No lead
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1">
            {day.constraintBlocked ? (
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--error-text)]" aria-hidden />
            ) : null}
            {buildCoverageLabel(day, activeCount)}
          </span>
        </div>

        <div className="mt-auto space-y-1">
          {visibleStaff.length > 0 ? (
            <div className="pointer-events-auto flex flex-wrap gap-1.5">
              {visibleStaff.map((shift) => (
                <div key={shift.id}>
                  {renderShiftPill(
                    day.id,
                    shift,
                    false,
                    allowAssignmentStatusEdits,
                    onChangeStatus
                  )}
                </div>
              ))}
              {extraStaffCount > 0 ? (
                <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  +{extraStaffCount} more
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
            <span className="font-medium">Open day editor</span>
            <span className="inline-flex items-center gap-1 font-medium text-foreground/70">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
