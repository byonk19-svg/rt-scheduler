'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAvailabilityPlannerFocus } from '@/components/availability/availability-planner-focus-context'
import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { formatDate } from '@/lib/schedule-helpers'
import { filterAndSortRows, type FilterableRow } from '@/lib/table-filtering'
import { cn } from '@/lib/utils'

type Role = UiRole

export type AvailabilityEntryTableRow = {
  id: string
  cycleId: string
  date: string
  reason: string | null
  createdAt: string
  /** Latest activity time for therapist entries (mirrors availability_overrides.updated_at). */
  updatedAt?: string
  requestedBy: string
  cycleLabel: string
  entryType: 'force_off' | 'force_on'
  shiftType: 'day' | 'night' | 'both'
  canDelete: boolean
}

type AvailabilityEntriesTableProps = {
  role: Role
  rows: AvailabilityEntryTableRow[]
  deleteAvailabilityEntryAction: (formData: FormData) => void | Promise<void>
  initialFilters?: Partial<TableToolbarFilters>
  returnToPath?: '/availability' | '/therapist/availability'
  titleOverride?: string
  descriptionOverride?: string
  emptyMessageOverride?: string
  /** When true, search is kept in sync with the therapist selected in Plan staffing (managers). */
  syncSearchFromPlannerFocus?: boolean
}

const STATUS_OPTIONS: TableStatusOption[] = [
  { value: 'all', label: 'All' },
  { value: 'force_off', label: 'Need Off' },
  { value: 'force_on', label: 'Request to Work' },
]

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatEntryLabel(entryType: AvailabilityEntryTableRow['entryType']): string {
  return entryType === 'force_on' ? 'Request to Work' : 'Need Off'
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
  returnToPath = '/availability',
  titleOverride,
  descriptionOverride,
  emptyMessageOverride,
  syncSearchFromPlannerFocus = false,
}: AvailabilityEntriesTableProps) {
  const plannerFocus = useAvailabilityPlannerFocus()
  const canManageAvailability = can(role, 'access_manager_ui')
  const [scope, setScope] = useState<'all-staff' | 'my-entries'>(
    canManageAvailability ? 'all-staff' : 'my-entries'
  )
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

  useEffect(() => {
    if (!syncSearchFromPlannerFocus || !canManageAvailability) return
    const next = plannerFocus?.focusedTherapistName?.trim() ?? ''
    if (!next) return
    // Post-hydration only — sync when Plan staffing therapist changes (avoid useLayoutEffect hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors planner selection into controlled search after mount
    setFilters((prev) => (prev.search === next ? prev : { ...prev, search: next }))
  }, [syncSearchFromPlannerFocus, canManageAvailability, plannerFocus?.focusedTherapistName])

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
  }, [scopedRows, filters])

  /** Hide shift column when every row is full-day (`both`) — typical therapist grid submissions. */
  const showShiftColumn = useMemo(() => rows.some((row) => row.shiftType !== 'both'), [rows])

  const tableColumnCount = useMemo(() => {
    let n = 1
    if (canManageAvailability) n += 1
    n += 1
    if (showShiftColumn) n += 1
    n += 1
    n += 1
    return n
  }, [canManageAvailability, showShiftColumn])

  const entrySummary = useMemo(() => {
    const n = filteredRows.length
    if (n === 0) return null
    const needOff = filteredRows.filter((r) => r.entryType === 'force_off').length
    const requestToWork = filteredRows.filter((r) => r.entryType === 'force_on').length
    return { n, needOff, requestToWork }
  }, [filteredRows])

  const filtersExcludedAllRows = scopedRows.length > 0 && filteredRows.length === 0

  const emptyFilteredMessage = useMemo(() => {
    if (emptyMessageOverride) return emptyMessageOverride
    if (
      canManageAvailability &&
      scope === 'my-entries' &&
      rows.length > 0 &&
      scopedRows.length === 0
    ) {
      return "You don't have your own entries in this list. Switch to All staff to see the full team."
    }
    if (filtersExcludedAllRows) {
      return 'No rows match your current filters. Try clearing the search, widening the date range, setting request type to All, or switching to All staff.'
    }
    return 'No availability requests match your filters.'
  }, [
    emptyMessageOverride,
    canManageAvailability,
    scope,
    rows.length,
    scopedRows.length,
    filtersExcludedAllRows,
  ])

  if (!canManageAvailability && rows.length === 0) {
    return (
      <section className="rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {titleOverride ?? 'Submitted Availability'}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {emptyMessageOverride ?? 'No day-level entries yet for this cycle.'}
        </p>
      </section>
    )
  }

  return (
    <Card className="overflow-hidden rounded-[1.75rem] border border-border/90 bg-card shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <CardHeader className="border-b border-border/80 pb-3">
        <CardTitle>
          {titleOverride ??
            (canManageAvailability
              ? scope === 'all-staff'
                ? 'Review requests'
                : 'Review my requests'
              : 'My Saved Availability Requests')}
        </CardTitle>
        <CardDescription>
          {descriptionOverride ??
            (canManageAvailability
              ? scope === 'all-staff'
                ? 'Scan submitted requests before the cycle is published.'
                : 'Review the requests you entered yourself.'
              : 'Your saved requests for upcoming cycles.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-5 py-4">
        {canManageAvailability && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={scope === 'all-staff' ? 'default' : 'outline'}
              className={
                scope === 'all-staff'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }
              onClick={() => setScope('all-staff')}
            >
              All staff
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === 'my-entries' ? 'default' : 'outline'}
              className={
                scope === 'my-entries'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }
              onClick={() => setScope('my-entries')}
            >
              My entries
            </Button>
          </div>
        )}

        <TableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          searchPlaceholder={
            canManageAvailability
              ? 'Search by requester, note, cycle, or request type'
              : 'Search by note, cycle, or request type'
          }
          statusOptions={STATUS_OPTIONS}
          showDateRange={canManageAvailability}
          compact
        />

        {syncSearchFromPlannerFocus && plannerFocus?.focusedTherapistName ? (
          <p className="text-xs text-muted-foreground">
            Showing requests for{' '}
            <span className="font-medium text-foreground">{plannerFocus.focusedTherapistName}</span>{' '}
            — the therapist open in the planner. Edit the search box to filter further.
          </p>
        ) : null}

        {entrySummary && (
          <p className="text-xs leading-relaxed text-muted-foreground/85">
            <span>{entrySummary.n}</span>
            {entrySummary.n === 1 ? ' entry' : ' entries'}
            <span className="px-1 text-muted-foreground/40">·</span>
            <span>
              {entrySummary.needOff} Need Off
              <span className="px-1 text-muted-foreground/40">·</span>
              {entrySummary.requestToWork} Request to Work
            </span>
          </p>
        )}

        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/45">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground/72">
                Date
              </TableHead>
              {canManageAvailability && (
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-foreground/72 md:table-cell">
                  Therapist
                </TableHead>
              )}
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground/72">
                Request type
              </TableHead>
              {showShiftColumn && (
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-foreground/72 md:table-cell">
                  Shift
                </TableHead>
              )}
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground/72">
                Note
              </TableHead>
              <TableHead className="w-[4.5rem] text-right text-xs font-semibold uppercase tracking-wide text-foreground/72">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={tableColumnCount}
                  className="py-8 text-center text-muted-foreground"
                >
                  {emptyFilteredMessage}
                </TableCell>
              </TableRow>
            )}

            {filteredRows.map((row) => {
              const isExpanded = expandedEntryIds.has(row.id)
              const noteText = row.reason?.trim() ?? ''
              const noteDisplay = noteText || <span className="text-muted-foreground">—</span>

              return (
                <Fragment key={row.id}>
                  <TableRow
                    className="cursor-pointer border-border/80 hover:bg-muted/25"
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
                    <TableCell className="font-medium text-foreground">
                      {formatDate(row.date)}
                    </TableCell>
                    {canManageAvailability && (
                      <TableCell className="hidden text-foreground md:table-cell">
                        {row.requestedBy}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge
                        variant={row.entryType === 'force_off' ? 'destructive' : 'outline'}
                        className={cn(
                          row.entryType === 'force_on' &&
                            'border-[var(--info-border)] bg-[var(--info-subtle)] font-medium text-[var(--info-text)]'
                        )}
                      >
                        {formatEntryLabel(row.entryType)}
                      </Badge>
                    </TableCell>
                    {showShiftColumn && (
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {formatShiftTypeLabel(row.shiftType)}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="max-w-[min(28rem,55vw)]">
                      <span className="line-clamp-1 text-sm text-foreground">{noteDisplay}</span>
                    </TableCell>
                    <TableCell className="w-[4.5rem] text-right">
                      {/*
                        Expand = read-only detail + optional delete, not inline edit → View (not Edit).
                      */}
                      <button
                        type="button"
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        aria-expanded={isExpanded}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleDetails(row.id)
                        }}
                      >
                        {isExpanded ? 'Hide' : 'View'}
                      </button>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={tableColumnCount} className="bg-muted/30">
                        <div className="grid grid-cols-1 gap-3 py-2 md:grid-cols-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Cycle
                            </p>
                            <p className="text-sm text-foreground">{row.cycleLabel}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Entry saved
                            </p>
                            <p className="text-sm text-foreground">
                              {formatDateTime(row.updatedAt ?? row.createdAt)}
                            </p>
                          </div>
                          {showShiftColumn && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Shift scope
                              </p>
                              <p className="text-sm text-foreground">
                                {formatShiftTypeLabel(row.shiftType)}
                              </p>
                            </div>
                          )}
                          {canManageAvailability && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Therapist
                              </p>
                              <p className="text-sm text-foreground">{row.requestedBy}</p>
                            </div>
                          )}
                          <div className="md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Note
                            </p>
                            <p className="text-sm text-foreground">
                              {noteText ? (
                                noteText
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-end md:justify-end">
                            {row.canDelete ? (
                              <form
                                action={deleteAvailabilityEntryAction}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <input type="hidden" name="entry_id" value={row.id} />
                                <input type="hidden" name="cycle_id" value={row.cycleId} />
                                <input type="hidden" name="return_to" value={returnToPath} />
                                <FormSubmitButton
                                  type="submit"
                                  variant="outline"
                                  size="sm"
                                  pendingText="Deleting..."
                                >
                                  Delete request
                                </FormSubmitButton>
                              </form>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No actions available.
                              </span>
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
