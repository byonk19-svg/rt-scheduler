'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'

import { ActionBar } from '@/components/schedule-roster/ActionBar'
import { EmptyStateBanner } from '@/components/schedule-roster/EmptyStateBanner'
import { RosterTable } from '@/components/schedule-roster/RosterTable'
import { ScheduleHeader } from '@/components/schedule-roster/ScheduleHeader'
import { SegmentedControl } from '@/components/schedule-roster/SegmentedControl'
import { StatCards } from '@/components/schedule-roster/StatCards'
import { TopAppHeader } from '@/components/schedule-roster/TopAppHeader'
import { WorkflowTabs } from '@/components/schedule-roster/WorkflowTabs'
import { Badge } from '@/components/ui/badge'
import {
  DEMO_CYCLE,
  DEMO_STAFF,
  assignShift,
  buildRosterWeeks,
  createEmptyAssignments,
  getAssignmentsForShift,
  splitStaffByRoster,
  unassignShift,
  type ShiftType,
} from '@/lib/mock-coverage-roster'

type ViewMode = 'grid' | 'roster'

type SelectedCell = {
  staffId: string
  isoDate: string
}

const VIEW_OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'roster', label: 'Roster' },
] as const

const SHIFT_OPTIONS = [
  { value: 'day', label: 'Day shift' },
  { value: 'night', label: 'Night shift' },
] as const

const KPI_CARDS = [
  { label: 'Active staff', value: '10', detail: 'day shift roster' },
  { label: 'Priority gaps', value: '42', detail: 'critical days', tone: 'critical' as const },
  { label: 'Days missing lead', value: '0', detail: 'lead coverage', tone: 'success' as const },
  { label: 'Unassigned days', value: '42', detail: '0 fully staffed', tone: 'warning' as const },
] as const

export function ScheduleRosterScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('roster')
  const [selectedShift, setSelectedShift] = useState<ShiftType>('day')
  const [assignments, setAssignments] = useState(createEmptyAssignments)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [, startTransition] = useTransition()

  const weeks = useMemo(() => buildRosterWeeks(DEMO_CYCLE.startDate, DEMO_CYCLE.endDate), [])
  const sections = useMemo(() => splitStaffByRoster(DEMO_STAFF), [])
  const visibleAssignments = useMemo(
    () => getAssignmentsForShift(assignments, selectedShift),
    [assignments, selectedShift]
  )
  const hasAssignments = visibleAssignments.length > 0

  const handleAutoDraft = () => {
    setAssignments((current) =>
      sections.core.slice(0, 4).reduce((store, member, memberIndex) => {
        const draftWeek = weeks[memberIndex % weeks.length]
        const draftDay = draftWeek?.days[memberIndex % (draftWeek?.days.length ?? 1)]
        if (!draftDay) return store
        return assignShift(store, {
          staffId: member.id,
          isoDate: draftDay.isoDate,
          shiftType: selectedShift,
        })
      }, current)
    )
  }

  const handleAssign = (cell: SelectedCell) => {
    setAssignments((current) =>
      assignShift(current, {
        staffId: cell.staffId,
        isoDate: cell.isoDate,
        shiftType: selectedShift,
      })
    )
    setSelectedCell(null)
  }

  const handleUnassign = (cell: SelectedCell) => {
    setAssignments((current) =>
      unassignShift(current, {
        staffId: cell.staffId,
        isoDate: cell.isoDate,
        shiftType: selectedShift,
      })
    )
    setSelectedCell(null)
  }

  const openFirstDay = () => {
    const firstStaff = sections.core[0]
    const firstDay = weeks[0]?.days[0]
    if (!firstStaff || !firstDay) return
    setSelectedCell({ staffId: firstStaff.id, isoDate: firstDay.isoDate })
  }

  return (
    <main className="min-h-screen bg-background">
      <TopAppHeader />
      <div className="border-b border-border/70 bg-card/70">
        <div className="mx-auto w-full max-w-[1680px] px-4 py-2 sm:px-6 lg:px-8">
          <WorkflowTabs
            ariaLabel="Schedule workflow"
            tabs={[
              { href: '/schedule', label: 'Coverage', active: true },
              { href: '/availability', label: 'Availability', active: false },
              { href: '/publish', label: 'Publish', active: false },
              { href: '/approvals', label: 'Approvals', active: false },
            ]}
          />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-border/80 bg-card/80 px-5 py-5 shadow-tw-md-soft sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <ScheduleHeader
                title="Schedule"
                status="SETUP REQUIRED"
                dateRange={DEMO_CYCLE.shortLabel}
                helperText="Review coverage in roster form, use Auto-draft to prefill the cycle, then send a preliminary schedule before publish."
              />
              <ActionBar onAutoDraft={handleAutoDraft} />
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
                    {DEMO_CYCLE.shortLabel}
                  </span>
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

              <StatCards
                cards={KPI_CARDS.map((card) =>
                  card.label === 'Active staff'
                    ? { ...card, detail: `${selectedShift} shift roster` }
                    : card
                )}
              />

              {!hasAssignments ? (
                <EmptyStateBanner onAutoDraft={handleAutoDraft} onOpenFirstDay={openFirstDay} />
              ) : null}

              {viewMode === 'grid' ? (
                <section className="rounded-[1.75rem] border border-border/80 bg-card/90 px-5 py-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                      Grid view stays in the live coverage workspace
                    </h2>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      This mock route is focused on the roster layout from the design reference.
                      Open the live coverage grid when you need the production staffing surface.
                    </p>
                  </div>
                  <div className="mt-4">
                    <Link
                      href="/coverage?view=week"
                      className="inline-flex rounded-full border border-border/80 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 hover:no-underline"
                    >
                      Open live coverage grid
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
                    badge="8 staff"
                    staff={sections.core}
                    weeks={weeks}
                    assignments={assignments}
                    selectedShift={selectedShift}
                    selectedCell={selectedCell}
                    onSelectedCellChange={setSelectedCell}
                    onAssign={handleAssign}
                    onUnassign={handleUnassign}
                  />

                  <div className="border-t-2 border-foreground/90 pt-3">
                    <RosterTable
                      title="PRN coverage"
                      subtitle="Additional staff available for open coverage"
                      badge="2 staff"
                      staff={sections.prn}
                      weeks={weeks}
                      assignments={assignments}
                      selectedShift={selectedShift}
                      selectedCell={selectedCell}
                      onSelectedCellChange={setSelectedCell}
                      onAssign={handleAssign}
                      onUnassign={handleUnassign}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
