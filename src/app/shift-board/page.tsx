'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { dateKeyFromDate, buildDateRange } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'

type Role = 'manager' | 'therapist'
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
}

type ProfileLookupRow = {
  id: string
  full_name: string | null
  role?: string | null
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
}

type MetricState = {
  unfilled: number
  missingLead: number
}

const STATUS_META: Record<RequestStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'Pending', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  approved: { label: 'Approved', color: '#065f46', bg: '#ecfdf5', border: '#a7f3d0' },
  denied: { label: 'Denied', color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  expired: { label: 'Expired', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

const TYPE_META: Record<RequestType, { label: string; color: string; bg: string; border: string }> = {
  swap: { label: 'Swap', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  pickup: { label: 'Pickup', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
}

const HISTORY_STATUSES: RequestStatus[] = ['approved', 'denied', 'expired']

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
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

function toUiStatus(status: PersistedRequestStatus, shiftDate: string | null, todayKey: string): RequestStatus {
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

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending')
  const [typeFilter, setTypeFilter] = useState<'all' | RequestType>('all')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open')
  const [savingState, setSavingState] = useState<Record<string, boolean>>({})

  const loadBoard = useCallback(
    async (tab: 'open' | 'history') => {
      setLoading(true)
      setError(null)

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
          supabase.from('shift_posts').select('id', { head: true, count: 'exact' }).eq('status', 'pending'),
          postsQuery,
        ])

        const profile = (profileResult.data ?? null) as ProfileLookupRow | null
        const nextRole: Role = profile?.role === 'manager' ? 'manager' : 'therapist'
        setRole(nextRole)
        setPendingCount(pendingPostsResult.count ?? 0)

        const cycles = (cyclesResult.data ?? []) as CycleRow[]
        const activeCycle =
          cycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ?? cycles[0] ?? null

        let unfilled = 0
        let missingLead = 0

        if (activeCycle) {
          const { data: coverageData, error: coverageError } = await supabase
            .from('shifts')
            .select('date, shift_type, status, role')
            .eq('cycle_id', activeCycle.id)
            .gte('date', activeCycle.start_date)
            .lte('date', activeCycle.end_date)

          if (coverageError) {
            console.error('Failed to load shift coverage metrics for requests board:', coverageError)
          } else {
            const bySlot = new Map<string, ShiftCoverageRow[]>()
            for (const row of (coverageData ?? []) as ShiftCoverageRow[]) {
              const key = `${row.date}:${row.shift_type}`
              const bucket = bySlot.get(key) ?? []
              bucket.push(row)
              bySlot.set(key, bucket)
            }

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
        const shiftIds = Array.from(new Set(postRows.map((row) => row.shift_id).filter((value): value is string => Boolean(value))))

        let shiftsById = new Map<string, ShiftLookupRow>()
        if (shiftIds.length > 0) {
          const { data: shiftsData } = await supabase
            .from('shifts')
            .select('id, date, shift_type')
            .in('id', shiftIds)

          shiftsById = new Map(
            ((shiftsData ?? []) as ShiftLookupRow[]).map((row) => [row.id, row])
          )
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
            ((profileRows ?? []) as ProfileLookupRow[]).map((row) => [row.id, row.full_name ?? 'Unknown'])
          )
        }

        const mappedRequests = postRows.map((row) => {
          const shift = row.shift_id ? shiftsById.get(row.shift_id) : null
          const posterName = row.posted_by ? namesById.get(row.posted_by) ?? 'Unknown therapist' : 'Unknown therapist'
          const shiftLabel = shift ? formatShiftLabel(shift.date, shift.shift_type) : 'Shift unavailable'

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
            swapWithName: row.claimed_by ? namesById.get(row.claimed_by) ?? null : null,
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
    async (id: string, action: 'approve' | 'deny') => {
      if (role !== 'manager') return

      const nextStatus: PersistedRequestStatus = action === 'approve' ? 'approved' : 'denied'
      const previousRequests = requests

      setRequests((current) =>
        current.map((request) => {
          if (request.id !== id) return request
          return {
            ...request,
            status: nextStatus,
          }
        })
      )

      setSavingState((current) => ({ ...current, [id]: true }))
      setError(null)

      const { error: updateError } = await supabase.from('shift_posts').update({ status: nextStatus }).eq('id', id)

      if (updateError) {
        console.error('Failed to save action:', updateError.message)
        setRequests(previousRequests)
        setError('Could not save request update. Changes were rolled back.')
        if (typeof window !== 'undefined') {
          if (updateError.message.includes('Lead coverage gap')) {
            window.alert(`Cannot approve: ${updateError.message}`)
          } else if (updateError.message.includes('Double booking')) {
            window.alert(`Cannot approve: ${updateError.message}`)
          } else {
            window.alert('Could not save. Please try again.')
          }
        }
        setSavingState((current) => ({ ...current, [id]: false }))
        return
      }

      await loadBoard(activeTab)
      setSavingState((current) => ({ ...current, [id]: false }))
    },
    [activeTab, loadBoard, requests, role, supabase]
  )

  const handleViewShift = useCallback(
    (shiftDate: string | null) => {
      if (shiftDate) {
        router.push(`/coverage?date=${shiftDate}`)
        return
      }
      router.push('/coverage')
    },
    [router]
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 28px' }}>
      <div className="fade-up" style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Shift Board
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Review and approve posted swap and pickup requests.
        </p>
      </div>

      {error && (
        <div
          className="fade-up"
          style={{
            marginBottom: 16,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <div
        className="fade-up"
        style={{
          animationDelay: '0.05s',
          background: '#fff',
          border: '1.5px solid #fde68a',
          borderLeft: '4px solid #d97706',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <SummaryItem label="Pending approvals" value={loading ? '...' : pending} color={!loading && pending > 0 ? '#d97706' : '#059669'} />
          <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch' }} />
          <SummaryItem label="Unfilled shifts" value={loading ? '...' : metrics.unfilled} color={!loading && metrics.unfilled > 0 ? '#dc2626' : '#059669'} />
          <div style={{ width: 1, background: '#f1f5f9', alignSelf: 'stretch' }} />
          <SummaryItem label="Missing lead" value={loading ? '...' : metrics.missingLead} color={!loading && metrics.missingLead > 0 ? '#dc2626' : '#059669'} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              background: '#d97706',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Review approvals
          </button>
          <button
            type="button"
            onClick={() => router.push('/requests/new')}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 14px',
              borderRadius: 7,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            New request
          </button>
        </div>
      </div>

      <div className="fade-up" style={{ animationDelay: '0.08s', display: 'flex', gap: 4, marginBottom: 20 }}>
        {[
          { id: 'open' as const, label: 'Open Posts' },
          { id: 'history' as const, label: 'History' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: '7px 18px',
              borderRadius: 8,
              border: `1px solid ${activeTab === tab.id ? '#d97706' : '#e5e7eb'}`,
              background: activeTab === tab.id ? '#fffbeb' : '#fff',
              color: activeTab === tab.id ? '#b45309' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="fade-up"
        style={{
          animationDelay: '0.1s',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="6" cy="6" r="4" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M9.5 9.5l2.5 2.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, message, or shift..."
            style={{
              width: '100%',
              padding: '7px 10px 7px 30px',
              border: '1px solid #e5e7eb',
              borderRadius: 7,
              fontSize: 12,
              color: '#374151',
              outline: 'none',
              background: '#f8fafc',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'pending', 'approved', 'denied'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid',
                cursor: 'pointer',
                borderColor:
                  statusFilter === status
                    ? status === 'pending'
                      ? '#fde68a'
                      : status === 'approved'
                        ? '#a7f3d0'
                        : status === 'denied'
                          ? '#fecaca'
                          : '#d97706'
                    : '#e5e7eb',
                background:
                  statusFilter === status
                    ? status === 'pending'
                      ? '#fffbeb'
                      : status === 'approved'
                        ? '#ecfdf5'
                        : status === 'denied'
                          ? '#fef2f2'
                          : '#fffbeb'
                    : '#fff',
                color:
                  statusFilter === status
                    ? status === 'pending'
                      ? '#b45309'
                      : status === 'approved'
                        ? '#065f46'
                        : status === 'denied'
                          ? '#991b1b'
                          : '#b45309'
                    : '#9ca3af',
                textTransform: 'capitalize',
                transition: 'all 0.1s',
              }}
            >
              {status === 'all' ? 'All' : `${status.charAt(0).toUpperCase()}${status.slice(1)}`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'swap', 'pickup'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                border: '1px solid #e5e7eb',
                background: typeFilter === type ? '#1c1917' : '#fff',
                color: typeFilter === type ? '#fff' : '#9ca3af',
                textTransform: 'capitalize',
                transition: 'all 0.1s',
              }}
            >
              {type === 'all' ? 'All types' : `${type.charAt(0).toUpperCase()}${type.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      <div className="fade-up" style={{ animationDelay: '0.15s', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              canReview={role === 'manager'}
              saving={Boolean(savingState[request.id])}
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

function SummaryItem({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

function RequestCard({
  req,
  canReview,
  saving,
  onAction,
  onViewShift,
  delay = 0,
}: {
  req: ShiftBoardRequest
  canReview: boolean
  saving: boolean
  onAction: (action: 'approve' | 'deny') => void
  onViewShift: () => void
  delay?: number
}) {
  const statusMeta = STATUS_META[req.status]
  const typeMeta = TYPE_META[req.type]
  const isPending = req.status === 'pending'

  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${delay}s`,
        background: '#fff',
        border: `1px solid ${isPending ? '#fde68a' : '#e5e7eb'}`,
        borderRadius: 10,
        padding: '16px 18px',
        transition: 'border-color 0.2s',
        boxShadow: isPending ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{req.avatar}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{req.poster}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: typeMeta.color,
                background: typeMeta.bg,
                border: `1px solid ${typeMeta.border}`,
                padding: '1px 7px',
                borderRadius: 20,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {typeMeta.label}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: statusMeta.color,
                background: statusMeta.bg,
                border: `1px solid ${statusMeta.border}`,
                padding: '1px 7px',
                borderRadius: 20,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginLeft: 'auto',
              }}
            >
              {statusMeta.label}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{req.posted}</span>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: '#f8fafc',
              border: '1px solid #f1f5f9',
              borderRadius: 6,
              padding: '3px 8px',
              marginBottom: 7,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="0.5" y="1.5" width="10" height="9" rx="1.5" stroke="#d97706" strokeWidth="1.2" />
              <path d="M3.5 0.5v2M7.5 0.5v2M0.5 4.5h10" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{req.shift}</span>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{req.message}</p>
          {req.swapWithName && <p style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Swap with: {req.swapWithName}</p>}
        </div>
      </div>

      {isPending && canReview && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => onAction('approve')}
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 700,
              padding: '7px 0',
              borderRadius: 7,
              border: 'none',
              background: '#d97706',
              color: '#fff',
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Approve'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onAction('deny')}
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 700,
              padding: '7px 0',
              borderRadius: 7,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#dc2626',
              cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            Deny
          </button>
          <button
            type="button"
            onClick={onViewShift}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 14px',
              borderRadius: 7,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            View shift
          </button>
        </div>
      )}

      {(!isPending || !canReview) && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex' }}>
          <button
            type="button"
            onClick={onViewShift}
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 14px',
              borderRadius: 7,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            View shift
          </button>
        </div>
      )}
    </div>
  )
}

function EmptyState({ statusFilter, onClear }: { statusFilter: string; onClear: () => void }) {
  const allClear = statusFilter === 'pending'
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: allClear ? '#ecfdf5' : '#f8fafc',
          border: `1px solid ${allClear ? '#a7f3d0' : '#e5e7eb'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
          fontSize: 18,
          fontWeight: 800,
          color: allClear ? '#059669' : '#64748b',
        }}
      >
        {allClear ? 'OK' : '?'}
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
        {allClear ? "You're all caught up" : 'No results found'}
      </p>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        {allClear ? 'No pending requests right now. Check back later.' : 'Try adjusting your search or filters.'}
      </p>
      <button
        type="button"
        onClick={onClear}
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: '7px 16px',
          borderRadius: 7,
          border: '1px solid #e5e7eb',
          background: '#fff',
          color: '#374151',
          cursor: 'pointer',
        }}
      >
        {allClear ? 'View all posts' : 'Clear filters'}
      </button>
    </div>
  )
}
