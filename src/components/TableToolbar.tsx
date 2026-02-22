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
}: TableToolbarProps) {
  function updateFilters(partial: Partial<TableToolbarFilters>) {
    onFiltersChange({ ...filters, ...partial })
  }

  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <Input
            placeholder={searchPlaceholder}
            value={filters.search}
            onChange={(event) => updateFilters({ search: event.target.value })}
          />
        </div>

        <select
          className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
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
          <div className="md:col-span-2" />
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Label htmlFor="table-sort" className="text-xs text-muted-foreground">
          Sort
        </Label>
        <select
          id="table-sort"
          className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          value={filters.sort}
          onChange={(event) => updateFilters({ sort: event.target.value as TableSortOption })}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>
    </div>
  )
}
