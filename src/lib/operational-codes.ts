import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'

export type OperationalCode = Exclude<AssignmentStatus, 'scheduled'>

export type ActiveOperationalEntryRow = {
  shift_id: string
  code: OperationalCode
}

export const OPERATIONAL_CODE_VALUES = [
  'on_call',
  'call_in',
  'cancelled',
  'left_early',
] as const satisfies ReadonlyArray<OperationalCode>

export function isOperationalCode(value: string): value is OperationalCode {
  return OPERATIONAL_CODE_VALUES.includes(value as OperationalCode)
}

export function toLegacyShiftStatusFromOperationalCode(
  code: OperationalCode | null,
  fallback: ShiftStatus = 'scheduled'
): ShiftStatus {
  if (code === 'on_call') return 'on_call'
  if (code === 'call_in' || code === 'cancelled') return 'called_off'
  return fallback
}

export async function fetchActiveOperationalCodeMap(
  supabase: unknown,
  shiftIds: string[]
): Promise<Map<string, OperationalCode>> {
  if (shiftIds.length === 0) return new Map()

  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: unknown
        ) => {
          in: (column: string, values: string[]) => PromiseLike<{ data: unknown; error: unknown }>
        }
      }
    }
  }

  const { data, error } = await client
    .from('shift_operational_entries')
    .select('shift_id, code')
    .eq('active', true)
    .in('shift_id', shiftIds)

  if (error) {
    console.error('Could not load active operational entries:', error)
    return new Map()
  }

  const map = new Map<string, OperationalCode>()
  for (const row of (data ?? []) as ActiveOperationalEntryRow[]) {
    if (!row.shift_id || !row.code) continue
    map.set(row.shift_id, row.code)
  }
  return map
}
