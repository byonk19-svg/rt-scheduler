import type { Role } from '@/lib/auth/roles'

type CoverageCycleShape = {
  id: string
  start_date: string
  end_date: string
  published: boolean
}

type ResolveCoverageCycleArgs<T extends CoverageCycleShape> = {
  cycles: T[]
  cycleIdFromUrl: string | null
  role: Role | null
  todayKey: string
}

export function resolveCoverageCycle<T extends CoverageCycleShape>({
  cycles,
  cycleIdFromUrl,
  role,
  todayKey,
}: ResolveCoverageCycleArgs<T>): T | null {
  const visibleCycles = role === 'therapist' ? cycles.filter((cycle) => cycle.published) : cycles
  const fromUrl = cycleIdFromUrl
    ? visibleCycles.find((cycle) => cycle.id === cycleIdFromUrl) ?? null
    : null

  if (fromUrl) return fromUrl

  const activeCycle =
    visibleCycles.find((cycle) => cycle.start_date <= todayKey && cycle.end_date >= todayKey) ??
    null

  if (activeCycle) return activeCycle

  const nextUpcomingCycle =
    [...visibleCycles]
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .find((cycle) => cycle.start_date > todayKey) ?? null

  return nextUpcomingCycle
}
