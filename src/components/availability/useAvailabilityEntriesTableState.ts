'use client'

import { useMemo, useState } from 'react'

import { useAvailabilityPlannerFocus } from '@/components/availability/availability-planner-focus-context'
import {
  DEFAULT_TABLE_FILTERS,
  type TableStatusOption,
  type TableToolbarFilters,
} from '@/components/TableToolbar'
import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { formatDate } from '@/lib/schedule-helpers'
import { filterAndSortRows, type FilterableRow } from '@/lib/table-filtering'
import type { AvailabilityEntryTableRow } from '@/app/(app)/availability/availability-requests-table'

const STATUS_OPTIONS: TableStatusOption[] = [
  { value: 'all', label: 'All' },
  { value: 'force_off', label: 'Need Off' },
  { value: 'force_on', label: 'Request to Work' },
]

function getCompactEmptyMessage(filtersExcludedAllRows: boolean): string {
  return filtersExcludedAllRows
    ? 'No availability requests match your filters.'
    : 'No availability requests yet.'
}

export function useAvailabilityEntriesTableState({
  initialFilters,
  role,
  rows,
  syncSearchFromPlannerFocus,
}: {
  initialFilters?: Partial<TableToolbarFilters>
  role: UiRole
  rows: AvailabilityEntryTableRow[]
  syncSearchFromPlannerFocus: boolean
}) {
  const plannerFocus = useAvailabilityPlannerFocus()
  const canManageAvailability = can(role, 'access_manager_ui')
  const [scope, setScope] = useState<'all-staff' | 'my-entries' | 'focused-therapist'>(
    canManageAvailability && syncSearchFromPlannerFocus
      ? 'focused-therapist'
      : canManageAvailability
        ? 'all-staff'
        : 'my-entries'
  )
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set())

  const allowedStatuses = new Set(STATUS_OPTIONS.map((option) => option.value))
  const initialStatus =
    initialFilters?.status && allowedStatuses.has(initialFilters.status)
      ? initialFilters.status
      : 'all'
  const initialSort = initialFilters?.sort === 'oldest' ? 'oldest' : 'newest'

  const [filters, setFilters] = useState<TableToolbarFilters>({
    ...DEFAULT_TABLE_FILTERS,
    ...initialFilters,
    search: initialFilters?.search ?? '',
    startDate: initialFilters?.startDate ?? '',
    endDate: initialFilters?.endDate ?? '',
    status: initialStatus,
    sort: initialSort,
  })

  function toggleDetails(entryId: string) {
    setExpandedEntryIds((current) => {
      const next = new Set(current)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  const scopedRows = useMemo(() => {
    if (canManageAvailability && scope === 'my-entries') {
      return rows.filter((row) => row.canDelete)
    }
    return rows
  }, [canManageAvailability, rows, scope])

  const filteredRows = useMemo(() => {
    const mappedRows: Array<AvailabilityEntryTableRow & FilterableRow> = scopedRows.map((row) => ({
      ...row,
      searchText: `${row.requestedBy} ${row.reason ?? ''} ${row.cycleLabel} ${formatDate(row.date)} ${row.entryType} ${row.shiftType}`,
      date: row.date,
      sortDate: row.createdAt,
      status: row.entryType,
    }))

    return filterAndSortRows(mappedRows, filters)
  }, [filters, scopedRows])

  const showShiftColumn = useMemo(() => rows.some((row) => row.shiftType !== 'both'), [rows])

  const entrySummary = useMemo(() => {
    const n = filteredRows.length
    if (n === 0) return null
    const needOff = filteredRows.filter((row) => row.entryType === 'force_off').length
    const requestToWork = filteredRows.filter((row) => row.entryType === 'force_on').length
    return { n, needOff, requestToWork }
  }, [filteredRows])

  const filtersExcludedAllRows = scopedRows.length > 0 && filteredRows.length === 0
  const emptyMessage = getCompactEmptyMessage(filtersExcludedAllRows)

  return {
    canManageAvailability,
    emptyMessage,
    entrySummary,
    expandedEntryIds,
    filteredRows,
    filters,
    plannerFocus,
    scope,
    setFilters,
    setScope,
    showShiftColumn,
    syncSearchFromPlannerFocus,
    toggleDetails,
  }
}

export { STATUS_OPTIONS }
