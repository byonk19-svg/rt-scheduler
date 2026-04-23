import { fetchActiveOperationalCodeMap } from '@/lib/operational-codes'
import type {
  MyShift,
  OpenRequest,
  PersistedRequestStatus,
  RequestStatus,
  RequestType,
  ShiftRole,
  ShiftStatus,
  ShiftType,
  TeamMember,
} from '@/components/requests/request-types'

type RequestPageSupabaseClient = ReturnType<typeof import('@/lib/supabase/client').createClient>

type ShiftRow = {
  id: string
  date: string
  shift_type: ShiftType
  role: ShiftRole
  status: ShiftStatus
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

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatShiftLabel(isoDate: string, shiftType: ShiftType): string {
  return `${formatShortDate(isoDate)} - ${shiftType === 'day' ? 'Day' : 'Night'}`
}

export function formatRelativeTime(value: string): string {
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

export function isOlderThanHours(value: string, hours: number): boolean {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  return Date.now() - parsed.getTime() >= hours * 60 * 60 * 1000
}

export function toUiStatus(status: PersistedRequestStatus, createdAt: string): RequestStatus {
  if (status === 'pending' && isOlderThanHours(createdAt, 48)) {
    return 'expired'
  }
  return status
}

export function defaultMessage(type: RequestType): string {
  return type === 'swap'
    ? 'Requesting a swap for this shift.'
    : 'Requesting pickup coverage for this shift.'
}

export function slotKey(date: string, shiftType: ShiftType): string {
  return `${date}:${shiftType}`
}

export async function loadRequestPageData({
  supabase,
  todayKey,
  userId,
}: {
  supabase: RequestPageSupabaseClient
  todayKey: string
  userId: string
}): Promise<{
  myShifts: MyShift[]
  leadCountsBySlot: Record<string, number>
  myOpenRequests: OpenRequest[]
}> {
  const [myShiftsResult, myRequestsResult] = await Promise.all([
    supabase
      .from('shifts')
      .select('id, date, shift_type, role, status')
      .eq('user_id', userId)
      .gte('date', todayKey)
      .eq('status', 'scheduled')
      .order('date', { ascending: true }),
    supabase
      .from('shift_posts')
      .select('id, type, status, created_at, shift_id, claimed_by, message')
      .eq('posted_by', userId)
      .order('created_at', { ascending: false }),
  ])

  const myShiftRows = (myShiftsResult.data ?? []) as ShiftRow[]
  const activeOperationalCodes = await fetchActiveOperationalCodeMap(
    supabase,
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
        date: formatShortDate(shift.date),
        dow,
        type: shift.shift_type === 'day' ? 'Day' : 'Night',
        shiftType: shift.shift_type,
        isLead: shift.role === 'lead',
      } satisfies MyShift
    })

  const uniqueDates = Array.from(new Set(myShifts.map((shift) => shift.isoDate)))
  let leadCountsBySlot: Record<string, number> = {}
  if (uniqueDates.length > 0) {
    const { data: leadRows, error: leadRowsError } = await supabase
      .from('shifts')
      .select('date, shift_type')
      .eq('role', 'lead')
      .in('date', uniqueDates)

    if (leadRowsError) {
      console.error('Failed to load lead coverage for swap form:', leadRowsError)
    } else {
      leadCountsBySlot = ((leadRows ?? []) as Array<Pick<ShiftRow, 'date' | 'shift_type'>>).reduce(
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
      requestRows.map((row) => row.shift_id).filter((value): value is string => Boolean(value))
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
      requestRows.map((row) => row.claimed_by).filter((value): value is string => Boolean(value))
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

  const myOpenRequests = requestRows.map((row) => {
    const shift = row.shift_id ? (shiftById.get(row.shift_id) ?? null) : null
    const status = toUiStatus(row.status, row.created_at)

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

  return {
    myShifts,
    leadCountsBySlot,
    myOpenRequests,
  }
}

export async function loadRequestTeamMembers({
  currentUserId,
  selectedShiftData,
  selectedShiftRequiresLeadEligibleReplacement,
  supabase,
}: {
  currentUserId: string
  selectedShiftData: MyShift
  selectedShiftRequiresLeadEligibleReplacement: boolean
  supabase: RequestPageSupabaseClient
}): Promise<TeamMember[]> {
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

  const { data, error } = await membersQuery

  if (error) {
    throw error
  }

  return ((data ?? []) as ProfileRow[])
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
}
