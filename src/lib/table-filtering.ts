import type { TableToolbarFilters } from '@/components/TableToolbar'

export type FilterableRow = {
  searchText: string
  status: string
  date: string
  sortDate: string
}

function toComparableTime(value: string): number {
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function includesSearch(text: string, search: string): boolean {
  if (!search) return true
  return text.toLowerCase().includes(search.toLowerCase())
}

function inDateRange(date: string, startDate: string, endDate: string): boolean {
  if (!date) return true
  if (startDate && date < startDate) return false
  if (endDate && date > endDate) return false
  return true
}

export function filterAndSortRows<T extends FilterableRow>(
  rows: T[],
  filters: TableToolbarFilters
): T[] {
  const filtered = rows.filter((row) => {
    const matchesSearch = includesSearch(row.searchText, filters.search.trim())
    const matchesStatus = filters.status === 'all' || row.status === filters.status
    const matchesDate = inDateRange(row.date, filters.startDate, filters.endDate)
    return matchesSearch && matchesStatus && matchesDate
  })

  return filtered.sort((a, b) => {
    const aTime = toComparableTime(a.sortDate)
    const bTime = toComparableTime(b.sortDate)
    return filters.sort === 'oldest' ? aTime - bTime : bTime - aTime
  })
}
