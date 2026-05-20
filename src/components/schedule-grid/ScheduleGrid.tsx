'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { createCoverageShiftMutator } from '@/lib/coverage/mutations'
import { shiftTabToQueryValue } from '@/lib/coverage/coverage-shift-tab'
import {
  toScheduleGridMutationPayload,
  type ScheduleGridAssignmentStatus,
} from '@/lib/schedule/schedule-status-model'
import { cn } from '@/lib/utils'

import { AssignCellPopover } from './AssignCellPopover'
import { ScheduleGridTable } from './ScheduleGridTable'
import { ScheduleGridToolbar } from './ScheduleGridToolbar'
import { StatusCellPopover } from './StatusCellPopover'
import type { GridCell, GridDataset, ScheduleGridPreFlightSummary } from './schedule-grid-types'

type CellTarget = {
  userId: string
  date: string
  cell: GridCell
  therapistName: string
  anchorEl: HTMLElement
}

type ScheduleGridProps = {
  initialDataset: GridDataset
  initialShiftTab: 'Day' | 'Night'
  autoDraftAction?: (formData: FormData) => void | Promise<void>
  publishAction?: (formData: FormData) => void | Promise<void>
  preFlightSummary?: ScheduleGridPreFlightSummary | null
}

const SCHEDULE_LEGEND_ITEMS = [
  {
    label: 'Staff',
    code: '1',
    className: 'text-[var(--print-ink)]',
  },
  { label: 'Lead', code: '1', className: 'border border-yellow-300 bg-yellow-200 text-yellow-900' },
  {
    label: 'On call',
    code: 'OC',
    className:
      'border border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]',
  },
  {
    label: 'Cancelled',
    code: 'CX',
    className:
      'border border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]',
  },
  {
    label: 'Call in',
    code: 'CI',
    className:
      'border border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]',
  },
  {
    label: 'Left early',
    code: 'LE',
    className: 'border border-orange-200 bg-orange-100 text-orange-800',
  },
  { label: 'Requested off', code: '*', className: 'text-foreground' },
] as const

export function ScheduleGrid({
  initialDataset,
  initialShiftTab,
  autoDraftAction,
  publishAction,
  preFlightSummary,
}: ScheduleGridProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const loadedShiftTab = initialDataset.shiftType === 'night' ? 'Night' : 'Day'
  const [shiftTab, setShiftTab] = useState<'Day' | 'Night'>(initialShiftTab)
  const [activeCellTarget, setActiveCellTarget] = useState<CellTarget | null>(null)
  const [showPreFlight, setShowPreFlight] = useState(false)
  const autoDraftFormRef = useRef<HTMLFormElement | null>(null)
  const publishFormRef = useRef<HTMLFormElement | null>(null)
  const mutator = useMemo(() => createCoverageShiftMutator(), [])
  const cellsLocked = isPending

  const handleShiftTabChange = useCallback(
    (tab: 'Day' | 'Night') => {
      if (tab === loadedShiftTab) {
        setShiftTab(tab)
        return
      }
      setShiftTab(tab)
      setActiveCellTarget(null)
      const params = new URLSearchParams(searchParams.toString())
      params.set('shift', shiftTabToQueryValue(tab))
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [loadedShiftTab, pathname, router, searchParams, startTransition]
  )

  const handleCycleChange = useCallback(
    (cycleId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('cycle', cycleId)
      setActiveCellTarget(null)
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [pathname, router, searchParams, startTransition]
  )

  const handleCellClick = useCallback(
    (userId: string, date: string, cell: GridCell, anchorEl: HTMLElement) => {
      if (cellsLocked) return
      const row = initialDataset.therapistRows.find((candidate) => candidate.userId === userId)
      if (!row) return
      if (cell.status === 'off' && !initialDataset.canManageCoverage) {
        return
      }
      if (
        cell.status !== 'off' &&
        !initialDataset.canManageCoverage &&
        (!initialDataset.canUpdateAssignmentStatus || !initialDataset.isPublished)
      ) {
        return
      }
      setActiveCellTarget({ userId, date, cell, therapistName: row.name, anchorEl })
    },
    [cellsLocked, initialDataset]
  )

  const refreshAfterMutation = useCallback(() => {
    setActiveCellTarget(null)
    startTransition(() => router.refresh())
  }, [router])

  const handleAssign = useCallback(async () => {
    if (!activeCellTarget || !initialDataset.canManageCoverage || cellsLocked) return
    const { error } = await mutator.assign({
      cycleId: initialDataset.cycleId,
      userId: activeCellTarget.userId,
      isoDate: activeCellTarget.date,
      shiftType: initialDataset.shiftType,
      role: 'staff',
      availabilityOverride: activeCellTarget.cell.hasNeedsOff,
      availabilityOverrideReason: activeCellTarget.cell.hasNeedsOff
        ? 'Manager assigned from schedule grid despite requested day off.'
        : undefined,
    })
    if (error) {
      window.alert('Could not assign this shift. Refresh Schedule and try again.')
      return
    }
    refreshAfterMutation()
  }, [activeCellTarget, cellsLocked, initialDataset, mutator, refreshAfterMutation])

  const handleUnassign = useCallback(async () => {
    if (!activeCellTarget?.cell.shiftId || !initialDataset.canManageCoverage || cellsLocked) return
    const { error } = await mutator.unassign({
      cycleId: initialDataset.cycleId,
      shiftId: activeCellTarget.cell.shiftId,
    })
    if (error) {
      window.alert('Could not remove this assignment. Refresh Schedule and try again.')
      return
    }
    refreshAfterMutation()
  }, [activeCellTarget, cellsLocked, initialDataset, mutator, refreshAfterMutation])

  const handleStatusChange = useCallback(
    async (status: ScheduleGridAssignmentStatus) => {
      if (!activeCellTarget?.cell.shiftId) return
      if (cellsLocked) return
      if (!initialDataset.canManageCoverage && !initialDataset.canUpdateAssignmentStatus) return
      const { error } = await mutator.updateStatus(
        activeCellTarget.cell.shiftId,
        toScheduleGridMutationPayload(status)
      )
      if (error) {
        window.alert('Could not update this shift status. Refresh Schedule and try again.')
        return
      }
      refreshAfterMutation()
    },
    [activeCellTarget, cellsLocked, initialDataset, mutator, refreshAfterMutation]
  )

  const handleDesignateLead = useCallback(async () => {
    if (!activeCellTarget?.cell.shiftId || !initialDataset.canManageCoverage || cellsLocked) return
    const { error } = await mutator.setDesignatedLead({
      cycleId: initialDataset.cycleId,
      therapistId: activeCellTarget.userId,
      isoDate: activeCellTarget.date,
      shiftType: initialDataset.shiftType,
    })
    if (error) {
      window.alert('Could not set the lead for this shift. Refresh Schedule and try again.')
      return
    }
    refreshAfterMutation()
  }, [activeCellTarget, cellsLocked, initialDataset, mutator, refreshAfterMutation])

  const isAssignTarget = activeCellTarget?.cell.status === 'off'
  const isStatusTarget = Boolean(activeCellTarget && activeCellTarget.cell.status !== 'off')
  const sheetTitle =
    loadedShiftTab === 'Night' ? 'Respiratory Therapy Night Shift' : 'Respiratory Therapy Day Shift'
  const sheetDayCount = `${initialDataset.cycleDates.length} days`

  return (
    <div className="rounded-xl border border-border/60 bg-[color-mix(in_srgb,var(--muted)_68%,var(--background))] p-3 shadow-inner sm:p-4 lg:p-5">
      {autoDraftAction ? (
        <form ref={autoDraftFormRef} action={autoDraftAction} className="hidden">
          <input type="hidden" name="cycle_id" value={initialDataset.cycleId} />
          <input type="hidden" name="return_to" value="schedule" />
          <input type="hidden" name="view" value="grid" />
        </form>
      ) : null}
      {publishAction ? (
        <form ref={publishFormRef} action={publishAction} className="hidden">
          <input type="hidden" name="cycle_id" value={initialDataset.cycleId} />
          <input
            type="hidden"
            name="currently_published"
            value={String(initialDataset.isPublished)}
          />
          <input type="hidden" name="return_to" value="schedule" />
          <input type="hidden" name="view" value="grid" />
        </form>
      ) : null}
      <div className="space-y-3">
        <ScheduleGridToolbar
          cycleId={initialDataset.cycleId}
          cycleDateRangeLabel={initialDataset.cycleDateRangeLabel}
          availableCycles={initialDataset.availableCycles}
          isPublished={initialDataset.isPublished}
          shiftTab={shiftTab}
          isPending={isPending}
          canManageCoverage={initialDataset.canManageCoverage}
          onCycleChange={handleCycleChange}
          onShiftTabChange={handleShiftTabChange}
          onAutoDraft={
            autoDraftAction ? () => autoDraftFormRef.current?.requestSubmit() : undefined
          }
          onPreFlight={preFlightSummary ? () => setShowPreFlight((value) => !value) : undefined}
          onPrint={() => window.print()}
          onPublish={publishAction ? () => publishFormRef.current?.requestSubmit() : undefined}
        />
        {showPreFlight && preFlightSummary ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-tw-2xs">
            <p className="font-semibold">Pre-flight summary</p>
            <p className="mt-1">
              {preFlightSummary.unfilledSlots} unfilled assignments,{' '}
              {preFlightSummary.missingLeadSlots} missing lead slots,{' '}
              {preFlightSummary.forcedMustWorkMisses} need-to-work misses.
            </p>
          </div>
        ) : null}
        <article className="mx-auto max-w-[96rem] overflow-hidden rounded-[6px] border border-border/80 bg-[var(--print-paper)] text-[var(--print-ink)] shadow-[0_22px_54px_-38px_rgba(15,23,42,0.58)]">
          <div className="border-b border-border/60 bg-[var(--print-paper)] px-5 py-4">
            <div>
              <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[var(--print-ink)]">
                {sheetTitle}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.04em] text-[var(--print-ink-muted)]">
                {initialDataset.cycleDateRangeLabel} | {sheetDayCount}
              </p>
            </div>
          </div>
          <div
            aria-label="Schedule legend"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/55 bg-[color-mix(in_srgb,var(--print-paper)_94%,var(--muted))] px-5 py-1.5 text-[9px] text-[var(--print-ink-muted)]"
          >
            <span className="font-black uppercase tracking-[0.1em]">Legend</span>
            {SCHEDULE_LEGEND_ITEMS.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex min-h-3.5 min-w-3.5 items-center justify-center rounded-[2px] px-0.5 text-[8px] font-black leading-none',
                    item.className
                  )}
                >
                  {item.code}
                </span>
                <span>{item.label}</span>
              </span>
            ))}
          </div>
          <ScheduleGridTable
            dataset={initialDataset}
            onCellClick={handleCellClick}
            interactionsDisabled={cellsLocked}
          />
        </article>
      </div>
      {isAssignTarget && activeCellTarget ? (
        <AssignCellPopover
          open
          onOpenChange={(open) => {
            if (!open) setActiveCellTarget(null)
          }}
          anchorEl={activeCellTarget.anchorEl}
          therapistName={activeCellTarget.therapistName}
          date={activeCellTarget.date}
          cell={activeCellTarget.cell}
          onAssign={handleAssign}
          isPending={isPending}
        />
      ) : null}
      {isStatusTarget && activeCellTarget ? (
        <StatusCellPopover
          open
          onOpenChange={(open) => {
            if (!open) setActiveCellTarget(null)
          }}
          anchorEl={activeCellTarget.anchorEl}
          therapistName={activeCellTarget.therapistName}
          date={activeCellTarget.date}
          cell={activeCellTarget.cell}
          allowStatusChange={initialDataset.canUpdateAssignmentStatus}
          canUnassign={initialDataset.canManageCoverage}
          canDesignateLead={initialDataset.canManageCoverage}
          isCurrentlyLead={activeCellTarget.cell.status === 'lead'}
          onStatusChange={handleStatusChange}
          onUnassign={handleUnassign}
          onDesignateLead={handleDesignateLead}
          isPending={isPending}
        />
      ) : null}
    </div>
  )
}
