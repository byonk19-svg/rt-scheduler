'use client'

import { Fragment } from 'react'

import { FormSubmitButton } from '@/components/form-submit-button'
import { Badge } from '@/components/ui/badge'
import { TableBody, TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { AvailabilityEntryTableRow } from '@/app/(app)/availability/availability-requests-table'

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

export function AvailabilityEntriesTableRows({
  canManageAvailability,
  deleteAvailabilityEntryAction,
  expandedEntryIds,
  filteredRows,
  onToggleDetails,
  returnToPath,
  showShiftColumn,
}: {
  canManageAvailability: boolean
  deleteAvailabilityEntryAction: (formData: FormData) => void | Promise<void>
  expandedEntryIds: Set<string>
  filteredRows: AvailabilityEntryTableRow[]
  onToggleDetails: (entryId: string) => void
  returnToPath: '/availability' | '/therapist/availability'
  showShiftColumn: boolean
}) {
  return (
    <TableBody>
      {filteredRows.map((row) => {
        const isExpanded = expandedEntryIds.has(row.id)
        const noteText = row.reason?.trim() ?? ''
        const noteDisplay = noteText || <span className="text-muted-foreground">-</span>

        return (
          <Fragment key={row.id}>
            <TableRow
              className="cursor-pointer border-border/70 hover:bg-muted/20"
              onClick={() => onToggleDetails(row.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onToggleDetails(row.id)
                }
              }}
              tabIndex={0}
              aria-expanded={isExpanded}
            >
              <TableCell className="font-medium text-foreground">{row.date}</TableCell>
              {canManageAvailability ? (
                <TableCell className="hidden text-foreground md:table-cell">
                  {row.requestedBy}
                </TableCell>
              ) : null}
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
              {showShiftColumn ? (
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {formatShiftTypeLabel(row.shiftType)}
                  </span>
                </TableCell>
              ) : null}
              <TableCell className="max-w-[min(28rem,55vw)]">
                <span className="line-clamp-1 text-sm text-foreground">{noteDisplay}</span>
              </TableCell>
              <TableCell className="w-[4.5rem] text-right">
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-expanded={isExpanded}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleDetails(row.id)
                  }}
                >
                  {isExpanded ? 'Hide' : 'View'}
                </button>
              </TableCell>
            </TableRow>

            {isExpanded ? (
              <TableRow>
                <TableCell
                  colSpan={
                    showShiftColumn
                      ? canManageAvailability
                        ? 6
                        : 5
                      : canManageAvailability
                        ? 5
                        : 4
                  }
                  className="bg-muted/25"
                >
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
                    {showShiftColumn ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Shift scope
                        </p>
                        <p className="text-sm text-foreground">
                          {formatShiftTypeLabel(row.shiftType)}
                        </p>
                      </div>
                    ) : null}
                    {canManageAvailability ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Therapist
                        </p>
                        <p className="text-sm text-foreground">{row.requestedBy}</p>
                      </div>
                    ) : null}
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Note
                      </p>
                      <p className="text-sm text-foreground">
                        {noteText ? noteText : <span className="text-muted-foreground">-</span>}
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
                        <span className="text-xs text-muted-foreground">No actions available.</span>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
          </Fragment>
        )
      })}
    </TableBody>
  )
}
