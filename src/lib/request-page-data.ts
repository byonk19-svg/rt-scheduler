import { fetchActiveOperationalCodeMap, isWorkingScheduledShift } from '@/lib/operational-codes'
import {
  formatRequestRelativeTime,
  formatRequestShiftLabel,
  isRequestVisibleInOpenView,
  requestSlotKey,
  toInterestRequestStatus,
  toRequestUiStatus,
  type RequestShiftPostInterestRow,
  type RequestShiftPostRow,
  type RequestShiftRow,
} from '@/lib/request-workflow'
import type { MyShift, OpenRequest, TeamMember } from '@/components/requests/request-page-model'

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
}

type ProfileRow = {
  id: string
  full_name: string | null
  role?: string | null
  shift_type: RequestShiftRow['shift_type'] | null
  is_lead_eligible?: boolean | null
  is_active?: boolean | null
}

export type RequestPageSnapshot = {
  currentUserId: string
  leadCountsBySlot: Record<string, number>
  myOpenRequests: OpenRequest[]
  myShifts: MyShift[]
}

export { deriveRequestStage }

export async function loadRequestPageSnapshot(
  supabase: SupabaseLike,
  todayKey: string
): Promise<RequestPageSnapshot | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const [myShiftsResult, myRequestsResult, myInterestRowsResult] = await Promise.all([
    supabase
      .from('shifts')
      .select('id, date, shift_type, role, status, schedule_cycles!inner(published)')
      .eq('user_id', user.id)
      .gte('date', todayKey)
      .eq('status', 'scheduled')
      .eq('schedule_cycles.published', true)
      .order('date', { ascending: true }),
    supabase
      .from('shift_posts')
      .select(
        'id, type, status, recipient_response, recipient_responded_at, request_kind, created_at, shift_id, posted_by, claimed_by, visibility, message'
      )
      .or(`posted_by.eq.${user.id},claimed_by.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('shift_post_interests')
      .select('id, shift_post_id, therapist_id, status, created_at')
      .eq('therapist_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
  ])

  const myShiftRows = (myShiftsResult.data ?? []) as RequestShiftRow[]
  const activeOperationalCodes = await fetchActiveOperationalCodeMap(
    supabase as never,
    myShiftRows.map((shift) => shift.id)
  )
  const myShifts = myShiftRows
    .filter((shift) => !activeOperationalCodes.has(shift.id))
    .map((shift) => {
      const parsed = new Date(`${shift.date}T00:00:00`)
      const dow = Number.isNaN(parsed.getTime())
        ? shift.date
        : parsed.toLocaleDateString('en-US', { weekday: 'long' })

      return {
        id: shift.id,
        isoDate: shift.date,
        date: formatRequestDate(shift.date),
        dow,
        type: shift.shift_type === 'day' ? 'Day' : 'Night',
        shiftType: shift.shift_type,
        isLead: shift.role === 'lead',
      } satisfies MyShift
    })

  const uniqueDates = Array.from(new Set(myShifts.map((shift) => shift.isoDate)))
  const leadCountsBySlot = await loadLeadCountsBySlot(supabase, uniqueDates)

  const requestRows = (myRequestsResult.data ?? []) as RequestShiftPostRow[]
  const interestRows = (myInterestRowsResult.data ?? []) as RequestShiftPostInterestRow[]
  const myOpenRequests = await mapOpenRequests({
    currentUserId: user.id,
    interestRows,
    requestRows,
    supabase,
  })

  return {
    currentUserId: user.id,
    leadCountsBySlot,
    myOpenRequests,
    myShifts,
  }
}

export async function loadEligibleRequestTeammates(
  shiftId: string,
  requestType: 'swap' | 'pickup'
): Promise<TeamMember[]> {
  const response = await fetch(
    `/api/shift-posts/eligible-teammates?shiftId=${encodeURIComponent(shiftId)}&requestType=${encodeURIComponent(requestType)}`,
    {
      cache: 'no-store',
    }
  )
  const payload = (await response.json().catch(() => null)) as {
    error?: string
    teammates?: TeamMember[]
  } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Could not load eligible teammates.')
  }

  return payload?.teammates ?? []
}

function deriveRequestStage(params: {
  currentUserId: string
  request: RequestShiftPostRow
  involvement: OpenRequest['involvement']
}): { label: string; detail: string | null } {
  const { request, involvement } = params

  if (request.status === 'approved') {
    return {
      label: 'Approved',
      detail:
        request.visibility === 'direct'
          ? 'Teammate accepted and the manager approved the trade request.'
          : 'Manager approved this request.',
    }
  }

  if (request.status === 'withdrawn') {
    if (request.visibility === 'direct' && involvement === 'received_direct') {
      return {
        label:
          request.recipient_response === 'accepted'
            ? 'Withdrawn after your acceptance'
            : 'Withdrawn by requester',
        detail: 'The requester closed this request before final manager approval.',
      }
    }

    return {
      label: 'Withdrawn',
      detail: 'The requester closed this request before final manager approval.',
    }
  }

  if (request.status === 'denied') {
    if (request.visibility === 'direct') {
      if (request.recipient_response === 'declined') {
        return {
          label: involvement === 'received_direct' ? 'You declined' : 'Declined by teammate',
          detail: 'The direct trade request stopped before manager approval.',
        }
      }

      return {
        label: 'Denied by manager',
        detail: 'Manager review did not approve this request.',
      }
    }

    return {
      label: 'Denied by manager',
      detail: 'Manager review did not approve this request.',
    }
  }

  if (request.visibility === 'direct') {
    if (request.recipient_response === 'accepted') {
      return {
        label: 'Waiting on manager approval',
        detail:
          involvement === 'received_direct'
            ? 'You accepted this trade request. Nothing changes unless a manager approves it.'
            : 'Your teammate accepted. Nothing changes unless a manager approves it.',
      }
    }

    if (request.recipient_response === 'pending') {
      return {
        label: involvement === 'received_direct' ? 'Needs your response' : 'Waiting for teammate',
        detail:
          involvement === 'received_direct'
            ? 'Accept sends it to manager review. Decline stops the request.'
            : 'Your teammate must accept before this goes to manager review.',
      }
    }
  }

  if (request.visibility === 'team' && request.type === 'swap' && request.claimed_by) {
    if (involvement === 'claimed') {
      return {
        label: 'Waiting on manager approval',
        detail:
          'You are the suggested trade partner. Nothing changes unless a manager approves it.',
      }
    }

    return {
      label: 'Waiting on manager approval',
      detail: 'You suggested a trade partner. A manager still has to approve the trade request.',
    }
  }

  return {
    label: 'Waiting on manager approval',
    detail: 'This request is on the team board for manager review.',
  }
}

async function loadLeadCountsBySlot(supabase: SupabaseLike, uniqueDates: string[]) {
  if (uniqueDates.length === 0) return {}

  const { data: leadRows, error: leadRowsError } = await supabase
    .from('shifts')
    .select('id, date, shift_type, status, schedule_cycles!inner(published)')
    .eq('role', 'lead')
    .in('date', uniqueDates)
    .eq('status', 'scheduled')
    .eq('schedule_cycles.published', true)

  if (leadRowsError) {
    console.error('Failed to load lead coverage for swap form:', leadRowsError)
    return {}
  }

  const typedLeadRows = (leadRows ?? []) as Array<
    Pick<RequestShiftRow, 'id' | 'date' | 'shift_type' | 'status'>
  >
  const activeOperationalCodes = await fetchActiveOperationalCodeMap(
    supabase as never,
    typedLeadRows.map((row) => row.id)
  )

  return typedLeadRows
    .filter((row) =>
      isWorkingScheduledShift({
        status: row.status,
        activeOperationalCode: activeOperationalCodes.get(row.id),
      })
    )
    .reduce(
      (acc, row) => {
        const key = requestSlotKey(row.date, row.shift_type)
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
}

async function mapOpenRequests(params: {
  currentUserId: string
  interestRows: RequestShiftPostInterestRow[]
  requestRows: RequestShiftPostRow[]
  supabase: SupabaseLike
}) {
  const { currentUserId, interestRows, requestRows, supabase } = params
  const requestRowIds = new Set(requestRows.map((row) => row.id))
  const interestPostIds = Array.from(
    new Set(interestRows.map((row) => row.shift_post_id).filter((id) => !requestRowIds.has(id)))
  )

  let interestPostRows: RequestShiftPostRow[] = []
  if (interestPostIds.length > 0) {
    const { data: interestPostData } = await supabase
      .from('shift_posts')
      .select(
        'id, type, status, recipient_response, recipient_responded_at, request_kind, created_at, shift_id, posted_by, claimed_by, visibility, message'
      )
      .in('id', interestPostIds)

    interestPostRows = (interestPostData ?? []) as RequestShiftPostRow[]
  }

  const allRequestRows = [...requestRows, ...interestPostRows]
  const shiftIds = Array.from(
    new Set(
      allRequestRows.map((row) => row.shift_id).filter((value): value is string => Boolean(value))
    )
  )

  let shiftById = new Map<string, RequestShiftRow>()
  if (shiftIds.length > 0) {
    const { data: shiftRows } = await supabase
      .from('shifts')
      .select('id, date, shift_type, role')
      .in('id', shiftIds)

    shiftById = new Map(((shiftRows ?? []) as RequestShiftRow[]).map((row) => [row.id, row]))
  }

  const requestedPartnerIds = Array.from(
    new Set(
      allRequestRows
        .flatMap((row) => [row.claimed_by, row.posted_by])
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

    const missingPartnerIds = requestedPartnerIds.filter((id) => !partnerById.has(id))
    const visibleCounterpartyNames = await loadVisibleRequestCounterpartyNames(missingPartnerIds)
    for (const [id, fullName] of visibleCounterpartyNames) {
      partnerById.set(id, fullName)
    }
  }

  const mappedOpenRequests = requestRows.map((row) => {
    const shift = row.shift_id ? (shiftById.get(row.shift_id) ?? null) : null
    const involvement =
      row.posted_by === currentUserId
        ? 'posted'
        : row.visibility === 'direct'
          ? 'received_direct'
          : 'claimed'
    const counterpartyId = involvement === 'posted' ? row.claimed_by : row.posted_by
    const stage = deriveRequestStage({
      currentUserId,
      request: row,
      involvement,
    })

    return {
      id: row.id,
      type: row.type,
      visibility: row.visibility ?? 'team',
      involvement,
      sourcePostId: row.id,
      recipientResponse: row.recipient_response ?? null,
      recipientRespondedAt: row.recipient_responded_at ?? null,
      requestKind: row.request_kind ?? 'standard',
      shift: shift ? formatRequestShiftLabel(shift.date, shift.shift_type) : 'Shift unavailable',
      status: toRequestUiStatus(row.status, row.created_at),
      stageLabel: stage.label,
      stageDetail: stage.detail,
      createdAt: row.created_at,
      swapWith: counterpartyId ? (partnerById.get(counterpartyId) ?? null) : null,
      posted: formatRequestRelativeTime(row.created_at),
      message: row.message,
    } satisfies OpenRequest
  })

  const postById = new Map(allRequestRows.map((row) => [row.id, row]))
  const interestOnlyRequests = interestRows
    .filter((interest) => !requestRowIds.has(interest.shift_post_id))
    .map((interest) => {
      const row = postById.get(interest.shift_post_id)
      const shift = row?.shift_id ? (shiftById.get(row.shift_id) ?? null) : null
      const stage =
        interest.status === 'selected'
          ? {
              label: 'Approved',
              detail: 'Manager selected you as the responder for this request.',
            }
          : {
              label: 'Waiting for manager review',
              detail: 'Your interest is still waiting on manager selection.',
            }

      return {
        id: interest.id,
        type: row?.type ?? 'pickup',
        visibility: row?.visibility ?? 'team',
        involvement: 'interest',
        sourcePostId: row?.id ?? null,
        recipientResponse: row?.recipient_response ?? null,
        recipientRespondedAt: row?.recipient_responded_at ?? null,
        requestKind: row?.request_kind ?? 'standard',
        shift: shift ? formatRequestShiftLabel(shift.date, shift.shift_type) : 'Shift unavailable',
        status: toInterestRequestStatus(
          interest.status,
          row
            ? {
                status: row.status,
                createdAt: row.created_at,
              }
            : null
        ),
        stageLabel: stage.label,
        stageDetail: stage.detail,
        createdAt: interest.created_at,
        swapWith: row?.posted_by ? (partnerById.get(row.posted_by) ?? null) : null,
        posted: formatRequestRelativeTime(interest.created_at),
        message: row?.message ?? 'Coverage offer submitted.',
      } satisfies OpenRequest
    })

  return [...mappedOpenRequests, ...interestOnlyRequests]
    .filter((request) => {
      if (request.involvement === 'interest') {
        return request.status !== 'expired' && request.status !== 'withdrawn'
      }

      const sourceRow = postById.get(request.sourcePostId ?? request.id)
      if (!sourceRow) return true
      return isRequestVisibleInOpenView(sourceRow.status, sourceRow.created_at)
    })
    .sort((left, right) => {
      const createdAtComparison = right.createdAt.localeCompare(left.createdAt)
      if (createdAtComparison !== 0) {
        return createdAtComparison
      }

      return right.id.localeCompare(left.id)
    })
}

async function loadVisibleRequestCounterpartyNames(ids: string[]) {
  if (ids.length === 0 || typeof window === 'undefined') {
    return new Map<string, string>()
  }

  const params = new URLSearchParams({ ids: ids.join(',') })
  const response = await fetch(`/api/shift-posts/request-counterparties?${params.toString()}`, {
    cache: 'no-store',
  }).catch(() => null)

  if (!response?.ok) {
    return new Map<string, string>()
  }

  const payload = (await response.json().catch(() => null)) as {
    profiles?: Array<{ id?: string; fullName?: string | null }>
  } | null

  return new Map(
    (payload?.profiles ?? [])
      .filter((profile): profile is { id: string; fullName: string } =>
        Boolean(profile.id && profile.fullName)
      )
      .map((profile) => [profile.id, profile.fullName])
  )
}

function formatRequestDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
