'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Search,
  ShieldAlert,
} from 'lucide-react'

import { can } from '@/lib/auth/can'
import type { UiRole } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loadShiftBoardSnapshot } from '@/lib/shift-board-snapshot'
import { groupPickupsBySlot } from '@/app/(app)/shift-board/prn-interest-helpers'

type Role = UiRole
type RequestType = 'swap' | 'pickup'
type RequestStatus = 'pending' | 'approved' | 'denied' | 'expired'
type ShiftType = 'day' | 'night'
type ShiftRole = 'lead' | 'staff'

type ProfileLookupRow = {
  id: string
  full_name: string | null
  role?: string | null
  is_lead_eligible?: boolean | null
  employment_type?: string | null
}

type ShiftBoardRequest = {
  id: string
  type: RequestType
  poster: string
  postedById: string | null
  avatar: string
  shift: string
  shiftDate: string | null
  shiftId: string | null
  message: string
  status: RequestStatus
  posted: string
  postedAt: string
  swapWithName: string | null
  swapWithId: string | null
  claimedById: string | null
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
}

const STATUS_META: Record<
  RequestStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: 'Pending',
    color: 'var(--warning-text)',
    bg: 'var(--warning-subtle)',
    border: 'var(--warning-border)',
  },
  approved: {
    label: 'Approved',
    color: 'var(--success-text)',
    bg: 'var(--success-subtle)',
    border: 'var(--success-border)',
  },
  denied: {
    label: 'Denied',
    color: 'var(--error-text)',
    bg: 'var(--error-subtle)',
    border: 'var(--error-border)',
  },
  expired: {
    label: 'Expired',
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
    border: 'var(--border)',
  },
}

const TYPE_META: Record<RequestType, { label: string; color: string; bg: string; border: string }> =
  {
    swap: {
      label: 'Swap',
      color: 'var(--info-text)',
      bg: 'var(--info-subtle)',
      border: 'var(--info-border)',
    },
    pickup: {
      label: 'Pickup',
      color: 'var(--primary)',
      bg: 'var(--secondary)',
      border: 'var(--border)',
    },
  }

const HISTORY_STATUSES: RequestStatus[] = ['approved', 'denied', 'expired']

export default function ShiftBoardClientPage({
  initialSnapshot,
}: {
  initialSnapshot: ShiftBoardInitialSnapshot
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const initialServerSnapshotConsumedRef = useRef(true)

  const [role, setRole] = useState<Role>(initialSnapshot.role)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<ShiftBoardRequest[]>(initialSnapshot.requests)
  const [metrics, setMetrics] = useState<MetricState>(initialSnapshot.metrics)
  const [pendingCount, setPendingCount] = useState(initialSnapshot.pendingCount)
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialSnapshot.currentUserId)

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>(
    'pending'
  )
  const [typeFilter, setTypeFilter] = useState<'all' | RequestType>('all')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open')
  const [savingState, setSavingState] = useState<Record<string, boolean>>({})
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({})
  const [therapists, setTherapists] = useState<ProfileLookupRow[]>(initialSnapshot.therapists)
  const [employmentType, setEmploymentType] = useState<string | null>(
    initialSnapshot.employmentType
  )
  const [swapPartners, setSwapPartners] = useState<Record<string, string>>({})
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({})
  const [scheduledByDate, setScheduledByDate] = useState<Map<string, Map<string, ShiftType>>>(
    () =>
      new Map(
        initialSnapshot.scheduledByDateEntries.map(([date, entries]) => [date, new Map(entries)])
      )
  )

  const loadBoard = useCallback(
    async (tab: 'open' | 'history') => {
      setLoading(true)
      setError(null)
      setRequestErrors({})

      try {
        const snapshot = await loadShiftBoardSnapshot({ supabase, tab })
        if (snapshot.unauthorized) {
          router.replace('/login')
          return
        }
        setCurrentUserId(snapshot.currentUserId)
        setRole(snapshot.role)
        setEmploymentType(snapshot.employmentType)
        setPendingCount(snapshot.pendingCount)
        setTherapists(snapshot.therapists as ProfileLookupRow[])
        setScheduledByDate(
          new Map(
            snapshot.scheduledByDateEntries.map(([date, entries]) => [date, new Map(entries)])
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
    if (initialServerSnapshotConsumedRef.current && activeTab === 'open') {
      initialServerSnapshotConsumedRef.current = false
      return
    }
    initialServerSnapshotConsumedRef.current = false
    void loadBoard(activeTab)
  }, [activeTab, loadBoard])

  const pending = pendingCount
  const canReview = can(role, 'review_shift_posts')
  const isStaffRole = !canReview

  useEffect(() => {
    setScope(isStaffRole ? 'mine' : 'all')
  }, [isStaffRole])

  const pickupGroups = useMemo(() => groupPickupsBySlot(requests), [requests])
  const multiCandidateSlots = useMemo(
    () => pickupGroups.filter((group) => group.candidates.length >= 2),
    [pickupGroups]
  )
  const openPostCount = requests.filter((request) => request.status === 'pending').length
  const approvedCount = requests.filter((request) => request.status === 'approved').length
  const deniedCount = requests.filter((request) => request.status === 'denied').length
  const needsCoverageAttention = canReview && (metrics.unfilled > 0 || metrics.missingLead > 0)

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const scopedRequests =
      isStaffRole && scope === 'mine' && currentUserId
        ? requests.filter(
            (request) =>
              request.postedById === currentUserId || request.claimedById === currentUserId
          )
        : requests

    return scopedRequests.filter((request) => {
      if (activeTab === 'history' && !HISTORY_STATUSES.includes(request.status)) {
        return false
      }

      if (activeTab === 'open' && request.status === 'expired' && statusFilter !== 'all') {
        return false
      }

      const matchesStatus = statusFilter === 'all' || request.status === statusFilter
      if (!matchesStatus) {
        return false
      }

      const matchesType = typeFilter === 'all' || request.type === typeFilter
      if (!matchesType) {
        return false
      }

      if (normalizedSearch.length === 0) {
        return true
      }

      const haystack = `${request.poster} ${request.message} ${request.shift}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [activeTab, currentUserId, isStaffRole, requests, scope, search, statusFilter, typeFilter])

  const handleAction = useCallback(
    async (id: string, action: 'approve' | 'deny', opts?: { override?: boolean }) => {
      if (!canReview) return

      const previousRequest = requests.find((request) => request.id === id) ?? null

      setRequestErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })

      // If override requested, persist manager_override + reason before status update
      if (opts?.override) {
        setSavingState((current) => ({ ...current, [id]: true }))
        const { error: overrideError } = await supabase
          .from('shift_posts')
          .update({
            manager_override: true,
            override_reason: overrideReasons[id]?.trim() || 'Manager override',
          })
          .eq('id', id)
        if (overrideError) {
          console.error('Failed to set manager override:', overrideError.message)
          setRequestErrors((prev) => ({
            ...prev,
            [id]: 'Could not set override. Please try again.',
          }))
          setSavingState((current) => ({ ...current, [id]: false }))
          return
        }
      }

      // For swap approvals with no partner yet, assign claimed_by first
      if (action === 'approve') {
        const req = requests.find((r) => r.id === id)
        if (req?.type === 'swap' && !req.swapWithId) {
          const partnerId = swapPartners[id]
          if (!partnerId) {
            setRequestErrors((prev) => ({
              ...prev,
              [id]: 'Please select a swap partner before approving.',
            }))
            return
          }
          setSavingState((current) => ({ ...current, [id]: true }))
          const { error: partnerError } = await supabase
            .from('shift_posts')
            .update({ claimed_by: partnerId })
            .eq('id', id)
          if (partnerError) {
            console.error('Failed to assign swap partner:', partnerError.message)
            setRequestErrors((prev) => ({
              ...prev,
              [id]: 'Could not assign swap partner. Please try again.',
            }))
            setSavingState((current) => ({ ...current, [id]: false }))
            return
          }
          // Reflect the partner locally so the card updates immediately
          const partnerName = therapists.find((t) => t.id === partnerId)?.full_name ?? 'Unknown'
          setRequests((current) =>
            current.map((r) =>
              r.id === id ? { ...r, swapWithId: partnerId, swapWithName: partnerName } : r
            )
          )
        }
      }

      const nextStatus: RequestStatus = action === 'approve' ? 'approved' : 'denied'
      const previousRequests = requests

      setRequests((current) =>
        current.map((request) => {
          if (request.id !== id) return request
          return { ...request, status: nextStatus }
        })
      )

      setSavingState((current) => ({ ...current, [id]: true }))
      setError(null)

      const { error: updateError } = await supabase
        .from('shift_posts')
        .update({ status: nextStatus })
        .eq('id', id)

      if (updateError) {
        console.error('Failed to save action:', updateError.message)
        setRequests(previousRequests)
        setError('Could not save request update. Changes were rolled back.')
        const msg = updateError.message.includes('no swap partner assigned')
          ? 'Cannot approve: this swap request has no partner assigned. Select a swap partner first.'
          : updateError.message.includes('shifts_unique_cycle_user_date')
            ? 'Cannot approve: the selected swap partner is already scheduled on this date.'
            : updateError.message.includes('partner shift type mismatch')
              ? 'Cannot approve: swap partners must be scheduled on the same shift type.'
              : updateError.message.includes('operational code')
                ? 'Cannot approve: shifts with active operational codes are locked from swaps.'
                : updateError.message.includes('is not working')
                  ? 'Cannot approve: both swap partners must have working scheduled shifts.'
                  : updateError.message.includes('Lead coverage gap')
                    ? 'override:Lead coverage gap - approving this request would leave a shift without a lead. You can force-approve below.'
                    : updateError.message.includes('Double booking')
                      ? 'Cannot approve: double booking. This therapist is already assigned to this shift.'
                      : `Could not save: ${updateError.message}`
        setRequestErrors((prev) => ({ ...prev, [id]: msg }))
        setSavingState((current) => ({ ...current, [id]: false }))
        return
      }

      if (previousRequest?.status === 'pending') {
        setPendingCount((current) => Math.max(current - 1, 0))
      }
      setSavingState((current) => ({ ...current, [id]: false }))
    },
    [canReview, overrideReasons, requests, supabase, swapPartners, therapists]
  )

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
      <div className="rounded-2xl border border-border/70 bg-card px-6 pb-4 pt-5 shadow-tw-float">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Open shifts
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {canReview
                ? 'Review and approve swap and pickup requests in the live schedule.'
                : 'Post swaps or pickups for the published schedule only.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5 text-muted-foreground">
                {loading ? '--' : openPostCount} open
              </span>
              <span className="rounded-full border border-border/70 bg-muted/20 px-2 py-0.5 text-muted-foreground">
                {loading ? '--' : pending} pending
              </span>
              {canReview ? (
                <span className="rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2 py-0.5 text-[var(--warning-text)]">
                  {loading ? '--' : metrics.unfilled + metrics.missingLead} needs attention
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => router.push('/requests/new')}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {!canReview && employmentType === 'prn' ? 'Express interest' : 'Post request'}
            </Button>
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link href="/availability">Future availability</Link>
            </Button>
            {!canReview && (
              <Button asChild size="sm" variant="outline" className="text-xs">
                <Link href="/staff/history">View my history</Link>
              </Button>
            )}
            {canReview && (
              <Button asChild size="sm" variant="outline" className="text-xs">
                <Link href="/coverage">Open coverage</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

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
      {/* Summary banner */}
      {canReview ? (
        <div
          className="fade-up rounded-xl border border-[var(--warning-border)] bg-[var(--warning-subtle)]/25 shadow-sm"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex flex-wrap items-center gap-6">
              <SummaryItem
                label="Pending approvals"
                value={loading ? '--' : pending}
                variant={!loading && pending > 0 ? 'warning' : 'success'}
              />
              <div className="hidden h-8 w-px self-center bg-border lg:block" />
              <SummaryItem
                label="Unfilled shifts"
                value={loading ? '--' : metrics.unfilled}
                variant={!loading && metrics.unfilled > 0 ? 'error' : 'success'}
              />
              <div className="hidden h-8 w-px self-center bg-border lg:block" />
              <SummaryItem
                label="Missing lead"
                value={loading ? '--' : metrics.missingLead}
                variant={!loading && metrics.missingLead > 0 ? 'error' : 'success'}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setStatusFilter('pending')}>
                Review approvals
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push('/requests/new')}>
                New request
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="fade-up rounded-xl border border-border bg-card px-5 py-4 shadow-sm"
          style={{ animationDelay: '0.05s' }}
        >
          <p className="text-sm font-semibold text-foreground">Published schedule changes only</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This board is not for future-cycle planning. For the next schedule cycle, open Future
            Availability.
          </p>
        </div>
      )}
      {/* Tabs */}
      <div className="fade-up flex gap-1" style={{ animationDelay: '0.08s' }}>
        {(
          [
            { id: 'open' as const, label: 'Open Posts' },
            { id: 'history' as const, label: 'History' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'h-9 rounded-lg border px-4 text-sm font-semibold transition-colors',
              activeTab === tab.id
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-secondary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, message, or shift..."
            className="h-9 w-full rounded-md border border-border bg-[var(--input-background)] pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'pending', 'approved', 'denied'] as const).map((status) => (
            <FilterPill
              key={status}
              label={status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              active={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', 'swap', 'pickup'] as const).map((type) => (
            <FilterPill
              key={type}
              label={type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              active={typeFilter === type}
              onClick={() => setTypeFilter(type)}
            />
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="fade-up flex flex-col gap-3" style={{ animationDelay: '0.15s' }}>
        {canReview && multiCandidateSlots.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              PRN Interest - Multiple Candidates
            </p>
            {multiCandidateSlots.map((group) => (
              <div key={group.shiftId} className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">
                  {group.shiftLabel}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {group.candidates.length} interested
                  </span>
                </p>
                <div className="space-y-2">
                  {group.candidates.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {candidate.poster}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(candidate.postedAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={savingState[candidate.id]}
                        onClick={() => void handleAction(candidate.id, 'approve')}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {savingState[candidate.id] ? 'Selecting...' : 'Select'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {!loading && filtered.length === 0 ? (
          <EmptyState
            statusFilter={statusFilter}
            onClear={() => {
              setSearch('')
              setStatusFilter('all')
              setTypeFilter('all')
            }}
          />
        ) : (
          filtered.map((request, index) => (
            <RequestCard
              key={request.id}
              req={request}
              canReview={canReview}
              saving={Boolean(savingState[request.id])}
              error={requestErrors[request.id]}
              therapists={therapists}
              scheduledOnDate={scheduledByDate.get(request.shiftDate ?? '') ?? new Map()}
              shiftRole={request.shiftRole}
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
    </div>
  )
}

function SummaryItem({
  label,
  value,
  variant,
}: {
  label: string
  value: number | string
  variant: 'warning' | 'error' | 'success'
}) {
  const colorClass =
    variant === 'warning'
      ? 'text-[var(--warning-text)]'
      : variant === 'error'
        ? 'text-[var(--error-text)]'
        : 'text-[var(--success-text)]'
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('text-2xl font-bold leading-none', colorClass)}>{value}</span>
      <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function KpiTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: number | string
  detail: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
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
          ? 'border-primary bg-primary/10 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_35%,transparent)]'
          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
      )}
    >
      {label}
    </button>
  )
}

function RequestCard({
  req,
  canReview,
  saving,
  error,
  therapists,
  scheduledOnDate,
  shiftRole,
  swapPartnerId,
  onSwapPartnerChange,
  overrideReason,
  onOverrideReasonChange,
  onForceApprove,
  onAction,
  onViewShift,
  delay = 0,
}: {
  req: ShiftBoardRequest
  canReview: boolean
  saving: boolean
  error?: string
  therapists: ProfileLookupRow[]
  scheduledOnDate: Map<string, ShiftType>
  shiftRole: ShiftRole | null
  swapPartnerId: string
  onSwapPartnerChange: (id: string) => void
  overrideReason: string
  onOverrideReasonChange: (reason: string) => void
  onForceApprove: () => void
  onAction: (action: 'approve' | 'deny') => void
  onViewShift: () => void
  delay?: number
}) {
  const statusMeta = STATUS_META[req.status]
  const typeMeta = TYPE_META[req.type]
  const isPending = req.status === 'pending'
  const needsPartner = req.type === 'swap' && !req.swapWithId && isPending && canReview
  const needsLeadPartner = shiftRole === 'lead'
  // Filter to therapists working the same date and shift type; fall back to full list if coverage not loaded.
  const eligibleTherapists =
    scheduledOnDate.size > 0
      ? therapists.filter((t) => {
          if (!req.shiftType) return scheduledOnDate.has(t.id)
          return scheduledOnDate.get(t.id) === req.shiftType
        })
      : therapists
  const isOverrideableError = error?.startsWith('override:')
  const overrideMessage = isOverrideableError ? error!.slice('override:'.length).trim() : null
  const displayError = isOverrideableError ? null : error

  return (
    <div
      className={cn(
        'fade-up rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm',
        isPending ? 'border-[var(--warning-border)] shadow-sm' : 'border-border'
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--attention)]">
          <span className="text-xs font-bold text-accent-foreground">{req.avatar}</span>
        </div>

        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{req.poster}</span>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                color: typeMeta.color,
                background: typeMeta.bg,
                borderColor: typeMeta.border,
              }}
            >
              {typeMeta.label}
            </span>
            <span
              className="ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                color: statusMeta.color,
                background: statusMeta.bg,
                borderColor: statusMeta.border,
              }}
            >
              {statusMeta.label}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{req.posted}</span>
          </div>

          {/* Shift chip */}
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1">
            <CalendarDays className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{req.shift}</span>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{req.message}</p>
          {req.swapWithName && (
            <p className="mt-1 text-xs text-muted-foreground">
              Swap with: <span className="font-medium text-foreground">{req.swapWithName}</span>
            </p>
          )}
          {req.status === 'denied' && req.overrideReason && (
            <p className="mt-1.5 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-2.5 py-1.5 text-xs text-[var(--error-text)]">
              Reason: {req.overrideReason}
            </p>
          )}
        </div>
      </div>

      {/* Swap partner picker - shown when no partner is assigned yet */}
      {needsPartner && (
        <div className="mt-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--warning-text)]">
              Select swap partner
            </label>
            {needsLeadPartner && (
              <span className="rounded-full bg-[var(--warning)] px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                Lead shift - lead-eligible only
              </span>
            )}
          </div>
          {eligibleTherapists.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No therapists with a shift on this date found.
            </p>
          ) : (
            <select
              value={swapPartnerId}
              onChange={(e) => onSwapPartnerChange(e.target.value)}
              disabled={saving}
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none disabled:opacity-60"
            >
              <option value="">-- Choose a therapist --</option>
              {eligibleTherapists.map((t) => {
                const isLeadEligible = t.is_lead_eligible === true
                const disabled = needsLeadPartner && !isLeadEligible
                const shiftTypeLabel = scheduledOnDate.get(t.id)
                const label = [
                  t.full_name ?? t.id,
                  shiftTypeLabel ? `- ${shiftTypeLabel === 'day' ? 'Day' : 'Night'}` : '',
                  isLeadEligible ? '(Lead)' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <option key={t.id} value={t.id} disabled={disabled}>
                    {label}
                    {disabled ? ' (not lead eligible)' : ''}
                  </option>
                )
              })}
            </select>
          )}
        </div>
      )}

      {isPending && canReview && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            className="min-h-9 flex-1"
            disabled={saving || (needsPartner && !swapPartnerId)}
            onClick={() => onAction('approve')}
          >
            {saving ? 'Saving...' : 'Approve'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-9 flex-1 border-[var(--error-border)] text-[var(--error-text)] hover:bg-[var(--error-subtle)]"
            disabled={saving}
            onClick={() => onAction('deny')}
          >
            Deny
          </Button>
          <Button size="sm" variant="outline" onClick={onViewShift}>
            View shift
          </Button>
        </div>
      )}

      {displayError && (
        <p
          role="alert"
          className="mt-2 rounded-md border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2 text-xs text-[var(--error-text)]"
        >
          {displayError}
        </p>
      )}

      {/* Manager override panel - shown when a soft constraint can be bypassed */}
      {isOverrideableError && canReview && (
        <div className="mt-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-3 py-2.5">
          <p className="mb-2 text-xs font-semibold text-[var(--error-text)]">{overrideMessage}</p>
          <label className="mb-1 block text-xs font-medium text-[var(--error-text)]">
            Override reason <span className="font-normal opacity-70">(required)</span>
          </label>
          <input
            type="text"
            value={overrideReason}
            onChange={(e) => onOverrideReasonChange(e.target.value)}
            placeholder="e.g. backup lead confirmed separately"
            disabled={saving}
            className="mb-2 h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none disabled:opacity-60"
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
      )}

      {(!isPending || !canReview) && (
        <div className="mt-3 flex justify-end border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={onViewShift}>
            View shift
          </Button>
        </div>
      )}
    </div>
  )
}

function EmptyState({ statusFilter, onClear }: { statusFilter: string; onClear: () => void }) {
  const allClear = statusFilter === 'pending'
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
      <div
        className={cn(
          'mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border',
          allClear
            ? 'border-[var(--success-border)] bg-[var(--success-subtle)]'
            : 'border-border bg-muted'
        )}
      >
        {allClear ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--success-text)]" />
        ) : (
          <Search className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <p className="mb-1 text-sm font-bold text-foreground">
        {allClear ? "You're all caught up" : 'No results found'}
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        {allClear
          ? 'No pending requests right now. Check back later.'
          : 'Try adjusting your search or filters.'}
      </p>
      <Button size="sm" variant="outline" onClick={onClear}>
        {allClear ? 'View all posts' : 'Clear filters'}
      </Button>
    </div>
  )
}
