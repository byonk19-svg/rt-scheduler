'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/app/schedule/types'
import { can } from '@/lib/auth/can'
import { parseRole } from '@/lib/auth/roles'
import { dateKeyFromDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'

type RequestType = 'swap' | 'pickup'
type PersistedRequestStatus = 'pending' | 'approved' | 'denied' | 'expired'
type RequestStatus = PersistedRequestStatus | 'expired'
type UiShiftStatus = 'scheduled' | 'oncall' | 'leave_early' | 'cancelled'

type ProfileRow = {
  id: string
  full_name: string | null
  role: string | null
  shift_type: 'day' | 'night' | null
  is_lead_eligible: boolean | null
}

type CycleRow = {
  id: string
  label: string
  start_date: string
  end_date: string
}

type OwnShiftRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  status: ShiftStatus
  assignment_status: AssignmentStatus | null
  role: ShiftRole
  cycle_id: string | null
}

type SlotShiftRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
  role: ShiftRole
  user_id: string
  cycle_id: string | null
  profiles: { full_name: string | null } | { full_name: string | null }[] | null
}

type SwapExistsRow = {
  shift_id: string | null
}

type RawRequestRow = {
  id: string
  type: RequestType
  status: PersistedRequestStatus
  created_at: string
  shift_id: string | null
  claimed_by: string | null
}

type ShiftLookupRow = {
  id: string
  date: string
  shift_type: 'day' | 'night'
}

type NameLookupRow = {
  id: string
  full_name: string | null
}

type StaffShift = {
  id: string
  dateIso: string
  date: string
  dow: string
  dayNum: number
  isLead: boolean
  status: UiShiftStatus
  swapRequested: boolean
  lead: string
  crew: string[]
}

type StaffRequest = {
  id: string
  type: RequestType
  shift: string
  status: RequestStatus
  swapWith: string | null
  posted: string
}

type MeState = {
  name: string
  avatar: string
  shift: 'Day' | 'Night'
  isLead: boolean
  cycle: string
}

const SHIFT_STATUS: Record<
  UiShiftStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  scheduled: { label: 'Scheduled', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  oncall: { label: 'On Call', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  leave_early: { label: 'Leave Early', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

const REQUEST_STATUS: Record<
  RequestStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: { label: 'Pending', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  approved: { label: 'Approved', color: '#065f46', bg: '#ecfdf5', border: '#a7f3d0' },
  denied: { label: 'Denied', color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  expired: { label: 'Expired', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatRequestShiftLabel(isoDate: string, shiftType: 'day' | 'night'): string {
  return `${formatShortDate(isoDate)} - ${shiftType === 'day' ? 'Day' : 'Night'}`
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

function getGreeting(): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function toUiShiftStatus(status: ShiftStatus, assignment: AssignmentStatus | null): UiShiftStatus {
  if (assignment === 'on_call') return 'oncall'
  if (assignment === 'left_early') return 'leave_early'
  if (assignment === 'call_in' || assignment === 'cancelled') return 'cancelled'
  if (status === 'on_call') return 'oncall'
  if (status === 'sick' || status === 'called_off') return 'cancelled'
  return 'scheduled'
}

function toRequestStatus(
  status: PersistedRequestStatus,
  shiftDate: string | null,
  todayKey: string
): RequestStatus {
  if (status === 'pending' && shiftDate !== null && shiftDate < todayKey) {
    return 'expired'
  }
  return status
}

export default function StaffDashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<MeState>({
    name: 'Staff member',
    avatar: 'ST',
    shift: 'Day',
    isLead: false,
    cycle: '-',
  })
  const [upcomingShifts, setUpcomingShifts] = useState<StaffShift[]>([])
  const [myRequests, setMyRequests] = useState<StaffRequest[]>([])

  useEffect(() => {
    let active = true

    async function loadData() {
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

        const [profileResult, cyclesResult, ownShiftsResult, requestResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, role, shift_type, is_lead_eligible')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('schedule_cycles')
            .select('id, label, start_date, end_date')
            .order('start_date', { ascending: false })
            .limit(24),
          supabase
            .from('shifts')
            .select('id, date, shift_type, status, assignment_status, role, cycle_id')
            .eq('user_id', user.id)
            .gte('date', todayKey)
            .order('date', { ascending: true }),
          supabase
            .from('shift_posts')
            .select('id, type, status, created_at, shift_id, claimed_by')
            .eq('posted_by', user.id)
            .order('created_at', { ascending: false }),
        ])

        if (!active) return

        const profile = (profileResult.data ?? null) as ProfileRow | null
        if (can(parseRole(profile?.role), 'access_manager_ui')) {
          router.replace('/dashboard/manager')
          return
        }

        const cycles = (cyclesResult.data ?? []) as CycleRow[]
        const activeCycle =
          cycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ??
          cycles[0] ??
          null

        const ownShifts = (ownShiftsResult.data ?? []) as OwnShiftRow[]
        const ownShiftIds = ownShifts.map((shift) => shift.id)
        const ownDates = Array.from(new Set(ownShifts.map((shift) => shift.date)))
        const ownShiftTypes = Array.from(new Set(ownShifts.map((shift) => shift.shift_type)))
        const ownCycleIds = Array.from(
          new Set(
            ownShifts
              .map((shift) => shift.cycle_id)
              .filter((cycleId): cycleId is string => Boolean(cycleId))
          )
        )

        let slotShifts: SlotShiftRow[] = []
        if (ownDates.length > 0 && ownShiftTypes.length > 0) {
          let slotQuery = supabase
            .from('shifts')
            .select(
              'id, date, shift_type, role, user_id, cycle_id, profiles:profiles!shifts_user_id_fkey(full_name)'
            )
            .in('date', ownDates)
            .in('shift_type', ownShiftTypes)

          if (ownCycleIds.length > 0) {
            slotQuery = slotQuery.in('cycle_id', ownCycleIds)
          }

          const { data: slotRows } = await slotQuery
          slotShifts = (slotRows ?? []) as SlotShiftRow[]
        }

        const pendingSwapShiftIds = new Set<string>()
        if (ownShiftIds.length > 0) {
          const { data: pendingSwapRows } = await supabase
            .from('shift_posts')
            .select('shift_id')
            .eq('posted_by', user.id)
            .eq('type', 'swap')
            .eq('status', 'pending')
            .in('shift_id', ownShiftIds)

          for (const row of (pendingSwapRows ?? []) as SwapExistsRow[]) {
            if (row.shift_id) pendingSwapShiftIds.add(row.shift_id)
          }
        }

        const slotByKey = new Map<string, SlotShiftRow[]>()
        for (const row of slotShifts) {
          const key = `${row.date}|${row.shift_type}|${row.cycle_id ?? ''}`
          const bucket = slotByKey.get(key) ?? []
          bucket.push(row)
          slotByKey.set(key, bucket)
        }

        const mappedShifts = ownShifts.map((shift) => {
          const parsedDate = new Date(`${shift.date}T00:00:00`)
          const key = `${shift.date}|${shift.shift_type}|${shift.cycle_id ?? ''}`
          const slotRows = slotByKey.get(key) ?? []
          const leadRow = slotRows.find((row) => row.role === 'lead') ?? null
          const leadName = getOne(leadRow?.profiles)?.full_name ?? 'Unassigned'

          const crew = slotRows
            .filter((row) => row.user_id !== user.id)
            .map((row) => getOne(row.profiles)?.full_name ?? 'Unknown')

          return {
            id: shift.id,
            dateIso: shift.date,
            date: Number.isNaN(parsedDate.getTime())
              ? shift.date
              : parsedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                }),
            dow: Number.isNaN(parsedDate.getTime())
              ? shift.date.slice(0, 3).toUpperCase()
              : parsedDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            dayNum: Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getDate(),
            isLead: shift.role === 'lead',
            status: toUiShiftStatus(shift.status, shift.assignment_status),
            swapRequested: pendingSwapShiftIds.has(shift.id),
            lead: leadName,
            crew,
          } satisfies StaffShift
        })

        const requestRows = (requestResult.data ?? []) as RawRequestRow[]
        const requestShiftIds = Array.from(
          new Set(
            requestRows
              .map((row) => row.shift_id)
              .filter((shiftId): shiftId is string => Boolean(shiftId))
          )
        )

        const requestSwapWithIds = Array.from(
          new Set(
            requestRows
              .map((row) => row.claimed_by)
              .filter((profileId): profileId is string => Boolean(profileId))
          )
        )

        let requestShiftsById = new Map<string, ShiftLookupRow>()
        if (requestShiftIds.length > 0) {
          const { data: requestShiftRows } = await supabase
            .from('shifts')
            .select('id, date, shift_type')
            .in('id', requestShiftIds)

          requestShiftsById = new Map(
            ((requestShiftRows ?? []) as ShiftLookupRow[]).map((row) => [row.id, row])
          )
        }

        let requestSwapById = new Map<string, string>()
        if (requestSwapWithIds.length > 0) {
          const { data: requestSwapRows } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', requestSwapWithIds)

          requestSwapById = new Map(
            ((requestSwapRows ?? []) as NameLookupRow[]).map((row) => [
              row.id,
              row.full_name ?? 'Unknown',
            ])
          )
        }

        const mappedRequests = requestRows.map((request) => {
          const shift = request.shift_id ? (requestShiftsById.get(request.shift_id) ?? null) : null
          return {
            id: request.id,
            type: request.type,
            shift: shift
              ? formatRequestShiftLabel(shift.date, shift.shift_type)
              : 'Shift unavailable',
            status: toRequestStatus(request.status, shift?.date ?? null, todayKey),
            swapWith: request.claimed_by ? (requestSwapById.get(request.claimed_by) ?? null) : null,
            posted: formatRelativeTime(request.created_at),
          } satisfies StaffRequest
        })

        const name =
          profile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Staff member'

        setMe({
          name,
          avatar: initials(name),
          shift: profile?.shift_type === 'night' ? 'Night' : 'Day',
          isLead: profile?.is_lead_eligible === true,
          cycle: activeCycle?.label ?? '-',
        })
        setUpcomingShifts(mappedShifts)
        setMyRequests(mappedRequests)
      } catch (loadError) {
        console.error('Failed to load staff dashboard:', loadError)
        if (active) {
          setError('Could not load dashboard data.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [router, supabase])

  const nextShift = upcomingShifts[0] ?? null
  const upcomingCount = upcomingShifts.length
  const leadCount = upcomingShifts.filter((shift) => shift.isLead).length
  const openRequestCount = myRequests.filter((request) => request.status === 'pending').length

  const previewShifts = upcomingShifts.slice(0, 4)
  const previewRequests = myRequests.slice(0, 2)
  const firstName = me.name.split(' ')[0] ?? me.name

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '32px 28px' }}>
      <div className="fade-up" style={{ marginBottom: 22 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {getGreeting()}, {loading ? '—' : firstName} {'\u{1F44B}'}
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Cycle: {loading ? '—' : me.cycle} · {loading ? '—' : `${me.shift} shift`}
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
          animationDelay: '0.03s',
          background: '#fff',
          border: '1.5px solid #fde68a',
          borderLeft: '4px solid #d97706',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#b45309',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Next shift
          </p>
          <p style={{ marginTop: 3, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
            {loading ? '—' : (nextShift?.date ?? 'No upcoming shifts')}
          </p>
          {!loading && nextShift && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 6,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SHIFT_STATUS[nextShift.status].color,
                  background: SHIFT_STATUS[nextShift.status].bg,
                  border: `1px solid ${SHIFT_STATUS[nextShift.status].border}`,
                  padding: '1px 8px',
                  borderRadius: 20,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {SHIFT_STATUS[nextShift.status].label}
              </span>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {nextShift.isLead ? 'You are lead' : `Lead: ${nextShift.lead}`}
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            router.push(nextShift ? `/requests/new?shiftId=${nextShift.id}` : '/requests/new')
          }
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
          Request swap
        </button>
      </div>

      <div
        className="fade-up"
        style={{
          animationDelay: '0.06s',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <StatTile
          label="Upcoming shifts"
          value={loading ? '—' : String(upcomingCount)}
          color="#0f172a"
        />
        <StatTile label="Lead shifts" value={loading ? '—' : String(leadCount)} color="#b45309" />
        <StatTile
          label="Open requests"
          value={loading ? '—' : String(openRequestCount)}
          color="#d97706"
        />
      </div>

      <div
        className="fade-up"
        style={{
          animationDelay: '0.09s',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Upcoming shifts</p>
            <button
              type="button"
              onClick={() => router.push('/staff/schedule')}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#b45309',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              View all
            </button>
          </div>
          {loading ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>—</p>
          ) : previewShifts.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>No upcoming shifts.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {previewShifts.map((shift) => (
                <div
                  key={shift.id}
                  style={{
                    border: '1px solid #f1f5f9',
                    borderRadius: 8,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                    {shift.date}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      fontWeight: 800,
                      color: SHIFT_STATUS[shift.status].color,
                      background: SHIFT_STATUS[shift.status].bg,
                      border: `1px solid ${SHIFT_STATUS[shift.status].border}`,
                      padding: '1px 8px',
                      borderRadius: 20,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {SHIFT_STATUS[shift.status].label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>My requests</p>
            <button
              type="button"
              onClick={() => router.push('/staff/requests')}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#b45309',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              View all
            </button>
          </div>
          {loading ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>—</p>
          ) : previewRequests.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>No requests yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {previewRequests.map((request) => (
                <div
                  key={request.id}
                  style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: '8px 10px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#0f172a',
                        textTransform: 'capitalize',
                      }}
                    >
                      {request.type}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        fontWeight: 800,
                        color: REQUEST_STATUS[request.status].color,
                        background: REQUEST_STATUS[request.status].bg,
                        border: `1px solid ${REQUEST_STATUS[request.status].border}`,
                        padding: '1px 8px',
                        borderRadius: 20,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {REQUEST_STATUS[request.status].label}
                    </span>
                  </div>
                  <p style={{ marginTop: 4, fontSize: 12, color: '#374151' }}>{request.shift}</p>
                  <p style={{ marginTop: 2, fontSize: 11, color: '#9ca3af' }}>{request.posted}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{label}</p>
      <p
        style={{
          marginTop: 2,
          fontSize: 24,
          lineHeight: 1,
          fontWeight: 800,
          color,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        {value}
      </p>
    </div>
  )
}
