'use client'

import { Plus } from 'lucide-react'

import { ManagerWorkspaceHeader } from '@/components/manager/ManagerWorkspaceHeader'
import { RequestOpenRequestList } from '@/components/requests/RequestOpenRequestList'
import { Button } from '@/components/ui/button'
import type { OpenRequest } from '@/components/requests/request-types'

export function RequestListView({
  loading,
  myOpenRequests,
  onNew,
}: {
  loading: boolean
  myOpenRequests: OpenRequest[]
  onNew: () => void
}) {
  const pendingCount = myOpenRequests.filter((request) => request.status === 'pending').length
  const approvedCount = myOpenRequests.filter((request) => request.status === 'approved').length
  const totalRequests = myOpenRequests.length

  return (
    <div className="space-y-6">
      <ManagerWorkspaceHeader
        title="My Requests"
        subtitle="Track your swap and pickup requests."
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
          <Button size="sm" onClick={onNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New request
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold text-foreground">How requests work</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Submit a swap or pickup request and your manager will review it. Check this page for
            status updates.
          </p>
        </div>

        <RequestOpenRequestList loading={loading} myOpenRequests={myOpenRequests} onNew={onNew} />
      </div>
    </div>
  )
}
