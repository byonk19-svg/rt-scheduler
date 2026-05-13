'use client'

import { useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { createCoverageShiftMutator } from '@/lib/coverage/mutations'
import { shiftTabToQueryValue } from '@/lib/coverage/coverage-shift-tab'
import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'

import { AssignCellPopover } from './AssignCellPopover'
import { ScheduleGridTable } from './ScheduleGridTable'
import { ScheduleGridToolbar } from './ScheduleGridToolbar'
import { StatusCellPopover } from './StatusCellPopover'
import type { GridCell, GridDataset, ScheduleGridPreFlightSummary } from './schedule-grid-types'

type AssignmentStatusValue = 'scheduled' | 'on_call' | 'cancelled' | 'call_in' | 'left_early'

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

function toCoveragePayload(status: AssignmentStatusValue): {
  assignment_status: AssignmentStatus
  status: ShiftStatus
} {
  if (status === 'on_call') return { assignment_status: 'on_call', status: 'on_call' }
  if (status === 'cancelled') return { assignment_status: 'cancelled', status: 'called_off' }
  if (status === 'call_in') return { assignment_status: 'call_in', status: 'called_off' }
  if (status === 'left_early') return { assignment_status: 'left_early', status: 'scheduled' }
  return { assignment_status: 'scheduled', status: 'scheduled' }
}

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
  const [isShiftNavigating, setIsShiftNavigating] = useState(false)
  const [activeCellTarget, setActiveCellTarget] = useState<CellTarget | null>(null)
  const [showPreFlight, setShowPreFlight] = useState(false)
  const autoDraftFormRef = useRef<HTMLFormElement | null>(null)
  const publishFormRef = useRef<HTMLFormElement | null>(null)
  const mutator = useMemo(() => createCoverageShiftMutator(), [])
  const cellsLocked = isPending || isShiftNavigating

  const handleShiftTabChange = useCallback(
    (tab: 'Day' | 'Night') => {
      if (tab === loadedShiftTab) {
        setShiftTab(tab)
        return
      }
      setShiftTab(tab)
      setIsShiftNavigating(true)
      setActiveCellTarget(null)
      const params = new URLSearchParams(searchParams.toString())
      params.set('shift', shiftTabToQueryValue(tab))
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [loadedShiftTab, pathname, router, searchParams]
  )

  const handleCycleChange = useCallback(
    (cycleId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('cycle', cycleId)
      setIsShiftNavigating(true)
      setActiveCellTarget(null)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
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
      window.alert(error.message ?? 'Could not assign therapist.')
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
      window.alert(error.message ?? 'Could not unassign therapist.')
      return
    }
    refreshAfterMutation()
  }, [activeCellTarget, cellsLocked, initialDataset, mutator, refreshAfterMutation])

  const handleStatusChange = useCallback(
    async (status: AssignmentStatusValue) => {
      if (!activeCellTarget?.cell.shiftId) return
      if (cellsLocked) return
      if (!initialDataset.canManageCoverage && !initialDataset.canUpdateAssignmentStatus) return
      const { error } = await mutator.updateStatus(
        activeCellTarget.cell.shiftId,
        toCoveragePayload(status)
      )
      if (error) {
        window.alert(error.message ?? 'Could not update status.')
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
      window.alert(error.message ?? 'Could not designate lead.')
      return
    }
    refreshAfterMutation()
  }, [activeCellTarget, cellsLocked, initialDataset, mutator, refreshAfterMutation])

  const isAssignTarget = activeCellTarget?.cell.status === 'off'
  const isStatusTarget = Boolean(activeCellTarget && activeCellTarget.cell.status !== 'off')

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
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
      <ScheduleGridToolbar
        cycleId={initialDataset.cycleId}
        cycleDateRangeLabel={initialDataset.cycleDateRangeLabel}
        availableCycles={initialDataset.availableCycles}
        isPublished={initialDataset.isPublished}
        shiftTab={shiftTab}
        canManageCoverage={initialDataset.canManageCoverage}
        onCycleChange={handleCycleChange}
        onShiftTabChange={handleShiftTabChange}
        onAutoDraft={autoDraftAction ? () => autoDraftFormRef.current?.requestSubmit() : undefined}
        onPreFlight={preFlightSummary ? () => setShowPreFlight((value) => !value) : undefined}
        onPrint={() => window.print()}
        onPublish={publishAction ? () => publishFormRef.current?.requestSubmit() : undefined}
      />
      {showPreFlight && preFlightSummary ? (
        <div className="border-b border-border bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Pre-flight summary</p>
          <p className="mt-1">
            {preFlightSummary.unfilledSlots} unfilled assignments,{' '}
            {preFlightSummary.missingLeadSlots} missing lead slots,{' '}
            {preFlightSummary.forcedMustWorkMisses} need-to-work misses.
          </p>
        </div>
      ) : null}
      <ScheduleGridTable
        dataset={initialDataset}
        onCellClick={handleCellClick}
        interactionsDisabled={cellsLocked}
      />
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
