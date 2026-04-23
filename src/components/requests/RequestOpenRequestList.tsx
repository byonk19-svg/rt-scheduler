'use client'

import { CalendarDays } from 'lucide-react'

import { RequestOpenRequestCard } from '@/components/requests/RequestOpenRequestCard'
import { Button } from '@/components/ui/button'
import { SkeletonListItem } from '@/components/ui/skeleton'
import type { OpenRequest } from '@/components/requests/request-types'

export function RequestOpenRequestList({
  loading,
  myOpenRequests,
  onNew,
}: {
  loading: boolean
  myOpenRequests: OpenRequest[]
  onNew: () => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </div>
    )
  }

  if (myOpenRequests.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mb-1 text-sm font-bold text-foreground">No requests yet</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Create a swap or pickup request to post it to the shift board.
        </p>
        <Button size="sm" onClick={onNew}>
          Start request
        </Button>
      </div>
    )
  }

  return (
    <>
      {myOpenRequests.map((request) => (
        <RequestOpenRequestCard key={request.id} request={request} />
      ))}
    </>
  )
}
