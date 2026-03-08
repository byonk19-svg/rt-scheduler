'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CalendarDays, CheckCircle2, Search } from 'lucide-react'

import { can } from '@/lib/auth/can'
import { toUiRole, type UiRole } from '@/lib/auth/roles'
import { dateKeyFromDate, buildDateRange } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'

type Role = UiRole
type RequestType = 'swap' | 'pickup'
type RequestStatus = 'pending' | 'approved' | 'denied' | 'expired'
type PersistedRequestStatus = 'pending' | 'approved' | 'denied' | 'expired'
type ShiftType = 'day' | 'night'
type ShiftStatus = 'scheduled' | 'on_call' | 'sick' | 'called_off'
type ShiftRole = 'lead' | 'staff'

type ShiftPostRow = {
  id: string
  shift_id: string | null
  posted_by: string | null
  claimed_by: string | null
  message: string
  type: RequestType
  status: PersistedRequestStatus
  created_at: string
}

type ShiftLookupRow = {
  id: string
  date: string
  shift_type: ShiftType
  role: ShiftRole
}

type ProfileLookupRow = {
  id: string
  full_name: string | null
  role?: string | null
  is_lead_eligible?: boolean | null
}

type CycleRow = {
  id: string
  start_date: string
  end_date: string
}

type ShiftCoverageRow = {
  date: string
  shift_type: ShiftType
  status: ShiftStatus
  role: ShiftRole
  user_id: string | null
}

type ShiftBoardRequest = {
  id: string
  type: RequestType
  poster: string
  avatar: string
  shift: string
  shiftDate: string | null
  message: string
  status: RequestStatus
  posted: string
  postedAt: string
  swapWithName: string | null
  swapWithId: string | null
  shiftType: ShiftType | null
  shiftRole: ShiftRole | null
}

type MetricState = {
  unfilled: number
  missingLead: number
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatShiftLabel(isoDate: string, shiftType: ShiftType): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return `${isoDate} - ${shiftType === 'day' ? 'Day' : 'Night'}`
  }
  const day = parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return `${day} - ${shiftType === 'day' ? 'Day' : 'Night'}`
}

function formatRelativeTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const seconds = Math.round((parsed.getTime() - Date.now()) / 1000)
  const absSeconds = Math.abs(seconds)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (absSeconds < 60) return rtf.format(seconds, 'second')
  if (absSeconds < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (absSeconds < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  return rtf.format(Math.round(seconds / 86400), 'day')
}

function countsTowardCoverage(status: ShiftStatus): boolean {
  return status === 'scheduled' || status === 'on_call'
}

function toUiStatus(
  status: PersistedRequestStatus,
  shiftDate: string | null,
  todayKey: string
): RequestStatus {
  if (status === 'pending' && shiftDate !== null && shiftDate < todayKey) {
    return 'expired'
  }
  return status
}

export default function ShiftBoardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [role, setRole] = useState<Role>('therapist')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<ShiftBoardRequest[]>([])
  const [metrics, setMetrics] = useState<MetricState>({ unfilled: 0, missingLead: 0 })
  const [pendingCount, setPendingCount] = useState(0)

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>(
    'pending'
  )
  const [typeFilter, setTypeFilter] = useState<'all' | RequestType>('all')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open')
  const [savingState, setSavingState] = useState<Record<string, boolean>>({})
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({})
  const [therapists, setTherapists] = useState<ProfileLookupRow[]>([])
  const [swapPartners, setSwapPartners] = useState<Record<string, string>>({})
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({})
  const [scheduledByDate, setScheduledByDate] = useState<Map<string, Map<string, ShiftType>>>(
    new Map()
  )

  // Load full therapist list once for partner picker
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, is_lead_eligible')
        .eq('role', 'therapist')
        .eq('is_active', true)
        .order('full_name')
      setTherapists((data ?? []) as ProfileLookupRow[])
    })()
  }, [supabase])

  const loadBoard = useCallback(
    async (tab: 'open' | 'history') => {
      setLoading(true)
      setError(null)
      setRequestErrors({})

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.replace('/login')
          return
        }

        const todayKey = dateKeyFromDate(new Date())
        let postsQuery = supabase
          .from('shift_posts')
          .select('id, shift_id, posted_by, claimed_by, message, type, status, created_at')
          .order('created_at', { ascending: false })

        if (tab === 'open') {
          postsQuery = postsQuery.neq('status', 'expired')
        } else {
          postsQuery = postsQuery.in('status', HISTORY_STATUSES).limit(50)
        }

        const [profileResult, cyclesResult, pendingPostsResult, postsResult] = await Promise.all([
          supabase.from('profiles').select('id, full_name, role').eq('id', user.id).maybeSingle(),
          supabase
            .from('schedule_cycles')
            .select('id, start_date, end_date')
            .order('start_date', { ascending: false })
            .limit(24),
          supabase
            .from('shift_posts')
            .select('id', { head: true, count: 'exact' })
            .eq('status', 'pending'),
          postsQuery,
        ])

        const profile = (profileResult.data ?? null) as ProfileLookupRow | null
        const nextRole: Role = toUiRole(profile?.role)
        setRole(nextRole)
        setPendingCount(pendingPostsResult.count ?? 0)

        const cycles = (cyclesResult.data ?? []) as CycleRow[]
        const activeCycle =
          cycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ??
          cycles[0] ??
          null

        let unfilled = 0
        let missingLead = 0

        if (activeCycle) {
          const { data: coverageData, error: coverageError } = await supabase
            .from('shifts')
            .select('date, shift_type, status, role, user_id')
            .eq('cycle_id', activeCycle.id)
            .gte('date', activeCycle.start_date)
            .lte('date', activeCycle.end_date)

          if (coverageError) {
            console.error(
              'Failed to load shift coverage metrics for requests board:',
              coverageError
            )
          } else {
            const bySlot = new Map<string, ShiftCoverageRow[]>()
            const dateMap = new Map<string, Map<string, ShiftType>>()
            for (const row of (coverageData ?? []) as ShiftCoverageRow[]) {
              const key = `${row.date}:${row.shift_type}`
              const bucket = bySlot.get(key) ?? []
              bucket.push(row)
              bySlot.set(key, bucket)
              // Build per-date scheduled user map for swap picker
              if (row.user_id) {
                let userMap = dateMap.get(row.date)
                if (!userMap) {
                  userMap = new Map()
                  dateMap.set(row.date, userMap)
                }
                if (!userMap.has(row.user_id)) {
                  userMap.set(row.user_id, row.shift_type)
                }
              }
            }
            setScheduledByDate(dateMap)

            for (const date of buildDateRange(activeCycle.start_date, activeCycle.end_date)) {
              for (const shiftType of ['day', 'night'] as const) {
                const slotRows = bySlot.get(`${date}:${shiftType}`) ?? []
                const activeRows = slotRows.filter((row) => countsTowardCoverage(row.status))
                const assignedCount = activeRows.length
                const leadCount = activeRows.filter((row) => row.role === 'lead').length

                if (assignedCount === 0) unfilled += 1
                if (leadCount === 0) missingLead += 1
              }
            }
          }
        }

        const postRows = (postsResult.data ?? []) as ShiftPostRow[]
        const shiftIds = Array.from(
          new Set(
            postRows.map((row) => row.shift_id).filter((value): value is string => Boolean(value))
          )
        )

        let shiftsById = new Map<string, ShiftLookupRow>()
        if (shiftIds.length > 0) {
          const { data: shiftsData } = await supabase
            .from('shifts')
            .select('id, date, shift_type, role')
            .in('id', shiftIds)

          shiftsById = new Map(((shiftsData ?? []) as ShiftLookupRow[]).map((row) => [row.id, row]))
        }

        const profileIds = Array.from(
          new Set(
            postRows
              .flatMap((row) => [row.posted_by, row.claimed_by])
              .filter((value): value is string => Boolean(value))
          )
        )

        let namesById = new Map<string, string>()
        if (profileIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', profileIds)

          namesById = new Map(
            ((profileRows ?? []) as ProfileLookupRow[]).map((row) => [
              row.id,
              row.full_name ?? 'Unknown',
            ])
          )
        }

        const mappedRequests = postRows.map((row) => {
          const shift = row.shift_id ? shiftsById.get(row.shift_id) : null
          const posterName = row.posted_by
            ? (namesById.get(row.posted_by) ?? 'Unknown therapist')
            : 'Unknown therapist'
          const shiftLabel = shift
            ? formatShiftLabel(shift.date, shift.shift_type)
            : 'Shift unavailable'

          return {
            id: row.id,
            type: row.type,
            poster: posterName,
            avatar: initials(posterName),
            shift: shiftLabel,
            shiftDate: shift?.date ?? null,
            message: row.message,
            status: toUiStatus(row.status, shift?.date ?? null, todayKey),
            posted: formatRelativeTime(row.created_at),
            postedAt: row.created_at,
            swapWithName: row.claimed_by ? (namesById.get(row.claimed_by) ?? null) : null,
            swapWithId: row.claimed_by ?? null,
            shiftType: shift?.shift_type ?? null,
            shiftRole: shift?.role ?? null,
          } satisfies ShiftBoardRequest
        })

        setRequests(mappedRequests)
        setMetrics({ unfilled, missingLead })
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
    void loadBoard(activeTab)
  }, [activeTab, loadBoard])

  const pending = pendingCount
  const canReview = can(role, 'review_shift_posts')

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return requests.filter((request) => {
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
  }, [activeTab, requests, search, statusFilter, typeFilter])

  const handleAction = useCallback(
    async (id: string, action: 'approve' | 'deny', opts?: { override?: boolean }) => {
      if (!canReview) return

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

      const nextStatus: PersistedRequestStatus = action === 'approve' ? 'approved' : 'denied'
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
            : updateError.message.includes('Lead coverage gap')
              ? 'override:Lead coverage gap - approving this request would leave a shift without a lead. You can force-approve below.'
              : updateError.message.includes('Double booking')
                ? 'Cannot approve: double booking. This therapist is already assigned to this shift.'
                : `Could not save: ${updateError.message}`
        setRequestErrors((prev) => ({ ...prev, [id]: msg }))
        setSavingState((current) => ({ ...current, [id]: false }))
        return
      }

      await loadBoard(activeTab)
      setSavingState((current) => ({ ...current, [id]: false }))
    },
    [activeTab, canReview, loadBoard, overrideReasons, requests, supabase, swapPartners, therapists]
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
    <div className="space-y-6">
      <PageHeader
        title="Shift Board"
        subtitle={
          canReview
            ? 'Review and approve swap and pickup requests for the published schedule.'
            : 'Use this page only for changes to the published schedule: swap or pick up a shift.'
        }
      />

      <section
        className="fade-up rounded-xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(6,103,169,0.06),0_4px_12px_rgba(6,103,169,0.03)]"
        style={{ animationDelay: '0.03s' }}
        aria-label="Workflow guidance"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Use the right page
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground">This page: Shift Board</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              For shifts in an already published schedule. Staff can post swap or pickup requests.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-foreground">Other page: Future Availability</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              For upcoming cycles before publish. Use Availability to submit days off or PRN offers.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => router.push('/requests/new')}>
            Post swap or pickup request
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/availability">Open future availability</Link>
          </Button>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {/* Summary banner */}
      {canReview ? (
        <div
          className="fade-up rounded-xl border border-[var(--warning-border)] bg-card shadow-sm [border-left-width:4px] [border-left-color:var(--warning)]"
          style={{ animationDelay: '0.05s' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex flex-wrap items-center gap-6">
              <SummaryItem
                label="Pending approvals"
                value={loading ? '--' : pending}
                variant={!loading && pending > 0 ? 'warning' : 'success'}
              />
              <div className="w-px self-stretch bg-border" />
              <SummaryItem
                label="Unfilled shifts"
                value={loading ? '--' : metrics.unfilled}
                variant={!loading && metrics.unfilled > 0 ? 'error' : 'success'}
              />
              <div className="w-px self-stretch bg-border" />
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
              'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
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
        className="fade-up flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, message, or shift..."
            className="h-9 w-full rounded-md border border-border bg-muted/50 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
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
        'rounded-md border px-3 py-1 text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
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
  // Filter to therapists scheduled on the same date; fall back to full list if coverage not loaded
  const eligibleTherapists =
    scheduledOnDate.size > 0 ? therapists.filter((t) => scheduledOnDate.has(t.id)) : therapists
  const isOverrideableError = error?.startsWith('override:')
  const overrideMessage = isOverrideableError ? error!.slice('override:'.length).trim() : null
  const displayError = isOverrideableError ? null : error

  return (
    <div
      className={cn(
        'fade-up rounded-xl border bg-card p-4 transition-shadow',
        isPending ? 'border-[var(--warning-border)] shadow-sm' : 'border-border'
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--attention)]">
          <span className="text-xs font-bold text-white">{req.avatar}</span>
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
            <span className="text-xs text-muted-foreground">{req.posted}</span>
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
              <span className="rounded-full bg-[var(--warning)] px-2 py-0.5 text-[10px] font-bold text-white">
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
              <option value="">- Choose a therapist -</option>
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
            className="flex-1"
            disabled={saving || (needsPartner && !swapPartnerId)}
            onClick={() => onAction('approve')}
          >
            {saving ? 'Saving...' : 'Approve'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-[var(--error-border)] text-[var(--error-text)] hover:bg-[var(--error-subtle)]"
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
            disabled={saving || !overrideReason.trim()}
            onClick={onForceApprove}
            className="w-full bg-[var(--error)] text-white hover:bg-[var(--error)]/90"
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
