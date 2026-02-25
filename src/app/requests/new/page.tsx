'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { dateKeyFromDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'

type RequestType = 'swap' | 'pickup'
type PersistedRequestStatus = 'pending' | 'approved' | 'denied' | 'expired'
type RequestStatus = PersistedRequestStatus | 'expired'
type ShiftType = 'day' | 'night'
type ShiftRole = 'lead' | 'staff'

type ShiftRow = {
  id: string
  date: string
  shift_type: ShiftType
  role: ShiftRole
}

type ShiftPostRow = {
  id: string
  type: RequestType
  status: PersistedRequestStatus
  created_at: string
  shift_id: string | null
  claimed_by: string | null
  message: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  role?: string | null
  shift_type: ShiftType | null
  is_lead_eligible?: boolean | null
  is_active?: boolean | null
}

type MyShift = {
  id: string
  isoDate: string
  date: string
  dow: string
  type: 'Day' | 'Night'
  shiftType: ShiftType
  isLead: boolean
}

type TeamMember = {
  id: string
  name: string
  avatar: string
  shift: 'Day' | 'Night'
  isLead: boolean
}

type OpenRequest = {
  id: string
  type: RequestType
  shift: string
  status: RequestStatus
  swapWith: string | null
  posted: string
  message: string
}

const REQUEST_STATUS_META: Record<RequestStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'Pending', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  approved: { label: 'Approved', color: '#065f46', bg: '#ecfdf5', border: '#a7f3d0' },
  denied: { label: 'Denied', color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  expired: { label: 'Expired', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
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

function formatShiftLabel(isoDate: string, shiftType: ShiftType): string {
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

function toUiStatus(status: PersistedRequestStatus, shiftDate: string | null, todayKey: string): RequestStatus {
  if (status === 'pending' && shiftDate !== null && shiftDate < todayKey) {
    return 'expired'
  }
  return status
}

function defaultMessage(type: RequestType): string {
  return type === 'swap' ? 'Requesting a swap for this shift.' : 'Requesting pickup coverage for this shift.'
}

function slotKey(date: string, shiftType: ShiftType): string {
  return `${date}:${shiftType}`
}

export default function SwapRequestPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const shiftIdFromQuery = searchParams.get('shiftId')

  const [view, setView] = useState<'list' | 'form'>('list')
  const [requestType, setRequestType] = useState<RequestType>('swap')
  const [selectedShift, setSelectedShift] = useState<string | null>(null)
  const [swapWith, setSwapWith] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myShifts, setMyShifts] = useState<MyShift[]>([])
  const [leadCountsBySlot, setLeadCountsBySlot] = useState<Record<string, number>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [myOpenRequests, setMyOpenRequests] = useState<OpenRequest[]>([])

  const selectedShiftData = useMemo(
    () => myShifts.find((shift) => shift.id === selectedShift) ?? null,
    [myShifts, selectedShift]
  )
  const selectedShiftRequiresLeadEligibleReplacement = useMemo(() => {
    if (!selectedShiftData?.isLead) return false
    const key = slotKey(selectedShiftData.isoDate, selectedShiftData.shiftType)
    const leadCount = leadCountsBySlot[key] ?? 0
    return leadCount <= 1
  }, [leadCountsBySlot, selectedShiftData])

  useEffect(() => {
    if (pathname === '/requests/new') {
      setView('form')
    }
  }, [pathname])

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
        setCurrentUserId(user.id)

        const [myShiftsResult, myRequestsResult] = await Promise.all([
          supabase
            .from('shifts')
            .select('id, date, shift_type, role')
            .eq('user_id', user.id)
            .gte('date', todayKey)
            .order('date', { ascending: true }),
          supabase
            .from('shift_posts')
            .select('id, type, status, created_at, shift_id, claimed_by, message')
            .eq('posted_by', user.id)
            .order('created_at', { ascending: false }),
        ])

        if (!active) return

        const mappedMyShifts = ((myShiftsResult.data ?? []) as ShiftRow[]).map((shift) => {
          const parsed = new Date(`${shift.date}T00:00:00`)
          const dow = Number.isNaN(parsed.getTime())
            ? shift.date
            : parsed.toLocaleDateString('en-US', { weekday: 'long' })

          return {
            id: shift.id,
            isoDate: shift.date,
            date: formatShortDate(shift.date),
            dow,
            type: shift.shift_type === 'day' ? 'Day' : 'Night',
            shiftType: shift.shift_type,
            isLead: shift.role === 'lead',
          } satisfies MyShift
        })

        const uniqueDates = Array.from(new Set(mappedMyShifts.map((shift) => shift.isoDate)))
        let leadCounts: Record<string, number> = {}
        if (uniqueDates.length > 0) {
          const { data: leadRows, error: leadRowsError } = await supabase
            .from('shifts')
            .select('date, shift_type')
            .eq('role', 'lead')
            .in('date', uniqueDates)

          if (leadRowsError) {
            console.error('Failed to load lead coverage for swap form:', leadRowsError)
          } else {
            leadCounts = ((leadRows ?? []) as Array<Pick<ShiftRow, 'date' | 'shift_type'>>).reduce(
              (acc, row) => {
                const key = slotKey(row.date, row.shift_type)
                acc[key] = (acc[key] ?? 0) + 1
                return acc
              },
              {} as Record<string, number>
            )
          }
        }

        const requestRows = (myRequestsResult.data ?? []) as ShiftPostRow[]
        const shiftIds = Array.from(
          new Set(requestRows.map((row) => row.shift_id).filter((value): value is string => Boolean(value)))
        )

        let shiftById = new Map<string, ShiftRow>()
        if (shiftIds.length > 0) {
          const { data: shiftRows } = await supabase
            .from('shifts')
            .select('id, date, shift_type, role')
            .in('id', shiftIds)

          shiftById = new Map(((shiftRows ?? []) as ShiftRow[]).map((row) => [row.id, row]))
        }

        const requestedPartnerIds = Array.from(
          new Set(requestRows.map((row) => row.claimed_by).filter((value): value is string => Boolean(value)))
        )

        let partnerById = new Map<string, string>()
        if (requestedPartnerIds.length > 0) {
          const { data: partnerRows } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', requestedPartnerIds)

          partnerById = new Map(
            ((partnerRows ?? []) as ProfileRow[]).map((row) => [row.id, row.full_name ?? 'Unknown therapist'])
          )
        }

        const mappedOpenRequests = requestRows.map((row) => {
          const shift = row.shift_id ? shiftById.get(row.shift_id) ?? null : null
          const status = toUiStatus(row.status, shift?.date ?? null, todayKey)

          return {
            id: row.id,
            type: row.type,
            shift: shift ? formatShiftLabel(shift.date, shift.shift_type) : 'Shift unavailable',
            status,
            swapWith: row.claimed_by ? partnerById.get(row.claimed_by) ?? null : null,
            posted: formatRelativeTime(row.created_at),
            message: row.message,
          } satisfies OpenRequest
        })

        if (!active) return

        setMyShifts(mappedMyShifts)
        setLeadCountsBySlot(leadCounts)
        setMyOpenRequests(mappedOpenRequests)
      } catch (loadError) {
        console.error('Failed to load swap request form data:', loadError)
        if (active) {
          setError('Could not load your shifts and requests.')
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

  useEffect(() => {
    setSwapWith(null)
    setSearch('')
  }, [selectedShift])

  useEffect(() => {
    if (!shiftIdFromQuery || myShifts.length === 0) return
    const exists = myShifts.some((shift) => shift.id === shiftIdFromQuery)
    if (!exists) return
    setView('form')
    setStep(1)
    setSelectedShift(shiftIdFromQuery)
  }, [myShifts, shiftIdFromQuery])

  useEffect(() => {
    if (requestType === 'pickup') {
      setSwapWith(null)
    }
  }, [requestType])

  useEffect(() => {
    let active = true

    async function loadTeamMembers() {
      if (!selectedShiftData || !currentUserId) {
        setTeamMembers([])
        return
      }

      let membersQuery = supabase
        .from('profiles')
        .select('id, full_name, role, shift_type, is_lead_eligible, is_active')
        .in('role', ['therapist', 'staff', 'lead'])
        .eq('shift_type', selectedShiftData.shiftType)
        .eq('is_active', true)
        .neq('id', currentUserId)

      if (selectedShiftRequiresLeadEligibleReplacement) {
        membersQuery = membersQuery.eq('is_lead_eligible', true)
      }

      const { data, error: membersError } = await membersQuery

      if (!active) return
      if (membersError) {
        console.error('Failed to load team members for swap request form:', membersError)
        setError('Could not load eligible team members.')
        return
      }

      const mappedMembers = ((data ?? []) as ProfileRow[])
        .filter((row) => row.is_active !== false)
        .map((row) => {
          const name = row.full_name ?? 'Unknown therapist'
          return {
            id: row.id,
            name,
            avatar: initials(name),
            shift: selectedShiftData.shiftType === 'day' ? 'Day' : 'Night',
            isLead: row.is_lead_eligible === true,
          } satisfies TeamMember
        })

      setTeamMembers(mappedMembers)
    }

    void loadTeamMembers()

    return () => {
      active = false
    }
  }, [currentUserId, selectedShiftData, selectedShiftRequiresLeadEligibleReplacement, supabase])

  const eligibleMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return teamMembers
    return teamMembers.filter((member) => member.name.toLowerCase().includes(normalized))
  }, [search, teamMembers])

  const selectedMember = useMemo(
    () => teamMembers.find((member) => member.id === swapWith) ?? null,
    [swapWith, teamMembers]
  )

  const handleSubmit = async () => {
    if (!currentUserId) {
      setError('Session expired. Please sign in again.')
      return
    }

    if (!selectedShift) {
      setError('Please select a shift first.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from('shift_posts').insert({
      type: requestType,
      shift_id: selectedShift,
      claimed_by: requestType === 'swap' ? swapWith : null,
      message: message.trim() || defaultMessage(requestType),
      status: 'pending',
      posted_by: currentUserId,
    })

    setSubmitting(false)

    if (insertError) {
      console.error('Failed to submit shift request:', insertError)
      setError('Could not submit your request. Please try again.')
      return
    }

    const destination = pathname.startsWith('/staff') || pathname === '/requests/new' ? '/staff/requests' : '/requests'
    router.push(destination)
  }

  const handleNew = () => {
    if (pathname.startsWith('/staff/requests')) {
      router.push('/requests/new')
      return
    }
    setView('form')
    setStep(1)
    setRequestType('swap')
    setSelectedShift(null)
    setSwapWith(null)
    setMessage('')
    setSearch('')
    setError(null)
  }

  const handleBack = () => {
    if (pathname === '/requests/new') {
      router.push('/staff/requests')
      return
    }
    setView('list')
    setStep(1)
    setError(null)
  }

  const handleNextStep = () => {
    setError(null)

    if (step === 1) {
      if (!selectedShift) {
        setError('Choose a shift before continuing.')
        return
      }
      setStep(2)
      return
    }

    if (step === 2) {
      setStep(3)
    }
  }

  const handlePrevStep = () => {
    setError(null)
    if (step === 1) {
      handleBack()
      return
    }

    if (step === 2) {
      setStep(1)
      return
    }

    setStep(2)
  }

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
          Swap Request Form
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Submit swap or pickup requests for your upcoming shifts.
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

      {view === 'list' && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>My Requests</p>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Track your pending, approved, denied, and expired requests.
              </p>
            </div>
            <button
              type="button"
              onClick={handleNew}
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
              New request
            </button>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>How swap requests work</p>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              Submit your request, wait for manager review, and check this list for updates.
            </p>
          </div>

          {loading ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '24px 18px',
                fontSize: 13,
                color: '#64748b',
              }}
            >
              Loading your requests...
            </div>
          ) : myOpenRequests.length === 0 ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '40px 24px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>No requests yet</p>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Create a swap or pickup request to post it to the shift board.
              </p>
              <button
                type="button"
                onClick={handleNew}
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
                Start request
              </button>
            </div>
          ) : (
            myOpenRequests.map((request) => {
              const statusMeta = REQUEST_STATUS_META[request.status]
              return (
                <div
                  key={request.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: request.type === 'swap' ? '#6d28d9' : '#0369a1',
                        background: request.type === 'swap' ? '#f5f3ff' : '#f0f9ff',
                        border: `1px solid ${request.type === 'swap' ? '#ddd6fe' : '#bae6fd'}`,
                        padding: '1px 7px',
                        borderRadius: 20,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {request.type}
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
                      }}
                    >
                      {statusMeta.label}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>{request.posted}</span>
                  </div>
                  <p style={{ marginTop: 8, fontSize: 13, color: '#0f172a', fontWeight: 700 }}>{request.shift}</p>
                  <p style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{request.message}</p>
                  {request.swapWith && (
                    <p style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Requested swap with: {request.swapWith}</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {view === 'form' && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={handleBack}
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
              Back to list
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3].map((value) => (
                <span
                  key={value}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    border: `1px solid ${step >= value ? '#d97706' : '#e5e7eb'}`,
                    color: step >= value ? '#b45309' : '#9ca3af',
                    background: step >= value ? '#fffbeb' : '#fff',
                  }}
                >
                  {value}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 18px' }}>
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Step 1: Request details</p>
                  <p style={{ marginTop: 2, fontSize: 12, color: '#64748b' }}>Choose request type and your shift.</p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {(['swap', 'pickup'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRequestType(type)}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '7px 16px',
                        borderRadius: 7,
                        border: `1px solid ${requestType === type ? '#d97706' : '#e5e7eb'}`,
                        background: requestType === type ? '#fffbeb' : '#fff',
                        color: requestType === type ? '#b45309' : '#64748b',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="selected-shift" style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    Select shift
                  </label>
                  <select
                    id="selected-shift"
                    value={selectedShift ?? ''}
                    onChange={(event) => setSelectedShift(event.target.value || null)}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 7,
                      padding: '8px 10px',
                      fontSize: 12,
                      color: '#374151',
                      background: '#fff',
                    }}
                  >
                    <option value="">Choose an upcoming shift...</option>
                    {myShifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.date} - {shift.type} {shift.isLead ? '(Lead)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedShiftData && (
                  <div
                    style={{
                      border: '1px solid #f1f5f9',
                      background: '#f8fafc',
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                      {selectedShiftData.date} - {selectedShiftData.type}
                    </p>
                    <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {selectedShiftData.dow} {selectedShiftData.isLead ? '- Lead assignment' : ''}
                    </p>
                  </div>
                )}
                {selectedShiftRequiresLeadEligibleReplacement && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '10px 14px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#92400e',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>Lead:</span>
                    <span>
                      This is currently the only lead assignment on this shift. Your replacement must
                      be lead eligible.
                    </span>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Step 2: Choose teammate</p>
                  <p style={{ marginTop: 2, fontSize: 12, color: '#64748b' }}>
                    Team members are filtered by shift type and lead eligibility when needed.
                  </p>
                </div>
                {selectedShiftRequiresLeadEligibleReplacement && (
                  <p
                    style={{
                      fontSize: 11,
                      color: '#92400e',
                      fontWeight: 600,
                      marginBottom: 8,
                      background: '#fffbeb',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #fde68a',
                    }}
                  >
                    Lead filter active: showing lead-eligible staff only
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="member-search" style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    Search team members
                  </label>
                  <input
                    id="member-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by teammate name..."
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 7,
                      padding: '8px 10px',
                      fontSize: 12,
                      color: '#374151',
                      background: '#fff',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {eligibleMembers.length === 0 ? (
                    <div
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: '12px 10px',
                        fontSize: 12,
                        color: '#64748b',
                        background: '#f8fafc',
                      }}
                    >
                      No eligible teammates found for this shift.
                    </div>
                  ) : (
                    eligibleMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSwapWith(member.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          border: `1px solid ${swapWith === member.id ? '#d97706' : '#e5e7eb'}`,
                          borderRadius: 8,
                          padding: '9px 10px',
                          background: swapWith === member.id ? '#fffbeb' : '#fff',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 999,
                            background: '#d97706',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {member.avatar}
                        </span>
                        <span style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{member.name}</span>
                          <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>
                            {member.shift} {member.isLead ? '- Lead' : ''}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <p style={{ fontSize: 11, color: '#64748b' }}>
                  {requestType === 'swap'
                    ? 'Selecting a swap partner is optional. You can leave it blank to request an open swap.'
                    : 'Pickup requests usually do not need a specific teammate.'}
                </p>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Step 3: Final message</p>
                  <p style={{ marginTop: 2, fontSize: 12, color: '#64748b' }}>Add context before posting your request.</p>
                </div>

                <div
                  style={{
                    border: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <p style={{ fontSize: 12, color: '#374151', fontWeight: 700, textTransform: 'capitalize' }}>
                    Type: {requestType}
                  </p>
                  <p style={{ fontSize: 12, color: '#374151' }}>
                    Shift: {selectedShiftData ? `${selectedShiftData.date} - ${selectedShiftData.type}` : 'Not selected'}
                  </p>
                  <p style={{ fontSize: 12, color: '#374151' }}>
                    Swap with: {selectedMember ? selectedMember.name : 'No specific teammate'}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor="request-message" style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    Message
                  </label>
                  <textarea
                    id="request-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    placeholder="Add details for your manager and team..."
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 7,
                      padding: '9px 10px',
                      fontSize: 12,
                      color: '#374151',
                      background: '#fff',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <button
              type="button"
              onClick={handlePrevStep}
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
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
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
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '7px 16px',
                  borderRadius: 7,
                  border: 'none',
                  background: '#d97706',
                  color: '#fff',
                  cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit request'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
