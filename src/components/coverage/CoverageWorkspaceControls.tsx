import Link from 'next/link'

import type { CycleRow } from '@/app/(app)/coverage/coverage-page-snapshot'
import {
  CoverageSegmentedControl,
  type WorkspaceMetricTone,
} from '@/components/coverage/coverage-workspace-chrome'
import { formatHumanCycleRange } from '@/lib/calendar-utils'
import { shiftTabToQueryValue, COVERAGE_SHIFT_QUERY_KEY } from '@/lib/coverage/coverage-shift-tab'
import type { ShiftTab } from '@/lib/coverage/selectors'
import { cn } from '@/lib/utils'

type CoverageViewMode = 'week' | 'calendar' | 'roster'
type RenderedCoverageViewMode = 'week' | 'roster'

const VIEW_OPTIONS = [
  { value: 'week', label: 'Grid' },
  { value: 'roster', label: 'Roster' },
] as const

export function CoverageWorkspaceControls({
  activeCycleId,
  availableCycles,
  renderedViewMode,
  shiftTab,
  viewMode,
  onViewModeChange,
  onShiftTabChange,
}: {
  activeCycleId: string | null
  availableCycles: CycleRow[]
  renderedViewMode: RenderedCoverageViewMode
  shiftTab: ShiftTab
  viewMode: CoverageViewMode
  onViewModeChange: (mode: RenderedCoverageViewMode) => void
  onShiftTabChange: (tab: ShiftTab) => void
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/70 px-3 py-2.5">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Cycle
            </p>
            <span className="text-[10px] text-muted-foreground">Switch block</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {availableCycles.map((cycle) => {
              const isActive = cycle.id === activeCycleId
              const rangeLabel = formatHumanCycleRange(cycle.start_date, cycle.end_date)
              return (
                <Link
                  key={cycle.id}
                  href={`/coverage?cycle=${cycle.id}&view=${viewMode}&${COVERAGE_SHIFT_QUERY_KEY}=${shiftTabToQueryValue(shiftTab)}`}
                  title={cycle.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    isActive
                      ? 'border-primary bg-primary/12 font-semibold text-foreground ring-1 ring-primary/20'
                      : 'border-border/70 bg-background font-medium text-muted-foreground hover:bg-muted/35 hover:text-foreground'
                  )}
                >
                  <span>{rangeLabel}</span>
                  {cycle.published && !isActive ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">• Live</span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CoverageSegmentedControl
            label="Layout"
            value={renderedViewMode}
            options={VIEW_OPTIONS}
            onChange={onViewModeChange}
          />
          <CoverageSegmentedControl
            label="Shift"
            value={shiftTab}
            options={[
              { value: 'Day', label: 'Day shift' },
              { value: 'Night', label: 'Night shift' },
            ]}
            onChange={onShiftTabChange}
            testIdPrefix="coverage-shift-tab"
          />
        </div>
      </div>
    </section>
  )
}
