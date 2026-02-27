'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { AssignmentStatus, ShiftRole, ShiftStatus } from '@/app/schedule/types'
import { dateKeyFromDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'

type UiShiftStatus = 'scheduled' | 'oncall' | 'leave_early' | 'cancelled'

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

const SHIFT_STATUS: Record<UiShiftStatus, { label: string; color: string; bg: string; border: string }> = {
  scheduled: { label: 'Scheduled', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  oncall: { label: 'On Call', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  leave_early: { label: 'Leave Early', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
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

function toUiShiftStatus(status: ShiftStatus, assignment: AssignmentStatus | null): UiShiftStatus {
  if (assignment === 'on_call') return 'oncall'
  if (assignment === 'left_early') return 'leave_early'
  if (assignment === 'call_in' || assignment === 'cancelled') return 'cancelled'
  if (status === 'on_call') return 'oncall'
  if (status === 'sick' || status === 'called_off') return 'cancelled'
  return 'scheduled'
}

export default function MySchedulePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shifts, setShifts] = useState<StaffShift[]>([])
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null)

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

        const { data: ownShiftData, error: ownShiftError } = await supabase
          .from('shifts')
          .select('id, date, shift_type, status, assignment_status, role, cycle_id')
          .eq('user_id', user.id)
          .gte('date', todayKey)
          .order('date', { ascending: true })

        if (!active) return

        if (ownShiftError) {
          console.error('Failed to load staff shifts:', ownShiftError)
          setError('Could not load your upcoming schedule.')
          setLoading(false)
          return
        }

        const ownShifts = (ownShiftData ?? []) as OwnShiftRow[]

        if (ownShifts.length === 0) {
          setShifts([])
          setLoading(false)
          return
        }

        const ownShiftIds = ownShifts.map((shift) => shift.id)
        const ownDates = Array.from(new Set(ownShifts.map((shift) => shift.date)))
        const ownShiftTypes = Array.from(new Set(ownShifts.map((shift) => shift.shift_type)))
        const ownCycleIds = Array.from(
          new Set(ownShifts.map((shift) => shift.cycle_id).filter((cycleId): cycleId is string => Boolean(cycleId)))
        )

        let slotQuery = supabase
          .from('shifts')
          .select('id, date, shift_type, role, user_id, cycle_id, profiles:profiles!shifts_user_id_fkey(full_name)')
          .in('date', ownDates)
          .in('shift_type', ownShiftTypes)

        if (ownCycleIds.length > 0) {
          slotQuery = slotQuery.in('cycle_id', ownCycleIds)
        }

        const [{ data: slotData }, { data: pendingSwapData }] = await Promise.all([
          slotQuery,
          supabase
            .from('shift_posts')
            .select('shift_id')
            .eq('posted_by', user.id)
            .eq('type', 'swap')
            .eq('status', 'pending')
            .in('shift_id', ownShiftIds),
        ])

        if (!active) return

        const slotRows = (slotData ?? []) as SlotShiftRow[]
        const pendingSwapIds = new Set<string>()
        for (const row of (pendingSwapData ?? []) as SwapExistsRow[]) {
          if (row.shift_id) pendingSwapIds.add(row.shift_id)
        }

        const slotByKey = new Map<string, SlotShiftRow[]>()
        for (const row of slotRows) {
          const key = `${row.date}|${row.shift_type}|${row.cycle_id ?? ''}`
          const bucket = slotByKey.get(key) ?? []
          bucket.push(row)
          slotByKey.set(key, bucket)
        }

        const mapped = ownShifts.map((shift) => {
          const parsedDate = new Date(`${shift.date}T00:00:00`)
          const key = `${shift.date}|${shift.shift_type}|${shift.cycle_id ?? ''}`
          const peers = slotByKey.get(key) ?? []
          const leadRow = peers.find((row) => row.role === 'lead') ?? null
          const leadName = getOne(leadRow?.profiles)?.full_name ?? 'Unassigned'

          const crew = peers
            .filter((row) => row.user_id !== user.id)
            .map((row) => getOne(row.profiles)?.full_name ?? 'Unknown')

          return {
            id: shift.id,
            dateIso: shift.date,
            date: Number.isNaN(parsedDate.getTime())
              ? shift.date
              : parsedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            dow: Number.isNaN(parsedDate.getTime())
              ? shift.date.slice(0, 3).toUpperCase()
              : parsedDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            dayNum: Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getDate(),
            isLead: shift.role === 'lead',
            status: toUiShiftStatus(shift.status, shift.assignment_status),
            swapRequested: pendingSwapIds.has(shift.id),
            lead: leadName,
            crew,
          } satisfies StaffShift
        })

        setShifts(mapped)
      } catch (loadError) {
        console.error('Failed to load staff schedule:', loadError)
        if (active) {
          setError('Could not load your upcoming schedule.')
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

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '32px 28px' }}>
      <div className="fade-up" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            My Schedule
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>View upcoming shifts and request swaps when needed.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '7px 16px',
              borderRadius: 7,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#334155',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Print schedule
          </button>
          <button
            type="button"
            onClick={() => router.push('/requests/new')}
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '7px 16px',
              borderRadius: 7,
              border: 'none',
              background: '#d97706',
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Request swap
          </button>
        </div>
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
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 14,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {(
          [
            { key: 'scheduled', label: 'Scheduled' },
            { key: 'oncall', label: 'On Call' },
            { key: 'leave_early', label: 'Leave Early' },
            { key: 'cancelled', label: 'Cancelled' },
          ] as const
        ).map((item) => (
          <span
            key={item.key}
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SHIFT_STATUS[item.key].color,
              background: SHIFT_STATUS[item.key].bg,
              border: `1px solid ${SHIFT_STATUS[item.key].border}`,
              padding: '2px 8px',
              borderRadius: 20,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {item.label}
          </span>
        ))}
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#b45309',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            padding: '2px 8px',
            borderRadius: 20,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Lead shift
        </span>
      </div>

      <div className="fade-up" style={{ animationDelay: '0.06s', display: 'grid', gap: 10 }}>
        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px', color: '#9ca3af', fontSize: 12 }}>—</div>
        ) : shifts.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '28px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
            No upcoming shifts.
          </div>
        ) : (
          shifts.map((shift) => {
            const expanded = expandedShiftId === shift.id
            const statusMeta = SHIFT_STATUS[shift.status]

            return (
              <div key={shift.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setExpandedShiftId((current) => (current === shift.id ? null : shift.id))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span style={{ width: 40, height: 40, borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af' }}>{shift.dow}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{shift.dayNum || '—'}</span>
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{shift.date}</p>
                    <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{shift.isLead ? 'You are lead' : `Lead: ${shift.lead}`}</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {shift.isLead && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Lead
                      </span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 800, color: statusMeta.color, background: statusMeta.bg, border: `1px solid ${statusMeta.border}`, padding: '1px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {statusMeta.label}
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 14px', display: 'grid', gap: 10 }}>
                    <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lead</p>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 30, height: 30, borderRadius: '999px', background: '#1c1917', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>
                          {initials(shift.isLead ? 'You' : shift.lead)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{shift.isLead ? 'You (Lead)' : shift.lead}</span>
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                        Working with
                      </p>
                      {shift.crew.length === 0 ? (
                        <p style={{ fontSize: 12, color: '#9ca3af' }}>No other assigned staff.</p>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {shift.crew.map((name) => (
                            <span key={`${shift.id}-${name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, background: '#1c1917', border: '1px solid #292524', padding: '3px 8px 3px 5px' }}>
                              <span style={{ width: 18, height: 18, borderRadius: 999, background: '#fbbf24', color: '#1c1917', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>
                                {initials(name)}
                              </span>
                              <span style={{ fontSize: 11, color: '#fafaf9', fontWeight: 600 }}>{name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {shift.status === 'cancelled' ? (
                      <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>This shift is cancelled. Swap requests are unavailable.</p>
                    ) : shift.swapRequested ? (
                      <p style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>You already have a pending swap request for this shift.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => router.push(`/requests/new?shiftId=${shift.id}`)}
                        style={{
                          justifySelf: 'start',
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '7px 14px',
                          borderRadius: 7,
                          border: 'none',
                          background: '#d97706',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Request swap for this shift
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

