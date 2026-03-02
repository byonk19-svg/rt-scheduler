'use client'

import { useMemo } from 'react'

import { cn } from '@/lib/utils'
import { countActive, countBy, flatten, type DayItem, type ShiftTab, type UiStatus } from '@/lib/coverage/selectors'
import {
  getDefaultWeeklyLimitForEmploymentType,
  sanitizeWeeklyLimit,
} from '@/lib/scheduling-constants'

type TherapistOption = {
  id: string
  full_name: string
  shift_type: 'day' | 'night'
  isLeadEligible: boolean
  employment_type: string | null
  max_work_days_per_week: number | null
}
type SelectedDay = DayItem & { shiftType: ShiftTab }

type ShiftDrawerProps = {
  open: boolean
  selectedDay: SelectedDay | null
  activeCycleId: string | null
  shiftTab: ShiftTab
  availableTherapists: TherapistOption[]
  assignUserId: string
  assigning: boolean
  assigned: boolean
  expandedShiftId: string | null
  unassigningShiftId: string | null
  onClose: () => void
  onAssignSubmit: () => Promise<void> | void
  onAssignUserIdChange: (value: string) => void
  assignRole: 'lead' | 'staff'
  onAssignRoleChange: (role: 'lead' | 'staff') => void
  weeklyTherapistCounts: Map<string, number>
  cycleTherapistCounts: Map<string, number>
  assignError: string
  onToggleExpanded: (shiftId: string) => void
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
  onUnassign: (dayId: string, shiftId: string, isLead: boolean) => Promise<void> | void
}

const STATUS_ORDER: UiStatus[] = ['active', 'oncall', 'leave_early', 'cancelled']
const SHIFT_STATUSES: Record<
  UiStatus,
  { label: string; textClass: string; activeButtonClass: string }
> = {
  active: {
    label: 'Active',
    textClass: 'text-foreground',
    activeButtonClass: 'border-border bg-muted text-foreground',
  },
  oncall: {
    label: 'On Call',
    textClass: 'text-[var(--warning-text)]',
    activeButtonClass:
      'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
  },
  leave_early: {
    label: 'Leave Early',
    textClass: 'text-[var(--info-text)]',
    activeButtonClass:
      'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]',
  },
  cancelled: {
    label: 'Cancelled',
    textClass: 'text-[var(--error-text)]',
    activeButtonClass:
      'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]',
  },
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function Avatar({ name, status, expanded }: { name: string; status: UiStatus; expanded: boolean }) {
  const bgClass =
    status === 'cancelled'
      ? 'bg-[var(--error)]'
      : status === 'oncall'
        ? 'bg-orange-600'
        : 'bg-[var(--attention)]'
  const sizeClass = expanded ? 'h-[34px] w-[34px] text-[13px]' : 'h-[28px] w-[28px] text-[11px]'

  return (
    <span
      title={name}
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded-full font-extrabold text-white',
        bgClass,
        sizeClass
      )}
    >
      {initials(name)}
    </span>
  )
}

export function ShiftDrawer({
  open,
  selectedDay,
  activeCycleId,
  shiftTab,
  availableTherapists,
  assignUserId,
  assigning,
  assigned,
  expandedShiftId,
  unassigningShiftId,
  onClose,
  onAssignSubmit,
  onAssignUserIdChange,
  assignRole,
  onAssignRoleChange,
  weeklyTherapistCounts,
  cycleTherapistCounts,
  assignError,
  onToggleExpanded,
  onChangeStatus,
  onUnassign,
}: ShiftDrawerProps) {
  const selectedDayShifts = selectedDay ? flatten(selectedDay) : []

  const weeklyLimitWarning = useMemo((): string => {
    if (!assignUserId) return ''
    const therapist = availableTherapists.find((t) => t.id === assignUserId)
    if (!therapist) return ''
    const weekCount = weeklyTherapistCounts.get(assignUserId) ?? 0
    const limit = sanitizeWeeklyLimit(
      therapist.max_work_days_per_week,
      getDefaultWeeklyLimitForEmploymentType(therapist.employment_type)
    )
    if (weekCount < limit) return ''
    return `${therapist.full_name} already has ${weekCount} of ${limit} shifts scheduled this week.`
  }, [assignUserId, availableTherapists, weeklyTherapistCounts])

  return (
    <>
      <div
        className={cn(
          'no-print fixed inset-0 z-40 bg-black/10 transition-opacity',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'no-print fixed bottom-0 right-0 top-0 z-50 w-[360px] bg-white shadow-2xl transition-transform',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {selectedDay && (
          <div className="flex h-full flex-col">
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="text-lg font-extrabold text-stone-900">{selectedDay.label}</p>
                  <p className="text-xs font-medium text-amber-800">{selectedDay.shiftType || 'Day'} Shift</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close details panel"
                  data-testid="coverage-drawer-close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-500 shadow-sm"
                >
                  &times;
                </button>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-bold">
                <span className="text-emerald-700">OK {countActive(selectedDay)} active</span>
                <span className="text-orange-700">OC {countBy(selectedDay, 'oncall')}</span>
                <span className="text-blue-700">LE {countBy(selectedDay, 'leave_early')}</span>
                <span className="text-red-700">X {countBy(selectedDay, 'cancelled')}</span>
              </div>
              {selectedDay.constraintBlocked && (
                <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
                  No eligible therapists (constraints)
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                  Assign Therapist
                </p>
                {availableTherapists.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    No active {shiftTab.toLowerCase()}-shift therapists available.
                  </p>
                ) : (
                  <>
                    {/* Role toggle */}
                    {(() => {
                      const leadAlreadyFilled = !!selectedDay?.leadShift
                      const leadOptions = availableTherapists.filter((t) => t.isLeadEligible)
                      const noLeadEligible = leadOptions.length === 0
                      const leadDisabled = leadAlreadyFilled || noLeadEligible
                      const leadTitle = leadAlreadyFilled
                        ? 'Lead slot already filled'
                        : noLeadEligible
                          ? 'No lead-eligible therapists available'
                          : undefined
                      return (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => onAssignRoleChange('staff')}
                            data-testid="coverage-assign-role-staff"
                            className={cn(
                              'rounded px-3 py-1 text-xs font-bold border',
                              assignRole === 'staff'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'border-slate-300 text-slate-600 bg-white'
                            )}
                          >
                            Staff
                          </button>
                          <button
                            type="button"
                            onClick={() => onAssignRoleChange('lead')}
                            disabled={leadDisabled}
                            title={leadTitle}
                            data-testid="coverage-assign-role-lead"
                            className={cn(
                              'rounded px-3 py-1 text-xs font-bold border',
                              assignRole === 'lead'
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'border-slate-300 text-slate-600 bg-white',
                              leadDisabled && 'opacity-40 cursor-not-allowed'
                            )}
                          >
                            Lead
                          </button>
                        </div>
                      )
                    })()}
                    {/* Dropdown + submit */}
                    {(() => {
                      const displayOptions =
                        assignRole === 'lead'
                          ? availableTherapists.filter((t) => t.isLeadEligible)
                          : availableTherapists
                      return (
                        <form
                          className="mt-2 flex items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault()
                            void onAssignSubmit()
                          }}
                        >
                          <select
                            value={assignUserId}
                            onChange={(event) => onAssignUserIdChange(event.target.value)}
                            data-testid="coverage-assign-select"
                            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                            required
                          >
                            {displayOptions.map((therapist) => {
                              const weekCount = weeklyTherapistCounts.get(therapist.id)
                              const cycleCount = cycleTherapistCounts.get(therapist.id)
                              const limit = sanitizeWeeklyLimit(
                                therapist.max_work_days_per_week,
                                getDefaultWeeklyLimitForEmploymentType(therapist.employment_type)
                              )
                              const isAtLimit = weekCount !== undefined && weekCount >= limit
                              const workloadLabel =
                                weekCount !== undefined && cycleCount !== undefined
                                  ? ` · ${weekCount} this wk, ${cycleCount} this cyc`
                                  : cycleCount !== undefined
                                    ? ` · ${cycleCount} this cyc`
                                    : weekCount !== undefined
                                      ? ` · ${weekCount} this wk`
                                      : ''
                              return (
                                <option key={therapist.id} value={therapist.id}>
                                  {isAtLimit ? '⚠ ' : ''}
                                  {therapist.full_name}
                                  {workloadLabel}
                                </option>
                              )
                            })}
                          </select>
                          <button
                            type="submit"
                            disabled={!activeCycleId || !assignUserId || assigning}
                            data-testid="coverage-assign-submit"
                            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                          >
                            {assigning ? 'Assigning...' : assigned ? '\u2713 Added' : 'Assign'}
                          </button>
                        </form>
                      )
                    })()}
                  </>
                )}
                {weeklyLimitWarning && (
                  <p
                    role="status"
                    data-testid="coverage-weekly-limit-warning"
                    className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700"
                  >
                    ⚠ {weeklyLimitWarning}
                  </p>
                )}
                {assignError && (
                  <p
                    role="alert"
                    data-testid="coverage-assign-error"
                    className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700"
                  >
                    {assignError}
                  </p>
                )}
              </div>
              {selectedDayShifts.length === 0 && (
                <p className="mb-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  No therapists assigned yet.
                </p>
              )}
              {selectedDayShifts.map((shift) => {
                const expanded = expandedShiftId === shift.id
                return (
                  <div key={shift.id} className="mb-2 overflow-hidden rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => onToggleExpanded(shift.id)}
                      data-testid={`coverage-shift-row-${shift.id}`}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    >
                      <Avatar name={shift.name} status={shift.status} expanded={expanded} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{shift.name}</p>
                        <p className={cn('text-xs font-semibold', SHIFT_STATUSES[shift.status].textClass)}>
                          {SHIFT_STATUSES[shift.status].label}
                        </p>
                      </div>
                      {shift.isLead && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                          Lead
                        </span>
                      )}
                    </button>
                    {expanded && (
                      <div className="border-t border-slate-100 px-3 py-3">
                        <div className="mb-2 flex flex-wrap gap-1">
                          {STATUS_ORDER.map((statusKey) => {
                            const activeStatus = shift.status === statusKey
                            return (
                              <button
                                key={`${shift.id}-${statusKey}`}
                                type="button"
                                disabled={activeStatus}
                                onClick={() =>
                                  onChangeStatus(selectedDay.id, shift.id, shift.isLead, statusKey)
                                }
                                data-testid={`coverage-status-${shift.id}-${statusKey}`}
                                className={cn(
                                  'flex-1 rounded-md border px-2 py-1 text-xs font-bold disabled:cursor-default',
                                  activeStatus
                                    ? SHIFT_STATUSES[statusKey].activeButtonClass
                                    : 'border-border bg-card text-muted-foreground'
                                )}
                              >
                                {SHIFT_STATUSES[statusKey].label}
                              </button>
                            )
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => void onUnassign(selectedDay.id, shift.id, shift.isLead)}
                          disabled={unassigningShiftId === shift.id}
                          data-testid={`coverage-unassign-${shift.id}`}
                          className="mb-2 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-60"
                        >
                          {unassigningShiftId === shift.id
                            ? 'Unassigning...'
                            : shift.isLead
                              ? 'Remove lead assignment'
                              : 'Unassign therapist'}
                        </button>
                        {shift.log.length > 0 && (
                          <div className="space-y-1 border-t border-slate-100 pt-2">
                            <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                              Changes
                            </p>
                            {shift.log.map((entry, index) => (
                              <div
                                key={`${shift.id}-log-${index}`}
                                className="flex items-center gap-1.5 text-[11px] text-slate-500"
                              >
                                <span className="font-semibold text-slate-700">{entry.from}</span>
                                <span>-&gt;</span>
                                <span className={cn('font-bold', SHIFT_STATUSES[entry.to].textClass)}>
                                  {entry.toLabel}
                                </span>
                                <span className="ml-auto">{entry.time}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
