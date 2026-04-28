import { AlertCircle, CalendarDays, CheckCircle2, Plus } from 'lucide-react'

import type { OpenRequest } from '@/components/requests/request-page-model'
import { REQUEST_STATUS_META } from '@/components/requests/request-page-model'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { SkeletonListItem } from '@/components/ui/skeleton'
import { getPickupInterestTherapistCopy } from '@/lib/pickup-interest-presentation'
import { cn } from '@/lib/utils'

type RequestsHistoryViewProps = {
  approvedCount: number
  error: string | null
  loading: boolean
  pendingCount: number
  requests: OpenRequest[]
  totalRequests: number
  onNewRequest: () => void
  onRespondDirectRequest: (requestId: string, decision: 'accepted' | 'declined') => Promise<void>
  onWithdrawInterest: (interestId: string) => Promise<void>
  onWithdrawRequest: (requestId: string) => Promise<void>
}

export function RequestsHistoryView({
  approvedCount,
  error,
  loading,
  pendingCount,
  requests,
  totalRequests,
  onNewRequest,
  onRespondDirectRequest,
  onWithdrawInterest,
  onWithdrawRequest,
}: RequestsHistoryViewProps) {
  return (
    <div className="space-y-3">
      <ManagerWorkspaceHeader
        title="My Requests"
        subtitle="Track posted, claimed, and direct requests."
        summary={
          <div className="flex flex-wrap items-center gap-2 text-foreground">
            <span className="inline-flex items-center rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">
              {totalRequests} open total
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--warning-text)]">
              {pendingCount} pending
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success-text)]">
              {approvedCount} approved
            </span>
          </div>
        }
        actions={
          <Button size="sm" onClick={onNewRequest}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New request
          </Button>
        }
      />

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-xs font-semibold text-foreground">How requests work</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Submit a swap or pickup request and your manager will review it. Check this page for
          status updates.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mb-1 text-sm font-bold text-foreground">No requests yet</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Create a swap, pickup, or direct request to track it here.
          </p>
          <Button size="sm" onClick={onNewRequest}>
            Start request
          </Button>
        </div>
      ) : (
        requests.map((request) => {
          const meta = REQUEST_STATUS_META[request.status]
          const isPending = request.status === 'pending'
          const pickupInterestCopy =
            request.involvement === 'interest' &&
            (request.status === 'pending' || request.status === 'selected')
              ? getPickupInterestTherapistCopy(
                  request.status === 'selected' ? 'selected' : 'pending'
                )
              : null

          return (
            <div
              key={request.id}
              className={cn(
                'rounded-xl border bg-card p-4',
                isPending ? 'border-[var(--warning-border)] shadow-sm' : 'border-border'
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    request.type === 'swap'
                      ? 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
                      : 'border-border bg-secondary text-foreground'
                  )}
                >
                  {request.type}
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    meta.borderClass,
                    meta.bgClass,
                    meta.colorClass
                  )}
                >
                  {meta.label}
                </span>
                <span className="rounded-full border border-border/70 bg-muted/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {request.visibility === 'direct' ? 'Direct' : 'Team'}
                </span>
                <span className="rounded-full border border-border/70 bg-muted/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {request.involvement === 'posted'
                    ? 'Posted'
                    : request.involvement === 'received_direct'
                      ? 'Received'
                      : request.involvement === 'interest'
                        ? (pickupInterestCopy?.roleLabel ?? 'Interested')
                        : 'Claimed'}
                </span>
                {request.requestKind === 'call_in' ? (
                  <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--warning-text)]">
                    Call-in help
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">{request.posted}</span>
              </div>

              <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1">
                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{request.shift}</span>
              </div>

              <p className="text-sm text-muted-foreground">{request.message}</p>

              {request.swapWith ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {request.involvement === 'interest' ? 'Posted by: ' : 'Swap with: '}
                  <span className="font-medium text-foreground">{request.swapWith}</span>
                </p>
              ) : null}

              {request.status === 'approved' ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--success-text)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approved by manager
                </div>
              ) : null}
              {pickupInterestCopy ? (
                <div
                  className={cn(
                    'mt-2 flex items-center gap-1.5 text-xs font-medium',
                    request.status === 'selected'
                      ? 'text-[var(--success-text)]'
                      : 'text-muted-foreground'
                  )}
                >
                  {request.status === 'selected' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  {pickupInterestCopy.helperText}
                </div>
              ) : null}
              {request.visibility === 'direct' &&
              request.involvement === 'posted' &&
              request.recipientResponse === 'pending' ? (
                <p className="mt-2 text-xs text-[var(--warning-text)]">
                  Waiting for the recipient to respond before manager approval.
                </p>
              ) : null}
              {request.visibility === 'direct' &&
              request.involvement === 'posted' &&
              request.recipientResponse === 'accepted' &&
              request.status === 'pending' ? (
                <p className="mt-2 text-xs text-[var(--warning-text)]">
                  Recipient accepted. Waiting for manager approval.
                </p>
              ) : null}
              {request.visibility === 'direct' &&
              request.involvement === 'posted' &&
              request.recipientResponse === 'declined' ? (
                <p className="mt-2 text-xs text-[var(--error-text)]">
                  Recipient declined this direct request.
                </p>
              ) : null}
              {request.visibility === 'direct' && request.recipientResponse ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Recipient response:{' '}
                  <span className="font-medium text-foreground capitalize">
                    {request.recipientResponse}
                  </span>
                </p>
              ) : null}
              {request.visibility === 'direct' &&
              request.involvement === 'received_direct' &&
              request.recipientResponse === 'accepted' &&
              request.status === 'pending' ? (
                <p className="mt-2 text-xs text-[var(--warning-text)]">
                  You accepted. Waiting for manager approval.
                </p>
              ) : null}
              {request.visibility === 'direct' && request.status === 'withdrawn' ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  This direct request was withdrawn before final approval.
                </p>
              ) : null}
              {request.visibility === 'direct' &&
              request.involvement === 'received_direct' &&
              request.recipientResponse === 'pending' ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void onRespondDirectRequest(request.id, 'accepted')}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onRespondDirectRequest(request.id, 'declined')}
                  >
                    Decline
                  </Button>
                </div>
              ) : request.involvement === 'posted' &&
                request.requestKind !== 'call_in' &&
                request.status === 'pending' ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onWithdrawRequest(request.id)}
                  >
                    Withdraw request
                  </Button>
                </div>
              ) : request.involvement === 'interest' &&
                (request.status === 'pending' || request.status === 'selected') ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void onWithdrawInterest(request.id)}
                  >
                    {request.status === 'selected' ? 'Withdraw primary claim' : 'Withdraw interest'}
                  </Button>
                </div>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}
