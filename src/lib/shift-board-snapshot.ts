import { toUiRole, type UiRole } from '@/lib/auth/roles'
import { resolveCoverageCycle } from '@/lib/coverage/active-cycle'
import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import { sortPickupInterestCandidates } from '@/lib/pickup-interest-presentation'
import { buildDateRange, dateKeyFromDate } from '@/lib/schedule-helpers'
import { canUserSeeShiftPost } from '@/lib/shift-post-visibility'

export type ShiftBoardTab = 'open' | 'history'
export type ShiftBoardRequestType = 'swap' | 'pickup'
export type ShiftBoardPersistedRequestStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'withdrawn'
export type ShiftBoardRequestStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'withdrawn'
export type ShiftBoardShiftType = 'day' | 'night'
export type ShiftBoardShiftStatus = 'scheduled' | 'on_call' | 'sick' | 'called_off'
export type ShiftBoardShiftRole = 'lead' | 'staff'

type ShiftPostRow = {
  id: string
  shift_id: string | null
  posted_by: string | null
  claimed_by: string | null
  visibility: 'team' | 'direct' | null
  recipient_response: 'pending' | 'accepted' | 'declined' | null
  request_kind: 'standard' | 'call_in' | null
  message: string
  type: ShiftBoardRequestType
  status: ShiftBoardPersistedRequestStatus
  created_at: string
  override_reason?: string | null
}

type ShiftPostInterestRow = {
  id: string
  shift_post_id: string
  therapist_id: string
  status: 'pending' | 'withdrawn' | 'selected' | 'declined'
  created_at: string
}

type ShiftLookupRow = {
  id: string
  date: string
  shift_type: ShiftBoardShiftType
  role: ShiftBoardShiftRole
}

export type ShiftBoardProfileLookupRow = {
  id: string
  full_name: string | null
  role?: string | null
  is_lead_eligible?: boolean | null
  employment_type?: string | null
}

type CycleRow = {
  id: string
  start_date: string
  end_date: string
  published: boolean
}

type ShiftCoverageRow = {
  id: string
  date: string
  shift_type: ShiftBoardShiftType
  status: ShiftBoardShiftStatus
  role: ShiftBoardShiftRole
  user_id: string | null
}

export type ShiftBoardRequest = {
  id: string
  type: ShiftBoardRequestType
  visibility: 'team' | 'direct'
  recipientResponse: 'pending' | 'accepted' | 'declined' | null
  requestKind: 'standard' | 'call_in'
  poster: string
  postedById: string | null
  avatar: string
  shift: string
  shiftDate: string | null
  shiftId: string | null
  message: string
  status: ShiftBoardRequestStatus
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
  shiftType: ShiftBoardShiftType | null
  shiftRole: ShiftBoardShiftRole | null
  overrideReason: string | null
}

export type ShiftBoardMetricState = {
  unfilled: number
  missingLead: number
}

export type ShiftBoardAuthorizedSnapshot = {
  unauthorized: false
  role: UiRole
  requests: ShiftBoardRequest[]
  metrics: ShiftBoardMetricState
  pendingCount: number
  currentUserId: string
  therapists: ShiftBoardProfileLookupRow[]
  employmentType: string | null
  scheduledByDateEntries: Array<[string, Array<[string, ShiftBoardShiftType]>]>
}

export type ShiftBoardSnapshot = { unauthorized: true } | ShiftBoardAuthorizedSnapshot

const HISTORY_STATUSES: ShiftBoardRequestStatus[] = ['approved', 'denied', 'expired', 'withdrawn']

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatShiftLabel(isoDate: string, shiftType: ShiftBoardShiftType): string {
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

function countsTowardCoverage(status: ShiftBoardShiftStatus): boolean {
  return status === 'scheduled'
}

function isOlderThanHours(value: string, hours: number): boolean {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  return Date.now() - parsed.getTime() >= hours * 60 * 60 * 1000
}

function toUiStatus(
  status: ShiftBoardPersistedRequestStatus,
  createdAt: string
): ShiftBoardRequestStatus {
  if (status === 'pending' && isOlderThanHours(createdAt, 48)) {
    return 'expired'
  }
  return status
}

export async function loadShiftBoardSnapshot({
  supabase,
  tab,
}: {
  supabase: {
    auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase query builders are structurally large; this helper only relies on a small fluent subset at runtime.
    from: (table: string) => any
  }
  tab: ShiftBoardTab
}): Promise<ShiftBoardSnapshot> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { unauthorized: true }
  }

  const todayKey = dateKeyFromDate(new Date())
  let postsQuery = supabase
    .from('shift_posts')
    .select(
      'id, shift_id, posted_by, claimed_by, visibility, recipient_response, request_kind, message, type, status, created_at, override_reason'
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (tab === 'open') {
    postsQuery = postsQuery.neq('status', 'expired')
    postsQuery = postsQuery.neq('status', 'withdrawn')
  } else {
    postsQuery = postsQuery.in('status', HISTORY_STATUSES).limit(50)
  }

  const [therapistsResult, profileResult, cyclesResult, pendingPostsResult, postsResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, is_lead_eligible')
        .in('role', ['therapist', 'lead'])
        .eq('is_active', true)
        .order('full_name'),
      supabase
        .from('profiles')
        .select('id, full_name, role, employment_type')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('schedule_cycles')
        .select('id, start_date, end_date, published')
        .order('start_date', { ascending: false })
        .limit(24),
      supabase
        .from('shift_posts')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'pending'),
      postsQuery,
    ])

  const profile = (profileResult.data ?? null) as ShiftBoardProfileLookupRow | null
  const role = toUiRole(profile?.role)
  const therapists = (therapistsResult.data ?? []) as ShiftBoardProfileLookupRow[]
  const pendingCount = pendingPostsResult.count ?? 0

  const cycles = (cyclesResult.data ?? []) as CycleRow[]
  const activeCycle = resolveCoverageCycle({
    cycles,
    cycleIdFromUrl: null,
    role: 'manager',
    todayKey,
  })

  let unfilled = 0
  let missingLead = 0
  const scheduledByDate = new Map<string, Map<string, ShiftBoardShiftType>>()

  if (activeCycle) {
    const { data: coverageData, error: coverageError } = await supabase
      .from('shifts')
      .select('id, date, shift_type, status, role, user_id')
      .eq('cycle_id', activeCycle.id)
      .gte('date', activeCycle.start_date)
      .lte('date', activeCycle.end_date)

    if (coverageError) {
      console.error('Failed to load shift coverage metrics for requests board:', coverageError)
    } else {
      const bySlot = new Map<string, ShiftCoverageRow[]>()
      const coverageRows = (coverageData ?? []) as ShiftCoverageRow[]
      const activeOperationalCodes = await fetchActiveOperationalCodeMap(
        supabase,
        coverageRows.map((row) => row.id)
      )
      const hasActiveOperationalCode = (shiftId: string): boolean =>
        activeOperationalCodes.has(shiftId)

      for (const row of coverageRows) {
        const key = `${row.date}:${row.shift_type}`
        const bucket = bySlot.get(key) ?? []
        bucket.push(row)
        bySlot.set(key, bucket)

        if (row.user_id) {
          if (row.status !== 'scheduled') continue
          if (hasActiveOperationalCode(row.id)) continue
          let userMap = scheduledByDate.get(row.date)
          if (!userMap) {
            userMap = new Map()
            scheduledByDate.set(row.date, userMap)
          }
          if (!userMap.has(row.user_id)) {
            userMap.set(row.user_id, row.shift_type)
          }
        }
      }

      for (const date of buildDateRange(activeCycle.start_date, activeCycle.end_date)) {
        for (const shiftType of ['day', 'night'] as const) {
          const slotRows = bySlot.get(`${date}:${shiftType}`) ?? []
          const activeRows = slotRows.filter(
            (row) => countsTowardCoverage(row.status) && !hasActiveOperationalCode(row.id)
          )
          const assignedCount = activeRows.length
          const leadCount = activeRows.filter((row) => row.role === 'lead').length

          if (assignedCount === 0) unfilled += 1
          if (leadCount === 0) missingLead += 1
        }
      }
    }
  }

  const postRows = (postsResult.data ?? []) as ShiftPostRow[]
  const postIds = postRows.map((row) => row.id)
  const { data: interestRowsData } =
    postIds.length > 0
      ? await supabase
          .from('shift_post_interests')
          .select('id, shift_post_id, therapist_id, status, created_at')
          .in('shift_post_id', postIds)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
      : { data: [] }
  const shiftIds = Array.from(
    new Set(postRows.map((row) => row.shift_id).filter((value): value is string => Boolean(value)))
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
        .concat(((interestRowsData ?? []) as ShiftPostInterestRow[]).map((row) => row.therapist_id))
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
      ((profileRows ?? []) as ShiftBoardProfileLookupRow[]).map((row) => [
        row.id,
        row.full_name ?? 'Unknown',
      ])
    )
  }

  const visiblePostRows = postRows
    .filter((row) => canUserSeeShiftPost(row, user.id, role))
    .sort((left, right) => {
      const createdAtComparison = right.created_at.localeCompare(left.created_at)
      if (createdAtComparison !== 0) {
        return createdAtComparison
      }

      return right.id.localeCompare(left.id)
    })

  const interestsByPostId = new Map<string, ShiftPostInterestRow[]>()
  for (const row of (interestRowsData ?? []) as ShiftPostInterestRow[]) {
    const bucket = interestsByPostId.get(row.shift_post_id) ?? []
    bucket.push(row)
    interestsByPostId.set(row.shift_post_id, bucket)
  }

  const requests = visiblePostRows.map((row) => {
    const shift = row.shift_id ? shiftsById.get(row.shift_id) : null
    const posterName = row.posted_by
      ? (namesById.get(row.posted_by) ?? 'Unknown therapist')
      : 'Unknown therapist'
    const shiftLabel = shift ? formatShiftLabel(shift.date, shift.shift_type) : 'Shift unavailable'

    const activeInterests = (interestsByPostId.get(row.id) ?? [])
      .filter(
        (
          interest
        ): interest is ShiftPostInterestRow & {
          status: 'pending' | 'selected'
        } => interest.status === 'pending' || interest.status === 'selected'
      )
      .map((interest) => ({
        ...interest,
        createdAt: interest.created_at,
      }))
    const orderedActiveInterests = sortPickupInterestCandidates(activeInterests)
    const myActiveInterest =
      orderedActiveInterests.find((interest) => interest.therapist_id === user.id) ?? null
    return {
      id: row.id,
      type: row.type,
      visibility: row.visibility ?? 'team',
      recipientResponse: row.recipient_response ?? null,
      requestKind: row.request_kind ?? 'standard',
      poster: posterName,
      postedById: row.posted_by,
      avatar: initials(posterName),
      shift: shiftLabel,
      shiftDate: shift?.date ?? null,
      shiftId: row.shift_id ?? null,
      message: row.message,
      status: toUiStatus(row.status, row.created_at),
      posted: formatRelativeTime(row.created_at),
      postedAt: row.created_at,
      swapWithName: row.claimed_by ? (namesById.get(row.claimed_by) ?? null) : null,
      swapWithId: row.claimed_by ?? null,
      claimedById: row.claimed_by ?? null,
      pendingInterestCount: orderedActiveInterests.length,
      hasMyInterest: Boolean(myActiveInterest),
      myInterestId: myActiveInterest?.id ?? null,
      myInterestStatus:
        myActiveInterest?.status === 'selected' || myActiveInterest?.status === 'pending'
          ? myActiveInterest.status
          : null,
      interestCandidates: orderedActiveInterests.map((interest) => ({
        id: interest.id,
        therapistId: interest.therapist_id,
        therapistName: namesById.get(interest.therapist_id) ?? 'Unknown therapist',
        createdAt: interest.createdAt,
        status: interest.status,
      })),
      shiftType: shift?.shift_type ?? null,
      shiftRole: shift?.role ?? null,
      overrideReason: row.override_reason ?? null,
    } satisfies ShiftBoardRequest
  })

  return {
    unauthorized: false,
    role,
    requests,
    metrics: { unfilled, missingLead },
    pendingCount,
    currentUserId: user.id,
    therapists,
    employmentType: profile?.employment_type ?? null,
    scheduledByDateEntries: Array.from(scheduledByDate.entries()).map(([date, entries]) => [
      date,
      Array.from(entries.entries()),
    ]),
  }
}
