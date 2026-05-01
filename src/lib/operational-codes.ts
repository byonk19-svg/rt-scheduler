import type { AssignmentStatus, ShiftStatus } from '@/lib/shift-types'

export type OperationalCode = Exclude<AssignmentStatus, 'scheduled'>

export type ActiveOperationalEntryRow = {
  shift_id: string
  code: OperationalCode
}

export type ActiveOperationalDetail = {
  code: OperationalCode
  note: string | null
  leftEarlyTime: string | null
}

type ActiveOperationalEntryDetailRow = ActiveOperationalEntryRow & {
  note: string | null
  left_early_time: string | null
}

export const OPERATIONAL_CODE_VALUES = [
  'on_call',
  'call_in',
  'cancelled',
  'left_early',
] as const satisfies ReadonlyArray<OperationalCode>
const OPERATIONAL_CODE_SHIFT_ID_BATCH_SIZE = 100

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
  const detailMap = await fetchActiveOperationalDetailMap(supabase, shiftIds)
  return new Map(Array.from(detailMap.entries(), ([shiftId, detail]) => [shiftId, detail.code]))
}

export async function fetchActiveOperationalDetailMap(
  supabase: unknown,
  shiftIds: string[]
): Promise<Map<string, ActiveOperationalDetail>> {
  if (shiftIds.length === 0) return new Map()
  const uniqueShiftIds = Array.from(new Set(shiftIds))

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

  const rows: ActiveOperationalEntryDetailRow[] = []

  for (
    let start = 0;
    start < uniqueShiftIds.length;
    start += OPERATIONAL_CODE_SHIFT_ID_BATCH_SIZE
  ) {
    const batch = uniqueShiftIds.slice(start, start + OPERATIONAL_CODE_SHIFT_ID_BATCH_SIZE)
    const { data, error } = await client
      .from('shift_operational_entries')
      .select('shift_id, code, note, left_early_time')
      .eq('active', true)
      .in('shift_id', batch)

    if (error) {
      console.error('Could not load active operational entries:', error)
      return new Map()
    }

    rows.push(...((data ?? []) as ActiveOperationalEntryDetailRow[]))
  }

  const map = new Map<string, ActiveOperationalDetail>()
  for (const row of rows) {
    if (!row.shift_id || !row.code) continue
    map.set(row.shift_id, {
      code: row.code,
      note: row.note ?? null,
      leftEarlyTime: row.left_early_time ?? null,
    })
  }

  return map
}
