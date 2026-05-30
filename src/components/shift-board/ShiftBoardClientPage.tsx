'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Search,
  ShieldAlert,
  UsersRound,
} from 'lucide-react'

import { can } from '@/lib/auth/can'
import { mutateShiftPost } from '@/lib/request-workflow'
import type { ShiftType } from '@/lib/shift-types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loadShiftBoardSnapshot } from '@/lib/shift-board-snapshot'

import { ManagerRequestCard } from './ShiftBoardRequestCard'
import {
  BOARD_SECTIONS,
  HISTORY_STATUSES,
  formatScheduleBlockRange,
  getPlainStateLabel,
  getRequestTypeLabel,
  getToneClasses,
  isReadyForManagerDecision,
  isWaitingOnTeammate,
  toReviewErrorMessage,
  type MetricState,
  type ProfileLookupRow,
  type Role,
  type ShiftBoardInitialSnapshot,
  type ShiftBoardRequest,
  type ShiftBoardSection,
  type ShiftFilter,
  type StatusFilter,
  type TypeFilter,
} from './shift-board-model'

export { ManagerRequestCard } from './ShiftBoardRequestCard'
export { getRequestActionModel } from './shift-board-model'
export type { ShiftBoardRequest } from './shift-board-model'

export default function ShiftBoardClientPage({
  initialSnapshot,
}: {
  initialSnapshot: ShiftBoardInitialSnapshot
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const initialServerSnapshotConsumedRef = useRef(true)
  const [isHydrated, setIsHydrated] = useState(false)

  const [role, setRole] = useState<Role>(initialSnapshot.role)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<ShiftBoardRequest[]>(initialSnapshot.requests)
  const [metrics, setMetrics] = useState<MetricState>(initialSnapshot.metrics)
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialSnapshot.currentUserId)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<ShiftBoardSection>('needs-action')
  const [savingState, setSavingState] = useState<Record<string, boolean>>({})
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({})
  const [therapists, setTherapists] = useState<ProfileLookupRow[]>(initialSnapshot.therapists)
  const [swapPartners, setSwapPartners] = useState<Record<string, string>>({})
  const [selectedPickupInterestIds, setSelectedPickupInterestIds] = useState<
    Record<string, string>
  >({})
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({})
  const [scheduledByDate, setScheduledByDate] = useState<Map<string, Map<string, ShiftType>>>(
    () =>
      new Map(
        initialSnapshot.scheduledByDateEntries.map(([date, entries]) => [date, new Map(entries)])
      )
  )
  const [scheduledByCycleDate, setScheduledByCycleDate] = useState<
    Map<string, Map<string, ShiftType>>
  >(
    () =>
      new Map(
        initialSnapshot.scheduledByCycleDateEntries.map(([key, entries]) => [key, new Map(entries)])
      )
  )

  const loadBoard = useCallback(
    async (tab: ShiftBoardSection) => {
      setLoading(true)
      setError(null)
      setRequestErrors({})

      try {
        const snapshot = await loadShiftBoardSnapshot({
          supabase,
          tab: tab === 'history' ? 'history' : 'open',
        })
        if (snapshot.unauthorized) {
          router.replace('/login')
          return
        }
        setCurrentUserId(snapshot.currentUserId)
        setRole(snapshot.role)
        setTherapists(snapshot.therapists as ProfileLookupRow[])
        setScheduledByDate(
          new Map(
            snapshot.scheduledByDateEntries.map(([date, entries]) => [date, new Map(entries)])
          )
        )
        setScheduledByCycleDate(
          new Map(
            snapshot.scheduledByCycleDateEntries.map(([key, entries]) => [key, new Map(entries)])
          )
        )
        setRequests(snapshot.requests as ShiftBoardRequest[])
        setMetrics(snapshot.metrics as MetricState)
      } catch (loadError) {
        console.error('Failed to load shift board:', loadError)
        setError('Could not load shift board data. Refresh and try again.')
      } finally {
        setLoading(false)
      }
    },
    [router, supabase]
  )

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (initialServerSnapshotConsumedRef.current && activeTab === 'needs-action') {
      initialServerSnapshotConsumedRef.current = false
      return
    }
    initialServerSnapshotConsumedRef.current = false
    void loadBoard(activeTab)
  }, [activeTab, loadBoard])

  const canReview = can(role, 'review_shift_posts')
  const isStaffRole = !canReview

  useEffect(() => {
    setScope(isStaffRole ? 'mine' : 'all')
  }, [isStaffRole])

  const openPostCount = requests.filter(
    (request) =>
      request.status === 'pending' &&
      request.visibility === 'team' &&
      !isReadyForManagerDecision(request)
  ).length
  const needsActionCount = requests.filter(isReadyForManagerDecision).length
  const waitingCount = requests.filter(isWaitingOnTeammate).length
  const approvedCount = requests.filter((request) => request.status === 'approved').length
  const deniedCount = requests.filter((request) => request.status === 'denied').length
  const needsCoverageAttention = canReview && (metrics.unfilled > 0 || metrics.missingLead > 0)
  const scheduleBlockLabel = useMemo(() => formatScheduleBlockRange(requests), [requests])
  const tabCounts = useMemo(
    () =>
      ({
        'needs-action': needsActionCount,
        'open-shifts': openPostCount,
        waiting: waitingCount,
        history: approvedCount + deniedCount,
      }) satisfies Record<ShiftBoardSection, number>,
    [approvedCount, deniedCount, needsActionCount, openPostCount, waitingCount]
  )

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const scopedRequests =
      isStaffRole && scope === 'mine' && currentUserId
        ? requests.filter(
            (request) =>
              request.postedById === currentUserId ||
              request.claimedById === currentUserId ||
              request.hasMyInterest
          )
        : requests

    return scopedRequests.filter((request) => {
      if (activeTab === 'history' && !HISTORY_STATUSES.includes(request.status)) {
        return false
      }

      if (activeTab !== 'history' && HISTORY_STATUSES.includes(request.status)) {
        return false
      }

      if (activeTab === 'needs-action' && !isReadyForManagerDecision(request)) return false
      if (
        activeTab === 'open-shifts' &&
        !(
          request.status === 'pending' &&
          request.visibility === 'team' &&
          !isReadyForManagerDecision(request)
        )
      ) {
        return false
      }
      if (activeTab === 'waiting' && !isWaitingOnTeammate(request)) return false

      const requestState = getPlainStateLabel(request)
      const matchesStatus =
        statusFilter === 'all' ||
        request.status === statusFilter ||
        (statusFilter === 'needs-action' && requestState === 'Ready for decision') ||
        (statusFilter === 'waiting' && requestState === 'Waiting on teammate') ||
        (statusFilter === 'no-responders' && requestState === 'No responders yet')
      if (!matchesStatus) {
        return false
      }

      const matchesType = typeFilter === 'all' || request.type === typeFilter
      if (!matchesType) {
        return false
      }

      const matchesShift = shiftFilter === 'all' || request.shiftType === shiftFilter
      if (!matchesShift) return false

      if (normalizedSearch.length === 0) {
        return true
      }

      const haystack =
        `${request.poster} ${request.swapWithName ?? ''} ${request.message} ${request.shift} ${getRequestTypeLabel(request)} ${getPlainStateLabel(request)}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [
    activeTab,
    currentUserId,
    isStaffRole,
    requests,
    scope,
    search,
    shiftFilter,
    statusFilter,
    typeFilter,
  ])

  const waitingPreviewRequests = useMemo(
    () => requests.filter(isWaitingOnTeammate).slice(0, 3),
    [requests]
  )

  const handlePickupInterest = useCallback(
    async (request: ShiftBoardRequest) => {
      if (!currentUserId || request.type !== 'pickup' || request.visibility !== 'team') return

      setSavingState((current) => ({ ...current, [request.id]: true }))
      setError(null)

      try {
        if (request.hasMyInterest && request.myInterestId) {
          await mutateShiftPost({
            action: 'withdraw_interest',
            interestId: request.myInterestId,
          })
        } else {
          await mutateShiftPost({
            action: 'express_interest',
            requestId: request.id,
          })
        }

        await loadBoard(activeTab)
      } catch (mutationError) {
        console.error('Failed to update pickup interest:', mutationError)
        setError('Could not update pickup interest. Please try again.')
      } finally {
        setSavingState((current) => ({ ...current, [request.id]: false }))
      }
    },
    [activeTab, currentUserId, loadBoard]
  )

  const handleAction = useCallback(
    async (
      id: string,
      action: 'approve' | 'deny',
      opts?: { override?: boolean; selectedInterestId?: string | null }
    ) => {
      if (!canReview) return

      setRequestErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      const request = requests.find((row) => row.id === id)
      const selectedSwapPartnerId =
        action === 'approve' && request?.type === 'swap'
          ? swapPartners[id] || request?.swapWithId || null
          : null
      if (
        action === 'approve' &&
        request?.type === 'swap' &&
        request.visibility === 'team' &&
        !selectedSwapPartnerId
      ) {
        setRequestErrors((prev) => ({
          ...prev,
          [id]: 'Please select a trade partner before approving.',
        }))
        return
      }

      setSavingState((current) => ({ ...current, [id]: true }))
      setError(null)

      try {
        await mutateShiftPost({
          action: 'review_request',
          requestId: id,
          decision: action,
          selectedInterestId: opts?.selectedInterestId ?? selectedPickupInterestIds[id] ?? null,
          swapPartnerId: selectedSwapPartnerId,
          override: opts?.override === true,
          overrideReason: overrideReasons[id] ?? null,
        })
        await loadBoard(activeTab)
      } catch (updateError) {
        const message =
          updateError instanceof Error ? updateError.message : 'Could not save action.'
        console.error('Failed to save action:', message)
        setRequestErrors((prev) => ({ ...prev, [id]: toReviewErrorMessage(message) }))
      } finally {
        setSavingState((current) => ({ ...current, [id]: false }))
      }
    },
    [
      activeTab,
      canReview,
      loadBoard,
      overrideReasons,
      requests,
      selectedPickupInterestIds,
      swapPartners,
    ]
  )

  const handleViewShift = useCallback(
    (shiftDate: string | null) => {
      if (canReview) {
        if (shiftDate) {
          router.push(`/schedule?date=${shiftDate}`)
          return
        }
        router.push('/schedule')
        return
      }

      if (shiftDate) {
        router.push(`/schedule?date=${shiftDate}`)
        return
      }
      router.push('/schedule')
    },
    [canReview, router]
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Shift Board
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {canReview
              ? 'Approve post-publish trade and coverage requests.'
              : 'Post trade requests or coverage requests for the published schedule only. Team board and direct requests both live here.'}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[29rem]">
          <ContextChip
            label="Schedule Block"
            value={scheduleBlockLabel}
            icon={<CalendarDays className="h-3.5 w-3.5" />}
          />
          <ContextChip
            label="Shift Visibility"
            value={canReview ? 'All Shifts' : 'Your shift'}
            icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
          />
          <ContextChip
            label="Access"
            value={canReview ? 'Manager final approval' : 'Staff request view'}
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {!canReview ? (
        <div className="rounded-[10px] bg-muted px-4 py-3 text-sm text-muted-foreground">
          Published schedule changes only - trade requests affect your published shifts.
        </div>
      ) : null}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="fade-up flex border-b border-border bg-background/80 px-3 pt-2">
        {BOARD_SECTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative -mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.id !== 'history' ? (
              <span
                className={cn(
                  'inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  activeTab === tab.id ? 'bg-[var(--warning-subtle)]' : 'bg-muted'
                )}
              >
                {loading ? '--' : tabCounts[tab.id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {canReview ? (
        <div
          className="fade-up rounded-xl border border-border bg-card shadow-sm"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="grid gap-0 divide-y divide-border/70 p-3 md:grid-cols-4 md:divide-x md:divide-y-0">
            <SummaryItem
              label="Needs Action"
              detail="Requests need your decision"
              value={loading ? '--' : needsActionCount}
              variant={!loading && needsActionCount > 0 ? 'warning' : 'success'}
              icon={<CircleAlert className="h-4 w-4" />}
            />
            <SummaryItem
              label="Open coverage requests"
              detail="Coverage requests to fill"
              value={loading ? '--' : openPostCount}
              variant={!loading && openPostCount > 0 ? 'info' : 'success'}
              icon={<UsersRound className="h-4 w-4" />}
            />
            <SummaryItem
              label="Waiting"
              detail="Waiting on teammates"
              value={loading ? '--' : waitingCount}
              variant={!loading && waitingCount > 0 ? 'info' : 'success'}
              icon={<Clock3 className="h-4 w-4" />}
            />
            <SummaryItem
              label="Coverage Risk"
              detail={needsCoverageAttention ? 'Shifts below target' : 'Coverage stable'}
              value={loading ? '--' : metrics.unfilled + metrics.missingLead}
              variant={!loading && needsCoverageAttention ? 'error' : 'success'}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </div>
        </div>
      ) : null}
      {/* Filter bar */}
      <div
        className="fade-up flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
        style={{ animationDelay: '0.1s' }}
      >
        {isStaffRole && (
          <div className="flex gap-1">
            <FilterPill
              label="My Requests"
              active={scope === 'mine'}
              onClick={() => setScope('mine')}
            />
            <FilterPill
              label="All Posts"
              active={scope === 'all'}
              onClick={() => setScope('all')}
            />
          </div>
        )}
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search requests, names, or shifts..."
            className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <FilterButtonGroup
          label="Request type"
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as TypeFilter)}
          options={[
            ['all', 'All Types'],
            ['swap', 'Trade'],
            ['pickup', 'Coverage'],
          ]}
        />
        <FilterButtonGroup
          label="Shift"
          value={shiftFilter}
          onChange={(value) => setShiftFilter(value as ShiftFilter)}
          options={[
            ['all', 'All shifts'],
            ['day', 'Day'],
            ['night', 'Night'],
          ]}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as StatusFilter)}
          options={[
            ['all', 'All statuses'],
            ['needs-action', 'Ready for decision'],
            ['waiting', 'Waiting on teammate'],
            ['no-responders', 'No responders yet'],
            ['approved', 'Approved'],
            ['denied', 'Denied'],
          ]}
        />
      </div>

      {/* Cards */}
      <div className="fade-up flex flex-col gap-3" style={{ animationDelay: '0.15s' }}>
        {!loading && filtered.length === 0 ? (
          <EmptyState
            activeTab={activeTab}
            openPostCount={openPostCount}
            waitingCount={waitingCount}
            onClear={() => {
              setSearch('')
              setStatusFilter('all')
              setTypeFilter('all')
              setShiftFilter('all')
            }}
            onViewOpenShifts={() => setActiveTab('open-shifts')}
            onViewWaiting={() => setActiveTab('waiting')}
          />
        ) : (
          filtered.map((request, index) => (
            <ManagerRequestCard
              key={request.id}
              req={request}
              canReview={canReview}
              onPickupInterest={() => void handlePickupInterest(request)}
              saving={Boolean(savingState[request.id])}
              interactiveEnabled={isHydrated}
              error={requestErrors[request.id]}
              therapists={therapists}
              scheduledOnDate={
                scheduledByCycleDate.get(
                  `${request.shiftCycleId ?? ''}:${request.shiftDate ?? ''}`
                ) ??
                scheduledByDate.get(request.shiftDate ?? '') ??
                new Map()
              }
              scheduledOnSwapDate={
                scheduledByCycleDate.get(
                  `${request.shiftCycleId ?? ''}:${request.swapShiftDate ?? ''}`
                ) ??
                scheduledByDate.get(request.swapShiftDate ?? '') ??
                new Map()
              }
              shiftRole={request.shiftRole}
              swapPartnerId={swapPartners[request.id] ?? request.swapWithId ?? ''}
              onSwapPartnerChange={(partnerId) =>
                setSwapPartners((prev) => ({ ...prev, [request.id]: partnerId }))
              }
              selectedPickupInterestId={selectedPickupInterestIds[request.id] ?? null}
              onSelectPickupInterest={(interestId) =>
                setSelectedPickupInterestIds((current) => ({
                  ...current,
                  [request.id]: interestId,
                }))
              }
              overrideReason={overrideReasons[request.id] ?? ''}
              onOverrideReasonChange={(reason) =>
                setOverrideReasons((prev) => ({ ...prev, [request.id]: reason }))
              }
              onForceApprove={() => void handleAction(request.id, 'approve', { override: true })}
              onAction={(action, opts) => void handleAction(request.id, action, opts)}
              onViewShift={() => handleViewShift(request.shiftDate)}
              delay={index * 0.04}
            />
          ))
        )}
      </div>

      {!loading &&
      canReview &&
      activeTab === 'needs-action' &&
      filtered.length > 0 &&
      filtered.length <= 2 ? (
        <LowVolumeQueueSummary
          needsActionCount={filtered.length}
          openPostCount={openPostCount}
          waitingCount={waitingCount}
        />
      ) : null}

      {!loading &&
      canReview &&
      activeTab === 'needs-action' &&
      waitingPreviewRequests.length > 0 ? (
        <WaitingPreviewPanel
          requests={waitingPreviewRequests}
          onViewWaiting={() => setActiveTab('waiting')}
        />
      ) : null}
    </div>
  )
}

function LowVolumeQueueSummary({
  needsActionCount,
  openPostCount,
  waitingCount,
}: {
  needsActionCount: number
  openPostCount: number
  waitingCount: number
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
      Showing {needsActionCount} manager {needsActionCount === 1 ? 'decision' : 'decisions'}.
      Everything else is tracked as {openPostCount} open {openPostCount === 1 ? 'post' : 'posts'}{' '}
      and {waitingCount} waiting {waitingCount === 1 ? 'request' : 'requests'}.
    </div>
  )
}

export function WaitingPreviewPanel({
  requests,
  onViewWaiting,
}: {
  requests: ShiftBoardRequest[]
  onViewWaiting: () => void
}) {
  return (
    <div className="fade-up rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Waiting nearby
          </span>
          <span className="min-w-0 text-xs text-muted-foreground">
            {requests.length} blocked by teammate response, so{' '}
            {requests.length === 1 ? 'it stays' : 'they stay'} out of Needs Action.
          </span>
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {requests.map((request) => (
              <span
                key={request.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <span className="font-semibold text-foreground">{request.shift}</span>
                <span className="truncate">
                  {request.swapWithName ?? 'Teammate'} has not responded
                </span>
              </span>
            ))}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onViewWaiting}>
          View Waiting
        </Button>
      </div>
    </div>
  )
}

function SummaryItem({
  label,
  detail,
  value,
  variant,
  icon,
}: {
  label: string
  detail: string
  value: number | string
  variant: 'warning' | 'error' | 'success' | 'info'
  icon: ReactNode
}) {
  const colorClass =
    variant === 'warning'
      ? 'text-[var(--warning-text)]'
      : variant === 'error'
        ? 'text-[var(--error-text)]'
        : variant === 'info'
          ? 'text-[var(--info-text)]'
          : 'text-[var(--success-text)]'
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold',
          getToneClasses(variant === 'info' ? 'info' : variant)
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-foreground">{label}</span>
        <span className={cn('block text-xl font-bold leading-none', colorClass)}>{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </div>
  )
}

function ContextChip({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <span className="min-w-0">
          <span className="block text-[11px] font-medium text-muted-foreground">{label}</span>
          <span className="block truncate text-xs font-semibold text-foreground">{value}</span>
        </span>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  const id = `shift-board-filter-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  )
}

function FilterButtonGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          className={cn(
            'h-9 rounded-md border px-3 text-xs font-semibold transition-colors',
            value === optionValue
              ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-primary-foreground shadow-sm'
              : 'border-border bg-card text-foreground hover:border-[color:var(--primary)]/40 hover:bg-muted/60'
          )}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  )
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-9 rounded-md border px-3 text-xs font-semibold transition-colors',
        active
          ? 'border border-primary bg-transparent text-primary'
          : 'border border-transparent bg-muted text-muted-foreground hover:bg-secondary'
      )}
    >
      {label}
    </button>
  )
}

export function EmptyState({
  activeTab,
  openPostCount,
  waitingCount,
  onClear,
  onViewOpenShifts,
  onViewWaiting,
}: {
  activeTab: ShiftBoardSection
  openPostCount: number
  waitingCount: number
  onClear: () => void
  onViewOpenShifts: () => void
  onViewWaiting: () => void
}) {
  const allClear = activeTab === 'needs-action'
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
      <div className="mx-auto mb-4 flex justify-center">
        {allClear ? (
          <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
        ) : (
          <Search className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <p className="mb-1 text-base font-semibold text-foreground">
        {allClear ? 'No manager decisions right now' : 'No results found'}
      </p>
      <p className="mb-4 text-sm text-muted-foreground">
        {allClear
          ? 'Open posts and teammate responses are still tracked below.'
          : 'Try adjusting your search or filters.'}
      </p>
      {allClear ? (
        <div className="mx-auto grid max-w-xl gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onViewOpenShifts}
            className="rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <span className="block font-semibold text-foreground">
              Open coverage requests - {openPostCount}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Review posts that still need a responder.
            </span>
          </button>
          <button
            type="button"
            onClick={onViewWaiting}
            className="rounded-lg border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <span className="block font-semibold text-foreground">Waiting - {waitingCount}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Check requests blocked by teammate response.
            </span>
          </button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
