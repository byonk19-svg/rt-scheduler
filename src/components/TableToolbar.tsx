'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type TableSortOption = 'newest' | 'oldest'

export type TableToolbarFilters = {
  search: string
  status: string
  startDate: string
  endDate: string
  sort: TableSortOption
}

export type TableStatusOption = {
  value: string
  label: string
}

type TableToolbarProps = {
  filters: TableToolbarFilters
  onFiltersChange: (filters: TableToolbarFilters) => void
  searchPlaceholder?: string
  statusOptions?: TableStatusOption[]
  showDateRange?: boolean
  /** Tighter padding, lighter chrome — use on dense review tables */
  compact?: boolean
}

const DEFAULT_STATUS_OPTIONS: TableStatusOption[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
]

export const DEFAULT_TABLE_FILTERS: TableToolbarFilters = {
  search: '',
  status: 'all',
  startDate: '',
  endDate: '',
  sort: 'newest',
}

export function TableToolbar({
  filters,
  onFiltersChange,
  searchPlaceholder = 'Search',
  statusOptions = DEFAULT_STATUS_OPTIONS,
  showDateRange = true,
  compact = false,
}: TableToolbarProps) {
  function updateFilters(partial: Partial<TableToolbarFilters>) {
    onFiltersChange({ ...filters, ...partial })
  }

  const sortSelect = (
    <div className="flex min-w-0 items-center gap-1.5">
      <Label htmlFor="table-sort" className="shrink-0 text-xs text-muted-foreground">
        Sort
      </Label>
      <select
        id="table-sort"
        className={cn(
          'min-w-0 flex-1 rounded-md border border-border bg-card text-sm md:flex-none',
          compact ? 'h-8.5 px-2 md:max-w-[9rem]' : 'h-9 px-2 md:max-w-[10rem]'
        )}
        value={filters.sort}
        onChange={(event) => updateFilters({ sort: event.target.value as TableSortOption })}
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
      </select>
    </div>
  )

  return (
    <div
      className={
        compact
          ? 'rounded-lg border border-border/50 bg-muted/10 px-2 py-1'
          : 'rounded-md border border-border bg-card p-3'
      }
    >
      <div
        className={
          showDateRange
            ? compact
              ? 'grid grid-cols-1 gap-1 md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.85fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]'
              : 'grid grid-cols-1 gap-3 md:grid-cols-5'
            : compact
              ? 'grid grid-cols-1 items-end gap-1 md:grid-cols-12'
              : 'grid grid-cols-1 items-end gap-3 md:grid-cols-12'
        }
      >
        <div className={showDateRange ? 'md:col-span-2' : 'md:col-span-5'}>
          <Input
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={(event) => updateFilters({ search: event.target.value })}
          />
        </div>

        <label htmlFor="toolbar-status-filter" className="sr-only">
          Filter by status
        </label>
        <select
          id="toolbar-status-filter"
          className={cn(
            'w-full rounded-md border border-border bg-card text-sm',
            compact ? 'h-8.5 px-2.5' : 'h-9 px-3',
            !showDateRange && 'md:col-span-4'
          )}
          value={filters.status}
          onChange={(event) => updateFilters({ status: event.target.value })}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {showDateRange ? (
          <>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilters({ startDate: event.target.value })}
            />
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) => updateFilters({ endDate: event.target.value })}
            />
          </>
        ) : (
          <div className="md:col-span-3">{sortSelect}</div>
        )}
      </div>

      {showDateRange ? (
        <div className={compact ? 'mt-1 flex justify-end' : 'mt-3 flex justify-end'}>
          {sortSelect}
        </div>
      ) : null}
    </div>
  )
}
