'use client'

import { memo, useMemo } from 'react'

import { MobileRosterDayCards } from '@/components/coverage/MobileRosterDayCards'
import {
  chunkRosterWeeks,
  resolveRosterCellIntent,
  RosterSection,
} from '@/components/coverage/RosterScheduleDesktop'
import { RosterScheduleHeader } from '@/components/coverage/RosterScheduleHeader'
import type { DayItem, ShiftTab, UiStatus } from '@/lib/coverage/selectors'

export { chunkRosterWeeks, resolveRosterCellIntent } from '@/components/coverage/RosterScheduleDesktop'

export type RosterMemberRow = {
  id: string
  full_name: string
  role?: 'therapist' | 'lead'
  employment_type?: 'full_time' | 'part_time' | 'prn'
}

type RosterScheduleViewProps = {
  days: DayItem[]
  members: RosterMemberRow[]
  shiftTab?: ShiftTab
  title?: string
  cycleLabel?: string | null
  cycleDates?: string[]
  canManageCoverage?: boolean
  canUpdateAssignmentStatus?: boolean
  selectedDayId?: string | null
  cellError?: { dayId: string; memberId: string; message: string } | null
  onOpenEditor?: (dayId: string) => void
  onChangeStatus?: (dayId: string, shiftId: string, isLead: boolean, nextStatus: UiStatus) => void
}

function compareRosterRows(a: RosterMemberRow, b: RosterMemberRow): number {
  const aLead = a.role === 'lead' ? 1 : 0
  const bLead = b.role === 'lead' ? 1 : 0
  if (aLead !== bLead) return bLead - aLead
  return a.full_name.localeCompare(b.full_name)
}

export function buildRosterSections(rows: RosterMemberRow[]): {
  regularRows: RosterMemberRow[]
  prnRows: RosterMemberRow[]
} {
  const regularRows = rows.filter((row) => row.employment_type !== 'prn').sort(compareRosterRows)
  const prnRows = rows.filter((row) => row.employment_type === 'prn').sort(compareRosterRows)
  return { regularRows, prnRows }
}

function buildDayMap(days: DayItem[]): Map<string, DayItem> {
  return new Map(days.map((day) => [day.id, day]))
}
export const RosterScheduleView = memo(function RosterScheduleView({
  days,
  members,
  shiftTab,
  title,
  cycleLabel,
  cycleDates,
  canManageCoverage = false,
  canUpdateAssignmentStatus = false,
  selectedDayId = null,
  cellError = null,
  onOpenEditor,
  onChangeStatus,
}: RosterScheduleViewProps) {
  const sections = buildRosterSections(members)
  const effectiveCycleDates =
    cycleDates && cycleDates.length > 0 ? cycleDates : days.map((day) => day.id)
  const dayMap = useMemo(() => buildDayMap(days), [days])
  const shiftLabel = shiftTab === 'Night' ? 'Night' : 'Day'
  const heading = title ?? `Respiratory Therapy ${shiftLabel} Shift`

  return (
    <div className="space-y-4">
      <RosterScheduleHeader
        cycleLabel={cycleLabel}
        heading={heading}
        showTitleBlock={Boolean(title || cycleLabel)}
      />

      <MobileRosterDayCards
        effectiveCycleDates={effectiveCycleDates}
        dayMap={dayMap}
        regularRows={sections.regularRows}
        prnRows={sections.prnRows}
        canManageCoverage={canManageCoverage}
        canUpdateAssignmentStatus={canUpdateAssignmentStatus}
        onOpenEditor={onOpenEditor}
        onChangeStatus={onChangeStatus}
      />

      <div className="hidden xl:block">
        <RosterSection
        label="Core roster"
        description="Lead and regular coverage staff"
        rows={sections.regularRows}
        dayMap={dayMap}
        effectiveCycleDates={effectiveCycleDates}
        canManageCoverage={canManageCoverage}
        canUpdateAssignmentStatus={canUpdateAssignmentStatus}
        selectedDayId={selectedDayId}
        cellError={cellError}
        onOpenEditor={onOpenEditor}
        onChangeStatus={onChangeStatus}
        />
      </div>

      {sections.prnRows.length > 0 ? (
        <div className="hidden xl:block">
          <RosterSection
            label="PRN coverage"
            description="Additional staff available for open coverage"
            rows={sections.prnRows}
            dayMap={dayMap}
            effectiveCycleDates={effectiveCycleDates}
            canManageCoverage={canManageCoverage}
            canUpdateAssignmentStatus={canUpdateAssignmentStatus}
            selectedDayId={selectedDayId}
            cellError={cellError}
            onOpenEditor={onOpenEditor}
            onChangeStatus={onChangeStatus}
          />
        </div>
      ) : null}
    </div>
  )
})
