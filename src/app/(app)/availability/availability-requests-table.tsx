'use client'

import { Fragment, useMemo, useState } from 'react'

import { AvailabilityEntriesTableRows } from '@/components/availability/AvailabilityEntriesTableRows'
import { TableToolbar, type TableToolbarFilters } from '@/components/TableToolbar'
import {
  STATUS_OPTIONS,
  useAvailabilityEntriesTableState,
} from '@/components/availability/useAvailabilityEntriesTableState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { UiRole } from '@/lib/auth/roles'
import { cn } from '@/lib/utils'

type Role = UiRole

export type AvailabilityEntryTableRow = {
  id: string
  therapistId: string
  cycleId: string
  date: string
  reason: string | null
  createdAt: string
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
  syncSearchFromPlannerFocus?: boolean
  embedded?: boolean
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
  embedded = false,
}: AvailabilityEntriesTableProps) {
  const {
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
    toggleDetails,
  } = useAvailabilityEntriesTableState({
    initialFilters,
    role,
    rows,
    syncSearchFromPlannerFocus,
  })

  if (!canManageAvailability && rows.length === 0) {
    return (
      <section className="rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-tw-xs">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {titleOverride ?? 'Submitted Availability'}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {emptyMessageOverride ?? 'No day-level entries yet for this cycle.'}
        </p>
      </section>
    )
  }
  const resolvedEmptyMessage = emptyMessageOverride ?? emptyMessage

  const content = (
    <div className={cn('space-y-3', embedded ? 'px-4 py-3' : 'px-4 py-3.5')}>
      {canManageAvailability && (
        <div className="flex flex-wrap items-center gap-1.5">
          {syncSearchFromPlannerFocus ? (
            <>
              <Button
                type="button"
                size="sm"
                variant={scope === 'focused-therapist' ? 'default' : 'outline'}
                className={
                  scope === 'focused-therapist'
                    ? 'h-8 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90'
                    : 'h-8 border-border/70 bg-card px-3 text-xs text-muted-foreground hover:bg-muted'
                }
                onClick={() => {
                  setScope('focused-therapist')
                  const next = plannerFocus?.focusedTherapistName?.trim() ?? ''
                  setFilters((prev) => ({ ...prev, search: next }))
                }}
              >
                Selected therapist
              </Button>
              <Button
                type="button"
                size="sm"
                variant={scope === 'all-staff' ? 'default' : 'outline'}
                className={
                  scope === 'all-staff'
                    ? 'h-8 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90'
                    : 'h-8 border-border/70 bg-card px-3 text-xs text-muted-foreground hover:bg-muted'
                }
                onClick={() => {
                  setScope('all-staff')
                  if ((plannerFocus?.focusedTherapistName?.trim() ?? '') === filters.search) {
                    setFilters((prev) => ({ ...prev, search: '' }))
                  }
                }}
              >
                All staff
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant={scope === 'all-staff' ? 'default' : 'outline'}
                className={
                  scope === 'all-staff'
                    ? 'h-8 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90'
                    : 'h-8 border-border/70 bg-card px-3 text-xs text-muted-foreground hover:bg-muted'
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
                    ? 'h-8 bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90'
                    : 'h-8 border-border/70 bg-card px-3 text-xs text-muted-foreground hover:bg-muted'
                }
                onClick={() => setScope('my-entries')}
              >
                My entries
              </Button>
            </>
          )}
        </div>
      )}

      <TableToolbar
        filters={filters}
        onFiltersChange={setFilters}
        searchPlaceholder={
          canManageAvailability
            ? syncSearchFromPlannerFocus
              ? 'Search therapist'
              : 'Search by requester, note, cycle, or request type'
            : 'Search by note, cycle, or request type'
        }
        statusOptions={STATUS_OPTIONS}
        showDateRange={canManageAvailability}
        compact
      />

      {syncSearchFromPlannerFocus && plannerFocus?.focusedTherapistName ? (
        <p className="text-xs text-muted-foreground">
          Showing requests for{' '}
          <span className="font-medium text-foreground">{plannerFocus.focusedTherapistName}</span> -
          the therapist open in the planner. Edit the search box to filter further.
        </p>
      ) : null}

      {entrySummary ? (
        <p className="text-xs leading-relaxed text-muted-foreground/85">
          <span>{entrySummary.n}</span>
          {entrySummary.n === 1 ? ' entry' : ' entries'}
          <span className="px-1 text-muted-foreground/40">|</span>
          <span>
            {entrySummary.needOff} Need Off
            <span className="px-1 text-muted-foreground/40">|</span>
            {entrySummary.requestToWork} Request to Work
          </span>
        </p>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-4 text-sm text-muted-foreground">
          {resolvedEmptyMessage}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border bg-muted/40">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground/72">
                Date
              </TableHead>
              {canManageAvailability ? (
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-foreground/72 md:table-cell">
                  Therapist
                </TableHead>
              ) : null}
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground/72">
                Request type
              </TableHead>
              {showShiftColumn ? (
                <TableHead className="hidden text-xs font-semibold uppercase tracking-wide text-foreground/72 md:table-cell">
                  Shift
                </TableHead>
              ) : null}
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-foreground/72">
                Note
              </TableHead>
              <TableHead className="w-[4.5rem] text-right text-xs font-semibold uppercase tracking-wide text-foreground/72">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <AvailabilityEntriesTableRows
            canManageAvailability={canManageAvailability}
            deleteAvailabilityEntryAction={deleteAvailabilityEntryAction}
            expandedEntryIds={expandedEntryIds}
            filteredRows={filteredRows}
            onToggleDetails={toggleDetails}
            returnToPath={returnToPath}
            showShiftColumn={showShiftColumn}
          />
        </Table>
      )}
    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <Card className="overflow-hidden rounded-[1.5rem] border border-border/75 bg-card shadow-tw-sm">
      <CardHeader className="border-b border-border/70 px-5 pb-2.5 pt-4">
        <CardTitle>
          {titleOverride ??
            (canManageAvailability
              ? syncSearchFromPlannerFocus
                ? 'Request inbox'
                : scope === 'all-staff'
                  ? 'Review requests'
                  : 'Review my requests'
              : 'My Saved Availability Requests')}
        </CardTitle>
        <CardDescription>
          {descriptionOverride ??
            (canManageAvailability
              ? syncSearchFromPlannerFocus
                ? 'Review therapist requests tied to the current planning cycle.'
                : scope === 'all-staff'
                  ? 'Scan submitted requests before the cycle is published.'
                  : 'Review the requests you entered yourself.'
              : 'Your saved requests for upcoming cycles.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  )
}
