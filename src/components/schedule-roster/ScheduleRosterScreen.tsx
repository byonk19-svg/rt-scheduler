'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'

import type { ScheduleRosterLivePayload } from '@/app/(app)/schedule/schedule-roster-live-data'
import { ActionBar } from '@/components/schedule-roster/ActionBar'
import { RosterTable } from '@/components/schedule-roster/RosterTable'
import { ScheduleCycleSelect } from '@/components/schedule-roster/ScheduleCycleSelect'
import { ScheduleHeader } from '@/components/schedule-roster/ScheduleHeader'
import { SegmentedControl } from '@/components/schedule-roster/SegmentedControl'
import { Badge } from '@/components/ui/badge'
import { buildRosterWeeks, type ShiftType } from '@/lib/mock-coverage-roster'
import { splitStaffByRosterAndShift } from '@/lib/schedule-roster-data'

type ViewMode = 'grid' | 'roster'

const VIEW_OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'roster', label: 'Roster' },
] as const

const SHIFT_OPTIONS = [
  { value: 'day', label: 'Day shift' },
  { value: 'night', label: 'Night shift' },
] as const

export type ScheduleRosterScreenProps = {
  live: ScheduleRosterLivePayload
}

export function ScheduleRosterScreen({ live }: ScheduleRosterScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('roster')
  const [selectedShift, setSelectedShift] = useState<ShiftType>('day')
  const [, startTransition] = useTransition()

  const weeks = useMemo(() => buildRosterWeeks(live.startDate, live.endDate), [live])

  const sections = useMemo(
    () => splitStaffByRosterAndShift(live.staff, selectedShift),
    [live.staff, selectedShift]
  )

  const helperText =
    'Read-only roster for this 6-week block. Edit assignments in Coverage. This page shows coverage assignments and therapist availability that has been officially submitted. x = submitted need off; 1 = submitted request to work and/or a coverage assignment.'

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-border/80 bg-card/80 px-5 py-5 shadow-tw-md-soft sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <ScheduleHeader
              title="Roster"
              status="READ ONLY"
              dateRange={live.shortLabel}
              helperText={helperText}
            />
            <ActionBar showMockWorkflow={false} />
          </div>

          <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border/80 bg-background/60 px-4 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="outline"
                  className="rounded-full border-border/80 bg-card px-3 py-1 text-sm font-medium text-foreground"
                >
                  Schedule cycle
                </Badge>
                <span className="rounded-full border border-border/80 bg-card px-3 py-1 text-sm font-medium text-foreground">
                  {live.label}
                </span>
                <ScheduleCycleSelect cycles={live.availableCycles} activeCycleId={live.cycleId} />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                  ariaLabel="Schedule view"
                  options={VIEW_OPTIONS}
                  value={viewMode}
                  onChange={(nextView) => {
                    startTransition(() => setViewMode(nextView))
                  }}
                />
                <SegmentedControl
                  ariaLabel="Shift type"
                  options={SHIFT_OPTIONS}
                  value={selectedShift}
                  onChange={(nextShift) => {
                    startTransition(() => setSelectedShift(nextShift))
                  }}
                />
              </div>
            </div>

            {viewMode === 'grid' ? (
              <section className="rounded-[1.75rem] border border-border/80 bg-card/90 px-5 py-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                    Grid editing is in Coverage
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    This page is a roster matrix for reading assignments and submitted availability.
                    Use the coverage workspace to add, move, or remove shifts.
                  </p>
                </div>
                <div className="mt-4">
                  <Link
                    href="/coverage?view=week"
                    className="inline-flex rounded-full border border-border/80 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 hover:no-underline"
                  >
                    Open Coverage
                  </Link>
                </div>
              </section>
            ) : (
              <section className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Coverage roster
                  </p>
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
                    Respiratory Therapy {selectedShift === 'day' ? 'Day' : 'Night'} Shift
                  </h2>
                </div>

                <RosterTable
                  title="Core roster"
                  subtitle="Lead and regular coverage staff"
                  badge={`${sections.core.length} staff`}
                  staff={sections.core}
                  weeks={weeks}
                  assignments={live.assignments}
                  availabilityApprovals={live.availabilityApprovals}
                  selectedShift={selectedShift}
                  selectedCell={null}
                  onSelectedCellChange={() => {}}
                  onAssign={() => {}}
                  onUnassign={() => {}}
                  readOnly
                />

                <div className="border-t-2 border-foreground/90 pt-3">
                  <RosterTable
                    title="PRN coverage"
                    subtitle="Additional staff available for open coverage"
                    badge={`${sections.prn.length} staff`}
                    staff={sections.prn}
                    weeks={weeks}
                    assignments={live.assignments}
                    availabilityApprovals={live.availabilityApprovals}
                    selectedShift={selectedShift}
                    selectedCell={null}
                    onSelectedCellChange={() => {}}
                    onAssign={() => {}}
                    onUnassign={() => {}}
                    readOnly
                  />
                </div>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
