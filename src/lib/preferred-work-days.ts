import type { PreferredWorkDaysMode } from '@/lib/staff-onboarding'

export type PreferredWorkDaysSelection = {
  mode: PreferredWorkDaysMode
  days: number[]
}

function normalizePreferredWorkDays(rawValues: FormDataEntryValue[]): number[] {
  return Array.from(
    new Set(
      rawValues
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    )
  ).sort((left, right) => left - right)
}

export function resolvePreferredWorkDaysMode(
  rawMode: string | null | undefined,
  days: readonly number[] | null | undefined
): PreferredWorkDaysMode {
  if (rawMode === 'specific_days' || rawMode === 'no_preference') {
    return rawMode
  }

  return Array.isArray(days) && days.length > 0 ? 'specific_days' : 'unset'
}

export function parsePreferredWorkDaysSelection(formData: FormData): PreferredWorkDaysSelection {
  const days = normalizePreferredWorkDays(formData.getAll('preferred_work_days'))
  const mode = resolvePreferredWorkDaysMode(
    String(formData.get('preferred_work_days_mode') ?? 'unset'),
    days
  )

  if (mode === 'no_preference') {
    return { mode, days: [] }
  }

  if (mode === 'specific_days') {
    return { mode, days }
  }

  return { mode: 'unset', days: [] }
}
