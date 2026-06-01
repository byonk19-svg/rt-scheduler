import type { AvailabilityOverrideSource } from '@/lib/employee-directory'

export type AvailabilityOverwriteKey = {
  date: string
  shift_type: 'day' | 'night' | 'both'
}

export type AvailabilityOverwriteCandidate = AvailabilityOverwriteKey & {
  source: AvailabilityOverrideSource
}

export type ExistingAvailabilityOverwriteRow = {
  date: string
  shift_type: string | null
  source: AvailabilityOverrideSource | string | null
}

function overwriteKey(row: { date: string; shift_type: string | null }): string {
  return `${row.date}|${row.shift_type}`
}

export function findBlockingAvailabilityOverwrite(
  existingRows: ExistingAvailabilityOverwriteRow[],
  incomingRows: AvailabilityOverwriteCandidate[]
): ExistingAvailabilityOverwriteRow | null {
  const incomingByKey = new Map(incomingRows.map((row) => [overwriteKey(row), row]))

  for (const existingRow of existingRows) {
    const incomingRow = incomingByKey.get(overwriteKey(existingRow))
    if (!incomingRow) continue
    if (existingRow.source && existingRow.source !== incomingRow.source) {
      return existingRow
    }
  }

  return null
}
