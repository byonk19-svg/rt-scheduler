import type { ShiftRole, ShiftStatus, ShiftType } from '@/lib/shift-types'

export type RequestType = 'swap' | 'pickup'
export type PersistedRequestStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'withdrawn'
export type InterestStatus = 'pending' | 'selected' | 'declined' | 'withdrawn'
export type RequestStatus = PersistedRequestStatus | 'selected'
export type RequestVisibility = 'team' | 'direct'
export type RecipientResponse = 'pending' | 'accepted' | 'declined'
export type RequestKind = 'standard' | 'call_in'

export type RequestShiftRow = {
  id: string
  date: string
  shift_type: ShiftType
  role: ShiftRole
  status: ShiftStatus
  schedule_cycles?: { published: boolean } | { published: boolean }[] | null
}

export type RequestShiftPostRow = {
  id: string
  type: RequestType
  status: PersistedRequestStatus
  recipient_response: RecipientResponse | null
  request_kind: RequestKind | null
  created_at: string
  shift_id: string | null
  posted_by: string | null
  claimed_by: string | null
  visibility: RequestVisibility | null
  message: string
}

export type RequestShiftPostInterestRow = {
  id: string
  shift_post_id: string
  therapist_id: string
  status: InterestStatus
  created_at: string
}

export function requestInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatRequestShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatRequestShiftLabel(isoDate: string, shiftType: ShiftType): string {
  return `${formatRequestShortDate(isoDate)} - ${shiftType === 'day' ? 'Day' : 'Night'}`
}

export function formatRequestRelativeTime(value: string): string {
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

export function isRequestOlderThanHours(value: string, hours: number): boolean {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  return Date.now() - parsed.getTime() >= hours * 60 * 60 * 1000
}

export function toRequestUiStatus(
  status: PersistedRequestStatus,
  createdAt: string
): RequestStatus {
  if (status === 'pending' && isRequestOlderThanHours(createdAt, 48)) {
    return 'expired'
  }
  return status
}

export function toInterestRequestStatus(status: InterestStatus): RequestStatus {
  if (status === 'selected') return 'selected'
  if (status === 'withdrawn') return 'withdrawn'
  if (status === 'declined') return 'denied'
  return 'pending'
}

export function defaultRequestMessage(type: RequestType): string {
  return type === 'swap'
    ? 'Requesting a swap for this shift.'
    : 'Requesting pickup coverage for this shift.'
}

export function requestSlotKey(date: string, shiftType: ShiftType): string {
  return `${date}:${shiftType}`
}

export async function mutateShiftPost(body: Record<string, unknown>) {
  const response = await fetch('/api/shift-posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) {
    throw new Error(payload?.error ?? 'Could not update that request.')
  }

  return payload
}
