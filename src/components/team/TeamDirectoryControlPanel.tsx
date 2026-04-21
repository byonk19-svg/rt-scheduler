'use client'

import { ChevronsDownUp, ChevronsUpDown, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  TeamDirectoryFilters,
  type TeamDirectoryFilterState,
} from '@/components/team/team-directory-filters'
import {
  TeamDirectorySummaryChips,
  type DirectoryChipFilter,
} from '@/components/team/team-directory-summary-chips'
import type { TeamSummaryCounts } from '@/components/team/team-directory-model'
import { cn } from '@/lib/utils'

type TeamDirectoryControlPanelProps = {
  bulkMode: boolean
  chipFilter: DirectoryChipFilter
  clearFilters: () => void
  collapseAllSections: () => void
  expandAllSections: () => void
  filteredCount: number
  formFilters: TeamDirectoryFilterState
  hasCollapsedSection: boolean
  hasExpandedSection: boolean
  onChipChange: (value: DirectoryChipFilter) => void
  onFiltersChange: (value: TeamDirectoryFilterState) => void
  onToggleBulkMode: () => void
  onToggleShowAdvanced: (value: boolean | ((current: boolean) => boolean)) => void
  showAdvancedFilters: boolean
  summary: TeamSummaryCounts
}

export function TeamDirectoryControlPanel({
  bulkMode,
  chipFilter,
  clearFilters,
  collapseAllSections,
  expandAllSections,
  filteredCount,
  formFilters,
  hasCollapsedSection,
  hasExpandedSection,
  onChipChange,
  onFiltersChange,
  onToggleBulkMode,
  onToggleShowAdvanced,
  showAdvancedFilters,
  summary,
}: TeamDirectoryControlPanelProps) {
  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-background p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Directory quick views
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="min-h-10 rounded-md border border-border/70 bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:min-h-9 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
            onClick={() => onToggleShowAdvanced((current) => !current)}
          >
            {showAdvancedFilters ? 'Hide advanced' : 'Advanced filters'}
          </button>
          <button
            type="button"
            className={cn(
              'min-h-10 rounded-md border px-3 py-2 text-sm font-medium sm:min-h-9 sm:px-2.5 sm:py-1.5 sm:text-[11px]',
              bulkMode
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border/70 bg-card text-muted-foreground hover:text-foreground'
            )}
            onClick={onToggleBulkMode}
          >
            {bulkMode ? 'Exit bulk mode' : 'Bulk mode'}
          </button>
          <p className="text-xs text-muted-foreground">{filteredCount} shown</p>
        </div>
      </div>
      <TeamDirectorySummaryChips
        summary={summary}
        activeChip={chipFilter}
        onChipChange={onChipChange}
      />
      <TeamDirectoryFilters
        value={formFilters}
        onChange={onFiltersChange}
        showAdvanced={showAdvancedFilters}
        actions={
          <>
            {showAdvancedFilters ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={expandAllSections}
                  disabled={!hasCollapsedSection}
                >
                  <ChevronsDownUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Expand all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={collapseAllSections}
                  disabled={!hasExpandedSection}
                >
                  <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Collapse all
                </Button>
              </>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Clear filters
            </Button>
          </>
        }
      />
    </div>
  )
}
