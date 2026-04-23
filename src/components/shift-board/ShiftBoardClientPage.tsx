'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react'

import { MANAGER_WORKFLOW_LINKS } from '@/lib/workflow-links'
import { Button } from '@/components/ui/button'
import { groupPickupsBySlot } from '@/app/(app)/shift-board/prn-interest-helpers'
import { KpiTile } from '@/components/shift-board/shift-board-primitives'
import { ShiftBoardRequestList } from '@/components/shift-board/ShiftBoardRequestList'
import { ShiftBoardSummaryBanner } from '@/components/shift-board/ShiftBoardSummaryBanner'
import { ShiftBoardFilterBar, ShiftBoardTabs } from '@/components/shift-board/ShiftBoardToolbar'
import { ShiftBoardHeader } from '@/components/shift-board/ShiftBoardHeader'
import {
  countRequestsByStatus,
  filterShiftBoardRequests,
} from '@/components/shift-board/shift-board-logic'
import { type RequestType, type ShiftBoardInitialSnapshot } from '@/components/shift-board/types'
import { useShiftBoardState } from '@/components/shift-board/useShiftBoardState'

export default function ShiftBoardClientPage({
  initialSnapshot,
}: {
  initialSnapshot: ShiftBoardInitialSnapshot
}) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>(
    'pending'
  )
  const [typeFilter, setTypeFilter] = useState<'all' | RequestType>('all')
  const [scope, setScope] = useState<'mine' | 'all'>(
    initialSnapshot.role === 'therapist' ? 'mine' : 'all'
  )
  const [search, setSearch] = useState('')
  const {
    loading,
    error,
    requests,
    metrics,
    pendingCount,
    currentUserId,
    activeTab,
    setActiveTab,
    savingState,
    requestErrors,
    therapists,
    employmentType,
    swapPartners,
    setSwapPartners,
    overrideReasons,
    setOverrideReasons,
    scheduledByDate,
    canReview,
    isStaffRole,
    handleAction,
  } = useShiftBoardState(initialSnapshot)

  const pending = pendingCount

  const [staffBoardToolsOpen, setStaffBoardToolsOpen] = useState(
    initialSnapshot.requests.length > 0
  )
  const showFullShiftBoardChrome = canReview || staffBoardToolsOpen || requests.length > 0

  const pickupGroups = useMemo(() => groupPickupsBySlot(requests), [requests])
  const multiCandidateSlots = useMemo(
    () => pickupGroups.filter((group) => group.candidates.length >= 2),
    [pickupGroups]
  )
  const openPostCount = countRequestsByStatus(requests, 'pending')
  const approvedCount = countRequestsByStatus(requests, 'approved')
  const deniedCount = countRequestsByStatus(requests, 'denied')
  const needsCoverageAttention = canReview && (metrics.unfilled > 0 || metrics.missingLead > 0)

  const filtered = useMemo(() => {
    return filterShiftBoardRequests({
      activeTab,
      currentUserId,
      isStaffRole,
      requests,
      scope,
      search,
      statusFilter,
      typeFilter,
    })
  }, [activeTab, currentUserId, isStaffRole, requests, scope, search, statusFilter, typeFilter])

  const handleViewShift = useCallback(
    (shiftDate: string | null) => {
      if (canReview) {
        if (shiftDate) {
          router.push(`/coverage?date=${shiftDate}`)
          return
        }
        router.push('/coverage')
        return
      }

      const params = new URLSearchParams({ view: 'week' })
      if (shiftDate) {
        params.set('date', shiftDate)
      }
      router.push(`/schedule?${params.toString()}`)
    },
    [canReview, router]
  )

  return (
    <div className="space-y-5">
      <ShiftBoardHeader
        canReview={canReview}
        employmentType={employmentType}
        loading={loading}
        openPostCount={openPostCount}
        pending={pending}
        metrics={metrics}
        onOpenScheduleHome={() => router.push(MANAGER_WORKFLOW_LINKS.scheduleHome)}
      />

      {!showFullShiftBoardChrome && isStaffRole ? (
        <div className="px-6">
          <div className="rounded-xl border border-border bg-card px-5 py-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              No open swap or pickup posts right now. Use{' '}
              <span className="font-medium text-foreground">Post request</span> above to list one,
              or open tools to search, filter, and view history.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setStaffBoardToolsOpen(true)}
            >
              More filters &amp; history
            </Button>
          </div>
        </div>
      ) : null}

      {showFullShiftBoardChrome ? (
        <>
          <div className="grid grid-cols-2 gap-4 px-6 lg:grid-cols-4">
            <KpiTile
              label="Open posts"
              value={loading ? '--' : openPostCount}
              detail="Pending swap or pickup requests"
              icon={<Clock3 className="h-3.5 w-3.5" />}
            />
            <KpiTile
              label="Pending approvals"
              value={loading ? '--' : pending}
              detail="Requests awaiting manager decision"
              icon={<CalendarDays className="h-3.5 w-3.5" />}
            />
            <KpiTile
              label="Approved / denied"
              value={loading ? '--' : `${approvedCount}/${deniedCount}`}
              detail="Resolution history in this view"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <KpiTile
              label="Coverage risk"
              value={loading ? '--' : `${metrics.unfilled + metrics.missingLead}`}
              detail={needsCoverageAttention ? 'Coverage needs attention' : 'Coverage stable'}
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <ShiftBoardSummaryBanner
            canReview={canReview}
            loading={loading}
            metrics={metrics}
            onOpenScheduleHome={() => router.push(MANAGER_WORKFLOW_LINKS.scheduleHome)}
            onReviewApprovals={() => setStatusFilter('pending')}
          />
          <ShiftBoardTabs activeTab={activeTab} onSelectTab={setActiveTab} />

          <ShiftBoardFilterBar
            isStaffRole={isStaffRole}
            scope={scope}
            onScopeChange={setScope}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
          />

          <ShiftBoardRequestList
            canReview={canReview}
            defaultClearFilters={() => setTypeFilter('all')}
            filtered={filtered as never}
            handleAction={
              handleAction as (
                id: string,
                action: 'approve' | 'deny' | 'withdraw',
                opts?: { override?: boolean }
              ) => Promise<void> | void
            }
            handleViewShift={handleViewShift}
            loading={loading}
            multiCandidateSlots={multiCandidateSlots}
            overrideReasons={overrideReasons}
            requestErrors={requestErrors}
            savingState={savingState}
            scheduledByDate={scheduledByDate as never}
            setOverrideReasons={setOverrideReasons}
            setSearch={setSearch}
            setStatusFilter={setStatusFilter}
            setSwapPartners={setSwapPartners}
            setTypeFilter={setTypeFilter}
            statusFilter={statusFilter}
            swapPartners={swapPartners}
            therapists={therapists as never}
          />
        </>
      ) : null}
    </div>
  )
}
