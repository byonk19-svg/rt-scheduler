import { AlertCircle, CalendarDays, CheckCircle2, Plus } from 'lucide-react'

import type { OpenRequest } from '@/components/requests/request-page-model'
import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { Button } from '@/components/ui/button'
import { SkeletonListItem } from '@/components/ui/skeleton'
import { getPickupInterestTherapistCopy } from '@/lib/pickup-interest-presentation'
import { formatRequestRelativeTime } from '@/lib/request-workflow'
import { cn } from '@/lib/utils'

type RequestsHistoryViewProps = {
  approvedCount: number
  error: string | null
  loading: boolean
  pendingCount: number
  requests: OpenRequest[]
  selectedRequestId?: string | null
  surface?: 'requests' | 'therapist-swaps'
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
  selectedRequestId,
  surface = 'requests',
  totalRequests,
  onNewRequest,
  onRespondDirectRequest,
  onWithdrawInterest,
  onWithdrawRequest,
}: RequestsHistoryViewProps) {
  const isTherapistSwapsSurface = surface === 'therapist-swaps'

  return (
    <div className="space-y-3">
      <ManagerWorkspaceHeader
        title={isTherapistSwapsSurface ? 'Trade & Coverage Requests' : 'My Requests'}
        subtitle={
          isTherapistSwapsSurface
            ? 'Track trade requests, coverage requests, teammate responses, and manager review for your published shifts.'
            : 'Track what is waiting on you, your teammate, or the manager.'
        }
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
          {isTherapistSwapsSurface
            ? 'Direct trade requests wait for your teammate first. Team-board trade requests wait for manager review. Each card shows the next step first.'
            : 'Direct requests wait for teammate response first. Board requests wait for manager review. Each card shows the next step first.'}
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
            {isTherapistSwapsSurface
              ? 'Create a trade request or coverage request to track it here.'
              : 'Create a trade, coverage, or direct request to track it here.'}
          </p>
          <Button size="sm" onClick={onNewRequest}>
            New request
          </Button>
        </div>
      ) : (
        requests.map((request) => {
          const isPending = request.status === 'pending'
          const isSelected =
            request.id === selectedRequestId || request.sourcePostId === selectedRequestId
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
                isSelected
                  ? 'border-primary shadow-md ring-2 ring-primary/20'
                  : isPending
                    ? 'border-[var(--warning-border)] shadow-sm'
                    : 'border-border'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                        request.type === 'swap'
                          ? 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
                          : 'border-border bg-secondary text-foreground'
                      )}
                    >
                      {getRequestTypeLabel(request)}
                    </span>
                    <span className="rounded-full border border-border/70 bg-muted/15 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      {getRequestPathLabel(request)}
                    </span>
                    <span className="rounded-full border border-border/70 bg-muted/15 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      {getRequestRoleLabel(request, pickupInterestCopy?.roleLabel)}
                    </span>
                    {request.requestKind === 'call_in' ? (
                      <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--warning-text)]">
                        Call-in help
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-base font-semibold text-foreground">{request.message}</p>
                </div>
                <span className="text-xs text-muted-foreground">{request.posted}</span>
              </div>

              <div className="mt-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Next step
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{request.stageLabel}</p>
                {request.stageDetail ? (
                  <p className="mt-1 text-sm text-muted-foreground">{request.stageDetail}</p>
                ) : null}
              </div>

              {isSelected ? (
                <div className="mt-3 rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Request timeline
                  </p>
                  <div className="mt-3 space-y-3">
                    <TimelineEntry
                      title="Request created"
                      timeLabel={formatRequestRelativeTime(request.createdAt)}
                      detail="The request was created and entered the workflow."
                    />
                    {request.recipientRespondedAt && request.recipientResponse ? (
                      <TimelineEntry
                        title={
                          request.recipientResponse === 'accepted'
                            ? 'Teammate accepted'
                            : 'Teammate declined'
                        }
                        timeLabel={formatRequestRelativeTime(request.recipientRespondedAt)}
                        detail={
                          request.recipientResponse === 'accepted'
                            ? 'The request moved forward to manager review.'
                            : 'The direct request stopped before manager approval.'
                        }
                      />
                    ) : null}
                    <TimelineEntry
                      title={request.stageLabel}
                      timeLabel={request.posted}
                      detail={request.stageDetail ?? 'This is the current workflow state.'}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1">
                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{request.shift}</span>
              </div>

              {request.swapWith ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {getRequestPartnerLabel(request)}:{' '}
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
              {request.visibility === 'direct' && request.recipientResponse ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Recipient response:{' '}
                  <span className="font-medium text-foreground capitalize">
                    {request.recipientResponse}
                  </span>
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
                    Accept and send to manager
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
                    {request.status === 'selected'
                      ? 'Withdraw first-responder spot'
                      : 'Withdraw offer'}
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

function getRequestPartnerLabel(request: OpenRequest) {
  if (request.involvement === 'interest') {
    return 'Posted by'
  }

  if (request.involvement === 'received_direct') {
    return request.type === 'swap' ? 'Trade requested by' : 'Coverage requested by'
  }

  if (request.involvement === 'claimed') {
    return request.type === 'swap' ? 'Suggested by' : 'Requested by'
  }

  if (request.type === 'pickup') {
    return request.visibility === 'direct' ? 'Asked teammate' : 'Picked up by'
  }

  return 'Trade with'
}

function getRequestTypeLabel(request: OpenRequest) {
  if (request.requestKind === 'call_in') {
    return 'Call-in coverage request'
  }

  return request.type === 'swap' ? 'Trade request' : 'Coverage request'
}

function getRequestPathLabel(request: OpenRequest) {
  if (request.visibility === 'direct') {
    return request.involvement === 'received_direct' ? 'Direct to you' : 'Direct teammate request'
  }

  return 'Open coverage requests'
}

function getRequestRoleLabel(request: OpenRequest, interestRoleLabel?: string) {
  if (request.involvement === 'posted') {
    return 'You posted this'
  }

  if (request.involvement === 'received_direct') {
    return 'Needs your decision'
  }

  if (request.involvement === 'interest') {
    return interestRoleLabel ?? 'You offered to help'
  }

  return 'You are the suggested partner'
}

function TimelineEntry({
  title,
  timeLabel,
  detail,
}: {
  title: string
  timeLabel: string
  detail: string
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <span className="text-xs text-muted-foreground">{timeLabel}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}
