'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, Plus, Star } from 'lucide-react'

import { dateKeyFromDate } from '@/lib/schedule-helpers'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SkeletonCard, SkeletonListItem } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

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

const STATUS_META: Record<
  RequestStatus,
  { label: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  pending: {
    label: 'Pending',
    colorClass: 'text-[var(--warning-text)]',
    bgClass: 'bg-[var(--warning-subtle)]',
    borderClass: 'border-[var(--warning-border)]',
  },
  approved: {
    label: 'Approved',
    colorClass: 'text-[var(--success-text)]',
    bgClass: 'bg-[var(--success-subtle)]',
    borderClass: 'border-[var(--success-border)]',
  },
  denied: {
    label: 'Denied',
    colorClass: 'text-[var(--error-text)]',
    bgClass: 'bg-[var(--error-subtle)]',
    borderClass: 'border-[var(--error-border)]',
  },
  expired: {
    label: 'Expired',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    borderClass: 'border-border',
  },
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

function defaultMessage(type: RequestType): string {
  return type === 'swap'
    ? 'Requesting a swap for this shift.'
    : 'Requesting pickup coverage for this shift.'
}

function slotKey(date: string, shiftType: ShiftType): string {
  return `${date}:${shiftType}`
}

function SwapRequestPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const shiftIdFromQuery = searchParams.get('shiftId')
  const newFromParam = searchParams.get('new') === '1'

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
    if (pathname === '/requests/new' || newFromParam) {
      setView('form')
    }
  }, [pathname, newFromParam])

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
          new Set(
            requestRows
              .map((row) => row.shift_id)
              .filter((value): value is string => Boolean(value))
          )
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
          new Set(
            requestRows
              .map((row) => row.claimed_by)
              .filter((value): value is string => Boolean(value))
          )
        )

        let partnerById = new Map<string, string>()
        if (requestedPartnerIds.length > 0) {
          const { data: partnerRows } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', requestedPartnerIds)

          partnerById = new Map(
            ((partnerRows ?? []) as ProfileRow[]).map((row) => [
              row.id,
              row.full_name ?? 'Unknown therapist',
            ])
          )
        }

        const mappedOpenRequests = requestRows.map((row) => {
          const shift = row.shift_id ? (shiftById.get(row.shift_id) ?? null) : null
          const status = toUiStatus(row.status, shift?.date ?? null, todayKey)

          return {
            id: row.id,
            type: row.type,
            shift: shift ? formatShiftLabel(shift.date, shift.shift_type) : 'Shift unavailable',
            status,
            swapWith: row.claimed_by ? (partnerById.get(row.claimed_by) ?? null) : null,
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
        .in('role', ['therapist', 'lead'])
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

    const destination =
      pathname.startsWith('/staff') || pathname === '/requests/new'
        ? '/staff/requests'
        : '/requests'
    router.push(destination)
  }

  const handleNew = () => {
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

  const pendingCount = myOpenRequests.filter((request) => request.status === 'pending').length
  const approvedCount = myOpenRequests.filter((request) => request.status === 'approved').length
  const totalRequests = myOpenRequests.length
  const stepTitle =
    step === 1 ? 'Request details' : step === 2 ? 'Choose teammate' : 'Final message'

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <PageHeader
          title="My Requests"
          subtitle="Track your swap and pickup requests."
          badge={
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {totalRequests} open total
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--warning-text)]">
                {pendingCount} pending
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--success-border)] bg-[var(--success-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success-text)]">
                {approvedCount} approved
              </span>
            </div>
          }
          actions={
            <Button size="sm" onClick={handleNew}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New request
            </Button>
          }
        />
      )}

      {view === 'form' && (
        <div className="rounded-2xl border border-border/90 bg-[color-mix(in_oklch,var(--card)_92%,var(--secondary))] px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_10px_28px_rgba(15,23,42,0.06)] sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                {([1, 2, 3] as const).map((n) => (
                  <span
                    key={n}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                      step >= n
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-card text-muted-foreground'
                    )}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step {step} of 3
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">{stepTitle}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Complete each step to submit your request for manager review.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--error-border)] bg-[var(--error-subtle)] px-4 py-3 text-sm font-medium text-[var(--error-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="space-y-3">
          {/* How it works hint */}
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs font-semibold text-foreground">How requests work</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Submit a swap or pickup request and your manager will review it. Check this page for
              status updates.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </div>
          ) : myOpenRequests.length === 0 ? (
            <div className="rounded-xl border border-border bg-card px-6 py-10 text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mb-1 text-sm font-bold text-foreground">No requests yet</p>
              <p className="mb-4 text-xs text-muted-foreground">
                Create a swap or pickup request to post it to the shift board.
              </p>
              <Button size="sm" onClick={handleNew}>
                Start request
              </Button>
            </div>
          ) : (
            myOpenRequests.map((request) => {
              const meta = STATUS_META[request.status]
              const isPending = request.status === 'pending'
              return (
                <div
                  key={request.id}
                  className={cn(
                    'rounded-xl border bg-card p-4',
                    isPending ? 'border-[var(--warning-border)] shadow-sm' : 'border-border'
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        request.type === 'swap'
                          ? 'border-[var(--info-border)] bg-[var(--info-subtle)] text-[var(--info-text)]'
                          : 'border-border bg-secondary text-foreground'
                      )}
                    >
                      {request.type}
                    </span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        meta.borderClass,
                        meta.bgClass,
                        meta.colorClass
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{request.posted}</span>
                  </div>

                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1">
                    <CalendarDays className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{request.shift}</span>
                  </div>

                  <p className="text-sm text-muted-foreground">{request.message}</p>

                  {request.swapWith && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Swap with:{' '}
                      <span className="font-medium text-foreground">{request.swapWith}</span>
                    </p>
                  )}

                  {request.status === 'approved' && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--success-text)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approved by manager
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── FORM VIEW ── */}
      {view === 'form' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">Step 1: Request details</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose request type and your shift.
                  </p>
                </div>

                <div className="flex gap-2">
                  {(['swap', 'pickup'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRequestType(type)}
                      className={cn(
                        'rounded-lg border px-4 py-2 text-xs font-semibold capitalize transition-colors',
                        requestType === type
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground" htmlFor="selected-shift">
                    Select shift
                  </label>
                  <select
                    id="selected-shift"
                    value={selectedShift ?? ''}
                    onChange={(e) => setSelectedShift(e.target.value || null)}
                    className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                  >
                    <option value="">Choose an upcoming shift…</option>
                    {myShifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.date} — {shift.type}
                        {shift.isLead ? ' (Lead)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedShiftData && (
                  <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                    <p className="text-sm font-semibold text-foreground">
                      {selectedShiftData.date} — {selectedShiftData.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedShiftData.dow}
                      {selectedShiftData.isLead ? ' · Lead assignment' : ''}
                    </p>
                  </div>
                )}

                {selectedShiftRequiresLeadEligibleReplacement && (
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-2.5">
                    <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning-text)]" />
                    <p className="text-xs font-semibold text-[var(--warning-text)]">
                      This is the only lead assignment on this shift. Your replacement must be lead
                      eligible.
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">Step 2: Choose teammate</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Team members are filtered by shift type
                    {selectedShiftRequiresLeadEligibleReplacement ? ' and lead eligibility' : ''}.
                  </p>
                </div>

                {selectedShiftRequiresLeadEligibleReplacement && (
                  <div className="flex items-center gap-1.5 rounded-md border border-[var(--warning-border)] bg-[var(--warning-subtle)] px-3 py-1.5">
                    <Star className="h-3 w-3 text-[var(--warning-text)]" />
                    <p className="text-xs font-semibold text-[var(--warning-text)]">
                      Lead filter active — showing lead-eligible staff only
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground" htmlFor="member-search">
                    Search teammates
                  </label>
                  <input
                    id="member-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name…"
                    className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  {eligibleMembers.length === 0 ? (
                    <p className="rounded-md border border-border bg-muted/50 px-3 py-3 text-xs text-muted-foreground">
                      No eligible teammates found for this shift.
                    </p>
                  ) : (
                    eligibleMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSwapWith(member.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          swapWith === member.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:bg-secondary'
                        )}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--attention)]">
                          <span className="text-xs font-bold text-white">{member.avatar}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.shift}
                            {member.isLead ? ' · Lead eligible' : ''}
                          </p>
                        </div>
                        {member.isLead && <Star className="h-3.5 w-3.5 text-[var(--attention)]" />}
                      </button>
                    ))
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {requestType === 'swap'
                    ? 'Selecting a swap partner is optional. Leave blank to post an open swap.'
                    : 'Pickup requests usually do not need a specific teammate.'}
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">Step 3: Final message</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add context before posting your request.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/50 px-3 py-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground capitalize">
                    Type: {requestType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Shift:{' '}
                    {selectedShiftData
                      ? `${selectedShiftData.date} — ${selectedShiftData.type}`
                      : 'Not selected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    With: {selectedMember ? selectedMember.name : 'No specific teammate'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="text-xs font-semibold text-foreground"
                    htmlFor="request-message"
                  >
                    Message
                  </label>
                  <textarea
                    id="request-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Add details for your manager and team…"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Nav footer */}
          <div className="flex justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <Button variant="outline" size="sm" onClick={handlePrevStep}>
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            {step < 3 ? (
              <Button size="sm" onClick={handleNextStep}>
                Continue
              </Button>
            ) : (
              <Button size="sm" disabled={submitting} onClick={() => void handleSubmit()}>
                {submitting ? 'Submitting…' : 'Submit request'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RequestPageSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-24" rows={1} />
      <div className="space-y-3">
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </div>
    </div>
  )
}

export default function SwapRequestPage() {
  return (
    <Suspense fallback={<RequestPageSkeleton />}>
      <SwapRequestPageContent />
    </Suspense>
  )
}
