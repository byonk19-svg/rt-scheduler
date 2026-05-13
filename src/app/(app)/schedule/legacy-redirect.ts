type LegacyScheduleSearchParams = Record<string, string | string[] | undefined>

const SAFE_SCHEDULE_QUERY_PARAMS = new Set(['cycle', 'shift'])

export function buildScheduleRedirectPath(
  params: LegacyScheduleSearchParams = {},
  options: { preserveAll?: boolean } = {}
): string {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (!options.preserveAll && !SAFE_SCHEDULE_QUERY_PARAMS.has(key)) continue

    if (typeof value === 'string') {
      query.set(key, value)
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
    }
  }

  return query.size > 0 ? `/schedule?${query.toString()}` : '/schedule'
}
