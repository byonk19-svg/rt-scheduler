'use client'

import { Fragment, useMemo, useState } from 'react'

import {
  DEFAULT_TABLE_FILTERS,
  TableToolbar,
  type TableToolbarFilters,
} from '@/components/TableToolbar'
import { EmptyState } from '@/components/EmptyState'
import { ShiftPostsTableRows } from '@/components/shift-board/ShiftPostsTableRows'
import { FormSubmitButton } from '@/components/form-submit-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { formatDate } from '@/lib/schedule-helpers'
import { filterAndSortRows, type FilterableRow } from '@/lib/table-filtering'

type Role = UiRole
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
  const canReviewShiftPosts = can(role, 'review_shift_posts')
  const isStaffRole = !canReviewShiftPosts
  const [scope, setScope] = useState<'mine' | 'all'>(isStaffRole ? 'mine' : 'all')
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<TableToolbarFilters>({
    ...DEFAULT_TABLE_FILTERS,
    status: canReviewShiftPosts ? 'pending' : 'all',
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
      isStaffRole && scope === 'mine'
        ? rows.filter((row) => row.isOwnPost || row.isClaimedByMe)
        : rows

    const mappedRows: Array<ShiftPostTableRow & FilterableRow> = scopedRows.map((row) => ({
      ...row,
      searchText: `${row.message} ${row.postedBy} ${row.type} ${row.cycleLabel} ${row.shiftType} ${row.claimerName ?? ''}`,
      date: row.shiftDate,
      sortDate: row.createdAt,
    }))

    return filterAndSortRows(mappedRows, filters)
  }, [filters, isStaffRole, rows, scope])

  const defaultFiltersForRole: TableToolbarFilters = {
    ...DEFAULT_TABLE_FILTERS,
    status: canReviewShiftPosts ? 'pending' : 'all',
  }
  const noPendingApprovals =
    canReviewShiftPosts && filters.status === 'pending' && visibleRows.length === 0
  function renderRowActions(row: ShiftPostTableRow) {
    return (
      <div className="flex flex-wrap gap-2">
        {row.isOwnPost && row.status === 'pending' && (
          <form action={deleteShiftPostAction}>
            <input type="hidden" name="post_id" value={row.id} />
            <FormSubmitButton type="submit" variant="outline" size="sm" pendingText="Deleting...">
              Delete
            </FormSubmitButton>
          </form>
        )}

        {row.canClaim && row.type === 'pickup' && (
          <form action={claimShiftPostAction}>
            <input type="hidden" name="post_id" value={row.id} />
            <FormSubmitButton type="submit" variant="outline" size="sm" pendingText="Claiming...">
              Claim shift
            </FormSubmitButton>
          </form>
        )}

        {row.canClaim && row.type === 'swap' && shiftOptions.length > 0 && (
          <form action={claimShiftPostAction} className="flex items-center gap-2">
            <input type="hidden" name="post_id" value={row.id} />
            <select
              name="swap_shift_id"
              required
              className="h-8 rounded-md border border-border bg-card px-2 text-xs"
            >
              <option value="">My shift...</option>
              {shiftOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <FormSubmitButton type="submit" variant="outline" size="sm" pendingText="Submitting...">
              Offer swap
            </FormSubmitButton>
          </form>
        )}

        {row.isClaimedByMe && row.status === 'pending' && (
          <form action={unclaimShiftPostAction}>
            <input type="hidden" name="post_id" value={row.id} />
            <FormSubmitButton type="submit" variant="outline" size="sm" pendingText="Unclaiming...">
              Unclaim
            </FormSubmitButton>
          </form>
        )}

        {canReviewShiftPosts && (
          <>
            {row.status !== 'approved' && (
              <form action={updateShiftPostStatusAction}>
                <input type="hidden" name="post_id" value={row.id} />
                <input type="hidden" name="status" value="approved" />
                <FormSubmitButton type="submit" size="sm" pendingText="Approving...">
                  Approve
                </FormSubmitButton>
              </form>
            )}
            {row.status !== 'denied' && (
              <form action={updateShiftPostStatusAction}>
                <input type="hidden" name="post_id" value={row.id} />
                <input type="hidden" name="status" value="denied" />
                <FormSubmitButton
                  type="submit"
                  variant="destructive"
                  size="sm"
                  pendingText="Denying..."
                >
                  Deny
                </FormSubmitButton>
              </form>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <Card id="open-posts">
      <CardHeader>
        <CardTitle>Open Posts</CardTitle>
        <CardDescription>
          {canReviewShiftPosts
            ? 'Approve or deny requests from the team.'
            : 'Track active requests and your own submissions.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isStaffRole && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={scope === 'mine' ? 'default' : 'outline'}
              onClick={() => setScope('mine')}
            >
              My Requests
            </Button>
            <Button
              type="button"
              size="sm"
              variant={scope === 'all' ? 'default' : 'outline'}
              onClick={() => setScope('all')}
            >
              All Posts
            </Button>
          </div>
        )}

        <TableToolbar
          filters={filters}
          onFiltersChange={setFilters}
          searchPlaceholder="Search by message, poster, or shift details"
        />
        <ShiftPostsTableRows
          defaultFiltersForRole={defaultFiltersForRole}
          expandedPostIds={expandedPostIds}
          noPendingApprovals={noPendingApprovals}
          onResetFilters={setFilters}
          onShowAll={() => setFilters((current) => ({ ...current, status: 'all' }))}
          onToggleMessage={toggleMessage}
          renderRowActions={renderRowActions}
          visibleRows={visibleRows}
        />
      </CardContent>
    </Card>
  )
}
