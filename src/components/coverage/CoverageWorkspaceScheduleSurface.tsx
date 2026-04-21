'use client'

import dynamic from 'next/dynamic'

import type { RosterMemberRow } from '@/components/coverage/RosterScheduleView'
import type { DayItem, UiStatus } from '@/lib/coverage/selectors'

const CalendarGrid = dynamic(() =>
  import('@/components/coverage/CalendarGrid').then((module) => module.CalendarGrid)
)
const RosterScheduleView = dynamic(() =>
  import('@/components/coverage/RosterScheduleView').then((module) => module.RosterScheduleView)
)

export function CoverageWorkspaceScheduleSurface({
  renderedViewMode,
  shiftTab,
  cycleRangeLabel,
  hasSchedulingContent,
  printCycleDates,
  rosterMembers,
  days,
  canManageCoverage,
  canUpdateAssignmentStatus,
  deferredSelectedId,
  rosterCellError,
  loading,
  selectedId,
  weekOffset,
  totalWeeks,
  onRosterOpenEditor,
  onSelect,
  onChangeStatus,
  onWeekOffsetChange,
}: {
  renderedViewMode: 'week' | 'roster'
  shiftTab: 'Day' | 'Night'
  cycleRangeLabel: string
  hasSchedulingContent: boolean
  printCycleDates: string[]
  rosterMembers: RosterMemberRow[]
  days: DayItem[]
  canManageCoverage: boolean
  canUpdateAssignmentStatus: boolean
  deferredSelectedId: string | null
  rosterCellError: { dayId: string; memberId: string; message: string } | null
  loading: boolean
  selectedId: string | null
  weekOffset: number
  totalWeeks: number
  onRosterOpenEditor: (dayId: string) => void
  onSelect: (id: string) => void
  onChangeStatus: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
  onWeekOffsetChange: (updater: (current: number) => number) => void
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/70 p-3 md:p-4">
      {renderedViewMode === 'roster' ? (
        <RosterScheduleView
          title={`Respiratory Therapy ${shiftTab} Shift`}
          cycleLabel={hasSchedulingContent ? cycleRangeLabel : null}
          cycleDates={printCycleDates}
          members={rosterMembers}
          days={days}
          canManageCoverage={canManageCoverage}
          canUpdateAssignmentStatus={canUpdateAssignmentStatus && !canManageCoverage}
          selectedDayId={deferredSelectedId}
          cellError={rosterCellError}
          onOpenEditor={onRosterOpenEditor}
          onChangeStatus={onChangeStatus}
        />
      ) : (
        <CalendarGrid
          days={days}
          loading={loading}
          selectedId={selectedId}
          weekOffset={weekOffset}
          schedulingViewOnly={!canManageCoverage}
          allowAssignmentStatusEdits={canUpdateAssignmentStatus}
          onSwipeLeft={() => onWeekOffsetChange((current) => Math.min(current + 1, totalWeeks - 1))}
          onSwipeRight={() => onWeekOffsetChange((current) => Math.max(current - 1, 0))}
          onSelect={onSelect}
          onChangeStatus={onChangeStatus}
        />
      )}
    </section>
  )
}
