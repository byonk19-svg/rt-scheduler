'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <div className="flex min-w-0 items-center gap-2">
      <Label htmlFor="table-sort" className="shrink-0 text-xs text-muted-foreground">
        Sort
      </Label>
      <select
        id="table-sort"
        className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-sm md:max-w-[10rem] md:flex-none"
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
          ? 'rounded-lg border border-border/60 bg-muted/12 px-2 py-1.5'
          : 'rounded-md border border-border bg-card p-3'
      }
    >
      <div
        className={
          showDateRange
            ? compact
              ? 'grid grid-cols-1 gap-1.5 md:grid-cols-5'
              : 'grid grid-cols-1 gap-3 md:grid-cols-5'
            : compact
              ? 'grid grid-cols-1 items-end gap-1.5 md:grid-cols-12'
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
          className={
            showDateRange
              ? 'h-9 w-full rounded-md border border-border bg-card px-3 text-sm'
              : 'h-9 w-full rounded-md border border-border bg-card px-3 text-sm md:col-span-4'
          }
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
        <div className={compact ? 'mt-1.5 flex justify-end' : 'mt-3 flex justify-end'}>
          {sortSelect}
        </div>
      ) : null}
    </div>
  )
}
