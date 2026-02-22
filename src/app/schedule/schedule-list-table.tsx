'use client'

import { useMemo, useState } from 'react'

import {
  DEFAULT_TABLE_FILTERS,
  TableToolbar,
  type TableStatusOption,
  type TableToolbarFilters,
} from '@/components/TableToolbar'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/schedule-helpers'
import { filterAndSortRows, type FilterableRow } from '@/lib/table-filtering'

type Role = 'manager' | 'therapist'

export type ScheduleListRow = {
  id: string
  date: string
  therapistName: string
  shiftType: 'day' | 'night'
  status: 'scheduled' | 'on_call' | 'sick' | 'called_off'
}

type ScheduleListTableProps = {
  role: Role
  rows: ScheduleListRow[]
  emptyMessage: string
  cycleId: string
  viewMode: string
  deleteShiftAction?: (formData: FormData) => void | Promise<void>
}

const STATUS_OPTIONS: TableStatusOption[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'on_call', label: 'On Call' },
  { value: 'sick', label: 'Sick' },
  { value: 'called_off', label: 'Called Off' },
]

export function ScheduleListTable({
  role,
  rows,
  emptyMessage,
  cycleId,
  viewMode,
  deleteShiftAction,
}: ScheduleListTableProps) {
  const [filters, setFilters] = useState<TableToolbarFilters>(DEFAULT_TABLE_FILTERS)

  const filteredRows = useMemo(() => {
    const mappedRows: Array<ScheduleListRow & FilterableRow> = rows.map((row) => ({
      ...row,
      searchText: `${row.therapistName} ${row.shiftType} ${row.status} ${formatDate(row.date)}`,
      date: row.date,
      sortDate: row.date,
    }))

    return filterAndSortRows(mappedRows, filters)
  }, [rows, filters])

  const showActions = role === 'manager' && Boolean(deleteShiftAction)
  const emptyColSpan = role === 'manager' ? (showActions ? 5 : 4) : 3

  return (
    <div className="space-y-4">
      <TableToolbar
        filters={filters}
        onFiltersChange={setFilters}
        searchPlaceholder="Search by therapist, shift type, or status"
        statusOptions={STATUS_OPTIONS}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {role === 'manager' && <TableHead>Therapist</TableHead>}
            <TableHead>Shift Type</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead>Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 && (
            <TableRow>
              <TableCell colSpan={emptyColSpan} className="py-6 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}

          {filteredRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{formatDate(row.date)}</TableCell>
              {role === 'manager' && <TableCell>{row.therapistName}</TableCell>}
              <TableCell className="capitalize">{row.shiftType}</TableCell>
              <TableCell>{row.status}</TableCell>
              {showActions && (
                <TableCell>
                  <form action={deleteShiftAction}>
                    <input type="hidden" name="shift_id" value={row.id} />
                    <input type="hidden" name="cycle_id" value={cycleId} />
                    <input type="hidden" name="view" value={viewMode} />
                    <Button type="submit" variant="outline" size="sm">
                      Delete
                    </Button>
                  </form>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
