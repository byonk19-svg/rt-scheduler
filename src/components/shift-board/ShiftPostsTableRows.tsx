'use client'

import { Fragment } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TableToolbarFilters } from '@/components/TableToolbar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/EmptyState'
import { CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/schedule-helpers'
import type { ShiftPostTableRow } from '@/app/(app)/shift-board/shift-posts-table'

export function ShiftPostsTableRows({
  defaultFiltersForRole,
  expandedPostIds,
  noPendingApprovals,
  onResetFilters,
  onShowAll,
  onToggleMessage,
  renderRowActions,
  visibleRows,
}: {
  defaultFiltersForRole: TableToolbarFilters
  expandedPostIds: Set<string>
  noPendingApprovals: boolean
  onResetFilters: (filters: TableToolbarFilters) => void
  onShowAll: () => void
  onToggleMessage: (postId: string) => void
  renderRowActions: (row: ShiftPostTableRow) => React.ReactNode
  visibleRows: ShiftPostTableRow[]
}) {
  return (
    <>
      {visibleRows.length === 0 ? (
        <EmptyState
          title={
            noPendingApprovals
              ? "You're all caught up - no pending requests right now."
              : 'No shift posts match these filters.'
          }
          description={
            noPendingApprovals
              ? 'Nice work. Check back later or switch to all posts.'
              : 'Adjust filters or view all requests.'
          }
          illustration={
            noPendingApprovals ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-3 py-1.5 text-[var(--success-text)]">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">All clear</span>
              </div>
            ) : undefined
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onShowAll}>
                View all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onResetFilters(defaultFiltersForRole)}
              >
                Clear filters
              </Button>
            </div>
          }
        />
      ) : null}

      {visibleRows.length > 0 ? (
        <div className="space-y-3 md:hidden">
          {visibleRows.map((row) => (
            <div
              key={`mobile-${row.id}`}
              className="space-y-3 rounded-md border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {row.hasShiftDetails ? formatDate(row.shiftDate) : 'Shift unavailable'}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {row.shiftType} - {row.shiftStatus.replace('_', ' ')}
                  </p>
                </div>
                <Badge
                  variant={
                    row.status === 'approved'
                      ? 'default'
                      : row.status === 'denied'
                        ? 'destructive'
                        : 'outline'
                  }
                >
                  {row.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{row.cycleLabel}</p>
              <p className="text-sm text-foreground">{row.message}</p>
              {row.offeredShiftLabel ? (
                <p className="text-xs text-muted-foreground">Offered: {row.offeredShiftLabel}</p>
              ) : null}
              {row.claimerName && row.status === 'pending' ? (
                <p className="text-xs text-muted-foreground">Claimed by {row.claimerName}</p>
              ) : null}
              {renderRowActions(row)}
            </div>
          ))}
        </div>
      ) : null}

      {visibleRows.length > 0 ? (
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden lg:table-cell">Posted By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Submitted</TableHead>
              <TableHead className="hidden xl:table-cell">Message</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => {
              const isMessageExpanded = expandedPostIds.has(row.id)

              return (
                <Fragment key={row.id}>
                  <TableRow>
                    <TableCell>
                      {row.hasShiftDetails ? formatDate(row.shiftDate) : 'Unavailable'}
                    </TableCell>
                    <TableCell>
                      {row.hasShiftDetails ? (
                        <>
                          <div className="capitalize">{row.shiftType}</div>
                          <div className="mt-1">
                            <Badge variant="outline" className="capitalize">
                              {row.shiftStatus.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{row.cycleLabel}</div>
                          {row.offeredShiftLabel ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Offered: {row.offeredShiftLabel}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Shift details unavailable</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="capitalize">
                        {row.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{row.postedBy}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === 'approved'
                            ? 'default'
                            : row.status === 'denied'
                              ? 'destructive'
                              : 'outline'
                        }
                      >
                        {row.status}
                      </Badge>
                      {row.claimerName && row.status === 'pending' ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Claimed by {row.claimerName}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {new Date(row.createdAt).toLocaleDateString('en-US')}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <span className="block max-w-[22rem] truncate text-sm">{row.message}</span>
                    </TableCell>
                    <TableCell>{renderRowActions(row)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleMessage(row.id)}
                        aria-expanded={isMessageExpanded}
                        aria-controls={`post-message-${row.id}`}
                      >
                        {isMessageExpanded ? 'Hide' : 'Message'}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {isMessageExpanded ? (
                    <TableRow id={`post-message-${row.id}`}>
                      <TableCell colSpan={9} className="bg-muted/40">
                        <div className="space-y-1 py-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Message
                          </p>
                          <p className="text-sm text-foreground">{row.message}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      ) : null}
    </>
  )
}
