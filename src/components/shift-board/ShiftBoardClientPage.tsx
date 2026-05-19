'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Crown,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from 'lucide-react'

import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import {
  mutateShiftPost,
  type RequestKind,
  type RequestStatus as SharedRequestStatus,
  type RequestType,
  type RequestVisibility,
  type RecipientResponse,
} from '@/lib/request-workflow'
import type { ShiftRole, ShiftType } from '@/lib/shift-types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loadShiftBoardSnapshot } from '@/lib/shift-board-snapshot'
import { partitionPickupInterestQueue } from '@/lib/pickup-interest-presentation'
import { MIN_SHIFT_COVERAGE_PER_DAY } from '@/lib/scheduling-constants'

type Role = UiRole
type RequestStatus = Exclude<SharedRequestStatus, 'selected'>

type ProfileLookupRow = {
  id: string
  full_name: string | null
  role?: string | null
  is_lead_eligible?: boolean | null
  employment_type?: string | null
}

export type ShiftBoardRequest = {
  id: string
  type: RequestType
  visibility: RequestVisibility
  recipientResponse: RecipientResponse | null
  requestKind: RequestKind
  poster: string
  postedById: string | null
  avatar: string
  shift: string
  shiftDate: string | null
  shiftCycleId: string | null
  shiftId: string | null
  swapShift: string | null
  swapShiftDate: string | null
  swapShiftId: string | null
  swapShiftType: ShiftType | null
  swapShiftRole: ShiftRole | null
  message: string
  status: RequestStatus
  posted: string
  postedAt: string
  swapWithName: string | null
  swapWithId: string | null
  claimedById: string | null
  pendingInterestCount: number
  hasMyInterest: boolean
  myInterestId: string | null
  myInterestStatus: 'pending' | 'selected' | null
  interestCandidates: Array<{
    id: string
    therapistId: string
    therapistName: string
    createdAt: string
    status: 'pending' | 'selected'
  }>
  shiftType: ShiftType | null
  shiftRole: ShiftRole | null
  overrideReason: string | null
}

type MetricState = {
  unfilled: number
  missingLead: number
}

type ShiftBoardInitialSnapshot = {
  role: Role
  requests: ShiftBoardRequest[]
  metrics: MetricState
  pendingCount: number
  currentUserId: string
  therapists: ProfileLookupRow[]
  employmentType: string | null
  scheduledByDateEntries: Array<[string, Array<[string, ShiftType]>]>
  scheduledByCycleDateEntries: Array<[string, Array<[string, ShiftType]>]>
}

const HISTORY_STATUSES: RequestStatus[] = ['approved', 'denied', 'expired', 'withdrawn']
type ShiftBoardSection = 'needs-action' | 'open-shifts' | 'waiting' | 'history'
type TypeFilter = 'all' | RequestType | 'give-up'
type ShiftFilter = 'all' | ShiftType
type StatusFilter = 'all' | 'needs-action' | 'waiting' | 'no-responders' | 'approved' | 'denied'

const BOARD_SECTIONS: Array<{ id: ShiftBoardSection; label: string }> = [
  { id: 'needs-action', label: 'Needs Action' },
  { id: 'open-shifts', label: 'Open Shifts' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'history', label: 'History' },
]

function getRequestTypeLabel(req: ShiftBoardRequest): string {
  if (req.type === 'swap' && req.visibility === 'direct') return 'Direct Swap'
  if (req.type === 'swap') return req.swapWithId ? 'Swap' : 'Open Swap'
  if (req.requestKind === 'call_in') return 'Pickup'
  return 'Pickup'
}

function isWaitingOnTeammate(req: ShiftBoardRequest): boolean {
  return (
    req.status === 'pending' && req.visibility === 'direct' && req.recipientResponse !== 'accepted'
  )
}

function isOpenSwapWithoutPartner(req: ShiftBoardRequest): boolean {
  return (
    req.status === 'pending' && req.type === 'swap' && req.visibility === 'team' && !req.swapWithId
  )
}

function isPickupWithResponders(req: ShiftBoardRequest): boolean {
  return req.status === 'pending' && req.type === 'pickup' && req.pendingInterestCount > 0
}

function isPickupWithoutResponders(req: ShiftBoardRequest): boolean {
  return req.status === 'pending' && req.type === 'pickup' && req.pendingInterestCount === 0
}

function isReadyForManagerDecision(req: ShiftBoardRequest): boolean {
  if (req.status !== 'pending') return false
  if (isWaitingOnTeammate(req)) return false
  if (isPickupWithResponders(req)) return true
  if (req.type === 'swap') return Boolean(req.swapWithId)
  return false
}

function getPlainStateLabel(req: ShiftBoardRequest): string {
  if (req.status === 'approved') return 'Approved'
  if (req.status === 'denied') return 'Denied'
  if (req.status === 'withdrawn') return 'Withdrawn'
  if (req.status === 'expired') return 'Expired'
  if (isWaitingOnTeammate(req)) return 'Waiting on teammate'
  if (isPickupWithoutResponders(req)) return 'No responders yet'
  if (isOpenSwapWithoutPartner(req)) return 'Needs swap partner'
  if (isReadyForManagerDecision(req)) return 'Ready for decision'
  return 'Waiting'
}

function getStateTone(req: ShiftBoardRequest): 'success' | 'warning' | 'muted' | 'error' | 'info' {
  const state = getPlainStateLabel(req)
  if (state === 'Approved') return 'success'
  if (state === 'Denied') return 'error'
  if (state === 'Ready for decision' || state === 'Needs swap partner') return 'warning'
  if (state === 'Waiting on teammate' || state === 'No responders yet') return 'muted'
  return 'info'
}

function getToneClasses(tone: 'success' | 'warning' | 'muted' | 'error' | 'info'): string {
  if (tone === 'success') {
    return 'border-[var(--success-border)] bg-[var(--success-subtle)] text-[var(--success-text)]'
  }
  if (tone === 'warning') {
    return 'border-[var(--warning-border)] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
  }
  if (tone === 'error') {
    return 'border-[var(--error-border)] bg-[var(--error-subtle)] text-[var(--error-text)]'
  }
  if (tone === 'info') {
    return 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
  }
  return 'border-border bg-muted text-muted-foreground'
}

function countStaffForShift(
  scheduledOnDate: Map<string, ShiftType>,
  shiftType: ShiftType | null
): number {
  if (!shiftType) return scheduledOnDate.size
  return Array.from(scheduledOnDate.values()).filter((value) => value === shiftType).length
}

function getStaffingVerdict(staffCount: number): 'Below minimum' | 'Covered' | 'Target met' {
  if (staffCount < MIN_SHIFT_COVERAGE_PER_DAY) return 'Below minimum'
  if (staffCount === MIN_SHIFT_COVERAGE_PER_DAY) return 'Covered'
  return 'Target met'
}

function getStaffingTone(verdict: string): 'success' | 'error' {
  return verdict === 'Below minimum' ? 'error' : 'success'
}

function formatShiftType(value: ShiftType | null): string {
  if (value === 'day') return 'Day'
  if (value === 'night') return 'Night'
  return 'Shift'
}

function formatScheduleBlockRange(requests: ShiftBoardRequest[]): string {
  const dates = requests
    .map((request) => request.shiftDate)
    .filter((value): value is string => Boolean(value))
    .sort()
  if (dates.length === 0) return 'Current Schedule Block'
  const first = dates[0]
  const last = dates[dates.length - 1] ?? first
  const format = (value: string, includeYear: boolean) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: includeYear ? 'numeric' : undefined,
    })
  return first === last ? format(first, true) : `${format(first, false)} - ${format(last, true)}`
}

function getRequestMessageForDisplay(message: string): string | null {
  const trimmed = message.trim()
  if (!trimmed) return null
  if (/\b(seed|seeded|demo|test user)\b/i.test(trimmed)) return null
  return trimmed
    .replace(/\bcurrent primary pending claimant\b/gi, 'first responder')
    .replace(/\bpending claimant(s)?\b/gi, (_match, plural) =>
      plural ? 'pending responders' : 'pending responder'
    )
    .replace(/\bclaimant(s)?\b/gi, (_match, plural) => (plural ? 'responders' : 'responder'))
}

export function getRequestActionModel({
  req,
  canReview,
  hasSwapPartner,
  hasBackupResponder,
}: {
  req: Pick<
    ShiftBoardRequest,
    'status' | 'type' | 'visibility' | 'recipientResponse' | 'pendingInterestCount' | 'swapWithId'
  >
  canReview: boolean
  hasSwapPartner: boolean
  hasBackupResponder: boolean
}): { primary: string; secondary: string[]; showsApprove: boolean } {
  if (!canReview) {
    return {
      primary: req.type === 'pickup' && req.visibility === 'team' ? 'Respond' : 'View shift',
      secondary: req.type === 'pickup' && req.visibility === 'team' ? ['View shift'] : [],
      showsApprove: false,
    }
  }

  if (isWaitingOnTeammate(req as ShiftBoardRequest)) {
    return { primary: 'View request', secondary: ['Cancel request'], showsApprove: false }
  }

  if (isOpenSwapWithoutPartner(req as ShiftBoardRequest) && !hasSwapPartner) {
    return { primary: 'Choose partner', secondary: ['View shifts'], showsApprove: false }
  }

  if (isPickupWithoutResponders(req as ShiftBoardRequest)) {
    return {
      primary: 'View open post',
      secondary: ['Add coverage manually'],
      showsApprove: false,
    }
  }

  if (req.status !== 'pending') {
    return { primary: 'View shift', secondary: [], showsApprove: false }
  }

  if (req.type === 'swap') {
    return {
      primary: 'Approve swap',
      secondary: ['Deny request', 'View shifts'],
      showsApprove: true,
    }
  }

  return {
    primary: 'Approve pickup',
    secondary: [...(hasBackupResponder ? ['Change responder'] : []), 'Deny request', 'View shift'],
    showsApprove: true,
  }
}

function toReviewErrorMessage(message: string): string {
  return message.includes('Team-visible swap approvals require a swap partner')
    ? 'Cannot approve: this swap request has no partner assigned. Select a swap partner first.'
    : message.includes('shifts_unique_cycle_user_date')
      ? 'Cannot approve: the selected swap partner is already scheduled on this date.'
      : message.includes('partner shift type mismatch')
        ? 'Cannot approve: swap partners must be scheduled on the same shift type.'
        : message.includes('operational code')
          ? 'Cannot approve: shifts with active operational codes are locked from swaps.'
          : message.includes('working scheduled shift')
            ? 'Cannot approve: both swap partners must have working scheduled shifts.'
            : message.includes('Lead coverage gap')
              ? 'override:Lead coverage gap - approving this request would leave a shift without a lead. You can force-approve below.'
              : message.includes('Double booking')
                ? 'Cannot approve: double booking. This therapist is already assigned to this shift.'
                : 'Could not save this request. Refresh the board and try again.'
}

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

      const matchesType =
        typeFilter === 'all' ||
        request.type === typeFilter ||
        (typeFilter === 'give-up' && request.type === 'pickup')
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
          [id]: 'Please select a swap partner before approving.',
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
              ? 'Approve post-publish swaps, pickups, and give-up requests.'
              : 'Post swaps or pickups for the published schedule only. Team board and direct requests both live here.'}
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
          Published schedule changes only - swaps affect your published shifts.
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
              label="Open Shifts"
              detail="Open shifts to fill"
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
            ['swap', 'Swap'],
            ['pickup', 'Pickup'],
            ['give-up', 'Give Up'],
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

export function ManagerRequestCard({
  req,
  canReview,
  onPickupInterest,
  saving,
  interactiveEnabled,
  error,
  therapists,
  scheduledOnDate,
  scheduledOnSwapDate,
  shiftRole,
  swapPartnerId,
  onSwapPartnerChange,
  selectedPickupInterestId,
  onSelectPickupInterest,
  overrideReason,
  onOverrideReasonChange,
  onForceApprove,
  onAction,
  onViewShift,
  delay = 0,
}: {
  req: ShiftBoardRequest
  canReview: boolean
  onPickupInterest: () => void
  saving: boolean
  interactiveEnabled: boolean
  error?: string
  therapists: ProfileLookupRow[]
  scheduledOnDate: Map<string, ShiftType>
  scheduledOnSwapDate: Map<string, ShiftType>
  shiftRole: ShiftRole | null
  swapPartnerId: string
  onSwapPartnerChange: (id: string) => void
  selectedPickupInterestId: string | null
  onSelectPickupInterest: (id: string) => void
  overrideReason: string
  onOverrideReasonChange: (reason: string) => void
  onForceApprove: () => void
  onAction: (action: 'approve' | 'deny', opts?: { selectedInterestId?: string | null }) => void
  onViewShift: () => void
  delay?: number
}) {
  const isPending = req.status === 'pending'
  const pickupQueue =
    req.type === 'pickup' && req.visibility === 'team'
      ? partitionPickupInterestQueue(req.interestCandidates)
      : null
  const showsPartnerPicker =
    req.type === 'swap' && req.visibility === 'team' && isPending && canReview
  const needsLeadPartner = shiftRole === 'lead'
  const awaitingDirectAcceptance =
    req.visibility === 'direct' && req.recipientResponse !== 'accepted'
  // Filter to therapists working the same date and shift type; fall back to full list if coverage not loaded.
  const eligibleTherapists =
    scheduledOnDate.size > 0
      ? therapists.filter((t) => {
          if (t.id === req.postedById) return false
          if (t.id === req.swapWithId) return true
          if (!req.shiftType) return scheduledOnDate.has(t.id)
          return scheduledOnDate.get(t.id) === req.shiftType
        })
      : therapists.filter((t) => t.id !== req.postedById)
  const isOverrideableError = error?.startsWith('override:')
  const overrideMessage = isOverrideableError ? error!.slice('override:'.length).trim() : null
  const displayError = isOverrideableError ? null : error
  const stateLabel = getPlainStateLabel(req)
  const selectedPickupCandidate =
    pickupQueue?.orderedCandidates.find((candidate) => candidate.id === selectedPickupInterestId) ??
    pickupQueue?.primaryCandidate ??
    pickupQueue?.orderedCandidates[0] ??
    null
  const selectedResponderName = selectedPickupCandidate?.therapistName ?? null
  const swapPartnerName =
    req.swapWithName ??
    therapists.find((therapist) => therapist.id === swapPartnerId)?.full_name ??
    null
  const displayMessage = getRequestMessageForDisplay(req.message)
  const validApprovalAvailable = canReview && isReadyForManagerDecision(req)
  const approveSwapAvailable =
    canReview &&
    req.type === 'swap' &&
    isPending &&
    !awaitingDirectAcceptance &&
    Boolean(swapPartnerId)
  const requestTone =
    req.type === 'swap' ? 'info' : stateLabel === 'No responders yet' ? 'muted' : 'success'
  const railClass =
    requestTone === 'info'
      ? 'bg-[var(--info)] text-white'
      : requestTone === 'success'
        ? 'bg-[var(--success)] text-white'
        : 'bg-muted text-muted-foreground'
  const typeLabel = getRequestTypeLabel(req)

  return (
    <div
      className="fade-up scroll-mt-24 overflow-hidden rounded-xl border border-l-4 border-border bg-card shadow-sm transition-shadow hover:shadow-md"
      style={{
        animationDelay: `${delay}s`,
        borderLeftColor:
          requestTone === 'info'
            ? 'var(--info)'
            : requestTone === 'success'
              ? 'var(--success)'
              : 'var(--muted-foreground)',
      }}
    >
      <div className="flex flex-col gap-2 border-b border-border bg-background px-3 py-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm',
              railClass
            )}
          >
            {req.type === 'swap' ? (
              <ArrowRightLeft className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                  getToneClasses(req.type === 'swap' ? 'info' : 'success')
                )}
              >
                {typeLabel}
              </span>
              {req.requestKind === 'call_in' ? (
                <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--warning-text)]">
                  Call In help
                </span>
              ) : null}
            </div>
            <p className="break-words font-heading text-base font-semibold text-foreground">
              {typeLabel} - {req.shift}
            </p>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {req.type === 'swap'
                ? `${req.poster}${swapPartnerName ? ` swaps with ${swapPartnerName}` : ' needs a partner'}`
                : `Requested by ${req.poster}`}{' '}
              - {req.status === 'pending' ? 'Posted' : 'Updated'} {req.posted}
            </p>
            {displayMessage ? (
              <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">
                {displayMessage}
              </p>
            ) : null}
          </div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 self-start rounded-full border px-2 py-0.5 text-[11px] font-bold',
            stateLabel === 'Ready for decision'
              ? 'border-[var(--warning-border)] bg-background text-[var(--warning-text)]'
              : getToneClasses(getStateTone(req))
          )}
        >
          {stateLabel}
        </span>
      </div>

      <div className="grid gap-2.5 p-2.5 lg:grid-cols-[minmax(240px,0.9fr)_minmax(420px,1.45fr)_minmax(230px,0.75fr)]">
        <div>
          {awaitingDirectAcceptance ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {swapPartnerName ?? 'The teammate'} needs to respond before manager approval is
              available.
            </p>
          ) : null}
          {req.type === 'pickup' && pickupQueue ? (
            <ResponderQueue queue={pickupQueue} selectedId={selectedPickupCandidate?.id ?? null} />
          ) : null}
          {showsPartnerPicker ? (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                {req.swapWithId ? 'Review swap partner' : 'Choose swap partner'}
              </label>
              {needsLeadPartner ? (
                <p className="mb-2 text-xs text-[var(--warning-text)]">
                  Lead shift - choose a lead-eligible therapist.
                </p>
              ) : null}
              <select
                id={`swap-partner-${req.id}`}
                value={swapPartnerId}
                onChange={(event) => onSwapPartnerChange(event.target.value)}
                disabled={saving || !interactiveEnabled}
                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
              >
                <option value="">Choose partner</option>
                {eligibleTherapists.map((therapist) => {
                  const isLeadEligible = therapist.is_lead_eligible === true
                  const disabled = needsLeadPartner && !isLeadEligible
                  const shiftTypeLabel = scheduledOnDate.get(therapist.id)
                  return (
                    <option key={therapist.id} value={therapist.id} disabled={disabled}>
                      {therapist.full_name ?? therapist.id}
                      {shiftTypeLabel ? ` - ${shiftTypeLabel === 'day' ? 'Day' : 'Night'}` : ''}
                      {isLeadEligible ? ' (Lead)' : ''}
                      {disabled ? ' (not lead eligible)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          ) : null}
          {req.status === 'denied' && req.overrideReason ? (
            <p className="mt-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-2.5 py-1.5 text-xs text-[var(--error-text)]">
              Reason: {req.overrideReason}
            </p>
          ) : null}
          <RequestHistorySummary req={req} selectedResponderName={selectedResponderName} />
        </div>

        <div>
          <ScheduleImpactPreview
            req={req}
            scheduledOnDate={scheduledOnDate}
            scheduledOnSwapDate={scheduledOnSwapDate}
            selectedResponderName={selectedResponderName}
            selectedResponderId={selectedPickupCandidate?.therapistId ?? null}
            swapPartnerName={swapPartnerName}
          />
        </div>

        <RequestActionColumn
          req={req}
          canReview={canReview}
          saving={saving}
          interactiveEnabled={interactiveEnabled}
          validApprovalAvailable={validApprovalAvailable}
          approveSwapAvailable={approveSwapAvailable}
          selectedResponderName={selectedResponderName}
          hasBackupResponder={Boolean(pickupQueue && pickupQueue.backupCandidates.length > 0)}
          onChoosePartner={() => {
            window.setTimeout(() => {
              document.getElementById(`swap-partner-${req.id}`)?.focus()
            }, 0)
          }}
          onChooseDifferentResponder={() => {
            const backup = pickupQueue?.backupCandidates[0]
            if (backup) onSelectPickupInterest(backup.id)
          }}
          onPickupInterest={onPickupInterest}
          onApprove={() =>
            onAction('approve', { selectedInterestId: selectedPickupCandidate?.id ?? null })
          }
          onDeny={() => onAction('deny')}
          onViewShift={onViewShift}
        />
      </div>

      {displayError ? (
        <p
          role="alert"
          className="mx-3 mb-3 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs text-[var(--error-text)]"
        >
          {displayError}
        </p>
      ) : null}

      {isOverrideableError && canReview ? (
        <div className="mx-3 mb-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2.5">
          <p className="mb-2 text-xs font-semibold text-[var(--error-text)]">{overrideMessage}</p>
          <label className="mb-1 block text-xs font-medium text-[var(--error-text)]">
            Override reason <span className="font-normal opacity-70">(required)</span>
          </label>
          <input
            type="text"
            value={overrideReason}
            onChange={(event) => onOverrideReasonChange(event.target.value)}
            placeholder="e.g. lead coverage verified separately"
            disabled={saving}
            className="mb-2 h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={saving || !overrideReason.trim()}
            onClick={onForceApprove}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Force approve'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function ResponderQueue({
  queue,
  selectedId,
}: {
  queue: ReturnType<
    typeof partitionPickupInterestQueue<ShiftBoardRequest['interestCandidates'][number]>
  >
  selectedId: string | null
}) {
  if (queue.orderedCandidates.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">No responders yet.</p>
  }

  return (
    <div className="mt-2 space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-semibold leading-tight text-muted-foreground">
        <UsersRound className="h-3.5 w-3.5" aria-hidden />
        Responder queue - {queue.orderedCandidates.length}{' '}
        {queue.orderedCandidates.length === 1 ? 'responder' : 'responders'}
      </p>
      {queue.orderedCandidates.map((candidate, index) => {
        const selected = candidate.id === selectedId
        return (
          <div
            key={candidate.id}
            className={cn(
              'flex items-start gap-2 rounded-lg border px-2 py-1.5',
              selected
                ? 'border-l-4 border-[var(--success-border)] border-l-[var(--success)] bg-[var(--success-subtle)]/45'
                : 'border-border bg-muted/30'
            )}
          >
            <span
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                selected
                  ? 'bg-[var(--success)] text-white'
                  : 'bg-muted-foreground/20 text-muted-foreground'
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block whitespace-normal break-words text-sm font-semibold leading-tight text-foreground"
                title={candidate.therapistName}
              >
                {candidate.therapistName}
              </span>
              <span
                title={selected ? 'selected pickup responder' : 'backup responder'}
                className={cn(
                  'mt-0.5 block text-[10px] font-bold uppercase leading-tight',
                  selected ? 'text-[var(--success-text)]' : 'text-muted-foreground'
                )}
              >
                {selected ? 'Selected pickup responder' : 'Backup responder'}
              </span>
            </span>
            {selected ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]"
                aria-label="Selected responder"
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function RequestHistorySummary({
  req,
  selectedResponderName,
}: {
  req: ShiftBoardRequest
  selectedResponderName: string | null
}) {
  const [open, setOpen] = useState(false)
  const firstResponder = req.interestCandidates
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]
  const hasResponderHistory = req.type === 'pickup' && firstResponder

  return (
    <div className="mt-2 border-t border-border/70 pt-1.5 text-[11px] text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        aria-expanded={open}
      >
        <span>Request history</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open ? 'rotate-180' : '')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-1 rounded-md bg-muted/20 px-2.5 py-2">
          <p>Posted {req.posted}</p>
          {hasResponderHistory ? (
            <p className="mt-0.5">
              First response: {firstResponder.therapistName}
              {selectedResponderName ? `; selected pickup responder: ${selectedResponderName}` : ''}
            </p>
          ) : null}
          {req.type === 'swap' && req.swapWithName ? (
            <p className="mt-0.5">Swap partner: {req.swapWithName}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ScheduleImpactPreview({
  req,
  scheduledOnDate,
  scheduledOnSwapDate,
  selectedResponderName,
  selectedResponderId,
  swapPartnerName,
}: {
  req: ShiftBoardRequest
  scheduledOnDate: Map<string, ShiftType>
  scheduledOnSwapDate: Map<string, ShiftType>
  selectedResponderName: string | null
  selectedResponderId: string | null
  swapPartnerName: string | null
}) {
  const currentStaff = countStaffForShift(scheduledOnDate, req.shiftType)
  const selectedAlreadyOnShift =
    Boolean(selectedResponderId && req.shiftType) &&
    scheduledOnDate.get(selectedResponderId ?? '') === req.shiftType
  const afterPickupStaff =
    selectedResponderName && !selectedAlreadyOnShift ? currentStaff + 1 : currentStaff
  const afterCoverage = getStaffingVerdict(afterPickupStaff)
  const swapStaff = countStaffForShift(scheduledOnSwapDate, req.swapShiftType ?? req.shiftType)
  const swapShiftLabel =
    req.swapShift ?? `${swapPartnerName ?? 'Partner'} ${formatShiftType(req.swapShiftType)} shift`
  const pickupKeepsCallIn = req.type === 'pickup'
  const pickupStaffingLine =
    afterPickupStaff > MIN_SHIFT_COVERAGE_PER_DAY
      ? 'Staffing stays above target.'
      : afterPickupStaff === MIN_SHIFT_COVERAGE_PER_DAY
        ? 'Staffing stays at target.'
        : 'Staffing remains below target.'

  if (isWaitingOnTeammate(req)) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
        <Clock3 className="mx-auto h-4 w-4 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold text-foreground">
          Impact pending teammate response
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Manager approval will be available after {swapPartnerName ?? 'the teammate'} responds.
        </p>
      </div>
    )
  }

  if (req.type === 'swap') {
    return (
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Schedule Impact
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          {req.poster} and {swapPartnerName ?? 'the selected partner'} trade assigned shifts;
          staffing count does not change.
        </p>
        <div className="grid gap-2 lg:grid-cols-[minmax(8rem,1fr)_auto_minmax(8rem,1fr)_minmax(16rem,1.15fr)]">
          <ImpactMiniCard
            eyebrow="Affected shift"
            title={req.shift}
            lines={[
              `Before: ${req.poster} on`,
              `After: ${swapPartnerName ?? 'Partner'} on`,
              `${currentStaff || MIN_SHIFT_COVERAGE_PER_DAY} scheduled / target ${MIN_SHIFT_COVERAGE_PER_DAY}`,
            ]}
            verdict="Staffing unchanged"
          />
          <span className="hidden items-center text-muted-foreground lg:flex">
            <ArrowRight className="h-4 w-4" />
          </span>
          <ImpactMiniCard
            eyebrow="Counterpart shift"
            title={swapShiftLabel}
            lines={[
              `Before: ${swapPartnerName ?? 'Partner'} on`,
              `After: ${req.poster} on`,
              `${swapStaff || MIN_SHIFT_COVERAGE_PER_DAY} scheduled / target ${MIN_SHIFT_COVERAGE_PER_DAY}`,
            ]}
            verdict="Staffing unchanged"
          />
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 text-xs leading-normal text-muted-foreground">
            <p className="font-semibold text-foreground">Coverage summary</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ImpactBadge>
                <ShieldCheck className="h-3 w-3" aria-hidden />
                No coverage risk
              </ImpactBadge>
              <ImpactBadge>Staffing unchanged</ImpactBadge>
              <ImpactBadge>
                <Crown className="h-3 w-3" aria-hidden />
                Lead covered
              </ImpactBadge>
            </div>
            <p className="mt-2 text-[11px] leading-normal">
              Both shifts remain at or above minimum staffing.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Schedule Impact
      </p>
      <div className="rounded-lg border border-border bg-background px-3 py-2.5">
        <p className="text-sm font-semibold leading-snug text-foreground">
          {selectedResponderName ?? 'The selected responder'} will be added to {req.shift}.
        </p>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          {pickupKeepsCallIn
            ? `The original call-in remains on the schedule. ${pickupStaffingLine}`
            : `The selected responder is added separately. ${pickupStaffingLine}`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {afterPickupStaff} scheduled / target {MIN_SHIFT_COVERAGE_PER_DAY}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ImpactBadge tone={getStaffingTone(afterCoverage)}>
            {afterCoverage === 'Below minimum' ? 'Below minimum' : 'Target met'}
          </ImpactBadge>
          <ImpactBadge>
            <Crown className="h-3 w-3" aria-hidden />
            Lead covered
          </ImpactBadge>
          <ImpactBadge tone={getStaffingTone(afterCoverage)}>
            {afterCoverage === 'Below minimum' ? 'Coverage risk' : 'No coverage risk'}
          </ImpactBadge>
        </div>
      </div>
    </div>
  )
}

function ImpactBadge({
  children,
  tone = 'success',
}: {
  children: ReactNode
  tone?: 'success' | 'error'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        getToneClasses(tone)
      )}
    >
      {children}
    </span>
  )
}

function ImpactMiniCard({
  eyebrow,
  title,
  lines,
  verdict,
  tone = 'success',
}: {
  eyebrow: string
  title: string
  lines: string[]
  verdict: string
  tone?: 'success' | 'error'
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
        {eyebrow}
      </p>
      <p className="mt-1 text-xs font-bold leading-tight text-foreground">{title}</p>
      <div className="mt-1 space-y-0.5">
        {lines.map((line) => (
          <p
            key={line}
            className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground"
          >
            {line === 'Lead covered' ? <Crown className="h-3 w-3" /> : null}
            {line}
          </p>
        ))}
      </div>
      <span
        className={cn(
          'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold leading-tight',
          getToneClasses(tone)
        )}
      >
        {verdict}
      </span>
    </div>
  )
}

function getActionNote(req: ShiftBoardRequest, selectedResponderName: string | null): string {
  if (isWaitingOnTeammate(req)) {
    return `Approval unlocks after ${req.swapWithName ?? 'the teammate'} responds.`
  }
  if (isOpenSwapWithoutPartner(req)) {
    return 'Choose the teammate before manager approval is available.'
  }
  if (isPickupWithoutResponders(req)) {
    return 'No responder has volunteered yet; fill the shift manually or keep watching.'
  }
  if (req.type === 'swap') {
    return 'Ready because staffing remains safe after the exchange.'
  }
  if (req.type === 'pickup') {
    return `Ready because ${selectedResponderName ?? 'the selected responder'} is selected and coverage remains safe.`
  }
  return `Ready because ${selectedResponderName ?? 'the selected responder'} is selected for this shift.`
}

function DecisionSummary({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
      <p className="mb-0.5 font-semibold text-foreground">Decision summary</p>
      <p>{children}</p>
    </div>
  )
}

function RequestActionColumn({
  req,
  canReview,
  saving,
  interactiveEnabled,
  validApprovalAvailable,
  approveSwapAvailable,
  selectedResponderName,
  hasBackupResponder,
  onChoosePartner,
  onChooseDifferentResponder,
  onPickupInterest,
  onApprove,
  onDeny,
  onViewShift,
}: {
  req: ShiftBoardRequest
  canReview: boolean
  saving: boolean
  interactiveEnabled: boolean
  validApprovalAvailable: boolean
  approveSwapAvailable: boolean
  selectedResponderName: string | null
  hasBackupResponder: boolean
  onChoosePartner: () => void
  onChooseDifferentResponder: () => void
  onPickupInterest: () => void
  onApprove: () => void
  onDeny: () => void
  onViewShift: () => void
}) {
  const disabled = saving || !interactiveEnabled
  const actionNote = getActionNote(req, selectedResponderName)
  if (!canReview) {
    return (
      <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
        {req.type === 'pickup' && req.visibility === 'team' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={!interactiveEnabled}
            onClick={onPickupInterest}
          >
            {req.hasMyInterest ? 'Withdraw interest' : 'Respond'}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={onViewShift}>
          View shift
        </Button>
      </div>
    )
  }

  if (isWaitingOnTeammate(req)) {
    return (
      <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
        <DecisionSummary>{actionNote}</DecisionSummary>
        <Button size="sm" onClick={onViewShift}>
          View request
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-[var(--error-border)] text-[var(--error-text)]"
          disabled={disabled}
          onClick={onDeny}
        >
          Cancel request
        </Button>
      </div>
    )
  }

  if (isOpenSwapWithoutPartner(req) && !approveSwapAvailable) {
    return (
      <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
        <DecisionSummary>{actionNote}</DecisionSummary>
        <Button size="sm" disabled={disabled} onClick={onChoosePartner}>
          Choose partner
        </Button>
        <Button size="sm" variant="outline" onClick={onViewShift}>
          View shifts
        </Button>
      </div>
    )
  }

  if (isPickupWithoutResponders(req)) {
    return (
      <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
        <DecisionSummary>{actionNote}</DecisionSummary>
        <Button size="sm" onClick={onViewShift}>
          View open post
        </Button>
        <Button size="sm" variant="outline" onClick={onViewShift}>
          Add coverage manually
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-2.5 lg:sticky lg:top-20 lg:self-start">
      <DecisionSummary>{actionNote}</DecisionSummary>
      {validApprovalAvailable || approveSwapAvailable ? (
        <Button
          size="sm"
          disabled={disabled}
          onClick={onApprove}
          className="whitespace-normal leading-tight"
        >
          {saving ? 'Saving...' : req.type === 'swap' ? 'Approve swap' : 'Approve pickup'}
        </Button>
      ) : null}
      {req.type === 'pickup' && hasBackupResponder ? (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onChooseDifferentResponder}
          className="whitespace-normal leading-tight"
        >
          Change responder
        </Button>
      ) : null}
      {isPendingRequest(req) ? (
        <Button
          size="sm"
          variant="outline"
          className="border-[var(--error-border)] text-[var(--error-text)]"
          disabled={disabled}
          onClick={onDeny}
        >
          Deny request
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={onViewShift}>
        {req.type === 'swap' ? 'View shifts' : 'View shift'}
      </Button>
    </div>
  )
}

function isPendingRequest(req: ShiftBoardRequest): boolean {
  return req.status === 'pending'
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
              Open Shifts - {openPostCount}
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
