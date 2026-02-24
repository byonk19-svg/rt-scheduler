'use client'

import { Fragment, useMemo, useState } from 'react'

import {
  DEFAULT_TABLE_FILTERS,
  TableToolbar,
  type TableStatusOption,
  type TableToolbarFilters,
} from '@/components/TableToolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/schedule-helpers'
import { filterAndSortRows, type FilterableRow } from '@/lib/table-filtering'

type Role = 'manager' | 'therapist'

export type AvailabilityEntryTableRow = {
  id: string
  date: string
  reason: string | null
  createdAt: string
  requestedBy: string
  cycleLabel: string
  entryType: 'unavailable' | 'available'
  shiftType: 'day' | 'night' | 'both'
  canDelete: boolean
}

type AvailabilityEntriesTableProps = {
  role: Role
  rows: AvailabilityEntryTableRow[]
  deleteAvailabilityEntryAction: (formData: FormData) => void | Promise<void>
  initialFilters?: Partial<TableToolbarFilters>
}

const STATUS_OPTIONS: TableStatusOption[] = [
  { value: 'all', label: 'All' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'available', label: 'Available' },
]

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatEntryLabel(entryType: AvailabilityEntryTableRow['entryType']): string {
  return entryType === 'available' ? 'Available' : 'Unavailable'
}

function formatShiftTypeLabel(shiftType: AvailabilityEntryTableRow['shiftType']): string {
  if (shiftType === 'both') return 'Both shifts'
  if (shiftType === 'night') return 'Night shift'
  return 'Day shift'
}

export function AvailabilityEntriesTable({
  role,
  rows,
  deleteAvailabilityEntryAction,
  initialFilters,
}: AvailabilityEntriesTableProps) {
  const [scope, setScope] = useState<'all-staff' | 'my-entries'>(role === 'manager' ? 'all-staff' : 'my-entries')
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set())

  const defaultStatus = 'all'
  const allowedStatuses = new Set(STATUS_OPTIONS.map((option) => option.value))
  const initialStatus =
    initialFilters?.status && allowedStatuses.has(initialFilters.status)
      ? initialFilters.status
      : defaultStatus
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
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  const filteredRows = useMemo(() => {
    const scopedRows =
      role === 'manager' && scope === 'my-entries' ? rows.filter((row) => row.canDelete) : rows

    const mappedRows: Array<AvailabilityEntryTableRow & FilterableRow> = scopedRows.map((row) => ({
      ...row,
      searchText: `${row.requestedBy} ${row.reason ?? ''} ${row.cycleLabel} ${formatDate(row.date)} ${row.entryType} ${row.shiftType}`,
      date: row.date,
      sortDate: row.createdAt,
      status: row.entryType,
    }))

    return filterAndSortRows(mappedRows, filters)
  }, [rows, filters, role, scope])

  const emptyColSpan = role === 'manager' ? 5 : 4

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {role === 'manager'
            ? scope === 'all-staff'
              ? 'All Staff Availability'
              : 'My Availability'
            : 'My Availability'}
        </CardTitle>
        <CardDescription>
          {role === 'manager'
            ? 'Availability constraints for schedule planning. No approval workflow.'
            : 'Your submitted availability entries for upcoming cycles.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {role === 'manager' && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={scope === 'all-staff' ? 'default' : 'outline'}
              onClick={() => setScope('all-staff')}
            >
              All staff
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === 'my-entries' ? 'default' : 'outline'}
              onClick={() => setScope('my-entries')}
            >
              My entries
            </Button>
          </div>
        )}

        <TableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          searchPlaceholder="Search by requester, reason, cycle, or type"
          statusOptions={STATUS_OPTIONS}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {role === 'manager' && <TableHead className="hidden md:table-cell">Therapist</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">Shift scope</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={emptyColSpan} className="py-6 text-center text-muted-foreground">
                  No availability entries match the current filters.
                </TableCell>
              </TableRow>
            )}

            {filteredRows.map((row) => {
              const isExpanded = expandedEntryIds.has(row.id)
              const reasonPreview = row.reason?.trim() || 'No reason provided'

              return (
                <Fragment key={row.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggleDetails(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggleDetails(row.id)
                      }
                    }}
                    tabIndex={0}
                    aria-expanded={isExpanded}
                  >
                    <TableCell>{formatDate(row.date)}</TableCell>
                    {role === 'manager' && <TableCell className="hidden md:table-cell">{row.requestedBy}</TableCell>}
                    <TableCell>
                      <Badge variant={row.entryType === 'unavailable' ? 'destructive' : 'outline'}>
                        {formatEntryLabel(row.entryType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{formatShiftTypeLabel(row.shiftType)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between gap-3">
                        <span className="line-clamp-1 text-sm text-foreground">{reasonPreview}</span>
                        <span className="text-xs text-muted-foreground">{isExpanded ? 'Hide' : 'Details'}</span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={emptyColSpan} className="bg-muted/40">
                        <div className="grid grid-cols-1 gap-3 py-2 md:grid-cols-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Cycle
                            </p>
                            <p className="text-sm text-foreground">{row.cycleLabel}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Submitted
                            </p>
                            <p className="text-sm text-foreground">{formatDateTime(row.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Shift scope
                            </p>
                            <p className="text-sm text-foreground">{formatShiftTypeLabel(row.shiftType)}</p>
                          </div>
                          {role === 'manager' && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Therapist
                              </p>
                              <p className="text-sm text-foreground">{row.requestedBy}</p>
                            </div>
                          )}
                          <div className="md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Reason
                            </p>
                            <p className="text-sm text-foreground">{reasonPreview}</p>
                          </div>
                          <div className="flex items-end md:justify-end">
                            {row.canDelete ? (
                              <form
                                action={deleteAvailabilityEntryAction}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <input type="hidden" name="entry_id" value={row.id} />
                                <FormSubmitButton type="submit" variant="outline" size="sm" pendingText="Deleting...">
                                  Delete entry
                                </FormSubmitButton>
                              </form>
                            ) : (
                              <span className="text-xs text-muted-foreground">No actions available.</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
