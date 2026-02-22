'use client'

import { Fragment, useMemo, useState } from 'react'

import { DEFAULT_TABLE_FILTERS, TableToolbar, type TableToolbarFilters } from '@/components/TableToolbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/schedule-helpers'
import { filterAndSortRows, type FilterableRow } from '@/lib/table-filtering'

type Role = 'manager' | 'therapist'
type PostType = 'swap' | 'pickup'
type PostStatus = 'pending' | 'approved' | 'denied'

export type ShiftPostTableRow = {
  id: string
  hasShiftDetails: boolean
  shiftDate: string
  shiftType: 'day' | 'night'
  shiftStatus: 'scheduled' | 'on_call' | 'sick' | 'called_off'
  cycleLabel: string
  offeredShiftLabel: string | null
  type: PostType
  postedBy: string
  message: string
  status: PostStatus
  createdAt: string
  claimerName: string | null
  isOwnPost: boolean
  isClaimedByMe: boolean
  canClaim: boolean
}

type ShiftOption = {
  id: string
  label: string
}

type ShiftPostsTableProps = {
  role: Role
  rows: ShiftPostTableRow[]
  shiftOptions: ShiftOption[]
  deleteShiftPostAction: (formData: FormData) => void | Promise<void>
  claimShiftPostAction: (formData: FormData) => void | Promise<void>
  unclaimShiftPostAction: (formData: FormData) => void | Promise<void>
  updateShiftPostStatusAction: (formData: FormData) => void | Promise<void>
}

export function ShiftPostsTable({
  role,
  rows,
  shiftOptions,
  deleteShiftPostAction,
  claimShiftPostAction,
  unclaimShiftPostAction,
  updateShiftPostStatusAction,
}: ShiftPostsTableProps) {
  const [scope, setScope] = useState<'mine' | 'all'>(role === 'therapist' ? 'mine' : 'all')
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<TableToolbarFilters>({
    ...DEFAULT_TABLE_FILTERS,
    status: role === 'manager' ? 'pending' : 'all',
  })

  function toggleMessage(postId: string) {
    setExpandedPostIds((current) => {
      const next = new Set(current)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }
      return next
    })
  }

  const visibleRows = useMemo(() => {
    const scopedRows =
      role === 'therapist' && scope === 'mine'
        ? rows.filter((row) => row.isOwnPost || row.isClaimedByMe)
        : rows

    const mappedRows: Array<ShiftPostTableRow & FilterableRow> = scopedRows.map((row) => ({
      ...row,
      searchText: `${row.message} ${row.postedBy} ${row.type} ${row.cycleLabel} ${row.shiftType} ${row.claimerName ?? ''}`,
      date: row.shiftDate,
      sortDate: row.createdAt,
    }))

    return filterAndSortRows(mappedRows, filters)
  }, [filters, role, rows, scope])

  return (
    <Card id="open-posts">
      <CardHeader>
        <CardTitle>Open Posts</CardTitle>
        <CardDescription>
          {role === 'manager'
            ? 'Approve or deny requests from the team.'
            : 'Track active requests and your own submissions.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {role === 'therapist' && (
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant={scope === 'mine' ? 'default' : 'outline'} onClick={() => setScope('mine')}>
              My Requests
            </Button>
            <Button type="button" size="sm" variant={scope === 'all' ? 'default' : 'outline'} onClick={() => setScope('all')}>
              All Posts
            </Button>
          </div>
        )}

        <TableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          searchPlaceholder="Search by message, poster, or shift details"
        />

        <Table>
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
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                  No shift posts match the current filters.
                </TableCell>
              </TableRow>
            )}

            {visibleRows.map((row) => {
              const isMessageExpanded = expandedPostIds.has(row.id)

              return (
                <Fragment key={row.id}>
                  <TableRow>
                    <TableCell>{row.hasShiftDetails ? formatDate(row.shiftDate) : 'Unavailable'}</TableCell>
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
                          {row.offeredShiftLabel && (
                            <div className="mt-1 text-xs text-muted-foreground">Offered: {row.offeredShiftLabel}</div>
                          )}
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
                      {row.claimerName && row.status === 'pending' && (
                        <div className="mt-1 text-xs text-muted-foreground">Claimed by {row.claimerName}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {new Date(row.createdAt).toLocaleDateString('en-US')}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <span className="block max-w-[22rem] truncate text-sm">{row.message}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {row.isOwnPost && row.status === 'pending' && (
                          <form action={deleteShiftPostAction}>
                            <input type="hidden" name="post_id" value={row.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Delete
                            </Button>
                          </form>
                        )}

                        {row.canClaim && row.type === 'pickup' && (
                          <form action={claimShiftPostAction}>
                            <input type="hidden" name="post_id" value={row.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Claim shift
                            </Button>
                          </form>
                        )}

                        {row.canClaim && row.type === 'swap' && shiftOptions.length > 0 && (
                          <form action={claimShiftPostAction} className="flex items-center gap-2">
                            <input type="hidden" name="post_id" value={row.id} />
                            <select
                              name="swap_shift_id"
                              required
                              className="h-8 rounded-md border border-border bg-white px-2 text-xs"
                            >
                              <option value="">My shift...</option>
                              {shiftOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <Button type="submit" variant="outline" size="sm">
                              Offer swap
                            </Button>
                          </form>
                        )}

                        {row.isClaimedByMe && row.status === 'pending' && (
                          <form action={unclaimShiftPostAction}>
                            <input type="hidden" name="post_id" value={row.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Unclaim
                            </Button>
                          </form>
                        )}

                        {role === 'manager' && (
                          <>
                            {row.status !== 'approved' && (
                              <form action={updateShiftPostStatusAction}>
                                <input type="hidden" name="post_id" value={row.id} />
                                <input type="hidden" name="status" value="approved" />
                                <Button type="submit" size="sm">
                                  Approve
                                </Button>
                              </form>
                            )}
                            {row.status !== 'denied' && (
                              <form action={updateShiftPostStatusAction}>
                                <input type="hidden" name="post_id" value={row.id} />
                                <input type="hidden" name="status" value="denied" />
                                <Button type="submit" variant="destructive" size="sm">
                                  Deny
                                </Button>
                              </form>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMessage(row.id)}
                        aria-expanded={isMessageExpanded}
                        aria-controls={`post-message-${row.id}`}
                      >
                        {isMessageExpanded ? 'Hide' : 'Message'}
                      </Button>
                    </TableCell>
                  </TableRow>

                  {isMessageExpanded && (
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
