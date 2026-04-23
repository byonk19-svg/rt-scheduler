'use client'

import { EmptyState } from '@/components/shift-board/shift-board-primitives'
import { ShiftBoardPrnCandidateSlots } from '@/components/shift-board/ShiftBoardPrnCandidateSlots'
import { ShiftBoardRequestCard } from '@/components/shift-board/ShiftBoardRequestCard'
import type { RequestType } from '@/components/shift-board/types'

type ShiftBoardRequestRow = {
  id: string
  shiftDate: string | null
  shiftRole: unknown
}

export function ShiftBoardRequestList({
  canReview,
  defaultClearFilters,
  filtered,
  handleAction,
  handleViewShift,
  loading,
  multiCandidateSlots,
  overrideReasons,
  requestErrors,
  savingState,
  scheduledByDate,
  setOverrideReasons,
  setSearch,
  setStatusFilter,
  setSwapPartners,
  setTypeFilter,
  statusFilter,
  swapPartners,
  therapists,
}: {
  canReview: boolean
  defaultClearFilters: () => void
  filtered: Array<
    ShiftBoardRequestRow & {
      [key: string]: unknown
    }
  >
  handleAction: (
    id: string,
    action: 'approve' | 'deny' | 'withdraw',
    opts?: { override?: boolean }
  ) => Promise<void> | void
  handleViewShift: (shiftDate: string | null) => void
  loading: boolean
  multiCandidateSlots: Array<{
    shiftId: string
    shiftLabel: string
    candidates: Array<{ id: string; poster: string; postedAt: string }>
  }>
  overrideReasons: Record<string, string>
  requestErrors: Record<string, string | undefined>
  savingState: Record<string, boolean>
  scheduledByDate: Map<string, Map<string, unknown>>
  setOverrideReasons: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setSearch: (value: string) => void
  setStatusFilter: (value: 'all' | 'pending' | 'approved' | 'denied') => void
  setSwapPartners: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setTypeFilter: (value: 'all' | RequestType) => void
  statusFilter: 'all' | 'pending' | 'approved' | 'denied'
  swapPartners: Record<string, string>
  therapists: unknown[]
}) {
  return (
    <div className="fade-up flex flex-col gap-3" style={{ animationDelay: '0.15s' }}>
      {canReview && multiCandidateSlots.length > 0 ? (
        <ShiftBoardPrnCandidateSlots
          groups={multiCandidateSlots}
          onSelectCandidate={(candidateId) => void handleAction(candidateId, 'approve')}
          savingState={savingState}
        />
      ) : null}

      {!loading && filtered.length === 0 ? (
        <EmptyState
          statusFilter={statusFilter}
          onClear={() => {
            setSearch('')
            setStatusFilter('all')
            setTypeFilter('all')
            defaultClearFilters()
          }}
        />
      ) : (
        filtered.map((request, index) => (
          <ShiftBoardRequestCard
            key={request.id}
            req={request as never}
            canReview={canReview}
            saving={Boolean(savingState[request.id])}
            error={requestErrors[request.id]}
            therapists={therapists as never}
            scheduledOnDate={scheduledByDate.get(request.shiftDate ?? '') ?? new Map()}
            shiftRole={request.shiftRole as never}
            swapPartnerId={swapPartners[request.id] ?? ''}
            onSwapPartnerChange={(partnerId) =>
              setSwapPartners((prev) => ({ ...prev, [request.id]: partnerId }))
            }
            overrideReason={overrideReasons[request.id] ?? ''}
            onOverrideReasonChange={(reason) =>
              setOverrideReasons((prev) => ({ ...prev, [request.id]: reason }))
            }
            onForceApprove={() => void handleAction(request.id, 'approve', { override: true })}
            onAction={(action) => void handleAction(request.id, action)}
            onViewShift={() => handleViewShift(request.shiftDate)}
            delay={index * 0.04}
          />
        ))
      )}
    </div>
  )
}
