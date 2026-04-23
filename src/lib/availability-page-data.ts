import type { AvailabilityEntryTableRow } from '@/app/availability/availability-requests-table'

export type AvailabilityCycle = {
  id: string
  label: string
  start_date: string
  end_date: string
  published: boolean
  archived_at?: string | null
  availability_due_at?: string | null
}

export type AvailabilityOverrideRow = {
  id: string
  date: string
  shift_type: 'day' | 'night' | 'both'
  override_type: 'force_off' | 'force_on'
  note: string | null
  created_at: string
  updated_at?: string | null
  source?: 'therapist' | 'manager' | null
  therapist_id: string
  cycle_id: string
  profiles: { full_name: string } | { full_name: string }[] | null
  schedule_cycles:
    | { label: string; start_date: string; end_date: string }
    | { label: string; start_date: string; end_date: string }[]
    | null
}

function getOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function selectAvailabilityCycle<T extends AvailabilityCycle>(
  cycles: T[],
  selectedCycleIdFromParams?: string
): T | null {
  return (
    cycles.find((cycle) => cycle.id === selectedCycleIdFromParams) ??
    cycles.find((cycle) => cycle.published === false) ??
    cycles[0] ??
    null
  )
}

export function mapAvailabilityRowsToTableRows(
  entries: AvailabilityOverrideRow[]
): AvailabilityEntryTableRow[] {
  return entries.map((entry) => {
    const cycle = getOne(entry.schedule_cycles)
    const requester = getOne(entry.profiles)
    return {
      id: entry.id,
      therapistId: entry.therapist_id,
      cycleId: entry.cycle_id,
      date: entry.date,
      reason: entry.note,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at ?? undefined,
      requestedBy: requester?.full_name ?? 'Unknown user',
      cycleLabel: cycle
        ? `${cycle.label} (${cycle.start_date} to ${cycle.end_date})`
        : 'Unknown cycle',
      entryType: entry.override_type,
      shiftType: entry.shift_type,
      canDelete: true,
    }
  })
}
